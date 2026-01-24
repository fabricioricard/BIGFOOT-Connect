import { initializeFirebase } from './auth.js';
import { t, currentLang } from './i18n.js';
import { getUserProfile, getUserProfileFromFirestore, getAvatarDisplay } from './profile.js';

let db = null;
let auth = null;
let unsubscribeChat = null;

// Inicializa o chat (Firestore)
export function initializeChat() {
    console.log('[CHAT] Inicializando módulo de chat...');
    
    const firebase = initializeFirebase();
    if (!firebase || !firebase.db || !firebase.auth) {
        console.error('[CHAT] Firebase não inicializado corretamente.');
        return;
    }
    
    db = firebase.db;
    auth = firebase.auth;
    
    renderChatUI();
    addChatStyles();
    setupChatListeners();
    
    // Aguarda autenticação antes de iniciar listener
    if (auth.currentUser) {
        console.log('[CHAT] Usuário já autenticado:', auth.currentUser.email);
        startMessageListener();
    }
    
    auth.onAuthStateChanged((user) => {
        if (user && !unsubscribeChat) {
            console.log('[CHAT] Usuário autenticado via listener:', user.email);
            startMessageListener();
        } else if (!user && unsubscribeChat) {
            console.log('[CHAT] Usuário deslogado, limpando listener');
            cleanupChat();
        }
    });
}

function renderChatUI() {
    const chatPage = document.getElementById('page-chat');
    if (!chatPage) {
        console.error('[CHAT] Elemento #page-chat não encontrado.');
        return;
    }

    chatPage.innerHTML = `
        <h1 class="page-title" data-i18n="chat">${t('chat')}</h1>
        <div class="card chat-container">
            <div class="chat-messages" id="chatMessages">
                <p class="system-message">
                    <span data-i18n="chatWelcome">${t('chatWelcome')}</span> 
                    <span data-i18n="chatDisclaimer">${t('chatDisclaimer')}</span>
                </p>
            </div>
            <div class="chat-input">
                <input 
                    type="text" 
                    id="chatInput" 
                    placeholder="${t('chatPlaceholder')}"
                    data-i18n-placeholder="chatPlaceholder"
                />
                <button id="chatSendBtn" class="primary-button" data-i18n="chatSend">
                    ${t('chatSend')}
                </button>
            </div>
        </div>
    `;
}

function setupChatListeners() {
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');

    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', sendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
}

// Função pública para atualizar idioma do chat
window.updateChatLanguage = function() {
    console.log('[CHAT] 🌐 Atualizando idioma...');
    
    // Atualiza placeholder do input
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.placeholder = t('chatPlaceholder');
    }
    
    // Re-renderiza o chat mantendo as mensagens
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const messages = chatMessages.querySelectorAll('.message-wrapper');
        const hasMessages = messages.length > 0;
        
        if (!hasMessages) {
            // Se não tem mensagens, apenas atualiza o texto de boas-vindas
            const systemMsg = chatMessages.querySelector('.system-message');
            if (systemMsg) {
                systemMsg.innerHTML = `
                    <span data-i18n="chatWelcome">${t('chatWelcome')}</span> 
                    <span data-i18n="chatDisclaimer">${t('chatDisclaimer')}</span>
                `;
            }
        }
    }
};

