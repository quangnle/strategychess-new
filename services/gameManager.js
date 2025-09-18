import MatchInfo from '../core-logic/match-info.js';
import GameLogic from '../core-logic/game-logic.js';

// Mỗi game instance quản lý 1 trận đấu
class GameInstance {
    constructor(matchId, matchName, teamsData) {
        this.matchId = matchId;
        this.matchName = matchName;
        this.status = 'active'; // active, paused, finished
        this.createdAt = new Date();
        this.endedAt = null;
        this.winner = null;
        this.players = [];
        
        // Tạo matchInfo từ teamsData
        const capitalizeFirst = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
        
        const blueTeamData = {
            teamId: 'blue',
            teamName: 'Blue Team',
            hero: capitalizeFirst(teamsData.blue?.hero),
            units: (teamsData.blue?.units || []).map(unit => capitalizeFirst(unit))
        };
        
        const redTeamData = {
            teamId: 'red', 
            teamName: 'Red Team',
            hero: capitalizeFirst(teamsData.red?.hero),
            units: (teamsData.red?.units || []).map(unit => capitalizeFirst(unit))
        };
        
        try {
            this.matchInfo = MatchInfo.createNewMatch(matchId, matchName, blueTeamData, redTeamData);
            console.log(`MatchInfo created for match ${matchId}`);
            
            // Tạo game logic
            this.gameLogic = new GameLogic(this.matchInfo);
            this.gameLogic.startMatch();
            console.log(`GameLogic started for match ${matchId}`);
            
            console.log(`Game instance created successfully for match ${matchId}`);
        } catch (error) {
            console.error(`Error creating game instance for match ${matchId}:`, error);
            throw error;
        }
    }
    
    // Thêm player vào game
    addPlayer(playerId) {
        if (!this.players.includes(playerId)) {
            this.players.push(playerId);
            console.log(`Player ${playerId} added to game ${this.matchId}`);
        }
    }
    
    // Xóa player khỏi game
    removePlayer(playerId) {
        const index = this.players.indexOf(playerId);
        if (index > -1) {
            this.players.splice(index, 1);
            console.log(`Player ${playerId} removed from game ${this.matchId}`);
        }
    }
    
