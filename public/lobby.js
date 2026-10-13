// Lobby functionality
let lobbySocket = null;
let chatSocket = null;
let currentUser = null;
let currentMatch = null;
let selectedHero = null;
let selectedUnits = [];
let isReady = false;
let currentPlayers = []; // Track current players in lobby

// Import unit definitions
import { UNIT_TYPES } from '../core-logic/definitions.js';
import { t, initI18n } from './i18n.js';

// Available heroes and units data (using definitions.js)
const heroes = [
    { 
        type: 'ara', 
        name: 'Ara', 
        image: 'imgs/heroes/ara_blue.png',
        biography: 'Ara is a skilled warrior with exceptional combat abilities. Known for her agility and precision, she excels in close combat situations and can quickly adapt to changing battlefield conditions.'
    },
    { 
        type: 'nizza', 
        name: 'Nizza', 
        image: 'imgs/heroes/nizza_blue.png',
        biography: 'Nizza is a master tactician with deep knowledge of battlefield strategy. Her analytical mind allows her to predict enemy movements and coordinate team efforts with unmatched efficiency.'
    },
    { 
        type: 'taki', 
        name: 'Taki', 
        image: 'imgs/heroes/taki_blue.png',
        biography: 'Taki is a mysterious figure with ancient powers. Her connection to the mystical arts gives her unique abilities that can turn the tide of battle in unexpected ways.'
    },
    { 
        type: 'trarex', 
        name: 'Trarex', 
        image: 'imgs/heroes/trarex_blue.png',
        biography: 'Trarex is a seasoned veteran with years of battlefield experience. His leadership skills and defensive capabilities make him an invaluable asset in protecting his team.'
    },
    { 
        type: 'trezdin', 
        name: 'Trezdin', 
        image: 'imgs/heroes/trezdin_blue.png',
        biography: 'Trezdin is a powerful mage with control over elemental forces. His magical abilities can devastate enemy formations and provide crucial support to his allies.'
    },
    { 
        type: 'wizzi', 
        name: 'Wizzi', 
        image: 'imgs/heroes/wizzi_blue.png',
        biography: 'Wizzi is a brilliant inventor and engineer. His technological expertise allows him to create powerful devices and modify the battlefield to his advantage.'
    }
];

