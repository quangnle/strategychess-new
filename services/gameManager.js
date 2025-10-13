import MatchInfo from '../core-logic/match-info.js';
import GameLogic from '../core-logic/game-logic.js';

// Mỗi game instance quản lý 1 trận đấu
class GameInstance {
    constructor(matchId, matchName, teamsData, serverGameManagerRef = null) {
        this.matchId = matchId;
        this.matchName = matchName;
        this.status = 'active'; // active, paused, finished
        this.createdAt = new Date();
        this.endedAt = null;
        this.winner = null;
        this.players = [];
        this.serverGameManager = serverGameManagerRef; // 🔧 Store reference to access service
        
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
                const playerTeam = this.getPlayerTeam(playerId);
                if (playerTeam !== this.gameLogic.currentTurnTeamId) {
                    console.log(`❌ Not player ${playerId}'s turn. Current turn: ${this.gameLogic.currentTurnTeamId}, Player team: ${playerTeam}`);
                    return { success: false, error: 'Not your turn' };
                }
            }
            
            // 🔧 PHASE 1: Capture pre-action snapshot for death analysis
            const preActionSnapshot = this.captureUnitsSnapshot(action, actionData);
            
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
                    
                    // Store old position for action tracking
                    const oldPosition = { row: unitToMove.row, col: unitToMove.col };
                    actionData.oldPosition = oldPosition;
                    
                    console.log(`🚶 Moving unit ${unitToMove.name} from (${unitToMove.row},${unitToMove.col}) to (${actionData.row},${actionData.col})`);
                    result = this.gameLogic.makeMove(unitToMove, actionData.row, actionData.col);
                    console.log(`📍 Unit position after move: (${unitToMove.row},${unitToMove.col})`);
                    
                    // Store new position after move for action tracking
                    if (result) {
                        actionData.currentPosition = { row: unitToMove.row, col: unitToMove.col };
                    }
                    
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
            
            // 🔧 STEP 2: Enhanced analysis after action execution
            let deathAnalysis = null;
            if (result) {
                const postActionSnapshot = this.captureUnitsSnapshotPostAction(action, actionData, preActionSnapshot);
                
                if (action === 'suicide') {
                    // Use comprehensive analysis for suicide
                    const allUnitChanges = this.analyzeAllUnitChanges(preActionSnapshot, postActionSnapshot, action);
                    actionData.allUnitChanges = allUnitChanges;
                    // Keep deathAnalysis for compatibility
                    deathAnalysis = {
                        deaths: allUnitChanges.deaths,
                        totalDeaths: allUnitChanges.totalDeaths,
                        action: action
                    };
                } else {
                    // Use standard death analysis for other actions
                    deathAnalysis = this.analyzeDeaths(preActionSnapshot, postActionSnapshot, action);
                }
                
                actionData.deathAnalysis = deathAnalysis;
            }
            
