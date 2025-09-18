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
    console.log('🐛 DEBUG AUTHENTICATION - lobbyUser from localStorage:', {
        userId: lobbyUser.userId,
        username: lobbyUser.username,
        matchId: matchId,
        timestamp: new Date().toISOString()
    });
    
    // Connect to game namespace
    gameSocket = io('/game');
    
    // Connection handlers
    gameSocket.on('connect', () => {
        console.log('✅ Connected to game server');
        
        // Authenticate first
        gameSocket.emit('game:authenticate', {
            userId: lobbyUser.userId,
            username: lobbyUser.username
        });
    });
    
    gameSocket.on('disconnect', () => {
        console.log('❌ Disconnected from game server');
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
        
        console.log('🐛 DEBUG AUTHENTICATION - game:joined playerInfo:', {
            playerInfo: data.playerInfo,
            matchId: data.matchId,
            timestamp: new Date().toISOString()
        });
        
        currentMatch = data;
        currentUser = data.playerInfo;
        gameState = data.gameState;
        
        // Find opponent
        if (data.gameState && data.gameState.players) {
            opponent = data.gameState.players.find(p => p.userId !== currentUser.userId);
        }
        
        updatePlayerInfo();
        hideLoadingOverlay();
        
        // Initialize battle graphics
        initializeBattleGraphics(data.matchInfo);
        
        // Update skip turn button after graphics are ready
        setTimeout(() => updateEndTurnButton(), 100);
        
        // Start game timer
        startGameTimer();
    });
    
    // Game state updates
    gameSocket.on('game:state', (data) => {
        console.log('🔄 Game state updated:', data);
        
        // 🔍 DEBUG: Check movement points data from server
        console.log('🔍 DEBUG Movement Points from Server:', {
            team1MovementPoints: data.gameState?.team1MovementPoints,
            team2MovementPoints: data.gameState?.team2MovementPoints,
            hasGameBoard: !!data.gameState?.gameBoard
        });
        
        if (data.gameState?.gameBoard) {
            const gameLogic = data.gameState.gameBoard;
            console.log('🔍 DEBUG Movement Points Data:', {
                hasGameLogic: !!gameLogic,
                hasCalculateMethod: !!gameLogic._calculateTeamMovementPoint,
                alreadyEndedTurnUnits: gameLogic.alreadyEndedTurnUnits?.length || 0,
                currentTurnTeamId: gameLogic.currentTurnTeamId,
                team1Id: gameLogic.matchInfo?.team1?.teamId,
                team2Id: gameLogic.matchInfo?.team2?.teamId,
                team1Units: gameLogic.matchInfo?.team1?.units?.length || 0,
                team2Units: gameLogic.matchInfo?.team2?.units?.length || 0
            });
            
            // Try to calculate movement points manually
            if (gameLogic.matchInfo) {
                try {
                    console.log('🔍 Manual Movement Points Calculation:');
                    [gameLogic.matchInfo.team1, gameLogic.matchInfo.team2].forEach(team => {
                        if (team) {
                            const aliveUnits = team.units.filter(u => u.hp > 0 && u.name !== "Base");
                            const endedUnits = gameLogic.alreadyEndedTurnUnits || [];
                            const notYetEndedUnits = aliveUnits.filter(u => 
                                !endedUnits.some(endedUnit => endedUnit.id === u.id)
                            );
                            const totalMovement = notYetEndedUnits.reduce((sum, unit) => sum + unit.speed, 0);
                            console.log(`   Team ${team.teamId}: ${totalMovement} points (${notYetEndedUnits.length}/${aliveUnits.length} units available)`);
                        }
                    });
                } catch (error) {
                    console.error('❌ Error calculating movement points:', error);
                }
            }
        }
        
        gameState = data.gameState;
        
        // Update battle graphics
        if (battleGraphics) {
            battleGraphics.updateGameState(data.gameState);
        }
        
        updateGameDisplay();
        updateEndTurnButton();
    });
    
    // Action results
    gameSocket.on('game:action_result', (data) => {
        console.log('⚡ Action result received:', data);
        console.log('🔄 Updating game state from action result');
        
        // 🔍 DEBUG: Check if movement points changed after action
        console.log('🔍 DEBUG Movement Points After Action:', {
            action: data.action,
            result: data.result,
            team1MovementPoints: data.gameState?.team1MovementPoints,
            team2MovementPoints: data.gameState?.team2MovementPoints
        });
        
        if (data.gameState?.gameBoard) {
            const gameLogic = data.gameState.gameBoard;
            console.log('🔍 DEBUG GameLogic After Action:', {
                alreadyEndedTurnUnits: gameLogic.alreadyEndedTurnUnits?.length || 0,
                currentTurnTeamId: gameLogic.currentTurnTeamId
            });
        }
        
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
            
            // Update skip turn button after game state changes
            updateEndTurnButton();
            
            // 🎯 CRITICAL: Sau move, check và update highlights cho available actions
            if (data.action === 'move_unit' && data.result === true) {
                console.log('🎯 Move successful, checking for available actions...');
                // Đảm bảo unit vẫn selected và update highlights
                if (battleGraphics.selectedUnit && 
                    battleGraphics.gameLogic && 
                    battleGraphics.gameLogic.currentTurnTeamId === battleGraphics.playerTeam) {
                    
                    console.log('🔄 Updating highlights after successful move');
                    battleGraphics.updateHighlights();
                    
                    // Update UI info
                    if (window.updateActionInfo) {
                        const hasActions = battleGraphics.hasAvailableActionsForSelectedUnit();
                        if (hasActions) {
                            window.updateActionInfo('Choose target or action, or click End Turn');
                        } else {
                            window.updateActionInfo('No more actions available');
                        }
                    }
                }
            }
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
    // Skip turn button
    const skipTurnBtn = document.getElementById('skip-turn-btn');
    if (skipTurnBtn) {
        skipTurnBtn.addEventListener('click', () => {
            sendGameAction('end_turn', {});
            addGameLog('You skipped your turn');
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
        } else if (e.key === 's' || e.key === 'S') {
            // Skip turn with S key
            sendGameAction('end_turn', {});
            addGameLog('You skipped your turn (S key)');
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
    
    const payload = {
        matchId: currentMatch.matchId,
        action: action,
        actionData: actionData
    };
    
    console.log('📤 Sending action:', action);
    console.log('📦 Action payload:', payload);
    
    gameSocket.emit('game:action', payload);
    console.log('✅ Action emitted, waiting for server response...');
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


function updateTeamPanels() {
    // This would show unit status, but for now we'll keep it simple
    // The detailed unit info is shown in the game board
}

function updateEndTurnButton() {
    const skipTurnBtn = document.getElementById('skip-turn-btn');
    
    // In multiplayer, check if it's player's turn using gameLogic
    let isMyTurn = false;
    if (battleGraphics && battleGraphics.gameLogic && currentUser) {
        isMyTurn = battleGraphics.gameLogic.currentTurnTeamId === battleGraphics.playerTeam;
    }
    
    console.log('🔍 DEBUG Skip Turn Button:', {
        hasSkipBtn: !!skipTurnBtn,
        hasGameLogic: !!battleGraphics?.gameLogic,
        currentTurnTeamId: battleGraphics?.gameLogic?.currentTurnTeamId,
        playerTeam: battleGraphics?.playerTeam,
        isMyTurn: isMyTurn
    });
    
    // Show Skip Turn button only when it's player's turn
    if (skipTurnBtn) {
        if (isMyTurn) {
            skipTurnBtn.style.display = 'block';
        } else {
            skipTurnBtn.style.display = 'none';
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
window.updateActionInfo = updateActionInfo;
window.currentUser = currentUser;

// Update action info display
function updateActionInfo(message) {
    const actionInfoElement = document.getElementById('action-info');
    if (actionInfoElement) {
        actionInfoElement.textContent = message;
    }
}

// Update selected unit info display  
function updateSelectedUnitInfo(unit) {
    const selectedUnitInfoElement = document.getElementById('selected-unit-info');
    if (selectedUnitInfoElement && unit) {
        selectedUnitInfoElement.innerHTML = `
            <div class="text-blue-400 font-bold">${unit.name}</div>
            <div class="text-xs">HP: ${unit.hp} | Speed: ${unit.speed}</div>
        `;
    } else if (selectedUnitInfoElement) {
        selectedUnitInfoElement.innerHTML = '';
    }
}

// Make updateSelectedUnitInfo available globally
window.updateSelectedUnitInfo = updateSelectedUnitInfo;

console.log('🎮 Multiplayer game client loaded successfully');