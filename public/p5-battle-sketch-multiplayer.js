import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES, SACRIFICE, HEAL } from '/core-logic/definitions.js';
import MatchInfo from '/core-logic/match-info.js';
import GameLogic from '/core-logic/game-logic.js'; // For type reference, not local execution

class P5BattleGraphicsMultiplayer {
    constructor(matchInfo, gameSocket, currentUserId) {
        this.matchInfo = MatchInfo.createNewMatch(matchInfo.matchId, matchInfo.matchName, matchInfo.team1, matchInfo.team2);
        this.gameSocket = gameSocket;
        this.currentUserId = currentUserId;
        this.gameLogic = null; // Will be updated by server
        this.selectedUnit = null;
        this.currentAction = null; // 'move', 'attack', 'heal', 'sacrifice', 'suicide'
        
        // Canvas dimensions
        this.canvasWidth = 800;
        this.canvasHeight = 600;
        this.cellSize = 60;
        this.boardX = 50;
        this.boardY = 50;
        
        // Load images
        this.unitImages = {};
        this.loadImages();
        
        // Setup p5.js
        this.setupP5();
    }

    loadImages() {
        // Load unit images
        Object.keys(UNIT_TYPES).forEach(unitType => {
            const unitData = UNIT_TYPES[unitType];
            this.unitImages[unitType + '_blue'] = loadImage(unitData.image_blue);
            this.unitImages[unitType + '_red'] = loadImage(unitData.image_red);
        });
    }

    setupP5() {
        // Create canvas
        createCanvas(this.canvasWidth, this.canvasHeight);
        
        // Setup mouse and key events
        this.setupEvents();
    }

    setupEvents() {
        // Mouse events
        this.mousePressed = () => {
            this.handleCanvasClick(mouseX, mouseY);
        };

        // Keyboard events
        this.keyPressed = () => {
            this.handleKeyPress();
        };
    }

    updateGameState(newGameLogic) {
        this.gameLogic = newGameLogic; // Update the gameLogic instance from the server
        // Clear selected unit and action if it's not our turn anymore
        if (this.gameLogic && this.gameLogic.currentTurnTeamId !== this.currentUserId) {
            this.selectedUnit = null;
            this.currentAction = null;
        }
    }

    handleCanvasClick(mouseX, mouseY) {
        if (!this.gameLogic || this.gameLogic.isGameEnd() !== 0 || this.gameLogic.currentTurnTeamId !== this.currentUserId) {
            return; // Not our turn or game ended
        }

        // Calculate which cell was clicked
        const col = Math.floor((mouseX - this.boardX) / this.cellSize);
        const row = Math.floor((mouseY - this.boardY) / this.cellSize);

        // Check if click is within board bounds
        if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
            return;
        }

