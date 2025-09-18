import matchService from '../../services/matchService.js';
import ServerGameManager from '../../services/gameManager.js';

class GameHandlers {
    constructor() {
        this.service = matchService;
        this.gameManager = new ServerGameManager(); // Use centralized game manager
    }

    // Handle user joining game
    handleJoinGame(socket, io, data) {
        try {
            const { matchId } = data;
            console.log(`=== GAME HANDLER: handleJoinGame called ===`);
            console.log(`MatchId: ${matchId}`);
            console.log(`Socket userId: ${socket.userId}`);
            console.log(`Socket username: ${socket.username}`);
            
            if (!socket.userId) {
                console.log('User not authenticated');
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            const match = this.service.getMatch(matchId);
            if (!match) {
                console.error(`Match ${matchId} not found in gameHandlers`);
                console.error('Available matches:', Array.from(this.service.store.matches.keys()));
                socket.emit('error', { message: 'Match not found' });
                return;
            }

            console.log(`Match ${matchId} status: ${match.status}`);
            if (match.status !== 'in_game') {
                console.error(`Match ${matchId} is not in game phase, status: ${match.status}`);
                socket.emit('error', { message: 'Match is not in game phase' });
                return;
            }

            // Check if user is in this match
            const players = this.service.store.getMatchPlayers(matchId);
            const player = players.find(p => p.userId === socket.userId);
            if (!player) {
                socket.emit('error', { message: 'You are not in this match' });
                return;
            }

            // Join socket room for this game
            socket.join(`game_${matchId}`);
            socket.currentGameId = matchId;

            // Get or create game instance
            let gameInstance = this.gameManager.getGame(matchId);
            if (!gameInstance) {
                console.log(`Creating new game instance for match ${matchId}`);
                
                // Get teams data and create game instance
                const teamsData = this.service.getTeamsData(matchId);
                console.log(`Teams data for match ${matchId}:`, JSON.stringify(teamsData, null, 2));
                
                if (!teamsData) {
                    console.error(`Teams data not found for match ${matchId}`);
                    socket.emit('error', { message: 'Teams data not found' });
                    return;
                }
                
                try {
                    gameInstance = this.gameManager.createGame(matchId, match.name, teamsData);
                    if (!gameInstance) {
                        console.error(`Failed to create game instance for match ${matchId}`);
                        socket.emit('error', { message: 'Failed to create game instance' });
                        return;
                    }
                    console.log(`Game instance created successfully for match ${matchId}`);
                } catch (error) {
                    console.error(`Error creating game instance for match ${matchId}:`, error);
                    socket.emit('error', { message: `Failed to create game instance: ${error.message}` });
                    return;
                }
            } else {
                console.log(`Using existing game instance for match ${matchId}`);
            }

            // Add player to game instance
            this.gameManager.addPlayerToGame(matchId, socket.userId);

            // Get game state
            const gameState = this.gameManager.getGameState(matchId);

            // Determine player's team for perspective
            const playerTeamId = this.determinePlayerTeam(player, match);
            
            // Send game state to user
            socket.emit('game:joined', {
                matchId: matchId,
                matchName: match.name,
                matchInfo: gameInstance.matchInfo, // Send matchInfo for rendering
                gameState: gameState,
                playerInfo: {
                    userId: player.userId,
                    username: player.username,
                    team: player.team,
                    teamId: playerTeamId // Team ID for perspective (blue/red)
                }
            });

            // Notify other players
            socket.to(`game_${matchId}`).emit('game:player_joined', {
                userId: socket.userId,
                username: socket.username
            });

            console.log(`User ${socket.username} joined game for match ${matchId}`);

        } catch (error) {
            console.error('Error joining game:', error);
            socket.emit('error', { message: error.message });
        }
    }

    // Handle user leaving game
    handleLeaveGame(socket, io, data) {
        try {
            if (!socket.currentGameId) {
                return;
            }

            const matchId = socket.currentGameId;
            
            // Remove player from game instance
            this.gameManager.removePlayerFromGame(matchId, socket.userId);
            
            // Leave socket room
            socket.leave(`game_${matchId}`);
            
            // Notify other players
            socket.to(`game_${matchId}`).emit('game:player_left', {
                userId: socket.userId,
                username: socket.username
            });

            socket.currentGameId = null;
            console.log(`User ${socket.username} left game for match ${matchId}`);

        } catch (error) {
            console.error('Error leaving game:', error);
        }
    }

    // Handle game move/action
    handleGameAction(socket, io, data) {
        try {
            const { matchId, action, actionData } = data;
            
            if (!socket.userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            if (!socket.currentGameId || socket.currentGameId !== matchId) {
                socket.emit('error', { message: 'You are not in this game' });
                return;
            }

            // Process action through game manager
            const result = this.gameManager.processAction(matchId, socket.userId, action, actionData);
            
            if (result.success) {
                // Broadcast action result to all players in the game
                io.to(`game_${matchId}`).emit('game:action_result', {
                    matchId: matchId,
                    action: action,
                    actionData: actionData,
                    playerId: socket.userId,
                    result: result.result,
                    gameState: result.gameState,
                    gameEnded: result.gameEnded
                });
                
                // If game ended, notify all players
                if (result.gameEnded) {
                    const gameInstance = this.gameManager.getGame(matchId);
                    io.to(`game_${matchId}`).emit('game:ended', {
                        matchId: matchId,
                        winner: gameInstance.winner,
                        gameState: result.gameState
                    });
                }

            } else {
                socket.emit('game:action_error', { error: result.error });
            }

            console.log(`Game action ${action} from ${socket.username} in match ${matchId}`);

        } catch (error) {
            console.error('Error handling game action:', error);
            socket.emit('game:action_error', { message: error.message });
        }
    }

    // Handle get game state request
    handleGetGameState(socket, io, data) {
        try {
            const { matchId } = data;
            
            if (!socket.userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            const gameState = this.gameManager.getGameState(matchId);
            if (!gameState) {
                socket.emit('error', { message: 'Game state not found' });
                return;
            }

            socket.emit('game:state', {
                matchId: matchId,
                gameState: gameState
            });

        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    }

    // Register all game event handlers
    registerHandlers(socket, io) {
        socket.on('game:join', (data) => {
            this.handleJoinGame(socket, io, data);
        });

        socket.on('game:leave', (data) => {
            this.handleLeaveGame(socket, io, data);
        });

        socket.on('game:action', (data) => {
            this.handleGameAction(socket, io, data);
        });

        socket.on('game:get_state', (data) => {
            this.handleGetGameState(socket, io, data);
        });
    }

    // Handle socket disconnection
    handleDisconnect(socket, io) {
        try {
            if (socket.currentGameId) {
                const matchId = socket.currentGameId;
                
                // Remove player from game instance
                this.gameManager.removePlayerFromGame(matchId, socket.userId);
                
                // Notify other players
                socket.to(`game_${matchId}`).emit('game:player_left', {
                    userId: socket.userId,
                    username: socket.username
                });

                console.log(`User ${socket.username} disconnected from game ${matchId}`);
            }
        } catch (error) {
            console.error('Error handling game disconnect:', error);
        }
    }
    
    // Determine player's team for perspective rendering
    determinePlayerTeam(player, match) {
        // Get all players in the match
        const players = this.service.store.getMatchPlayers(match.id);
        
        console.log(`🐛 DEBUG determinePlayerTeam for ${player.username} (${player.userId}):`);
        console.log(`  - players.length: ${players.length}`);
        console.log(`  - players:`, players.map(p => ({ userId: p.userId, username: p.username, joinedAt: p.joinedAt })));
        
        // If there are exactly 2 players, assign teams based on order
        if (players.length === 2) {
            const sortedPlayers = players.sort((a, b) => a.joinedAt - b.joinedAt);
            
            console.log(`  - sortedPlayers:`, sortedPlayers.map(p => ({ userId: p.userId, username: p.username, joinedAt: p.joinedAt })));
            
            // First player gets blue team, second gets red team
            if (player.userId === sortedPlayers[0].userId) {
                console.log(`  - RESULT: blue (first player)`);
                return 'blue';
            } else {
                console.log(`  - RESULT: red (second player)`);
                return 'red';
            }
        }
        
        console.log(`  - FALLBACK: blue (players.length = ${players.length})`);
        // Default fallback
        return 'blue';
    }
}

export default GameHandlers;