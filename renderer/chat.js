import { initializeFirebase } from './auth.js';
import { t, getCurrentLang } from './i18n.js';
import { getUserProfile, getUserProfileFromFirestore, getAvatarDisplay } from './profile.js';

let db = null;
let auth = null;
let unsubscribeChat = null;

// Inicializa o chat (Firestore)
export async function initializeChat() {
  try {
    const firebaseResult = await initializeFirebase();
    
    if (!firebaseResult || !firebaseResult.db || !firebaseResult.auth) {
      console.error('[CHAT] Firebase não inicializado corretamente.');
      return;
    }
    
    db = firebaseResult.db;
    auth = firebaseResult.auth;
    
    // Verificar se chat já foi renderizado
    const chatPage = document.getElementById('page-chat');
    const chatMessagesContainer = document.getElementById('chatMessages');
    
    if (!chatMessagesContainer) {
      // Primeira vez: renderizar UI
      renderChatUI();
      addChatStyles();
      setupChatListeners();
    }
    
    // Sempre reconfigurar o listener AUTH (sem duplicar)
    // Este listener cuida de logout/login
    if (auth.currentUser) {
      startMessageListener();
    }
    
  } catch (error) {
    console.error('[CHAT] Erro ao inicializar chat:', error);
  }
}

function renderChatUI() {
    const chatPage = document.getElementById('page-chat');
    if (!chatPage) {
        return;
    }

    chatPage.replaceChildren();

    const title = document.createElement('h1');
    title.className = 'page-title';
    title.setAttribute('data-i18n', 'chat');
    title.textContent = t('chat');

    const card = document.createElement('div');
    card.className = 'card chat-container';

    const messages = document.createElement('div');
    messages.className = 'chat-messages';
    messages.id = 'chatMessages';

    const systemMsg = document.createElement('p');
    systemMsg.className = 'system-message';

    const welcome = document.createElement('span');
    welcome.setAttribute('data-i18n', 'chatWelcome');
    welcome.textContent = t('chatWelcome');

    const disclaimer = document.createElement('span');
    disclaimer.setAttribute('data-i18n', 'chatDisclaimer');
    disclaimer.textContent = ' ' + t('chatDisclaimer');

    systemMsg.appendChild(welcome);
    systemMsg.appendChild(disclaimer);
    messages.appendChild(systemMsg);

    const inputRow = document.createElement('div');
    inputRow.className = 'chat-input';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'chatInput';
    input.placeholder = t('chatPlaceholder');
    input.setAttribute('data-i18n-placeholder', 'chatPlaceholder');
    input.maxLength = 500;

    const sendBtn = document.createElement('button');
    sendBtn.id = 'chatSendBtn';
    sendBtn.className = 'primary-button';
    sendBtn.setAttribute('data-i18n', 'chatSend');
    sendBtn.textContent = t('chatSend');

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    card.appendChild(messages);
    card.appendChild(inputRow);
    chatPage.appendChild(title);
    chatPage.appendChild(card);
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
export function updateChatLanguage() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.placeholder = t('chatPlaceholder');
    }
    
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const messages = chatMessages.querySelectorAll('.message-wrapper');
        const hasMessages = messages.length > 0;
        
        if (!hasMessages) {
            const systemMsg = chatMessages.querySelector('.system-message');
            if (systemMsg) {
                systemMsg.replaceChildren();
                const welcome = document.createElement('span');
                welcome.setAttribute('data-i18n', 'chatWelcome');
                welcome.textContent = t('chatWelcome');
                const disclaimer = document.createElement('span');
                disclaimer.setAttribute('data-i18n', 'chatDisclaimer');
                disclaimer.textContent = ' ' + t('chatDisclaimer');
                systemMsg.appendChild(welcome);
                systemMsg.appendChild(disclaimer);
            }
        }
    }
}

function addChatStyles() {
    // CSS movido para chat.css
}

async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const messageText = chatInput.value.trim();

    if (messageText === '') return;

    const MAX_MSG_LENGTH = 500;
    if (messageText.length > MAX_MSG_LENGTH) {
        showChatError(getCurrentLang() === 'pt'
            ? `Mensagem muito longa. Máximo de ${MAX_MSG_LENGTH} caracteres.`
            : `Message too long. Maximum ${MAX_MSG_LENGTH} characters.`);
        return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error('[CHAT] Usuário não está logado.');
        showChatError(t('loginRequired'));
        return;
    }

    try {
        let userProfile = await getUserProfileFromFirestore(currentUser);
        
        if (!userProfile) {
            userProfile = getUserProfile(currentUser);
        }
        
        // Usar serverTimestamp para consistência
        const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
        
        await db.collection('chat').add({
            text: messageText,
            uid: currentUser.uid,
            displayName: userProfile.nickname || currentUser.displayName || currentUser.email || 'Usuário',
            avatarData: userProfile.avatarData || null,
            avatar: userProfile.avatar || '👤',
            timestamp: serverTimestamp,
            createdAt: serverTimestamp
        });
        
        chatInput.value = '';
        
    } catch (error) {
        console.error('[CHAT] Erro ao enviar mensagem:', error);
        
        let errorMessage = t('chatError');
        
        if (error.code === 'permission-denied') {
            errorMessage = getCurrentLang() === 'pt' 
                ? 'Você não tem permissão para enviar mensagens. Configure as regras do Firestore.'
                : 'You do not have permission to send messages. Configure Firestore rules.';
        } else if (error.code === 'unavailable') {
            errorMessage = getCurrentLang() === 'pt'
                ? 'Servidor indisponível. Verifique sua conexão com a internet.'
                : 'Server unavailable. Check your internet connection.';
        }
        
        showChatError(errorMessage);
    }
}

