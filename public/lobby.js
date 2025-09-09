// Lobby functionality
let lobbySocket = null;
let chatSocket = null;
let currentUser = null;
let currentMatch = null;
let selectedHero = null;
let selectedUnits = [];
let isReady = false;

// Available heroes and units data
const heroes = [
    { type: 'ara', name: 'Ara', image: 'imgs/heroes/ara_blue.png' },
    { type: 'nizza', name: 'Nizza', image: 'imgs/heroes/nizza_blue.png' },
    { type: 'taki', name: 'Taki', image: 'imgs/heroes/taki_blue.png' },
    { type: 'trarex', name: 'Trarex', image: 'imgs/heroes/trarex_blue.png' },
    { type: 'trezdin', name: 'Trezdin', image: 'imgs/heroes/trezdin_blue.png' },
    { type: 'wizzi', name: 'Wizzi', image: 'imgs/heroes/wizzi_blue.png' }
];

const units = [
    { type: 'assassin', name: 'Assassin', image: 'imgs/assassin_blue.png' },
    { type: 'ranger', name: 'Ranger', image: 'imgs/ranger_blue.png' },
    { type: 'tanker', name: 'Tanker', image: 'imgs/tanker_blue.png' }
];

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

    // Initialize lobby functionality
    initializeLobby(matchId);
    
    // Initialize chat functionality
    initializeChat();
    
    // Initialize team selection
    initializeTeamSelection();
    
    // Initialize UI event handlers
    initializeEventHandlers();
});

// Initialize lobby
function initializeLobby(matchId) {
    console.log('Initializing lobby for match:', matchId);
    
    // Get user info from localStorage (set when creating/joining match)
    const lobbyUserData = localStorage.getItem('lobbyUser');
    if (!lobbyUserData) {
        alert('No user data found. Please go back to main menu.');
        window.location.href = 'index.html';
        return;
    }
    
    const lobbyUser = JSON.parse(lobbyUserData);
    console.log('Lobby user data:', lobbyUser);
    
    // Connect to lobby namespace
    lobbySocket = io('/lobby');
    
    // Lobby socket event handlers
    lobbySocket.on('connect', () => {
        console.log('Connected to lobby server');
        
        // Authenticate with lobby using stored user data
        authenticateWithLobby(lobbyUser);
    });
    
    lobbySocket.on('lobby:authenticated', (data) => {
        console.log('Authenticated with lobby:', data);
        // Now join the lobby
        lobbySocket.emit('lobby:join', { matchId: matchId });
    });
    
    lobbySocket.on('lobby:joined', (data) => {
        console.log('Joined lobby:', data);
        currentMatch = data.match;
        updateMatchInfo();
        updatePlayersStatus(data.match.players);
    });
    
    lobbySocket.on('lobby:player_joined', (data) => {
        console.log('Player joined:', data);
        updatePlayersStatus(data.players);
    });
    
    lobbySocket.on('lobby:player_left', (data) => {
        console.log('Player left:', data);
        // Refresh match info
        lobbySocket.emit('lobby:get_info', { matchId: matchId });
    });
    
    lobbySocket.on('lobby:player_team_updated', (data) => {
        console.log('Player team updated:', data);
        updatePlayersStatus(data.players);
    });
    
    lobbySocket.on('lobby:player_ready_updated', (data) => {
        console.log('Player ready updated:', data);
        updatePlayersStatus(data.players);
    });
    
    lobbySocket.on('lobby:team_updated', (data) => {
        console.log('Team updated:', data);
        updatePlayersStatus(data.players);
    });
    
    lobbySocket.on('lobby:ready_updated', (data) => {
        console.log('Ready status updated:', data);
        updatePlayersStatus(data.players);
    });
    
    lobbySocket.on('lobby:match_ready', (data) => {
        console.log('Match is ready:', data);
        showLoadingScreen();
        
        // Redirect to game after a delay
        setTimeout(() => {
            window.location.href = `play.html?matchId=${matchId}`;
        }, 3000);
    });
    
    lobbySocket.on('lobby:match_info', (data) => {
        console.log('Match info received:', data);
        currentMatch = data.match;
        currentUser = data.currentPlayer;
        updateMatchInfo();
        updatePlayersStatus(data.match.players);
    });
    
    lobbySocket.on('error', (data) => {
        console.error('Lobby error:', data);
        alert(`Error: ${data.message}`);
    });
    
    lobbySocket.on('disconnect', () => {
        console.log('Disconnected from lobby server');
        alert('Disconnected from lobby server');
    });
}

