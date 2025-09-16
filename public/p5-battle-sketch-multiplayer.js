// P5 Battle Graphics cho Multiplayer - chỉ render, không xử lý game logic
import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES } from '/core-logic/definitions.js';

class P5BattleGraphicsMultiplayer {
    constructor(matchInfo, gameSocket, currentUserId, playerTeam) {
        console.log('🎨 Initializing P5 Battle Graphics for Multiplayer');
        
        this.matchInfo = matchInfo;
        this.gameSocket = gameSocket;
        this.currentUserId = currentUserId;
        this.playerTeam = playerTeam; // 'blue' or 'red'
        this.gameLogic = null; // Will be updated from server
        
        // Perspective settings - always show player team at bottom
        this.isPlayerBlue = (playerTeam === 'blue');
        console.log(`🎯 Player team: ${playerTeam}, isPlayerBlue: ${this.isPlayerBlue}`);
        
        // UI state
        this.selectedUnit = null;
        this.highlightedCells = [];
        this.actionIndicators = [];
        
        // Canvas dimensions
        this.canvasWidth = 800;
        this.canvasHeight = 700;
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
        this.offsetY = this.topPanelHeight + 10;
        
        // Load images
        this.images = {};
        this.loadImages();
        
        // Setup P5
        this.setupP5();
        
        console.log('✨ P5 Battle Graphics initialized');
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
        console.log('🔄 Updating game state from server:', gameState);
        
        if (gameState && gameState.gameBoard) {
            this.gameLogic = gameState.gameBoard;
            
            // Clear selection if it's not our turn
            if (this.gameLogic.currentTurnTeamId !== this.playerTeam) {
                this.selectedUnit = null;
                this.highlightedCells = [];
            }
        }
    }

    // Clear current selection
    clearSelection() {
        this.selectedUnit = null;
        this.highlightedCells = [];
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
        
        // Opponent team (always at top of panel)
        const opponentTeam = this.isPlayerBlue ? this.matchInfo.team2 : this.matchInfo.team1;
        this.drawTeamPanel(opponentTeam, this.offsetX, 0, teamPanelWidth, this.topPanelHeight, false);
        
        // Current unit panel (middle)
        this.drawCurrentUnitPanel(this.offsetX + teamPanelWidth, 0, teamPanelWidth, this.topPanelHeight);
        
        // Player team (always at bottom of panel)
        const playerTeam = this.isPlayerBlue ? this.matchInfo.team1 : this.matchInfo.team2;
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
        
        // Movement points
        if (this.gameLogic && this.gameLogic._calculateTeamMovementPoint) {
            const movementPoints = this.gameLogic._calculateTeamMovementPoint(team.teamId);
            this.p.textSize(10);
            this.p.text(`Movement: ${movementPoints}`, x + width / 2, y + 30);
        }
        
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
            // Unit image
            const unitSize = 30;
            const unitX = x + width / 2 - unitSize / 2;
            const unitY = y + 25;
            
            const imageKey = this.getUnitImageKey(this.selectedUnit);
            if (this.images[imageKey]) {
                this.p.image(this.images[imageKey], unitX, unitY, unitSize, unitSize);
            }
            
            // Unit info
            this.p.textSize(9);
            this.p.text(this.selectedUnit.name, x + width / 2, y + 60);
            this.p.text(`HP: ${this.selectedUnit.hp}`, x + width / 2, y + 72);
            this.p.text(`Speed: ${this.selectedUnit.speed}`, x + width / 2, y + 84);
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
        this.highlightedCells.forEach(cell => {
            const { x, y } = this.getBoardPosition(cell.row, cell.col);
            
            this.p.fill(cell.color);
            this.p.noStroke();
            this.p.rect(x, y, this.cellSize, this.cellSize);
            
            // Highlight border
            this.p.stroke(cell.borderColor || [100, 100, 100]);
            this.p.strokeWeight(2);
            this.p.noFill();
            this.p.rect(x, y, this.cellSize, this.cellSize);
        });
    }

    drawUnits() {
        if (!this.matchInfo || !this.matchInfo.team1 || !this.matchInfo.team2) {
            return;
        }
        
        // Draw all units from both teams
        const allUnits = [...this.matchInfo.team1.units, ...this.matchInfo.team2.units];
        
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
        // Check if it's our turn
        if (!this.gameLogic || this.gameLogic.currentTurnTeamId !== this.playerTeam) {
            console.log('❌ Not your turn');
            return;
        }
        
        // Check if click is within board
        if (mouseX < this.offsetX || mouseX > this.offsetX + this.boardWidth ||
            mouseY < this.offsetY || mouseY > this.offsetY + this.boardHeight) {
            return;
        }
        
        // Convert to board coordinates
        const { row, col } = this.getLogicalPosition(mouseX, mouseY);
        
        if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
            return;
        }
        
        console.log(`🖱️ Clicked on board position: (${row}, ${col})`);
        
        // Find unit at clicked position
        const clickedUnit = this.getUnitAtPosition(row, col);
        