    // Xử lý game action for multiplayer
    processAction(playerId, action, actionData) {
        try {
            console.log(`🎮 Processing action ${action} from player ${playerId} in game ${this.matchId}`);
            
            // Validate player is in this game
            if (!this.players.includes(playerId)) {
                console.log(`❌ Player ${playerId} not in game ${this.matchId}`);
                return { success: false, error: 'Player not in this game' };
            }
            
            // Validate game is active
            if (this.status !== 'active') {
                console.log(`❌ Game ${this.matchId} is not active, status: ${this.status}`);
                return { success: false, error: 'Game is not active' };
            }
            
            // Validate it's player's turn (for most actions)
            if (action !== 'end_turn' && this.gameLogic.currentTurnTeamId) {
                // Map player to team - this needs to be implemented based on your team assignment logic
                const playerTeam = this.getPlayerTeam(playerId);
                if (playerTeam !== this.gameLogic.currentTurnTeamId) {
                    console.log(`❌ Not player ${playerId}'s turn. Current turn: ${this.gameLogic.currentTurnTeamId}, Player team: ${playerTeam}`);
                    return { success: false, error: 'Not your turn' };
                }
            }
            
            // Process action through game logic
            let result;
            switch (action) {
                case 'move_unit':
                    // Find the actual unit in gameLogic.matchInfo by ID
                    const unitToMove = this.findUnitById(actionData.unit.id);
                    if (!unitToMove) {
                        console.log(`❌ Unit with id ${actionData.unit.id} not found`);
                        return { success: false, error: 'Unit not found' };
                    }
                    console.log(`🚶 Moving unit ${unitToMove.name} from (${unitToMove.row},${unitToMove.col}) to (${actionData.row},${actionData.col})`);
                    result = this.gameLogic.makeMove(unitToMove, actionData.row, actionData.col);
                    console.log(`📍 Unit position after move: (${unitToMove.row},${unitToMove.col})`);
                    
                    // Check if unit has any remaining actions after move
                    if (result && !this.hasAvailableActions(unitToMove)) {
                        console.log(`🔄 No more actions available for ${unitToMove.name}, advancing turn`);
                        this.gameLogic.newTurn();
                    }
                    break;
                case 'attack':
                    const attackingUnit = this.findUnitById(actionData.unit.id);
                    const targetUnit = this.findUnitById(actionData.target.id);
                    if (!attackingUnit || !targetUnit) {
                        return { success: false, error: 'Unit not found' };
                    }
                    console.log(`⚔️ ${attackingUnit.name} attacking ${targetUnit.name}`);
                    result = this.gameLogic.makeAttack(attackingUnit, targetUnit);
                    if (result) {
                        console.log(`🔄 Attack completed, advancing turn`);
                        this.gameLogic.newTurn();
                    }
                    break;
                case 'heal':
                    const healingUnit = this.findUnitById(actionData.unit.id);
                    const healTarget = this.findUnitById(actionData.target.id);
                    if (!healingUnit || !healTarget) {
                        return { success: false, error: 'Unit not found' };
                    }
                    console.log(`💚 ${healingUnit.name} healing ${healTarget.name}`);
                    result = this.gameLogic.makeHeal(healingUnit, healTarget);
                    if (result) {
                        console.log(`🔄 Heal completed, advancing turn`);
                        this.gameLogic.newTurn();
                    }
                    break;
                case 'sacrifice':
                    const sacrificingUnit = this.findUnitById(actionData.unit.id);
                    const sacrificeTarget = this.findUnitById(actionData.target.id);
                    if (!sacrificingUnit || !sacrificeTarget) {
                        return { success: false, error: 'Unit not found' };
                    }
                    console.log(`🩸 ${sacrificingUnit.name} sacrificing for ${sacrificeTarget.name}`);
                    result = this.gameLogic.makeSacrifice(sacrificingUnit, sacrificeTarget);
                    if (result) {
                        console.log(`🔄 Sacrifice completed, advancing turn`);
                        this.gameLogic.newTurn();
                    }
                    break;
                case 'suicide':
                    const suicideUnit = this.findUnitById(actionData.unit.id);
                    if (!suicideUnit) {
                        return { success: false, error: 'Unit not found' };
                    }
                    console.log(`🔥 ${suicideUnit.name} committing suicide`);
                    result = this.gameLogic.makeSuicide(suicideUnit);
                    if (result) {
                        console.log(`🔄 Suicide completed, advancing turn`);
                        this.gameLogic.newTurn();
                    }
                    break;
                case 'end_turn':
                    // End turn logic (similar to play-with-ai.js)
                    console.log(`🏁 Player manually ending turn`);
                    
                    if (this.gameLogic.currentTurnUnit === null) {
                        // Nếu current unit là null, đưa 1 quân bất kỳ của team hiện tại vào alreadyEndedTurnUnits
                        const currentTeam = this.gameLogic.matchInfo.team1.teamId === this.gameLogic.currentTurnTeamId ? 
                                          this.gameLogic.matchInfo.team1 : this.gameLogic.matchInfo.team2;
                        
                        // Tìm unit đầu tiên có thể chọn (alive, không phải Base, chưa ended turn)
                        const availableUnit = currentTeam.units.find(unit => 
                            unit.hp > 0 && 
                            unit.name !== "Base" && 
                            !this.gameLogic.alreadyEndedTurnUnits.includes(unit)
                        );
                        
                        if (availableUnit) {
                            this.gameLogic.alreadyEndedTurnUnits.push(availableUnit);
                            console.log(`Added ${availableUnit.name} to alreadyEndedTurnUnits`);
                        }
                    } else {
                        // Nếu current unit đã có, xử lý end turn bình thường
                        this.gameLogic.endTurn();
                    }
                    
                    // Chuyển sang turn tiếp theo
                    this.gameLogic.newTurn();
                    result = true;
                    break;
                default:
                    console.log(`❌ Unknown action: ${action}`);
                    return { success: false, error: 'Unknown action' };
            }
            
            if (result) {
                console.log(`✅ Action ${action} processed successfully`);
                
                // Check if game ended
                const gameEndResult = this.gameLogic.isGameEnd();
                if (gameEndResult !== 0) {
                    console.log(`🏁 Game ${this.matchId} ended with result: ${gameEndResult}`);
                    this.endGame(gameEndResult);
                }
                
                return { 
                    success: true, 
                    result: result,
                    gameState: this.getGameState(),
                    gameEnded: gameEndResult !== 0
                };
            } else {
                console.log(`❌ Action ${action} failed in game logic`);
                return { success: false, error: 'Action failed' };
            }
            
        } catch (error) {
            console.error(`💥 Error processing action in game ${this.matchId}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    // Get player's team assignment
    getPlayerTeam(playerId) {
        // For now, simple assignment: first player = blue, second = red
        // This should match the logic in gameHandlers.js
        const playerIndex = this.players.indexOf(playerId);
        return playerIndex === 0 ? 'blue' : 'red';
    }
    
    // Find unit by ID in gameLogic.matchInfo
    findUnitById(unitId) {
        const allUnits = [
            ...this.gameLogic.matchInfo.team1.units,
            ...this.gameLogic.matchInfo.team2.units
        ];
        return allUnits.find(unit => unit.id === unitId);
    }
    
    // Check if unit has any available actions (attack, heal, sacrifice)
    hasAvailableActions(unit) {
        if (!unit || !this.gameLogic) return false;
        
        const canAttack = this.gameLogic.getAttackableTargets ? 
            this.gameLogic.getAttackableTargets(unit).length > 0 : false;
        const canHeal = this.gameLogic.getHealableTargets ? 
            this.gameLogic.getHealableTargets(unit).length > 0 : false;
        const canSacrifice = this.gameLogic.getSacrificeableTargets ? 
            this.gameLogic.getSacrificeableTargets(unit).length > 0 : false;
            
        return canAttack || canHeal || canSacrifice;
    }
    
    // Lấy game state for client synchronization
    getGameState() {
        return {
            matchId: this.matchId,
            status: this.status,
            currentPlayer: this.gameLogic.currentTurnTeamId,
            turnNumber: this.gameLogic.roundNo,
            gameBoard: this.gameLogic, // Send entire gameLogic for client rendering
            players: this.players.map(playerId => ({ userId: playerId })),
            winner: this.winner,
            createdAt: this.createdAt,
            endedAt: this.endedAt,
            // Additional game info for UI  
            alreadyEndedTurnUnits: this.gameLogic.alreadyEndedTurnUnits || [],
            // Add movement points for both teams
            team1MovementPoints: this.gameLogic._calculateTeamMovementPoint ? 
                this.gameLogic._calculateTeamMovementPoint(this.gameLogic.matchInfo.team1.teamId) : 0,
            team2MovementPoints: this.gameLogic._calculateTeamMovementPoint ? 
                this.gameLogic._calculateTeamMovementPoint(this.gameLogic.matchInfo.team2.teamId) : 0
        };
    }
    
    // Kết thúc game
    endGame(winner) {
        this.status = 'finished';
        this.winner = winner;
        this.endedAt = new Date();
        
        console.log(`Game ${this.matchId} ended. Winner: ${winner}`);
    }
    
    // Cleanup resources
    cleanup() {
        this.gameLogic = null;
        this.matchInfo = null;
        this.players = [];
        console.log(`Game instance ${this.matchId} cleaned up`);
    }
}

// Quản lý tất cả game instances
class ServerGameManager {
    constructor() {
        this.activeGames = new Map(); // Map<matchId, GameInstance>
        this.maxGames = 100; // Giới hạn số games
        this.cleanupInterval = null;
        
        // Start cleanup interval
        this.startCleanupInterval();
        
        console.log('ServerGameManager initialized');
    }
    
    // Tạo game instance mới
    createGame(matchId, matchName, teamsData) {
        try {
            // Check if game already exists
            if (this.activeGames.has(matchId)) {
                console.log(`Game ${matchId} already exists`);
                return this.activeGames.get(matchId);
            }
            
            // Check max games limit
            if (this.activeGames.size >= this.maxGames) {
                console.error(`Maximum games limit reached (${this.maxGames})`);
                return null;
            }
            
            // Create new game instance
            const gameInstance = new GameInstance(matchId, matchName, teamsData);
            this.activeGames.set(matchId, gameInstance);
            
            console.log(`Created game instance for match ${matchId}. Total games: ${this.activeGames.size}`);
            return gameInstance;
            
        } catch (error) {
            console.error(`Error creating game ${matchId}:`, error);
            return null;
        }
    }
    
    // Lấy game instance
    getGame(matchId) {
        return this.activeGames.get(matchId);
    }
    
    // Xóa game instance
    removeGame(matchId) {
        const game = this.activeGames.get(matchId);
        if (game) {
            game.cleanup();
            this.activeGames.delete(matchId);
            console.log(`Removed game ${matchId}. Total games: ${this.activeGames.size}`);
            return true;
        }
        return false;
    }
    
    // Xử lý action cho game cụ thể
    processAction(matchId, playerId, action, actionData) {
        const game = this.getGame(matchId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        
        return game.processAction(playerId, action, actionData);
    }
    
    // Thêm player vào game
    addPlayerToGame(matchId, playerId) {
        const game = this.getGame(matchId);
        if (game) {
            game.addPlayer(playerId);
            return true;
        }
        return false;
    }
    
    // Xóa player khỏi game
    removePlayerFromGame(matchId, playerId) {
        const game = this.getGame(matchId);
        if (game) {
            game.removePlayer(playerId);
            
            // If no players left, remove game
            if (game.players.length === 0) {
                this.removeGame(matchId);
            }
            return true;
        }
        return false;
    }
    
    // Lấy game state
    getGameState(matchId) {
        const game = this.getGame(matchId);
        return game ? game.getGameState() : null;
    }
    
    // Start cleanup interval
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupFinishedGames();
        }, 60000); // Cleanup mỗi phút
    }
    
    // Stop cleanup interval
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    
    // Cleanup finished games
    cleanupFinishedGames() {
        const now = Date.now();
        const gamesToRemove = [];
        
        for (const [matchId, game] of this.activeGames) {
            if (game.status === 'finished' && 
                game.endedAt && 
                now - game.endedAt.getTime() > 300000) { // 5 phút
                gamesToRemove.push(matchId);
            }
        }
        
        gamesToRemove.forEach(matchId => {
            this.removeGame(matchId);
        });
        
        if (gamesToRemove.length > 0) {
            console.log(`Cleaned up ${gamesToRemove.length} finished games`);
        }
    }
    
    // Get statistics
    getStats() {
        const stats = {
            totalGames: this.activeGames.size,
            activeGames: 0,
            finishedGames: 0,
            maxGames: this.maxGames
        };
        
        for (const game of this.activeGames.values()) {
            if (game.status === 'active') {
                stats.activeGames++;
            } else if (game.status === 'finished') {
                stats.finishedGames++;
            }
        }
        
        return stats;
    }
    
    // Shutdown
    shutdown() {
        this.stopCleanupInterval();
        
        // Cleanup all games
        for (const [matchId, game] of this.activeGames) {
            game.cleanup();
        }
        
        this.activeGames.clear();
        console.log('ServerGameManager shutdown complete');
    }
}

export default ServerGameManager;
