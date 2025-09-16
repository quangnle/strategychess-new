// Multiplayer game client - chỉ render và gửi actions, không xử lý game logic
let gameSocket = null;
let chatSocket = null;
let currentUser = null;
let currentMatch = null;
let gameState = null;
let battleGraphics = null;
let opponent = null;

// Game timing
let gameStartTime = null;
let gameTimer = null;

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initializing multiplayer game...');
    
    // Get match ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('matchId');
    
    if (!matchId) {
        showError('No match ID provided');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    // Initialize game
    initializeGame(matchId);
    
    // Initialize UI event handlers
    initializeEventHandlers();
    
    // Initialize chat
    initializeChat();
});

// Initialize multiplayer game connection
function initializeGame(matchId) {
    console.log('🔌 Connecting to game server for match:', matchId);
    
    // Get user info from localStorage
    const lobbyUserData = localStorage.getItem('lobbyUser');
    if (!lobbyUserData) {
        showError('No user data found. Please go back to main menu.');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }
    
    const lobbyUser = JSON.parse(lobbyUserData);
    console.log('👤 User data:', lobbyUser);
    
    // Connect to game namespace
    gameSocket = io('/game');
    
    // Connection handlers
    gameSocket.on('connect', () => {
        console.log('✅ Connected to game server');
        updateConnectionStatus(true);
        
        // Authenticate first
        gameSocket.emit('game:authenticate', {
            userId: lobbyUser.userId,
            username: lobbyUser.username
        });
    });
    
    gameSocket.on('disconnect', () => {
        console.log('❌ Disconnected from game server');
        updateConnectionStatus(false);
        showConnectionLostModal();
    });
    
    // Authentication
    gameSocket.on('game:authenticated', (data) => {
        console.log('🔐 Authenticated with game server:', data);
        
        // Join the game
        setTimeout(() => {
            gameSocket.emit('game:join', { matchId: matchId });
        }, 500);
    });
    
    // Game join response
    gameSocket.on('game:joined', (data) => {
        console.log('🎯 Joined game successfully:', data);
        
        currentMatch = data;
        currentUser = data.playerInfo;
        gameState = data.gameState;
        
        // Find opponent
        if (data.gameState && data.gameState.players) {
            opponent = data.gameState.players.find(p => p.userId !== currentUser.userId);
        }
        
        updateMatchInfo();
        updatePlayerInfo();
        hideLoadingOverlay();
        
        // Initialize battle graphics
        initializeBattleGraphics(data.matchInfo);
        
        // Start game timer
        startGameTimer();
    });
    
    // Game state updates
    gameSocket.on('game:state', (data) => {
        console.log('🔄 Game state updated:', data);
        gameState = data.gameState;
        updateGameDisplay();
    });
    
    // Action results
    gameSocket.on('game:action_result', (data) => {
        console.log('⚡ Action result:', data);
        
        // Update game state
        if (data.gameState) {
            gameState = data.gameState;
            updateGameDisplay();
        }
        
        // Show action in game log
        addGameLog(formatActionLog(data));
        
        // Update battle graphics if available
        if (battleGraphics) {
            battleGraphics.updateGameState(data.gameState);
        }
    });
    
    // Action errors
    gameSocket.on('game:action_error', (data) => {
        console.error('❌ Action error:', data);
        showError(`Action failed: ${data.error || data.message}`);
    });
    
    // Game ended
    gameSocket.on('game:ended', (data) => {
        console.log('🏁 Game ended:', data);
        showGameOverModal(data);
        stopGameTimer();
    });
    
    // Player joined/left
    gameSocket.on('game:player_joined', (data) => {
        console.log('👥 Player joined:', data);
        addGameLog(`${data.username} joined the game`);
    });
    
    gameSocket.on('game:player_left', (data) => {
        console.log('👋 Player left:', data);
        addGameLog(`${data.username} left the game`);
    });
    
    // Error handling
    gameSocket.on('error', (error) => {
        console.error('🚫 Game error:', error);
        showError(`Game error: ${error.message || 'Unknown error'}`);
    });
}

