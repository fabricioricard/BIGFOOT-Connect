# 🔗 BIGFOOT Connect

**BIGFOOT Connect** é a aplicação de carteira, mineração e comunicação da rede **BIGchain** — uma blockchain com consenso próprio baseado em **Proof of Relay (PoR)**. Com ela, você executa um nó completo, gerencia sua carteira BIG, participa da mineração por retransmissão (relay) e interage com a comunidade por meio de um chat descentralizado, tudo em uma interface moderna construída com **Electron**.

---

## ✨ Funcionalidades principais

- **Carteira BIG integrada**  
  Criação automática de carteira, consulta de saldo, envio e recebimento de tokens BIG, histórico de transações real‑time.

- **Node BIGchain embutido**  
  Inicie e controle um nó completo diretamente da interface, com estatísticas de peers, blocos, saldo e mineração.

- **Proof of Relay (PoR)**  
  Mineração inovadora baseada em retransmissão de dados — seu nó ajuda a rede e é recompensado com BIG. Indicadores de créditos, score, bônus e emissão diária.

- **Chat em tempo real (Firebase)**  
  Converse com outros usuários conectados à rede, com mensagens assinadas, exibição de avatar e histórico sincronizado.

- **Gráfico de ganhos**  
  Visualize o histórico de BIG pontos acumulados ao longo do tempo, com dados persistidos em Firestore e API dedicada.

- **Multi‑idioma**  
  Interface disponível em **Português (Brasil)** e **Inglês**, com troca instantânea.

- **Tema escuro / claro**  
  Alternância suave entre modos, com variáveis CSS customizadas e persistência local.

- **Atualização automática**  
  O aplicativo baixa e instala novas versões automaticamente (electron-updater).

- **Segurança reforçada**  
  Chave privada nunca exposta ao renderer; confirmação nativa do sistema operacional para exportação; validação de links externos e CSP ativa.

---

## 🧱 Arquitetura

| Componente       | Tecnologia                           |
| ---------------- | ------------------------------------ |
| Interface        | Electron (renderer), HTML/CSS/JS     |
| IPC / Bridge     | Electron preload (`contextBridge`)   |
| Backend local    | Node.js (processo principal)         |
| Blockchain       | Go (`bigchain.exe`)                  |
| P2P              | Go (via integração IPC)              |
| Autenticação     | Firebase Auth                        |
| Chat / Histórico | Firebase Firestore                   |
| API de sincronia | Node.js (axios + API externa)        |
| Atualização      | electron-updater (GitHub Releases)   |

---

## 🔧 Requisitos

- **Windows** 10/11 (64‑bit)
- **Node.js** ≥ 18
- **Go** (compilador incluso em `bigchain.exe`)
- **Firebase** (credenciais configuradas em `.env`)

---

🧪 Desenvolvimento
Os arquivos da interface estão em renderer/. O processo principal está nos arquivos raiz (main.js, preload.js).
O executável da blockchain (bigchain.exe) deve ser colocado em assets/BIGchain/.

🔐 Segurança
Context isolation ativo em todas as janelas (nodeIntegration: false).

CSP definido no HTML principal, restringindo scripts e estilos.

Exportação de chave privada somente após confirmação via diálogo nativo (não burlável via script).

Validação de URLs externas – apenas domínios aprovados.

IPC restrito – canais listados no preload e validação dupla de parâmetros.

Firebase config vindo do processo principal, nunca hardcoded no renderer.

Limpeza de storage no logout, preservando apenas tema/idioma.

📦 Tecnologias utilizadas
Electron

Chart.js (gráfico de ganhos)

Firebase Auth / Firestore

axios

electron-updater

dotenv

Go (blockchain nativa)

📜 Licença
Proprietária. Consulte o arquivo LICENSE para mais informações.

👥 Contribuidores
Desenvolvido por Fabrício Ricard.
Agradecimentos especiais à comunidade BIGFOOT Connect pelo suporte e feedback contínuos.

© 2025 BIGFOOT Connect. Todos os direitos reservados.