        // Find unit at clicked position
        const clickedUnit = this.gameLogic.matchInfo.getUnitById(
            this.gameLogic.matchInfo.getAllUnits().find(unit => 
                unit.row === row && unit.col === col && !unit.isDead
            )?.id
        );

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
            this.handleEmptyCellClick(row, col);
        }
    }

    handleEmptyCellClick(row, col) {
        if (!this.selectedUnit) return;

        // Check if it's a valid move
        if (this.selectedUnit.canMoveTo(row, col, this.gameLogic.board)) {
            // Move unit
            this.gameSocket.emit('game:action', {
                matchId: this.matchInfo.matchId,
                action: 'move_unit',
                actionData: {
                    unitId: this.selectedUnit.id,
                    fromPosition: { row: this.selectedUnit.row, col: this.selectedUnit.col },
                    toPosition: { row, col }
                }
            });
            this.selectedUnit = null;
            this.currentAction = null;
        }
    }

    handleUnitClick(clickedUnit) {
        if (!this.selectedUnit) return;

        if (clickedUnit.id === this.selectedUnit.id) {
            // Deselect unit
            this.selectedUnit = null;
            this.currentAction = null;
            return;
        }

        // Check if it's an enemy unit
        if (clickedUnit.teamId !== this.selectedUnit.teamId) {
            // Attack
            if (this.selectedUnit.canAttack(clickedUnit, this.gameLogic.board)) {
                this.gameSocket.emit('game:action', {
                    matchId: this.matchInfo.matchId,
                    action: 'attack',
                    actionData: {
                        attackerId: this.selectedUnit.id,
                        targetId: clickedUnit.id
                    }
                });
                this.selectedUnit = null;
                this.currentAction = null;
            }
        } else {
            // Same team - check for heal or sacrifice
            if (this.selectedUnit.canUseMagicOn(clickedUnit, this.gameLogic.board)) {
                if (this.currentAction === 'heal') {
                    this.gameSocket.emit('game:action', {
                        matchId: this.matchInfo.matchId,
                        action: 'heal',
                        actionData: {
                            healerId: this.selectedUnit.id,
                            targetId: clickedUnit.id
                        }
                    });
                } else if (this.currentAction === 'sacrifice') {
                    this.gameSocket.emit('game:action', {
                        matchId: this.matchInfo.matchId,
                        action: 'sacrifice',
                        actionData: {
                            sacrificerId: this.selectedUnit.id,
                            targetId: clickedUnit.id
                        }
                    });
                }
                this.selectedUnit = null;
                this.currentAction = null;
            }
        }
    }

    handleKeyPress() {
        if (!this.selectedUnit) return;

        switch (key.toLowerCase()) {
            case 'h':
                this.currentAction = 'heal';
                console.log('Heal mode activated');
                break;
            case 's':
                this.currentAction = 'sacrifice';
                console.log('Sacrifice mode activated');
                break;
            case 'u':
                this.currentAction = 'suicide';
                console.log('Suicide mode activated');
                this.gameSocket.emit('game:action', {
                    matchId: this.matchInfo.matchId,
                    action: 'suicide',
                    actionData: {
                        unitId: this.selectedUnit.id
                    }
                });
                this.selectedUnit = null;
                this.currentAction = null;
                break;
            case 'e':
                this.gameSocket.emit('game:action', {
                    matchId: this.matchInfo.matchId,
                    action: 'end_turn',
                    actionData: {}
                });
                this.selectedUnit = null;
                this.currentAction = null;
                break;
            case 'escape':
                this.selectedUnit = null;
                this.currentAction = null;
                break;
        }
    }

    canSelectUnit(unit) {
        if (!this.gameLogic) return false;
        return unit.teamId === this.gameLogic.currentTurnTeamId && !unit.isDead;
    }

    draw() {
        background(50);
        
        if (!this.gameLogic) {
            textAlign(CENTER, CENTER);
            textSize(24);
            fill(255);
            text('Waiting for game to start...', this.canvasWidth / 2, this.canvasHeight / 2);
            return;
        }

        this.drawBoard();
        this.drawUnits();
        this.drawSelectedUnit();
        this.drawGameInfo();
    }

    drawBoard() {
        // Draw board background
        fill(139, 69, 19); // Brown
        rect(this.boardX, this.boardY, BOARD_COLS * this.cellSize, BOARD_ROWS * this.cellSize);

        // Draw grid
        stroke(0);
        strokeWeight(1);
        for (let i = 0; i <= BOARD_COLS; i++) {
            line(this.boardX + i * this.cellSize, this.boardY, 
                 this.boardX + i * this.cellSize, this.boardY + BOARD_ROWS * this.cellSize);
        }
        for (let i = 0; i <= BOARD_ROWS; i++) {
            line(this.boardX, this.boardY + i * this.cellSize, 
                 this.boardX + BOARD_COLS * this.cellSize, this.boardY + i * this.cellSize);
        }
    }

    drawUnits() {
        if (!this.gameLogic) return;

        this.gameLogic.matchInfo.getAllUnits().forEach(unit => {
            if (unit.isDead) return;

            const x = this.boardX + unit.col * this.cellSize;
            const y = this.boardY + unit.row * this.cellSize;

            // Draw unit background
            fill(unit.teamId === 'blue' ? 100 : 200, 100, 100);
            rect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);

            // Draw unit image
            const imageKey = unit.armyType + '_' + unit.teamId;
            if (this.unitImages[imageKey]) {
                image(this.unitImages[imageKey], x + 5, y + 5, this.cellSize - 10, this.cellSize - 10);
            }

            // Draw HP bar
            this.drawHPBar(unit, x, y);

            // Draw unit name
            fill(255);
            textAlign(CENTER);
            textSize(10);
            text(unit.name, x + this.cellSize / 2, y + this.cellSize - 5);
        });
    }

    drawHPBar(unit, x, y) {
        const barWidth = this.cellSize - 10;
        const barHeight = 4;
        const hpPercentage = unit.hp / unit.maxHp;

        // Background
        fill(100);
        rect(x + 5, y + this.cellSize - 15, barWidth, barHeight);

        // HP bar
        fill(hpPercentage > 0.5 ? 0 : 255, hpPercentage > 0.5 ? 255 : 0, 0);
        rect(x + 5, y + this.cellSize - 15, barWidth * hpPercentage, barHeight);
    }

    drawSelectedUnit() {
        if (!this.selectedUnit) return;

        const x = this.boardX + this.selectedUnit.col * this.cellSize;
        const y = this.boardY + this.selectedUnit.row * this.cellSize;

        // Draw selection highlight
        stroke(255, 255, 0);
        strokeWeight(3);
        noFill();
        rect(x, y, this.cellSize, this.cellSize);
    }

    drawGameInfo() {
        if (!this.gameLogic) return;

        // Draw current turn
        fill(255);
        textAlign(LEFT);
        textSize(16);
        text(`Turn: ${this.gameLogic.currentTurnTeamId}`, 10, 30);
        text(`Round: ${this.gameLogic.roundNo}`, 10, 50);

        // Draw action mode
        if (this.currentAction) {
            text(`Action: ${this.currentAction}`, 10, 70);
        }

        // Draw instructions
        textSize(12);
        text('H: Heal, S: Sacrifice, U: Suicide, E: End Turn, ESC: Cancel', 10, this.canvasHeight - 20);
    }
}

export default P5BattleGraphicsMultiplayer;