const units = [
    { 
        type: 'assassin', 
        name: 'Assassin', 
        image: 'imgs/assassin_blue.png'
    },
    { 
        type: 'ranger', 
        name: 'Ranger', 
        image: 'imgs/ranger_blue.png'
    },
    { 
        type: 'tanker', 
        name: 'Tanker', 
        image: 'imgs/tanker_blue.png'
    }
];

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initI18n();
    window.addEventListener('sc:lang', () => {
        updateReadyButton();
        updateMatchInfo();
        if (currentPlayers.length) updatePlayersStatus(currentPlayers);
        document.querySelectorAll('#units-selected [data-slot-index]').forEach(slot => {
            if (slot.textContent.includes('Empty') || slot.querySelector('span.text-gray-400')) {
                const empty = slot.querySelector('span.text-gray-400');
                if (empty) empty.textContent = t('lobby.empty');
            }
        });
    });
    // Get match ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('matchId');
    
    if (!matchId) {
        alert(t('lobby.noMatch'));
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
        alert(t('lobby.noUser'));
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
        console.log('Match is ready - starting multiplayer game:', data);
        console.log('Current match:', currentMatch);
        showLoadingScreen();
        
        // Redirect to multiplayer game immediately
        setTimeout(() => {
            const matchId = currentMatch?.id || data.matchId;
            console.log('Redirecting to multiplayer game with matchId:', matchId);
            window.location.href = `play.html?matchId=${matchId}`;
        }, 2000); // Reduced delay for better UX
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
        alert(t('chat.error', { msg: data.message }));
    });
    
    lobbySocket.on('disconnect', () => {
        console.log('Disconnected from lobby server');
        alert(t('lobby.disconnected'));
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
            chatMessages.innerHTML = `<div class="text-center text-green-500 text-sm">${t('chat.connected')}</div>`;
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
            onlineCount.textContent = t('home.online', { n: count });
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
    
    // Initialize 5 empty unit slots
    initializeUnitSlots();
}

// Create hero card
function createHeroCard(hero) {
    const card = document.createElement('div');
    card.className = 'pick-card bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-all duration-200 border-2 border-transparent hover:border-blue-500';
    card.dataset.heroType = hero.type;
    
    // Get stats from UNIT_TYPES
    const unitDef = UNIT_TYPES[hero.name];
    const stats = {
        hp: unitDef.hp,
        speed: unitDef.speed,
        range: unitDef.range,
        magicRange: unitDef.magicRange
    };
    
    const magic = stats.magicRange > 0
        ? `<span><span class="text-purple-400">🔮</span><span class="text-purple-400">${stats.magicRange}</span></span>`
        : '';
    card.innerHTML = `
        <div class="text-center">
            <img src="${hero.image}" alt="${hero.name}">
            <div class="pick-name text-white">${hero.name}</div>
            <div class="pick-stats text-gray-300">
                <span><span class="text-red-400">❤</span><span class="text-red-400">${stats.hp}</span></span>
                <span><span class="text-yellow-400">🦵</span><span class="text-yellow-400">${stats.speed}</span></span>
                <span><span class="text-orange-400">⚔</span><span class="text-orange-400">${stats.range}</span></span>
                ${magic}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => selectHero(hero, card));
    
    return card;
}

// Create unit card
function createUnitCard(unit) {
    const card = document.createElement('div');
    card.className = 'pick-card bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors border-2 border-transparent hover:border-blue-500';
    card.dataset.unitType = unit.type;
    
    // Get stats from UNIT_TYPES
    const unitDef = UNIT_TYPES[unit.name];
    const stats = {
        hp: unitDef.hp,
        speed: unitDef.speed,
        range: unitDef.range,
        magicRange: unitDef.magicRange
    };
    
    const magic = stats.magicRange > 0
        ? `<span><span class="text-purple-400">🔮</span><span class="text-purple-400">${stats.magicRange}</span></span>`
        : '';
    card.innerHTML = `
        <div class="text-center">
            <img src="${unit.image}" alt="${unit.name}">
            <div class="pick-name text-white">${unit.name}</div>
            <div class="pick-stats text-gray-300">
                <span><span class="text-red-400">❤</span><span class="text-red-400">${stats.hp}</span></span>
                <span><span class="text-yellow-400">🦵</span><span class="text-yellow-400">${stats.speed}</span></span>
                <span><span class="text-orange-400">⚔</span><span class="text-orange-400">${stats.range}</span></span>
                ${magic}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => selectUnit(unit, card));
    
    return card;
}

// Initialize unit slots
function initializeUnitSlots() {
    const unitsSelected = document.getElementById('units-selected');
    unitsSelected.innerHTML = '';
    
    // Create 5 empty slots
    for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'bg-gray-600 rounded border-2 border-dashed border-gray-500 h-16 flex items-center justify-center';
        slot.dataset.slotIndex = i;
        slot.innerHTML = `<span class="text-gray-400 text-xs">${t('lobby.empty')}</span>`;
        unitsSelected.appendChild(slot);
    }
}

// Select hero
function selectHero(hero, card) {
    // Remove previous selection
    const previousSelected = document.querySelector('.hero-selected');
    if (previousSelected) {
        previousSelected.classList.remove('hero-selected', 'border-blue-500', 'bg-blue-600');
        previousSelected.classList.add('border-transparent', 'bg-gray-700');
        // Reset inline styles for mobile compatibility
        previousSelected.style.borderColor = '';
        previousSelected.style.backgroundColor = '';
    }
    
    // Select new hero with more specific classes
    card.classList.add('hero-selected');
    card.classList.remove('border-transparent', 'bg-gray-700');
    card.classList.add('border-blue-500', 'bg-blue-600');
    
    // Force style update for mobile compatibility
    card.style.borderColor = '#3B82F6';
    card.style.backgroundColor = '#2563EB';
    
    selectedHero = hero;
    const picked = document.getElementById('hero-picked');
    if (picked && UNIT_TYPES[hero.name]) {
        const def = UNIT_TYPES[hero.name];
        picked.innerHTML = `
            <div class="flex items-center gap-3 bg-gray-900/60 rounded p-2 border border-blue-500">
                <img src="${hero.image}" alt="" class="w-14 h-14">
                <div>
                    <div class="font-bold">${hero.name}</div>
                    <div class="text-xs text-gray-300 mt-0.5">HP ${def.hp} · Speed ${def.speed} · Range ${def.range}</div>
                </div>
            </div>
        `;
    }

    updateMovementPointDisplay();
    updateReadyButton();
}

