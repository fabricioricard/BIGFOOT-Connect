# 🔗 BIGFOOT Connect

> Uma carteira, mineração e comunicação descentralizada para a rede **BIGchain** — blockchain com consenso inovador baseado em **Proof of Relay (PoR)**

[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red)](./LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)](https://www.microsoft.com/windows)
[![Node.js: 18+](https://img.shields.io/badge/node.js-18+-green)](https://nodejs.org)
![Built with Electron](https://img.shields.io/badge/built%20with-Electron-blue)

## 📋 Índice

- [Sobre](#sobre)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Requisitos](#requisitos)
- [Desenvolvimento](#desenvolvimento)
- [Segurança](#segurança)
- [Tecnologias](#tecnologias)
- [Licença](#licença)
- [Contribuições](#contribuições)

---

## Sobre

**BIGFOOT Connect** é a aplicação desktop da rede **BIGchain**, um blockchain com consenso próprio baseado em **Proof of Relay (PoR)**.

Com ela, você:

- ✅ Executa um nó completo da rede BIGchain
- ✅ Gerencia uma carteira BIG integrada
- ✅ Participa da mineração por retransmissão de dados (relay)
- ✅ Comunica com a comunidade via chat descentralizado
- ✅ Acompanha ganhos em tempo real

Tudo numa interface moderna construída com **Electron**.

---

## ✨ Funcionalidades

### 💰 Carteira BIG Integrada

- Criação automática de carteira na primeira execução
- Consulta de saldo e histórico de transações em tempo real
- Envio e recebimento de tokens BIG
- Validação segura com chave privada protegida
- Sincronização com Firestore

### 🖥️ Node BIGchain Embutido

- Inicie e controle um nó completo diretamente da interface
- Estatísticas em tempo real: peers, blocos minerados, saldo
- Monitor de atividade da rede
- Integração nativa com a blockchain (binário em Go)

### ⛏️ Proof of Relay (PoR)

Mineração inovadora baseada em retransmissão de dados:

- Seu nó ajuda a rede ao retransmitir dados
- Recompensado automaticamente em BIG
- Dashboard com indicadores de:
  - Créditos acumulados
  - Score de mineração
  - Bônus de contribuição
  - Emissão diária

### 💬 Chat em Tempo Real

- Comunicação descentralizada via Firebase
- Mensagens assinadas criptograficamente
- Avatares e perfis de utilizadores
- Histórico sincronizado entre sessões
- Moderation básica integrada

### 📊 Gráfico de Ganhos

- Histórico visual de BIG Points acumulados
- Dados persistidos em Firestore
- Filtros por período (7 dias, 30 dias, tudo)
- Exportação de dados (CSV)

### 🌍 Multi-Idioma

Disponível em:
- 🇵🇹 Português (Brasil)
- 🇬🇧 Inglês

Troca instantânea, sem reinicialização necessária.

### 🎨 Temas

- Modo **Escuro** (padrão)
- Modo **Claro**
- Alternância suave com variáveis CSS customizadas
- Preferência persistida localmente

### 🔄 Atualização Automática

- Detecção automática de novas versões
- Download em background
- Instalação e reinicialização silenciosa
- Rollback automático em caso de falha

---

## 🧱 Arquitetura

```
┌─────────────────────────────────────────────────┐
│           BIGFOOT Connect (Electron)            │
├─────────────────────────────────────────────────┤
│  Renderer Process (Interface)                   │
│  ├─ HTML/CSS/JS                                │
│  ├─ Chat                                       │
│  ├─ Carteira                                   │
│  ├─ Gráficos                                   │
│  └─ Configurações                              │
├─────────────────────────────────────────────────┤
│  IPC Bridge (preload.js)                       │
│  └─ Comunicação segura renderer ↔ main         │
├─────────────────────────────────────────────────┤
│  Main Process (Node.js)                        │
│  ├─ Gerenciamento de janelas                   │
│  ├─ IPC handlers                               │
│  ├─ API externa (axios)                        │
│  └─ Electron-updater                           │
├─────────────────────────────────────────────────┤
│  Blockchain (bigchain.exe - Go)                │
│  ├─ Nó completo BIGchain                       │
│  ├─ Proof of Relay                             │
│  └─ P2P network                                │
├─────────────────────────────────────────────────┤
│  Serviços Externos                             │
│  ├─ Firebase Auth (autenticação)               │
│  ├─ Firebase Firestore (dados)                 │
│  ├─ BIGFOOT Connect API (sincronização)        │
│  └─ GitHub Releases (atualizações)             │
└─────────────────────────────────────────────────┘
```

### Stack Técnico

| Camada | Tecnologia |
|--------|-----------|
| **Interface** | Electron (Chromium) + HTML/CSS/JS |
| **IPC/Segurança** | `contextBridge` (preload.js) |
| **Backend Local** | Node.js (main process) |
| **Blockchain** | Go (`bigchain.exe`) |
| **P2P** | Go (integração IPC) |
| **Autenticação** | Firebase Authentication |
| **Base de Dados** | Firebase Firestore |
| **API** | Node.js + axios |
| **Atualizações** | electron-updater (GitHub Releases) |
| **Gráficos** | Chart.js |

---

## 🚀 Instalação

### Para Utilizadores

1. Descarregue a versão mais recente em [Releases](https://github.com/bigfoot-connect/bigfoot-connect/releases)
2. Execute o instalador `BIGFOOT-Connect-Setup-x.x.x.exe`
3. A aplicação inicializará automaticamente após a instalação
4. Crie sua conta ou faça login com suas credenciais

A aplicação verificará atualizações automaticamente ao iniciar.

### Para Desenvolvedores

#### 1. Clone o repositório

```bash
git clone https://github.com/bigfoot-connect/bigfoot-connect.git
cd bigfoot-connect
```

#### 2. Instale as dependências

```bash
npm install
```

#### 3. Configure variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Firebase
VITE_FIREBASE_API_KEY=sua-chave-api
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
VITE_FIREBASE_APP_ID=seu-app-id

# API externa
VITE_API_URL=https://api.bigfootconnect.tech
VITE_API_VERSION=v1

# Blockchain
BIGCHAIN_PATH=./assets/BIGchain/bigchain.exe
BIGCHAIN_PORT=3000

# Segurança
NODE_ENV=development
```

#### 4. Execute em desenvolvimento

```bash
npm run dev
```

Abre a aplicação com DevTools habilitadas.

#### 5. Build para produção

```bash
npm run build
```

Gera executáveis em `dist/`:
- `BIGFOOT-Connect-Setup-x.x.x.exe` (instalador)
- `BIGFOOT-Connect-x.x.x.exe` (portável)

---

## 📋 Requisitos

### Sistema

- **Windows** 10 ou 11 (64-bit)
- **2 GB RAM** mínimo (4 GB recomendado)
- **500 MB** espaço livre em disco
- **Conexão de internet** estável

### Desenvolvimento

| Requisito | Versão |
|-----------|--------|
| **Node.js** | ≥ 18 LTS |
| **npm** | ≥ 8 |
| **Go** | Incluso em `bigchain.exe` |
| **Windows Build Tools** | Opcional (para build nativo) |

### Instalação de Dependências (Windows)

```bash
# Node.js (via winget ou direct download)
winget install OpenJS.NodeJS

# Verificar instalação
node --version
npm --version
```

---

## 🔧 Desenvolvimento

### Estrutura de Pastas

```
bigfoot-connect/
├── src/
│   ├── main.js                 # Electron main process
│   ├── preload.js              # Context bridge & IPC
│   ├── renderer/               # Interface (HTML/CSS/JS)
│   │   ├── index.html
│   │   ├── styles/
│   │   ├── scripts/
│   │   └── components/
│   ├── utils/
│   │   ├── firebase.js         # Configuração Firebase
│   │   ├── blockchain.js       # Comunicação com Go
│   │   └── crypto.js           # Operações criptográficas
│   └── config/
│       ├── security.js         # Policies & CSP
│       └── constants.js
├── assets/
│   └── BIGchain/               # Binário bigchain.exe
├── dist/                       # Build output
├── .env                        # Variáveis de ambiente
├── package.json
├── electron-builder.yml        # Configuração do builder
└── README.md
```

### Fluxo de Desenvolvimento

1. **Interface (renderer/)** — Modifique HTML/CSS/JS em tempo real
2. **IPC handlers (main.js)** — Adicione novos canais conforme necessário
3. **Blockchain (Go)** — O binário é gerenciado externamente
4. **Testes** — Execute `npm run test`
5. **Build** — Execute `npm run build` para gerar instalador

### Scripts Úteis

```bash
# Desenvolvimento com hot-reload
npm run dev

# Build para produção
npm run build

# Build apenas da interface (Vite)
npm run build:vite

# Executar testes
npm run test

# Linter (ESLint)
npm run lint

# Publicar release no GitHub
npm run publish
```

---

## 🔐 Segurança

### Context Isolation

✅ **Ativo em todas as janelas**

```javascript
// main.js
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'preload.js')
}
```

### Content Security Policy (CSP)

✅ **Definido no HTML principal**

- Restrição de scripts inline
- Apenas scripts assinados ou de origens aprovadas
- Bloqueio de imports dinâmicos não validados

### Gestão de Chave Privada

✅ **Nunca exposta ao renderer**

- Armazenada criptografada no processo principal
- Exportação apenas após confirmação via diálogo nativo
- Validação dupla de parâmetros em todas as operações

### Validação de URLs

✅ **URLs externas validadas**

- Whitelist de domínios aprovados
- Abertura de links externos sempre em navegador padrão
- Bloqueio de `javascript:` URLs

### IPC Seguro

✅ **Canais listados e validados**

```javascript
// preload.js
contextBridge.exposeInMainWorld('api', {
  wallet: {
    getBalance: () => ipcRenderer.invoke('wallet:getBalance'),
    sendTransaction: (to, amount) => 
      ipcRenderer.invoke('wallet:send', { to, amount })
  }
  // ...
});
```

- Cada canal tem validação de entrada
- Respostas nunca incluem dados sensíveis em logs
- Rate limiting em operações críticas

### Limpeza de Sessão

✅ **Storage limpo no logout**

- Cache de sessão removido
- Tokens Firebase revogados
- Apenas tema/idioma persistidos
- IndexedDB limpo

### Dependências

✅ **Verificação de vulnerabilidades**

```bash
npm audit
npm audit fix
```

---

## 📦 Tecnologias

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| **Electron** | 24+ | Desktop framework |
| **Vite** | 4+ | Build tool (interface) |
| **Chart.js** | 3+ | Gráficos de ganhos |
| **Firebase SDK** | 9+ | Auth + Firestore |
| **axios** | 1+ | HTTP client |
| **electron-updater** | 5+ | Atualizações automáticas |
| **dotenv** | 16+ | Variáveis de ambiente |
| **Go** | 1.19+ | Blockchain (externo) |

---

## 📜 Licença

**BIGFOOT Connect** é distribuído sob uma **licença proprietária**.

Consulte o arquivo [LICENSE](./LICENSE) para mais informações.

### Resumo

- ❌ Distribuição não permitida
- ❌ Modificação sem autorização não permitida
- ❌ Uso comercial sem licença não permitido
- ✅ Uso pessoal permitido (conforme termos)

---

## 👥 Contribuições

### Reportar Bugs

Encontrou um problema? Abra uma [issue](https://github.com/bigfoot-connect/bigfoot-connect/issues) com:

- Descrição clara do problema
- Passos para reproduzir
- Versão da aplicação (Menu → Sobre)
- Sistema operacional e versão

### Sugestões de Melhorias

Tem uma ideia? [Abra uma discussão](https://github.com/bigfoot-connect/bigfoot-connect/discussions) ou uma issue com o label `enhancement`.

### Pull Requests

Contribuições são bem-vindas! Por favor:

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/amazing-feature`)
3. Commit suas mudanças (`git commit -m 'Add amazing feature'`)
4. Push para a branch (`git push origin feature/amazing-feature`)
5. Abra um Pull Request

---

## 🙏 Agradecimentos

- **Desenvolvido por:** Fabrício Ricard
- **Comunidade BIGFOOT Connect** — Suporte e feedback contínuos

---

<div align="center">

**© 2025 BIGFOOT Connect. Todos os direitos reservados.**

Feito com ❤️ para a comunidade blockchain

</div>