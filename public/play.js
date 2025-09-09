// Game functionality
let gameSocket = null;
let chatSocket = null;
let currentUser = null;
let currentMatch = null;
let gameState = null;
let selectedUnit = null;
let currentAction = null; // 'move', 'attack', null
let gameCanvas = null;

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
    
    // Initialize game canvas
    initializeGameCanvas();
});

// Initialize game
function initializeGame(matchId) {
    console.log('Initializing game for match:', matchId);
    
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
        // Now join the game
        gameSocket.emit('game:join', { matchId: matchId });
    });
    
    gameSocket.on('game:joined', (data) => {
        console.log('Joined game:', data);
        currentMatch = data;
        gameState = data.gameState;
        currentUser = data.playerInfo;
        
        updateMatchInfo();
        updatePlayersInfo();
        updateTurnInfo();
        renderGameBoard();
    });
    
    gameSocket.on('game:player_joined', (data) => {
        console.log('Player joined game:', data);
        addGameLog(`${data.username} joined the game`);
    });
    
    gameSocket.on('game:player_left', (data) => {
        console.log('Player left game:', data);
        addGameLog(`${data.username} left the game`);
    });
    
    gameSocket.on('game:action', (data) => {
        console.log('Game action received:', data);
        handleGameAction(data);
    });
    
    gameSocket.on('game:state', (data) => {
        console.log('Game state received:', data);
        gameState = data.gameState;
        updateTurnInfo();
        renderGameBoard();
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

// Initialize game canvas
function initializeGameCanvas() {
    // This would integrate with your existing p5.js game logic
    // For now, create a placeholder canvas
    const canvasContainer = document.getElementById('game-canvas-container');
    
    // Create a simple placeholder for the game board
    const placeholder = document.createElement('div');
    placeholder.className = 'w-96 h-96 bg-gray-700 rounded-lg flex items-center justify-center';
    placeholder.innerHTML = `
        <div class="text-center text-gray-400">
            <div class="text-2xl mb-2">🎮</div>
            <div>Game Board</div>
            <div class="text-sm mt-2">Click on units to select them</div>
        </div>
    `;
    
    canvasContainer.appendChild(placeholder);
    
    // Add click handler for unit selection (placeholder)
    placeholder.addEventListener('click', (e) => {
        if (gameState && gameState.currentPlayer === currentUser?.userId) {
            // Simulate unit selection
            selectUnit({
                id: 'unit_1',
                type: 'assassin',
                position: { x: 1, y: 1 },
                health: 50,
                maxHealth: 50
            });
        }
    });
}

// Initialize event handlers
function initializeEventHandlers() {
    // End turn button
    const endTurnBtn = document.getElementById('end-turn-btn');
    endTurnBtn.addEventListener('click', () => {
        if (gameState && gameState.currentPlayer === currentUser?.userId) {
            gameSocket.emit('game:action', {
                matchId: currentMatch.matchId,
                action: 'end_turn',
                actionData: {}
            });
        }
    });
    
    // Leave game button
    const leaveGameBtn = document.getElementById('leave-game-btn');
    leaveGameBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the game?')) {
            window.location.href = 'index.html';
        }
    });
    
    // Game action buttons
    const moveBtn = document.getElementById('move-btn');
    const attackBtn = document.getElementById('attack-btn');
    const cancelActionBtn = document.getElementById('cancel-action-btn');
    
    moveBtn.addEventListener('click', () => {
        if (selectedUnit && gameState.currentPlayer === currentUser?.userId) {
            currentAction = 'move';
            updateActionButtons();
        }
    });
    
    attackBtn.addEventListener('click', () => {
        if (selectedUnit && gameState.currentPlayer === currentUser?.userId) {
            currentAction = 'attack';
            updateActionButtons();
        }
    });
    
    cancelActionBtn.addEventListener('click', () => {
        currentAction = null;
        updateActionButtons();
    });
    
    // Game over modal buttons
    const playAgainBtn = document.getElementById('play-again-btn');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    
    playAgainBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    backToMainBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// Handle game action from server
function handleGameAction(data) {
    const { action, actionData, playerId, result, gameState: newGameState } = data;
    
    // Update game state
    gameState = newGameState;
    
    // Add to game log
    addGameLog(`${getPlayerName(playerId)} performed ${action}`);
    
    // Update UI
    updateTurnInfo();
    updatePlayersInfo();
    renderGameBoard();
    
    // Clear selection if it's not the current player's turn
    if (gameState.currentPlayer !== currentUser?.userId) {
        selectedUnit = null;
        currentAction = null;
        updateSelectedUnitInfo();
        updateActionButtons();
    }
}