        if (!this.selectedUnit) {
            // Try to select a unit
            if (clickedUnit && this.canSelectUnit(clickedUnit)) {
                this.selectUnit(clickedUnit);
            }
        } else {
            // Handle action with selected unit
            this.handleActionClick(row, col, clickedUnit);
        }
    }

    handleKeyPress(key) {
        if (key === 'Escape') {
            this.clearSelection();
        } else if (key === 'Enter' || key === ' ') {
            // End turn
            if (this.gameLogic && this.gameLogic.currentTurnTeamId === this.playerTeam) {
                this.sendAction('end_turn', {});
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
        if (!this.matchInfo) return null;
        
        const allUnits = [...this.matchInfo.team1.units, ...this.matchInfo.team2.units];
        return allUnits.find(unit => 
            unit.row === row && unit.col === col && unit.hp > 0
        );
    }

    getUnitImageKey(unit) {
        const isPlayerUnit = (unit.teamId === this.playerTeam);
        const unitColor = isPlayerUnit ? 'blue' : 'red';
        return `${unit.armyType || unit.name}_${unitColor}`;
    }

    canSelectUnit(unit) {
        return this.gameLogic && 
               unit.teamId === this.playerTeam &&
               unit.teamId === this.gameLogic.currentTurnTeamId &&
               !this.gameLogic.alreadyEndedTurnUnits.includes(unit) &&
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
    }

    updateHighlights() {
        this.highlightedCells = [];
        
        if (!this.selectedUnit || !this.gameLogic) return;
        
        // Get possible actions from game logic
        const reachableCells = this.gameLogic.getReachableCells ? 
            this.gameLogic.getReachableCells(this.selectedUnit) : [];
        const attackableTargets = this.gameLogic.getAttackableTargets ? 
            this.gameLogic.getAttackableTargets(this.selectedUnit) : [];
        const healableTargets = this.gameLogic.getHealableTargets ? 
            this.gameLogic.getHealableTargets(this.selectedUnit) : [];
        const sacrificeableTargets = this.gameLogic.getSacrificeableTargets ? 
            this.gameLogic.getSacrificeableTargets(this.selectedUnit) : [];
        
        // Add highlights for moveable cells
        reachableCells.forEach(cell => {
            this.highlightedCells.push({
                row: cell.row,
                col: cell.col,
                color: [144, 238, 144, 100], // Light green
                borderColor: [34, 139, 34]
            });
        });
        
        // Add highlights for attackable targets
        attackableTargets.forEach(target => {
            this.highlightedCells.push({
                row: target.row,
                col: target.col,
                color: [255, 99, 71, 120], // Red
                borderColor: [220, 20, 60]
            });
        });
        
        // Add highlights for healable targets
        healableTargets.forEach(target => {
            this.highlightedCells.push({
                row: target.row,
                col: target.col,
                color: [173, 216, 230, 120], // Light blue
                borderColor: [65, 105, 225]
            });
        });
        
        // Add highlights for sacrificeable targets
        sacrificeableTargets.forEach(target => {
            this.highlightedCells.push({
                row: target.row,
                col: target.col,
                color: [255, 255, 224, 120], // Light yellow
                borderColor: [218, 165, 32]
            });
        });
    }

    handleActionClick(row, col, clickedUnit) {
        const selectedUnit = this.selectedUnit;
        
        if (clickedUnit) {
            // Clicked on a unit
            if (clickedUnit.id === selectedUnit.id) {
                // Clicked on same unit - try suicide
                this.sendAction('suicide', { unit: selectedUnit });
            } else if (clickedUnit.teamId !== selectedUnit.teamId) {
                // Clicked on enemy unit - try attack
                this.sendAction('attack', { 
                    unit: selectedUnit, 
                    target: clickedUnit 
                });
            } else {
                // Clicked on ally unit - try heal or sacrifice
                if (selectedUnit.abilities && selectedUnit.abilities.includes('heal')) {
                    this.sendAction('heal', { 
                        unit: selectedUnit, 
                        target: clickedUnit 
                    });
                } else if (selectedUnit.abilities && selectedUnit.abilities.includes('sacrifice')) {
                    this.sendAction('sacrifice', { 
                        unit: selectedUnit, 
                        target: clickedUnit 
                    });
                } else {
                    // Try to select the clicked unit instead
                    if (this.canSelectUnit(clickedUnit)) {
                        this.selectUnit(clickedUnit);
                    }
                }
            }
        } else {
            // Clicked on empty cell - try move
            this.sendAction('move_unit', { 
                unit: selectedUnit, 
                row: row, 
                col: col 
            });
        }
    }

    sendAction(action, actionData) {
        console.log(`📤 Sending action: ${action}`, actionData);
        
        if (window.sendGameAction) {
            window.sendGameAction(action, actionData);
        } else {
            console.error('❌ sendGameAction not available');
        }
        
        // Clear selection after action
        this.clearSelection();
    }
}

export default P5BattleGraphicsMultiplayer;
