// P5 Battle Graphics cho Multiplayer - chỉ render, không xử lý game logic
import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES } from '/core-logic/definitions.js';
import GameLogic from '/core-logic/game-logic.js';

class P5BattleGraphicsMultiplayer {
    constructor(matchInfo, gameSocket, currentUserId, playerTeam) {
        
        this.matchInfo = matchInfo;
        this.gameSocket = gameSocket;
        this.currentUserId = currentUserId;
        this.playerTeam = playerTeam; // 'blue' or 'red'
        this.gameLogic = null; // Will be updated from server
        
        // Perspective settings - always show player team at bottom
        this.isPlayerBlue = (playerTeam === 'blue');
        
        // TEMPORARY DEBUG
        console.log(`🐛 DEBUG BattleGraphics Init:`, {
            playerTeam: this.playerTeam,
            isPlayerBlue: this.isPlayerBlue,
            currentUserId: this.currentUserId
        });
        
        // UI state
        this.selectedUnit = null;
        this.highlightedCells = [];
        this.actionIndicators = [];
        this.currentTurnActionArrows = [];
        this.lastTurnTeamId = null;
        
        // Canvas dimensions
        this.canvasWidth = 800;
        this.canvasHeight = 730;
        this.topPanelHeight = 100;
        
        // Calculate cell size
        this.cellSize = Math.min(
            this.canvasWidth / BOARD_COLS,
            (this.canvasHeight - this.topPanelHeight) / BOARD_ROWS
        );
        
        // Board positioning
        this.boardWidth = BOARD_COLS * this.cellSize;
        this.boardHeight = BOARD_ROWS * this.cellSize;
        this.offsetX = (this.canvasWidth - this.boardWidth) / 2;
        this.offsetY = this.topPanelHeight + 5;
        
        // Load images
        this.images = {};
        this.loadImages();
        
        // Setup P5
        this.setupP5();
        
    }

    loadImages() {
        this.imagePaths = {};
        Object.keys(UNIT_TYPES).forEach(unitType => {
            const unitData = UNIT_TYPES[unitType];
            if (unitData.image_blue) {
                this.imagePaths[`${unitType}_blue`] = unitData.image_blue;
            }
            if (unitData.image_red) {
                this.imagePaths[`${unitType}_red`] = unitData.image_red;
            }
        });
    }

    setupP5() {
        const sketch = (p) => {
            this.p = p;
            
            p.setup = () => {
                const canvas = p.createCanvas(this.canvasWidth, this.canvasHeight);
                canvas.parent('game-canvas-container');
                
                // Load images
                this.images = {};
                Object.keys(this.imagePaths).forEach(key => {
                    this.images[key] = p.loadImage(this.imagePaths[key]);
                });
                
                // Mouse click handler
                canvas.mousePressed(() => {
                    this.handleCanvasClick(p.mouseX, p.mouseY);
                });
                
                // Keyboard handler
                p.keyPressed = () => {
                    this.handleKeyPress(p.key);
                };
            };
            
            p.draw = () => {
                this.draw();
            };
        };
        
        new p5(sketch);
    }

    // Update game state from server
    updateGameState(gameState) {
        console.log(`🐛 DEBUG updateGameState called:`, {
            hasGameState: !!gameState,
            hasGameBoard: !!gameState?.gameBoard,
            playerTeam: this.playerTeam
        });
        
        // Store server game state for movement points
        this.serverGameState = gameState;
        
        if (gameState && gameState.gameBoard) {
            // Server sends gameLogic as plain object - need to recreate GameLogic instance
            const gameLogicData = gameState.gameBoard;
            
            if (gameLogicData.matchInfo) {
                // Create new GameLogic instance from server data
                this.gameLogic = new GameLogic(gameLogicData.matchInfo);
                
                // Restore state from server
                this.gameLogic.roundNo = gameLogicData.roundNo || 0;
                this.gameLogic.priorityTeamId = gameLogicData.priorityTeamId;
                this.gameLogic.alreadyEndedTurnUnits = gameLogicData.alreadyEndedTurnUnits || [];
                this.gameLogic.currentTurnUnit = gameLogicData.currentTurnUnit;
                this.gameLogic.currentTurnTeamId = gameLogicData.currentTurnTeamId;
                this.gameLogic.currentTurnActions = gameLogicData.currentTurnActions || {
                    hasMoved: false,
                    hasAttacked: false,
                    hasHealed: false,
                    hasSacrificed: false,
                    hasSuicided: false
                };
                
                // Track team changes for other purposes (no arrow clearing needed)
                if (this.lastTurnTeamId !== null && this.lastTurnTeamId !== this.gameLogic.currentTurnTeamId) {
                    console.log('🔄 Team turn changed from', this.lastTurnTeamId, 'to', this.gameLogic.currentTurnTeamId);
                    // Note: Arrow clearing now handled per-action, not per-team-change
                }
                
                this.lastTurnTeamId = this.gameLogic.currentTurnTeamId;
                
                // Clear selection in appropriate cases
                const shouldClearSelection = 
                    // Not our turn anymore
                    this.gameLogic.currentTurnTeamId !== this.playerTeam ||
                    // Selected unit has ended turn (check by ID)
                    (this.selectedUnit && this.gameLogic.alreadyEndedTurnUnits && 
                     this.gameLogic.alreadyEndedTurnUnits.some(endedUnit => endedUnit.id === this.selectedUnit.id)) ||
                    // Selected unit is dead
                    (this.selectedUnit && this.selectedUnit.hp <= 0);
                
                if (shouldClearSelection) {
                    this.selectedUnit = null;
                    this.highlightedCells = [];
                    // Clear UI info
                    if (window.updateSelectedUnitInfo) window.updateSelectedUnitInfo(null);
                    if (window.updateActionInfo) window.updateActionInfo('');
                } else if (this.selectedUnit) {
                    // 🎯 CRITICAL: Tìm unit với updated data từ server bằng ID
                    const allUnits = [...this.gameLogic.matchInfo.team1.units, ...this.gameLogic.matchInfo.team2.units];
                    const updatedUnit = allUnits.find(unit => unit.id === this.selectedUnit.id);
                    
                    if (updatedUnit && updatedUnit.hp > 0) {
                        // Update selected unit reference với server data (bao gồm position mới)
                        this.selectedUnit = updatedUnit;
                        // Update highlights for current selection với new position
                        this.updateHighlights();
                        // Update UI
                        if (window.updateSelectedUnitInfo) window.updateSelectedUnitInfo(updatedUnit);
                    } else {
                        // Unit đã chết hoặc không tìm thấy, clear selection
                        this.selectedUnit = null;
                        this.highlightedCells = [];
                        if (window.updateSelectedUnitInfo) window.updateSelectedUnitInfo(null);
                        if (window.updateActionInfo) window.updateActionInfo('');
                    }
                }
            }
        }
    }