// Select unit
function selectUnit(unit) {
    if (gameState.currentPlayer !== currentUser?.userId) {
        return; // Not your turn
    }
    
    selectedUnit = unit;
    currentAction = null;
    updateSelectedUnitInfo();
    updateActionButtons();
    
    addGameLog(`Selected ${unit.type} at position (${unit.position.x}, ${unit.position.y})`);
}

// Update match info
function updateMatchInfo() {
    const matchInfo = document.getElementById('match-info');
    if (currentMatch) {
        matchInfo.innerHTML = `
            <div>Match: ${currentMatch.matchName}</div>
            <div>Turn: ${gameState?.turnNumber || 1}</div>
        `;
    }
}

// Update players info
function updatePlayersInfo() {
    const playersInfo = document.getElementById('players-info');
    if (!gameState) return;
    
    playersInfo.innerHTML = '';
    
    gameState.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'bg-gray-700 rounded-lg p-3';
        
        const isCurrentPlayer = player.userId === gameState.currentPlayer;
        const isCurrentUser = player.userId === currentUser?.userId;
        
        if (isCurrentPlayer) {
            playerDiv.classList.add('border-2', 'border-yellow-400');
        } else if (isCurrentUser) {
            playerDiv.classList.add('border-2', 'border-blue-400');
        }
        
        const aliveUnits = player.units.filter(unit => unit.isAlive).length;
        const totalUnits = player.units.length;
        
        playerDiv.innerHTML = `
            <div class="font-medium text-white">${player.username}</div>
            <div class="text-sm text-gray-300">
                Units: ${aliveUnits}/${totalUnits}
            </div>
            <div class="text-sm text-gray-300">
                ${isCurrentPlayer ? 'Current Turn' : ''}
                ${isCurrentUser ? ' (You)' : ''}
            </div>
        `;
        
        playersInfo.appendChild(playerDiv);
    });
}

// Update turn info
function updateTurnInfo() {
    const turnInfo = document.getElementById('turn-info');
    const endTurnBtn = document.getElementById('end-turn-btn');
    
    if (!gameState) return;
    
    const isMyTurn = gameState.currentPlayer === currentUser?.userId;
    const currentPlayer = gameState.players.find(p => p.userId === gameState.currentPlayer);
    
    turnInfo.innerHTML = `
        <div>Turn ${gameState.turnNumber}</div>
        <div>${isMyTurn ? 'Your Turn' : `${currentPlayer?.username}'s Turn`}</div>
    `;
    
    endTurnBtn.disabled = !isMyTurn;
}

// Update selected unit info
function updateSelectedUnitInfo() {
    const selectedUnitInfo = document.getElementById('selected-unit-info');
    
    if (!selectedUnit) {
        selectedUnitInfo.innerHTML = 'No unit selected';
        return;
    }
    
    selectedUnitInfo.innerHTML = `
        <div class="bg-gray-700 rounded-lg p-3">
            <div class="font-medium text-white">${selectedUnit.type}</div>
            <div class="text-sm text-gray-300">
                Health: ${selectedUnit.health}/${selectedUnit.maxHealth}
            </div>
            <div class="text-sm text-gray-300">
                Position: (${selectedUnit.position.x}, ${selectedUnit.position.y})
            </div>
        </div>
    `;
}

// Update action buttons
function updateActionButtons() {
    const moveBtn = document.getElementById('move-btn');
    const attackBtn = document.getElementById('attack-btn');
    const cancelActionBtn = document.getElementById('cancel-action-btn');
    
    const canAct = selectedUnit && gameState.currentPlayer === currentUser?.userId;
    
    moveBtn.disabled = !canAct;
    attackBtn.disabled = !canAct;
    cancelActionBtn.disabled = !currentAction;
    
    if (currentAction === 'move') {
        moveBtn.classList.add('bg-green-500');
        moveBtn.classList.remove('bg-green-600');
    } else {
        moveBtn.classList.remove('bg-green-500');
        moveBtn.classList.add('bg-green-600');
    }
    
    if (currentAction === 'attack') {
        attackBtn.classList.add('bg-red-500');
        attackBtn.classList.remove('bg-red-600');
    } else {
        attackBtn.classList.remove('bg-red-500');
        attackBtn.classList.add('bg-red-600');
    }
}

// Render game board
function renderGameBoard() {
    // This would integrate with your existing p5.js game logic
    // For now, just update the placeholder
    console.log('Rendering game board with state:', gameState);
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
    if (!gameState) return 'Unknown';
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