// Initialize battle graphics
async function initializeBattleGraphics(matchInfo) {
    try {
        console.log('🎨 Initializing battle graphics...');
        
        // Import the multiplayer graphics module
        const graphicsModule = await import('./p5-battle-sketch-multiplayer.js');
        const P5BattleGraphicsMultiplayer = graphicsModule.default;
        
        // Determine player's team for perspective
        const playerTeam = currentUser.teamId || 'blue';
        
        console.log('🎯 Player team for perspective:', playerTeam);
        console.log('📋 Match info for graphics:', matchInfo);
        
        // Create graphics instance
        battleGraphics = new P5BattleGraphicsMultiplayer(
            matchInfo,
            gameSocket,
            currentUser.userId,
            playerTeam
        );
        
        // Initial game state update
        if (gameState) {
            battleGraphics.updateGameState(gameState);
        }
        
        console.log('✨ Battle graphics initialized successfully');
        
    } catch (error) {
        console.error('💥 Error initializing battle graphics:', error);
        showError('Failed to load game graphics');
    }
}

// Initialize event handlers
function initializeEventHandlers() {
    // End turn button
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.addEventListener('click', () => {
            sendGameAction('end_turn', {});
        });
    }
    
    // Leave game button
    const leaveGameBtn = document.getElementById('leave-game-btn');
    if (leaveGameBtn) {
        leaveGameBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to leave the game?')) {
                leaveGame();
            }
        });
    }
    
    // Game over modal buttons
    const playAgainBtn = document.getElementById('play-again-btn');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    if (backToMainBtn) {
        backToMainBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Mobile chat toggle
    const mobileChatToggle = document.getElementById('mobile-chat-toggle');
    const mobileChatPanel = document.getElementById('mobile-chat-panel');
    const closeMobileChat = document.getElementById('close-mobile-chat');
    
    if (mobileChatToggle && mobileChatPanel) {
        mobileChatToggle.addEventListener('click', () => {
            mobileChatPanel.classList.toggle('hidden');
        });
    }
    
    if (closeMobileChat && mobileChatPanel) {
        closeMobileChat.addEventListener('click', () => {
            mobileChatPanel.classList.add('hidden');
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Clear selection or close modals
            if (battleGraphics) {
                battleGraphics.clearSelection();
            }
        } else if (e.key === 'Enter' && e.ctrlKey) {
            // End turn with Ctrl+Enter
            sendGameAction('end_turn', {});
        }
    });
}

// Initialize chat functionality
function initializeChat() {
    console.log('💬 Initializing chat...');
    
    // Connect to chat namespace
    chatSocket = io('/chat');
    
    // Chat UI elements
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-message');
    const chatMessages = document.getElementById('chat-messages');
    
    // Mobile chat elements
    const mobileChatInput = document.getElementById('mobile-chat-input');
    const mobileSendButton = document.getElementById('mobile-send-message');
    const mobileChatMessages = document.getElementById('mobile-chat-messages');
    
    // Send message function
    function sendMessage(input) {
        const message = input.value.trim();
        if (message && chatSocket) {
            chatSocket.emit('chat:message', { message });
            input.value = '';
        }
    }
    
    // Desktop chat handlers
    if (sendButton && chatInput) {
        sendButton.addEventListener('click', () => sendMessage(chatInput));
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage(chatInput);
            }
        });
    }
    
    // Mobile chat handlers
    if (mobileSendButton && mobileChatInput) {
        mobileSendButton.addEventListener('click', () => sendMessage(mobileChatInput));
        mobileChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage(mobileChatInput);
            }
        });
    }
    
    // Chat socket events
    chatSocket.on('connect', () => {
        console.log('💬 Connected to chat server');
    });
    
    chatSocket.on('user:connected', (data) => {
        console.log('👤 Chat user connected:', data);
    });
    
    chatSocket.on('chat:message', (message) => {
        addChatMessage(message);
    });
    
    chatSocket.on('chat:messages', (messages) => {
        if (chatMessages) chatMessages.innerHTML = '';
        if (mobileChatMessages) mobileChatMessages.innerHTML = '';
        messages.forEach(message => addChatMessage(message));
    });
    
    chatSocket.on('error', (error) => {
        console.error('💬 Chat error:', error);
    });
}

