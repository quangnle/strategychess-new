class MemoryStore {
    constructor() {
        this.chatMessages = [];
        this.connectedUsers = new Map();
        this.rooms = new Map();
        this.maxChatMessages = 100; // Keep last 100 messages
    }

    // Chat methods
    addChatMessage(message) {
        this.chatMessages.push({
            id: Date.now() + Math.random(),
            ...message,
            timestamp: new Date().toISOString()
        });

        // Keep only the last maxChatMessages
        if (this.chatMessages.length > this.maxChatMessages) {
            this.chatMessages = this.chatMessages.slice(-this.maxChatMessages);
        }

        return this.chatMessages[this.chatMessages.length - 1];
    }

    getChatMessages(limit = 50) {
        return this.chatMessages.slice(-limit);
    }

    // User connection methods
    addUser(userId, userData) {
        this.connectedUsers.set(userId, {
            ...userData,
            connectedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        });
    }

    removeUser(userId) {
        this.connectedUsers.delete(userId);
    }

    updateUserLastSeen(userId) {
        const user = this.connectedUsers.get(userId);
        if (user) {
            user.lastSeen = new Date().toISOString();
            this.connectedUsers.set(userId, user);
        }
    }

    getUser(userId) {
        return this.connectedUsers.get(userId);
    }

    getAllUsers() {
        return Array.from(this.connectedUsers.values());
    }

    // Room methods
    createRoom(roomId, roomData) {
        this.rooms.set(roomId, {
            ...roomData,
            createdAt: new Date().toISOString(),
            users: new Set()
        });
    }

    joinRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.users.add(userId);
        }
    }

    leaveRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.users.delete(userId);
        }
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    getRoomUsers(roomId) {
        const room = this.rooms.get(roomId);
        return room ? Array.from(room.users) : [];
    }

    // Utility methods
    getStats() {
        return {
            connectedUsers: this.connectedUsers.size,
            totalMessages: this.chatMessages.length,
            activeRooms: this.rooms.size,
            timestamp: new Date().toISOString()
        };
    }

    clear() {
        this.chatMessages = [];
        this.connectedUsers.clear();
        this.rooms.clear();
    }
}

module.exports = new MemoryStore();
