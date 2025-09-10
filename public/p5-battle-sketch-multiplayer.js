import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES, SACRIFICE, HEAL } from '/core-logic/definitions.js';
import MatchInfo from '/core-logic/match-info.js';
import GameLogic from '/core-logic/game-logic.js'; // For type reference, not local execution

class P5BattleGraphicsMultiplayer {
    constructor(matchInfo, gameSocket, currentUserId, playerTeam = null) {
        this.matchInfo = matchInfo; // Use matchInfo directly from server
        this.gameSocket = gameSocket;
        this.currentUserId = currentUserId;
        this.playerTeam = playerTeam; // 'blue' or 'red' - determines perspective
        this.gameLogic = null; // Will be updated by server
        this.selectedUnit = null;
        this.currentAction = null; // 'move', 'attack', 'heal', 'sacrifice', 'suicide'
        
        // Canvas dimensions (same as play-with-ai)
        this.canvasWidth = 750;
        this.canvasHeight = 700;
        this.topPanelHeight = 100;
        
        // Calculate cell size based on canvas dimensions (excluding top panel)
        this.cellSize = Math.min(
            this.canvasWidth / BOARD_COLS,
            (this.canvasHeight - this.topPanelHeight) / BOARD_ROWS
        );
        
        // Calculate board dimensions
        this.boardWidth = BOARD_COLS * this.cellSize;
        this.boardHeight = BOARD_ROWS * this.cellSize;
        
        // Position board in center (below top panel with 5px gap)
        this.offsetX = (this.canvasWidth - this.boardWidth) / 2;
        this.offsetY = this.topPanelHeight + 5 + (this.canvasHeight - this.topPanelHeight - 5 - this.boardHeight) / 2;
        
        // Load images
        this.images = {};
        this.loadImages();
        
        // Setup p5.js
        this.setupP5();
        
        this.recentActions = [];
    }

    loadImages() {
        // Images will be loaded in the p5 setup function
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
                
                // Load images in p5 context
                this.images = {};
                Object.keys(this.imagePaths).forEach(key => {
                    this.images[key] = p.loadImage(this.imagePaths[key]);
                });
                
                // Setup click event
                canvas.mousePressed(() => {
                    // Check if game ended
                    if (this.gameLogic && this.gameLogic.isGameEnd() !== 0) {
                        this.drawGameEndInfoBoard(this.gameLogic.isGameEnd());
                        return;
                    }

                    this.handleCanvasClick(p.mouseX, p.mouseY);
                });
                
                // Setup keyboard event
                p.keyPressed = () => {
                    // Check if game ended
                    if (this.gameLogic && this.gameLogic.isGameEnd() !== 0) {
                        this.drawGameEndInfoBoard(this.gameLogic.isGameEnd());
                        return;
                    }

                    this.handleKeyPress(p.key);
                };
            };
            
