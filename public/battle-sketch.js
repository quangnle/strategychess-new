import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES, SACRIFICE, HEAL } from '/core-logic/definitions.js';
import { t } from './i18n.js';
import MatchInfo from '/core-logic/match-info.js';
import GameLogic from '/core-logic/game-logic.js';
import Processor from '/ai-processor/processor.js';
import { AIDriver, AI_MODE } from './ai-driver.js';
import { mountCanvas, loadImages, drawImage, rgba, fillTriangle, strokeCircle, drawHpHearts, drawActedMarker, unitHasActed } from './canvas-2d.js';

class BattleGraphics {
    constructor(matchInfo, aiOptions = {}) {
        this.matchInfo = MatchInfo.createNewMatch(matchInfo.matchId, matchInfo.matchName, matchInfo.team1, matchInfo.team2);

        this.gameLogic = new GameLogic(this.matchInfo);
        this.gameLogic.startMatch();

        this.processor = new Processor(this.gameLogic);

        this.onHudUpdate = aiOptions.onHudUpdate || (() => {});
        this.onReplayActions = aiOptions.onReplayActions || (() => {});
        this.onGameEnd = aiOptions.onGameEnd || (() => {});
        this.replayMode = !!aiOptions.replay;
        this._reportedEnd = false;
        this.ai = new AIDriver(this.gameLogic, {
            mode: aiOptions.mode || AI_MODE.OFF,
            timeMs: aiOptions.timeMs ?? 3000,
            autoPlay: aiOptions.autoPlay ?? true,
            onMoveApplied: (trace) => { this.recentActions = trace; },
            onLoggedActions: (entries) => this._logReplay(entries),
            onUpdate: (driver) => {
                if (aiOptions.onUpdate) aiOptions.onUpdate(driver);
            }
        });

        this.topPanelHeight = 0;
        this.canvasWidth = 550;
        this.canvasHeight = 600;
        this.cellSize = 50;
        this.boardWidth = 550;
        this.boardHeight = 600;
        this.offsetX = 0;
        this.offsetY = 0;
        this._hudKey = '';
        this.host = null;
        this.ctx = null;
        this.images = {};
        this.recentActions = [];

        this.loadImagePaths();
        this.initCanvas();
    }

    loadImagePaths() {
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
        const minCell = (typeof window !== 'undefined' && window.innerWidth < 768) ? 22 : 32;
        this.cellSize = Math.max(minCell, cell);
        this.boardWidth = BOARD_COLS * this.cellSize;
        this.boardHeight = BOARD_ROWS * this.cellSize;
        this.canvasWidth = this.boardWidth;
        this.canvasHeight = this.boardHeight;
        this.offsetX = 0;
        this.offsetY = 0;
        this.topPanelHeight = 0;
    }

    initCanvas() {
        this.host = mountCanvas('battle-canvas-container');
        this.ctx = this.host.ctx;
        this.layoutBoard();
        this.host.setCssSize(this.canvasWidth, this.canvasHeight);

        this.images = loadImages(this.imagePaths);

        this._onPointer = (e) => {
            e.preventDefault();
            if (this.replayMode) return;
            const result = this.gameLogic.isGameEnd();
            if (result !== 0) {
                this.drawGameEndInfoBoard(result);
                return;
            }
            const { x, y } = this.host.eventToLocal(e);
            this.handleCanvasClick(x, y);
        };
        this.host.canvas.addEventListener('pointerdown', this._onPointer);

        this._onKey = (e) => {
            if (this.replayMode) return;
            const result = this.gameLogic.isGameEnd();
            if (result !== 0) {
                this.drawGameEndInfoBoard(result);
                return;
            }
            this.handleKeyPress(e.key);
        };
        this.host.canvas.addEventListener('keydown', this._onKey);

        this._onResize = () => {
            this.layoutBoard();
            this.host.setCssSize(this.canvasWidth, this.canvasHeight);
        };
        window.addEventListener('resize', this._onResize);

        requestAnimationFrame(() => {
            if (!this.host) return;
            this.layoutBoard();
            this.host.setCssSize(this.canvasWidth, this.canvasHeight);
        });

        this.host.startLoop(() => this.draw());
    }

    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = rgba(51);
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        const result = this.gameLogic.isGameEnd();
        if (result !== 0 && !this.replayMode) {
            if (!this._reportedEnd) {
                this._reportedEnd = true;
                try { this.onGameEnd(result); } catch (err) { console.warn('replay end', err); }
            }
            this.drawGameEndInfoBoard(result);
            this._syncHud();
            return;
        }