function addChatStyles() {
    if (document.getElementById('chat-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'chat-styles';
    style.textContent = `
        .chat-container {
            display: flex;
            flex-direction: column;
            height: 70vh;
            max-height: 800px;
        }
        .chat-messages {
            flex-grow: 1;
            overflow-y: auto;
            padding: 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .chat-input {
            display: flex;
            padding-top: 15px;
            gap: 10px;
        }
        .chat-input input {
            flex-grow: 1;
            margin: 0;
            padding: 12px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
        }
        .chat-input input:focus {
            outline: none;
            border-color: var(--primary-color);
        }
        .chat-input button {
            width: auto;
            padding: 12px 24px;
        }
        .system-message {
            color: #9ca3af;
            font-style: italic;
            text-align: center;
            font-size: 0.9em;
            padding: 8px;
        }
        .message-wrapper {
            display: flex;
            flex-direction: column;
            max-width: 75%;
            position: relative;
        }
        .message-wrapper.self {
            align-self: flex-end;
        }
        .message-wrapper.other {
            align-self: flex-start;
        }
        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
            font-size: 0.85em;
            opacity: 0.9;
        }
        .message-avatar {
            width: 32px;
            height: 32px;
            min-width: 32px;
            min-height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(0, 255, 135, 0.3);
        }
        .message-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .message-avatar svg {
            width: 100%;
            height: 100%;
            border-radius: 50%;
        }
        .message-nickname {
            font-weight: 600;
        }
        .message-bubble {
            padding: 10px 14px;
            border-radius: 15px;
            word-wrap: break-word;
            line-height: 1.4;
            position: relative;
        }
        .message-wrapper.self .message-bubble {
            background: linear-gradient(135deg, var(--primary-color), #8b5cf6);
            color: white;
            border-bottom-right-radius: 4px;
        }
        .message-wrapper.other .message-bubble {
            background: rgba(255, 255, 255, 0.08);
            color: white;
            border-bottom-left-radius: 4px;
        }
        .message-time {
            font-size: 0.7em;
            opacity: 0.6;
            margin-top: 4px;
            text-align: right;
        }
        .message-wrapper.other .message-time {
            text-align: left;
        }
        .message-delete-btn {
            position: absolute;
            top: -8px;
            right: -8px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.9);
            border: 2px solid rgba(255, 255, 255, 0.2);
            color: white;
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            transition: all 0.2s;
            z-index: 10;
        }
        .message-wrapper.self:hover .message-delete-btn {
            display: flex;
        }
        .message-delete-btn:hover {
            background: rgba(220, 38, 38, 1);
            transform: scale(1.1);
        }
    `;
    document.head.appendChild(style);
}

async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const messageText = chatInput.value.trim();

    if (messageText === '') return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error('[CHAT] Usuário não está logado.');
        showChatError(t('loginRequired'));
        return;
    }

    try {
        console.log('[CHAT] Enviando mensagem:', messageText);
        
        // Agora importa do profile.js
        let userProfile = await getUserProfileFromFirestore(currentUser);
        
        if (!userProfile) {
            userProfile = getUserProfile(currentUser);
        }
        
        console.log('[CHAT] Perfil do usuário:', userProfile);
        
        await db.collection('chat').add({
            text: messageText,
            uid: currentUser.uid,
            displayName: userProfile.nickname || currentUser.displayName || currentUser.email || 'Usuário',
            avatarData: userProfile.avatarData || null,
            avatar: userProfile.avatar || '👤',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: new Date()
        });
        
        console.log('[CHAT] Mensagem enviada com sucesso!');
        chatInput.value = '';
        
    } catch (error) {
        console.error('[CHAT] Erro ao enviar mensagem:', error);
        
        let errorMessage = t('chatError');
        
        if (error.code === 'permission-denied') {
            errorMessage = currentLang === 'pt' 
                ? 'Você não tem permissão para enviar mensagens. Configure as regras do Firestore.'
                : 'You do not have permission to send messages. Configure Firestore rules.';
        } else if (error.code === 'unavailable') {
            errorMessage = currentLang === 'pt'
                ? 'Servidor indisponível. Verifique sua conexão com a internet.'
                : 'Server unavailable. Check your internet connection.';
        }
        
        showChatError(errorMessage);
    }
}

async function deleteMessage(messageId, messageElement) {
    const confirmDelete = confirm(t('chatDeleteConfirm'));
    
    if (!confirmDelete) return;
    
    try {
        console.log('[CHAT] Deletando mensagem:', messageId);
        
        await db.collection('chat').doc(messageId).delete();
        
        // Remove do UI
        messageElement.remove();
        
        console.log('[CHAT] Mensagem deletada com sucesso!');
        
    } catch (error) {
        console.error('[CHAT] Erro ao deletar mensagem:', error);
        showChatError(t('chatDeleteError'));
    }
}

