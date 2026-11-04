# PILOTAGEM

**MVP de Sistema de Controle Financeiro e Gestão Operacional para Academia de Automobilismo**

Sistema web interno (MERN) que centraliza agenda, salas, simuladores, instrutores, vendas, pagamentos,
despesas e relatórios da academia de pilotagem usada como referência (Pilotech) — substituindo a
combinação de Google Agenda, grupo de WhatsApp, Granatum e planilhas.

> Projeto acadêmico. Todos os clientes, funcionários, salas e equipamentos do banco de demonstração são
> **fictícios**. Os preços iniciais vêm dos sites públicos da empresa e não são tabela comercial confirmada.

---

## Sumário

1. [Início rápido](#início-rápido)
2. [Contas de demonstração](#contas-de-demonstração)
3. [O que o sistema faz](#o-que-o-sistema-faz)
4. [Roteiro sugerido para a apresentação](#roteiro-sugerido-para-a-apresentação)
5. [Scripts disponíveis](#scripts-disponíveis)
6. [Stack e arquitetura](#stack-e-arquitetura)
7. [Estrutura de pastas](#estrutura-de-pastas)
8. [Testes automatizados](#testes-automatizados)
9. [Segurança, privacidade e LGPD](#segurança-privacidade-e-lgpd)
10. [Premissas adotadas](#premissas-adotadas)
11. [Fora do escopo / evolução futura](#fora-do-escopo--evolução-futura)

📘 **Tutorial completo de instalação (Windows e macOS), solução de problemas e checklist do dia da
apresentação: [LOCAL_SETUP.md](LOCAL_SETUP.md).**
📐 **Arquitetura, modelagem e regras de negócio: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).**

---

## Início rápido

Pré-requisitos: **Node.js 20.19+ (recomendado 22 LTS)** e **MongoDB Community Server** em execução.

```bash
npm install        # instala backend e frontend (npm workspaces)
npm run setup      # cria server/.env e client/.env a partir dos modelos
npm run seed       # carrega os dados de demonstração
npm run dev        # inicia API + interface
```

Acesse **http://localhost:5173**.

Para a apresentação, prefira o modo de processo único (mais rápido, uma só URL):

```bash
npm run demo       # compila a interface e serve tudo em http://localhost:4000
```

Algo deu errado? Rode `npm run doctor` — ele verifica Node, arquivos `.env`, dependências, MongoDB e dados.

---

## Contas de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@pilotagem.local` | `Admin@123` |
| Recepção | `recepcao1@pilotagem.local` | `Recepcao@123` |
| Recepção | `recepcao2@pilotagem.local` | `Recepcao@123` |
| Financeiro | `financeiro@pilotagem.local` | `Financeiro@123` |
| Instrutor (Thiago Ventura — simulação) | `instrutor1@pilotagem.local` | `Instrutor@123` |
| Instrutor (Camila Rocha — psicofísico) | `instrutor2@pilotagem.local` | `Instrutor@123` |
| Instrutor (Eduardo Lins — telemetria) | `instrutor3@pilotagem.local` | `Instrutor@123` |

A tela de login tem botões de **acesso rápido** para cada perfil (desative com
`VITE_SHOW_DEMO_LOGINS=false` em `client/.env`).

---

## O que o sistema faz

| Módulo | Destaques |
|---|---|
| **Dashboard** | Versão por perfil. Vendido, recebido, despesas pagas, resultado operacional, a receber e em atraso; gráficos de receitas × despesas, faturamento por modalidade, despesas por categoria, evolução dos recebimentos e treinamentos realizados; próximos agendamentos, movimentações, pendências e alertas. Filtro de período. |
| **Agenda** | Visões dia, semana, mês e lista. Origem (recepção, sites, telefone, WhatsApp). Status do ciclo completo. Verificação **ao vivo** de instrutor, sala e cada simulador antes de salvar. Remanejamento com histórico. |
| **Reservas e salas** | Quadro do dia com a ocupação de cada sala, equipamento e instrutor. Reservas de várias salas e equipamentos (locação, evento, uso interno, manutenção). |
| **Clientes** | Cadastro mínimo (nome, sobrenome, telefone). Clientes **confidenciais** com nome de exibição; revelação de dados auditada. Histórico de agendamentos e financeiro. |
| **Serviços e pacotes** | Catálogo editável, **preço por quantidade** (1→R$ 250, 2→R$ 450, 3→R$ 600, 4→R$ 700), recursos exigidos, salas compatíveis; pacotes com vários serviços, desconto e validade. |
| **Vendas** | Serviço, pacote, locação ou combinação personalizada. Preço congelado no histórico. Pagamento integral, parcial, parcelado, antecipado ou posterior; várias formas por venda; estorno com motivo; comprovantes anexados localmente. |
| **Contas a receber** | Parcelas a receber, vencidas e recebidas; confirmação da data efetiva de recebimento. |
| **Despesas** | Contas a pagar por categoria, pagamento, cancelamento/estorno com histórico. Categorias configuráveis. |
| **Relatórios** | 13 relatórios (financeiros e operacionais) com filtros, totais e exportação **CSV** (Excel pt-BR) e **PDF**. |
| **Portal do instrutor** | Treinamentos de hoje, próximos e calendário; iniciar/concluir sessão; observações. Sem dados financeiros. |
| **Auditoria** | Logins, cadastros, remanejamentos, cancelamentos, alterações financeiras, permissões, exportações e acessos a dados confidenciais. |
| **Configurações** | Usuários e perfis, autorizações por perfil, horário de funcionamento e restauração dos dados de demonstração. |

---

## Roteiro sugerido para a apresentação

O fluxo abaixo é exatamente o da seção 15 do enunciado — e é verificado pelo teste automatizado
`server/src/tests/demo-flow.test.js`.

1. Entre como **Recepção** (acesso rápido na tela de login).
2. **Clientes › Novo cliente** — cadastre um cliente fictício (só nome, sobrenome e telefone).
3. **Serviços e pacotes** — mostre o catálogo e a regra de preço por quantidade do Racing Room.
4. **Novo › Nova venda** — venda o *Pacote Evolução — 5 sessões* ao cliente.
5. **Agenda › Novo agendamento** — escolha o cliente, *Sessão de simulador*, o pacote (a venda é vinculada
   automaticamente), instrutor, *Sala de Simuladores* e um simulador.
6. Mostre o painel **Disponibilidade**: tente o mesmo simulador/instrutor em horário ocupado para ver o conflito.
7. Confirme o agendamento.
8. Abra a venda e **Registrar pagamento** via Pix (parcial) → recebido e saldo pendente se atualizam.
   Registre o restante no cartão em 2x para mostrar *recebido × programado*.
9. Saia e entre como **Instrutor** (Thiago) → o treinamento aparece no portal → **Iniciar** e **Concluir**.
10. Entre como **Administrador** → **Dashboard** atualizado → **Relatórios › Vendas por período** → exporte PDF.
11. Bônus: **Clientes › Confidenciais › Revelar dados** e depois **Auditoria** mostrando o registro do acesso.

Depois da apresentação (ou antes de um novo ensaio): `npm run seed` restaura tudo.

---

## Scripts disponíveis

Execute na **raiz** do projeto:

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências do backend e do frontend |
| `npm run setup` | Cria `server/.env` (com segredo JWT aleatório) e `client/.env` se não existirem |
| `npm run doctor` | Diagnóstico do ambiente (Node, .env, dependências, MongoDB, dados) |
| `npm run seed` | **Apaga** e recria os dados de demonstração (alias: `npm run seed:reset`) |
| `npm run dev` | API (http://localhost:4000) + interface (http://localhost:5173) com recarga automática |
| `npm run dev:server` / `npm run dev:client` | Apenas um dos serviços |
| `npm run demo` | Compila a interface e serve tudo em http://localhost:4000 (modo apresentação) |
| `npm run build` | Apenas compila a interface (`client/dist`) |
| `npm start` | Inicia somente a API (serve `client/dist` se existir) |
| `npm test` | Testes automatizados do backend (usa o banco `pilotagem_test`) |
| `npm run lint` | ESLint no backend e no frontend |

---

## Stack e arquitetura

- **Frontend:** React 19, Vite 7, JavaScript, Tailwind CSS 4, React Router 7, Axios, Recharts, Lucide,
  React Hook Form + Zod. Fontes (Inter, Saira) empacotadas localmente — **funciona sem internet**.
- **Backend:** Node.js, Express 5, MongoDB + Mongoose, JWT, bcrypt (bcryptjs), Zod, multer, pdfkit.
- **Banco:** MongoDB Community Server local (`MONGODB_URI` configurável; Atlas não é necessário).
- API REST em `/api`, camadas `routes → controllers → services → models`, tratamento centralizado de erros,
  permissões verificadas no servidor.
- Concorrência em reservas sem depender de replica set: *locks* no próprio MongoDB (índice único + TTL).

Detalhes, diagrama de entidades, regras financeiras e de disponibilidade: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

---

## Estrutura de pastas

```
pilotagem/
├── client/                 Interface React (Vite)
│   └── src/
│       ├── assets/brand/   Logos Pilotech
│       ├── components/     UI reutilizável (ui/), gráficos, formulários compartilhados
│       ├── contexts/       Autenticação e notificações
│       ├── hooks/          useApi, useCatalog
│       ├── layouts/        Sidebar, header, navegação por permissão
│       ├── pages/          Um diretório por módulo
│       ├── services/       Cliente HTTP
│       └── utils/          Formatação pt-BR, datas em America/Sao_Paulo, rótulos
├── server/                 API Express
│   ├── uploads/            Comprovantes (privado, fora do Git)
│   └── src/
│       ├── config/         Ambiente, banco, constantes, permissões (RBAC)
│       ├── controllers/    Camada HTTP
│       ├── middlewares/    Autenticação, validação, sanitização, upload, erros
│       ├── models/         Schemas Mongoose
│       ├── routes/         Rotas por domínio
│       ├── services/       Regras de negócio (financeiro, disponibilidade, privacidade, relatórios…)
│       ├── seed/           Dados de demonstração
│       ├── tests/          Testes automatizados (node:test + supertest)
│       ├── utils/          Datas, dinheiro, texto
│       └── validators/     Schemas Zod
├── scripts/                setup.js e doctor.js (multiplataforma)
├── docs/                   ARQUITETURA.md e arquivos originais da marca
├── README.md
└── LOCAL_SETUP.md
```

---

## Testes automatizados

```bash
npm test
```

59 testes (`node:test` + supertest) usando um banco separado (`pilotagem_test`, apagado ao final):

| Arquivo | Cobre |
|---|---|
| `finance.calc.test.js` | Parcelamento em centavos, totais, desconto, exemplo R$ 2.000 (Pix + crédito 2x), preço por quantidade, pacotes, fuso horário |
| `finance.test.js` | Vendas, pagamentos parciais e parcelados, confirmação de recebimento, estorno sem apagar, cancelamento, indicadores, preço histórico |
| `availability.test.js` | Conflitos de sala, equipamento e instrutor; horários adjacentes; manutenção; reservas canceladas; várias salas/equipamentos; sala compartilhada; **requisições simultâneas** |
| `permissions.test.js` | RBAC por perfil e rota, autorizações configuráveis, instrutor restrito às próprias sessões |
| `privacy.test.js` | Mascaramento de confidenciais em listas, busca, dashboards, agenda, relatórios e CSV; revelação auditada |
| `demo-flow.test.js` | Fluxo completo da apresentação, ponta a ponta |

---

## Segurança, privacidade e LGPD

- Senhas com bcrypt; JWT com expiração; sessão invalidada ao trocar senha, perfil ou desativar usuário.
- Permissões **no backend** em todas as rotas (o frontend só esconde o que o usuário não pode usar).
- Validação de entrada com Zod, sanitização contra injeção de operadores do MongoDB, limite de tentativas de login,
  cabeçalhos de segurança (helmet) e CORS restrito.
- **Minimização de dados:** apenas nome, sobrenome e telefone do cliente.
- **Clientes confidenciais:** nome de exibição em toda a interface; dashboards e relatórios nunca mostram dados
  identificáveis; dados reais só por ação explícita, com permissão e **registro na auditoria**.
- Comprovantes armazenados localmente com nome aleatório e download apenas autenticado.
- Registros financeiros nunca são apagados: cancelamentos e estornos exigem motivo e ficam no histórico.

---

## Premissas adotadas

Informações não confirmadas pela empresa foram resolvidas de forma simples e documentada
(lista completa em [docs/ARQUITETURA.md § 10](docs/ARQUITETURA.md#10-premissas-de-negócio-adotadas)):

- Preços do catálogo são referências públicas, editáveis pelo administrador.
- A tabela de simuladores é o **preço total da opção** (não por hora nem por unidade).
- Pagamentos no cartão de crédito ficam como **programados** até a confirmação do recebimento.
- O resultado operacional usa regime de caixa (recebido − despesas pagas).
- Recepção registra vendas e instrutores atualizam o status das sessões por padrão — ambos revogáveis em Configurações.

---

## Fora do escopo / evolução futura

Integrações com Google Calendar, Granatum, WhatsApp, Wix e sites da empresa; gateway de pagamento,
boletos reais e processamento de cartões; hospedagem em nuvem; aplicativo mobile nativo; agendamento
público para clientes. A arquitetura em API REST permite adicioná-los sem reescrever o núcleo.