            p.draw = () => {
                this.draw();
            };
        };
        
        new p5(sketch);
    }

    updateGameState(gameState) {
        console.log('Updating game state:', gameState);
        
        // Update game state from server
        if (gameState && gameState.gameBoard) {
            this.gameLogic = gameState.gameBoard; // gameBoard contains the GameLogic instance
            console.log('GameLogic updated:', this.gameLogic);
        }
        
        // Clear selected unit and action if it's not our turn anymore
        if (this.gameLogic && this.gameLogic.currentTurnTeamId !== this.currentUserId) {
            this.selectedUnit = null;
            this.currentAction = null;
        }
    }

    draw() {
        // Clear canvas with background
        this.p.background(51); // Dark gray background
        
        // Check if game ended
        if (this.gameLogic && this.gameLogic.isGameEnd() !== 0) {
            this.drawGameEndInfoBoard(this.gameLogic.isGameEnd());
            return;
        }

        this.drawTopPanel();
        this.drawBoard();
        this.drawUnits();
        this.highlightReachableCells();
        this.drawRecentActions();
    }

    drawBoard() {
        // Draw alternating squares
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const x = this.offsetX + col * this.cellSize;
                const y = this.offsetY + row * this.cellSize;
                
                // Alternate colors: white and light gray
                const isEven = (row + col) % 2 === 0;
                this.p.fill(isEven ? 255 : 240);
                
                this.p.rect(x, y, this.cellSize, this.cellSize);
                
                // Draw border
                this.p.stroke(204);
                this.p.strokeWeight(1);
                this.p.noFill();
                this.p.rect(x, y, this.cellSize, this.cellSize);
            }
        }
    }
    
    drawUnits() {
        if (!this.matchInfo || !this.matchInfo.team1 || !this.matchInfo.team2) {
            console.error('MatchInfo not properly initialized:', this.matchInfo);
            return;
        }
        
        // Determine which team is the player's team based on perspective
        const playerTeam = this.playerTeam || 'blue'; // Default to blue if not specified
        const isPlayerBlue = playerTeam === 'blue';
        
        console.log(`Player team: ${playerTeam}, isPlayerBlue: ${isPlayerBlue}`);
        console.log('Team1 (blue):', this.matchInfo.team1);
        console.log('Team2 (red):', this.matchInfo.team2);
        
        // Render both teams with proper perspective
        console.log('Rendering both teams with player perspective');
        
        // Render both teams without flipping - they should be at different positions already
        console.log('Drawing both teams at their original positions');
        this.drawTeamUnits(this.matchInfo.team1, true, false);   // Blue team (should be at bottom)
        this.drawTeamUnits(this.matchInfo.team2, false, false);  // Red team (should be at top)
    }
    
    drawTeamUnits(team, isBlueTeam, flipPerspective = false) {
        if (!team || !team.units) {
            console.error('Team units not found:', team);
            return;
        }
        
        console.log(`Drawing team ${team.teamId} (${isBlueTeam ? 'blue' : 'red'}):`, team.units.length, 'units');
        
        // Filter out dead units (HP <= 0)
        const aliveUnits = team.units.filter(unit => unit.hp > 0);
        
        console.log(`Alive units for team ${team.teamId}:`, aliveUnits.length);
        
        aliveUnits.forEach(unit => {
            if (unit && unit.row !== undefined && unit.col !== undefined) {
                this.drawUnit(unit, isBlueTeam, flipPerspective);
            } else {
                console.log(`Unit ${unit?.name || 'unknown'} has invalid position:`, unit);
            }
        });
    }
    
    drawUnit(unit, isBlueTeam, flipPerspective = false) {
        let x = this.offsetX + unit.col * this.cellSize;
        let y = this.offsetY + unit.row * this.cellSize;
        
        // Flip perspective if needed (for opponent's units)
        if (flipPerspective) {
            x = this.offsetX + (BOARD_COLS - 1 - unit.col) * this.cellSize;
            y = this.offsetY + (BOARD_ROWS - 1 - unit.row) * this.cellSize;
        }
        
        // Check if this unit can be selected (belongs to current turn team and not ended turn)
        const canBeSelected = this.gameLogic && 
                             unit.teamId === this.gameLogic.currentTurnTeamId && 
                             !this.gameLogic.alreadyEndedTurnUnits.includes(unit) &&
                             unit.name !== "Base";
        
        // Draw selection highlight if unit can be selected
        if (canBeSelected) {
            this.p.stroke(0, 255, 0); // Green border
            this.p.strokeWeight(2);
            this.p.noFill();
            this.p.rect(x, y, this.cellSize, this.cellSize);
        }
        
        // Get unit image
        const unitType = unit.armyType || unit.name;
        const imageKey = `${unitType}_${isBlueTeam ? 'blue' : 'red'}`;
        
        if (this.images[imageKey]) {
            // Calculate image size (80% of cell size)
            const imgSize = this.cellSize * 0.8;
            const imgX = x + (this.cellSize - imgSize) / 2;
            const imgY = y + (this.cellSize - imgSize) / 2;
            
            this.p.image(this.images[imageKey], imgX, imgY, imgSize, imgSize);
            
            // Draw HP bar
            this.drawHPBar(unit, x, y, isBlueTeam);
            
            // Draw effect indicators
            this.drawEffectIndicators(unit, x, y);
        }
    }
    
    drawHPBar(unit, x, y, isBlueTeam) {
        const barWidth = this.cellSize * 0.8;
        const barHeight = 4;
        const barX = x + (this.cellSize - barWidth) / 2;
        const barY = y + 2;
        
        // Background
        this.p.fill(102);
        this.p.noStroke();
        this.p.rect(barX, barY, barWidth, barHeight);
        
        // HP bar
        const hpPercentage = unit.hp / (UNIT_TYPES[unit.armyType]?.hp || 5);
        const hpWidth = barWidth * hpPercentage;
        
        this.p.fill(isBlueTeam ? this.p.color(0, 0, 255) : this.p.color(255, 0, 0));
        this.p.rect(barX, barY, hpWidth, barHeight);
    }
    
    drawEffectIndicators(unit, x, y) {
        if (!unit.effects || unit.effects.length === 0) return;
        
        this.p.textSize(8);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        
        // Check for lock effect - draw in bottom right corner
        const lockEffect = unit.effects.find(e => e.name === 'lock');
        if (lockEffect) {
            this.p.fill(255, 255, 255, 128); // 50% transparent white
            this.p.text('🔒', x + this.cellSize - 8, y + this.cellSize - 8);
        }
        
        // Check for adjacent penalty effect - draw in bottom left corner
        const adjacentEffect = unit.effects.find(e => e.name === 'adjacent penalty');
        if (adjacentEffect) {
            this.p.fill(255, 255, 255, 128); // 50% transparent white
            this.p.text('⛔', x + 8, y + this.cellSize - 8);
        }
    }

    handleCanvasClick(mouseX, mouseY) {
        if (!this.gameLogic || this.gameLogic.isGameEnd() !== 0 || this.gameLogic.currentTurnTeamId !== this.currentUserId) {
            return; // Not our turn or game ended
        }

        // Check if click is within the top panel area
        if (mouseY < this.topPanelHeight) {
            this.handleTopPanelClick(mouseX, mouseY);
            return;
        }
        
        // Check if click is within the board area
        if (mouseX < this.offsetX || mouseX > this.offsetX + this.boardWidth ||
            mouseY < this.offsetY || mouseY > this.offsetY + this.boardHeight) {
            return; // Click outside board area
        }
        
        // Calculate cell coordinates
        let col = Math.floor((mouseX - this.offsetX) / this.cellSize);
        let row = Math.floor((mouseY - this.offsetY) / this.cellSize);
        
        // Determine if we need to flip coordinates based on perspective
        const playerTeam = this.playerTeam || 'blue';
        const isPlayerBlue = playerTeam === 'blue';
        
        // For opponent's units, we need to flip the coordinates
        // This will be handled when we find the unit

        // Check if click is within board bounds
        if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
            return;
        }

        // Find unit at clicked position (considering perspective)
        let clickedUnit = null;
        
        // First try to find unit at the clicked position
        clickedUnit = this.gameLogic.matchInfo.getAllUnits().find(unit => 
            unit.row === row && unit.col === col && !unit.isDead
        );
        
        // If not found, try with flipped coordinates (for opponent's units)
        if (!clickedUnit) {
            const flippedRow = BOARD_ROWS - 1 - row;
            const flippedCol = BOARD_COLS - 1 - col;
            clickedUnit = this.gameLogic.matchInfo.getAllUnits().find(unit => 
                unit.row === flippedRow && unit.col === flippedCol && !unit.isDead
            );
        }
        
        if (clickedUnit) {
            clickedUnit = this.gameLogic.matchInfo.getUnitById(clickedUnit.id);
        }

        if (!this.selectedUnit) {
            // Select a unit
            if (clickedUnit && this.canSelectUnit(clickedUnit)) {
                this.selectedUnit = clickedUnit;
                console.log(`Selected unit: ${clickedUnit.name}`);
            }
            return;
        }

        // Handle action with selected unit
        if (clickedUnit) {
            this.handleUnitClick(clickedUnit);
        } else {
            this.handleEmptyCellClick(row, col, this.selectedUnit);
        }
    }

    canSelectUnit(unit) {
        return this.gameLogic && 
               unit.teamId === this.gameLogic.currentTurnTeamId && 
               !this.gameLogic.alreadyEndedTurnUnits.includes(unit) &&
               unit.name !== "Base" &&
               unit.hp > 0;
    }

    handleTopPanelClick(mouseX, mouseY) {
        // Check if click is within the top panel area (aligned with board)
        if (mouseX < this.offsetX || mouseX > this.offsetX + this.boardWidth) {
            return; // Click outside top panel
        }
        
        const teamPanelWidth = this.boardWidth / 3;
        const panelStartX = this.offsetX;
        
        // Check if click is in current unit panel (middle)
        if (mouseX >= panelStartX + teamPanelWidth && mouseX < panelStartX + teamPanelWidth * 2) {
            // Click on current unit panel - deselect if unit is selected
            if (this.selectedUnit) {
                this.selectedUnit = null;
                console.log('Deselected unit');
            }
        }
    }

    handleEmptyCellClick(row, col, currentUnit) {
        // Send move action to server
        this.gameSocket.emit('game:action', {
            matchId: this.matchInfo.matchId,
            action: 'move_unit',
            actionData: {
                unit: currentUnit,
                row: row,
                col: col
            }
        });
        
        console.log(`Sending move action to server: unit ${currentUnit.id} to (${row}, ${col})`);
    }

    handleUnitClick(clickedUnit) {
        const currentUnit = this.selectedUnit;
        
        // Case 1: Clicked on current unit (suicide)
        if (clickedUnit.id === currentUnit.id) {
            this.gameSocket.emit('game:action', {
                matchId: this.matchInfo.matchId,
                action: 'suicide',
                actionData: {
                    unit: currentUnit
                }
            });
            console.log('Sending suicide action to server');
            return;
        }
        
        // Case 2: Check if clicked unit is attackable
        const attackableTargets = this.gameLogic.getAttackableTargets(currentUnit);
        let isAttackable = attackableTargets.some(target => target.id === clickedUnit.id);
        if (isAttackable) {
            this.gameSocket.emit('game:action', {
                matchId: this.matchInfo.matchId,
                action: 'attack',
                actionData: {
                    unit: currentUnit,
                    target: clickedUnit
                }
            });
            console.log('Sending attack action to server');
            return;
        }
        
        // Case 3: Check if clicked unit is healable
        const healableTargets = this.gameLogic.getHealableTargets(currentUnit);
        let isHealable = healableTargets.some(target => target.id === clickedUnit.id);
        if (isHealable) {
            this.gameSocket.emit('game:action', {
                matchId: this.matchInfo.matchId,
                action: 'heal',
                actionData: {
                    unit: currentUnit,
                    target: clickedUnit
                }
            });
            console.log('Sending heal action to server');
            return;
        }
        
        // Case 4: Check if clicked unit is sacrificeable
        const sacrificeableTargets = this.gameLogic.getSacrificeableTargets(currentUnit);
        let isSacrificeable = sacrificeableTargets.some(target => target.id === clickedUnit.id);
        if (isSacrificeable) {
            this.gameSocket.emit('game:action', {
                matchId: this.matchInfo.matchId,
                action: 'sacrifice',
                actionData: {
                    unit: currentUnit,
                    target: clickedUnit
                }
            });
            console.log('Sending sacrifice action to server');
            return;
        }
        
        // If none of the above, do nothing
        console.log('No valid action for clicked unit');
    }

    highlightReachableCells() {
        if (!this.selectedUnit) return;
        
        const currentUnit = this.selectedUnit;
        if (!currentUnit || currentUnit.hp <= 0) return;

        // Determine if we need to flip perspective for highlighting
        const playerTeam = this.playerTeam || 'blue';
        const isPlayerBlue = playerTeam === 'blue';
        const isSelectedUnitPlayerTeam = (isPlayerBlue && currentUnit.teamId === 'blue') || 
                                       (!isPlayerBlue && currentUnit.teamId === 'red');

        // Get reachable cells for movement
        const reachableCells = this.gameLogic ? this.gameLogic.getReachableCells(currentUnit) : [];
        this.highlightCells(reachableCells, this.p.color(144, 238, 144, 153), 'movable', !isSelectedUnitPlayerTeam);

        // Get attackable targets
        const attackableTargets = this.gameLogic ? this.gameLogic.getAttackableTargets(currentUnit) : [];
        this.highlightCells(attackableTargets, this.p.color(255, 99, 71, 153), 'attackable', !isSelectedUnitPlayerTeam);

        // Get healable targets
        const healableTargets = this.gameLogic ? this.gameLogic.getHealableTargets(currentUnit) : [];
        this.highlightCells(healableTargets, this.p.color(173, 216, 230, 153), 'healable', !isSelectedUnitPlayerTeam);

        // Get sacrificeable targets
        const sacrificeableTargets = this.gameLogic ? this.gameLogic.getSacrificeableTargets(currentUnit) : [];
        this.highlightCells(sacrificeableTargets, this.p.color(255, 255, 224, 153), 'sacrificeable', !isSelectedUnitPlayerTeam);
    }

    highlightCells(cells, color, type, flipPerspective = false) {
        cells.forEach(cell => {
            let x = this.offsetX + cell.col * this.cellSize;
            let y = this.offsetY + cell.row * this.cellSize;
            
            // Flip perspective if needed
            if (flipPerspective) {
                x = this.offsetX + (BOARD_COLS - 1 - cell.col) * this.cellSize;
                y = this.offsetY + (BOARD_ROWS - 1 - cell.row) * this.cellSize;
            }
            
            // Fill the cell with the highlight color
            this.p.fill(color);
            this.p.noStroke();
            this.p.rect(x, y, this.cellSize, this.cellSize);
            
            // Add a subtle border to distinguish the highlight
            this.p.stroke(this.getBorderColorForType(type));
            this.p.strokeWeight(2);
            this.p.noFill();
            this.p.rect(x, y, this.cellSize, this.cellSize);
        });
    }

    getBorderColorForType(type) {
        switch (type) {
            case 'movable':
                return this.p.color(34, 139, 34); // Forest green
            case 'attackable':
                return this.p.color(220, 20, 60); // Crimson
            case 'healable':
                return this.p.color(65, 105, 225); // Royal blue
            case 'sacrificeable':
                return this.p.color(218, 165, 32); // Goldenrod
            default:
                return this.p.color(102, 102, 102);
        }
    }

    drawTopPanel() {
        const panelX = this.offsetX;
        const panelY = 0;
        const panelWidth = this.boardWidth;
        const panelHeight = this.topPanelHeight;
        
        // Panel background
        this.p.fill(60, 60, 60);
        this.p.noStroke();
        this.p.rect(panelX, panelY, panelWidth, panelHeight);
        
        // Panel border
        this.p.stroke(255, 255, 0);
        this.p.strokeWeight(3);
        this.p.noFill();
        this.p.rect(panelX, panelY, panelWidth, panelHeight);
        
        // Draw team panels
        const teamPanelWidth = panelWidth / 3;
        this.drawTeamPanel(this.matchInfo.team1, panelX, panelY, teamPanelWidth, panelHeight, true);
        this.drawCurrentUnitPanel(panelX + teamPanelWidth, panelY, teamPanelWidth, panelHeight);
        this.drawTeamPanel(this.matchInfo.team2, panelX + teamPanelWidth * 2, panelY, teamPanelWidth, panelHeight, false);
    }

    drawTeamPanel(team, x, y, width, height, isLeftTeam) {
        // Panel background
        const isCurrentTeam = this.gameLogic && team.teamId === this.gameLogic.currentTurnTeamId;
        if (isCurrentTeam) {
            this.p.fill(50, 150, 50); // Highlight current team bằng màu xanh lá
        } else {
            this.p.fill(40, 40, 40);
        }
        this.p.noStroke();
        this.p.rect(x, y, width, height);
        
        // Panel border
        this.p.stroke(isCurrentTeam ? 100 : 60);
        this.p.strokeWeight(2);
        this.p.noFill();
        this.p.rect(x, y, width, height);
        
        // Team name and movement point
        this.p.fill(255);
        this.p.textSize(14);
        this.p.textStyle(this.p.BOLD);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        
        const teamName = isLeftTeam ? "TEAM 1" : "TEAM 2";
        const movementPoint = this.gameLogic ? this.gameLogic._calculateTeamMovementPoint(team.teamId) : 0;
        
        this.p.text(teamName, x + width / 2, y + 15);
        this.p.text(`Movement point: ${movementPoint}`, x + width / 2, y + 30);
        
        // Priority indicator
        if (this.gameLogic && team.teamId === this.gameLogic.priorityTeamId) {
            this.p.textSize(10);
            this.p.text("Priority", x + width / 2, y + 45);
        }
    }

    drawCurrentUnitPanel(x, y, width, height) {
        // Panel background
        this.p.fill(40, 40, 40);
        this.p.noStroke();
        this.p.rect(x, y, width, height);
        
        // Panel border
        this.p.stroke(102);
        this.p.strokeWeight(2);
        this.p.noFill();
        this.p.rect(x, y, width, height);
        
        // Title
        this.p.fill(255);
        this.p.textSize(12);
        this.p.textStyle(this.p.BOLD);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.text("CURRENT UNIT", x + width / 2, y + 12);
        
        // Draw current unit if selected
        if (this.selectedUnit) {
            const unit = this.selectedUnit;
            const unitSize = 35;
            const unitX = x + width / 2 - unitSize / 2;
            const unitY = y + 25;
            
            // Draw unit image
            const unitType = unit.armyType || unit.name;
            const isBlueTeam = unit.teamId === this.matchInfo.team1.teamId;
            const imageKey = `${unitType}_${isBlueTeam ? 'blue' : 'red'}`;
            
            if (this.images[imageKey]) {
                this.p.image(this.images[imageKey], unitX, unitY, unitSize, unitSize);
            }
            
            // Unit name and speed
            this.p.textSize(9);
            this.p.text(unit.name, x + width / 2, y + 65);
            this.p.text(`Speed: ${unit.speed}`, x + width / 2, y + 78);
        } else {
            // No unit selected
            this.p.textSize(9);
            this.p.text("No unit selected", x + width / 2, y + 45);
        }
    }

    drawRecentActions() {
        this.recentActions.forEach(action => {
            // Determine if we need to flip perspective for the action
            const playerTeam = this.playerTeam || 'blue';
            const isPlayerBlue = playerTeam === 'blue';
            
            // For now, we'll draw actions as they are in the game logic
            // In a full implementation, we might want to flip the coordinates
            // based on which team the action belongs to
            
            switch (action.type) {
                case 'move':
                    this.drawArrowIndicator(action.from, action.to, this.p.color(0, 255, 0, 128));
                    break;
                case 'attack':
                    this.drawArrowIndicator(action.from, action.to, this.p.color(255, 0, 0, 128));
                    break;
                case 'heal':
                    this.drawArrowIndicator(action.from, action.to, this.p.color(0, 0, 255, 128));
                    break;
                case 'sacrifice':
                    this.drawArrowIndicator(action.from, action.to, this.p.color(255, 255, 0, 128));
                    break;
            }
        });
    }

    drawArrowIndicator(fromCell, toCell, color) {
        const x1 = this.offsetX + fromCell.col * this.cellSize + this.cellSize / 2;
        const y1 = this.offsetY + fromCell.row * this.cellSize + this.cellSize / 2;
        const x2 = this.offsetX + toCell.col * this.cellSize + this.cellSize / 2;
        const y2 = this.offsetY + toCell.row * this.cellSize + this.cellSize / 2;

        this.p.stroke(color);
        this.p.strokeWeight(2);
        this.p.line(x1, y1, x2, y2);

        // Draw arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 10;
        const x3 = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
        const y3 = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
        const x4 = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
        const y4 = y2 - arrowSize * Math.sin(angle + Math.PI / 6);
        
        this.p.fill(color);
        this.p.triangle(x2, y2, x3, y3, x4, y4);
    }

    drawGameEndInfoBoard(result) {
        // Draw game end info board on the center of the canvas
        const panelX = this.offsetX;
        const panelY = this.offsetY;
        const panelWidth = this.boardWidth;
        const panelHeight = this.boardHeight;

        // Panel background
        this.p.fill(0, 0, 0, 204);
        this.p.noStroke();
        this.p.rect(panelX, panelY, panelWidth, panelHeight);

        // Panel border
        this.p.stroke(102);
        this.p.strokeWeight(2);
        this.p.noFill();
        this.p.rect(panelX, panelY, panelWidth, panelHeight);

        // Title
        this.p.fill(255);
        this.p.textSize(24);
        this.p.textStyle(this.p.BOLD);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.text('Game End', panelX + panelWidth / 2, panelY + panelHeight / 2 - 20);

        // Draw game end info
        const labelText = result === 1 ? 'Team 1 wins!' : result === 2 ? 'Team 2 wins!' : 'Draw!';
        this.p.fill(255);
        this.p.textSize(18);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.text(labelText, panelX + panelWidth / 2, panelY + panelHeight / 2 + 20);
    }

    handleKeyPress(key) {
        if (key === 'Escape') {
            // Deselect current unit
            this.selectedUnit = null;
            return;
        }
        
        if (key === 'Enter' || key === ' ') {
            // End turn
            if (this.gameLogic && this.gameLogic.currentTurnTeamId === this.currentUserId) {
                this.gameSocket.emit('game:action', {
                    matchId: this.matchInfo.matchId,
                    action: 'end_turn',
                    actionData: {}
                });
                console.log('Sending end turn action to server');
            }
        }
    }
}

export default P5BattleGraphicsMultiplayer;