// Send game action to server
function sendGameAction(action, actionData) {
    if (!gameSocket || !currentMatch) {
        showError('Not connected to game');
        return;
    }
    
    console.log('📤 Sending action:', action, actionData);
    
    gameSocket.emit('game:action', {
        matchId: currentMatch.matchId,
        action: action,
        actionData: actionData
    });
}

// Leave game
function leaveGame() {
    if (gameSocket && currentMatch) {
        gameSocket.emit('game:leave', { matchId: currentMatch.matchId });
    }
    
    // Cleanup
    stopGameTimer();
    
    // Redirect after a short delay
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

// Update UI functions
function updateMatchInfo() {
    const matchInfoElement = document.getElementById('match-info');
    if (matchInfoElement && currentMatch && opponent) {
        matchInfoElement.innerHTML = `
            <div>Match: ${currentMatch.matchName || 'Multiplayer Game'}</div>
            <div>vs ${opponent.username}</div>
        `;
    }
}

function updatePlayerInfo() {
    // Update player username
    const playerUsernameElement = document.getElementById('player-username');
    if (playerUsernameElement && currentUser) {
        playerUsernameElement.textContent = currentUser.username;
    }
    
    // Update opponent username
    const opponentUsernameElement = document.getElementById('opponent-username');
    if (opponentUsernameElement && opponent) {
        opponentUsernameElement.textContent = opponent.username;
    }
}

function updateGameDisplay() {
    if (!gameState) return;
    
    // Update turn info
    updateTurnInfo();
    
    // Update round info
    const roundElement = document.getElementById('round-number');
    if (roundElement) {
        roundElement.textContent = gameState.turnNumber || 0;
    }
    
    // Update team panels
    updateTeamPanels();
    
    // Update end turn button
    updateEndTurnButton();
}

function updateTurnInfo() {
    const currentTurnElement = document.getElementById('current-turn');
    const mobileTurnElement = document.getElementById('mobile-current-turn');
    
    if (!gameState || !gameState.currentPlayer) {
        if (currentTurnElement) currentTurnElement.textContent = 'Waiting...';
        if (mobileTurnElement) mobileTurnElement.textContent = 'Waiting...';
        return;
    }
    
    const isMyTurn = gameState.currentPlayer === currentUser.userId;
    const turnText = isMyTurn ? 'Your Turn' : `${opponent?.username || 'Opponent'}'s Turn`;
    const turnClass = isMyTurn ? 'text-green-400' : 'text-red-400';
    
    if (currentTurnElement) {
        currentTurnElement.textContent = turnText;
        currentTurnElement.className = turnClass;
    }
    
    if (mobileTurnElement) {
        mobileTurnElement.textContent = turnText;
        mobileTurnElement.className = turnClass;
    }
    
    // Update player panels active state
    const playerPanel = document.getElementById('player-team-panel');
    const opponentPanel = document.getElementById('opponent-team-panel');
    
    if (playerPanel) {
        if (isMyTurn) {
            playerPanel.classList.add('active-turn');
        } else {
            playerPanel.classList.remove('active-turn');
        }
    }
    
    if (opponentPanel) {
        if (!isMyTurn) {
            opponentPanel.classList.add('active-turn');
        } else {
            opponentPanel.classList.remove('active-turn');
        }
    }
}

function updateTeamPanels() {
    // This would show unit status, but for now we'll keep it simple
    // The detailed unit info is shown in the game board
}

function updateEndTurnButton() {
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (!endTurnBtn) return;
    
    const isMyTurn = gameState && gameState.currentPlayer === currentUser.userId;
    
    endTurnBtn.disabled = !isMyTurn;
    
    if (isMyTurn) {
        endTurnBtn.textContent = 'End Turn';
        endTurnBtn.className = 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors';
    } else {
        endTurnBtn.textContent = 'Not Your Turn';
        endTurnBtn.className = 'bg-gray-600 cursor-not-allowed text-white px-4 py-2 rounded transition-colors';
    }
}

function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        if (connected) {
            statusElement.innerHTML = '🟢 Connected';
            statusElement.className = 'text-green-400';
        } else {
            statusElement.innerHTML = '🔴 Disconnected';
            statusElement.className = 'text-red-400';
        }
    }
}

