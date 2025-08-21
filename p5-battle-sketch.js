import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES, SACRIFICE, HEAL } from './core-logic/definitions.js';
import MatchInfo from './core-logic/match-info.js';
import GameLogic from './core-logic/game-logic.js';
import Processor from './ai-processor/processor.js';

class P5BattleGraphics {
    constructor(matchInfo) {
        this.matchInfo = MatchInfo.createNewMatch(matchInfo.matchId, matchInfo.matchName, matchInfo.team1, matchInfo.team2);
        
        // Initialize game logic
        this.gameLogic = new GameLogic(this.matchInfo);
        this.gameLogic.startMatch();
        
        // Initialize AI processor
        this.processor = new Processor(this.gameLogic);
        
        // Canvas dimensions
        this.canvasWidth = 750;
        this.canvasHeight = 600;
        
        // Calculate cell size based on canvas dimensions
        this.cellSize = Math.min(
            this.canvasWidth / BOARD_COLS,
            this.canvasHeight / BOARD_ROWS
        );
        
        // Calculate board dimensions
        this.boardWidth = BOARD_COLS * this.cellSize;
        this.boardHeight = BOARD_ROWS * this.cellSize;
        
        // Position board on the left side
        this.offsetX = 40;
        this.offsetY = (this.canvasHeight - this.boardHeight) / 2;
        
        // Load images
        this.images = {};
        this.loadImages();
        
        // Initialize p5 sketch
        this.initP5Sketch();
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
    
    initP5Sketch() {
        const sketch = (p) => {
            this.p = p;
            
            p.setup = () => {
                const canvas = p.createCanvas(this.canvasWidth, this.canvasHeight);
                canvas.parent('battle-canvas-container');
                
                // Load images in p5 context
                this.images = {};
                Object.keys(this.imagePaths).forEach(key => {
                    this.images[key] = p.loadImage(this.imagePaths[key]);
                });
                
                // Setup click event
                canvas.mousePressed(() => {
                    this.handleCanvasClick(p.mouseX, p.mouseY);
                });
                
                // Setup keyboard event
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
    
    draw() {
        this.drawBoard();
        this.drawUnits();
        this.highlightReachableCells();
        this.drawTurnInfo();
        this.drawTurnSequence();
    }
    
    drawBoard() {
        // Clear canvas
        this.p.background(51); // Dark gray background
        
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

                // Draw coordinate
                this.p.fill(34);
                this.p.textSize(8);
                this.p.textAlign(this.p.CENTER, this.p.CENTER);
                this.p.text(`${row},${col}`, x + this.cellSize / 2, y + this.cellSize / 2);
            }
        }
    }
    
    drawUnits() {
        if (!this.matchInfo || !this.matchInfo.team1 || !this.matchInfo.team2) {
            console.error('MatchInfo not properly initialized');
            return;
        }
        
        // Draw team 1 units (Blue team - bottom) - only alive units
        this.drawTeamUnits(this.matchInfo.team1, true);
        
        // Draw team 2 units (Red team - top) - only alive units
        this.drawTeamUnits(this.matchInfo.team2, false);
    }
    
    drawTeamUnits(team, isBlueTeam) {
        if (!team || !team.units) {
            console.error('Team units not found');
            return;
        }
        
        // Filter out dead units (HP <= 0)
        const aliveUnits = team.units.filter(unit => unit.hp > 0);
        
        aliveUnits.forEach(unit => {
            if (unit && unit.row !== undefined && unit.col !== undefined) {
                this.drawUnit(unit, isBlueTeam);
            }
        });
    }
    
    drawUnit(unit, isBlueTeam) {
        const x = this.offsetX + unit.col * this.cellSize;
        const y = this.offsetY + unit.row * this.cellSize;
        
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
    
    highlightReachableCells() {
        if (!this.gameLogic.currentTurnInfo) return;
        
        const currentUnit = this.gameLogic.currentTurnInfo.inTurnUnit;
        if (!currentUnit || currentUnit.hp <= 0) return;

        // Get reachable cells for movement
        const reachableCells = this.gameLogic.getReachableCells(currentUnit);
        this.highlightCells(reachableCells, this.p.color(144, 238, 144, 153), 'movable'); // Light green for movable

        // Get attackable targets
        const attackableTargets = this.gameLogic.getAttackableTargets(currentUnit);
        this.highlightCells(attackableTargets, this.p.color(255, 99, 71, 153), 'attackable'); // Light red for attackable

        // Get healable targets
        const healableTargets = this.gameLogic.getHealableTargets(currentUnit);
        this.highlightCells(healableTargets, this.p.color(173, 216, 230, 153), 'healable'); // Light blue for healable

        // Get sacrificeable targets
        const sacrificeableTargets = this.gameLogic.getSacrificeableTargets(currentUnit);
        this.highlightCells(sacrificeableTargets, this.p.color(255, 255, 224, 153), 'sacrificeable'); // Light yellow for sacrificeable
    }

    highlightCells(cells, color, type) {
        cells.forEach(cell => {
            const x = this.offsetX + cell.col * this.cellSize;
            const y = this.offsetY + cell.row * this.cellSize;
            
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
    
    drawTurnInfo() {
        if (!this.gameLogic.currentTurnInfo) return;
        
        const currentUnit = this.gameLogic.currentTurnInfo.inTurnUnit;
        if (!currentUnit || currentUnit.hp <= 0) return;
        
        // Highlight current unit's cell
        const x = this.offsetX + currentUnit.col * this.cellSize;
        const y = this.offsetY + currentUnit.row * this.cellSize;
        
        // Draw highlight border
        this.p.stroke(221, 167, 0); // Gold color
        this.p.strokeWeight(4);
        this.p.noFill();
        this.p.rect(x, y, this.cellSize, this.cellSize);
    }
    
    drawTurnSequence() {
        if (!this.gameLogic.turnSequence || this.gameLogic.turnSequence.length === 0) return;
        
        // Filter out dead units from turn sequence
        const aliveTurnSequence = this.gameLogic.turnSequence.filter(unit => unit.hp > 0);
        
        if (aliveTurnSequence.length === 0) return;
        
        // Draw turn sequence panel on the right side
        const panelX = this.offsetX + this.boardWidth + 20;
        const panelY = this.offsetY;
        const panelWidth = 120;
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
        this.p.textSize(16);
        this.p.textStyle(this.p.BOLD);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.text('Turn Sequence', panelX + panelWidth / 2, panelY + 25);
        
        // Draw unit images and HP bars
        const imageSize = 30;
        const spacing = 45;
        const startY = panelY + 40;
        
        aliveTurnSequence.forEach((unit, index) => {
            const imgY = startY + index * spacing;
            const imgX = panelX + 10;
            
            // Get unit image
            const unitType = unit.armyType || unit.name;
            const imageKey = `${unitType}_${unit.teamId === this.matchInfo.team1.teamId ? 'blue' : 'red'}`;
            
            if (this.images[imageKey]) {
                // Draw unit image
                this.p.image(this.images[imageKey], imgX, imgY + 3, imageSize, imageSize);
                
                // Draw HP bar
                this.drawTurnSequenceHPBar(unit, imgX + imageSize + 5, imgY + 5, 70);
                
                // Draw speed information
                this.drawTurnSequenceSpeed(unit, imgX + imageSize + 5, imgY + 25, 70);
                
                // Draw effects information
                this.drawTurnSequenceEffects(unit, imgX + imageSize + 5, imgY + 35, 70);
            }
        });
    }
    
    drawTurnSequenceHPBar(unit, x, y, width) {
        const barHeight = 10;
        
        // Background
        this.p.fill(102);
        this.p.noStroke();
        this.p.rect(x, y, width, barHeight);
        
        // HP bar
        const maxHp = UNIT_TYPES[unit.armyType || unit.name]?.hp || 5;
        const hpPercentage = unit.hp / maxHp;
        const hpWidth = width * hpPercentage;
        
        let hpColor;
        if (hpPercentage > 0.5) {
            hpColor = this.p.color(34, 197, 94); // Green
        } else if (hpPercentage > 0.25) {
            hpColor = this.p.color(245, 158, 11); // Orange
        } else {
            hpColor = this.p.color(239, 68, 68); // Red
        }
        
        this.p.fill(hpColor);
        this.p.rect(x, y, hpWidth, barHeight);
        
        // HP text
        this.p.fill(0, 0, 255);
        this.p.textSize(8);
        this.p.textAlign(this.p.LEFT, this.p.CENTER);
        this.p.text(`${unit.hp}/${maxHp}`, x + 2, y + 0.7 * barHeight);
    }
    
    drawTurnSequenceSpeed(unit, x, y, width) {
        // Get unit speed from definitions
        const unitType = unit.armyType || unit.name;
        const baseSpeed = UNIT_TYPES[unitType]?.speed || 0;
        
        // Check if unit has speed modifications from effects
        let currentSpeed = baseSpeed;
        if (unit.effects && unit.effects.length > 0) {
            const dashEffect = unit.effects.find(e => e.name === 'dash');
            if (dashEffect && dashEffect.value) {
                currentSpeed += dashEffect.value;
            }
        }
        
        // Draw speed text
        this.p.textSize(9);
        this.p.textAlign(this.p.LEFT, this.p.CENTER);
        
        // Show speed with modification indicator if different from base
        if (currentSpeed !== baseSpeed) {
            this.p.fill(255, 215, 0); // Gold color for modified speed
            this.p.text(`⚡ ${currentSpeed} (${baseSpeed}+${currentSpeed - baseSpeed})`, x, y);
        } else {
            this.p.fill(255);
            this.p.text(`⚡ ${currentSpeed}`, x, y);
        }
    }
    
    drawTurnSequenceEffects(unit, x, y, width) {
        // Draw active effects
        this.p.fill(255, 165, 0); // Orange for active effects
        this.p.textSize(8);
        this.p.textAlign(this.p.LEFT, this.p.CENTER);
        
        const effectTexts = unit.effects.map(effect => {
            let text = effect.name;
            if (effect.duration && effect.duration > 0) {
                text += `(${effect.duration})`;
            }
            if (effect.value) {
                text += `+${effect.value}`;
            }
            return text;
        });
        
        this.p.text(`🔮 ${effectTexts.join(', ')}`, x, y);
    }
    
    handleCanvasClick(mouseX, mouseY) {
        // Check if click is within the board area
        if (mouseX < this.offsetX || mouseX > this.offsetX + this.boardWidth ||
            mouseY < this.offsetY || mouseY > this.offsetY + this.boardHeight) {
            return; // Click outside board area
        }
        
        // Calculate cell coordinates
        const col = Math.floor((mouseX - this.offsetX) / this.cellSize);
        const row = Math.floor((mouseY - this.offsetY) / this.cellSize);
        
        // Get unit at clicked position
        const clickedUnit = this.gameLogic._getUnitByPosition(row, col);
        const currentUnit = this.gameLogic.currentTurnInfo?.inTurnUnit;
        
        if (!currentUnit) return; // No current unit
        
        // Case 1: Clicked on empty cell
        if (!clickedUnit) {
            this.handleEmptyCellClick(row, col, currentUnit);
        }
        // Case 2: Clicked on a unit
        else {
            this.handleUnitClick(clickedUnit, currentUnit);
        }
    }
    
    handleEmptyCellClick(row, col, currentUnit) {
        // Check if the cell is reachable for movement
        const reachableCells = this.gameLogic.getReachableCells(currentUnit);
        const isReachable = reachableCells.some(cell => cell.row === row && cell.col === col);
        
        if (isReachable) {
            // Try to make move
            const moveSuccess = this.gameLogic.makeMove(currentUnit, row, col);
            if (moveSuccess) {
                console.log(`Unit moved to (${row}, ${col})`);

                const canAttack = this.gameLogic.getAttackableTargets(currentUnit).length > 0;
                const canHeal = this.gameLogic.getHealableTargets(currentUnit).length > 0;
                const canSacrifice = this.gameLogic.getSacrificeableTargets(currentUnit).length > 0;

                // nếu không có action nào thì tự động chuyển sang turn của unit khác
                if (!canAttack && !canHeal && !canSacrifice) {
                    this.gameLogic.newTurn();
                }
            }
        }
    }
    
    handleUnitClick(clickedUnit, currentUnit) {
        // Case 1: Clicked on current unit (suicide)
        if (clickedUnit.id === currentUnit.id) {
            const suicideSuccess = this.gameLogic.makeSuicide(currentUnit);
            if (suicideSuccess) {
                console.log('Suicide executed');
                this.gameLogic.newTurn();
            }
            return;
        }
        
        // Case 2: Check if clicked unit is attackable
        const attackableTargets = this.gameLogic.getAttackableTargets(currentUnit);
        const isAttackable = attackableTargets.some(target => target.id === clickedUnit.id);
        if (isAttackable) {
            const attackSuccess = this.gameLogic.makeAttack(currentUnit, clickedUnit);
            if (attackSuccess) {
                console.log(`Attacked unit at (${clickedUnit.row}, ${clickedUnit.col})`);
                this.gameLogic.newTurn();
            }
            return;
        }
        
        // Case 3: Check if clicked unit is healable
        const healableTargets = this.gameLogic.getHealableTargets(currentUnit);
        const isHealable = healableTargets.some(target => target.id === clickedUnit.id);
        if (isHealable) {
            const healSuccess = this.gameLogic.makeHeal(currentUnit, clickedUnit);
            if (healSuccess) {
                console.log(`Healed unit at (${clickedUnit.row}, ${clickedUnit.col})`);
                this.gameLogic.newTurn();
            }
            return;
        }
        
        // Case 4: Check if clicked unit is sacrificeable
        const sacrificeableTargets = this.gameLogic.getSacrificeableTargets(currentUnit);
        const isSacrificeable = sacrificeableTargets.some(target => target.id === clickedUnit.id);
        if (isSacrificeable) {
            const sacrificeSuccess = this.gameLogic.makeSacrifice(currentUnit, clickedUnit);
            if (sacrificeSuccess) {
                console.log(`Sacrificed for unit at (${clickedUnit.row}, ${clickedUnit.col})`);
                this.gameLogic.newTurn();
            }
            return;
        }
        
        // If none of the above, do nothing
        console.log('No valid action for clicked unit');
    }
    
    handleKeyPress(key) {
        if (key === 'd' || key === 'D') {
            const currentUnit = this.gameLogic.currentTurnInfo?.inTurnUnit;
            if (currentUnit) {
                const results = this.processor.evaluatePositions(currentUnit);
                console.log('Current Unit:', currentUnit.name, 'at', currentUnit.row, currentUnit.col);
                
                // tìm vị trí có điểm cao nhất
                const bestMove = results.reduce((best, current) => {
                    return current.score > best.score ? current : best;
                }, results[0]);
                console.log('Best Move:', bestMove);

                this.gameLogic.makeMove(currentUnit, bestMove.row, bestMove.col);
                
                const bestTarget = this.processor.chooseBestTarget(currentUnit, currentUnit.row, currentUnit.col);
                if (bestTarget) {
                    // kiểm tra nếu bestTarget là quân đội đồng minh
                    if (bestTarget.teamId === currentUnit.teamId) {
                        // kiểm tra nếu currentUnit có ability sacrifice
                        if (currentUnit.abilities.includes(SACRIFICE)) {
                            this.gameLogic.makeSacrifice(currentUnit, bestTarget);
                        }

                        // kiểm tra nếu currentUnit có ability heal
                        if (currentUnit.abilities.includes(HEAL)) {
                            this.gameLogic.makeHeal(currentUnit, bestTarget);
                        }
                    } else {
                        this.gameLogic.makeAttack(currentUnit, bestTarget);
                    }
                }
                
                // tự động chuyển sang turn của unit khác
                this.gameLogic.newTurn();
            } else {
                console.log('No current unit to evaluate');
            }
        }
    }
    
    // Method to redraw the entire board
    redraw() {
        // p5.js automatically calls draw() every frame, so we don't need to manually redraw
    }
    
    // Method to advance to next turn
    nextTurn() {
        this.gameLogic.newTurn();
    }
    
    // Method to get current turn info
    getCurrentTurnInfo() {
        return this.gameLogic.currentTurnInfo;
    }
    
    // Method to get turn sequence
    getTurnSequence() {
        return this.gameLogic.turnSequence;
    }
}

export default P5BattleGraphics;
