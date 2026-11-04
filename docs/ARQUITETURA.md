# PILOTAGEM — Arquitetura e decisões técnicas

> MVP de Sistema de Controle Financeiro e Gestão Operacional para Academia de Automobilismo.
> Documento de referência técnica (também serve de base para o artigo acadêmico).

---

## 1. Visão geral

O PILOTAGEM é um sistema **interno** (não público) usado por recepção, instrutores, financeiro e
administração. Ele centraliza em uma única base de dados aquilo que hoje está espalhado entre
Google Agenda, grupo de WhatsApp, Granatum e planilhas de Excel.

```
┌───────────────────────────┐        HTTP/JSON (REST)        ┌──────────────────────────────┐
│  client/  (React + Vite)  │  ───────────────────────────▶  │  server/  (Node + Express)   │
│  SPA em português (pt-BR) │   Authorization: Bearer <JWT>  │  API /api/*                  │
│  Tailwind, Recharts       │  ◀───────────────────────────  │  RBAC, validação Zod, Audit  │
└───────────────────────────┘                                └──────────────┬───────────────┘
                                                                            │ Mongoose
                                                                ┌───────────▼───────────┐
                                                                │ MongoDB Community     │
                                                                │ (local, porta 27017)  │
                                                                └───────────────────────┘
                                                     Comprovantes → server/uploads/ (privado)
```

* **Tudo roda localmente.** Nenhum serviço pago, nenhuma API externa, nenhuma CDN: fontes
  (Inter, Saira) e ícones (Lucide) são empacotados pelo npm.
* **Modo desenvolvimento:** Vite em `http://localhost:5173` + API em `http://localhost:4000`
  (o Vite faz *proxy* de `/api` para a API).
* **Modo apresentação (`npm run demo`):** o frontend é compilado e servido pela própria API em
  `http://localhost:4000` — um único processo, uma única URL.

## 2. Stack

| Camada | Tecnologia | Observação |
|---|---|---|
| Frontend | React 19, Vite 7, JavaScript | Sem TypeScript (requisito) |
| Estilo | Tailwind CSS 4 | Tokens de marca via `@theme` |
| Rotas | React Router 7 | Rotas protegidas por permissão |
| HTTP | Axios | Interceptor de token e de 401 |
| Gráficos | Recharts 3 | |
| Ícones | lucide-react | |
| Formulários | React Hook Form + Zod | |
| Backend | Node 20+, Express 5 | Erros assíncronos tratados nativamente |
| Banco | MongoDB Community 7+ / Mongoose 9 | Conexão via `MONGODB_URI` |
| Auth | JWT (jsonwebtoken) + bcryptjs | bcryptjs = mesmo algoritmo bcrypt, sem compilação nativa (portabilidade Windows/macOS) |
| Validação | Zod 4 | Mesmo padrão no front e no back |
| Exportação | CSV (gerado manualmente, UTF-8 com BOM, `;`) e PDF (pdfkit) | Gerados no servidor → respeitam permissões e são auditados |
| Upload | multer | Comprovantes salvos em disco local, download só autenticado |
| Testes | `node:test` + supertest | Sem Jest (menos dependências) |

## 3. Estrutura de diretórios

```
pilotagem/
├── package.json            # npm workspaces + scripts (dev, demo, seed, test, setup, doctor)
├── scripts/                # setup.js (cria .env), doctor.js (diagnóstico do ambiente)
├── docs/ARQUITETURA.md
├── README.md / LOCAL_SETUP.md
├── server/
│   ├── .env.example
│   ├── uploads/            # comprovantes (ignorado pelo Git)
│   └── src/
│       ├── server.js       # ponto de entrada
│       ├── app.js          # montagem do Express
│       ├── config/         # env, db, permissões, constantes
│       ├── models/         # schemas Mongoose
│       ├── middlewares/    # auth, permissão, validação, erros, sanitização, upload
│       ├── validators/     # schemas Zod por módulo
│       ├── services/       # regras de negócio (financeiro, disponibilidade, privacidade, relatórios…)
│       ├── controllers/    # adaptam HTTP ⇄ services
│       ├── routes/         # roteadores Express
│       ├── utils/          # datas (America/Sao_Paulo), dinheiro, texto
│       ├── seed/           # dados demonstrativos
│       └── tests/          # testes automatizados
└── client/
    ├── .env.example
    └── src/
        ├── assets/         # logos Pilotech
        ├── components/     # UI reutilizável (ui/), calendário, gráficos, formulários
        ├── layouts/        # AppLayout (sidebar + header), AuthLayout
        ├── pages/          # uma pasta por módulo
        ├── contexts/       # AuthContext, ToastContext
        ├── hooks/          # useApi, useDebounce…
        ├── services/       # cliente HTTP (axios)
        └── utils/          # formatação BRL, datas pt-BR, rótulos
```

