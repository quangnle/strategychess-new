// Import modules
let UNIT_TYPES = null;
let P5BattleGraphics = null;

// Chat functionality
let chatSocket = null;
let currentUser = null;

// Load definitions and graphics
async function loadDefinitions() {
    try {
        const module = await import('../core-logic/definitions.js');
        UNIT_TYPES = module.UNIT_TYPES;
        console.log('Definitions loaded successfully:', Object.keys(UNIT_TYPES));
        
        // Load p5 graphics module
        const graphicsModule = await import('./p5-battle-sketch.js');
        P5BattleGraphics = graphicsModule.default;
        console.log('P5 Graphics module loaded successfully');
    } catch (error) {
        console.error('Error loading modules:', error);
        // Fallback to basic structure
        UNIT_TYPES = {
            "Trezdin": { name: "Trezdin", hp: 5, speed: 3, range: 1, image_blue: "./imgs/heroes/trezdin_blue.png", image_red: "./imgs/heroes/trezdin_red.png" },
            "Trarex": { name: "Trarex", hp: 3, speed: 3, range: 4, image_blue: "./imgs/heroes/trarex_blue.png", image_red: "./imgs/heroes/trarex_red.png" },
            "Taki": { name: "Taki", hp: 4, speed: 4, range: 1, image_blue: "./imgs/heroes/taki_blue.png", image_red: "./imgs/heroes/taki_red.png" },
            "Ara": { name: "Ara", hp: 4, speed: 4, range: 1, image_blue: "./imgs/heroes/ara_blue.png", image_red: "./imgs/heroes/ara_red.png" },
            "Nizza": { name: "Nizza", hp: 3, speed: 5, range: 1, image_blue: "./imgs/heroes/nizza_blue.png", image_red: "./imgs/heroes/nizza_red.png" },
            "Wizzi": { name: "Wizzi", hp: 3, speed: 3, range: 3, image_blue: "./imgs/heroes/wizzi_blue.png", image_red: "./imgs/heroes/wizzi_red.png" },
            "Tanker": { name: "Tanker", hp: 5, speed: 2, range: 1, image_blue: "./imgs/tanker_blue.png", image_red: "./imgs/tanker_red.png" },
            "Assassin": { name: "Assassin", hp: 3, speed: 5, range: 1, image_blue: "./imgs/assassin_blue.png", image_red: "./imgs/assassin_red.png" },
            "Ranger": { name: "Ranger", hp: 2, speed: 3, range: 4, image_blue: "./imgs/ranger_blue.png", image_red: "./imgs/ranger_red.png" }
        };
    }
}

// Team state management
class TeamManager {
    constructor(teamColor) {
        this.teamColor = teamColor;
        this.teamName = teamColor.toUpperCase();
        this.selectedHero = null;
        this.selectedUnits = [];
        this.maxUnits = 5;
        
        this.heroes = ['Trezdin', 'Trarex', 'Taki', 'Ara', 'Nizza', 'Wizzi'];
        this.regularUnits = ['Tanker', 'Assassin', 'Ranger'];
        
        // Don't call init() immediately, wait for UNIT_TYPES to be loaded
    }
    
    init() {
        this.renderHeroSelection();
        this.renderUnitSelection();
        this.updateUI();
        this.bindEvents();
    }
    
    renderHeroSelection() {
        const container = document.getElementById(`${this.teamColor}-hero-selection`);
        if (!container) {
            console.error(`Container not found: ${this.teamColor}-hero-selection`);
            return;
        }
        
        container.innerHTML = '';
        
        if (!UNIT_TYPES) {
            console.error('UNIT_TYPES not loaded yet');
            container.innerHTML = '<div class="text-red-400">Loading heroes...</div>';
            return;
        }
        
        this.heroes.forEach(heroName => {
            const hero = UNIT_TYPES[heroName];
            if (!hero) {
                console.error(`Hero not found: ${heroName}`);
                return;
            }
            
            const card = document.createElement('div');
            card.className = `bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 hover:border-${this.teamColor}-400 rounded-lg p-3 cursor-pointer transition-all transform hover:scale-105`;
            card.dataset.hero = heroName;
            
            card.innerHTML = `
                <div class="text-center">
                    <img src="${hero[`image_${this.teamColor}`]}" alt="${heroName}" class="w-16 h-16 mx-auto mb-2">
                    <div class="text-sm font-semibold text-gray-200">${heroName}</div>
                    <div class="text-xs text-gray-400">HP: ${hero.hp} | Speed: ${hero.speed} | Range: ${hero.range}</div>
                </div>
            `;
            
            card.addEventListener('click', () => this.selectHero(heroName));
            container.appendChild(card);
        });
    }
    
