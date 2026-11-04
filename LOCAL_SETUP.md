# PILOTAGEM — Tutorial de execução local

Este guia leva você do zero até o sistema rodando, em **Windows** ou **macOS**, mesmo que nunca tenha
participado do desenvolvimento. Não é necessário nenhum serviço pago, conta em nuvem ou cartão de crédito.

Depois de instalado, o PILOTAGEM **funciona sem internet** (fontes, ícones e imagens estão no próprio projeto).

**Tempo estimado:** 20–30 minutos na primeira vez (a maior parte é download dos instaladores).

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
   - [Windows](#21-windows)
   - [macOS](#22-macos)
   - [Verificando as instalações](#23-verificando-as-instalações)
3. [Obtendo o projeto](#3-obtendo-o-projeto)
4. [Instalação](#4-instalação)
5. [Executando](#5-executando)
6. [Usando na demonstração](#6-usando-na-demonstração)
7. [Encerrando](#7-encerrando)
8. [Solução de problemas](#8-solução-de-problemas)
9. [Checklist do dia da apresentação](#9-checklist-do-dia-da-apresentação)
10. [Referência dos arquivos .env](#10-referência-dos-arquivos-env)

---

## 1. Visão geral

O PILOTAGEM tem três partes, todas rodando no seu computador:

| Parte | O que é | Endereço |
|---|---|---|
| **MongoDB** | Banco de dados (instalado como serviço do sistema) | `127.0.0.1:27017` |
| **API** (`server/`) | Node.js + Express — regras de negócio | http://localhost:4000/api |
| **Interface** (`client/`) | React — o que você vê no navegador | http://localhost:5173 (desenvolvimento) |

No **modo apresentação** (`npm run demo`) a API também entrega a interface: tudo fica em
**http://localhost:4000**, com um único processo.

---

## 2. Pré-requisitos

| Ferramenta | Versão recomendada | Obrigatória? |
|---|---|---|
| Node.js | **22 LTS** (mínimo 20.19) | Sim |
| MongoDB Community Server | 7.0 ou superior (testado com 9.0) | Sim |
| Git | Qualquer versão recente | Só para clonar o repositório |
| VS Code | Qualquer versão recente | Recomendado |
| MongoDB Compass | Qualquer versão recente | Opcional (visualizar o banco) |

> O npm vem junto com o Node.js — não é preciso instalá-lo separadamente.

### 2.1 Windows

**Node.js**

1. Acesse https://nodejs.org e baixe a versão **LTS** (instalador `.msi`).
2. Execute o instalador e aceite as opções padrão (mantenha marcada a opção *Add to PATH*).
3. Feche e reabra o terminal depois de instalar.

**MongoDB Community Server**

1. Acesse https://www.mongodb.com/try/download/community
2. Escolha *Platform: Windows*, *Package: msi* e baixe.
3. No instalador, escolha **Complete**.
4. Na tela *Service Configuration*, deixe marcado **Install MongoD as a Service** (com *Run service as Network
   Service user*). Assim o banco inicia sozinho junto com o Windows.
5. A opção *Install MongoDB Compass* pode ficar marcada (é a interface gráfica opcional).

**Git** (opcional): https://git-scm.com/download/win — aceite as opções padrão.

**VS Code** (recomendado): https://code.visualstudio.com

### 2.2 macOS

A forma mais simples é pelo **Homebrew**. Se ainda não tiver, instale-o colando no Terminal o comando
exibido em https://brew.sh e siga as instruções finais que ele mostrar.

```bash
# Node.js LTS
brew install node@22
brew link --overwrite node@22

# MongoDB Community Server (repositório oficial da MongoDB)
brew tap mongodb/brew
brew install mongodb-community

# Iniciar o MongoDB agora e sempre que o Mac ligar
brew services start mongodb-community

# Opcionais
brew install git
brew install --cask visual-studio-code
brew install --cask mongodb-compass
```

> Prefere instaladores gráficos? Node.js: https://nodejs.org (arquivo `.pkg`).
> MongoDB: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/

### 2.3 Verificando as instalações

Abra um terminal — **PowerShell** no Windows (menu Iniciar › "PowerShell") ou **Terminal** no macOS — e rode:

```bash
node -v     # deve mostrar v20.19 ou superior (ex.: v22.x.x)
npm -v      # deve mostrar 10 ou superior
git --version
```

Verificando se o MongoDB está rodando:

**Windows (PowerShell):**

```powershell
Get-Service MongoDB
```

O resultado deve mostrar `Status: Running`.

**macOS:**

```bash
brew services list | grep mongodb
```

O resultado deve mostrar `started`.

> Também é possível conferir abrindo o **MongoDB Compass** e conectando em `mongodb://127.0.0.1:27017`.

---

## 3. Obtendo o projeto

**Opção A — clonar com Git:**

```bash
git clone <URL-DO-REPOSITÓRIO> pilotagem
cd pilotagem
```

**Opção B — copiar a pasta** (pen drive, ZIP, Google Drive…):

1. Copie a pasta `pilotagem` inteira para o computador (ex.: Área de Trabalho).
   - Se vier um `.zip`, extraia antes de usar.
   - **Não é necessário** copiar as pastas `node_modules` — elas são recriadas na instalação e deixam a cópia muito
     mais lenta. Se copiar, tudo bem também.
2. Abra o terminal **dentro da pasta** do projeto:
   - **Windows:** abra a pasta no Explorador, clique na barra de endereço, digite `powershell` e Enter.
   - **macOS:** no Terminal digite `cd ` (com espaço), arraste a pasta para a janela e pressione Enter.

**Abrindo no VS Code:** *File › Open Folder…* e selecione a pasta `pilotagem`. O terminal integrado
(*Terminal › New Terminal*) já abre na pasta certa. O VS Code sugerirá extensões úteis (ESLint, Tailwind, MongoDB).

Para conferir que está na pasta certa, rode `ls` (ou `dir`) — você deve ver `client`, `server`, `package.json`,
`README.md` e `LOCAL_SETUP.md`.

---

## 4. Instalação

Todos os comandos abaixo são executados **na raiz do projeto** (a pasta `pilotagem`), iguais no Windows e no macOS.

### 4.1 Instalar as dependências

```bash
npm install
```

Instala o backend e o frontend de uma vez (o projeto usa *npm workspaces*). Leva de 1 a 3 minutos e
**precisa de internet** — é o único passo que precisa. Avisos (`npm warn`) são normais; apenas linhas com
`npm error` indicam problema.

### 4.2 Criar os arquivos de configuração (.env)

```bash
npm run setup
```

Cria `server/.env` e `client/.env` a partir dos modelos `.env.example` e gera um segredo aleatório para os tokens
de login. Se os arquivos já existirem, eles são mantidos. Os valores padrão funcionam sem nenhuma alteração —
veja a [referência](#10-referência-dos-arquivos-env) caso precise mudar portas ou o endereço do banco.

### 4.3 Conferir o MongoDB

O banco precisa estar rodando (seção [2.3](#23-verificando-as-instalações)). Se não estiver:

- **Windows:** `Start-Service MongoDB` (PowerShell **como administrador**) ou abra *Serviços* (`services.msc`),
  procure **MongoDB Server** e clique em *Iniciar*.
- **macOS:** `brew services start mongodb-community`

O banco `pilotagem` é criado automaticamente no passo seguinte — não é preciso criar nada no Compass.

### 4.4 Popular o banco com os dados de demonstração

```bash
npm run seed
```

Saída esperada (os números variam conforme a data):

```
PILOTAGEM — restaurando dados de demonstração
  • Banco limpo
  • 7 usuários e 3 instrutores
  • 5 salas, 12 equipamentos, 5 serviços, 3 pacotes
  • 35 clientes (3 confidenciais)
  • 6xx agendamentos, 6xx reservas, 5xx vendas, ...
✔ Concluído em 1.3 s
```

> ⚠️ O seed **apaga todos os dados** do banco e recria os de demonstração. Ele **nunca** roda sozinho ao iniciar o
> sistema — só quando você executa este comando (ou usa o botão em *Configurações*).
>
> As datas são **relativas ao dia em que o seed é executado**: cerca de 5 meses de histórico e 3 semanas de agenda
> futura. Por isso, rode o seed **no dia da apresentação** para que haja "agendamentos de hoje".

### 4.5 Diagnóstico (opcional, mas recomendado)

```bash
npm run doctor
```

Mostra ✔ ou ✖ para Node, arquivos `.env`, dependências, conexão com o MongoDB e presença dos dados, com a
solução sugerida para cada problema.

---

## 5. Executando

### 5.1 Modo desenvolvimento (API + interface juntos)

```bash
npm run dev
```

Aguarde as mensagens:

```
[API]  ▌PILOTAGEM — API em execução
[API]  ▌API:        http://localhost:4000/api
[WEB]  ➜  Local:   http://localhost:5173/
```

Abra **http://localhost:5173** no navegador. Alterações no código recarregam automaticamente.

### 5.2 Modo apresentação (recomendado para o dia)

```bash
npm run demo
```

Compila a interface (≈10 s) e inicia um único processo. Abra **http://localhost:4000**.
É mais rápido, mais estável e não depende do servidor de desenvolvimento.

### 5.3 Executando cada serviço separadamente

Útil para depuração — use dois terminais:

```bash
# Terminal 1 — API
npm run dev:server        # ou: cd server && npm run dev

# Terminal 2 — interface
npm run dev:client        # ou: cd client && npm run dev
```

### 5.4 Testes automatizados (opcional)

```bash
npm test
```

Usa um banco separado (`pilotagem_test`), que é apagado ao final — **não afeta** os dados da demonstração.
Resultado esperado: `ℹ tests 59 · ℹ pass 59 · ℹ fail 0`.

---

## 6. Usando na demonstração

**Endereço:** http://localhost:5173 (`npm run dev`) ou http://localhost:4000 (`npm run demo`).

**Contas** (também disponíveis como botões de acesso rápido na tela de login):

| Perfil | E-mail | Senha | O que mostrar |
|---|---|---|---|
| Administrador | `admin@pilotagem.local` | `Admin@123` | Dashboard completo, relatórios, auditoria, configurações |
| Recepção | `recepcao1@pilotagem.local` | `Recepcao@123` | Clientes, agenda, reservas, vendas e pagamentos |
| Recepção | `recepcao2@pilotagem.local` | `Recepcao@123` | (segunda recepcionista) |
| Financeiro | `financeiro@pilotagem.local` | `Financeiro@123` | Vendas, contas a receber, despesas, relatórios financeiros |
| Instrutor | `instrutor1@pilotagem.local` | `Instrutor@123` | Portal: treinamentos do dia, iniciar/concluir, observações |
| Instrutor | `instrutor2@pilotagem.local` | `Instrutor@123` | Portal da instrutora de preparação psicofísica |
| Instrutor | `instrutor3@pilotagem.local` | `Instrutor@123` | Portal do instrutor de telemetria |

**Onde fica cada módulo** (menu lateral; cada perfil vê apenas o que pode acessar):

- **Dashboard** — indicadores e gráficos; altere o período no canto superior direito.
- **Operação › Agenda** — dia/semana/mês/lista; clique em um horário vazio para agendar; clique em um evento para detalhes.
- **Operação › Reservas e salas** — quadro do dia com salas, simuladores e instrutores; locações e eventos.
- **Operação › Clientes** — cadastro, filtro de confidenciais, ficha com histórico.
- **Financeiro › Vendas / Contas a receber / Despesas / Relatórios**.
- **Cadastros › Serviços e pacotes / Salas e equipamentos / Instrutores**.
- **Administração › Auditoria / Configurações**.
- Botão amarelo **Novo** (topo): atalhos para novo agendamento, venda ou cliente.

Um roteiro passo a passo para a apresentação está no [README](README.md#roteiro-sugerido-para-a-apresentação).

### Restaurar os dados de demonstração

Depois de ensaios, volte ao estado inicial de duas formas:

- Terminal: `npm run seed` (pode ser feito com o sistema rodando; depois, faça login novamente).
- Interface: entre como **Administrador › Configurações › Restaurar dados de demonstração** e digite `RESTAURAR`.

---

## 7. Encerrando

- No terminal onde o sistema está rodando, pressione **Ctrl + C** (no macOS também é Ctrl, não Cmd).
  Se perguntar *"Deseja finalizar o arquivo em lotes (S/N)?"* (Windows), responda **S**.
- O MongoDB continua rodando como serviço — isso é normal e não atrapalha. Para pará-lo (opcional):
  - Windows: `Stop-Service MongoDB` (PowerShell como administrador)
  - macOS: `brew services stop mongodb-community`

Os dados ficam salvos no MongoDB e reaparecem na próxima execução.

---

## 8. Solução de problemas

Comece sempre por `npm run doctor` — ele aponta a maioria dos problemas abaixo.

### MongoDB não conecta

Mensagem: `✖ Não foi possível conectar ao MongoDB em mongodb://127.0.0.1:27017/pilotagem`

1. Verifique se o serviço está rodando (seção [2.3](#23-verificando-as-instalações)) e inicie-o se necessário (seção [4.3](#43-conferir-o-mongodb)).
2. **Windows — serviço não existe:** o MongoDB foi instalado sem a opção *Install as a Service*. Reinstale marcando
   a opção ou, como alternativa temporária, rode em outro terminal:
   ```powershell
   mkdir C:\data\db -Force
   & "C:\Program Files\MongoDB\Server\<versão>\bin\mongod.exe" --dbpath C:\data\db
   ```
   (substitua `<versão>` pela pasta existente, ex.: `8.0`) e deixe esse terminal aberto.
3. **macOS — serviço com erro (`error` em `brew services list`):** rode
   `brew services restart mongodb-community`. Se persistir, veja o log em
   `$(brew --prefix)/var/log/mongodb/mongo.log`.
4. Use `127.0.0.1`, não `localhost`, em `MONGODB_URI` (evita problemas de IPv6).
5. Usa outra porta ou um MongoDB remoto? Ajuste `MONGODB_URI` em `server/.env`.

### Porta já em uso

Mensagem: `✖ A porta 4000 já está em uso` ou `Port 5173 is already in use`

Provavelmente o sistema já está aberto em outro terminal. Feche-o com Ctrl + C. Se não encontrar:

- **Windows (PowerShell):**
  ```powershell
  Get-NetTCPConnection -LocalPort 4000 | Select-Object OwningProcess
  Stop-Process -Id <número mostrado> -Force
  ```
- **macOS:**
  ```bash
  lsof -i :4000
  kill -9 <PID>
  ```

Também é possível trocar a porta da API em `server/.env` (`PORT=4001`) — nesse caso ajuste `VITE_PROXY_TARGET` em
`client/.env` para `http://localhost:4001`.

### Dependências não instaladas

Mensagens como `Cannot find module 'express'`, `vite: command not found` ou `'concurrently' não é reconhecido`:

```bash
npm install
```

Sempre na **raiz** do projeto. Se a pasta foi copiada de outro sistema operacional e houver erros estranhos,
apague as pastas `node_modules` (da raiz, de `server` e de `client`, se existirem) e rode `npm install` novamente.
Mantenha o arquivo `package-lock.json` — ele garante as mesmas versões testadas.

Se o Vite reclamar do **esbuild** ("The package esbuild could not be found" / "esbuild for another platform"),
a pasta veio de outro sistema operacional: rode `npm rebuild esbuild` ou reinstale como descrito acima.

### Arquivo .env ausente

Mensagem: `JWT_SECRET não definido` ou o `npm run doctor` aponta `.env ausente`:

```bash
npm run setup
```

### Problemas de autenticação

- **"E-mail ou senha incorretos"** com as contas de demonstração: o banco provavelmente não tem os dados — rode
  `npm run seed`. Confira se digitou `.local` no fim do e-mail (ou use os botões de acesso rápido).
- **"Sessão expirada"** logo após entrar: o seed foi executado de novo (os usuários foram recriados) ou o
  `JWT_SECRET` mudou. Basta fazer login novamente.
- **"Muitas tentativas de login"**: aguarde 1 minuto (proteção contra força bruta).

### Banco sem dados / telas vazias

- Rode `npm run seed`.
- O dashboard abre nos **últimos 30 dias**; se as telas parecem vazias, verifique o filtro de período.
- Se o seed foi executado há muitos dias, a agenda "de hoje" fica vazia — rode o seed novamente.

### Problemas específicos do Windows

- **"a execução de scripts foi desabilitada neste sistema"** ao rodar `npm` no PowerShell:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```
  Confirme com `S`. Alternativa: use o **Prompt de Comando** (`cmd`) ou o terminal do VS Code.
- **`node` não é reconhecido** depois de instalar: feche e reabra o terminal (ou o VS Code). Se persistir, reinicie o Windows.
- **Antivírus/firewall** perguntando sobre o Node.js: permita acesso em **redes privadas**.
- Evite pastas sincronizadas (OneDrive) durante a instalação — elas deixam o `npm install` muito lento.
  Prefira algo como `C:\Projetos\pilotagem`.

### Problemas específicos do macOS

- **`brew: command not found`** após instalar o Homebrew: execute os dois comandos `echo ... >> ~/.zprofile` e
  `eval ...` que o instalador mostrou no final (Macs com Apple Silicon) e reabra o Terminal.
- **`node -v` mostra versão antiga:** `brew link --overwrite node@22` e reabra o Terminal.
- **Aviso "Desenvolvedor não identificado"** ao abrir o MongoDB Compass: clique com o botão direito no aplicativo › *Abrir*.
- **`EACCES: permission denied`** no `npm install`: não use `sudo`; verifique se a pasta do projeto pertence ao seu
  usuário (`ls -l`) — copie-a para dentro da sua pasta pessoal se necessário.

### O navegador mostra uma página em branco

- No modo `npm run dev`, use a porta **5173**; no modo `npm run demo`, a porta **4000**.
- Pressione **Ctrl + Shift + R** (Windows) ou **Cmd + Shift + R** (macOS) para recarregar sem cache.
- Navegadores suportados: Chrome, Edge, Firefox e Safari em versões atuais.

---

## 9. Checklist do dia da apresentação

Faça com antecedência (idealmente 30 minutos antes), no notebook que será usado:

- [ ] **1. Node.js** — `node -v` mostra v20.19 ou superior.
- [ ] **2. MongoDB** — serviço em execução (`Get-Service MongoDB` / `brew services list`).
- [ ] **3. Dependências** — `npm install` executado sem `npm error` (requer internet; faça antes de chegar ao local).
- [ ] **4. Variáveis de ambiente** — `npm run setup` (cria `server/.env` e `client/.env`).
- [ ] **5. Banco populado** — `npm run seed` **no próprio dia** (para haver agendamentos "de hoje").
- [ ] **6. Diagnóstico** — `npm run doctor` sem nenhum ✖.
- [ ] **7. Iniciar** — `npm run demo` e abrir http://localhost:4000.
- [ ] **8. Login** — entrar com cada perfil (botões de acesso rápido): Administrador, Recepção, Financeiro, Instrutor.
- [ ] **9. Fluxos principais** — criar cliente, vender pacote, agendar com instrutor/sala/simulador, registrar Pix,
      concluir sessão no portal do instrutor, conferir dashboard, exportar PDF de relatório.
- [ ] **10. Dados carregados** — dashboard com gráficos preenchidos e agenda da semana com treinamentos.
- [ ] **11. Sem internet** — desligue o Wi-Fi e recarregue a página: tudo deve continuar funcionando.
- [ ] **12. Restaurar** — depois do ensaio, `npm run seed` para voltar ao estado inicial.

**Dicas para a apresentação**

- Deixe o terminal com `npm run demo` minimizado (não feche).
- Zoom do navegador em 90% ajuda em telas pequenas (Ctrl/Cmd + −).
- Se algo travar: Ctrl + C no terminal, `npm run demo` de novo, recarregue a página.

---

## 10. Referência dos arquivos .env

### `server/.env`

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `4000` | Porta da API (e da aplicação no modo `demo`) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/pilotagem` | Conexão com o MongoDB |
| `MONGODB_URI_TEST` | `mongodb://127.0.0.1:27017/pilotagem_test` | Banco dos testes (apagado a cada execução) |
| `JWT_SECRET` | gerado pelo `npm run setup` | Segredo de assinatura dos tokens de login |
| `JWT_EXPIRES_IN` | `8h` | Duração da sessão |
| `CLIENT_URL` | `http://localhost:5173` | Origem permitida (CORS) em desenvolvimento |
| `ALLOW_DEMO_RESET` | `true` | Habilita o botão "Restaurar dados de demonstração" |
| `APP_TIMEZONE` | `America/Sao_Paulo` | Fuso horário do negócio |

### `client/.env`

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_API_URL` | `/api` | Endereço da API vista pelo navegador |
| `VITE_PROXY_TARGET` | `http://localhost:4000` | Para onde o Vite redireciona `/api` em desenvolvimento |
| `VITE_SHOW_DEMO_LOGINS` | `true` | Mostra os botões de acesso rápido no login |

> Alterações em `client/.env` exigem reiniciar o `npm run dev` (ou refazer o `npm run demo`).
