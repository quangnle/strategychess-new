import { BOARD_COLS, BOARD_ROWS, ADJACENT_PENALTY, SACRIFICE, LOCK, BERSERK, HEAL, SUICIDE, WIND_WALK, DASH, UNIT_TYPES } from "./definitions.js";

class GameLogic {
    constructor(matchInfo) {
        this.matchInfo = matchInfo;
        this.roundNo = 0;
        this.priorityTeamId = matchInfo.team1.teamId;
        this.alreadyEndedTurnUnits = [];
        this.currentTurnUnit = null; // unit đang thực hiện turn hiện tại
        this.currentTurnTeamId = null; // team đang có quyền thực hiện turn
        this.currentTurnActions = {
            hasMoved: false,
            hasAttacked: false,
            hasHealed: false,
            hasSacrificed: false,
            hasSuicided: false
        };
    }

    startMatch() {
        this.roundNo = 0;
        this.alreadyEndedTurnUnits = [];
        this.currentTurnUnit = null;
        this.currentTurnTeamId = null;
        this._resetTurnActions();
        this._selectNextTeam();
    }    

    newTurn() {
        // loại bỏ toàn bộ các quân đội đã chết ra khỏi bàn cờ bằng cách đưa chúng nó về vị trí âm
        this._removeDeadUnits();

        // thực hiện effect Berserk
        this._berserkEffect();

        // thực hiện effect Adjacent Penalty
        this._adjacentPenaltyEffect();

        // bật effect suicide cho các unit có ability SUICIDE
        this._suicideEffect();  
        
        // đưa unit đang turn vào danh sách đã end turn
        if (this.currentTurnUnit) {
            this.alreadyEndedTurnUnits.push(this.currentTurnUnit);
        }

        // kiểm tra xem có phải round mới không
        if (this._isRoundComplete()) {
            this.roundNo++;
            // thực hiện giảm trừ duration của các effect có duration
            this._reduceEffectDuration();
            
            // reset danh sách đã end turn
            this.alreadyEndedTurnUnits = [];

            // chuyển priority team id
            this.priorityTeamId = this.priorityTeamId === this.matchInfo.team1.teamId ? this.matchInfo.team2.teamId : this.matchInfo.team1.teamId;
        }

        // chọn team tiếp theo để thực hiện turn
        this._selectNextTeam();
        
        // reset turn actions
        this._resetTurnActions();
    }

    // Chọn team tiếp theo dựa trên movement point
    _selectNextTeam() {
        const team1MovementPoint = this._calculateTeamMovementPoint(this.matchInfo.team1.teamId);
        const team2MovementPoint = this._calculateTeamMovementPoint(this.matchInfo.team2.teamId);

        if (team1MovementPoint > team2MovementPoint) {
            this.currentTurnTeamId = this.matchInfo.team1.teamId;
        } else if (team2MovementPoint > team1MovementPoint) {
            this.currentTurnTeamId = this.matchInfo.team2.teamId;
        } else {
            // Nếu bằng nhau, team có priority được ưu tiên
            this.currentTurnTeamId = this.priorityTeamId;
        }

        // Reset currentTurnUnit khi chọn team mới
        this.currentTurnUnit = null;
    }

    // Tính movement point cho một team
    _calculateTeamMovementPoint(teamId) {
        const team = this._getTeamById(teamId);
        const aliveUnits = team.units.filter(u => u.hp > 0 && u.name !== "Base");
        const notYetEndedTurnUnits = aliveUnits.filter(u => !this.alreadyEndedTurnUnits.includes(u));
        return notYetEndedTurnUnits.reduce((total, unit) => total + this._getCurrentSpeed(unit), 0);
    }

    // Kiểm tra xem round có hoàn thành chưa
    _isRoundComplete() {
        const allUnits = this._getAllUnits().filter(u => u.hp > 0 && u.name !== "Base");
        return allUnits.every(unit => this.alreadyEndedTurnUnits.includes(unit));
    }

