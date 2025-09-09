class MemoryStore {
    constructor() {
        this.chatMessages = [];
        this.connectedUsers = new Map();
        this.rooms = new Map();
        this.matches = new Map(); // Store for matches
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

    // Match methods
    createMatch(matchId, matchData) {
        this.matches.set(matchId, {
            ...matchData,
            id: matchId,
            createdAt: new Date().toISOString(),
            status: 'waiting', // waiting, in_lobby, in_game, finished
            players: new Map(),
            maxPlayers: 2,
            gameState: null
        });
        return this.matches.get(matchId);
    }

    getMatch(matchId) {
        return this.matches.get(matchId);
    }

    updateMatch(matchId, updates) {
        const match = this.matches.get(matchId);
        if (match) {
            Object.assign(match, updates);
            this.matches.set(matchId, match);
        }
        return match;
    }

    deleteMatch(matchId) {
        return this.matches.delete(matchId);
    }

    getAllMatches() {
        return Array.from(this.matches.values());
    }

    getWaitingMatches() {
        return Array.from(this.matches.values()).filter(match => match.status === 'waiting');
    }

    addPlayerToMatch(matchId, userId, playerData) {
        const match = this.matches.get(matchId);
        if (match && match.players.size < match.maxPlayers) {
            match.players.set(userId, {
                ...playerData,
                joinedAt: new Date().toISOString(),
                isReady: false,
                team: null // Will be set in lobby
            });
            return true;
        }
        return false;
    }

    removePlayerFromMatch(matchId, userId) {
        const match = this.matches.get(matchId);
        if (match) {
            match.players.delete(userId);
            // If no players left, delete the match
            if (match.players.size === 0) {
                this.deleteMatch(matchId);
            }
            return true;
        }
        return false;
    }

    updatePlayerInMatch(matchId, userId, updates) {
        const match = this.matches.get(matchId);
        if (match && match.players.has(userId)) {
            const player = match.players.get(userId);
            Object.assign(player, updates);
            match.players.set(userId, player);
            return player;
        }
        return null;
    }

    getMatchPlayers(matchId) {
        const match = this.matches.get(matchId);
        return match ? Array.from(match.players.entries()).map(([userId, playerData]) => ({
            userId,
            ...playerData
        })) : [];
    }

    isMatchReady(matchId) {
        const match = this.matches.get(matchId);
        if (!match || match.players.size !== match.maxPlayers) {
            return false;
        }
        
        // Check if all players are ready
        for (const [userId, player] of match.players) {
            if (!player.isReady) {
                return false;
            }
        }
        return true;
    }

    // Utility methods
    getStats() {
        return {
            connectedUsers: this.connectedUsers.size,
            totalMessages: this.chatMessages.length,
            activeRooms: this.rooms.size,
            activeMatches: this.matches.size,
            waitingMatches: this.getWaitingMatches().length,
            timestamp: new Date().toISOString()
        };
    }

    clear() {
        this.chatMessages = [];
        this.connectedUsers.clear();
        this.rooms.clear();
        this.matches.clear();
    }
}

module.exports = new MemoryStore();
