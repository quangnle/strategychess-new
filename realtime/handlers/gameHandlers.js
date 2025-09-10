import matchService from '../../services/matchService.js';
import MatchInfo from '../../core-logic/match-info.js';
import GameLogic from '../../core-logic/game-logic.js';

class GameHandlers {
    constructor() {
        this.service = matchService;
        this.gameStates = new Map(); // Store game states for each match
    }

    // Handle user joining game
    handleJoinGame(socket, io, data) {
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

            if (match.status !== 'in_game') {
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

            // Initialize game state if not exists
            if (!this.gameStates.has(matchId)) {
                this.initializeGameState(matchId, players);
            }

            const gameState = this.gameStates.get(matchId);

            // Send game state to user
            socket.emit('game:joined', {
                matchId: matchId,
                matchName: match.name,
                gameState: gameState,
                playerInfo: {
                    userId: player.userId,
                    username: player.username,
                    team: player.team
                }
            });

            // Notify other players
            socket.to(`game_${matchId}`).emit('game:player_joined', {
                userId: socket.userId,
                username: socket.username
            });

            console.log(`User ${socket.username} joined game for match ${matchId}`);

        } catch (error) {
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

            const gameState = this.gameStates.get(matchId);
            if (!gameState) {
                socket.emit('error', { message: 'Game state not found' });
                return;
            }

            // Validate it's the player's turn
            if (gameState.currentPlayer !== socket.userId) {
                socket.emit('error', { message: 'Not your turn' });
                return;
            }

            // Process the action
            const result = this.processGameAction(matchId, action, actionData, socket.userId);
            
            if (result.success) {
                // Broadcast action to all players
                io.to(`game_${matchId}`).emit('game:action', {
                    action: action,
                    actionData: actionData,
                    playerId: socket.userId,
                    result: result,
                    gameState: this.gameStates.get(matchId)
                });

                // Check for game end conditions
                this.checkGameEndConditions(matchId, io);
            } else {
                socket.emit('error', { message: result.error || 'Invalid action' });
            }

            console.log(`Game action ${action} from ${socket.username} in match ${matchId}`);

        } catch (error) {
            socket.emit('error', { message: error.message });
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

            const gameState = this.gameStates.get(matchId);
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

    // Initialize game state for a match
    initializeGameState(matchId, players) {
        const gameState = {
            matchId: matchId,
            status: 'active', // active, paused, finished
            currentPlayer: players[0].userId, // Start with first player
            turnNumber: 1,
            gameBoard: this.createInitialBoard(),
            players: players.map(p => ({
                userId: p.userId,
                username: p.username,
                team: p.team,
                isAlive: true,
                units: this.initializePlayerUnits(p.team)
            })),
            gameHistory: [],
            createdAt: new Date().toISOString()
        };

        this.gameStates.set(matchId, gameState);
        console.log(`Game state initialized for match ${matchId}`);
    }

    // Create initial game board
    createInitialBoard() {
        // This would be your game board logic
        // For now, return a simple structure
        return {
            width: 8,
            height: 8,
            cells: Array(8).fill().map(() => Array(8).fill(null))
        };
    }

    // Initialize player units based on team selection
    initializePlayerUnits(teamData) {
        if (!teamData) return [];

        const units = [];
        
        // Add hero
        if (teamData.hero) {
            units.push({
                id: `hero_${Date.now()}`,
                type: teamData.hero.type,
                isHero: true,
                position: null,
                health: 100,
                maxHealth: 100
            });
        }

        // Add regular units
        if (teamData.units) {
            teamData.units.forEach((unit, index) => {
                units.push({
                    id: `unit_${Date.now()}_${index}`,
                    type: unit.type,
                    isHero: false,
                    position: null,
                    health: 50,
                    maxHealth: 50
                });
            });
        }

        return units;
    }

    // Process game action
    processGameAction(matchId, action, actionData, playerId) {
        const gameState = this.gameStates.get(matchId);
        if (!gameState) {
            return { success: false, error: 'Game state not found' };
        }

        try {
            switch (action) {
                case 'move_unit':
                    return this.handleMoveUnit(gameState, actionData, playerId);
                case 'attack':
                    return this.handleAttack(gameState, actionData, playerId);
                case 'end_turn':
                    return this.handleEndTurn(gameState, playerId);
                default:
                    return { success: false, error: 'Unknown action' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Handle unit movement
    handleMoveUnit(gameState, actionData, playerId) {
        const { unitId, fromPosition, toPosition } = actionData;
        
        // Validate move
        if (!this.isValidMove(gameState, unitId, fromPosition, toPosition, playerId)) {
            return { success: false, error: 'Invalid move' };
        }

        // Execute move
        const player = gameState.players.find(p => p.userId === playerId);
        const unit = player.units.find(u => u.id === unitId);
        
        if (unit) {
            unit.position = toPosition;
            gameState.gameHistory.push({
                action: 'move_unit',
                playerId: playerId,
                unitId: unitId,
                fromPosition: fromPosition,
                toPosition: toPosition,
                timestamp: new Date().toISOString()
            });
        }

        return { success: true, gameState: gameState };
    }

    // Handle attack action
    handleAttack(gameState, actionData, playerId) {
        const { attackerId, targetId, targetPosition } = actionData;
        
        // Validate attack
        if (!this.isValidAttack(gameState, attackerId, targetId, targetPosition, playerId)) {
            return { success: false, error: 'Invalid attack' };
        }

        // Execute attack
        const attacker = this.findUnitById(gameState, attackerId);
        const target = this.findUnitById(gameState, targetId);
        
        if (attacker && target) {
            const damage = this.calculateDamage(attacker, target);
            target.health = Math.max(0, target.health - damage);
            
            gameState.gameHistory.push({
                action: 'attack',
                playerId: playerId,
                attackerId: attackerId,
                targetId: targetId,
                damage: damage,
                timestamp: new Date().toISOString()
            });

            // Check if target is defeated
            if (target.health <= 0) {
                target.isAlive = false;
            }
        }

        return { success: true, gameState: gameState };
    }

    // Handle end turn
    handleEndTurn(gameState, playerId) {
        if (gameState.currentPlayer !== playerId) {
            return { success: false, error: 'Not your turn' };
        }

        // Switch to next player
        const currentPlayerIndex = gameState.players.findIndex(p => p.userId === playerId);
        const nextPlayerIndex = (currentPlayerIndex + 1) % gameState.players.length;
        gameState.currentPlayer = gameState.players[nextPlayerIndex].userId;
        gameState.turnNumber++;

        gameState.gameHistory.push({
            action: 'end_turn',
            playerId: playerId,
            newCurrentPlayer: gameState.currentPlayer,
            turnNumber: gameState.turnNumber,
            timestamp: new Date().toISOString()
        });

        return { success: true, gameState: gameState };
    }

    // Validate move
    isValidMove(gameState, unitId, fromPosition, toPosition, playerId) {
        // Implement your move validation logic here
        return true; // Placeholder
    }

    // Validate attack
    isValidAttack(gameState, attackerId, targetId, targetPosition, playerId) {
        // Implement your attack validation logic here
        return true; // Placeholder
    }

    // Find unit by ID
    findUnitById(gameState, unitId) {
        for (const player of gameState.players) {
            const unit = player.units.find(u => u.id === unitId);
            if (unit) return unit;
        }
        return null;
    }

    // Calculate damage
    calculateDamage(attacker, target) {
        // Implement your damage calculation logic here
        return 25; // Placeholder
    }

    // Check game end conditions
    checkGameEndConditions(matchId, io) {
        const gameState = this.gameStates.get(matchId);
        if (!gameState) return;

        // Check if any player has no alive units
        const alivePlayers = gameState.players.filter(player => 
            player.units.some(unit => unit.isAlive)
        );

        if (alivePlayers.length <= 1) {
            // Game ended
            gameState.status = 'finished';
            gameState.winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
            
            // Update match status
            this.service.store.updateMatch(matchId, { status: 'finished' });

            // Notify all players
            io.to(`game_${matchId}`).emit('game:ended', {
                matchId: matchId,
                winner: gameState.winner,
                gameState: gameState
            });

            console.log(`Game ended for match ${matchId}, winner: ${gameState.winner?.username || 'Draw'}`);
        }
    }

    // Handle disconnect - clean up game
    handleDisconnect(socket, io) {
        if (socket.currentGameId) {
            this.handleLeaveGame(socket, io, {});
        }
    }

    // Register all game handlers
    registerHandlers(socket, io) {
        // Game events
        socket.on('game:join', (data) => this.handleJoinGame(socket, io, data));
        socket.on('game:leave', (data) => this.handleLeaveGame(socket, io, data));
        socket.on('game:action', (data) => this.handleGameAction(socket, io, data));
        socket.on('game:get_state', (data) => this.handleGetGameState(socket, io, data));
        
        // Handle disconnect
        socket.on('disconnect', () => this.handleDisconnect(socket, io));
    }
}

export default new GameHandlers();
