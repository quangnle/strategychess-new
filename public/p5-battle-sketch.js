import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES, SACRIFICE, HEAL } from '/core-logic/definitions.js';
import MatchInfo from '/core-logic/match-info.js';
import GameLogic from '/core-logic/game-logic.js';
import Processor from '/ai-processor/processor.js';
import { AIDriver, AI_MODE } from './ai-driver.js';

class P5BattleGraphics {
    constructor(matchInfo, aiOptions = {}) {
        this.matchInfo = MatchInfo.createNewMatch(matchInfo.matchId, matchInfo.matchName, matchInfo.team1, matchInfo.team2);
        
        // Initialize game logic
        this.gameLogic = new GameLogic(this.matchInfo);
        this.gameLogic.startMatch();
        
        // Processor cũ giữ lại làm đối chứng, không còn điều khiển ván đấu
        this.processor = new Processor(this.gameLogic);

        // Engine minimax chạy trong Web Worker
        this.onHudUpdate = aiOptions.onHudUpdate || (() => {});
        this.ai = new AIDriver(this.gameLogic, {
            mode: aiOptions.mode || AI_MODE.OFF,
            timeMs: aiOptions.timeMs ?? 3000,
            autoPlay: aiOptions.autoPlay ?? true,
            onMoveApplied: (trace) => { this.recentActions = trace; },
            onUpdate: (driver) => {
                if (aiOptions.onUpdate) aiOptions.onUpdate(driver);
            }
        });

        // Canvas chỉ vẽ bàn cờ. HUD (team, AI status, quân đang chọn) nằm ở HTML
        // hai bên và trên header để tận dụng chiều ngang màn hình.
        this.topPanelHeight = 0;
        this.canvasWidth = 550;
        this.canvasHeight = 600;
        this.cellSize = 50;
        this.boardWidth = 550;
        this.boardHeight = 600;
        this.offsetX = 0;
        this.offsetY = 0;
        this._hudKey = '';
        this.p5Instance = null;
        
        // Load images
        this.images = {};
        this.loadImages();
        
        // Initialize p5 sketch
        this.initP5Sketch();

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
    
    layoutBoard() {
        const parent = document.getElementById('battle-canvas-container');
        const availW = parent && parent.clientWidth > 40 ? parent.clientWidth : 550;
        const availH = parent && parent.clientHeight > 40 ? parent.clientHeight : 600;
        const cell = Math.floor(Math.min(availW / BOARD_COLS, availH / BOARD_ROWS));
        this.cellSize = Math.max(32, cell);
        this.boardWidth = BOARD_COLS * this.cellSize;
        this.boardHeight = BOARD_ROWS * this.cellSize;
        this.canvasWidth = this.boardWidth;
        this.canvasHeight = this.boardHeight;
        this.offsetX = 0;
        this.offsetY = 0;
        this.topPanelHeight = 0;
    }

    initP5Sketch() {
        const sketch = (p) => {
            this.p = p;
            
            p.setup = () => {
                this.layoutBoard();
                const canvas = p.createCanvas(this.canvasWidth, this.canvasHeight);
                canvas.parent('battle-canvas-container');
                
                // Load images in p5 context
                this.images = {};
                Object.keys(this.imagePaths).forEach(key => {
                    this.images[key] = p.loadImage(this.imagePaths[key]);
                });
                
                // Setup click event
                canvas.mousePressed(() => {
                    // kiểm tra nếu game đã kết thúc
                    const result = this.gameLogic.isGameEnd();
                    if (result !== 0) {
                        this.drawGameEndInfoBoard(result);
                        return;
                    }

                    this.handleCanvasClick(p.mouseX, p.mouseY);
                });
                
                // Setup keyboard event
                p.keyPressed = () => {
                    // kiểm tra nếu game đã kết thúc
                    const result = this.gameLogic.isGameEnd();
                    if (result !== 0) {
                        this.drawGameEndInfoBoard(result);
                        return;
                    }

                    this.handleKeyPress(p.key);
                };

                p.windowResized = () => {
                    this.layoutBoard();
                    p.resizeCanvas(this.canvasWidth, this.canvasHeight);
                };

                // layout lần đầu có thể chạy trước khi flex đã có kích thước thật
                requestAnimationFrame(() => {
                    this.layoutBoard();
                    p.resizeCanvas(this.canvasWidth, this.canvasHeight);
                });
            };
            
            p.draw = () => {
                this.draw();
            };
        };
        
        this.p5Instance = new p5(sketch);
    }
    
    draw() {
        // Clear canvas with background
        this.p.background(51); // Dark gray background
        
        // kiểm tra nếu game đã kết thúc
        const result = this.gameLogic.isGameEnd();
        if (result !== 0) {
            this.drawGameEndInfoBoard(result);
            this._syncHud();
            return;
        }

        // Cho AI cơ hội đi, nếu nó đang điều khiển phe tới lượt. Việc tính toán nằm
        // ở worker nên lời gọi này trả về ngay, khung hình không bị khựng.
        if (this.ai) this.ai.tick();

        this.drawBoard();
        this.drawUnits();
        this.highlightReachableCells();
        this.drawRecentActions();
        this._syncHud();
    }

    _hudSignature() {
        const gl = this.gameLogic;
        const cur = gl.currentTurnUnit;
        const parts = [
            gl.currentTurnTeamId, gl.priorityTeamId, gl.roundNo,
            cur ? cur.id : '-',
            this.ai ? `${this.ai.thinking}|${this.ai.autoPlay}|${this.ai.statusLine()}` : ''
        ];
        for (const u of gl._getAllUnits()) {
            parts.push(`${u.id}:${u.hp}:${u.row},${u.col}:${gl.hasEndedTurn(u) ? 1 : 0}`);
        }
        return parts.join('|');
    }

    _syncHud() {
        const key = this._hudSignature();
        if (key === this._hudKey) return;
        this._hudKey = key;
        this.onHudUpdate(this);
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

                // Draw coordinate
                //this.p.fill(34);
                //this.p.textSize(8);
                //this.p.textAlign(this.p.CENTER, this.p.CENTER);
                //this.p.text(`${row},${col}`, x + this.cellSize / 2, y + this.cellSize / 2);
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
        
        // Check if this unit can be selected (belongs to current turn team and not ended turn)
        const canBeSelected = unit.teamId === this.gameLogic.currentTurnTeamId && 
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
        if (lockEffect && (lockEffect.duration === undefined || lockEffect.duration > 0)) {
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

    drawStayMarker(cell) {
        if (!cell) return;
        const x = this.offsetX + cell.col * this.cellSize + this.cellSize / 2;
        const y = this.offsetY + cell.row * this.cellSize + this.cellSize / 2;
        this.p.noFill();
        this.p.stroke(120, 180, 255, 200);
        this.p.strokeWeight(3);
        this.p.circle(x, y, this.cellSize * 0.7);
    }
    
    highlightReachableCells() {
        if (!this.gameLogic.currentTurnUnit) return;
        
        const currentUnit = this.gameLogic.currentTurnUnit;
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
    

    drawRecentActions() {
        this.recentActions.forEach(action => {
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
                case 'stay':
                case 'pass':
                    this.drawStayMarker(action.from || action.to);
                    break;
            }
        });
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
    
    canSelectUnit(unit) {
        return unit.teamId === this.gameLogic.currentTurnTeamId && 
               !this.gameLogic.hasEndedTurn(unit) &&
               unit.name !== "Base" &&
               unit.hp > 0;
    }

    handleCanvasClick(mouseX, mouseY) {
        if (mouseX < this.offsetX || mouseX > this.offsetX + this.boardWidth ||
            mouseY < this.offsetY || mouseY > this.offsetY + this.boardHeight) {
            return;
        }
        
        // Calculate cell coordinates
        const col = Math.floor((mouseX - this.offsetX) / this.cellSize);
        const row = Math.floor((mouseY - this.offsetY) / this.cellSize);
        
        // Phe đang tới lượt do AI cầm thì bỏ qua click, tránh người chơi đi hộ AI
        // hoặc chen ngang trong lúc engine đang tính.
        if (this.ai && this.ai.autoPlay && this.ai.controlsCurrentTurn()) return;

        // Get unit at clicked position
        const clickedUnit = this.gameLogic._getUnitByPosition(row, col);
        const currentUnit = this.gameLogic.currentTurnUnit;
        
        // Case 1: No current unit selected - try to select a unit
        if (!currentUnit) {
            if (clickedUnit && this.canSelectUnit(clickedUnit)) {
                this.gameLogic.currentTurnUnit = clickedUnit;
                console.log(`Selected unit: ${clickedUnit.name}`);
            }
            return;
        }
        
        // Case 2: Clicked on empty cell
        if (!clickedUnit) {
            this.handleEmptyCellClick(row, col, currentUnit);
        }
        // Case 3: Clicked on a unit
        else {
            // Check if clicked unit is selectable (has green border)
            if (this.canSelectUnit(clickedUnit)) {
                // Check if current unit can perform any action on clicked unit
                const canHeal = this.gameLogic.getHealableTargets(currentUnit).some(target => target.id === clickedUnit.id);
                const canSacrifice = this.gameLogic.getSacrificeableTargets(currentUnit).some(target => target.id === clickedUnit.id);
                const canSuicide = clickedUnit.id === currentUnit.id;
                
                if (canHeal || canSacrifice || canSuicide) {
                    // Current unit can perform action on clicked unit - execute action
                    this.handleUnitClick(clickedUnit, currentUnit);
                } else {
                    // Current unit cannot perform any action - switch to clicked unit
                    this.gameLogic.currentTurnUnit = clickedUnit;
                    console.log(`Switched to unit: ${clickedUnit.name}`);
                }
            } else {
                // Clicked unit is not selectable - handle as normal unit click
                this.handleUnitClick(clickedUnit, currentUnit);
            }
        }
    }

    handleEmptyCellClick(row, col, currentUnit) {
        // Check if the cell is reachable for movement
        const reachableCells = this.gameLogic.getReachableCells(currentUnit);
        const isReachable = reachableCells.some(cell => cell.row === row && cell.col === col);
        
        if (isReachable) {
            // Try to make move

            // lưu lại old position để vẽ arrow indicator
            const oldCell = { row: currentUnit.row, col: currentUnit.col };

            const moveSuccess = this.gameLogic.makeMove(currentUnit, row, col);
            if (moveSuccess) {
                console.log(`Unit moved to (${row}, ${col})`);

                // xóa recent actions
                this.recentActions = [];
                // lưu lại action
                this.recentActions.push({ type: 'move', from: oldCell, to: { row, col } });

                const canAttack = this.gameLogic.getAttackableTargets(currentUnit).length > 0;
                const canHeal = this.gameLogic.getHealableTargets(currentUnit).length > 0;
                const canSacrifice = this.gameLogic.getSacrificeableTargets(currentUnit).length > 0;

                // nếu không có action nào thì tự động chuyển sang turn của unit khác
                if (!canAttack && !canHeal && !canSacrifice) {
                    console.log('No valid action for current unit, switching to next turn');
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

                // kiểm tra nếu game đã kết thúc
                const result = this.gameLogic.isGameEnd();
                if (result !== 0) {
                    this.drawGameEndInfoBoard(result);
                    return;
                }

                console.log('Suicide executed, switching to next turn');
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

                // xóa recent actions
                this.recentActions = [];
                // lưu lại action
                this.recentActions.push({
                    type: 'attack',
                    from: { row: currentUnit.row, col: currentUnit.col },
                    to: { row: clickedUnit.row, col: clickedUnit.col }
                });

                // kiểm tra nếu game đã kết thúc
                const result = this.gameLogic.isGameEnd();
                if (result !== 0) {
                    this.drawGameEndInfoBoard(result);
                    return;
                }

                console.log('Heal executed, switching to next turn');
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

                // xóa recent actions
                this.recentActions = [];
                // lưu lại action
                this.recentActions.push({
                    type: 'heal',
                    from: { row: currentUnit.row, col: currentUnit.col },
                    to: { row: clickedUnit.row, col: clickedUnit.col }
                });

                this.gameLogic.endTurn();
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

                // xóa recent actions
                this.recentActions = [];
                // lưu lại action
                this.recentActions.push({
                    type: 'sacrifice',
                    from: { row: currentUnit.row, col: currentUnit.col },
                    to: { row: clickedUnit.row, col: clickedUnit.col }
                });

                console.log('Sacrifice executed, switching to next turn');
                this.gameLogic.newTurn();
            }
            return;
        }
        
        // If none of the above, do nothing
        console.log('No valid action for clicked unit');
    }
    
    handleKeyPress(key) {
        if (key === 'Escape') {
            // Deselect current unit
            this.gameLogic.currentTurnUnit = null;
            return;
        }
        
        // Phím d: bắt engine tính đúng một nước rồi đi, kể cả khi auto-play đang tắt.
        // Giữ lại làm công cụ gỡ lỗi: bấm từng nước một để xem engine chọn gì.
        if (key === 'd' || key === 'D') {
            if (this.ai) this.ai.think();
            return;
        }

        // Phím a: bật/tắt chế độ AI tự đi.
        if (key === 'a' || key === 'A') {
            if (this.ai) this.ai.setAutoPlay(!this.ai.autoPlay);
            return;
        }
    }

    destroy() {
        if (this.ai) this.ai.destroy();
        if (this.p5Instance) {
            this.p5Instance.remove();
            this.p5Instance = null;
        }
        this.p = null;
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
        return this.gameLogic.getCurrentTurnInfo();
    }
}

export default P5BattleGraphics;
