// Chat functionality
let chatSocket = null;
let currentUser = null;

// Utility function
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize chat functionality
    initializeChat();
    
    // Initialize action buttons
    initializeActionButtons();
    
    // Initialize waiting matches
    initializeWaitingMatches();
});

 // Action buttons functionality
 function initializeActionButtons() {
     const createMatchBtn = document.getElementById('create-match-btn');
     const matchNameInput = document.getElementById('match-name');
     const playAiBtn = document.getElementById('play-ai-btn');
     
     if (createMatchBtn && matchNameInput) {
         createMatchBtn.addEventListener('click', () => {
             const matchName = matchNameInput.value.trim();
             
             // If no match name provided, use current user's name
             const finalMatchName = matchName || (currentUser?.username || 'Player') + "'s Match";
             
             console.log('Creating match:', finalMatchName);
             createMatch(finalMatchName);
         });
         
         // Allow Enter key to create match
         matchNameInput.addEventListener('keypress', (e) => {
             if (e.key === 'Enter') {
                 createMatchBtn.click();
             }
         });
     }
     
         if (playAiBtn) {
        playAiBtn.addEventListener('click', () => {
            console.log('Play with AI clicked');
            // For now, also redirect to team selection page
            // In the future, this could start an AI game directly
            window.location.href = 'play-with-ai.html';
        });
    }
 }

// Chat functionality
function initializeChat() {
    console.log('Initializing chat functionality...');
    
    // Connect to chat namespace
    chatSocket = io('/chat');
    
    // Chat UI elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-message');
    const onlineCount = document.getElementById('online-count');
    const onlineUsersList = document.getElementById('online-users-list');
    
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
        if (onlineUsersList) {
            updateOnlineUsersList(data.onlineUsers);
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
        if (onlineUsersList) {
            updateOnlineUsersList(data.onlineUsers);
        }
    });
    
    chatSocket.on('user:left', (data) => {
        addSystemMessage(`${data.username} left the chat`);
        if (onlineCount) {
            updateOnlineCount(data.onlineUsers.length);
        }
        if (onlineUsersList) {
            updateOnlineUsersList(data.onlineUsers);
        }
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
    
    function updateOnlineUsersList(users) {
        if (!onlineUsersList) return;
        
        if (!users || users.length === 0) {
            onlineUsersList.innerHTML = '<div class="text-center text-gray-500 text-xs">No users online</div>';
            return;
        }
        
        onlineUsersList.innerHTML = '';
        users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'flex items-center space-x-2 p-2 bg-gray-800 rounded text-sm';
            
            // Add online indicator
            const indicator = document.createElement('div');
            indicator.className = 'w-2 h-2 bg-green-500 rounded-full';
            
            const username = document.createElement('span');
            username.className = 'text-gray-200';
            username.textContent = user.username || 'Anonymous';
            
            userDiv.appendChild(indicator);
            userDiv.appendChild(username);
            onlineUsersList.appendChild(userDiv);
        });
    }
    
}

// Match functionality
function initializeWaitingMatches() {
    console.log('Initializing waiting matches...');
    
    // Load waiting matches
    loadWaitingMatches();
    
    // Set up refresh button
    const refreshBtn = document.getElementById('refresh-matches-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadWaitingMatches);
    }
    
    // Auto-refresh every 5 seconds
    setInterval(loadWaitingMatches, 5000);
}

// Load waiting matches from server
async function loadWaitingMatches() {
    try {
        const response = await fetch('/api/matches/waiting');
        const data = await response.json();
        
        if (data.success) {
            displayWaitingMatches(data.matches);
        } else {
            console.error('Error loading matches:', data.error);
            displayWaitingMatchesError(data.error);
        }
    } catch (error) {
        console.error('Error loading matches:', error);
        displayWaitingMatchesError('Failed to load matches');
    }
}

// Display waiting matches
function displayWaitingMatches(matches) {
    const waitingMatchesContainer = document.getElementById('waiting-matches');
    
    if (!matches || matches.length === 0) {
        waitingMatchesContainer.innerHTML = `
            <div class="text-center text-gray-500 text-sm">
                No waiting matches available
            </div>
        `;
        return;
    }
    
    waitingMatchesContainer.innerHTML = '';
    
    matches.forEach(match => {
        const matchDiv = document.createElement('div');
        matchDiv.className = 'bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-blue-500 transition-colors';
        
        matchDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <div class="font-medium text-white">${escapeHtml(match.name)}</div>
                    <div class="text-sm text-gray-300">
                        Created by ${escapeHtml(match.creatorUsername)}
                    </div>
                    <div class="text-xs text-gray-400">
                        Players: ${match.playerCount}/${match.maxPlayers} • 
                        Created: ${new Date(match.createdAt).toLocaleTimeString()}
                    </div>
                </div>
                <button class="join-match-btn bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
                        data-match-id="${match.id}">
                    Join
                </button>
            </div>
        `;
        
        // Add click handler for join button
        const joinBtn = matchDiv.querySelector('.join-match-btn');
        joinBtn.addEventListener('click', () => {
            joinMatch(match.id);
        });
        
        waitingMatchesContainer.appendChild(matchDiv);
    });
}

// Display waiting matches error
function displayWaitingMatchesError(error) {
    const waitingMatchesContainer = document.getElementById('waiting-matches');
    waitingMatchesContainer.innerHTML = `
        <div class="text-center text-red-400 text-sm">
            Error: ${escapeHtml(error)}
        </div>
    `;
}

// Create a new match
async function createMatch(matchName) {
    if (!currentUser) {
        alert('Please wait for connection to establish');
        return;
    }
    
    try {
        const response = await fetch('/api/matches/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                creatorUserId: currentUser.userId,
                creatorUsername: currentUser.username,
                matchName: matchName
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Match created successfully:', data.match);
            // Store user info for lobby
            localStorage.setItem('lobbyUser', JSON.stringify({
                userId: currentUser.userId,
                username: currentUser.username,
                matchId: data.match.id
            }));
            // Redirect to lobby
            window.location.href = `lobby.html?matchId=${data.match.id}`;
        } else {
            alert(`Error creating match: ${data.error}`);
        }
    } catch (error) {
        console.error('Error creating match:', error);
        alert('Failed to create match. Please try again.');
    }
}

// Join an existing match
async function joinMatch(matchId) {
    if (!currentUser) {
        alert('Please wait for connection to establish');
        return;
    }
    
    try {
        const response = await fetch('/api/matches/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                matchId: matchId,
                userId: currentUser.userId,
                username: currentUser.username
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Joined match successfully:', data.match);
            // Store user info for lobby
            localStorage.setItem('lobbyUser', JSON.stringify({
                userId: currentUser.userId,
                username: currentUser.username,
                matchId: data.match.id
            }));
            // Redirect to lobby
            window.location.href = `lobby.html?matchId=${data.match.id}`;
        } else {
            alert(`Error joining match: ${data.error}`);
        }
    } catch (error) {
        console.error('Error joining match:', error);
        alert('Failed to join match. Please try again.');
    }
}
