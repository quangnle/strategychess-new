import GameHandlers from '../handlers/gameHandlers.js';

// Create instance of GameHandlers
const gameHandlers = new GameHandlers();

function registerGameNS(gameNamespace) {
    console.log('=== REGISTERING GAME NAMESPACE HANDLERS ===');
    console.log('Game namespace:', gameNamespace.name);
    
    gameNamespace.on('connection', (socket) => {
        console.log(`=== GAME NAMESPACE: User connected ===`);
        console.log(`Socket ID: ${socket.id}`);
        console.log(`Socket remote address: ${socket.handshake.address}`);
        
        // Handle user authentication
        socket.on('game:authenticate', (data) => {
            const { userId, username } = data;
            
            if (!userId || !username) {
                socket.emit('error', { message: 'User ID and username are required' });
                return;
            }
            
            // Store user data in socket
            socket.userId = userId;
            socket.username = username;
            
            console.log(`Game user authenticated: ${username} (${userId})`);
            
            // Send authentication confirmation
            socket.emit('game:authenticated', {
                userId: userId,
                username: username
            });
        });
        
        // Register all game handlers
        gameHandlers.registerHandlers(socket, gameNamespace);
        
        // Handle disconnection
        socket.on('disconnect', () => {
            gameHandlers.handleDisconnect(socket, gameNamespace);
        });
    });
    
    return gameNamespace;
}

export { registerGameNS };
