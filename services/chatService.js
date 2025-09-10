import memoryStore from '../store/memoryStore.js';

class ChatService {
    constructor() {
        this.store = memoryStore;
    }

    // Send a chat message
    sendMessage(userId, username, message, roomId = 'global') {
        if (!message || message.trim().length === 0) {
            throw new Error('Message cannot be empty');
        }

        if (message.length > 500) {
            throw new Error('Message too long (max 500 characters)');
        }

        const chatMessage = this.store.addChatMessage({
            userId,
            username,
            message: message.trim(),
            roomId
        });

        return chatMessage;
    }

    // Get recent chat messages
    getRecentMessages(limit = 50, roomId = 'global') {
        const allMessages = this.store.getChatMessages(limit * 2); // Get more to filter
        const roomMessages = allMessages.filter(msg => msg.roomId === roomId);
        return roomMessages.slice(-limit);
    }

    // User connection management
    connectUser(userId, userData) {
        this.store.addUser(userId, {
            username: userData.username || 'Anonymous',
            team: userData.team || null,
            ...userData
        });
    }

    disconnectUser(userId) {
        this.store.removeUser(userId);
    }

    updateUserActivity(userId) {
        this.store.updateUserLastSeen(userId);
    }

    // Get online users
    getOnlineUsers() {
        return this.store.getAllUsers();
    }

    // Room management
    createRoom(roomId, roomData) {
        this.store.createRoom(roomId, roomData);
    }

    joinRoom(roomId, userId) {
        this.store.joinRoom(roomId, userId);
    }

    leaveRoom(roomId, userId) {
        this.store.leaveRoom(roomId, userId);
    }

    getRoomUsers(roomId) {
        return this.store.getRoomUsers(roomId);
    }

    // Utility methods
    getStats() {
        return this.store.getStats();
    }

    // Validate username
    validateUsername(username) {
        if (!username || username.trim().length === 0) {
            throw new Error('Username cannot be empty');
        }

        if (username.length > 20) {
            throw new Error('Username too long (max 20 characters)');
        }

        // Check if username contains only allowed characters
        const allowedChars = /^[a-zA-Z0-9_-]+$/;
        if (!allowedChars.test(username)) {
            throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
        }

        return username.trim();
    }

    // Generate unique user ID
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

export default new ChatService();