    // Clear current selection
    clearSelection() {
            this.selectedUnit = null;
        this.highlightedCells = [];
        
        // Clear UI info
        if (window.updateSelectedUnitInfo) {
            window.updateSelectedUnitInfo(null);
        }
        
        if (window.updateActionInfo) {
            const isMyTurn = this.gameLogic && this.gameLogic.currentTurnTeamId === this.playerTeam;
            if (isMyTurn) {
                window.updateActionInfo('Select a unit to see available actions');
            } else {
                window.updateActionInfo("Opponent's turn");
            }
        }
    }

    // Action visualization methods
    addActionVisualization(actionDetails) {
        if (!actionDetails) {
            console.warn('❌ actionDetails is null/undefined');
            return;
        }
        
        console.log('🎯 CLIENT: addActionVisualization called with:', {
            type: actionDetails.type,
            hasArrowData: !!actionDetails.arrowData,
            arrowCount: actionDetails.arrowData ? actionDetails.arrowData.length : 0,
            arrowData: actionDetails.arrowData,
            fullDetails: actionDetails
        });
        
        const arrows = this.createActionArrow(actionDetails);
        
        if (arrows) {
            if (Array.isArray(arrows)) {
                // Multiple arrows (e.g., suicide)
                this.currentTurnActionArrows.push(...arrows);
                console.log(`🏹 Added ${arrows.length} arrows to visualization`);
            } else {
                // Single arrow
                this.currentTurnActionArrows.push(arrows);
                console.log('🏹 Added 1 arrow to visualization');
            }
        } else {
            console.warn('❌ createActionArrow returned null/undefined for:', actionDetails.type);
        }
    }

    // 🔧 PHASE 3: Death-aware arrow creation using server arrowData
    createActionArrow(details) {
        if (!details) {
            console.warn('❌ createActionArrow: details is null/undefined');
            return null;
        }

        // Use new arrowData structure from server (with death handling)
        if (details.arrowData && Array.isArray(details.arrowData)) {
            console.log('🔧 Using server arrowData:', details.arrowData.length, 'arrows');
            console.log('🔧 ArrowData details:', details.arrowData.map(a => ({ 
                from: `(${a.from.row},${a.from.col})`, 
                to: `(${a.to.row},${a.to.col})`, 
                style: a.style 
            })));
            const arrows = details.arrowData.map(arrowData => this.createSingleArrow(arrowData, details));
            console.log('🔧 Created arrows:', arrows.length);
            return arrows;
        }

        // Fallback for old format (backward compatibility)
        console.warn('⚠️ Using fallback arrow creation for:', details.type);
        return this.createLegacyArrow(details);
    }

    // Create individual arrow with death-aware styling
    createSingleArrow(arrowData, actionDetails) {
        const baseArrow = {
            from: arrowData.from,
            to: arrowData.to,
            metadata: {
                actionType: actionDetails.type,
                deaths: actionDetails.deaths || [],
                style: arrowData.style,
                timestamp: actionDetails.timestamp
            }
        };

        // ✅ Style-specific customization based on death analysis
        switch (arrowData.style) {
            case 'move':
                return { 
                    ...baseArrow, 
                    color: [0, 100, 255, 120], 
                    style: 'solid', 
                    width: 5 
                };
            
            case 'damage':
                return { 
                    ...baseArrow, 
                    color: [255, 99, 71, 120], 
                    style: 'solid', 
                    width: 5 
                };
            
            case 'kill':
                return { 
                    ...baseArrow, 
                    color: [255, 0, 0, 150], 
                    style: 'solid', 
                    width: 7 
                };
            
            case 'suicide_kill':
                return { 
                    ...baseArrow, 
                    color: [255, 0, 0, 150], 
                    style: 'solid', 
                    width: 7 
                };
            
            case 'suicide_damage':
                return { 
                    ...baseArrow, 
                    color: [255, 165, 0, 120], 
                    style: 'solid', 
                    width: 5 
                };
            
            case 'sacrifice':
                return { 
                    ...baseArrow, 
                    color: [148, 0, 211, 120], 
                    style: 'solid', 
                    width: 5 
                };
            
            case 'sacrifice_death':
                return { 
                    ...baseArrow, 
                    color: [75, 0, 130, 150], 
                    style: 'dashed', 
                    width: 6 
                };
            
            case 'heal':
                return { 
                    ...baseArrow, 
                    color: [0, 255, 0, 120], 
                    style: 'solid', 
                    width: 4 
                };
            
            default:
                console.warn('Unknown arrow style:', arrowData.style);
                return { 
                    ...baseArrow, 
                    color: [128, 128, 128, 120], 
                    style: 'solid', 
                    width: 3 
                };
        }
    }