// Select unit
function selectUnit(unit, card) {
    // Check if we already have 5 units
    if (selectedUnits.length >= 5) {
        return;
    }
    
    // Add unit to selectedUnits array
    selectedUnits.push(unit);
    
    // Find the next available slot index (should be selectedUnits.length - 1)
    const slotIndex = selectedUnits.length - 1;
    
    // Fill the slot
    fillUnitSlot(slotIndex, unit);
    
    // Update unit counter
    updateUnitCounter();
    updateMovementPointDisplay();
    updateReadyButton();
}

// Fill unit slot
function fillUnitSlot(slotIndex, unit) {
    const slot = document.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (!slot) return;
    
    slot.classList.add('filled');
    slot.classList.remove('border-dashed', 'border-gray-500');
    slot.classList.add('border-solid', 'border-blue-500', 'bg-blue-800');
    
    slot.innerHTML = `
        <div class="relative w-full h-full flex flex-col items-center justify-center p-1">
            <button class="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold flex items-center justify-center remove-unit-btn" 
                    data-slot-index="${slotIndex}" title="Remove unit">
                ×
            </button>
            <img src="${unit.image}" alt="${unit.name}" class="w-8 h-8 mb-1 rounded">
            <div class="text-xs text-white text-center font-medium">${unit.name}</div>
        </div>
    `;
    
    // Add event listener to the remove button
    const removeBtn = slot.querySelector('.remove-unit-btn');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeUnitFromSlot(slotIndex);
    });
}

// Remove unit from slot
function removeUnitFromSlot(slotIndex) {
    // Remove from selectedUnits array at the correct position
    if (slotIndex >= 0 && slotIndex < selectedUnits.length) {
        selectedUnits.splice(slotIndex, 1);
    }
    
    // Reorganize all slots
    reorganizeUnitSlots();
    updateUnitCounter();
    updateMovementPointDisplay();
    updateReadyButton();
}

// Reorganize unit slots after removal
function reorganizeUnitSlots() {
    // Clear all slots first
    for (let i = 0; i < 5; i++) {
        const slot = document.querySelector(`[data-slot-index="${i}"]`);
        if (slot) {
            slot.classList.remove('filled', 'border-solid', 'border-blue-500', 'bg-blue-800');
            slot.classList.add('border-dashed', 'border-gray-500', 'bg-gray-600');
            slot.innerHTML = `<span class="text-gray-400 text-xs">${t('lobby.empty')}</span>`;
        }
    }
    
    // Fill slots with remaining units
    selectedUnits.forEach((unit, index) => {
        fillUnitSlot(index, unit);
    });
}

// Update unit counter
function updateUnitCounter() {
    const unitCounter = document.getElementById('unit-counter');
    unitCounter.textContent = `(${selectedUnits.length}/5)`;
}

// Calculate total movement point (sum of all speeds)
function calculateMovementPoint() {
    let totalSpeed = 0;
    
    // Add hero speed if selected
    if (selectedHero) {
        const heroName = selectedHero.name;
        const heroDef = UNIT_TYPES[heroName];
        if (heroDef) {
            totalSpeed += heroDef.speed;
        }
    }
    
    // Add all unit speeds
    selectedUnits.forEach(unit => {
        const unitName = unit.name;
        const unitDef = UNIT_TYPES[unitName];
        if (unitDef) {
            totalSpeed += unitDef.speed;
        }
    });
    
    return totalSpeed;
}