## 4. Modelagem do MongoDB

Convenções:

* **Valores monetários em centavos (inteiros).** `R$ 1.234,56` é armazenado como `123456`.
  Evita erros de ponto flutuante em somas e parcelamentos.
* **Datas em UTC** no banco; toda conversão de exibição/entrada usa `America/Sao_Paulo`.
* Registros financeiros **nunca são apagados**: são cancelados/estornados com motivo, autor e data.

### 4.1 Entidades

| Coleção | Campos principais | Observações |
|---|---|---|
| **User** | name, email, passwordHash, role, instructor→Instructor, active, tokenVersion | `tokenVersion` invalida tokens ao trocar senha/desativar |
| **Client** | code, firstName, lastName, phone, phoneDigits, notes, confidential, alias, searchText, aliasSearch | Apenas nome, sobrenome e telefone (LGPD — minimização) |
| **Instructor** | name, phone, specialty, bio, notes, active, color | Vinculado a um User com perfil instrutor |
| **Service** | name, description, category, durationMinutes, basePrice, pricingMode, priceTiers[], quantityLabel, requiresInstructor, requiredResources[], compatibleRooms[], active | `priceTiers` implementa preço por quantidade (ex.: 1→250, 2→450…) |
| **Package** | name, description, items[] *(PackageItem embutido)*, simulatorCount, totalDurationMinutes, referencePrice, price, discount, validityDays, active | PackageItem embutido: não tem ciclo de vida próprio |
| **Room** | name, code, description, type, capacity, amenities[], status, shared, hourlyRate | Status físico (ativa/manutenção/inativa). Ocupação é derivada das reservas. `shared` = uso compartilhado |
| **Resource** | name, category, code, description, location, room→Room, status, notes | Simuladores e equipamentos |
| **Reservation** | code, title, client, responsible, appointment, rooms[], resources[], start, end, usageType, amount, status, notes | **Livro-razão de ocupação** de salas e recursos |
| **Appointment** | code, client, service, package, sale, instructor, room, resources[], quantity, start, end, contractedAmount, origin, status, notes, sessionNotes[], history[], reservation | Agenda centralizada |
| **Sale** | code, client, items[] *(SaleItem embutido com snapshot de preço)*, appointments[], saleDate, dueDate, subtotal, discount, total, category, paymentTerms, status + campos calculados | Snapshot preserva o preço histórico |
| **Payment** | sale, client, method, amount, installmentsCount, receipts[], receiptReference, status | Um acordo de pagamento (ex.: "R$ 1.000 no crédito em 2x") |
| **Installment** | sale, payment, client, number, totalInstallments, amount, dueDate, method, status, receivedAt | A parcela é a unidade de **recebimento efetivo** |
| **Expense** | code, description, category, amount, dueDate, paidAt, method, status, supplier, notes | |
| **FinancialCategory** | name, type (receita/despesa), color, active | Configurável |
| **AuditLog** | user, userName, userRole, action, entity, entityId, summary, details, ip, createdAt | Somente leitura |
| **Settings** | receptionCanManageSales, instructorsCanUpdateStatus… | Documento único (`_id: "global"`) |
| **Counter** | _id, seq | Códigos sequenciais (V-2026-0001…) via `$inc` atômico |
| **Lock** | _id (chave do recurso), owner, expiresAt (TTL) | Exclusão mútua para reservas |

### 4.2 Relacionamentos

```
Client 1──N Appointment N──1 Service          Sale 1──N Payment 1──N Installment
   │            │  └──N──1 Instructor            │ └─ items[] (SaleItem: Service | Package)
   │            │  └──1──1 Reservation N──N Room │
   │            │                      N──N Resource
   └──1──N Sale ◀──N──N──▶ Appointment         Package 1──N PackageItem──1 Service
User 1──N AuditLog          User 0..1──1 Instructor
```

### 4.3 Índices principais

* `Reservation { rooms, start, end }`, `{ resources, start, end }`, `{ start }`
* `Appointment { instructor, start, end }`, `{ client, start }`, `{ start, status }`
* `Installment { status, dueDate }`, `{ sale }`, `{ receivedAt }`
* `Sale { saleDate }`, `{ client }`, `{ status }`; `Expense { dueDate }`, `{ paidAt }`
* `Client { phoneDigits }`, `{ searchText }`; `AuditLog { createdAt }`, `{ entity, entityId }`
* `Lock { expiresAt }` com TTL

## 5. Regras financeiras

O exemplo do enunciado — treinamento de **R$ 2.000**, sendo **R$ 1.000 via Pix** e **R$ 1.000 no
cartão de crédito em 2x** — fica assim:

| Registro | Valor | Situação |
|---|---|---|
| Sale.total (contratado) | 2.000,00 | ativa |
| Payment #1 Pix → Installment 1/1 | 1.000,00 | **recebida** em 03/11 |
| Payment #2 Crédito → Installment 1/2 | 500,00 | pendente, vence 03/12 |
| Payment #2 Crédito → Installment 2/2 | 500,00 | pendente, vence 03/01 |

Valores derivados (recalculados a cada operação, de forma idempotente):

* **Recebido** = soma das parcelas `recebida` de pagamentos ativos → 1.000
* **Programado** = soma das parcelas `pendente` → 1.000 (o cartão **não** conta como recebido
  até a confirmação do repasse)
* **Saldo pendente** = contratado − recebido → 1.000
* **Sem forma de pagamento definida** = contratado − recebido − programado → 0
* **Situação**: `em_aberto` (nada recebido), `parcial`, `quitada`

Indicadores:

| Indicador | Cálculo |
|---|---|
| Total vendido | Σ `Sale.total` de vendas **ativas** com data de venda no período |
| Total recebido | Σ parcelas `recebida` com `receivedAt` no período (regime de caixa) |
| Despesas pagas | Σ despesas `paga` com `paidAt` no período |
| Resultado operacional | Recebido − Despesas pagas (regime de caixa) |
| A receber | Σ (total − recebido) de vendas ativas |
| Vencidos | parcelas pendentes com vencimento < hoje + parte sem forma de pagamento de vendas vencidas |

Vendas canceladas e pagamentos estornados não entram em nenhum indicador.

## 6. Disponibilidade e concorrência

**Regras.** Um recurso (sala, equipamento, instrutor) não pode ter dois compromissos sobrepostos.
Dois intervalos `[a1, a2)` e `[b1, b2)` conflitam quando `a1 < b2 && b1 < a2` (encostar não conflita:
10h–11h e 11h–12h são compatíveis).

* Reservas `cancelada` não bloqueiam; agendamentos `cancelado` e `nao_compareceu` não bloqueiam.
* Sala com status diferente de `ativa` e equipamento com status diferente de `disponivel` não podem
  ser reservados.
* Reserva de **manutenção** é uma reserva como outra qualquer: bloqueia o horário.
* **Salas exclusivas** aceitam uma reserva por horário. **Salas de uso compartilhado** (ex.: Sala de
  Simuladores com vários simuladores) aceitam treinamentos simultâneos — nesse caso a disponibilidade é
  controlada por equipamento. Locação, evento, uso interno e manutenção ocupam a sala inteira, inclusive
  as compartilhadas, e conflitam com qualquer treinamento no mesmo horário.
* Instrutor exigido pelo serviço, sala compatível e a quantidade de simuladores (inclusive a escolhida na faixa
  de preço por quantidade) são validados antes da verificação de conflitos.
* Cada sala, equipamento e o instrutor são validados **individualmente**; a resposta lista todos os
  conflitos encontrados.

**Concorrência sem transações.** O MongoDB instalado como serviço local é *standalone* (sem
replica set), portanto não oferece transações multi-documento. A alternativa adotada:

1. A operação calcula as chaves envolvidas (`room:<id>`, `resource:<id>`, `instructor:<id>`) e as
   ordena (evita *deadlock*).
2. Para cada chave insere um documento em `locks` com `_id = chave`. O `_id` é único, então só
   **uma** operação consegue inseri-lo; a concorrente recebe erro de chave duplicada e aguarda.
3. Com os locks em mãos: verifica conflitos → grava agendamento/reserva → libera os locks.
4. Locks têm `expiresAt` (TTL) — se o processo cair, o lock expira sozinho.

O teste `availability.test.js` dispara duas reservas idênticas **ao mesmo tempo** e verifica que
exatamente uma é aceita.

**Financeiro.** Os totais das vendas são *derivados* das parcelas e recalculados por completo após
cada operação (`recalcSale`), o que torna a operação idempotente e auto-corretiva mesmo sem
transação.

## 7. Autenticação

* `POST /api/auth/login` → JWT assinado (HS256) com `sub`, `role`, `tv` (tokenVersion); expira em 8h.
* Toda requisição recarrega o usuário: usuário desativado ou com senha trocada perde o acesso na hora.
* Limite de tentativas de login (10/min por IP).
* Senhas com bcrypt (custo 10).

## 8. Permissões (RBAC)

As permissões são definidas **no backend** (`server/src/config/permissions.js`). O frontend apenas
recebe a lista de permissões do usuário (`GET /api/auth/me`) para decidir o que exibir — toda rota
da API valida a permissão novamente.