async function deleteMessage(messageId, messageElement) {
    // Confirmação robusta: modal personalizado ou fallback com confirm()
    if (typeof window.showConfirmModal === 'function') {
        window.showConfirmModal(t('chatDeleteConfirm'), async () => {
            try {
                await db.collection('chat').doc(messageId).delete();
                messageElement.remove();
            } catch (error) {
                console.error('[CHAT] Erro ao deletar mensagem:', error);
                showChatError(t('chatDeleteError'));
            }
        });
    } else {
        // Fallback com confirmação nativa
        const confirmMsg = getCurrentLang() === 'pt' ? 'Excluir mensagem?' : 'Delete message?';
        if (confirm(confirmMsg)) {
            try {
                await db.collection('chat').doc(messageId).delete();
                messageElement.remove();
            } catch (error) {
                console.error('[CHAT] Erro ao deletar mensagem:', error);
                showChatError(t('chatDeleteError'));
            }
        }
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
    
    // Verificar se a mensagem já existe
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
    
    const avatarDisplay = getAvatarDisplay(message.avatarData || message.avatar);
    
    if (avatarDisplay.type === 'image') {
        // ✅ Validação de segurança: apenas data: ou HTTPS
        const src = avatarDisplay.content;
        if (src && (src.startsWith('data:') || src.startsWith('https://'))) {
            const img = document.createElement('img');
            img.src = src;
            img.alt = 'Avatar';
            avatarDiv.appendChild(img);
        } else {
            // Fallback seguro: emoji ou inicial
            avatarDiv.textContent = '👤';
        }
    } else {
        avatarDiv.textContent = avatarDisplay.content;
    }
    
    headerDiv.appendChild(avatarDiv);
    
    // Nickname
    const nicknameSpan = document.createElement('span');
    nicknameSpan.className = 'message-nickname';
    nicknameSpan.textContent = message.displayName || (getCurrentLang() === 'pt' ? 'Usuário' : 'User');
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
        deleteBtn.textContent = '×';
        deleteBtn.title = getCurrentLang() === 'pt' ? 'Excluir mensagem' : 'Delete message';
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
    // Scroll automático mantido conforme solicitado
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (getCurrentLang() === 'pt') {
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

// ✅ CORREÇÃO PRINCIPAL: Função startMessageListener otimizada para não piscar
function startMessageListener() {
    if (!db || !auth) {
        console.error('[CHAT] Firebase não inicializado.');
        return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
        return;
    }

    // Se já existe um listener, desregistrar antes de criar um novo
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }
    
    // ✅ Buscar últimas 200 mensagens sem limite de tempo
    unsubscribeChat = db.collection('chat')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .onSnapshot(
            (snapshot) => {
                const chatMessages = document.getElementById('chatMessages');
                if (!chatMessages) return;
                
                // ✅ NÃO deletar TODAS as mensagens
                // Em vez disso: compilar IDs das mensagens atuais
                const messageIds = new Set();
                snapshot.forEach(doc => {
                    messageIds.add(doc.id);
                });
                
                // Remover mensagens que não estão mais nos dados
                const existingMessages = chatMessages.querySelectorAll('.message-wrapper');
                existingMessages.forEach(msg => {
                    const msgId = msg.dataset.messageId;
                    if (!messageIds.has(msgId)) {
                        msg.remove();
                    }
                });
                
                // Coletar e ordenar mensagens
                const messages = [];
                snapshot.forEach(doc => {
                    const messageData = doc.data();
                    messages.push({
                        id: doc.id,
                        text: messageData.text,
                        displayName: messageData.displayName,
                        avatar: messageData.avatar || '👤',
                        avatarData: messageData.avatarData || null,
                        uid: messageData.uid,
                        timestamp: messageData.timestamp,
                        createdAt: messageData.createdAt
                    });
                });
                
                // Ordenar por createdAt (mais antigo primeiro)
                messages.sort((a, b) => {
                    const timeA = a.createdAt?.toDate?.() || new Date(0);
                    const timeB = b.createdAt?.toDate?.() || new Date(0);
                    return timeA - timeB;
                });
                
                // ✅ Adicionar APENAS mensagens novas
                messages.forEach(message => {
                    const existingMsg = chatMessages.querySelector(`[data-message-id="${message.id}"]`);
                    if (!existingMsg) {
                        // Mensagem nova: adicionar
                        const isOwn = message.uid === currentUser.uid;
                        addMessageToUI(message, isOwn);
                    }
                });
                
                // Scroll automático (mantido conforme solicitado)
                setTimeout(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 0);
            },
            (error) => {
                console.error('[CHAT] Erro no listener do Firestore:', error);
                
                if (error.code === 'permission-denied') {
                    const errorMsg = getCurrentLang() === 'pt'
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