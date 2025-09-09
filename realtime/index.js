const { registerChatNS } = require('./namespaces/chat');
const { registerLobbyNS } = require('./namespaces/lobby');
const { registerGameNS } = require('./namespaces/game');

function initSocket(io) {
    console.log('Initializing Socket.IO...');
    
    // Register chat namespace
    const chatNamespace = io.of('/chat');
    registerChatNS(chatNamespace);
    
    // Register lobby namespace
    const lobbyNamespace = io.of('/lobby');
    registerLobbyNS(lobbyNamespace);
    
    // Register game namespace
    const gameNamespace = io.of('/game');
    registerGameNS(gameNamespace);
    
    // Register default namespace for general events
    io.on('connection', (socket) => {
        console.log(`User connected to default namespace: ${socket.id}`);
        
        // Handle general connection events
        socket.on('disconnect', () => {
            console.log(`User disconnected from default namespace: ${socket.id}`);
        });
        
        // Handle ping/pong for connection health
        socket.on('ping', () => {
            socket.emit('pong');
        });
    });
    
    console.log('Socket.IO initialized successfully');
}

module.exports = initSocket;