    // Legacy arrow creation for backward compatibility
    createLegacyArrow(details) {
        switch(details.type) {
            case 'move':
                return {
                    from: details.fromPosition,
                    to: details.toPosition,
                    color: [0, 100, 255, 120],
                    style: 'solid',
                    width: 5,
                    metadata: { actionType: 'move', style: 'move' }
                };
                
            case 'attack':
                if (!details.attacker || !details.target) {
                    console.warn('❌ Attack arrow: Missing attacker or target');
                    return null;
                }
                
                return {
                    from: { row: details.attacker.row, col: details.attacker.col },
                    to: { row: details.target.row, col: details.target.col },
                    color: [255, 0, 0, 120],
                    style: 'solid',
                    width: 5,
                    metadata: { actionType: 'attack', style: 'damage' }
                };
                
            case 'heal':
                return {
                    from: { row: details.healer.row, col: details.healer.col },
                    to: { row: details.target.row, col: details.target.col },
                    color: [0, 255, 0, 120],
                    style: 'solid',
                    width: 4,
                    metadata: { actionType: 'heal', style: 'heal' }
                };
                
            case 'sacrifice':
                return {
                    from: { row: details.sacrificer.row, col: details.sacrificer.col },
                    to: { row: details.target.row, col: details.target.col },
                    color: [148, 0, 211, 120],
                    style: 'solid',
                    width: 5,
                    metadata: { actionType: 'sacrifice', style: 'sacrifice' }
                };
                
            case 'suicide':
                if (!details.affectedTargets || details.affectedTargets.length === 0) {
                    return null;
                }
                
                return details.affectedTargets.map(target => ({
                    from: details.suicidePosition,
                    to: { row: target.row, col: target.col },
                    color: [139, 0, 0, 120],
                    style: 'dashed',
                    width: 6,
                    metadata: { actionType: 'suicide', style: 'suicide_kill' }
                }));
                
            default:
                console.warn('Unknown legacy action type:', details.type);
                return null;
        }
    }

    clearActionArrows() {
        this.currentTurnActionArrows = [];
    }

    // Main draw function
    draw() {
        // Clear background
        this.p.background(40, 40, 50);
        
        // Check if game is ready
        if (!this.gameLogic || !this.matchInfo) {
            this.drawLoadingScreen();
            return;
        }
        
        // Check if game ended
        const gameEndResult = this.gameLogic.isGameEnd ? this.gameLogic.isGameEnd() : 0;
        if (gameEndResult !== 0) {
            this.drawGameEndScreen(gameEndResult);
            return;
        }

        // Draw game
        this.drawTopPanel();
        this.drawBoard();
        
        this.drawHighlights();
        
        this.drawUnits();
        this.drawActionArrows();
        this.drawActionIndicators();
        
    }

    drawLoadingScreen() {
        this.p.fill(255);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(24);
        this.p.text('Loading Game...', this.canvasWidth / 2, this.canvasHeight / 2);
    }

    drawGameEndScreen(result) {
        // Dark overlay
        this.p.fill(0, 0, 0, 180);
        this.p.rect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Result text
        this.p.fill(255);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(36);
        
        let resultText = '';
        let resultColor = [255, 255, 255];
        
        if (result === 1) {
            // Team 1 (blue) wins
            resultText = this.isPlayerBlue ? 'VICTORY!' : 'DEFEAT!';
            resultColor = this.isPlayerBlue ? [0, 255, 0] : [255, 0, 0];
        } else if (result === 2) {
            // Team 2 (red) wins
            resultText = this.isPlayerBlue ? 'DEFEAT!' : 'VICTORY!';
            resultColor = this.isPlayerBlue ? [255, 0, 0] : [0, 255, 0];
        } else {
            resultText = 'DRAW!';
            resultColor = [255, 255, 0];
        }
        
        this.p.fill(resultColor[0], resultColor[1], resultColor[2]);
        this.p.text(resultText, this.canvasWidth / 2, this.canvasHeight / 2);
    }

    drawTopPanel() {
        // Panel background
        this.p.fill(60, 60, 70);
        this.p.noStroke();
        this.p.rect(this.offsetX, 0, this.boardWidth, this.topPanelHeight);
        
        // Panel border
        this.p.stroke(100, 100, 120);
        this.p.strokeWeight(2);
        this.p.noFill();
        this.p.rect(this.offsetX, 0, this.boardWidth, this.topPanelHeight);
        
        // Team info
        const teamPanelWidth = this.boardWidth / 3;
        
        // Use gameLogic.matchInfo for updated data
        const matchInfo = this.gameLogic?.matchInfo || this.matchInfo;
        
        // Opponent team (always at top of panel)
        const opponentTeam = this.isPlayerBlue ? matchInfo.team2 : matchInfo.team1;
        this.drawTeamPanel(opponentTeam, this.offsetX, 0, teamPanelWidth, this.topPanelHeight, false);
        
        // Current unit panel (middle)
        this.drawCurrentUnitPanel(this.offsetX + teamPanelWidth, 0, teamPanelWidth, this.topPanelHeight);
        
        // Player team (always at bottom of panel)
        const playerTeam = this.isPlayerBlue ? matchInfo.team1 : matchInfo.team2;
        this.drawTeamPanel(playerTeam, this.offsetX + teamPanelWidth * 2, 0, teamPanelWidth, this.topPanelHeight, true);
    }

