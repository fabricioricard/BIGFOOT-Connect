const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { 
    Connection, 
    PublicKey, 
    Keypair,
    Transaction,
    sendAndConfirmTransaction
} = require('@solana/web3.js');
const { 
    getAssociatedTokenAddress,
    createTransferInstruction,
    getOrCreateAssociatedTokenAccount
} = require('@solana/spl-token');

admin.initializeApp();
const db = admin.firestore();

// Configuração
const SOLANA_RPC_URL = functions.config().solana.rpc_url || 'https://api.mainnet-beta.solana.com';
const TREASURY_PRIVATE_KEY = functions.config().solana.treasury_key; // Base64 encoded
const BIG_TOKEN_MINT = functions.config().solana.big_token_mint; // Endereço do token BIG
const BIG_TOKEN_DECIMALS = 9;

// Inicializa conexão com Solana
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Trigger quando uma nova claim é criada
 * Processa a transferência de tokens BIG para a carteira do usuário
 */
exports.processBigTokenClaim = functions.firestore
    .document('claims/{claimId}')
    .onCreate(async (snap, context) => {
        const claimId = context.params.claimId;
        const claim = snap.data();
        
        console.log(`[CLAIM] Processando claim ${claimId}`, claim);
        
        try {
            // Valida a claim
            if (claim.status !== 'pending') {
                console.log(`[CLAIM] Claim ${claimId} não está pendente, ignorando`);
                return null;
            }
            
            if (!claim.walletAddress || !claim.amount || claim.amount <= 0) {
                throw new Error('Dados da claim inválidos');
            }
            
            // Atualiza status para processando
            await snap.ref.update({
                status: 'processing',
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Faz a transferência de tokens BIG
            const txHash = await transferBigTokens(
                claim.walletAddress,
                claim.amount
            );
            
            console.log(`[CLAIM] Transferência concluída. TX: ${txHash}`);
            
            // Atualiza a claim com sucesso
            await snap.ref.update({
                status: 'completed',
                txHash: txHash,
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Envia notificação ao usuário (opcional)
            await sendClaimNotification(claim.userId, claim.amount, txHash);
            
            return { success: true, txHash };
            
        } catch (error) {
            console.error(`[CLAIM] Erro ao processar claim ${claimId}:`, error);
            
            // Marca a claim como falha
            await snap.ref.update({
                status: 'failed',
                error: error.message,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Reverte o saldo do usuário
            await db.collection('users').doc(claim.userId).update({
                monthlyBigBalance: admin.firestore.FieldValue.increment(claim.amount)
            });
            
            return { success: false, error: error.message };
        }
    });

/**
 * Transfere tokens BIG da treasury para o usuário
 */
async function transferBigTokens(recipientAddress, amount) {
    try {
        // Carrega a chave privada da treasury
        const treasuryKeypair = Keypair.fromSecretKey(
            Buffer.from(TREASURY_PRIVATE_KEY, 'base64')
        );
        
        // Converte endereços
        const mintPublicKey = new PublicKey(BIG_TOKEN_MINT);
        const recipientPublicKey = new PublicKey(recipientAddress);
        
        // Obtém ou cria a conta de token associada da treasury
        const treasuryTokenAccount = await getAssociatedTokenAddress(
            mintPublicKey,
            treasuryKeypair.publicKey
        );
        
        // Obtém ou cria a conta de token associada do destinatário
        const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryKeypair,
            mintPublicKey,
            recipientPublicKey
        );
        
        // Converte a quantidade para a menor unidade (considerando decimais)
        const amountInSmallestUnit = Math.floor(amount * Math.pow(10, BIG_TOKEN_DECIMALS));
        
        console.log(`[TRANSFER] Transferindo ${amount} BIG (${amountInSmallestUnit} unidades)`);
        console.log(`[TRANSFER] De: ${treasuryTokenAccount.toString()}`);
        console.log(`[TRANSFER] Para: ${recipientTokenAccount.address.toString()}`);
        
        // Cria a instrução de transferência
        const transferInstruction = createTransferInstruction(
            treasuryTokenAccount,
            recipientTokenAccount.address,
            treasuryKeypair.publicKey,
            amountInSmallestUnit
        );
        
        // Cria e envia a transação
        const transaction = new Transaction().add(transferInstruction);
        
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [treasuryKeypair],
            {
                commitment: 'confirmed',
                skipPreflight: false
            }
        );
        
        console.log(`[TRANSFER] Sucesso! Signature: ${signature}`);
        
        return signature;
        
    } catch (error) {
        console.error('[TRANSFER] Erro na transferência:', error);
        throw new Error(`Falha na transferência de tokens: ${error.message}`);
    }
}

/**
 * Envia notificação ao usuário sobre o resgate
 */
async function sendClaimNotification(userId, amount, txHash) {
    try {
        await db.collection('notifications').add({
            userId: userId,
            type: 'claim_completed',
            title: 'Resgate de Tokens BIG Concluído',
            message: `Você resgatou ${amount.toLocaleString('pt-BR')} BIG tokens com sucesso!`,
            txHash: txHash,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`[NOTIFICATION] Notificação enviada para usuário ${userId}`);
    } catch (error) {
        console.error('[NOTIFICATION] Erro ao enviar notificação:', error);
        // Não lança erro para não falhar a claim
    }
}

/**
 * Função agendada para executar no dia 2 de cada mês às 00:00
 * Reseta os saldos mensais de todos os usuários que não resgataram
 */
exports.resetMonthlyBalances = functions.pubsub
    .schedule('0 0 2 * *') // Dia 2 de cada mês à meia-noite
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        console.log('[RESET] Iniciando reset de saldos mensais...');
        
        try {
            const now = new Date();
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const yearOfLastMonth = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            
            // Busca usuários que não resgataram no mês passado
            const usersSnapshot = await db.collection('users')
                .where('monthlyBigBalance', '>', 0)
                .get();
            
            let resetCount = 0;
            const batch = db.batch();
            
            for (const doc of usersSnapshot.docs) {
                const userData = doc.data();
                const userId = doc.id;
                
                // Verifica se o usuário resgatou no mês passado
                const lastClaimDate = userData.lastClaimDate?.toDate();
                const resgatouMesPassado = lastClaimDate &&
                    lastClaimDate.getMonth() === lastMonth &&
                    lastClaimDate.getFullYear() === yearOfLastMonth;
                
                if (!resgatouMesPassado) {
                    // Salva no histórico antes de resetar
                    const historyRef = doc.ref.collection('monthlyHistory').doc();
                    batch.set(historyRef, {
                        month: lastMonth,
                        year: yearOfLastMonth,
                        balance: userData.monthlyBigBalance,
                        status: 'expired',
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Reseta o saldo
                    batch.update(doc.ref, {
                        monthlyBigBalance: 0,
                        lastResetDate: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    resetCount++;
                    
                    // Envia notificação
                    const notificationRef = db.collection('notifications').doc();
                    batch.set(notificationRef, {
                        userId: userId,
                        type: 'balance_expired',
                        title: 'Saldo de Tokens Expirado',
                        message: `Seu saldo de ${userData.monthlyBigBalance.toLocaleString('pt-BR')} BIG tokens do mês passado expirou. Não esqueça de resgatar no dia 1º de cada mês!`,
                        read: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
            
            // Executa o batch
            await batch.commit();
            
            console.log(`[RESET] ${resetCount} saldos resetados com sucesso`);
            
            return { success: true, resetCount };
            
        } catch (error) {
            console.error('[RESET] Erro ao resetar saldos:', error);
            throw error;
        }
    });

/**
 * Função HTTP para reprocessar uma claim com falha (apenas admin)
 */
exports.reprocessClaim = functions.https.onCall(async (data, context) => {
    // Verifica autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Usuário não autenticado'
        );
    }
    
    // Verifica se é admin (implemente sua lógica de admin)
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Apenas administradores podem reprocessar claims'
        );
    }
    
    const claimId = data.claimId;
    
    if (!claimId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'claimId é obrigatório'
        );
    }
    
    try {
        const claimRef = db.collection('claims').doc(claimId);
        const claimDoc = await claimRef.get();
        
        if (!claimDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'Claim não encontrada'
            );
        }
        
        const claim = claimDoc.data();
        
        if (claim.status === 'completed') {
            throw new functions.https.HttpsError(
                'already-exists',
                'Claim já foi processada com sucesso'
            );
        }
        
        // Atualiza para pendente
        await claimRef.update({
            status: 'pending',
            reprocessedBy: context.auth.uid,
            reprocessedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Tenta processar novamente
        const txHash = await transferBigTokens(claim.walletAddress, claim.amount);
        
        await claimRef.update({
            status: 'completed',
            txHash: txHash,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, txHash };
        
    } catch (error) {
        console.error('[REPROCESS] Erro:', error);
        throw new functions.https.HttpsError(
            'internal',
            `Erro ao reprocessar claim: ${error.message}`
        );
    }
});

/**
 * Função para verificar saldo da treasury (apenas admin)
 */
exports.checkTreasuryBalance = functions.https.onCall(async (data, context) => {
    // Verifica autenticação e permissão de admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Acesso negado');
    }
    
    try {
        const treasuryKeypair = Keypair.fromSecretKey(
            Buffer.from(TREASURY_PRIVATE_KEY, 'base64')
        );
        
        const mintPublicKey = new PublicKey(BIG_TOKEN_MINT);
        
        const treasuryTokenAccount = await getAssociatedTokenAddress(
            mintPublicKey,
            treasuryKeypair.publicKey
        );
        
        const accountInfo = await connection.getTokenAccountBalance(treasuryTokenAccount);
        
        return {
            balance: accountInfo.value.uiAmount,
            address: treasuryTokenAccount.toString()
        };
        
    } catch (error) {
        console.error('[TREASURY] Erro ao verificar saldo:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});