| Permissão | Admin | Recepção | Financeiro | Instrutor |
|---|:-:|:-:|:-:|:-:|
| Dashboard | ✔ | ✔ (operacional) | ✔ (financeiro) | Portal |
| Clientes: consultar / cadastrar | ✔ / ✔ | ✔ / ✔ | ✔ / — | — |
| Clientes confidenciais: revelar | ✔ | ✔ (auditado) | — | — |
| Agenda: consultar / gerenciar | ✔ / ✔ | ✔ / ✔ | ✔ / — | própria |
| Reservas de salas/equipamentos | ✔ | ✔ | — | consulta |
| Catálogo (serviços, pacotes) | gerencia | consulta | consulta | — |
| Salas e equipamentos | gerencia | consulta | — | consulta |
| Instrutores | gerencia | consulta | — | — |
| Vendas e pagamentos | ✔ | ✔ *se autorizado nas Configurações* | ✔ | — |
| Despesas, categorias, contas a receber | ✔ | — | ✔ | — |
| Relatórios financeiros / operacionais | ✔ / ✔ | — / ✔ | ✔ / — | — |
| Atualizar status das próprias sessões | ✔ | ✔ | — | ✔ *se autorizado* |
| Usuários, configurações, auditoria | ✔ | — | — | — |

## 9. Confidencialidade (LGPD)

* Cadastro mínimo: nome, sobrenome, telefone. Nada de CPF, e-mail, endereço ou nascimento.
* Cliente **confidencial** possui um **nome de exibição alternativo** (ex.: “Piloto Reservado 03”).
* A API aplica a máscara (`services/privacy.service.js`) em **toda** resposta que contém cliente:
  listas, agenda, vendas, dashboards, relatórios e exportações.
* Dados reais só são devolvidos por `POST /api/clients/:id/reveal`, que exige a permissão
  `clients:confidential` e **gera um registro de auditoria** a cada acesso.
* Busca por nome real de cliente confidencial só funciona para quem tem essa permissão
  (evita descobrir a existência do cliente por tentativa).
* Dashboards e relatórios **sempre** usam o nome de exibição, mesmo para o administrador.
* Comprovantes ficam fora da pasta pública e só são baixados com token válido.

## 10. Premissas de negócio adotadas

Informações não confirmadas pela empresa foram resolvidas com premissas simples:

1. Preços do catálogo são **referências públicas** dos sites e editáveis pelo administrador.
2. A tabela de simuladores (1→R$250, 2→R$450, 3→R$600, 4→R$700) é tratada como **preço total da
   opção**, sem presumir cobrança por hora ou por simulador. Foi associada à Sessão Racing Room
   (cujo preço “a partir de R$ 250” coincide com a primeira faixa).
3. Salas, simuladores, equipamentos, clientes e funcionários do seed são **fictícios**.
4. Pagamentos em cartão de crédito são registrados como parcelas **pendentes** até alguém confirmar
   o recebimento — o sistema não presume o fluxo de repasse da operadora.
5. “Não compareceu” libera o horário (o horário já passou e não houve uso).
6. Resultado operacional é calculado em **regime de caixa** (recebido − pago).
7. Recepção pode registrar vendas e pagamentos por padrão; o administrador pode revogar em
   Configurações. O mesmo vale para instrutores atualizarem o status das sessões.

## 11. Fluxos principais

**Agendamento de treinamento** — recepção seleciona cliente, serviço (e pacote, se houver), data/horário,
instrutor, sala e equipamentos → a interface consulta `POST /api/availability/check` a cada alteração →
ao salvar, a API adquire os locks dos recursos, revalida tudo, grava o agendamento e a reserva vinculada e,
opcionalmente, a venda com pagamento inicial → auditoria.

**Remanejamento** — mesma validação, excluindo o próprio agendamento/reserva; registra "remanejado de X para Y"
no histórico do agendamento e na auditoria.

**Venda e pagamento** — venda (itens com preço congelado) → pagamentos (forma, valor, parcelas, recebido agora?)
→ parcelas → confirmação de recebimento com data efetiva → `recalcSale` atualiza recebido/programado/saldo/situação.
Estorno cancela o pagamento e suas parcelas sem apagar; cancelamento da venda exige estornar antes o que já
foi recebido.

**Instrutor** — portal lista apenas os próprios agendamentos (filtro feito no servidor pelo vínculo
usuário → instrutor), sem valores; pode iniciar/concluir/registrar ausência e anotar observações.

## 12. Testes

`npm test` executa 59 testes com `node:test` + supertest em um banco isolado (`pilotagem_test`):
cálculos financeiros, pagamentos parciais e parcelados, estornos, permissões por perfil, conflitos de
disponibilidade (incluindo requisições simultâneas), confidencialidade e o fluxo completo da demonstração.

## 13. Fora do escopo do MVP

Integrações com Google Calendar, Granatum, WhatsApp, Wix e sites da Pilotech; gateway de
pagamento, boletos reais, processamento de cartões; hospedagem em nuvem; app mobile nativo;
agendamento público para clientes. São evoluções possíveis, não parte desta entrega.