    drawTeamPanel(team, x, y, width, height, isPlayerTeam) {
        // Determine if this team has current turn
        const isCurrentTeam = this.gameLogic && team.teamId === this.gameLogic.currentTurnTeamId;
        const isMyTurn = isCurrentTeam && isPlayerTeam;
        
        // Panel background
        if (isCurrentTeam) {
            this.p.fill(60, 120, 60); // Green for active team
        } else {
            this.p.fill(50, 50, 60);
        }
        this.p.noStroke();
        this.p.rect(x, y, width, height);
        
        // Panel border
        this.p.stroke(isCurrentTeam ? 120 : 80);
        this.p.strokeWeight(2);
        this.p.noFill();
        this.p.rect(x, y, width, height);
        
        // Team info
        this.p.fill(255);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(12);
        this.p.textStyle(this.p.BOLD);
        
        const teamLabel = isPlayerTeam ? 'YOU' : 'OPPONENT';
        this.p.text(teamLabel, x + width / 2, y + 15);
        
        // Movement points - prefer server-calculated values, fallback to client calculation
        let movementPoints = 0;
        
        // Try to get from server first
        if (this.serverGameState) {
            if (team.teamId === this.gameLogic?.matchInfo?.team1?.teamId) {
                movementPoints = this.serverGameState.team1MovementPoints || 0;
            } else if (team.teamId === this.gameLogic?.matchInfo?.team2?.teamId) {
                movementPoints = this.serverGameState.team2MovementPoints || 0;
            }
        }
        
        // Fallback: calculate directly if server data not available
        if (movementPoints === 0 && this.gameLogic && team) {
            const aliveUnits = team.units.filter(u => u.hp > 0 && u.name !== "Base");
            const notYetEndedTurnUnits = aliveUnits.filter(u => {
                // Use ID comparison instead of object reference
                return !this.gameLogic.alreadyEndedTurnUnits.some(endedUnit => endedUnit.id === u.id);
            });
            movementPoints = notYetEndedTurnUnits.reduce((total, unit) => {
                // Get current speed - use same logic as core-logic
                const currentSpeed = this.gameLogic._getCurrentSpeed ? 
                    this.gameLogic._getCurrentSpeed(unit) : unit.speed;
                return total + currentSpeed;
            }, 0);
        }
        
        this.p.textSize(10);
        this.p.text(`Movement: ${movementPoints}`, x + width / 2, y + 30);
        
        // Turn indicator
        if (isMyTurn) {
            this.p.fill(255, 255, 0);
            this.p.textSize(10);
            this.p.text('YOUR TURN', x + width / 2, y + 45);
        } else if (isCurrentTeam) {
            this.p.fill(255, 100, 100);
            this.p.textSize(10);
            this.p.text('OPPONENT TURN', x + width / 2, y + 45);
        }
        
        // Priority indicator
        if (this.gameLogic && team.teamId === this.gameLogic.priorityTeamId) {
            this.p.fill(255, 255, 0);
            this.p.textSize(8);
            this.p.text('★ PRIORITY', x + width / 2, y + height - 10);
        }
    }

    drawCurrentUnitPanel(x, y, width, height) {
        // Panel background
        this.p.fill(50, 50, 60);
        this.p.noStroke();
        this.p.rect(x, y, width, height);
        
        // Panel border
        this.p.stroke(80);
        this.p.strokeWeight(2);
        this.p.noFill();
        this.p.rect(x, y, width, height);
        
        // Title
        this.p.fill(255);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(11);
        this.p.textStyle(this.p.BOLD);
        this.p.text('SELECTED UNIT', x + width / 2, y + 12);
        
        if (this.selectedUnit) {
            // Unit image (larger size)
            const unitSize = 40;
            const unitX = x + width / 2 - unitSize / 2;
            const unitY = y + 20;
            
            const imageKey = this.getUnitImageKey(this.selectedUnit);
            if (this.images[imageKey]) {
                this.p.image(this.images[imageKey], unitX, unitY, unitSize, unitSize);
            }
            
            // Unit info
            this.p.textSize(9);
            this.p.text(this.selectedUnit.name, x + width / 2, y + 65);
            
            // HP and Speed on same line with icons
            this.p.textSize(8);
            const statsText = `❤️ ${this.selectedUnit.hp}  🦵 ${this.selectedUnit.speed}`;
            this.p.text(statsText, x + width / 2, y + 78);
        } else {
            this.p.textSize(9);
            this.p.text('Click unit to select', x + width / 2, y + 50);
        }
    }

