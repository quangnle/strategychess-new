import { BaseStrategy } from "./base-strategy.js";

export class RangerStrategy extends BaseStrategy {

    // Common static tables that can be overridden by subclasses
    attackBonusTable = {
        'Tanker': 55,
        'Assassin': 70,
        'Ranger': 85,
        'Base': 25,
        'Trezdin': 60,
        'Taki': 45,
        'Trarex': 90,
        'Ara': 100,
        'Nizza': 60,
        'Wizzi': 90
    };

    evaluatePosition(unit, row, col) {
        let score = 0;
        
        let isAdjacentPenalty = false;
        // kiểm tra xem có đang bị effect của ADJACENT_PENALTY không
        if (unit.abilities.includes(ADJACENT_PENALTY)) {
            isAdjacentPenalty = true;
        }

        // nếu ô (row, col) có target
        const targets = this._getAttackableTargets(unit, row, col);
        if (targets.length > 0 && !isAdjacentPenalty) {            
            score += this._calculateAttackScore(unit, targets);
        } 

        // Bước 1: đếm xem có bao nhiêu quân thù có thể tiếp cận sát bên ô (row, col)
        const adjacentThreatCount = this._getAdjacentThreats(unit, row, col).length;
        // Bước 2: tính threat count là số lượng quân thù có thể đánh được ô (row, col)
        const attackableThreatCount = this._countThreats(unit, row, col);
        // Bước 3: ưu tiên đi gần với đồng đội, nhất là tanker
        const allies = this._getAllies(unit);            
        let allyDistanceBonus = 0;
        for (const ally of allies) {
            const distance = this.gameLogic._getManhattanDistance({ row, col }, ally);
            if (ally.type === 'Tanker' || ally.type === 'Taki' || ally.type === 'Trezdin') {
                allyDistanceBonus += 10 / distance;
            } else if (ally.type ==='Assassin' || ally.type === 'Trarex' || ally.type === 'Nizza' || ally.type === 'Wizzi') {
                allyDistanceBonus += 7 / distance;
            } else {
                allyDistanceBonus += 4 / distance;
            }                
        }
        score = score - adjacentThreatCount * 60 - attackableThreatCount * 40 + allyDistanceBonus;
        
        return score;
    }

    _getAdjacentThreats(unit, row, col) {
        const enemies = this._getEnemies(unit);
        let adjacentThreats = [];
        for (const enemy of enemies) {
            const gameLogicCopy = this._simulateMoveState(enemy, row, col);
            const enemyReachableCells = gameLogicCopy.getReachableCells(enemy);
            // nếu enemyReachableCells tồn tại 1 ô có khoảng cách Manhattan đến ô (row, col) nhỏ hơn hoặc bằng 1
            // thì thêm enemy vào adjacentThreats
            for (const cell of enemyReachableCells) {
                if (this.gameLogic._getManhattanDistance({ row, col }, cell) <= 1) {
                    adjacentThreats.push(enemy);
                    break;
                } 
            }
        }

        // tìm trong adjacentThreats có quân nào có speed cao hơn unit hiện tại và còn 1 hp không, 
        // nếu có thì loại bỏ quân ấy đi, và chỉ loại đúng 1 quân mà thôi 
        // vì ta giả định rằng quân ấy sẽ bị giết ngay lập tức        
        // và một giả định nữa là sẽ tồn tại một vị trí mà các threat khác không thể đến được vì speed chậm hơn hoặc bằng unit hiện tại
        // điều này giúp cho quân đội sẽ ra quyết định hiếu chiến hơn thay vì bỏ chạy
        for (const threat of adjacentThreats) {
            if (threat.speed > unit.speed && threat.hp === 1) {
                adjacentThreats.splice(adjacentThreats.indexOf(threat), 1);
                break;
            }
        }

        return adjacentThreats;
    }
} 