    // Reset các action của turn hiện tại
    _resetTurnActions() {
        this.currentTurnActions = {
            hasMoved: false,
            hasAttacked: false,
            hasHealed: false,
            hasSacrificed: false,
            hasSuicided: false
        };
    }

    // Kiểm tra xem unit có được phép thực hiện action không
    _canPerformAction(actionType) {
        if (!this.currentTurnUnit) {
            return false;
        }

        // Kiểm tra xem action đã được thực hiện chưa
        if (this.currentTurnActions[`has${actionType}`]) {
            return false;
        }

        return true;
    }

    // Kiểm tra xem unit có được phép thực hiện action không (cho trường hợp chưa có currentTurnUnit)
    _canPerformActionWithoutCurrentUnit(unit, actionType) {
        // Kiểm tra xem unit có thuộc team đang có quyền không
        if (unit.teamId !== this.currentTurnTeamId) {
            return false;
        }

        // Kiểm tra xem unit đã end turn chưa
        if (this.alreadyEndedTurnUnits.includes(unit)) {
            return false;
        }

        // Kiểm tra xem unit có còn sống không
        if (unit.hp <= 0) {
            return false;
        }

        return true;
    }
    
    makeMove(unit, row, col) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd() !== 0) {
            return false;
        }

        // Kiểm tra xem unit có được phép di chuyển dựa trên movement point của team không
        if (!this._canPerformActionWithoutCurrentUnit(unit, 'Moved')) {
            return false;
        }

        // Kiểm tra xem unit đã move chưa
        if (this.currentTurnActions.hasMoved) {
            return false;
        }

        // check if unit has effect LOCK in the effect list
        const effect = unit.effects.find(e => e.name === LOCK);
        if (effect) {            
            // giảm trừ duration của effect
            effect.duration -= 1;
            // loại bỏ effect có duration bằng 0
            if (effect.duration === 0) {
                unit.effects.splice(unit.effects.indexOf(effect), 1);
            }
            return false;
        }

        const reachableCells = this.getReachableCells(unit);
        const isReachable = reachableCells.some(cell => cell.row === row && cell.col === col);
        if (!isReachable) {
            return false;
        }

        // Actually move the unit to the new position
        unit.row = row;
        unit.col = col;

        /*
        // khi di chuyển vào ô mới mà xung quanh các ô này có enemy bị ADJACENT_PENALTY thì apply effect này lên các unit đó
        this._applyAdjacentPenalty(unit);

        // ta cũng cần phải kiểm tra xem vị trí mới có phải là vị trí có quân thù xung quanh không
        // và nếu unit này bị ADJACENT_PENALTY thì phải apply effect này lên chính unit này
        const isAdjacentByEnemy = this._isAdjacentByEnemy(unit);
        if (isAdjacentByEnemy && unit.abilities.includes(ADJACENT_PENALTY)) {
            unit.effects.push({ name: ADJACENT_PENALTY });
        }
        */

        // update lại trạng thái effect ADJACENT_PENALTY
        this._adjacentPenaltyEffect();

        // Lưu lại currentTurnUnit khi unit được phép di chuyển
        this.currentTurnUnit = unit;
        
        // update turn actions
        this.currentTurnActions.hasMoved = true;
        return true;
    }

    makeAttack(unit, target) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd() !== 0) {
            return false;
        }

        // Kiểm tra xem unit có được phép tấn công không
        if (this.currentTurnUnit) {
            // Nếu currentTurnUnit đã tồn tại, kiểm tra xem unit có phải là currentTurnUnit không
            if (unit.id !== this.currentTurnUnit.id) {
                return false;
            }
            // Kiểm tra xem unit có attack được không
            if (!this._canPerformAction('Attacked')) {
                return false;
            }
        } else {
            // Nếu currentTurnUnit chưa tồn tại, kiểm tra xem unit có thuộc team đang có quyền không
            if (!this._canPerformActionWithoutCurrentUnit(unit, 'Attacked')) {
                return false;
            }
            // Set currentTurnUnit
            this.currentTurnUnit = unit;
        }

        // kiểm tra xem unit có effect ADJACENT_PENALTY không
        const effect = unit.effects.find(e => e.name === ADJACENT_PENALTY);
        if (effect) {
            return false;
        }

        // kiểm tra xem target có trong phạm vi tấn công của unit không
        const attackableTargets = this._getEnemiesWithinRange(unit, unit.range);
        if (!attackableTargets.includes(target)) {
            return false;
        }

        // thực hiện tấn công
        if (unit.abilities.includes(LOCK)) {
            this._lockAttack(unit, target);
        } else {
            this._normalAttack(unit, target);
        }

        // update lại trạng thái effect SUICIDE
        this._suicideEffect();

        // update lại trạng thái effect ADJACENT_PENALTY
        this._adjacentPenaltyEffect();

        // update turn actions
        this.currentTurnActions.hasAttacked = true;
        return true;
    }

    makeHeal(unit, target) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd() !== 0) {
            return false;
        }

        // Kiểm tra xem unit có được phép heal không
        if (this.currentTurnUnit) {
            // Nếu currentTurnUnit đã tồn tại, kiểm tra xem unit có phải là currentTurnUnit không
            if (unit.id !== this.currentTurnUnit.id) {
                return false;
            }
            // Kiểm tra xem unit có heal được không
            if (!this._canPerformAction('Healed')) {
                return false;
            }
        } else {
            // Nếu currentTurnUnit chưa tồn tại, kiểm tra xem unit có thuộc team đang có quyền không
            if (!this._canPerformActionWithoutCurrentUnit(unit, 'Healed')) {
                return false;
            }
            // Set currentTurnUnit
            this.currentTurnUnit = unit;
        }

        // kiểm tra xem unit có ability HEAL không
        if (!unit.abilities.includes(HEAL)) {
            return false;
        }

        // kiểm tra xem target có trong phạm vi heal của unit không
        const healableTargets = this._getAlliesWithinRange(unit, unit.magicRange);
        if (!healableTargets.includes(target)) {
            return false;
        }

        // update unit hp
        target.hp += 1;

        // update lại trạng thái effect SUICIDE
        this._suicideEffect();
        
        // update turn actions
        this.currentTurnActions.hasHealed = true;
        return true;
    }

    makeSacrifice(unit, target) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd() !== 0) {
            return false;
        }

        // Kiểm tra xem unit có được phép sacrifice không
        if (this.currentTurnUnit) {
            // Nếu currentTurnUnit đã tồn tại, kiểm tra xem unit có phải là currentTurnUnit không
            if (unit.id !== this.currentTurnUnit.id) {
                return false;
            }
            // Kiểm tra xem unit có sacrifice được không
            if (!this._canPerformAction('Sacrificed')) {
                return false;
            }
        } else {
            // Nếu currentTurnUnit chưa tồn tại, kiểm tra xem unit có thuộc team đang có quyền không
            if (!this._canPerformActionWithoutCurrentUnit(unit, 'Sacrificed')) {
                return false;
            }
            // Set currentTurnUnit
            this.currentTurnUnit = unit;
        }

        // kiểm tra xem unit có ability SACRIFICE không
        if (!unit.abilities.includes(SACRIFICE)) {
            return false;
        }

        // kiểm tra xem target có trong phạm vi có thể sacrifice không
        const sacrificeableTargets = this.getSacrificeableTargets(unit);        
        if (!sacrificeableTargets || !sacrificeableTargets.includes(target)) {
            return false;
        }

        // kiểm tra xem target có hp dưới maxHp của nó không
        const maxHp = this._getMaxHp(target);
        if (target.hp >= maxHp) {
            return false;
        }

        // thực hiện sacrifice
        unit.hp -= 1;
        target.hp += 1;
        
        // update lại trạng thái effect ADJACENT_PENALTY
        this._adjacentPenaltyEffect();
        
        // update lại trạng thái effect SUICIDE
        this._suicideEffect();
        
        // update turn actions
        this.currentTurnActions.hasSacrificed = true;
        return true;
    }

    makeSuicide(unit) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd() !== 0) {
            return false;
        }

        // Kiểm tra xem unit có được phép suicide không
        if (this.currentTurnUnit) {
            // Nếu currentTurnUnit đã tồn tại, kiểm tra xem unit có phải là currentTurnUnit không
            if (unit.id !== this.currentTurnUnit.id) {
                return false;
            }
            // Kiểm tra xem unit có suicide được không
            if (!this._canPerformAction('Suicided')) {
                return false;
            }
        } else {
            // Nếu currentTurnUnit chưa tồn tại, kiểm tra xem unit có thuộc team đang có quyền không
            if (!this._canPerformActionWithoutCurrentUnit(unit, 'Suicided')) {
                return false;
            }
            // Set currentTurnUnit
            this.currentTurnUnit = unit;
        }

        // kiểm tra xem unit có ability SUICIDE không
        if (!unit.abilities.includes(SUICIDE)) {
            return false;
        }

        // kiểm tra xem unit có còn đúng 1 hp không
        if (unit.hp !== 1) {
            return false;
        }

        // thực hiện suicide
        unit.hp = 0;
        // tìm 8 ô xung quanh unit
        const adjacentCells = this._get8AdjacentCells(unit.row, unit.col);
        // tìm tất cả các unit đứng trong 8 ô xung quanh unit
        const adjacentUnits = adjacentCells.map(cell => this._getUnitByPosition(cell.row, cell.col)).filter(u => u && u.hp > 0);
        // giảm hp của tất cả các unit trong 8 ô xung quanh unit
        adjacentUnits.forEach(u => u.hp -= 1);   
        
        // update lại trạng thái effect ADJACENT_PENALTY
        this._adjacentPenaltyEffect();
        
        // update turn actions
        this.currentTurnActions.hasSuicided = true;
        return true;
    }

    // End turn cho unit hiện tại
    endTurn() {
        if (this.currentTurnUnit) {
            this.alreadyEndedTurnUnits.push(this.currentTurnUnit);
            this.currentTurnUnit = null;
            this.currentTurnTeamId = null;
            this._resetTurnActions();
        }
    }

    isGameEnd() {        
        // kiểm tra xem có base nào đã bị hp không
        const team1Base = this.matchInfo.team1.units.find(u => u.name === "Base");
        const team2Base = this.matchInfo.team2.units.find(u => u.name === "Base");

        // kiểm tra xem có bị null không rồi throw error
        if (!team1Base || !team2Base) {
            throw new Error("isGameEnd: Base not found!");
        }

        if (team1Base.hp <= 0) {
            return 2; // team 2 thắng
        }

        if (team2Base.hp <= 0) {
            return 1; // team 1 thắng
        }

        // kiểm tra xem unit team nào đã hết unit còn sống
        const team1Units = this.matchInfo.team1.units.filter(u => u.hp > 0 && u.name !== "Base");
        const team2Units = this.matchInfo.team2.units.filter(u => u.hp > 0 && u.name !== "Base");
        if (team1Units.length === 0) {
            return 2; // team 2 thắng
        }

        if (team2Units.length === 0) {
            return 1;
        }

        if (this.roundNo >= 20) {
            return 3; // hòa
        }

        return 0;
    }

    getAttackableTargets(unit) {
        // kiểm tra xem unit có phải là unit đang turn không
        if (unit.id !== this.currentTurnUnit?.id) {
            return [];
        }

        // kiểm tra xem unit có attack được không
        if (this.currentTurnActions.hasAttacked) {
            return [];
        }

        // kiểm tra nếu unit đang bị ADJACENT_PENALTY thì không thể attack
        if (unit.effects.find(e => e.name === ADJACENT_PENALTY)) {
            return [];
        }

        const attackableTargets = this._getEnemiesWithinRange(unit, unit.range);
        return attackableTargets;
    }

    getHealableTargets(unit) {
        // kiểm tra xem unit có phải là unit đang turn không
        if (unit.id !== this.currentTurnUnit?.id) {
            return [];
        }

        // kiểm tra xem unit có heal được không
        if (this.currentTurnActions.hasHealed) {
            return [];
        }

        // kiểm tra xem unit có ability HEAL không
        if (!unit.abilities.includes(HEAL)) {
            return [];
        }

        // tìm tất cả các unit trong phạm vi heal của unit
        let healableTargets = this._getAlliesWithinRange(unit, unit.magicRange);
        healableTargets = healableTargets.filter(t => t.hp < this._getMaxHp(t));
        return healableTargets;
    }

    getSacrificeableTargets(unit) {
        // kiểm tra xem unit có phải là unit đang turn không
        if (unit.id !== this.currentTurnUnit?.id) {
            return [];
        }

        // kiểm tra xem unit có sacrifice được không
        if (this.currentTurnActions.hasSacrificed) {
            return [];
        }

        // kiểm tra xem unit có ability SACRIFICE không
        if (!unit.abilities.includes(SACRIFICE)) {
            return [];
        }

        // tìm tất cả các unit trong 4 ô xung quanh unit
        let sacrificeableTargets = this._get4AdjacentCells(unit.row, unit.col).map(cell => this._getUnitByPosition(cell.row, cell.col));
        sacrificeableTargets = sacrificeableTargets.filter(t => t && t.hp > 0 && t.hp < this._getMaxHp(t));
        return sacrificeableTargets;
    }

    getReachableCells(unit) {
        // kiếm tra unit có ability WIND_WALK không
        if (unit.abilities.includes(WIND_WALK)) {
            // nếu có thì dùng Manhattan distance để tìm reachable cells
            return this._getReachableCellsMahattan(unit, this._getCurrentSpeed(unit));    
        }

        // nếu không thì dùng BFS để tìm reachable cells
        return this._getReachableCellsBFS(unit, this._getCurrentSpeed(unit));        
    }

    // Lấy thông tin turn hiện tại
    getCurrentTurnInfo() {
        return {
            currentTurnUnit: this.currentTurnUnit,
            currentTurnTeamId: this.currentTurnTeamId,
            currentTurnActions: { ...this.currentTurnActions },
            priorityTeamId: this.priorityTeamId,
            roundNo: this.roundNo
        };
    }

    // HELPER FUNCTIONS
    _applyAdjacentPenalty(unit) {
        // tìm tất cả các ô xung quanh unit
        const adjacentCells = this._get4AdjacentCells(unit.row, unit.col);

        // tìm tất cả các unit đứng trong các ô xung quanh unit
        const adjacentUnits = adjacentCells.map(cell => this._getUnitByPosition(cell.row, cell.col)).filter(u => u && u.hp > 0);

        // kiểm tra xem có unit nào đứng trong các ô xung quanh unit và có teamId khác unit.teamId không
        const adjacentEnemyUnits = adjacentUnits.filter(u => u.teamId !== unit.teamId);

        // kiểm tra xem có unit nào đứng trong các ô xung quanh unit và có ability ADJACENT_PENALTY không
        const adjacentEnemyUnitsWithAdjacentPenalty = adjacentEnemyUnits.filter(u => u.abilities.includes(ADJACENT_PENALTY));

        // nếu có thì apply effect ADJACENT_PENALTY lên các unit đó
        adjacentEnemyUnitsWithAdjacentPenalty.forEach(u => u.effects.push({ name: ADJACENT_PENALTY}));        
    }

    // lấy speed hiện tại của unit dựa vào speed của unit và thông tin của effect DASH
    _getCurrentSpeed(unit) {
        let speed = unit.speed;
        if (unit.effects) {
            const dashEffect = unit.effects.find(e => e.name === DASH);
            if (dashEffect) {
                speed += dashEffect.value;            
                // speed tối đa là 4.5 để phù hợp với gameplay hiện tại
                speed = Math.min(4.5, speed);
            }
        }
        
        return speed;
    }

    _getReachableCellsMahattan(unit, range) {
        const reachableCells = [];
        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                // kiểm tra xem ô này có nằm trong range của unit không và ô này không có unit
                const isInRange = this._getManhattanDistance(unit, { row: r, col: c } ) <= range;
                const isEmptyCell = this._getUnitByPosition(r, c) === null || this._getUnitByPosition(r, c).hp <= 0;
                if (isInRange && isEmptyCell) {
                    const cell = { row: r, col: c };
                    reachableCells.push(cell);
                }
            }
        }
        return reachableCells;
    }

    _getReachableCellsBFS(unit, range) {
        const visited = new Set();
        const queue = [{ row: unit.row, col: unit.col, d:0 }];
        const reachableCells = [];
        
        while (queue.length > 0) {
            const curCell = queue.shift();
            const cellKey = `${curCell.row},${curCell.col}`;
            
            if (visited.has(cellKey)) continue;
            visited.add(cellKey);
            
            // Add current cell to reachable cells if it's not the unit's position
            if (curCell.row !== unit.row || curCell.col !== unit.col) {
                reachableCells.push(curCell);
            }
            
            const adjacentCells = this._get4AdjacentCells(curCell.row, curCell.col);
            adjacentCells.forEach(cell => {
                const adjacentCellKey = `${cell.row},${cell.col}`;
                // cập nhật độ dài đường đi
                cell.d = curCell.d + 1;
                // kiểm tra xem ô này có là ô empty không
                const isEmptyCell = !this._getUnitByPosition(cell.row, cell.col) || this._getUnitByPosition(cell.row, cell.col).hp <= 0;
                //kiểm tra xem ô này có nằm trong range của unit không
                const isInRange = cell.d <= range;
                // nếu ô này là ô empty, chưa được visit và nằm trong range của unit thì thêm vào queue
                if (isEmptyCell && !visited.has(adjacentCellKey) && isInRange) {
                    queue.push(cell);
                    // visited.add(adjacentCellKey);
                }
            });
        }
        return reachableCells;
    }

    _getManhattanDistance(cell1, cell2) {
        return Math.abs(cell1.row - cell2.row) + Math.abs(cell1.col - cell2.col);
    }

    _getEnemiesWithinRange(unit, range) {
        // tìm tất cả enemies còn sống của unit
        const enemies = this._getEnemies(unit).filter(e => e.hp > 0);
        // kiểm tra xem enemy nào nằm trong tầm range theo Manhattan distance
        const enemiesWithinRange = enemies.filter(e => this._getManhattanDistance(unit, e) <= range);
        return enemiesWithinRange;
    }

    _getAlliesWithinRange(unit, range) {
        // tìm tất cả allies còn sống của unit
        const allies = this._getAllies(unit).filter(a => a.hp > 0);
        // kiểm tra xem ally nào nằm trong tầm range theo Manhattan distance
        const alliesWithinRange = allies.filter(a => this._getManhattanDistance(unit, a) <= range);
        return alliesWithinRange;
    }

    _getEnemies(unit) {
        const allUnits = this._getAllUnits();
        return allUnits.filter(u => u.teamId !== unit.teamId);
    }

    _getAllies(unit) {
        const allUnits = this._getAllUnits();
        return allUnits.filter(u => u.teamId === unit.teamId);
    }

    _lockAttack(unit, target) {
        target.hp -= 1;
        
        // lock target trong 2 turn
        if (target.hp > 0) {
            const effect = target.effects.find(e => e.name === LOCK);
            if (!effect) {
                target.effects.push({ name: LOCK, duration: 2 });
            } else {
                effect.duration = 2;
            }
        }

        // add hiệu ứng DASH vào unit
        if (!unit.effects.find(e => e.name === DASH)) {
            unit.effects.push({ name: DASH, duration: 2, value: 1 });
        }
    }

    _normalAttack(unit, target) {
        target.hp -= 1;
    }

    _reduceEffectDuration() {
        const allUnits = this._getAllUnits().filter(u => u.hp > 0);
        // giảm trừ duration của các effect có duration
        allUnits.forEach(u => {
            if (u.effects && u.effects.length > 0) {
                // ✅ FIX: Giữ lại permanent effects (no duration) và temporary effects (duration > 0)
                // Chỉ loại bỏ expired effects (duration = 0)
                u.effects = u.effects.filter(e => e.duration === undefined || e.duration > 0);
                
                // ✅ FIX: Chỉ giảm duration cho effects có duration property
                u.effects.forEach(e => {
                    if (e.duration !== undefined) {
                        e.duration -= 1;
                    }
                });
            }
        });
    }

    _suicideEffect() {
        const allUnits = this._getAllUnits();
        // tìm tất cả các unit có ability SUICIDE và hp = 1 và không có effect SUICIDE  
        const suicideUnits = allUnits.filter(u => u.abilities.includes(SUICIDE) && u.hp === 1 && !u.effects.find(e => e.name === SUICIDE));
        // thêm effect SUICIDE cho các unit đó
        suicideUnits.forEach(u => {
            u.effects.push({ name: SUICIDE });
        });
    }

     _adjacentPenaltyEffect() {
        const allUnits = this._getAllUnits();
        allUnits.forEach(u => {
            if (u.abilities.includes(ADJACENT_PENALTY)) {
                // kiểm tra xem 4 ô chung quanh của unit có enemy không
                const adjacentCells = this._get4AdjacentCells(u.row, u.col);
                const adjacentEnemies = adjacentCells.map(cell => this._getUnitByPosition(cell.row, cell.col)).filter(e => e && e.teamId !== u.teamId && e.hp > 0);
                // nếu có và unit đó không có effect ADJACENT_PENALTY thì thêm effect ADJACENT_PENALTY lên unit đó
                if (adjacentEnemies.length > 0 && !u.effects.find(e => e.name === ADJACENT_PENALTY)) {
                    u.effects.push({ name: ADJACENT_PENALTY });
                }
            }
        });
    }

    _berserkEffect() {
        const allUnits = this._getAllUnits();
        // tìm tất cả các unit có ability BERSERK
        const berserkUnits = allUnits.filter(u => u.abilities.includes(BERSERK) && u.hp > 0 && u.name !== "Base");

        // nếu có chỉ có 1 unit có ability BERSERK thì thực hiện effect BERSERK
        for (let i = 0; i < berserkUnits.length; i++) {
            const berserkUnit = berserkUnits[i];
            // tìm tất cả các allies của berserkUnit
            let allies = this._getAllUnitsByTeamId(berserkUnit.teamId);
            // loại bỏ base khỏi allies
            allies = allies.filter(u => u.name !== "Base" && u.hp > 0);
            if (allies.length === 1) { /// nghĩa là chỉ còn mỗi một mình berserk unit còn sống
                // tính toán số hp tối đa mà berserkUnit có thể có
                berserkUnit.hp = Math.min(berserkUnit.hp + 1, this._getMaxHp(berserkUnit));
                berserkUnit.speed += 1;
                // xóa ability BERSERK khỏi berserkUnit để tránh bị effect BERSERK lặp lại
                berserkUnit.abilities = berserkUnit.abilities.filter(a => a !== BERSERK);
                console.log(`Berserk effect applied to ${berserkUnit.name}`);
            }
        }
    }

    _getMaxHp(unit) {
        const maxHp = UNIT_TYPES[unit.name].hp;
        return maxHp;
    }
    
    _getTeamById(teamId) {
        if (teamId === this.matchInfo.team1.teamId) {
            return this.matchInfo.team1;
        } else {
            return this.matchInfo.team2;
        }
    }

    _getAllUnitsByTeamId(teamId) {
        const team = this._getTeamById(teamId);
        return team.units;
    }

    _getAllUnits() {
        return this.matchInfo.team1.units.concat(this.matchInfo.team2.units);
    }

    _getUnitByPosition(row, col) {
        const allUnits = this._getAllUnits();
        const unit = allUnits.find(u => u.row === row && u.col === col);
        
        if (!unit) return null; // standardize thành null
        
        return unit;
    }

    // kiểm tra xem unit có đứng cạnh enemy còn sống không
    _isAdjacentByEnemy(unit) {
        const adjacentCells = this._get4AdjacentCells(unit.row, unit.col);
        const adjacentEnemyUnits = adjacentCells.map(cell => this._getUnitByPosition(cell.row, cell.col))
                                                .filter(u => u && u.teamId !== unit.teamId && u.hp > 0);        
        return adjacentEnemyUnits.length > 0;
    }

    // lấy 4 ô xung quanh unit
    _get4AdjacentCells(row, col) {
        const cells = [];
        const topCell = { row: row - 1, col: col };
        const bottomCell = { row: row + 1, col: col };
        const leftCell = { row: row, col: col - 1 };
        const rightCell = { row: row, col: col + 1 };
        if (topCell.row >= 0 && topCell.row < BOARD_ROWS && topCell.col >= 0 && topCell.col < BOARD_COLS) {
            cells.push(topCell);
        }
        if (bottomCell.row >= 0 && bottomCell.row < BOARD_ROWS && bottomCell.col >= 0 && bottomCell.col < BOARD_COLS) {
            cells.push(bottomCell);
        }
        if (leftCell.row >= 0 && leftCell.row < BOARD_ROWS && leftCell.col >= 0 && leftCell.col < BOARD_COLS) {
            cells.push(leftCell);
        }
        if (rightCell.row >= 0 && rightCell.row < BOARD_ROWS && rightCell.col >= 0 && rightCell.col < BOARD_COLS) {
            cells.push(rightCell);
        }
        return cells;
    }

    // lấy 8 ô xung quanh unit
    _get8AdjacentCells(row, col) {
        const cells = [];
        const topCell = { row: row - 1, col: col };
        const bottomCell = { row: row + 1, col: col };
        const leftCell = { row: row, col: col - 1 };
        const rightCell = { row: row, col: col + 1 };
        const topLeftCell = { row: row - 1, col: col - 1 };
        const topRightCell = { row: row - 1, col: col + 1 };
        const bottomLeftCell = { row: row + 1, col: col - 1 };
        const bottomRightCell = { row: row + 1, col: col + 1 };
        if (topCell.row >= 0 && topCell.row < BOARD_ROWS && topCell.col >= 0 && topCell.col < BOARD_COLS) {
            cells.push(topCell);
        }
        if (bottomCell.row >= 0 && bottomCell.row < BOARD_ROWS && bottomCell.col >= 0 && bottomCell.col < BOARD_COLS) {
            cells.push(bottomCell);
        }
        if (leftCell.row >= 0 && leftCell.row < BOARD_ROWS && leftCell.col >= 0 && leftCell.col < BOARD_COLS) {
            cells.push(leftCell);
        }
        if (rightCell.row >= 0 && rightCell.row < BOARD_ROWS && rightCell.col >= 0 && rightCell.col < BOARD_COLS) {
            cells.push(rightCell);
        }
        if (topLeftCell.row >= 0 && topLeftCell.row < BOARD_ROWS && topLeftCell.col >= 0 && topLeftCell.col < BOARD_COLS) {
            cells.push(topLeftCell);
        }
        if (topRightCell.row >= 0 && topRightCell.row < BOARD_ROWS && topRightCell.col >= 0 && topRightCell.col < BOARD_COLS) {
            cells.push(topRightCell);
        }
        if (bottomLeftCell.row >= 0 && bottomLeftCell.row < BOARD_ROWS && bottomLeftCell.col >= 0 && bottomLeftCell.col < BOARD_COLS) {
            cells.push(bottomLeftCell);
        }
        if (bottomRightCell.row >= 0 && bottomRightCell.row < BOARD_ROWS && bottomRightCell.col >= 0 && bottomRightCell.col < BOARD_COLS) {
            cells.push(bottomRightCell);
        }
        return cells;
    }

    _removeDeadUnits() {
        const allUnits = this._getAllUnits();
        allUnits.forEach(u => {
            if (u.hp <= 0) {
                u.row = -Infinity;
                u.col = -Infinity;
            }
        });
    }
}

export default GameLogic;