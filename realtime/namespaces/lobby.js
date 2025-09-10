import lobbyHandlers from '../handlers/lobbyHandlers.js';

function registerLobbyNS(lobbyNamespace) {
    console.log('=== REGISTERING LOBBY NAMESPACE HANDLERS ===');
    console.log('Lobby namespace:', lobbyNamespace.name);
    
    lobbyNamespace.on('connection', (socket) => {
        console.log(`=== LOBBY NAMESPACE: User connected ===`);
        console.log(`Socket ID: ${socket.id}`);
        console.log(`Socket remote address: ${socket.handshake.address}`);
        
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
