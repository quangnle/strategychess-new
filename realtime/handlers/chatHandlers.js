const chatService = require('../../services/chatService');

class ChatHandlers {
    constructor() {
        this.service = chatService;
    }

    // Handle user connection
    handleConnect(socket, io) {
        const userId = this.service.generateUserId();
        const username = `Player_${Math.floor(Math.random() * 1000)}`;
        
        // Store user data in socket
        socket.userId = userId;
        socket.username = username;
        
        // Connect user to service
        this.service.connectUser(userId, { username });
        
        // Send user info to client
        socket.emit('user:connected', {
            userId,
            username,
            onlineUsers: this.service.getOnlineUsers()
        });
        
        // Broadcast user joined to all clients
        socket.broadcast.emit('user:joined', {
            userId,
            username,
            onlineUsers: this.service.getOnlineUsers()
        });
        
        // Send recent messages
        const recentMessages = this.service.getRecentMessages(20);
        socket.emit('chat:messages', recentMessages);
        
        console.log(`User connected: ${username} (${userId})`);
    }

    // Handle user disconnection
    handleDisconnect(socket, io) {
        if (socket.userId) {
            this.service.disconnectUser(socket.userId);
            
            // Broadcast user left to all clients
            socket.broadcast.emit('user:left', {
                userId: socket.userId,
                username: socket.username,
                onlineUsers: this.service.getOnlineUsers()
            });
            
            console.log(`User disconnected: ${socket.username} (${socket.userId})`);
        }
    }

    // Handle chat message
    handleChatMessage(socket, io, data) {
        try {
            const { message, roomId = 'global' } = data;
            
            if (!socket.userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }
            
            // Send message through service
            const chatMessage = this.service.sendMessage(
                socket.userId,
                socket.username,
                message,
                roomId
            );
            
            // Broadcast message to all clients
            io.emit('chat:message', chatMessage);
            
            console.log(`Chat message from ${socket.username}: ${message}`);
            
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    }

    // Handle username change
    handleUsernameChange(socket, io, data) {
        try {
            const { username } = data;
            
            if (!socket.userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }
            
            // Validate new username
            const validatedUsername = this.service.validateUsername(username);
            
            // Update user in service
            this.service.connectUser(socket.userId, { username: validatedUsername });
            
            // Update socket
            const oldUsername = socket.username;
            socket.username = validatedUsername;
            
            // Send confirmation to user
            socket.emit('user:username_changed', {
                userId: socket.userId,
                username: validatedUsername
            });
            
            // Broadcast username change to all clients
            socket.broadcast.emit('user:username_changed', {
                userId: socket.userId,
                oldUsername,
                newUsername: validatedUsername,
                onlineUsers: this.service.getOnlineUsers()
            });
            
            console.log(`Username changed: ${oldUsername} -> ${validatedUsername}`);
            
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    }

    // Handle typing indicator
    handleTyping(socket, io, data) {
        const { isTyping, roomId = 'global' } = data;
        
        if (!socket.userId) return;
        
        // Broadcast typing indicator to other users
        socket.broadcast.emit('chat:typing', {
            userId: socket.userId,
            username: socket.username,
            isTyping,
            roomId
        });
    }

    // Handle request for online users
    handleGetOnlineUsers(socket, io) {
        const onlineUsers = this.service.getOnlineUsers();
        socket.emit('users:online', onlineUsers);
    }

    // Handle request for chat stats
    handleGetStats(socket, io) {
        const stats = this.service.getStats();
        socket.emit('chat:stats', stats);
    }

    // Register all handlers
    registerHandlers(socket, io) {
        // Connection events
        socket.on('connect', () => this.handleConnect(socket, io));
        socket.on('disconnect', () => this.handleDisconnect(socket, io));
        
        // Chat events
        socket.on('chat:message', (data) => this.handleChatMessage(socket, io, data));
        socket.on('chat:typing', (data) => this.handleTyping(socket, io, data));
        
        // User events
        socket.on('user:change_username', (data) => this.handleUsernameChange(socket, io, data));
        socket.on('users:get_online', () => this.handleGetOnlineUsers(socket, io));
        
        // Stats events
        socket.on('chat:get_stats', () => this.handleGetStats(socket, io));
    }
}

module.exports = new ChatHandlers();