// Game timer functions
function startGameTimer() {
    gameStartTime = Date.now();
    gameTimer = setInterval(updateGameTime, 1000);
}

function stopGameTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
}

function updateGameTime() {
    if (!gameStartTime) return;
    
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const timeElement = document.getElementById('game-time');
    if (timeElement) {
        timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// UI helper functions
function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showError(message) {
    console.error('❌', message);
    // You could show a toast notification here
    alert(message); // Simple fallback
}

function showGameOverModal(data) {
    const modal = document.getElementById('game-over-modal');
    const resultElement = document.getElementById('game-result');
    
    if (!modal || !resultElement) return;
    
    let resultText = '';
    if (data.winner) {
        const isWinner = data.winner.userId === currentUser.userId;
        resultText = `
            <div class="text-2xl font-bold ${isWinner ? 'text-green-400' : 'text-red-400'} mb-2">
                ${isWinner ? '🎉 Victory!' : '💔 Defeat'}
            </div>
            <div class="text-gray-300">
                ${data.winner.username} won the game!
            </div>
        `;
    } else {
        resultText = `
            <div class="text-2xl font-bold text-yellow-400 mb-2">🤝 Draw!</div>
            <div class="text-gray-300">The game ended in a draw</div>
        `;
    }
    
    resultElement.innerHTML = resultText;
    modal.classList.remove('hidden');
}

function showConnectionLostModal() {
    const modal = document.getElementById('connection-lost-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // Try to reconnect after a delay
        setTimeout(() => {
            if (gameSocket && !gameSocket.connected) {
                gameSocket.connect();
            }
        }, 3000);
    }
}

// Chat functions
function addChatMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const mobileChatMessages = document.getElementById('mobile-chat-messages');
    
    const messageElement = createChatMessageElement(message);
    const mobileMessageElement = createChatMessageElement(message);
    
    if (chatMessages) {
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    if (mobileChatMessages) {
        mobileChatMessages.appendChild(mobileMessageElement);
        mobileChatMessages.scrollTop = mobileChatMessages.scrollHeight;
    }
}

function createChatMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-sm';
    
    const time = new Date(message.timestamp).toLocaleTimeString();
    const isOwnMessage = message.userId === currentUser?.userId;
    
    messageDiv.innerHTML = `
        <div class="flex ${isOwnMessage ? 'justify-end' : 'justify-start'}">
            <div class="max-w-xs ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'} rounded-lg px-3 py-2">
                <div class="text-xs text-gray-300 mb-1">${message.username} • ${time}</div>
                <div class="text-sm">${escapeHtml(message.message)}</div>
            </div>
        </div>
    `;
    
    return messageDiv;
}

// Game log functions
function addGameLog(message) {
    const gameLog = document.getElementById('game-log');
    if (!gameLog) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = 'text-gray-300';
    
    const time = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span class="text-gray-500">[${time}]</span> ${message}`;
    
    gameLog.appendChild(logEntry);
    gameLog.scrollTop = gameLog.scrollHeight;
    
    // Keep only last 50 entries
    while (gameLog.children.length > 50) {
        gameLog.removeChild(gameLog.firstChild);
    }
}

function formatActionLog(actionData) {
    const player = actionData.playerId === currentUser.userId ? 'You' : (opponent?.username || 'Opponent');
    
    switch (actionData.action) {
        case 'move_unit':
            return `${player} moved a unit`;
        case 'attack':
            return `${player} attacked`;
        case 'heal':
            return `${player} healed a unit`;
        case 'sacrifice':
            return `${player} sacrificed HP`;
        case 'suicide':
            return `${player} used suicide attack`;
        case 'end_turn':
            return `${player} ended turn`;
        default:
            return `${player} performed ${actionData.action}`;
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally for P5 graphics
window.sendGameAction = sendGameAction;
window.addGameLog = addGameLog;
window.currentUser = currentUser;

console.log('🎮 Multiplayer game client loaded successfully');