function showChatError(message) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const errorMsg = document.createElement('p');
    errorMsg.className = 'system-message';
    errorMsg.style.color = '#ef4444';
    errorMsg.textContent = message;
    chatMessages.appendChild(errorMsg);
    
    setTimeout(() => {
        errorMsg.remove();
    }, 5000);
}

async function addMessageToUI(message, isOwn) {
    const chatMessages = document.getElementById('chatMessages');
    
    // Verifica se a mensagem já existe
    const existingMessages = chatMessages.querySelectorAll('.message-wrapper');
    for (let msg of existingMessages) {
        if (msg.dataset.messageId === message.id) {
            return;
        }
    }
    
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper', isOwn ? 'self' : 'other');
    messageWrapper.dataset.messageId = message.id;
    
    // Header com avatar e nome
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    // Avatar
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    // Usa a função do profile.js
    const avatarDisplay = getAvatarDisplay(message.avatarData || message.avatar);
    
    if (avatarDisplay.type === 'image') {
        const img = document.createElement('img');
        img.src = avatarDisplay.content;
        img.alt = 'Avatar';
        avatarDiv.appendChild(img);
    } else {
        avatarDiv.textContent = avatarDisplay.content;
    }
    
    headerDiv.appendChild(avatarDiv);
    
    // Nickname
    const nicknameSpan = document.createElement('span');
    nicknameSpan.className = 'message-nickname';
    nicknameSpan.textContent = message.displayName || (currentLang === 'pt' ? 'Usuário' : 'User');
    if (isOwn) {
        nicknameSpan.textContent += ` ${t('chatYou')}`;
    }
    headerDiv.appendChild(nicknameSpan);
    
    messageWrapper.appendChild(headerDiv);
    
    // Bubble da mensagem
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';
    messageBubble.textContent = message.text;
    
    // Botão de deletar (apenas para mensagens próprias)
    if (isOwn) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'message-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = currentLang === 'pt' ? 'Excluir mensagem' : 'Delete message';
        deleteBtn.onclick = () => deleteMessage(message.id, messageWrapper);
        messageBubble.appendChild(deleteBtn);
    }
    
    messageWrapper.appendChild(messageBubble);
    
    // Timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(message.timestamp);
    messageWrapper.appendChild(timeDiv);
    
    chatMessages.appendChild(messageWrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (currentLang === 'pt') {
        if (diffMins < 1) return 'Agora';
        if (diffMins < 60) return `${diffMins}m atrás`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h atrás`;
        return date.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } else {
        if (diffMins < 1) return 'Now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString('en-US', { 
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

function startMessageListener() {
    if (!db || !auth) {
        console.error('[CHAT] Firebase não inicializado.');
        return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.log('[CHAT] Aguardando autenticação do usuário...');
        return;
    }
    
    console.log('[CHAT] Iniciando listener de mensagens para:', currentUser.email);
    
    if (unsubscribeChat) {
        unsubscribeChat();
    }
    
    unsubscribeChat = db.collection('chat')
        .orderBy('createdAt', 'asc')
        .limit(100)
        .onSnapshot(
            (snapshot) => {
                console.log('[CHAT] Snapshot recebido:', snapshot.size, 'mensagens');
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const messageData = change.doc.data();
                        const message = {
                            id: change.doc.id,
                            text: messageData.text,
                            displayName: messageData.displayName,
                            avatar: messageData.avatar || '👤',
                            avatarData: messageData.avatarData || null,
                            uid: messageData.uid,
                            timestamp: messageData.timestamp
                        };
                        
                        const isOwn = message.uid === currentUser.uid;
                        addMessageToUI(message, isOwn);
                    }
                });
            },
            (error) => {
                console.error('[CHAT] Erro no listener:', error);
                
                if (error.code === 'permission-denied') {
                    const errorMsg = currentLang === 'pt'
                        ? 'Erro de permissão no Firestore. Configure as regras no Firebase Console.'
                        : 'Firestore permission error. Configure rules in Firebase Console.';
                    showChatError(errorMsg);
                }
            }
        );
}

export function cleanupChat() {
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }
}