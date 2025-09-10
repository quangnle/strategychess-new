import matchService from '../../services/matchService.js';

class LobbyHandlers {
    constructor() {
        this.service = matchService;
    }

    // Handle user joining lobby
    handleJoinLobby(socket, io, data) {
        try {
            const { matchId } = data;
            console.log(`=== LOBBY HANDLER: handleJoinLobby called ===`);
            console.log(`MatchId: ${matchId}`);
            console.log(`Socket userId: ${socket.userId}`);
            console.log(`Socket username: ${socket.username}`);
            
            if (!socket.userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            const match = this.service.getMatch(matchId);
            if (!match) {
                socket.emit('error', { message: 'Match not found' });
                return;
            }

            // Check if user is in this match
            const players = this.service.store.getMatchPlayers(matchId);
            const player = players.find(p => p.userId === socket.userId);
            if (!player) {
                socket.emit('error', { message: 'You are not in this match' });
                return;
            }

            // Join socket room for this match
            socket.join(`match_${matchId}`);
            socket.currentMatchId = matchId;

            // Send match info to user
            socket.emit('lobby:joined', {
                match: {
                    id: match.id,
                    name: match.name,
                    status: match.status,
                    players: players.map(p => ({
                        userId: p.userId,
                        username: p.username,
                        isCreator: p.isCreator,
                        isReady: p.isReady,
                        hasTeam: !!p.team
                    }))
                }
            });

            // Notify other players in lobby
            socket.to(`match_${matchId}`).emit('lobby:player_joined', {
                userId: socket.userId,
                username: socket.username,
                players: players.map(p => ({
                    userId: p.userId,
                    username: p.username,
                    isCreator: p.isCreator,
                    isReady: p.isReady,
                    hasTeam: !!p.team
                }))
            });

            console.log(`User ${socket.username} joined lobby for match ${matchId}`);

        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    }

    // Handle user leaving lobby
    handleLeaveLobby(socket, io, data) {
        try {
            if (!socket.currentMatchId) {
                return;
            }

            const matchId = socket.currentMatchId;
            
            // Leave socket room
            socket.leave(`match_${matchId}`);
            
            // Remove user from match
            this.service.leaveMatch(matchId, socket.userId);

            // Notify other players
            socket.to(`match_${matchId}`).emit('lobby:player_left', {
                userId: socket.userId,
                username: socket.username
            });

            socket.currentMatchId = null;
            console.log(`User ${socket.username} left lobby for match ${matchId}`);

        } catch (error) {
            console.error('Error leaving lobby:', error);
        }
    }

    // Handle team selection
    handleTeamSelection(socket, io, data) {
        try {
            const { matchId, teamData } = data;
            
            if (!socket.userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            if (!socket.currentMatchId || socket.currentMatchId !== matchId) {
                socket.emit('error', { message: 'You are not in this match lobby' });
                return;
            }

            // Update player team
            const updatedPlayer = this.service.updatePlayerTeam(matchId, socket.userId, teamData);
            
            const match = this.service.getMatch(matchId);
            const players = this.service.store.getMatchPlayers(matchId);

            // Send confirmation to user
            socket.emit('lobby:team_updated', {
                team: teamData,
                players: players.map(p => ({
                    userId: p.userId,
                    username: p.username,
                    isCreator: p.isCreator,
                    isReady: p.isReady,
                    hasTeam: !!p.team
                }))
            });

            // Notify other players
            socket.to(`match_${matchId}`).emit('lobby:player_team_updated', {
                userId: socket.userId,
                username: socket.username,
                hasTeam: true,
                players: players.map(p => ({
                    userId: p.userId,
                    username: p.username,
                    isCreator: p.isCreator,
                    isReady: p.isReady,
                    hasTeam: !!p.team
                }))
            });

            console.log(`User ${socket.username} updated team in match ${matchId}`);

        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    }

    // Handle ready status toggle
    handleReadyToggle(socket, io, data) {
        try {
            const { matchId, isReady } = data;
            
            if (!socket.userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            if (!socket.currentMatchId || socket.currentMatchId !== matchId) {
                socket.emit('error', { message: 'You are not in this match lobby' });
                return;
            }

            // Update player ready status
            const updatedPlayer = this.service.setPlayerReady(matchId, socket.userId, isReady);
            
            const match = this.service.getMatch(matchId);
            const players = this.service.store.getMatchPlayers(matchId);

            // Send confirmation to user
            socket.emit('lobby:ready_updated', {
                isReady: isReady,
                players: players.map(p => ({
                    userId: p.userId,
                    username: p.username,
                    isCreator: p.isCreator,
                    isReady: p.isReady,
                    hasTeam: !!p.team
                }))
            });

            // Notify other players
            socket.to(`match_${matchId}`).emit('lobby:player_ready_updated', {
                userId: socket.userId,
                username: socket.username,
                isReady: isReady,
                players: players.map(p => ({
                    userId: p.userId,
                    username: p.username,
                    isCreator: p.isCreator,
                    isReady: p.isReady,
                    hasTeam: !!p.team
                }))
            });

            // Check if match is ready to start
            if (isReady && this.service.store.isMatchReady(matchId)) {
                console.log(`Match ${matchId} is ready to start!`);
                
                // Start the game first
                this.startGame(io, matchId);
                
                // Then notify all players that match is ready
                setTimeout(() => {
                    io.to(`match_${matchId}`).emit('lobby:match_ready', {
                        matchId: matchId,
                        message: 'All players are ready! Starting game...'
                    });
                }, 1000); // 1 second delay after starting game
            }

            console.log(`User ${socket.username} ready status: ${isReady} in match ${matchId}`);

        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    }

    // Start the game
    startGame(io, matchId) {
        try {
            const match = this.service.getMatch(matchId);
            if (!match) {
                console.error(`Match ${matchId} not found when starting game`);
                return;
            }

            console.log(`Starting game for match ${matchId}, current status: ${match.status}`);
            
            // Update match status
            this.service.store.updateMatch(matchId, { status: 'in_game' });
            
            console.log(`Match ${matchId} status updated to in_game`);
            
            // Verify match still exists after update
            const updatedMatch = this.service.getMatch(matchId);
            if (!updatedMatch) {
                console.error(`Match ${matchId} disappeared after status update!`);
                return;
            }
            console.log(`Match ${matchId} verified after update, status: ${updatedMatch.status}`);

            // Get all players and their teams
            const players = this.service.store.getMatchPlayers(matchId);
            const gameData = {
                matchId: matchId,
                matchName: match.name,
                players: players.map(p => ({
                    userId: p.userId,
                    username: p.username,
                    team: p.team
                }))
            };

            // Notify all players to start game
            io.to(`match_${matchId}`).emit('game:start', gameData);

            console.log(`Game started for match ${matchId}`);

        } catch (error) {
            console.error('Error starting game:', error);
        }
    }

    // Handle get match info request
    handleGetMatchInfo(socket, io, data) {
        try {
            const { matchId } = data;
            
            if (!socket.userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            const match = this.service.getMatch(matchId);
            if (!match) {
                socket.emit('error', { message: 'Match not found' });
                return;
            }

            const players = this.service.store.getMatchPlayers(matchId);
            const player = players.find(p => p.userId === socket.userId);
            
            if (!player) {
                socket.emit('error', { message: 'You are not in this match' });
                return;
            }

            socket.emit('lobby:match_info', {
                match: {
                    id: match.id,
                    name: match.name,
                    status: match.status,
                    players: players.map(p => ({
                        userId: p.userId,
                        username: p.username,
                        isCreator: p.isCreator,
                        isReady: p.isReady,
                        hasTeam: !!p.team
                    }))
                },
                currentPlayer: {
                    userId: player.userId,
                    username: player.username,
                    isCreator: player.isCreator,
                    isReady: player.isReady,
                    team: player.team
                }
            });

        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    }

    // Handle disconnect - clean up lobby
    handleDisconnect(socket, io) {
        if (socket.currentMatchId) {
            const matchId = socket.currentMatchId;
            
            // Check if match is in game phase - if so, don't remove players
            const match = this.service.store.getMatch(matchId);
            if (match && match.status === 'in_game') {
                console.log(`Player ${socket.username} disconnected from lobby but match is in game phase - keeping match alive`);
                // Just leave the socket room, don't remove from match
                socket.leave(`match_${matchId}`);
                socket.currentMatchId = null;
                return;
            }
            
            // Normal lobby disconnect handling
            this.handleLeaveLobby(socket, io, {});
        }
    }

    // Register all lobby handlers
    registerHandlers(socket, io) {
        // Lobby events
        socket.on('lobby:join', (data) => this.handleJoinLobby(socket, io, data));
        socket.on('lobby:leave', (data) => this.handleLeaveLobby(socket, io, data));
        socket.on('lobby:select_team', (data) => this.handleTeamSelection(socket, io, data));
        socket.on('lobby:ready', (data) => this.handleReadyToggle(socket, io, data));
        socket.on('lobby:get_info', (data) => this.handleGetMatchInfo(socket, io, data));
        
        // Handle disconnect
        socket.on('disconnect', () => this.handleDisconnect(socket, io));
    }
}

export default new LobbyHandlers();