        if (this.ai && !this.replayMode) this.ai.tick();

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
        const ctx = this.ctx;
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const x = this.offsetX + col * this.cellSize;
                const y = this.offsetY + row * this.cellSize;
                const isEven = (row + col) % 2 === 0;
                ctx.fillStyle = isEven ? rgba(255) : rgba(240);
                ctx.fillRect(x, y, this.cellSize, this.cellSize);
                ctx.strokeStyle = rgba(204);
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, this.cellSize - 1, this.cellSize - 1);
            }
        }
    }

    drawUnits() {
        if (!this.matchInfo || !this.matchInfo.team1 || !this.matchInfo.team2) {
            console.error('MatchInfo not properly initialized');
            return;
        }
        this.drawTeamUnits(this.matchInfo.team1, true);
        this.drawTeamUnits(this.matchInfo.team2, false);
    }

    drawTeamUnits(team, isBlueTeam) {
        if (!team || !team.units) {
            console.error('Team units not found');
            return;
        }
        const aliveUnits = team.units.filter(unit => unit.hp > 0);
        aliveUnits.forEach(unit => {
            if (unit && unit.row !== undefined && unit.col !== undefined) {
                this.drawUnit(unit, isBlueTeam);
            }
        });
    }

    drawUnit(unit, isBlueTeam) {
        const ctx = this.ctx;
        const x = this.offsetX + unit.col * this.cellSize;
        const y = this.offsetY + unit.row * this.cellSize;

        const acted = unitHasActed(this.gameLogic, unit);
        const canBeSelected = unit.teamId === this.gameLogic.currentTurnTeamId &&
                             !acted &&
                             unit.name !== "Base";

        if (canBeSelected) {
            ctx.strokeStyle = rgba(0, 255, 0);
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, this.cellSize, this.cellSize);
        }

        const unitType = unit.armyType || unit.name;
        const imageKey = `${unitType}_${isBlueTeam ? 'blue' : 'red'}`;

        if (this.images[imageKey]) {
            const imgSize = this.cellSize * 0.8;
            const imgX = x + (this.cellSize - imgSize) / 2;
            const imgY = y + (this.cellSize - imgSize) / 2;
            drawImage(ctx, this.images[imageKey], imgX, imgY, imgSize, imgSize);
        }
        if (acted) drawActedMarker(ctx, x, y, this.cellSize, this.cellSize);
        const maxHp = UNIT_TYPES[unit.name]?.hp || UNIT_TYPES[unit.armyType]?.hp || unit.hp || 1;
        drawHpHearts(ctx, x, y, this.cellSize, this.cellSize, unit.hp, maxHp);
        this.drawEffectIndicators(unit, x, y);
    }

    drawEffectIndicators(unit, x, y) {
        if (!unit.effects || unit.effects.length === 0) return;
        const ctx = this.ctx;
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(255, 255, 255, 128);

        const lockEffect = unit.effects.find(e => e.name === 'lock');
        if (lockEffect && (lockEffect.duration === undefined || lockEffect.duration > 0)) {
            ctx.fillText('🔒', x + this.cellSize - 8, y + this.cellSize - 8);
        }

        const adjacentEffect = unit.effects.find(e => e.name === 'adjacent penalty');
        if (adjacentEffect) {
            ctx.fillText('⛔', x + 8, y + this.cellSize - 8);
        }

        const dashEffect = unit.effects.find(e => e.name === 'dash');
        if (dashEffect && (dashEffect.duration === undefined || dashEffect.duration > 0)) {
            ctx.fillText('💨', x + this.cellSize / 2, y + this.cellSize - 8);
        }
    }

    drawArrowIndicator(fromCell, toCell, color) {
        const ctx = this.ctx;
        const x1 = this.offsetX + fromCell.col * this.cellSize + this.cellSize / 2;
        const y1 = this.offsetY + fromCell.row * this.cellSize + this.cellSize / 2;
        const x2 = this.offsetX + toCell.col * this.cellSize + this.cellSize / 2;
        const y2 = this.offsetY + toCell.row * this.cellSize + this.cellSize / 2;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 22;
        const x3 = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
        const y3 = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
        const x4 = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
        const y4 = y2 - arrowSize * Math.sin(angle + Math.PI / 6);
        fillTriangle(ctx, x2, y2, x3, y3, x4, y4);
    }

    drawStayMarker(cell) {
        if (!cell) return;
        const ctx = this.ctx;
        const x = this.offsetX + cell.col * this.cellSize + this.cellSize / 2;
        const y = this.offsetY + cell.row * this.cellSize + this.cellSize / 2;
        ctx.strokeStyle = rgba(120, 180, 255, 200);
        ctx.lineWidth = 3;
        strokeCircle(ctx, x, y, this.cellSize * 0.7);
    }

    highlightReachableCells() {
        if (!this.gameLogic.currentTurnUnit) return;
        const currentUnit = this.gameLogic.currentTurnUnit;
        if (!currentUnit || currentUnit.hp <= 0) return;

        this.highlightCells(this.gameLogic.getReachableCells(currentUnit), rgba(144, 238, 144, 153), 'movable');
        this.highlightCells(this.gameLogic.getAttackableTargets(currentUnit), rgba(255, 99, 71, 153), 'attackable');
        this.highlightCells(this.gameLogic.getHealableTargets(currentUnit), rgba(173, 216, 230, 153), 'healable');
        this.highlightCells(this.gameLogic.getSacrificeableTargets(currentUnit), rgba(255, 255, 224, 153), 'sacrificeable');
    }

    highlightCells(cells, color, type) {
        const ctx = this.ctx;
        cells.forEach(cell => {
            const x = this.offsetX + cell.col * this.cellSize;
            const y = this.offsetY + cell.row * this.cellSize;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, this.cellSize, this.cellSize);
            ctx.strokeStyle = this.getBorderColorForType(type);
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, this.cellSize, this.cellSize);
        });
    }

    getBorderColorForType(type) {
        switch (type) {
            case 'movable':
                return rgba(34, 139, 34);
            case 'attackable':
                return rgba(220, 20, 60);
            case 'healable':
                return rgba(65, 105, 225);
            case 'sacrificeable':
                return rgba(218, 165, 32);
            default:
                return rgba(102, 102, 102);
        }
    }

    drawRecentActions() {
        this.recentActions.forEach(action => {
            switch (action.type) {
                case 'move':
                    this.drawArrowIndicator(action.from, action.to, rgba(0, 255, 0, 220));
                    break;
                case 'attack':
                    this.drawArrowIndicator(action.from, action.to, rgba(255, 0, 0, 230));
                    break;
                case 'heal':
                    this.drawArrowIndicator(action.from, action.to, rgba(0, 0, 255, 220));
                    break;
                case 'sacrifice':
                    this.drawArrowIndicator(action.from, action.to, rgba(255, 255, 0, 230));
                    break;
                case 'stay':
                case 'pass':
                    this.drawStayMarker(action.from || action.to);
                    break;
            }
        });
    }

    drawGameEndInfoBoard(result) {
        const ctx = this.ctx;
        const panelX = this.offsetX;
        const panelY = this.offsetY;
        const panelWidth = this.boardWidth;
        const panelHeight = this.boardHeight;

        ctx.fillStyle = rgba(0, 0, 0, 180);
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

        const winnerKey = result === 1 ? 'Base_blue' : result === 2 ? 'Base_red' : null;
        const img = winnerKey ? this.images[winnerKey] : null;
        const cx = panelX + panelWidth / 2;
        const cy = panelY + panelHeight / 2;
        if (img) {
            const size = Math.min(panelWidth, panelHeight) * 0.28;
            drawImage(ctx, img, cx - size / 2, cy - size - 8, size, size);
        }

        ctx.fillStyle = rgba(255);
        ctx.font = `bold ${Math.max(16, this.cellSize * 0.55)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t('end.gameEnd'), cx, cy + 8);

        const labelText = result === 1 ? t('end.blueWins') : result === 2 ? t('end.redWins') : t('end.draw');
        ctx.fillStyle = result === 1 ? rgba(96, 165, 250) : result === 2 ? rgba(248, 113, 113) : rgba(255);
        ctx.font = `${Math.max(14, this.cellSize * 0.4)}px sans-serif`;
        ctx.fillText(labelText, cx, cy + 36);
    }

    resizeBoard() {
        if (!this.host) return;
        this.layoutBoard();
        this.host.setCssSize(this.canvasWidth, this.canvasHeight);
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

        const col = Math.floor((mouseX - this.offsetX) / this.cellSize);
        const row = Math.floor((mouseY - this.offsetY) / this.cellSize);

        if (this.ai && this.ai.autoPlay && this.ai.controlsCurrentTurn()) return;

        const clickedUnit = this.gameLogic._getUnitByPosition(row, col);
        const currentUnit = this.gameLogic.currentTurnUnit;

        if (!currentUnit) {
            if (clickedUnit && this.canSelectUnit(clickedUnit)) {
                this.gameLogic.currentTurnUnit = clickedUnit;
                console.log(`Selected unit: ${clickedUnit.name}`);
            }
            return;
        }

        if (!clickedUnit) {
            this.handleEmptyCellClick(row, col, currentUnit);
        } else {
            if (this.canSelectUnit(clickedUnit)) {
                const canHeal = this.gameLogic.getHealableTargets(currentUnit).some(target => target.id === clickedUnit.id);
                const canSacrifice = this.gameLogic.getSacrificeableTargets(currentUnit).some(target => target.id === clickedUnit.id);
                const canSuicide = clickedUnit.id === currentUnit.id;

                if (canHeal || canSacrifice || canSuicide) {
                    this.handleUnitClick(clickedUnit, currentUnit);
                } else {
                    this.gameLogic.currentTurnUnit = clickedUnit;
                    console.log(`Switched to unit: ${clickedUnit.name}`);
                }
            } else {
                this.handleUnitClick(clickedUnit, currentUnit);
            }
        }
    }

    handleEmptyCellClick(row, col, currentUnit) {
        const reachableCells = this.gameLogic.getReachableCells(currentUnit);
        const isReachable = reachableCells.some(cell => cell.row === row && cell.col === col);

        if (isReachable) {
            const oldCell = { row: currentUnit.row, col: currentUnit.col };
            const moveSuccess = this.gameLogic.makeMove(currentUnit, row, col);
            if (moveSuccess) {
                console.log(`Unit moved to (${row}, ${col})`);
                this.recentActions = [];
                this.recentActions.push({ type: 'move', from: oldCell, to: { row, col } });
                this._logReplay([{ action: 'move', unitId: currentUnit.id, row, col }]);

                const canAttack = this.gameLogic.getAttackableTargets(currentUnit).length > 0;
                const canHeal = this.gameLogic.getHealableTargets(currentUnit).length > 0;
                const canSacrifice = this.gameLogic.getSacrificeableTargets(currentUnit).length > 0;

                if (!canAttack && !canHeal && !canSacrifice) {
                    console.log('No valid action for current unit, switching to next turn');
                    this.gameLogic.newTurn();
                }
            }
        }
    }

    handleUnitClick(clickedUnit, currentUnit) {
        if (clickedUnit.id === currentUnit.id) {
            const suicideSuccess = this.gameLogic.makeSuicide(currentUnit);
            if (suicideSuccess) {
                console.log('Suicide executed');
                this._logReplay([{ action: 'suicide', unitId: currentUnit.id }]);
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

        const attackableTargets = this.gameLogic.getAttackableTargets(currentUnit);
        const isAttackable = attackableTargets.some(target => target.id === clickedUnit.id);
        if (isAttackable) {
            const attackSuccess = this.gameLogic.makeAttack(currentUnit, clickedUnit);
            if (attackSuccess) {
                console.log(`Attacked unit at (${clickedUnit.row}, ${clickedUnit.col})`);
                this.recentActions = [];
                this.recentActions.push({
                    type: 'attack',
                    from: { row: currentUnit.row, col: currentUnit.col },
                    to: { row: clickedUnit.row, col: clickedUnit.col }
                });
                this._logReplay([{ action: 'attack', unitId: currentUnit.id, targetId: clickedUnit.id }]);
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

        const healableTargets = this.gameLogic.getHealableTargets(currentUnit);
        const isHealable = healableTargets.some(target => target.id === clickedUnit.id);
        if (isHealable) {
            const healSuccess = this.gameLogic.makeHeal(currentUnit, clickedUnit);
            if (healSuccess) {
                console.log(`Healed unit at (${clickedUnit.row}, ${clickedUnit.col})`);
                this.recentActions = [];
                this.recentActions.push({
                    type: 'heal',
                    from: { row: currentUnit.row, col: currentUnit.col },
                    to: { row: clickedUnit.row, col: clickedUnit.col }
                });
                this._logReplay([{ action: 'heal', unitId: currentUnit.id, targetId: clickedUnit.id }]);
                this.gameLogic.endTurn();
                this.gameLogic.newTurn();
            }
            return;
        }

        const sacrificeableTargets = this.gameLogic.getSacrificeableTargets(currentUnit);
        const isSacrificeable = sacrificeableTargets.some(target => target.id === clickedUnit.id);
        if (isSacrificeable) {
            const sacrificeSuccess = this.gameLogic.makeSacrifice(currentUnit, clickedUnit);
            if (sacrificeSuccess) {
                console.log(`Sacrificed for unit at (${clickedUnit.row}, ${clickedUnit.col})`);
                this.recentActions = [];
                this.recentActions.push({
                    type: 'sacrifice',
                    from: { row: currentUnit.row, col: currentUnit.col },
                    to: { row: clickedUnit.row, col: clickedUnit.col }
                });
                this._logReplay([{ action: 'sacrifice', unitId: currentUnit.id, targetId: clickedUnit.id }]);
                console.log('Sacrifice executed, switching to next turn');
                this.gameLogic.newTurn();
            }
            return;
        }

        console.log('No valid action for clicked unit');
    }

    handleKeyPress(key) {
        if (key === 'Escape') {
            this.gameLogic.currentTurnUnit = null;
            return;
        }
        if (key === 'd' || key === 'D') {
            if (this.ai) this.ai.think();
            return;
        }
        if (key === 'a' || key === 'A') {
            if (this.ai) this.ai.setAutoPlay(!this.ai.autoPlay);
            return;
        }
    }

    _logReplay(entries) {
        if (this.replayMode || !entries || !entries.length) return;
        try { this.onReplayActions(entries); } catch (err) { console.warn('replay log', err); }
    }

    destroy() {
        if (this.ai) this.ai.destroy();
        if (this.host) {
            this.host.canvas.removeEventListener('pointerdown', this._onPointer);
            this.host.canvas.removeEventListener('keydown', this._onKey);
            window.removeEventListener('resize', this._onResize);
            this.host.destroy();
            this.host = null;
        }
        this.ctx = null;
    }

    redraw() {}

    nextTurn() {
        this.gameLogic.newTurn();
    }

    getCurrentTurnInfo() {
        return this.gameLogic.getCurrentTurnInfo();
    }
}

export default BattleGraphics;
