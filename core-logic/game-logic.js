import { BOARD_COLS, BOARD_ROWS, ADJACENT_PENALTY, SACRIFICE, LOCK, BERSERK, HEAL, SUICIDE, WIND_WALK, DASH, UNIT_TYPES } from "./definitions.js";

class GameLogic {
    constructor(matchInfo) {
        this.matchInfo = matchInfo;
        this.roundNo = 0;
        this.turnSequence = [];        
        this.currentTurnInfo = null;        
        this.priorityTeamId = matchInfo.team1.teamId;
        this.alreadyEndedTurnUnits = [];
    }

    startMatch() {
        this.roundNo = 0;
        // tạo turn sequence
        this._setupTurnSequence();
        this.currentTurnInfo = { inTurnUnit: this.turnSequence[0], canMove: true, canAttack: true, canHeal: true };
    }    

    newTurn() {
        // loại bỏ toàn bộ các quân đội đã chết ra khỏi bàn cờ bằng cách đưa chúng nó về vị trí âm
        this._removeDeadUnits();

        // thực hiện effect Berserk
        this._berserkEffect();
        
        // đưa unit đang turn vào danh sách đã end turn
        this.alreadyEndedTurnUnits.push(this.currentTurnInfo.inTurnUnit);
        // tính toán lại turn sequence
        this._setupTurnSequence();

        // tìm index của unit trong turn hiện tại
        // bằng cách duyệt qua turn sequence và kiểm ra index đầu tiên không phải là unit đã end turn
        let index = 0;
        while (index < this.turnSequence.length) {
            if (this.alreadyEndedTurnUnits.includes(this.turnSequence[index])) {
                index++;
            } else {
                break;
            }
        }

        // nếu index bằng turn sequence length nghĩa là toàn bộ các unit đã end turn
        // thì tăng round lên 1 nghĩa là thực hiện round mới
        if (index === this.turnSequence.length) {
            this.roundNo++;
            // thực hiện giảm trừ duration của các effect có duration
            this._reduceEffectDuration();
            
            // reset danh sách đã end turn
            this.alreadyEndedTurnUnits = [];

            // chuyển priority team id
            this.priorityTeamId = this.priorityTeamId === this.matchInfo.team1.teamId ? this.matchInfo.team2.teamId : this.matchInfo.team1.teamId;
            // tính toán lại turn sequence
            this._setupTurnSequence();
            // reset index
            index = 0;
        }

        // cập nhật unit đang turn là unit đầu tiên trong turn sequence
        this.currentTurnInfo.inTurnUnit = this.turnSequence[index];
        this.currentTurnInfo.canMove = true;
        this.currentTurnInfo.canAttack = true;
        this.currentTurnInfo.canHeal = true;  

        // kiểm tra xem unit đang turn có effect ADJACENT_PENALTY không
        const isAdjacentByEnemy = this._isAdjacentByEnemy(this.currentTurnInfo.inTurnUnit);
        if (isAdjacentByEnemy && this.currentTurnInfo.inTurnUnit.abilities.includes(ADJACENT_PENALTY)) {
            // nếu có thì apply effect ADJACENT_PENALTY lên chính unit này
            this.currentTurnInfo.inTurnUnit.effects.push({ name: ADJACENT_PENALTY });
            // không thể tấn công nếu bị ADJACENT_PENALTY
            this.currentTurnInfo.canAttack = false;
        } else {
            // nếu không thì loại bỏ effect ADJACENT_PENALTY khỏi unit này
            this.currentTurnInfo.inTurnUnit.effects = this.currentTurnInfo.inTurnUnit.effects.filter(e => e.name !== ADJACENT_PENALTY);
        }     
    }
    