            if (result) {
                console.log(`✅ Action ${action} processed successfully`);
                
                // Check if game ended
                const gameEndResult = this.gameLogic.isGameEnd();
                if (gameEndResult !== 0) {
                    console.log(`🏁 Game ${this.matchId} ended with result: ${gameEndResult}`);
                    this.endGame(gameEndResult);
                }
                
                const actionDetails = this.buildActionDetails(action, actionData, result);
                
                return { 
                    success: true, 
                    result: result,
                    gameState: this.getGameState(),
                    gameEnded: gameEndResult !== 0,
                    action: action,
                    actionDetails: actionDetails
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
    
    // 🔧 FIXED: Use same joinedAt logic as gameHandlers.js
    getPlayerTeam(playerId) {
        try {
            // Access service through serverGameManager reference
            if (this.serverGameManager && this.serverGameManager.service && this.serverGameManager.service.store) {
                const players = this.serverGameManager.service.store.getMatchPlayers(this.matchId);
                
                if (players && players.length === 2) {
                    // Use exact same logic as gameHandlers.determinePlayerTeam()
                    const sortedPlayers = players.sort((a, b) => a.joinedAt - b.joinedAt);
                    
                    // Team assignment successful using joinedAt logic
                    
                    // First player by joinedAt gets blue, second gets red
                    return playerId === sortedPlayers[0].userId ? 'blue' : 'red';
                }
            }
        } catch (error) {
            console.warn('🔧 Could not access store for team determination, using fallback:', error.message);
        }
        
        // Fallback to array index if store access fails
        const playerIndex = this.players.indexOf(playerId);
        const fallbackTeam = playerIndex === 0 ? 'blue' : 'red';
        
        console.warn(`🔧 Using fallback team assignment: ${fallbackTeam}`);
        return fallbackTeam;
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
    
    // 🔧 PHASE 2: Enhanced action details with death analysis
    buildActionDetails(action, actionData, result) {
        if (!result) {
            return null; // Only successful actions
        }

        const baseDetails = {
            type: action,
            timestamp: Date.now(),
            deaths: actionData.deathAnalysis?.deaths || []
        };

        switch(action) {
            case 'move_unit':
                return this.buildMoveDetails(actionData, baseDetails);
            case 'attack':
                return this.buildAttackDetails(actionData, baseDetails);
            case 'suicide':
                return this.buildSuicideDetails(actionData, baseDetails);
            case 'sacrifice':
                return this.buildSacrificeDetails(actionData, baseDetails);
            case 'heal':
                return this.buildHealDetails(actionData, baseDetails);
            default:
                console.warn('❌ Unknown action type for visualization:', action);
                return null;
        }
    }

    // Build move-specific details (no deaths expected)
    buildMoveDetails(actionData, baseDetails) {
        const movedUnit = this.findUnitById(actionData.unit.id);
        const fromPos = actionData.oldPosition;
        const toPos = actionData.currentPosition || { row: actionData.row, col: actionData.col };
        
        return {
            ...baseDetails,
            unit: this.getUnitSnapshot(movedUnit),
            // ✅ Arrow data - always valid positions
            arrowData: [{
                from: fromPos,
                to: toPos,
                style: 'move'
            }]
        };
    }

    // Build attack-specific details with death handling
    buildAttackDetails(actionData, baseDetails) {
        const attacker = this.findUnitById(actionData.unit.id);
        const targetDeath = baseDetails.deaths.find(d => d.unitId === actionData.target.id);
        
        return {
            ...baseDetails,
            unit: this.getUnitSnapshot(attacker),
            target: {
                id: actionData.target.id,
                name: actionData.target.name,
                wasDamaged: true,
                wasKilled: !!targetDeath,
                originalPosition: targetDeath ? targetDeath.originalPosition : null,
                currentPosition: targetDeath ? targetDeath.currentPosition : null
            },
            // ✅ Arrow data - always valid positions
            arrowData: [{
                from: { row: attacker.row, col: attacker.col },
                to: targetDeath ? targetDeath.originalPosition : { row: actionData.target.row, col: actionData.target.col },
                style: targetDeath ? 'kill' : 'damage'
            }]
        };
    }

    // 🔧 STEP 3: Enhanced suicide details with comprehensive target info
    buildSuicideDetails(actionData, baseDetails) {
        const suicider = actionData.unit;
        const allChanges = actionData.allUnitChanges; // Enhanced comprehensive data
        
        if (!allChanges) {
            // Fallback to old behavior if no enhanced data
            console.warn('⚠️ No allUnitChanges data, using fallback suicide details');
            const suiciderDeath = baseDetails.deaths.find(d => d.unitId === suicider.id);
            const victimDeaths = baseDetails.deaths.filter(d => d.unitId !== suicider.id);
            
            return {
                ...baseDetails,
                unit: this.getUnitSnapshot(suicider),
                suiciderDied: !!suiciderDeath,
                arrowData: victimDeaths.map(victim => ({
                    from: { row: suicider.row, col: suicider.col },
                    to: victim.originalPosition,
                    style: 'suicide_kill'
                }))
            };
        }
        
        // Enhanced suicide details with comprehensive target information
        const suiciderDeath = allChanges.deaths.find(d => d.unitId === suicider.id);
        const killedTargets = allChanges.deaths.filter(d => d.unitId !== suicider.id);
        const damagedTargets = allChanges.damaged.filter(d => d.unitId !== suicider.id);

        // Create arrow data
        const arrowData = [
            // Red arrows to killed targets
            ...killedTargets.map(victim => ({
                from: suiciderDeath ? suiciderDeath.originalPosition : { row: suicider.row, col: suicider.col },
                to: victim.originalPosition,
                style: 'suicide_kill',
                targetType: 'killed',
                targetName: victim.unitName
            })),
            
            // Orange arrows to damaged targets
            ...damagedTargets.map(victim => ({
                from: suiciderDeath ? suiciderDeath.originalPosition : { row: suicider.row, col: suicider.col },
                to: victim.originalPosition,
                style: 'suicide_damage',
                targetType: 'damaged',
                targetName: victim.unitName,
                damageDealt: victim.damageTaken
            }))
        ];
        
        return {
            ...baseDetails,
            unit: this.getUnitSnapshot(suicider),
            suiciderDied: !!suiciderDeath,
            
            // ✅ Comprehensive target categorization
            killedTargets: killedTargets.map(death => ({
                id: death.unitId,
                name: death.unitName,
                originalPosition: death.originalPosition,
                currentPosition: death.currentPosition,
                teamId: death.teamId
            })),
            
            damagedTargets: damagedTargets.map(damage => ({
                id: damage.unitId,
                name: damage.unitName,
                position: damage.originalPosition,
                hpBefore: damage.hpBefore,
                hpAfter: damage.hpAfter,
                damageTaken: damage.damageTaken,
                teamId: damage.teamId
            })),
            
            // ✅ Arrows for ALL affected targets (killed + damaged)
            arrowData: arrowData,
            
            // ✅ Special effect positions for client rendering
            effectPositions: {
                explosionCenter: suiciderDeath ? suiciderDeath.originalPosition : { row: suicider.row, col: suicider.col },
                deathMarkers: killedTargets.map(d => d.originalPosition)
            }
        };
    }

    // Build sacrifice-specific details with potential sacrificer death
    buildSacrificeDetails(actionData, baseDetails) {
        const sacrificer = this.findUnitById(actionData.unit.id);
        const target = this.findUnitById(actionData.target.id);
        const sacrificerDeath = baseDetails.deaths.find(d => d.unitId === actionData.unit.id);
        
        return {
            ...baseDetails,
            unit: this.getUnitSnapshot(actionData.unit),
            target: this.getUnitSnapshot(target),
            sacrificerDied: !!sacrificerDeath,
            // ✅ Arrow from sacrificer's original position to target
            arrowData: [{
                from: sacrificerDeath ? sacrificerDeath.originalPosition : { row: sacrificer.row, col: sacrificer.col },
                to: { row: target.row, col: target.col },
                style: sacrificerDeath ? 'sacrifice_death' : 'sacrifice'
            }]
        };
    }

    // Build heal-specific details (no deaths expected)
    buildHealDetails(actionData, baseDetails) {
        const healer = this.findUnitById(actionData.unit.id);
        const target = this.findUnitById(actionData.target.id);
        
        return {
            ...baseDetails,
            unit: this.getUnitSnapshot(healer),
            target: this.getUnitSnapshot(target),
            // ✅ Normal arrow - no death concerns
            arrowData: [{
                from: { row: healer.row, col: healer.col },
                to: { row: target.row, col: target.col },
                style: 'heal'
            }]
        };
    }

    // Helper: Get clean unit snapshot
    getUnitSnapshot(unit) {
        if (!unit) return null;
        return {
            id: unit.id,
            name: unit.name,
            hp: unit.hp,
            position: { row: unit.row, col: unit.col },
            teamId: unit.teamId
        };
    }
    
    // Calculate targets affected by suicide action
    calculateSuicideTargets(unit) {
        if (!unit || !this.gameLogic) return [];
        
        // Get 8 adjacent cells using game logic method
        const adjacentCells = this.gameLogic._get8AdjacentCells ? 
            this.gameLogic._get8AdjacentCells(unit.row, unit.col) :
            this.get8AdjacentCells(unit.row, unit.col);
        
        // Find enemy units in those cells
        const targets = adjacentCells
            .map(cell => this.gameLogic._getUnitByPosition ? 
                this.gameLogic._getUnitByPosition(cell.row, cell.col) :
                this.getUnitAtPosition(cell.row, cell.col))
            .filter(target => target && target.teamId !== unit.teamId);
            
        return targets;
    }
    
    // Helper method to get 8 adjacent cells (if not available in gameLogic)
    get8AdjacentCells(row, col) {
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        return directions
            .map(([deltaRow, deltaCol]) => ({
                row: row + deltaRow,
                col: col + deltaCol
            }))
            .filter(cell => 
                cell.row >= 0 && cell.row < 12 && // BOARD_ROWS
                cell.col >= 0 && cell.col < 11   // BOARD_COLS
            );
    }
    
    // Helper method to get unit at position (if not available in gameLogic)
    getUnitAtPosition(row, col) {
        const allUnits = [
            ...this.gameLogic.matchInfo.team1.units,
            ...this.gameLogic.matchInfo.team2.units
        ];
        return allUnits.find(unit => 
            unit.row === row && unit.col === col && unit.hp > 0
        );
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
    
    // Kết thúc game bằng forfeit (player đối thủ thoát ra)
    forfeitGame(winnerPlayerId) {
        this.status = 'finished';
        this.endedAt = new Date();
        
        // Determine winner team based on player ID
        const winnerTeam = this.getPlayerTeam(winnerPlayerId);
        
        // Set winner info
        this.winner = {
            teamId: winnerTeam,
            playerId: winnerPlayerId,
            reason: 'opponent_forfeit'
        };
        
        console.log(`Game ${this.matchId} ended by forfeit. Winner: ${winnerPlayerId} (${winnerTeam} team)`);
        
        return this.winner;
    }
    
    // Cleanup resources
    cleanup() {
        this.gameLogic = null;
        this.matchInfo = null;
        this.players = [];
        console.log(`Game instance ${this.matchId} cleaned up`);
    }

    // 🔧 PHASE 1: Snapshot capture for death analysis
    captureUnitsSnapshot(action, actionData) {
        const relevantUnits = this.getRelevantUnits(action, actionData);
        
        return relevantUnits.map(unit => ({
            id: unit.id,
            name: unit.name,
            hp: unit.hp,
            position: { row: unit.row, col: unit.col },
            isAlive: unit.hp > 0,
            teamId: unit.teamId
        }));
    }

    // 🔧 PHASE 2: Post-action snapshot that handles dead units correctly
    captureUnitsSnapshotPostAction(action, actionData, preActionSnapshot) {
        if (action === 'suicide') {
            // For suicide, use pre-action unit IDs to ensure we capture all affected units
            // even if suicide unit is now off-board
            const postUnits = preActionSnapshot.map(preUnit => {
                const currentUnit = this.findUnitById(preUnit.id);
                if (!currentUnit) {
                    console.warn(`⚠️ Unit ${preUnit.id} not found in current game state`);
                    return null;
                }
                
                const isOffBoard = currentUnit.row === null || currentUnit.col === null;
                const resultUnit = {
                    id: currentUnit.id,
                    name: currentUnit.name,
                    hp: currentUnit.hp,
                    position: isOffBoard 
                        ? preUnit.position // ✅ Use pre-action position for dead units
                        : { row: currentUnit.row, col: currentUnit.col },
                    isAlive: currentUnit.hp > 0,
                    teamId: currentUnit.teamId
                };
                
                return resultUnit;
            }).filter(unit => unit !== null);
            
            return postUnits;
        } else {
            // For other actions, use normal snapshot
            return this.captureUnitsSnapshot(action, actionData);
        }
    }

    // Get units that could be affected by the action
    getRelevantUnits(action, actionData) {
        const allUnits = [
            ...this.gameLogic.matchInfo.team1.units,
            ...this.gameLogic.matchInfo.team2.units
        ];

        switch (action) {
            case 'attack':
                // Attacker and target
                return allUnits.filter(unit => 
                    unit.id === actionData.unit.id || 
                    unit.id === actionData.target.id
                );
            
            case 'suicide':
                // Suicide unit and all adjacent units
                const suicideUnit = allUnits.find(u => u.id === actionData.unit.id);
                if (!suicideUnit) return [];
                
                // ✅ Use existing public method instead of private gameLogic method
                const adjacentCells = this.get8AdjacentCells(suicideUnit.row, suicideUnit.col);
                const adjacentUnits = allUnits.filter(unit => 
                    adjacentCells.some(cell => cell.row === unit.row && cell.col === unit.col)
                );
                
                return [suicideUnit, ...adjacentUnits];
            
            case 'sacrifice':
                // Sacrificer and target
                return allUnits.filter(unit => 
                    unit.id === actionData.unit.id || 
                    unit.id === actionData.target.id
                );
            
            case 'heal':
                // Healer and target (heal doesn't cause death but included for consistency)
                return allUnits.filter(unit => 
                    unit.id === actionData.unit.id || 
                    unit.id === actionData.target.id
                );
            
            case 'move_unit':
                // Just the moving unit (move doesn't cause death)
                return allUnits.filter(unit => unit.id === actionData.unit.id);
            
            default:
                return [];
        }
    }

    // Analyze what units died between snapshots
    analyzeDeaths(beforeSnapshot, afterSnapshot, action) {
        const deaths = [];
        
        beforeSnapshot.forEach(beforeUnit => {
            const afterUnit = afterSnapshot.find(u => u.id === beforeUnit.id);
            
            if (beforeUnit.isAlive && (!afterUnit || !afterUnit.isAlive)) {
                deaths.push({
                    unitId: beforeUnit.id,
                    unitName: beforeUnit.name,
                    teamId: beforeUnit.teamId,
                    originalPosition: beforeUnit.position,
                    currentPosition: afterUnit ? afterUnit.position : { row: -1, col: -1 },
                    deathCause: this.determineDeathCause(beforeUnit.id, action),
                    originalHP: beforeUnit.hp,
                    currentHP: afterUnit ? afterUnit.hp : 0
                });
            }
        });

        return {
            deaths,
            totalDeaths: deaths.length,
            action: action
        };
    }

    // 🔧 STEP 1: Comprehensive unit change analysis for suicide
    analyzeAllUnitChanges(beforeSnapshot, afterSnapshot, action) {
        const changes = {
            deaths: [],      // Units died (hp > 0 → hp = 0)  
            damaged: [],     // Units damaged (hp decreased but alive)
            unaffected: []   // Units in area but no change
        };
        
        beforeSnapshot.forEach(beforeUnit => {
            const afterUnit = afterSnapshot.find(u => u.id === beforeUnit.id);
            
            if (!afterUnit) {
                // Unit missing in after snapshot (shouldn't happen but safety check)
                console.log(`⚠️ Unit ${beforeUnit.id} missing in after snapshot`);
                return;
            }
            
            if (beforeUnit.isAlive && !afterUnit.isAlive) {
                // Unit died
                changes.deaths.push({
                    unitId: beforeUnit.id,
                    unitName: beforeUnit.name,
                    teamId: beforeUnit.teamId,
                    originalPosition: beforeUnit.position,
                    currentPosition: afterUnit.position,
                    deathCause: this.determineDeathCause(beforeUnit.id, action),
                    originalHP: beforeUnit.hp,
                    currentHP: afterUnit.hp
                });
            } else if (beforeUnit.hp > afterUnit.hp) {
                // Unit damaged but alive
                changes.damaged.push({
                    unitId: beforeUnit.id,
                    unitName: beforeUnit.name,
                    teamId: beforeUnit.teamId,
                    originalPosition: beforeUnit.position,
                    currentPosition: afterUnit.position,
                    hpBefore: beforeUnit.hp,
                    hpAfter: afterUnit.hp,
                    damageTaken: beforeUnit.hp - afterUnit.hp
                });
            } else {
                // Unit unaffected (in range but no damage)
                changes.unaffected.push({
                    unitId: beforeUnit.id,
                    unitName: beforeUnit.name,
                    teamId: beforeUnit.teamId,
                    position: beforeUnit.position
                });
            }
        });
        
        return {
            ...changes,
            totalDeaths: changes.deaths.length,
            totalDamaged: changes.damaged.length,
            totalUnaffected: changes.unaffected.length,
            action: action
        };
    }

    // Determine the cause of death for visualization
    determineDeathCause(unitId, action) {
        switch (action) {
            case 'attack':
                return 'killed_by_attack';
            case 'suicide':
                return 'killed_by_suicide';
            case 'sacrifice':
                return 'died_from_sacrifice';
            default:
                return 'unknown';
        }
    }
}

// Quản lý tất cả game instances
class ServerGameManager {
    constructor(service = null) {
        this.activeGames = new Map(); // Map<matchId, GameInstance>
        this.maxGames = 100; // Giới hạn số games
        this.cleanupInterval = null;
        this.service = service; // 🔧 Store service reference for team assignment
        
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
            const gameInstance = new GameInstance(matchId, matchName, teamsData, this);
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