// Update movement point display
function updateMovementPointDisplay() {
    const movementPointElement = document.getElementById('movement-point');
    if (movementPointElement) {
        const totalSpeed = calculateMovementPoint();
        movementPointElement.textContent = totalSpeed;
    }
}

// Update ready button
function updateReadyButton() {
    const buttons = document.querySelectorAll('.ready-btn');
    const hasSelectedTeam = selectedHero && selectedUnits.length === 5;
    const hasEnoughPlayers = currentPlayers.length >= 2;
    const canReady = hasSelectedTeam && hasEnoughPlayers;

    let text = t('lobby.ready');
    let cls = 'ready-btn bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors';
    if (!hasSelectedTeam) {
        text = t('lobby.selectFirst');
        cls = 'ready-btn bg-gray-600 cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors';
    } else if (!hasEnoughPlayers) {
        text = t('lobby.waitOpponent');
        cls = 'ready-btn bg-yellow-600 cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors';
    } else if (isReady) {
        text = t('lobby.notReady');
        cls = 'ready-btn bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors';
    }
    buttons.forEach(readyBtn => {
        readyBtn.disabled = !canReady;
        readyBtn.textContent = text;
        readyBtn.className = cls + (readyBtn.id === 'ready-btn-mobile' ? ' w-full' : '');
    });
}

// Initialize event handlers
function initializeEventHandlers() {
    // Ready button
    const onReadyClick = () => {
        if (!selectedHero || selectedUnits.length !== 5) {
            alert(t('lobby.needTeam'));
            return;
        }
        
        if (currentPlayers.length < 2) {
            alert(t('lobby.needOpponent'));
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
    };
    document.querySelectorAll('.ready-btn').forEach(btn => btn.addEventListener('click', onReadyClick));
    
    // Back to main menu
    const goHome = (e) => {
        if (e) e.preventDefault();
        if (confirm(t('lobby.leaveConfirm'))) {
            window.location.href = 'index.html';
        }
    };
    const backBtn = document.getElementById('back-to-main');
    if (backBtn) backBtn.addEventListener('click', goHome);
    const headerBack = document.getElementById('header-back-home');
    if (headerBack) headerBack.addEventListener('click', goHome);
}

// Update match info
function updateMatchInfo() {
    const matchInfo = document.getElementById('match-info');
    if (currentMatch) {
        matchInfo.innerHTML = `
            <div class="text-lg font-semibold">${currentMatch.name}</div>
            <div class="text-sm text-gray-400">${t('lobby.status', { status: currentMatch.status })}</div>
        `;
    }
}

// Update players status
function updatePlayersStatus(players) {
    // Store current players for ready button logic
    currentPlayers = players;
    
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
                    ${player.isCreator ? `<span class="bg-yellow-600 text-yellow-100 px-2 py-1 rounded text-xs">${t('lobby.creator')}</span>` : ''}
                    ${isCurrentUser ? `<span class="bg-blue-600 text-blue-100 px-2 py-1 rounded text-xs">${t('lobby.you')}</span>` : ''}
                </div>
            </div>
            <div class="space-y-1">
                <div class="text-sm text-gray-300">
                    ${t('lobby.team', { state: player.hasTeam ? t('lobby.teamYes') : t('lobby.teamNo') })}
                </div>
                <div class="text-sm text-gray-300">
                    ${t('lobby.readyLabel', { state: player.isReady ? `<span class="text-green-400">${t('lobby.yes')}</span>` : `<span class="text-red-400">${t('lobby.no')}</span>` })}
                </div>
            </div>
        `;
        
        playerDiv.classList.add('border-2', statusClass);
        playersStatus.appendChild(playerDiv);
    });
    
    // Update ready button based on current players count
    updateReadyButton();
}

// Show loading screen
function showLoadingScreen() {
    const lobbyScreen = document.getElementById('lobby-screen');
    const loadingScreen = document.getElementById('loading-screen');
    
    lobbyScreen.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
}
