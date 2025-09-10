// Game functionality
let gameSocket = null;
let chatSocket = null;
let currentUser = null;
let currentMatch = null;
let gameState = null;
let teamsData = null; // Teams data from server
let battleGraphics = null; // P5.js graphics instance

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get match ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('matchId');
    
    if (!matchId) {
        alert('No match ID provided');
        window.location.href = 'index.html';
        return;
    }

    // Initialize game functionality
    initializeGame(matchId);
    
    // Initialize chat functionality
    initializeChat();
    
    // Initialize UI event handlers
    initializeEventHandlers();
    
    // Initialize collapsible panels
    initializeCollapsiblePanels();
});

// Initialize game
function initializeGame(matchId) {
    console.log('Initializing game for match:', matchId);
    console.log('URL params:', window.location.search);
    
    // Get user info from localStorage (set when creating/joining match)
    const lobbyUserData = localStorage.getItem('lobbyUser');
    if (!lobbyUserData) {
        alert('No user data found. Please go back to main menu.');
        window.location.href = 'index.html';
        return;
    }
    
    const lobbyUser = JSON.parse(lobbyUserData);
    console.log('Game user data:', lobbyUser);
    
    // Connect to game namespace
    gameSocket = io('/game');
    
    // Game socket event handlers
    gameSocket.on('connect', () => {
        console.log('Connected to game server');
        
        // Authenticate with game using stored user data
        authenticateWithGame(lobbyUser);
    });
    
    gameSocket.on('game:authenticated', (data) => {
        console.log('Authenticated with game:', data);
        // Now join the game with a small delay to ensure match is ready
        console.log('Attempting to join game with matchId:', matchId);
        setTimeout(() => {
            gameSocket.emit('game:join', { matchId: matchId });
        }, 1000); // 1 second delay
    });
    
    gameSocket.on('game:joined', (data) => {
        console.log('Joined game:', data);
        currentMatch = data;
        gameState = data.gameState;
        currentUser = data.playerInfo;
        
        updateMatchInfo();
        initializeBattleGraphics(data.matchInfo); // Pass matchInfo from server
        
        // Update battle graphics with game state
        if (battleGraphics && data.gameState) {
            battleGraphics.updateGameState(data.gameState);
        }
    });
    
    let joinRetryCount = 0;
    const maxRetries = 3;
    
    gameSocket.on('error', (error) => {
        console.error('Game socket error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // If it's a "not in game phase" error, retry joining
        if (error.message && error.message.includes('not in game phase') && joinRetryCount < maxRetries) {
            joinRetryCount++;
            console.log(`Retrying to join game (attempt ${joinRetryCount}/${maxRetries})...`);
            setTimeout(() => {
                gameSocket.emit('game:join', { matchId: matchId });
            }, 2000); // 2 second delay between retries
            return;
        }
        
        alert(`Game error: ${error.message || 'Unknown error'}`);
    });
    
    gameSocket.on('game:player_joined', (data) => {
        console.log('Player joined game:', data);
        addGameLog(`${data.username} joined the game`);
    });
    
    gameSocket.on('game:player_left', (data) => {
        console.log('Player left game:', data);
        addGameLog(`${data.username} left the game`);
    });
    
    gameSocket.on('game:action_result', (data) => {
        console.log('Game action result received:', data);
        handleGameActionResult(data);
    });
    
    gameSocket.on('game:action_error', (data) => {
        console.error('Game action error:', data);
        alert(`Action failed: ${data.error || data.message}`);
    });
    
    gameSocket.on('game:state', (data) => {
        console.log('Game state received:', data);
        gameState = data.gameState;
        if (battleGraphics) {
            battleGraphics.updateGameState(data.gameState);
        }
    });
    
    gameSocket.on('game:ended', (data) => {
        console.log('Game ended:', data);
        showGameOverModal(data);
    });
    
    gameSocket.on('error', (data) => {
        console.error('Game error:', data);
        alert(`Error: ${data.message}`);
    });
    
    gameSocket.on('disconnect', () => {
        console.log('Disconnected from game server');
        alert('Disconnected from game server');
    });
}

// Authenticate with game namespace
function authenticateWithGame(lobbyUser) {
    if (lobbyUser && gameSocket) {
        gameSocket.emit('game:authenticate', {
            userId: lobbyUser.userId,
            username: lobbyUser.username
        });
    }
}

// Initialize chat functionality
function initializeChat() {
    console.log('Initializing chat functionality...');
    
    // Connect to chat namespace
    chatSocket = io('/chat');
    
    // Chat UI elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-message');
    const toggleChat = document.getElementById('toggle-chat');
    const chatContainer = document.getElementById('chat-container');
    
    // Send message
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message && chatSocket) {
            chatSocket.emit('chat:message', { message });
            chatInput.value = '';
        }
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    if (toggleChat) {
        toggleChat.addEventListener('click', () => {
            chatContainer.classList.toggle('hidden');
        });
    }
    
    // Socket event handlers
    chatSocket.on('connect', () => {
        console.log('Connected to chat server');
    });
    
    chatSocket.on('user:connected', (data) => {
        currentUser = data;
        console.log('User connected:', data);
    });
    
    chatSocket.on('chat:messages', (messages) => {
        displayMessages(messages);
    });
    
    chatSocket.on('chat:message', (message) => {
        addMessage(message);
    });
    
    chatSocket.on('error', (data) => {
        addSystemMessage(`Error: ${data.message}`, 'error');
    });
    
    chatSocket.on('disconnect', () => {
        addSystemMessage('Disconnected from chat server', 'error');
    });
    
    // Helper functions
    function displayMessages(messages) {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        messages.forEach(message => addMessage(message));
    }
    
    function addMessage(message) {
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-2';
        
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
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function addSystemMessage(message, type = 'info') {
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-2 text-center';
        
        const colorClass = type === 'error' ? 'text-red-400' : 'text-gray-400';
        
        messageDiv.innerHTML = `
            <div class="text-xs ${colorClass} italic">${escapeHtml(message)}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize battle graphics with P5.js
async function initializeBattleGraphics(serverMatchInfo) {
    try {
        // Import P5BattleGraphicsMultiplayer
        const graphicsModule = await import('./p5-battle-sketch-multiplayer.js');
        const P5BattleGraphicsMultiplayer = graphicsModule.default;
        
        console.log('Initializing battle graphics with server matchInfo:', serverMatchInfo);
        console.log('Current user:', currentUser);
        
        // Use matchInfo from server instead of creating our own
        const matchInfo = serverMatchInfo || {
            matchId: currentMatch.matchId || currentMatch.id,
            matchName: currentMatch.matchName || currentMatch.name,
            team1: {
                teamId: 'blue',
                teamName: 'Blue Team',
                units: []
            },
            team2: {
                teamId: 'red',
                teamName: 'Red Team',
                units: []
            }
        };
        
        console.log('Using matchInfo:', matchInfo);
        
        // Initialize graphics with player perspective
        battleGraphics = new P5BattleGraphicsMultiplayer(
            matchInfo, 
            gameSocket, 
            currentUser.userId,
            currentUser.teamId // Pass player's team for perspective
        );
        
        console.log('Battle graphics initialized successfully');
        
    } catch (error) {
        console.error('Error initializing battle graphics:', error);
        // Fallback to placeholder
        showPlaceholderCanvas();
    }
}

// Handle game action results from server
function handleGameActionResult(data) {
    console.log('Handling game action result:', data);
    
    // Update game state
    if (data.gameState) {
        gameState = data.gameState;
        if (battleGraphics) {
            battleGraphics.updateGameState(data.gameState);
        }
    }
    
    // Add to game log
    const actionText = getActionText(data.action, data.actionData, data.playerId);
    addGameLog(actionText);
    
    // If game ended, show game over modal
    if (data.gameEnded) {
        showGameOverModal(data);
    }
}

// Get human-readable action text
function getActionText(action, actionData, playerId) {
    const playerName = playerId === currentUser.userId ? 'You' : 'Opponent';
    
    switch (action) {
        case 'move_unit':
            return `${playerName} moved unit to (${actionData.row}, ${actionData.col})`;
        case 'attack':
            return `${playerName} attacked target`;
        case 'heal':
            return `${playerName} healed target`;
        case 'sacrifice':
            return `${playerName} sacrificed unit`;
        case 'suicide':
            return `${playerName} used suicide attack`;
        case 'end_turn':
            return `${playerName} ended turn`;
        default:
            return `${playerName} performed ${action}`;
    }
}

// Fallback placeholder canvas
function showPlaceholderCanvas() {
    const canvasContainer = document.getElementById('game-canvas-container');
    canvasContainer.innerHTML = `
        <div class="w-96 h-96 bg-gray-700 rounded-lg flex items-center justify-center">
            <div class="text-center text-gray-400">
                <div class="text-2xl mb-2">🎮</div>
                <div>Game Board</div>
                <div class="text-sm mt-2">Loading game graphics...</div>
            </div>
        </div>
    `;
}

// Initialize collapsible panels
function initializeCollapsiblePanels() {
    // Game log toggle
    const toggleGameLogBtn = document.getElementById('toggle-game-log');
    const gameLogContainer = document.getElementById('game-log-container');
    const gameLogChevron = document.getElementById('game-log-chevron');
    
    if (toggleGameLogBtn && gameLogContainer) {
        toggleGameLogBtn.addEventListener('click', () => {
            gameLogContainer.classList.toggle('hidden');
            gameLogChevron.classList.toggle('rotate-180');
        });
    }
    
    // Chat panel dragging functionality
    initializeChatDragging();
}

// Initialize chat panel dragging
function initializeChatDragging() {
    const chatPanel = document.getElementById('chat-panel');
    if (!chatPanel) return;
    
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    chatPanel.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
        if (e.target.closest('button')) return; // Don't drag if clicking buttons
        
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        
        if (e.target === chatPanel || chatPanel.contains(e.target)) {
            isDragging = true;
        }
    }
    
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            xOffset = currentX;
            yOffset = currentY;
            
            chatPanel.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }
    }
    
    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }
}

// Initialize event handlers
function initializeEventHandlers() {
    // Leave game button
    const leaveGameBtn = document.getElementById('leave-game-btn');
    if (leaveGameBtn) {
        leaveGameBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to leave the game?')) {
                window.location.href = 'index.html';
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
}

// Update match info
function updateMatchInfo() {
    const matchInfo = document.getElementById('match-info');
    if (currentMatch && currentUser) {
        const opponent = gameState.players.find(p => p.userId !== currentUser.userId);
        matchInfo.innerHTML = `
            <div>Match: ${currentMatch.matchName}</div>
            <div>vs ${opponent?.username || 'Opponent'}</div>
        `;
    }
}


// Add game log entry
function addGameLog(message) {
    const gameLog = document.getElementById('game-log');
    const logEntry = document.createElement('div');
    logEntry.className = 'text-gray-300 text-xs';
    
    const time = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span class="text-gray-500">[${time}]</span> ${message}`;
    
    gameLog.appendChild(logEntry);
    gameLog.scrollTop = gameLog.scrollHeight;
    
    // Keep only last 50 log entries
    while (gameLog.children.length > 50) {
        gameLog.removeChild(gameLog.firstChild);
    }
}

// Get player name by ID
function getPlayerName(playerId) {
    if (!gameState || !gameState.players) return 'Unknown';
    const player = gameState.players.find(p => p.userId === playerId);
    return player ? player.username : 'Unknown';
}

// Show game over modal
function showGameOverModal(data) {
    const modal = document.getElementById('game-over-modal');
    const gameResult = document.getElementById('game-result');
    
    if (data.winner) {
        const isWinner = data.winner.userId === currentUser?.userId;
        gameResult.innerHTML = `
            <div class="text-2xl font-bold ${isWinner ? 'text-green-400' : 'text-red-400'} mb-2">
                ${isWinner ? 'You Won!' : 'You Lost!'}
            </div>
            <div class="text-gray-300">
                ${data.winner.username} is the winner!
            </div>
        `;
    } else {
        gameResult.innerHTML = `
            <div class="text-2xl font-bold text-yellow-400 mb-2">Draw!</div>
            <div class="text-gray-300">The game ended in a draw</div>
        `;
    }
    
    modal.classList.remove('hidden');
}
