import { registerChatNS } from './namespaces/chat.js';
import { registerLobbyNS } from './namespaces/lobby.js';
import { registerGameNS } from './namespaces/game.js';

function initSocket(io) {
    console.log('Initializing Socket.IO...');
    
    // Register chat namespace
    const chatNamespace = io.of('/chat');
    console.log('Registering chat namespace...');
    registerChatNS(chatNamespace);
    
    // Register lobby namespace
    const lobbyNamespace = io.of('/lobby');
    console.log('Registering lobby namespace...');
    registerLobbyNS(lobbyNamespace);
    
    // Register game namespace
    const gameNamespace = io.of('/game');
    console.log('Registering game namespace...');
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

export default initSocket;