    renderUnitSelection() {
        const container = document.getElementById(`${this.teamColor}-units-selection`);
        if (!container) {
            console.error(`Container not found: ${this.teamColor}-units-selection`);
            return;
        }
        
        container.innerHTML = '';
        
        if (!UNIT_TYPES) {
            console.error('UNIT_TYPES not loaded yet');
            container.innerHTML = '<div class="text-red-400">Loading units...</div>';
            return;
        }
        
        this.regularUnits.forEach(unitName => {
            const unit = UNIT_TYPES[unitName];
            if (!unit) {
                console.error(`Unit not found: ${unitName}`);
                return;
            }
            
            const card = document.createElement('div');
            card.className = `bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 hover:border-${this.teamColor}-400 rounded-lg p-3 cursor-pointer transition-all transform hover:scale-105`;
            card.dataset.unit = unitName;
            
            card.innerHTML = `
                <div class="text-center">
                    <img src="${unit[`image_${this.teamColor}`]}" alt="${unitName}" class="w-12 h-12 mx-auto mb-2">
                    <div class="text-sm font-semibold text-gray-200">${unitName}</div>
                    <div class="text-xs text-gray-400">HP: ${unit.hp} | Speed: ${unit.speed} | Range: ${unit.range}</div>
                </div>
            `;
            
            card.addEventListener('click', () => this.addUnit(unitName));
            container.appendChild(card);
        });
    }
    
    selectHero(heroName) {
        this.selectedHero = heroName;
        this.updateUI();
        
        // Update hero selection visual
        const container = document.getElementById(`${this.teamColor}-hero-selection`);
        container.querySelectorAll('[data-hero]').forEach(card => {
            if (card.dataset.hero === heroName) {
                card.className = `bg-${this.teamColor}-800 border-2 border-${this.teamColor}-400 rounded-lg p-3 cursor-pointer transition-all`;
            } else {
                card.className = `bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 hover:border-${this.teamColor}-400 rounded-lg p-3 cursor-pointer transition-all transform hover:scale-105`;
            }
        });
        
        // Show selected hero
        this.showSelectedHero();
    }
    
    addUnit(unitName) {
        if (this.selectedUnits.length >= this.maxUnits) {
            alert(`You can only select ${this.maxUnits} regular units!`);
            return;
        }
        
        this.selectedUnits.push(unitName);
        this.updateUI();
        this.showSelectedUnits();
    }
    
    removeUnit(index) {
        this.selectedUnits.splice(index, 1);
        this.updateUI();
        this.showSelectedUnits();
    }
    
