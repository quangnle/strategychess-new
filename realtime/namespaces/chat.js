import chatHandlers from '../handlers/chatHandlers.js';

function registerChatNS(chatNamespace) {
    console.log('Registering chat namespace handlers...');
    
    chatNamespace.on('connection', (socket) => {
        console.log(`User connected to chat namespace: ${socket.id}`);
        
        // Register all chat handlers
        chatHandlers.registerHandlers(socket, chatNamespace);
        
        // Handle connection event
        chatHandlers.handleConnect(socket, chatNamespace);
        
        // Handle disconnection
        socket.on('disconnect', () => {
            chatHandlers.handleDisconnect(socket, chatNamespace);
        });
    });
    
    return chatNamespace;
}

export { registerChatNS };
