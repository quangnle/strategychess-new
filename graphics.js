import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES } from './core-logic/definitions.js';
import MatchInfo from './core-logic/match-info.js';
import GameLogic from './core-logic/game-logic.js';
import Processor from './ai-processor/processor.js';

class BattleGraphics {
    constructor(canvas, matchInfo) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.matchInfo = MatchInfo.createNewMatch(matchInfo.matchId, matchInfo.matchName, matchInfo.team1, matchInfo.team2);
        
        // Initialize game logic
        this.gameLogic = new GameLogic(this.matchInfo);
        this.gameLogic.startMatch();
        
        // Initialize AI processor
        this.processor = new Processor(this.gameLogic);
        
        // Calculate cell size based on canvas dimensions
        this.cellSize = Math.min(
            this.canvas.width / BOARD_COLS,
            this.canvas.height / BOARD_ROWS
        );
        
        // Calculate board dimensions
        this.boardWidth = BOARD_COLS * this.cellSize;
        this.boardHeight = BOARD_ROWS * this.cellSize;
        
        // Position board on the left side
        this.offsetX = 40;
        this.offsetY = (this.canvas.height - this.boardHeight) / 2;
        
        // Add click event listener
        this.setupClickHandler();
        
        // Add keyboard event listener
        this.setupKeyboardHandler();
        
