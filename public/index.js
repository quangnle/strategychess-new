// Chat functionality
let chatSocket = null;
let currentUser = null;

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize chat functionality
    initializeChat();
    
    // Initialize action buttons
    initializeActionButtons();
});

 // Action buttons functionality
 function initializeActionButtons() {
     const createMatchBtn = document.getElementById('create-match-btn');
     const matchNameInput = document.getElementById('match-name');
     const playAiBtn = document.getElementById('play-ai-btn');
     
     if (createMatchBtn && matchNameInput) {
         createMatchBtn.addEventListener('click', () => {
             const matchName = matchNameInput.value.trim();
             if (!matchName) {
                 alert('Please enter a match name');
                 return;
             }
             
             console.log('Creating match:', matchName);
             // TODO: Implement match creation logic
             // For now, redirect to team selection page
             window.location.href = 'play-with-ai.html';
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
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
