import memoryStore from '../store/memoryStore.js';

class MatchService {
    constructor() {
        this.store = memoryStore;
    }

    // Create a new match
    createMatch(creatorUserId, creatorUsername, matchName) {
        try {
            // Check if user already has an active match
            const existingMatch = this.getUserActiveMatch(creatorUserId);
            if (existingMatch) {
                throw new Error('User already has an active match');
            }

            // Generate unique match ID
            const matchId = this.generateMatchId();
            
            // Use creator's username as match name if not provided
            const finalMatchName = matchName || `${creatorUsername}'s Match`;

            // Create match data
            const matchData = {
                name: finalMatchName,
                creatorId: creatorUserId,
                creatorUsername: creatorUsername
            };

            // Create match in store
            const match = this.store.createMatch(matchId, matchData);

            // Add creator as first player
            this.store.addPlayerToMatch(matchId, creatorUserId, {
                username: creatorUsername,
                isCreator: true
            });

            console.log(`Match created: ${matchId} by ${creatorUsername}`);
            return match;

        } catch (error) {
            console.error('Error creating match:', error);
            throw error;
        }
    }

    // Join an existing match
    joinMatch(matchId, userId, username) {
        try {
            const match = this.store.getMatch(matchId);
            if (!match) {
                throw new Error('Match not found');
            }

            if (match.status !== 'waiting') {
                throw new Error('Match is not accepting new players');
            }

            if (match.players.size >= match.maxPlayers) {
                throw new Error('Match is full');
            }

            // Check if user already in this match
            if (match.players.has(userId)) {
                throw new Error('User already in this match');
            }

            // Check if user has another active match
            const existingMatch = this.getUserActiveMatch(userId);
            if (existingMatch && existingMatch.id !== matchId) {
                throw new Error('User already has an active match');
            }

            // Add player to match
            const success = this.store.addPlayerToMatch(matchId, userId, {
                username: username,
                isCreator: false
            });

            if (!success) {
                throw new Error('Failed to join match');
            }

            // Update match status to in_lobby if full
            if (match.players.size === match.maxPlayers) {
                this.store.updateMatch(matchId, { status: 'in_lobby' });
            }

            console.log(`User ${username} joined match ${matchId}`);
            return this.store.getMatch(matchId);

        } catch (error) {
            console.error('Error joining match:', error);
            throw error;
        }
    }

    // Leave a match
    leaveMatch(matchId, userId) {
        try {
            const match = this.store.getMatch(matchId);
            if (!match) {
                throw new Error('Match not found');
            }

            const success = this.store.removePlayerFromMatch(matchId, userId);
            if (!success) {
                throw new Error('User not in this match');
            }

            // If match still exists, update status
            const updatedMatch = this.store.getMatch(matchId);
            if (updatedMatch) {
                if (updatedMatch.players.size === 0) {
                    // Match will be deleted by removePlayerFromMatch
                    console.log(`Match ${matchId} deleted (no players left)`);
                } else {
                    // Update status back to waiting if not full
                    this.store.updateMatch(matchId, { status: 'waiting' });
                    console.log(`User left match ${matchId}`);
                }
            }

            return true;

        } catch (error) {
            console.error('Error leaving match:', error);
            throw error;
        }
    }

    // Get waiting matches (for display on index page)
    getWaitingMatches() {
        return this.store.getWaitingMatches().map(match => ({
            id: match.id,
            name: match.name,
            creatorUsername: match.creatorUsername,
            playerCount: match.players.size,
            maxPlayers: match.maxPlayers,
            createdAt: match.createdAt
        }));
    }

    // Get match details
    getMatch(matchId) {
        return this.store.getMatch(matchId);
    }

    // Get user's active match
    getUserActiveMatch(userId) {
        const allMatches = this.store.getAllMatches();
        for (const match of allMatches) {
            if (match.players.has(userId) && match.status !== 'finished') {
                return match;
            }
        }
        return null;
    }

    // Update player team selection in lobby
    updatePlayerTeam(matchId, userId, teamData) {
        try {
            const match = this.store.getMatch(matchId);
            if (!match) {
                throw new Error('Match not found');
            }

            if (match.status !== 'in_lobby') {
                throw new Error('Match is not in lobby phase');
            }

            // Validate team data
            this.validateTeamData(teamData);

            // Update player data
            const updatedPlayer = this.store.updatePlayerInMatch(matchId, userId, {
                team: teamData,
                isReady: false // Reset ready status when team changes
            });

            if (!updatedPlayer) {
                throw new Error('Player not found in match');
            }

            console.log(`Player ${userId} updated team in match ${matchId}`);
            return updatedPlayer;

        } catch (error) {
            console.error('Error updating player team:', error);
            throw error;
        }
    }

    // Set player ready status
    setPlayerReady(matchId, userId, isReady) {
        try {
            const match = this.store.getMatch(matchId);
            if (!match) {
                throw new Error('Match not found');
            }

            if (match.status !== 'in_lobby') {
                throw new Error('Match is not in lobby phase');
            }

            const player = this.store.getMatchPlayers(matchId).find(p => p.userId === userId);
            if (!player) {
                throw new Error('Player not found in match');
            }

            if (!player.team) {
                throw new Error('Player must select team before ready');
            }

            // Update player ready status
            const updatedPlayer = this.store.updatePlayerInMatch(matchId, userId, { isReady });

            // Check if match is ready to start
            if (isReady && this.store.isMatchReady(matchId)) {
                this.store.updateMatch(matchId, { status: 'in_game' });
                console.log(`Match ${matchId} is ready to start!`);
            }

            console.log(`Player ${userId} ready status: ${isReady} in match ${matchId}`);
            return updatedPlayer;

        } catch (error) {
            console.error('Error setting player ready:', error);
            throw error;
        }
    }

    // Validate team data
    validateTeamData(teamData) {
        if (!teamData) {
            throw new Error('Team data is required');
        }

        // Validate hero selection
        if (!teamData.hero || !teamData.hero.type) {
            throw new Error('Hero selection is required');
        }

        // Validate units selection (exactly 5 units)
        if (!teamData.units || !Array.isArray(teamData.units) || teamData.units.length !== 5) {
            throw new Error('Exactly 5 units must be selected');
        }

        // Validate each unit
        teamData.units.forEach((unit, index) => {
            if (!unit || !unit.type) {
                throw new Error(`Unit ${index + 1} is invalid`);
            }
        });

        return true;
    }

    // Generate unique match ID
    generateMatchId() {
        return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get match statistics
    getMatchStats() {
        const allMatches = this.store.getAllMatches();
        return {
            total: allMatches.length,
            waiting: allMatches.filter(m => m.status === 'waiting').length,
            inLobby: allMatches.filter(m => m.status === 'in_lobby').length,
            inGame: allMatches.filter(m => m.status === 'in_game').length,
            finished: allMatches.filter(m => m.status === 'finished').length
        };
    }

    // Clean up old matches (optional - for maintenance)
    cleanupOldMatches(maxAgeHours = 24) {
        const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
        const allMatches = this.store.getAllMatches();
        let cleanedCount = 0;

        allMatches.forEach(match => {
            const matchTime = new Date(match.createdAt);
            if (matchTime < cutoffTime && match.status === 'waiting') {
                this.store.deleteMatch(match.id);
                cleanedCount++;
            }
        });

        console.log(`Cleaned up ${cleanedCount} old matches`);
        return cleanedCount;
    }
}

export default new MatchService();