        this.init();
    }
    
    init() {
        this.drawBoard();
        this.drawUnits();
        this.highlightReachableCells(); // Add cell highlighting
        this.drawTurnInfo();
        this.drawTurnSequence();
    }
    
    drawBoard() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw alternating squares
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const x = this.offsetX + col * this.cellSize;
                const y = this.offsetY + row * this.cellSize;
                
                // Alternate colors: white and light gray
                const isEven = (row + col) % 2 === 0;
                this.ctx.fillStyle = isEven ? '#ffffff' : '#f0f0f0';
                
                this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
                
                // Draw border
                this.ctx.strokeStyle = '#cccccc';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);

                // draw coordinate
                this.ctx.fillStyle = '#222222';
                this.ctx.font = '8px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`${row},${col}`, x + this.cellSize / 2, y + this.cellSize / 2);
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
        const imageKey = isBlueTeam ? 'image_blue' : 'image_red';
        
        if (UNIT_TYPES[unitType] && UNIT_TYPES[unitType][imageKey]) {
            const img = new Image();
            img.onload = () => {
                // Calculate image size (80% of cell size)
                const imgSize = this.cellSize * 0.8;
                const imgX = x + (this.cellSize - imgSize) / 2;
                const imgY = y + (this.cellSize - imgSize) / 2;
                
                this.ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
                
                // Draw HP bar
                this.drawHPBar(unit, x, y, isBlueTeam);
                
                // Draw effect indicators
                this.drawEffectIndicators(unit, x, y);
            };
            img.src = UNIT_TYPES[unitType][imageKey];
        } 
    }
    
    drawHPBar(unit, x, y, isBlueTeam) {
        const barWidth = this.cellSize * 0.8;
        const barHeight = 4;
        const barX = x + (this.cellSize - barWidth) / 2;
        const barY = y + 2;
        
        // Background
        this.ctx.fillStyle = '#666666';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // HP bar
        const hpPercentage = unit.hp / (UNIT_TYPES[unit.armyType]?.hp || 5);
        const hpWidth = barWidth * hpPercentage;
        
        this.ctx.fillStyle = isBlueTeam ? '#0000FF' : '#FF0000';
        this.ctx.fillRect(barX, barY, hpWidth, barHeight);
    }
    
    // Draw effect indicators on units
    drawEffectIndicators(unit, x, y) {
        if (!unit.effects || unit.effects.length === 0) return;
        
        // Save current context
        this.ctx.save();
        
        // Set font for effect indicators
        this.ctx.font = '8px Arial';
        this.ctx.textAlign = 'center';
        
        // Check for lock effect - draw in bottom right corner
        const lockEffect = unit.effects.find(e => e.name === 'lock');
        if (lockEffect) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // 50% transparent white
            this.ctx.fillText('🔒', x + this.cellSize - 8, y + this.cellSize - 8);
        }
        
        // Check for adjacent penalty effect - draw in bottom left corner
        const adjacentEffect = unit.effects.find(e => e.name === 'adjacent penalty');
        if (adjacentEffect) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // 50% transparent white
            this.ctx.fillText('⛔', x + 8, y + this.cellSize - 8);
        }
        
        // Restore context
        this.ctx.restore();
    }
    
    // Method to redraw the entire board
    redraw() {
        this.drawBoard();
        this.drawUnits();
        this.highlightReachableCells(); // Add cell highlighting
        this.drawTurnInfo();
        this.drawTurnSequence();
    }
    
    // Method to update game state and redraw
    updateGameState() {
        this.redraw();
    }
    
    // Method to advance to next turn
    nextTurn() {
        this.gameLogic.newTurn();
        this.updateGameState();
    }
    
    // Method to get current turn info
    getCurrentTurnInfo() {
        return this.gameLogic.currentTurnInfo;
    }
    
    // Method to get turn sequence
    getTurnSequence() {
        return this.gameLogic.turnSequence;
    }

    // Highlight reachable cells for the current unit
    highlightReachableCells() {
        if (!this.gameLogic.currentTurnInfo) return;
        
        const currentUnit = this.gameLogic.currentTurnInfo.inTurnUnit;
        if (!currentUnit || currentUnit.hp <= 0) return; // Don't highlight for dead units

        // Get reachable cells for movement
        const reachableCells = this.gameLogic.getReachableCells(currentUnit);
        this.highlightCells(reachableCells, 'rgba(144, 238, 144, 0.6)', 'movable'); // Light green for movable

        // Get attackable targets
        const attackableTargets = this.gameLogic.getAttackableTargets(currentUnit);
        this.highlightCells(attackableTargets, 'rgba(255, 99, 71, 0.6)', 'attackable'); // Light red for attackable

        // Get healable targets
        const healableTargets = this.gameLogic.getHealableTargets(currentUnit);
        this.highlightCells(healableTargets, 'rgba(173, 216, 230, 0.6)', 'healable'); // Light blue for healable

        // Get sacrificeable targets
        const sacrificeableTargets = this.gameLogic.getSacrificeableTargets(currentUnit);
        this.highlightCells(sacrificeableTargets, 'rgba(255, 255, 224, 0.6)', 'sacrificeable'); // Light yellow for sacrificeable
    }

    // Highlight cells with specified color and type
    highlightCells(cells, color, type) {
        cells.forEach(cell => {
            const x = this.offsetX + cell.col * this.cellSize;
            const y = this.offsetY + cell.row * this.cellSize;
            
            // Save current context state
            this.ctx.save();
            
            // Set fill style with opacity
            this.ctx.fillStyle = color;
            
            // Fill the cell with the highlight color
            this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
            
            // Add a subtle border to distinguish the highlight
            this.ctx.strokeStyle = this.getBorderColorForType(type);
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
            
            // Restore context state
            this.ctx.restore();
        });
    }

    // Get border color based on cell type
    getBorderColorForType(type) {
        switch (type) {
            case 'movable':
                return '#228B22'; // Forest green
            case 'attackable':
                return '#DC143C'; // Crimson
            case 'healable':
                return '#4169E1'; // Royal blue
            case 'sacrificeable':
                return '#DAA520'; // Goldenrod
            default:
                return '#666666';
        }
    }

    // Setup click event handler
    setupClickHandler() {
        this.canvas.addEventListener('click', (event) => {
            this.handleCanvasClick(event);
        });
    }

    // Handle canvas click events
    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Check if click is within the board area
        if (x < this.offsetX || x > this.offsetX + this.boardWidth ||
            y < this.offsetY || y > this.offsetY + this.boardHeight) {
            return; // Click outside board area
        }
        
        // Calculate cell coordinates
        const col = Math.floor((x - this.offsetX) / this.cellSize);
        const row = Math.floor((y - this.offsetY) / this.cellSize);
        
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

    // Handle click on empty cell
    handleEmptyCellClick(row, col, currentUnit) {
        // Check if the cell is reachable for movement
        const reachableCells = this.gameLogic.getReachableCells(currentUnit);
        const isReachable = reachableCells.some(cell => cell.row === row && cell.col === col);
        
        if (isReachable) {
            // Try to make move
            const moveSuccess = this.gameLogic.makeMove(currentUnit, row, col);
            if (moveSuccess) {
                console.log(`Unit moved to (${row}, ${col})`);
                this.showActionFeedback(`Moved to (${row}, ${col})`);
                //this.updateGameState();

                const canAttack = this.gameLogic.getAttackableTargets(currentUnit).length > 0;
                const canHeal = this.gameLogic.getHealableTargets(currentUnit).length > 0;
                const canSacrifice = this.gameLogic.getSacrificeableTargets(currentUnit).length > 0;

                // nếu không có action nào thì tự động chuyển sang turn của unit khác
                if (!canAttack && !canHeal && !canSacrifice) {
                    this.gameLogic.newTurn();
                }

                this.updateGameState();
            }
        }
        // If not reachable, do nothing (as specified)
    }

    // Handle click on a unit
    handleUnitClick(clickedUnit, currentUnit) {
        // Case 1: Clicked on current unit (suicide)
        if (clickedUnit.id === currentUnit.id) {
            const suicideSuccess = this.gameLogic.makeSuicide(currentUnit);
            if (suicideSuccess) {
                console.log('Suicide executed');
                //this.showActionFeedback('Suicide executed');
                //this.updateGameState();

                // tự động chuyển sang turn của unit khác
                this.gameLogic.newTurn();
                this.updateGameState();
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
                //this.showActionFeedback('Attack successful');
                //this.updateGameState();

                // tự động chuyển sang turn của unit khác
                this.gameLogic.newTurn();
                this.updateGameState();
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
                //this.showActionFeedback('Heal successful');
                //this.updateGameState();

                // tự động chuyển sang turn của unit khác
                this.gameLogic.newTurn();
                this.updateGameState();
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
                //this.showActionFeedback('Sacrifice successful');
                // this.updateGameState();

                // tự động chuyển sang turn của unit khác
                this.gameLogic.newTurn();
                this.updateGameState();
            }
            return;
        }
        
        // If none of the above, do nothing
        console.log('No valid action for clicked unit');
    }
    
    // Draw current turn unit highlight
    drawTurnInfo() {
        if (!this.gameLogic.currentTurnInfo) return;
        
        const currentUnit = this.gameLogic.currentTurnInfo.inTurnUnit;
        if (!currentUnit || currentUnit.hp <= 0) return; // Don't highlight dead units
        
        // Highlight current unit's cell
        const x = this.offsetX + currentUnit.col * this.cellSize;
        const y = this.offsetY + currentUnit.row * this.cellSize;
        
        // Draw highlight border
        this.ctx.strokeStyle = '#DDA700'; // Gold color
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
    }
    
    // Draw turn sequence
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
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // Panel border
        this.ctx.strokeStyle = '#666666';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Title
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Turn Sequence', panelX + panelWidth / 2, panelY + 25);
        
        // Draw unit images and HP bars
        const imageSize = 30;
        const spacing = 60; // Increased spacing to accommodate speed and effects info
        const startY = panelY + 40;
        
        aliveTurnSequence.forEach((unit, index) => {
            const imgY = startY + index * spacing;
            const imgX = panelX + 10;
            
            // Get unit image
            const unitType = unit.armyType || unit.name;
            const imageKey = unit.teamId === this.matchInfo.team1.teamId ? 'image_blue' : 'image_red';
            
            if (UNIT_TYPES[unitType] && UNIT_TYPES[unitType][imageKey]) {
                const img = new Image();
                img.onload = () => {
                    // Draw unit image (moved down by 3 pixels)
                    this.ctx.drawImage(img, imgX, imgY + 3, imageSize, imageSize);
                    
                    // Draw HP bar (adjusted for moved image)
                    this.drawTurnSequenceHPBar(unit, imgX + imageSize + 5, imgY + 5, 70);
                    
                    // Draw speed information
                    this.drawTurnSequenceSpeed(unit, imgX + imageSize + 5, imgY + 25, 70);
                    
                    // Draw effects information
                    this.drawTurnSequenceEffects(unit, imgX + imageSize + 5, imgY + 38, 70);
                };
                img.src = UNIT_TYPES[unitType][imageKey];
            }
        });
    }
    
    // Draw HP bar for turn sequence
    drawTurnSequenceHPBar(unit, x, y, width) {
        const barHeight = 10;
        
        // Background
        this.ctx.fillStyle = '#666666';
        this.ctx.fillRect(x, y, width, barHeight);
        
        // HP bar
        const maxHp = UNIT_TYPES[unit.armyType || unit.name]?.hp || 5;
        const hpPercentage = unit.hp / maxHp;
        const hpWidth = width * hpPercentage;
        
        this.ctx.fillStyle = hpPercentage > 0.5 ? '#22c55e' : hpPercentage > 0.25 ? '#f59e0b' : '#ef4444';
        this.ctx.fillRect(x, y, hpWidth, barHeight);
        
        // HP text
        this.ctx.fillStyle = '#0000FF';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${unit.hp}/${maxHp}`, x, y + barHeight);
    }
    
    // Draw speed information for turn sequence
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
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '9px Arial';
        this.ctx.textAlign = 'left';
        
        // Show speed with modification indicator if different from base
        if (currentSpeed !== baseSpeed) {
            this.ctx.fillStyle = '#FFD700'; // Gold color for modified speed
            this.ctx.fillText(`⚡ ${currentSpeed} (${baseSpeed}+${currentSpeed - baseSpeed})`, x, y);
        } else {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillText(`⚡ ${currentSpeed}`, x, y);
        }
    }
    
    // Draw effects information for turn sequence
    drawTurnSequenceEffects(unit, x, y, width) {
        // Draw active effects
        this.ctx.fillStyle = '#FFA500'; // Orange for active effects
        this.ctx.font = '8px Arial';
        this.ctx.textAlign = 'left';
        
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
        
        this.ctx.fillText(`🔮 ${effectTexts.join(', ')}`, x, y);
    }

    // Show action feedback message
    showActionFeedback(message) {
        // Save current context
        this.ctx.save();
        
        // Set text style
        this.ctx.fillStyle = '#00FF00';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        
        // Position message in the center of the canvas
        const x = this.canvas.width / 2;
        const y = this.canvas.height / 2;
        
        // Draw text with shadow for better visibility
        this.ctx.shadowColor = '#000000';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(message, x, y);
        
        // Restore context
        this.ctx.restore();
        
        // Clear the message after 2 seconds
        //setTimeout(() => {
        //    this.redraw();
        //}, 2000);
    }

    // Setup keyboard event handler
    setupKeyboardHandler() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'd' || event.key === 'D') {
                const currentUnit = this.gameLogic.currentTurnInfo?.inTurnUnit;
                if (currentUnit) {
                    const results = this.processor.evaluatePositions(currentUnit);
                    console.log('AI Position Evaluation Results:', results);
                    console.log('Current Unit:', currentUnit.name, 'at', currentUnit.row, currentUnit.col);
                    // tìm vị trí có điểm cao nhất
                    const bestMove = results.reduce((best, current) => {
                        return current.score > best.score ? current : best;
                    }, results[0]);
                    console.log('Best Move:', bestMove);
                    // thực hiện di chuyển
                    //this.gameLogic.makeMove(currentUnit, bestMove.row, bestMove.col);
                } else {
                    console.log('No current unit to evaluate');
                }
            }
        });
    }
}

export default BattleGraphics; 