    drawBoard() {
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const { x, y } = this.getBoardPosition(row, col);
                
                // Checkerboard pattern
                const isLight = (row + col) % 2 === 0;
                this.p.fill(isLight ? 240 : 220);
                this.p.noStroke();
                this.p.rect(x, y, this.cellSize, this.cellSize);
                
                // Cell border
                this.p.stroke(200);
                this.p.strokeWeight(1);
                this.p.noFill();
                this.p.rect(x, y, this.cellSize, this.cellSize);
            }
        }
    }
    
    drawHighlights() {        
        this.highlightedCells.forEach((cell) => {
            const { x, y } = this.getBoardPosition(cell.row, cell.col);
            
            // Fill the cell with highlight color
            this.p.fill(cell.color[0], cell.color[1], cell.color[2], cell.color[3] || 255);
            this.p.noStroke();
            this.p.rect(x, y, this.cellSize, this.cellSize);
            
            // Highlight border
            this.p.stroke(cell.borderColor[0], cell.borderColor[1], cell.borderColor[2]);
            this.p.strokeWeight(3);
            this.p.noFill();
            this.p.rect(x, y, this.cellSize, this.cellSize);
        });
    }

    // 🔧 STEP 5: Enhanced action arrows with suicide explosion center
    drawActionArrows() {
        // Track suicide explosion centers to avoid duplicate drawing
        const explosionCenters = new Set();
        
        this.currentTurnActionArrows.forEach((arrow, index) => {
            // ✅ Draw basic arrow
            this.drawArrow(arrow.from, arrow.to, arrow.color, arrow.style, arrow.width);
            
            // ✅ Add death effects if applicable
            if (arrow.metadata && this.shouldShowDeathEffect(arrow.metadata.style)) {
                this.drawDeathEffect(arrow.to);
            }
            
            // ✅ Draw explosion center for suicide actions
            if (arrow.metadata && arrow.metadata.actionType === 'suicide') {
                const centerKey = `${arrow.from.row},${arrow.from.col}`;
                if (!explosionCenters.has(centerKey)) {
                    explosionCenters.add(centerKey);
                    this.drawExplosionCenter(arrow.from);
                }
            }
        });
    }

    // Draw explosion center at suicide position
    drawExplosionCenter(position) {
        const centerX = this.offsetX + position.col * this.cellSize + this.cellSize / 2;
        const centerY = this.offsetY + position.row * this.cellSize + this.cellSize / 2;
        
        // ✅ Explosion icon at suicide center
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(24); // Larger than death effects
        this.p.fill(255, 150, 0, 240); // Bright orange explosion
        this.p.text('💥', centerX, centerY);
    }

    // Determine if arrow style represents a death
    shouldShowDeathEffect(style) {
        return ['kill', 'suicide_kill', 'sacrifice_death'].includes(style);
    }

    // 🔧 STEP 5: Enhanced death effects for suicide with explosion center
    drawDeathEffect(position) {
        const centerX = this.offsetX + position.col * this.cellSize + this.cellSize / 2;
        const centerY = this.offsetY + position.row * this.cellSize + this.cellSize / 2;
        
        // ✅ Set text properties
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(20);        
        this.p.fill(255, 255, 255, 220);
        this.p.text('☠️', centerX, centerY +5); // Skull for kill
    }

    drawArrow(from, to, color, style = 'solid', width = 5) {
        if (!from || !to) {
            console.warn('❌ drawArrow: Invalid from/to positions:', { from, to });
            return;
        }
        
        if (from.row === undefined || from.col === undefined || to.row === undefined || to.col === undefined) {
            console.warn('❌ drawArrow: Missing row/col in positions:', { from, to });
            return;
        }
        
        // Get screen positions
        const fromPos = this.getBoardPosition(from.row, from.col);
        const toPos = this.getBoardPosition(to.row, to.col);
        
        // Calculate center of cells
        const x1 = fromPos.x + this.cellSize / 2;
        const y1 = fromPos.y + this.cellSize / 2;
        const x2 = toPos.x + this.cellSize / 2;
        const y2 = toPos.y + this.cellSize / 2;
        
        // Don't draw arrow if from and to are the same
        if (x1 === x2 && y1 === y2) return;
        
        // Set arrow style with transparency
        this.p.stroke(color[0], color[1], color[2], 80); //
        this.p.strokeWeight(width);
        
        if (style === 'dashed') {
            // Draw dashed line
            this.drawDashedLine(x1, y1, x2, y2, 10, 5);
        } else {
            // Draw solid line
            this.p.line(x1, y1, x2, y2);
        }
        
        // Draw arrowhead
        this.drawArrowHead(x1, y1, x2, y2, color, width);
    }

    drawDashedLine(x1, y1, x2, y2, dashLength, gapLength) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const totalDashGap = dashLength + gapLength;
        const numDashes = Math.floor(distance / totalDashGap);
        
        const deltaX = (x2 - x1) / distance;
        const deltaY = (y2 - y1) / distance;
        
        for (let i = 0; i < numDashes; i++) {
            const startX = x1 + deltaX * i * totalDashGap;
            const startY = y1 + deltaY * i * totalDashGap;
            const endX = startX + deltaX * dashLength;
            const endY = startY + deltaY * dashLength;
            
            this.p.line(startX, startY, endX, endY);
        }
    }

    drawArrowHead(x1, y1, x2, y2, color, width) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = Math.max(8, width * 2);
        
        // Calculate arrowhead points
        const x3 = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
        const y3 = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
        const x4 = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
        const y4 = y2 - arrowSize * Math.sin(angle + Math.PI / 6);
        
        // Draw filled arrowhead with transparency
        this.p.fill(color[0], color[1], color[2], 120); // 120/255 = ~47% opacity
        this.p.noStroke();
        this.p.triangle(x2, y2, x3, y3, x4, y4);
    }

    drawUnits() {
        if (!this.gameLogic || !this.gameLogic.matchInfo || !this.gameLogic.matchInfo.team1 || !this.gameLogic.matchInfo.team2) {
            return;
        }
        
        // Draw all units from both teams using updated gameLogic data
        const allUnits = [...this.gameLogic.matchInfo.team1.units, ...this.gameLogic.matchInfo.team2.units];
        
        allUnits.forEach(unit => {
            if (unit.hp > 0 && unit.row >= 0 && unit.col >= 0) {
                this.drawUnit(unit);
            }
        });
    }
    
    drawUnit(unit) {
        const { x, y } = this.getBoardPosition(unit.row, unit.col);
        
        // Determine unit color based on perspective
        const isPlayerUnit = (unit.teamId === this.playerTeam);
        const unitColor = isPlayerUnit ? 'blue' : 'red';
        
        // Unit selection highlight
        if (this.selectedUnit && this.selectedUnit.id === unit.id) {
            this.p.stroke(255, 255, 0);
            this.p.strokeWeight(3);
            this.p.noFill();
            this.p.rect(x - 2, y - 2, this.cellSize + 4, this.cellSize + 4);
        }
        
        // Selectable unit highlight (if it's player's turn and unit can be selected)
        if (this.canSelectUnit(unit)) {
            this.p.stroke(0, 255, 0);
            this.p.strokeWeight(2);
            this.p.noFill();
            this.p.rect(x, y, this.cellSize, this.cellSize);
        }
        
        // Unit image
        const imageKey = `${unit.armyType || unit.name}_${unitColor}`;
        if (this.images[imageKey]) {
            const imgSize = this.cellSize * 0.8;
            const imgX = x + (this.cellSize - imgSize) / 2;
            const imgY = y + (this.cellSize - imgSize) / 2;
            
            this.p.image(this.images[imageKey], imgX, imgY, imgSize, imgSize);
        }
            
        // HP bar
        this.drawHPBar(unit, x, y, unitColor);
            
        // Effect indicators
        this.drawEffectIndicators(unit, x, y);
    }
    
    drawHPBar(unit, x, y, unitColor) {
        const barWidth = this.cellSize * 0.8;
        const barHeight = 4;
        const barX = x + (this.cellSize - barWidth) / 2;
        const barY = y + 2;
        
        // Background
        this.p.fill(80);
        this.p.noStroke();
        this.p.rect(barX, barY, barWidth, barHeight);
        
        // HP bar
        const unitType = UNIT_TYPES[unit.armyType || unit.name];
        const maxHp = unitType ? unitType.hp : 5;
        const hpPercentage = unit.hp / maxHp;
        const hpWidth = barWidth * hpPercentage;
        
        if (unitColor === 'blue') {
            this.p.fill(100, 150, 255);
        } else {
            this.p.fill(255, 100, 100);
        }
        this.p.rect(barX, barY, hpWidth, barHeight);
    }
    
    drawEffectIndicators(unit, x, y) {
        if (!unit.effects || unit.effects.length === 0) return;
        
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(10);
        
        // Show effect icons
        unit.effects.forEach((effect, index) => {
            const iconX = x + 8 + (index * 12);
            const iconY = y + this.cellSize - 12;
            
            this.p.fill(255, 255, 255, 200);
            
            switch (effect.name) {
                case 'lock':
                    this.p.text('🔒', iconX, iconY);
                    break;
                case 'adjacent penalty':
                    this.p.text('⛔', iconX, iconY);
                    break;
                case 'dash':
                    this.p.text('💨', iconX, iconY);
                    break;
                case 'SUICIDE':
                case 'suicide':
                    this.p.text('💣', iconX, iconY);
                    break;
                default:
                    this.p.text('●', iconX, iconY);
                    break;
            }
        });
    }

    drawActionIndicators() {
        // Draw any additional action indicators here
        // For example, arrows showing recent moves
    }

    // Event handlers
    handleCanvasClick(mouseX, mouseY) {
        console.log('🖱️ Canvas clicked at:', mouseX, mouseY);
        console.log('🔍 Current state:', {
            gameLogic: !!this.gameLogic,
            currentTurnTeamId: this.gameLogic?.currentTurnTeamId,
            playerTeam: this.playerTeam,
            selectedUnit: this.selectedUnit?.name || 'none'
        });
        
        // Check if it's our turn
        if (!this.gameLogic || this.gameLogic.currentTurnTeamId !== this.playerTeam) {
            console.log('❌ Not your turn - currentTurn:', this.gameLogic?.currentTurnTeamId, 'playerTeam:', this.playerTeam);
            return;
        }
        
        // Check if click is within board
        if (mouseX < this.offsetX || mouseX > this.offsetX + this.boardWidth ||
            mouseY < this.offsetY || mouseY > this.offsetY + this.boardHeight) {
            console.log('❌ Click outside board bounds');
            return;
        }
        
        // Convert to board coordinates
        const { row, col } = this.getLogicalPosition(mouseX, mouseY);
        
        if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
            console.log('❌ Invalid board coordinates:', row, col);
            return;
        }

        console.log(`🎯 Clicked on valid board position: (${row}, ${col})`);
        
        // Find unit at clicked position
        const clickedUnit = this.getUnitAtPosition(row, col);
        console.log('🔍 Unit at position:', clickedUnit?.name || 'none');

        if (!this.selectedUnit) {
            // Try to select a unit
            if (clickedUnit && this.canSelectUnit(clickedUnit)) {
                console.log('✅ Selecting unit:', clickedUnit.name);
                this.selectUnit(clickedUnit);
            } else {
                console.log('❌ Cannot select unit at this position');
                if (clickedUnit) {
                    console.log('🐛 DEBUG canSelectUnit failed for unit:', {
                        name: clickedUnit.name,
                        teamId: clickedUnit.teamId,
                        playerTeam: this.playerTeam,
                        hasGameLogic: !!this.gameLogic,
                        currentTurnTeamId: this.gameLogic?.currentTurnTeamId,
                        alreadyEndedTurnUnits: this.gameLogic?.alreadyEndedTurnUnits?.length || 0
                    });
                }
            }
        } else {
        // Handle action with selected unit
            console.log('🎮 Handling action with selected unit:', this.selectedUnit.name);
            this.handleActionClick(row, col, clickedUnit);
        }
    }

    handleKeyPress(key) {
        if (key === 'Escape') {
            this.clearSelection();
        } else if (key === 's' || key === 'S') {
            // Skip turn
            if (this.gameLogic && this.gameLogic.currentTurnTeamId === this.playerTeam) {
                this.sendAction('end_turn', {});
                if (window.addGameLog) {
                    window.addGameLog('You skipped your turn');
                }
            }
        }
    }

    // Helper functions
    getBoardPosition(row, col) {
        // Convert logical board position to screen coordinates
        // Apply perspective transformation here
        let displayRow = row;
        let displayCol = col;
        
        // If player is red team, flip the board so player team appears at bottom
        if (!this.isPlayerBlue) {
            displayRow = BOARD_ROWS - 1 - row;
            displayCol = BOARD_COLS - 1 - col;
        }
        
        return {
            x: this.offsetX + displayCol * this.cellSize,
            y: this.offsetY + displayRow * this.cellSize
        };
    }

    getLogicalPosition(screenX, screenY) {
        // Convert screen coordinates to logical board position
        let col = Math.floor((screenX - this.offsetX) / this.cellSize);
        let row = Math.floor((screenY - this.offsetY) / this.cellSize);
        
        // Apply reverse perspective transformation
        if (!this.isPlayerBlue) {
            row = BOARD_ROWS - 1 - row;
            col = BOARD_COLS - 1 - col;
        }
        
        return { row, col };
    }

    getUnitAtPosition(row, col) {
        if (!this.gameLogic || !this.gameLogic.matchInfo) return null;
        
        // Use gameLogic.matchInfo to get updated unit data
        const allUnits = [...this.gameLogic.matchInfo.team1.units, ...this.gameLogic.matchInfo.team2.units];
        const unit = allUnits.find(unit => 
            unit.row === row && unit.col === col && unit.hp > 0
        );
        
        return unit;
    }

    getUnitImageKey(unit) {
        const isPlayerUnit = (unit.teamId === this.playerTeam);
        const unitColor = isPlayerUnit ? 'blue' : 'red';
        return `${unit.armyType || unit.name}_${unitColor}`;
    }

    canSelectUnit(unit) {
        if (!this.gameLogic || !unit) return false;
        
        // If there's a currentTurnUnit, only allow selecting that specific unit
        if (this.gameLogic.currentTurnUnit) {
            return unit.id === this.gameLogic.currentTurnUnit.id;
        }
        
        // Original logic for when no currentTurnUnit (start of turn selection)
        // Check if unit has ended turn by ID comparison (not object reference)
        const hasEndedTurn = this.gameLogic.alreadyEndedTurnUnits && 
            this.gameLogic.alreadyEndedTurnUnits.some(endedUnit => endedUnit.id === unit.id);
        
        return unit.teamId === this.playerTeam &&
               unit.teamId === this.gameLogic.currentTurnTeamId &&
               !hasEndedTurn &&
               unit.name !== "Base" &&
               unit.hp > 0;
    }

    selectUnit(unit) {
        console.log(`✅ Selected unit: ${unit.name}`);
        this.selectedUnit = unit;
        this.updateHighlights();
        
        // Update UI
        if (window.addGameLog) {
            window.addGameLog(`Selected ${unit.name}`);
        }
        
        if (window.updateSelectedUnitInfo) {
            window.updateSelectedUnitInfo(unit);
        }
        
        if (window.updateActionInfo) {
            window.updateActionInfo(`Selected ${unit.name} - Choose your action`);
        }
    }

    // Check if currently selected unit has available actions
    hasAvailableActionsForSelectedUnit() {
        if (!this.selectedUnit || !this.gameLogic) return false;
        
        // Same workaround as updateHighlights for action preview
        const originalCurrentTurnUnit = this.gameLogic.currentTurnUnit;
        const isCurrentTurnUnit = this.selectedUnit.id === originalCurrentTurnUnit?.id;
        
        if (!isCurrentTurnUnit && this.selectedUnit.teamId === this.gameLogic.currentTurnTeamId) {
            this.gameLogic.currentTurnUnit = this.selectedUnit;
        }
        
        const canAttack = this.gameLogic.getAttackableTargets ? 
            this.gameLogic.getAttackableTargets(this.selectedUnit).length > 0 : false;
        const canHeal = this.gameLogic.getHealableTargets ? 
            this.gameLogic.getHealableTargets(this.selectedUnit).length > 0 : false;
        const canSacrifice = this.gameLogic.getSacrificeableTargets ? 
            this.gameLogic.getSacrificeableTargets(this.selectedUnit).length > 0 : false;
        
        // Restore original currentTurnUnit
        if (!isCurrentTurnUnit) {
            this.gameLogic.currentTurnUnit = originalCurrentTurnUnit;
        }
            
        return canAttack || canHeal || canSacrifice;
    }

    updateHighlights() {
        this.highlightedCells = [];
        
        if (!this.selectedUnit || !this.gameLogic) return;
        
        // Get ALL possible actions from game logic (theo gameplay-vn.md)
        let reachableCells = this.gameLogic.getReachableCells ? 
            this.gameLogic.getReachableCells(this.selectedUnit) : [];
        
        // 🔧 WORKAROUND: getAttackableTargets chỉ hoạt động khi unit = currentTurnUnit
        // Nếu chưa phải currentTurnUnit, tạm set để preview targets
        let attackableTargets = [];
        let healableTargets = [];
        let sacrificeableTargets = [];
        
        const originalCurrentTurnUnit = this.gameLogic.currentTurnUnit;
        const isCurrentTurnUnit = this.selectedUnit.id === originalCurrentTurnUnit?.id;
        
        if (!isCurrentTurnUnit && this.selectedUnit.teamId === this.gameLogic.currentTurnTeamId) {
            // Tạm set làm currentTurnUnit để preview actions
            this.gameLogic.currentTurnUnit = this.selectedUnit;
        }
        
        attackableTargets = this.gameLogic.getAttackableTargets ? 
            this.gameLogic.getAttackableTargets(this.selectedUnit) : [];
        healableTargets = this.gameLogic.getHealableTargets ? 
            this.gameLogic.getHealableTargets(this.selectedUnit) : [];
        sacrificeableTargets = this.gameLogic.getSacrificeableTargets ? 
            this.gameLogic.getSacrificeableTargets(this.selectedUnit) : [];
        
        // Restore original currentTurnUnit
        if (!isCurrentTurnUnit) {
            this.gameLogic.currentTurnUnit = originalCurrentTurnUnit;
        }


        // Nếu unit hiện tại đã move thì không hiển thị ô moveable
        if (this.gameLogic.currentTurnActions.hasMoved) {
            reachableCells = [];
        }
        
        // Add highlights for moveable cells (GREEN)
        reachableCells.forEach(cell => {
            this.highlightedCells.push({
                row: cell.row,
                col: cell.col,
                type: 'move',
                color: [144, 238, 144, 120], // Light green with more opacity
                borderColor: [34, 139, 34]
            });
        });
        
        // Add highlights for attackable targets (RED)
        attackableTargets.forEach(target => {
            this.highlightedCells.push({
                row: target.row,
                col: target.col,
                type: 'attack',
                color: [255, 99, 71, 150], // Red with more opacity
                borderColor: [220, 20, 60]
            });
        });
        
        // Add highlights for healable targets (BLUE)
        healableTargets.forEach(target => {
            this.highlightedCells.push({
                row: target.row,
                col: target.col,
                type: 'heal',
                color: [173, 216, 230, 150], // Light blue with more opacity
                borderColor: [65, 105, 225]
            });
        });
        
        // Add highlights for sacrificeable targets (YELLOW)
        sacrificeableTargets.forEach(target => {
            this.highlightedCells.push({
                row: target.row,
                col: target.col,
                type: 'sacrifice',
                color: [255, 255, 224, 150], // Light yellow with more opacity
                borderColor: [218, 165, 32]
            });
        });
    }

    handleActionClick(row, col, clickedUnit) {
        const selectedUnit = this.selectedUnit;
        
        console.log(`🎯 Action click at (${row}, ${col}), clickedUnit:`, clickedUnit?.name || 'none');
        
        if (clickedUnit) {
            // Clicked on a unit - determine action type
            if (clickedUnit.id === selectedUnit.id) {
                // Clicked on same unit - try suicide
                console.log('🔥 Attempting suicide action');
                this.sendAction('suicide', { unit: selectedUnit });
                return;
            }
            
            // Check what type of action this unit can receive
            const isAttackTarget = this.isUnitInHighlights(clickedUnit, 'attack');
            const isHealTarget = this.isUnitInHighlights(clickedUnit, 'heal');
            const isSacrificeTarget = this.isUnitInHighlights(clickedUnit, 'sacrifice');
            
            if (isAttackTarget) {
                console.log('⚔️ Attacking target:', clickedUnit.name);
                this.sendAction('attack', { 
                    unit: selectedUnit, 
                    target: clickedUnit 
                });
            } else if (isHealTarget) {
                console.log('💚 Healing target:', clickedUnit.name);
                this.sendAction('heal', { 
                    unit: selectedUnit, 
                    target: clickedUnit 
                });
            } else if (isSacrificeTarget) {
                console.log('🩸 Sacrificing for target:', clickedUnit.name);
                this.sendAction('sacrifice', { 
                    unit: selectedUnit, 
                    target: clickedUnit 
                });
            } else {
                // Not a valid target, try to select this unit instead
                if (this.canSelectUnit(clickedUnit)) {
                    console.log('🎯 Selecting new unit:', clickedUnit.name);
                    this.selectUnit(clickedUnit);
                } else {
                    console.log('❌ Invalid target and cannot select unit');
                }
            }
        } else {
            // Clicked on empty cell - check if it's a moveable cell
            const isMoveableCell = this.isCellInHighlights(row, col, 'move');
            
            if (isMoveableCell) {
                console.log('🚶 Moving to:', row, col);
                this.sendAction('move_unit', { 
                    unit: selectedUnit, 
                    row: row, 
                    col: col 
                });
        } else {
                console.log('❌ Not a moveable cell');
                // Clear selection if clicked on invalid cell
                this.clearSelection();
            }
        }
    }
    
    // Helper function to check if unit is in highlights of specific type
    isUnitInHighlights(unit, actionType) {
        return this.highlightedCells.some(cell => 
            cell.row === unit.row && 
            cell.col === unit.col && 
            cell.type === actionType
        );
    }
    
    // Helper function to check if cell is in highlights of specific type
    isCellInHighlights(row, col, actionType) {
        return this.highlightedCells.some(cell => 
            cell.row === row && 
            cell.col === col && 
            cell.type === actionType
        );
    }

    sendAction(action, actionData) {
        console.log(`📤 Sending action: ${action}`, actionData);
        
        if (window.sendGameAction) {
            window.sendGameAction(action, actionData);
        } else {
            console.error('❌ sendGameAction not available');
        }
        
        // Don't clear selection immediately - wait for server response
        // Selection will be cleared when:
        // 1. Server updates game state and unit is in alreadyEndedTurnUnits
        // 2. Or when it's not our turn anymore
        console.log('⏳ Action sent, waiting for server response...');
    }
}

export default P5BattleGraphicsMultiplayer;