    makeMove(unit, row, col) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd()) {
            return false;
        }

        // kiểm tra unit này có phải là unit đang turn không
        if (unit.id !== this.currentTurnInfo.inTurnUnit.id) {
            return false;
        }

        // kiểm tra xem unit này có move được không
        if (!this.currentTurnInfo.canMove) {
            return false;
        }

        // check if unit has effect LOCK in the effect list
        const effect = unit.effects.find(e => e.name === LOCK);
        if (effect) {            
            this.currentTurnInfo.canMove = false;
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
            this.currentTurnInfo.canMove = false;
            return false;
        }

        // Actually move the unit to the new position
        unit.row = row;
        unit.col = col;

        // khi di chuyển vào ô mới mà xung quanh các ô này có enemy bị ADJACENT_PENALTY thì apply effect này lên các unit đó
        this._applyAdjacentPenalty(unit);

        // ta cũng cần phải kiểm tra xem vị trí mới có phải là vị trí có quân thù xung quanh không
        // và nếu unit này bị ADJACENT_PENALTY thì phải apply effect này lên chính unit này
        const isAdjacentByEnemy = this._isAdjacentByEnemy(unit);
        if (isAdjacentByEnemy && unit.abilities.includes(ADJACENT_PENALTY)) {
            unit.effects.push({ name: ADJACENT_PENALTY });

            // không thể tấn công nếu bị ADJACENT_PENALTY
            this.currentTurnInfo.canAttack = false;
        }

        // update current turn info
        this.currentTurnInfo.canMove = false;
        return true;
    }

    makeAttack(unit, target) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd()) {
            return false;
        }

        // kiểm tra unit này có phải là unit đang turn không
        if (unit.id !== this.currentTurnInfo.inTurnUnit.id) {
            return false;
        }

        // kiểm tra xem unit có attack được không
        if (!this.currentTurnInfo.canAttack) {
            return false;
        }

        // kiểm tra xem unit có effect ADJACENT_PENALTY không
        const effect = unit.effects.find(e => e.name === ADJACENT_PENALTY);
        if (effect) {
            this.currentTurnInfo.canAttack = false;
            return false;
        }

        // kiểm tra xem target có trong phạm vi tấn công của unit không
        const attackableTargets = this._getEnemiesWithinRange(unit, unit.range);
        if (!attackableTargets.includes(target)) {
            this.currentTurnInfo.canAttack = false;
            return false;
        }

        // thực hiện tấn công
        if (unit.abilities.includes(LOCK)) {
            this._lockAttack(unit, target);
        } else {
            this._normalAttack(unit, target);
        }

        return true;
    }

    makeHeal(unit, target) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd()) {
            return false;
        }

        // kiểm tra xem unit có phải là unit đang turn không
        if (unit.id !== this.currentTurnInfo.inTurnUnit.id) {
            return false;
        }

        // kiểm tra xem unit có heal được không
        if (!this.currentTurnInfo.canHeal) {
            return false;
        }

        // kiểm tra xem unit có ability HEAL không
        if (!unit.abilities.includes(HEAL)) {
            return false;
        }

        // kiểm tra xem target có trong phạm vi heal của unit không
        const healableTargets = this._getAlliesWithinRange(unit, unit.magicRange);
        if (!healableTargets.includes(target)) {
            this.currentTurnInfo.canHeal = false;
            return false;
        }

        // update unit hp
        target.hp += 1;
        this.currentTurnInfo.canMove = false;
        this.currentTurnInfo.canAttack = false;
        this.currentTurnInfo.canHeal = false;

        return true;
    }

    makeSacrifice(unit, target) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd()) {
            return false;
        }

        // kiểm tra xem unit có phải là unit đang turn không
        if (unit.id !== this.currentTurnInfo.inTurnUnit.id) {
            return false;
        }

        // kiểm tra xem unit có sacrifice được không
        if (!this.currentTurnInfo.canAttack) {
            return false;
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
        this.currentTurnInfo.canMove = false;
        this.currentTurnInfo.canAttack = false;
        this.currentTurnInfo.canHeal = false;

        return true;
    }

    makeSuicide(unit) {
        // kiểm tra xem game có kết thúc không
        if (this.isGameEnd()) {
            return false;
        }

        // kiểm tra xem unit có phải là unit đang turn không
        if (unit.id !== this.currentTurnInfo.inTurnUnit.id) {
            return false;
        }

        // kiểm tra xem unit có suicide được không
        if (!this.currentTurnInfo.canAttack) {
            return false;
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
        // chuyển sang turn tiếp theo
        this.currentTurnInfo.canMove = false;
        this.currentTurnInfo.canAttack = false;
        this.currentTurnInfo.canHeal = false;

        return true;
    }

    isGameEnd() {        
        // kiểm tra xem có base nào đã bị hp không
        const team1Base = this.matchInfo.team1.units.find(u => u.name === "Base");
        const team2Base = this.matchInfo.team2.units.find(u => u.name === "Base");

        // kiểm tra xem có bị null không rồi throw error
        if (!team1Base || !team2Base) {
            throw new Error("isGameEnd: Base not found!");
        }

        if (team1Base.hp <= 0 || team2Base.hp <= 0) {
            return true;
        }

        // kiểm tra xem unit team nào đã hết unit còn sống
        const team1Units = this.matchInfo.team1.units.filter(u => u.hp > 0 && u.name !== "Base");
        const team2Units = this.matchInfo.team2.units.filter(u => u.hp > 0 && u.name !== "Base");
        if (team1Units.length === 0 || team2Units.length === 0) {
            return true;
        }

        if (this.roundNo >= 20) {
            return true;
        }

        return false;
    }

    getAttackableTargets(unit) {
        // kiểm tra xem unit có can attack được không
        if (!this.currentTurnInfo.canAttack) {
            return [];
        }

        const attackableTargets = this._getEnemiesWithinRange(unit, unit.range);
        return attackableTargets;
    }

    getHealableTargets(unit) {
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

    _setupTurnSequence() {
        let allUnits = this._getAllUnits();    
        allUnits = allUnits.filter(u => u.hp > 0); // lọc ra các unit còn sống

        // sắp xếp turn sequence theo speed
        // team nào được ưu tiên thì đứng trước
        const priorityTeamId = this.priorityTeamId;
        allUnits.sort((a, b) => {
            // apply dash effect cho unit a và b
            let aSpeed = this._getCurrentSpeed(a);
            let bSpeed = this._getCurrentSpeed(b);            

            if (aSpeed === bSpeed) {
                return priorityTeamId === a.teamId ? -1 : 1;
            }
            return (bSpeed - aSpeed > 0) ? 1 : -1;
        });        

        // xen kẽ
        const seq = [];
        let curSpeed = this._getCurrentSpeed(allUnits[0]);
        let subSeq = [];
        for (let i = 0; i < allUnits.length; i++) {
            if (this._getCurrentSpeed(allUnits[i]) === curSpeed) { // chọn ra tất cả các unit có cùng speed
                subSeq.push(allUnits[i]);
            } else {
                subSeq = this._makeAlternativeList(subSeq); // xen kẽ
                seq.push(...subSeq); // thêm phần còn lại vào

                // reset subSeq với unit đầu tiên
                subSeq = [allUnits[i]];                 
                // cập nhật curSpeed
                curSpeed = this._getCurrentSpeed(allUnits[i]);                
            }
        }        
        if (subSeq.length > 0) { // xử lý phần còn lại
            subSeq = this._makeAlternativeList(subSeq); 
            seq.push(...subSeq); 
        }
        // loại base khỏi turn sequence
        this.turnSequence = seq.filter(u => u.hp > 0 && u.name !== "Base");
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

        // update lại trạng thái của unit
        this.currentTurnInfo.canMove = false;
        this.currentTurnInfo.canAttack = false;
        this.currentTurnInfo.canHeal = false;
    }

    _normalAttack(unit, target) {
        target.hp -= 1;
        // update lại trạng thái của unit
        this.currentTurnInfo.canMove = false;
        this.currentTurnInfo.canAttack = false;
        this.currentTurnInfo.canHeal = false;
    }

    _reduceEffectDuration() {
        const allUnits = this._getAllUnits().filter(u => u.hp > 0);
        // giảm trừ duration của các effect có duration
        allUnits.forEach(u => {
            if (u.effects && u.effects.length > 0) {
                // loại bỏ effect có duration bằng 0
                u.effects = u.effects.filter(e => e.duration > 0);
                // giảm trừ duration của tất cả các effect
                u.effects.forEach(e => {
                    // giảm trừ duration của effect
                    e.duration -= 1;
                });
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

    // sắp xếp xen kẽ
    _makeAlternativeList(list) {
        if (list.length <= 1) {
            return list;
        }
        let start = 0;
        let end = list.length - 1;
        while (start < end && list[start].teamId !== list[end].teamId) {
            // mang list[end] insert vào giữa vị trí start và start + 1
            list.splice(start + 1, 0, list[end]);
            list.pop();
            start += 2;
        }
        return list;
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