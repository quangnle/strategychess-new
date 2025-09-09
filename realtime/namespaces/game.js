const gameHandlers = require('../handlers/gameHandlers');

function registerGameNS(gameNamespace) {
    console.log('Registering game namespace handlers...');
    
    gameNamespace.on('connection', (socket) => {
        console.log(`User connected to game namespace: ${socket.id}`);
        
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

module.exports = { registerGameNS };
