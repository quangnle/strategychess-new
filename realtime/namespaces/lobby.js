import lobbyHandlers from '../handlers/lobbyHandlers.js';

function registerLobbyNS(lobbyNamespace) {
    console.log('Registering lobby namespace handlers...');
    
    lobbyNamespace.on('connection', (socket) => {
        console.log(`User connected to lobby namespace: ${socket.id}`);
        
        // Handle user authentication
        socket.on('lobby:authenticate', (data) => {
            const { userId, username } = data;
            
            if (!userId || !username) {
                socket.emit('error', { message: 'User ID and username are required' });
                return;
            }
            
            // Store user data in socket
            socket.userId = userId;
            socket.username = username;
            
            console.log(`Lobby user authenticated: ${username} (${userId})`);
            
            // Send authentication confirmation
            socket.emit('lobby:authenticated', {
                userId: userId,
                username: username
            });
        });
        
        // Register all lobby handlers
        lobbyHandlers.registerHandlers(socket, lobbyNamespace);
        
        // Handle disconnection
        socket.on('disconnect', () => {
            lobbyHandlers.handleDisconnect(socket, lobbyNamespace);
        });
    });
    
    return lobbyNamespace;
}

export { registerLobbyNS };