// Authenticate with lobby namespace
function authenticateWithLobby(lobbyUser) {
    if (lobbyUser && lobbySocket) {
        lobbySocket.emit('lobby:authenticate', {
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
    const onlineCount = document.getElementById('online-count');
    const toggleChat = document.getElementById('toggle-chat');
    
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
            const chatContainer = document.getElementById('chat-container');
            chatContainer.classList.toggle('hidden');
        });
    }
    
    // Socket event handlers
    chatSocket.on('connect', () => {
        console.log('Connected to chat server');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="text-center text-green-500 text-sm">Connected to chat server</div>';
        }
    });
    
    chatSocket.on('user:connected', (data) => {
        currentUser = data;
        console.log('User connected:', data);
        if (onlineCount) {
            updateOnlineCount(data.onlineUsers.length);
        }
    });
    
    chatSocket.on('chat:messages', (messages) => {
        displayMessages(messages);
    });
    
    chatSocket.on('chat:message', (message) => {
        addMessage(message);
    });
    
    chatSocket.on('user:joined', (data) => {
        addSystemMessage(`${data.username} joined the chat`);
        if (onlineCount) {
            updateOnlineCount(data.onlineUsers.length);
        }
    });
    
    chatSocket.on('user:left', (data) => {
        addSystemMessage(`${data.username} left the chat`);
        if (onlineCount) {
            updateOnlineCount(data.onlineUsers.length);
        }
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
    
    function updateOnlineCount(count) {
        if (onlineCount) {
            onlineCount.textContent = `Online: ${count}`;
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize team selection
function initializeTeamSelection() {
    console.log('Initializing team selection...');
    
    // Populate hero selection
    const heroSelection = document.getElementById('hero-selection');
    heroes.forEach(hero => {
        const heroCard = createHeroCard(hero);
        heroSelection.appendChild(heroCard);
    });
    
    // Populate units selection
    const unitsSelection = document.getElementById('units-selection');
    units.forEach(unit => {
        const unitCard = createUnitCard(unit);
        unitsSelection.appendChild(unitCard);
    });
}

// Create hero card
function createHeroCard(hero) {
    const card = document.createElement('div');
    card.className = 'bg-gray-700 hover:bg-gray-600 rounded-lg p-3 cursor-pointer transition-colors border-2 border-transparent hover:border-blue-500';
    card.dataset.heroType = hero.type;
    
    card.innerHTML = `
        <div class="text-center">
            <img src="${hero.image}" alt="${hero.name}" class="w-16 h-16 mx-auto mb-2 rounded">
            <div class="text-sm font-medium text-white">${hero.name}</div>
        </div>
    `;
    
    card.addEventListener('click', () => selectHero(hero, card));
    
    return card;
}

// Create unit card
function createUnitCard(unit) {
    const card = document.createElement('div');
    card.className = 'bg-gray-700 hover:bg-gray-600 rounded-lg p-3 cursor-pointer transition-colors border-2 border-transparent hover:border-blue-500';
    card.dataset.unitType = unit.type;
    
    card.innerHTML = `
        <div class="text-center">
            <img src="${unit.image}" alt="${unit.name}" class="w-12 h-12 mx-auto mb-2 rounded">
            <div class="text-xs font-medium text-white">${unit.name}</div>
        </div>
    `;
    
    card.addEventListener('click', () => selectUnit(unit, card));
    
    return card;
}

// Select hero
function selectHero(hero, card) {
    // Remove previous selection
    const previousSelected = document.querySelector('.hero-selected');
    if (previousSelected) {
        previousSelected.classList.remove('hero-selected', 'border-blue-500', 'bg-blue-600');
        previousSelected.classList.add('border-transparent', 'bg-gray-700');
    }
    
    // Select new hero
    card.classList.add('hero-selected', 'border-blue-500', 'bg-blue-600');
    card.classList.remove('border-transparent', 'bg-gray-700');
    
    selectedHero = hero;
    
    // Show selected hero
    const heroSelected = document.getElementById('hero-selected');
    heroSelected.innerHTML = `
        <div class="flex items-center space-x-3">
            <img src="${hero.image}" alt="${hero.name}" class="w-12 h-12 rounded">
            <div>
                <div class="font-medium text-white">${hero.name}</div>
                <div class="text-sm text-blue-200">Hero Selected</div>
            </div>
        </div>
    `;
    heroSelected.classList.remove('hidden');
    
    updateReadyButton();
}

// Select unit
function selectUnit(unit, card) {
    if (selectedUnits.length >= 5) {
        // Remove first unit if we have 5
        const firstUnit = selectedUnits[0];
        const firstCard = document.querySelector(`[data-unit-type="${firstUnit.type}"]`);
        if (firstCard) {
            firstCard.classList.remove('unit-selected', 'border-blue-500', 'bg-blue-600');
            firstCard.classList.add('border-transparent', 'bg-gray-700');
        }
        selectedUnits.shift();
    }
    
    // Add new unit
    selectedUnits.push(unit);
    card.classList.add('unit-selected', 'border-blue-500', 'bg-blue-600');
    card.classList.remove('border-transparent', 'bg-gray-700');
    
    updateUnitsDisplay();
    updateReadyButton();
}

// Update units display
function updateUnitsDisplay() {
    const unitsSelected = document.getElementById('units-selected');
    const unitCounter = document.getElementById('unit-counter');
    
    unitsSelected.innerHTML = '';
    selectedUnits.forEach(unit => {
        const unitDiv = document.createElement('div');
        unitDiv.className = 'bg-blue-800 rounded p-2 text-center';
        unitDiv.innerHTML = `
            <img src="${unit.image}" alt="${unit.name}" class="w-8 h-8 mx-auto mb-1 rounded">
            <div class="text-xs text-white">${unit.name}</div>
        `;
        unitsSelected.appendChild(unitDiv);
    });
    
    unitCounter.textContent = `(${selectedUnits.length}/5)`;
}

// Update ready button
function updateReadyButton() {
    const readyBtn = document.getElementById('ready-btn');
    const canReady = selectedHero && selectedUnits.length === 5;
    
    readyBtn.disabled = !canReady;
    
    if (canReady && !isReady) {
        readyBtn.textContent = 'Ready';
        readyBtn.className = 'bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors';
    } else if (isReady) {
        readyBtn.textContent = 'Not Ready';
        readyBtn.className = 'bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors';
    } else {
        readyBtn.textContent = 'Select Team First';
        readyBtn.className = 'bg-gray-600 cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors';
    }
}

// Initialize event handlers
function initializeEventHandlers() {
    // Ready button
    const readyBtn = document.getElementById('ready-btn');
    readyBtn.addEventListener('click', () => {
        if (!selectedHero || selectedUnits.length !== 5) {
            alert('Please select a hero and 5 units first');
            return;
        }
        
        const teamData = {
            hero: selectedHero,
            units: selectedUnits
        };
        
        // Send team selection first
        lobbySocket.emit('lobby:select_team', {
            matchId: currentMatch.id,
            teamData: teamData
        });
        
        // Then toggle ready status
        isReady = !isReady;
        lobbySocket.emit('lobby:ready', {
            matchId: currentMatch.id,
            isReady: isReady
        });
        
        updateReadyButton();
    });
    
    // Back to main menu
    const backBtn = document.getElementById('back-to-main');
    backBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the lobby?')) {
            window.location.href = 'index.html';
        }
    });
}

// Update match info
function updateMatchInfo() {
    const matchInfo = document.getElementById('match-info');
    if (currentMatch) {
        matchInfo.innerHTML = `
            <div class="text-lg font-semibold">${currentMatch.name}</div>
            <div class="text-sm text-gray-400">Status: ${currentMatch.status}</div>
        `;
    }
}

// Update players status
function updatePlayersStatus(players) {
    const playersStatus = document.getElementById('players-status');
    playersStatus.innerHTML = '';
    
    players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'bg-gray-700 rounded-lg p-4';
        
        const isCurrentUser = player.userId === currentUser?.userId;
        const statusClass = isCurrentUser ? 'border-blue-500' : 'border-gray-600';
        
        playerDiv.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-white">${player.username}</div>
                <div class="flex items-center space-x-2">
                    ${player.isCreator ? '<span class="bg-yellow-600 text-yellow-100 px-2 py-1 rounded text-xs">Creator</span>' : ''}
                    ${isCurrentUser ? '<span class="bg-blue-600 text-blue-100 px-2 py-1 rounded text-xs">You</span>' : ''}
                </div>
            </div>
            <div class="space-y-1">
                <div class="text-sm text-gray-300">
                    Team: ${player.hasTeam ? 'Selected' : 'Not Selected'}
                </div>
                <div class="text-sm text-gray-300">
                    Ready: ${player.isReady ? '<span class="text-green-400">Yes</span>' : '<span class="text-red-400">No</span>'}
                </div>
            </div>
        `;
        
        playerDiv.classList.add('border-2', statusClass);
        playersStatus.appendChild(playerDiv);
    });
}

// Show loading screen
function showLoadingScreen() {
    const lobbyScreen = document.getElementById('lobby-screen');
    const loadingScreen = document.getElementById('loading-screen');
    
    lobbyScreen.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
}