    showSelectedHero() {
        const container = document.getElementById(`${this.teamColor}-hero-selected`);
        if (!container) {
            console.error(`Container not found: ${this.teamColor}-hero-selected`);
            return;
        }
        
        if (this.selectedHero) {
            const hero = UNIT_TYPES[this.selectedHero];
            if (!hero) {
                console.error(`Hero not found: ${this.selectedHero}`);
                return;
            }
            
            container.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <img src="${hero[`image_${this.teamColor}`]}" alt="${this.selectedHero}" class="w-8 h-8 mr-3">
                        <span class="font-semibold text-${this.teamColor}-200">${this.selectedHero}</span>
                    </div>
                    <button class="deselect-hero-btn text-${this.teamColor}-400 hover:text-${this.teamColor}-200 text-sm">
                        ✕
                    </button>
                </div>
            `;
            
            // Add event listener instead of onclick
            const deselectBtn = container.querySelector('.deselect-hero-btn');
            if (deselectBtn) {
                deselectBtn.addEventListener('click', () => this.deselectHero());
            }
            
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }
    
    showSelectedUnits() {
        const container = document.getElementById(`${this.teamColor}-units-selected`);
        if (!container) {
            console.error(`Container not found: ${this.teamColor}-units-selected`);
            return;
        }
        
        container.innerHTML = '';
        
        this.selectedUnits.forEach((unitName, index) => {
            const unit = UNIT_TYPES[unitName];
            if (!unit) {
                console.error(`Unit not found: ${unitName}`);
                return;
            }
            
            const unitCard = document.createElement('div');
            unitCard.className = `bg-${this.teamColor}-800 border border-${this.teamColor}-400 rounded p-2 relative`;
            
            unitCard.innerHTML = `
                <div class="text-center">
                    <img src="${unit[`image_${this.teamColor}`]}" alt="${unitName}" class="w-8 h-8 mx-auto mb-1">
                    <div class="text-xs text-${this.teamColor}-200">${unitName}</div>
                </div>
                <button class="remove-unit-btn absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center" data-index="${index}">
                    ✕
                </button>
            `;
            
            // Add event listener instead of onclick
            const removeBtn = unitCard.querySelector('.remove-unit-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => this.removeUnit(index));
            }
            
            container.appendChild(unitCard);
        });
    }
    
    deselectHero() {
        this.selectedHero = null;
        this.updateUI();
        this.renderHeroSelection();
        document.getElementById(`${this.teamColor}-hero-selected`).classList.add('hidden');
    }
    
    updateUI() {
        // Update unit counter
        const counter = document.getElementById(`${this.teamColor}-unit-counter`);
        if (counter) {
            counter.textContent = `(${this.selectedUnits.length}/${this.maxUnits})`;
        }
        
        // Update team name
        const nameInput = document.getElementById(`${this.teamColor}-team-name`);
        if (nameInput) {
            this.teamName = nameInput.value;
        }
        
        // Update global start button state
        this.updateGlobalStartButton();
    }
    
    updateGlobalStartButton() {
        const globalBtn = document.getElementById('global-start-btn');
        if (!globalBtn) return;
        
        // Check if teamManagers exists before accessing it
        if (window.teamManagers && window.teamManagers.blue && window.teamManagers.red) {
            const bothTeamsReady = window.teamManagers.blue.isReady() && window.teamManagers.red.isReady();
            globalBtn.disabled = !bothTeamsReady;
        } else {
            globalBtn.disabled = true;
        }
    }
    
    isReady() {
        return this.selectedHero && this.selectedUnits.length === this.maxUnits;
    }
    
    getTeamData() {
        return {
            name: this.teamName,
            hero: this.selectedHero,
            units: [...this.selectedUnits]
        };
    }
    
    bindEvents() {
        const nameInput = document.getElementById(`${this.teamColor}-team-name`);
        if (nameInput) {
            nameInput.addEventListener('input', () => this.updateUI());
        }
    }
}

// Initialize team managers
let teamManagers = null;

function initializeTeamManagers() {
    teamManagers = {
        blue: new TeamManager('blue'),
        red: new TeamManager('red')
    };
    
    // Initialize both team managers
    teamManagers.blue.init();
    teamManagers.red.init();
    
    // Make team managers globally accessible for button handlers
    window.teamManagers = teamManagers;
}

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Load definitions first
    await loadDefinitions();
    
    // Then initialize team managers
    initializeTeamManagers();
    
    // Initialize chat functionality
    initializeChat();
    
    // Global start button handler
    const globalStartBtn = document.getElementById('global-start-btn');
    if (globalStartBtn) {
        globalStartBtn.addEventListener('click', () => {
            if (teamManagers && teamManagers.blue.isReady() && teamManagers.red.isReady()) {
                startBattle();
            }
        });
    }
    
    // Back to selection button handler
    const backToSelectionBtn = document.getElementById('back-to-selection');
    if (backToSelectionBtn) {
        backToSelectionBtn.addEventListener('click', () => {
            showSelectionScreen();
        });
    }
});

// Battle functions
function startBattle() {
    const blueTeam = teamManagers.blue.getTeamData();
    const redTeam = teamManagers.red.getTeamData();
    
    console.log('Starting battle with teams:', { blueTeam, redTeam });
    
    // Create matchInfo
    const matchInfo = createMatchInfo(blueTeam, redTeam);
    
    // Switch to battle screen
    showBattleScreen();
    
    // Initialize battle graphics
    initializeBattleGraphics(matchInfo);
}

function createMatchInfo(blueTeam, redTeam) {
    // Create team arrays with hero first, then units
    const team1 = [blueTeam.hero, ...blueTeam.units];
    const team2 = [redTeam.hero, ...redTeam.units];
    
    const matchInfo = {
        matchId: 1,
        matchName: "battle",
        team1: {
            teamId: "blue",
            teamName: blueTeam.name,
            units: team1
        },
        team2: {
            teamId: "red", 
            teamName: redTeam.name,
            units: team2
        }
    };
    
    console.log('Created matchInfo:', matchInfo);
    return matchInfo;
}

function showBattleScreen() {
    const selectionScreen = document.getElementById('selection-screen');
    const battleScreen = document.getElementById('battle-screen');
    
    if (selectionScreen) selectionScreen.classList.add('hidden');
    if (battleScreen) battleScreen.classList.remove('hidden');
}

function showSelectionScreen() {
    const battleScreen = document.getElementById('battle-screen');
    const selectionScreen = document.getElementById('selection-screen');
    
    if (battleScreen) battleScreen.classList.add('hidden');
    if (selectionScreen) selectionScreen.classList.remove('hidden');
}

let battleGraphics = null;

function initializeBattleGraphics(matchInfo) {
    if (!P5BattleGraphics) {
        console.error('P5BattleGraphics not loaded');
        return;
    }
    
    try {
        battleGraphics = new P5BattleGraphics(matchInfo);
        console.log('P5 Battle graphics initialized successfully');
        
        // Add game controls
        addGameControls();
    } catch (error) {
        console.error('Error initializing P5 battle graphics:', error);
    }
}

function addGameControls() {
    // Add next turn button
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'flex justify-center mt-4 space-x-4';
    controlsContainer.innerHTML = `
        <button id="next-turn-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Next Turn
        </button>
        <button id="show-turn-info-btn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
            Show Turn Info
        </button>
    `;
    
    const battleScreenContainer = document.querySelector('#battle-screen .container');
    if (battleScreenContainer) {
        battleScreenContainer.appendChild(controlsContainer);
    }
    
    // Add event listeners
    const nextTurnBtn = document.getElementById('next-turn-btn');
    if (nextTurnBtn) {
        nextTurnBtn.addEventListener('click', () => {
            if (battleGraphics) {
                battleGraphics.nextTurn();
            }
        });
    }
    
    const showTurnInfoBtn = document.getElementById('show-turn-info-btn');
    if (showTurnInfoBtn) {
        showTurnInfoBtn.addEventListener('click', () => {
            if (battleGraphics) {
                const turnInfo = battleGraphics.getCurrentTurnInfo();
                const turnSequence = battleGraphics.getTurnSequence();
                console.log('Current Turn Info:', turnInfo);
                console.log('Turn Sequence:', turnSequence);
                alert(`Current Turn: ${turnInfo.inTurnUnit.name} (${turnInfo.inTurnUnit.teamId})\nCan Move: ${turnInfo.canMove}\nCan Attack: ${turnInfo.canAttack}\nCan Heal: ${turnInfo.canHeal}`);
            }
        });
    }
}

// Chat functionality
function initializeChat() {
    console.log('Initializing chat functionality...');
    
    // Connect to chat namespace
    chatSocket = io('/chat');
    
    // Chat UI elements
    const chatContainer = document.getElementById('chat-container');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-message');
    const toggleButton = document.getElementById('toggle-chat');
    const usernameInput = document.getElementById('username-input');
    const changeUsernameButton = document.getElementById('change-username');
    const onlineCount = document.getElementById('online-count');
    
    // Toggle chat visibility
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            chatContainer.classList.toggle('hidden');
            if (!chatContainer.classList.contains('hidden')) {
                chatInput.focus();
            }
        });
    }
    
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
    
    // Change username
    if (changeUsernameButton) {
        changeUsernameButton.addEventListener('click', () => {
            const newUsername = usernameInput.value.trim();
            if (newUsername && chatSocket) {
                chatSocket.emit('user:change_username', { username: newUsername });
                usernameInput.value = '';
            }
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
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="text-center text-green-500 text-sm">Welcome to the chat!</div>';
        }
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
    
    chatSocket.on('user:username_changed', (data) => {
        if (data.userId === currentUser?.userId) {
            currentUser.username = data.newUsername;
        }
        addSystemMessage(`${data.oldUsername} changed name to ${data.newUsername}`);
    });
    
    chatSocket.on('chat:typing', (data) => {
        // Handle typing indicator
        console.log(`${data.username} is typing...`);
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
