import { UNIT_TYPES } from "../../core-logic/definitions.js";
import { BaseStrategy } from "./base-strategy.js";

export class TankerStrategy extends BaseStrategy {
    alphaTable = {
        'Tanker': 16,
        'Assassin': 40,
        'Ranger': 50,
        'Base': 15,
        'Trezdin': 20,
        'Taki': 15,
        'Trarex': 60,
        'Ara': 60,
        'Nizza': 50,
        'Wizzi': 60
    };

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
        // tư tưởng chính là chúng ta sẽ đánh giá xem tại ô đang đứng có thể có một vài trường hợp xảy ra:
        // TH1: nếu có khả năng tấn công được quân thù
        // TH2: nếu có khả năng sacrifice 
        // TH3: nếu xảy ra đồng thời cả 2 trường hợp trên, chúng ta phải chọn lựa nên làm gì
        // TH4: nếu không có khả năng tấn công được quân thù và không có khả năng sacrifice

        // tìm tất cả các quân thù có thể tấn công được
        const attackableTargets = this._getAttackableTargets(unit, row, col);
        // tìm tất cả các allies đứng cạnh ô đang đứng, nghĩa là trong tầm sacrifice
        const sacrificeableAllies = this._getSacrificeableAllies(unit, row, col);

        // TH 3: nếu tân công được và đồng thời cũng có thể sacrifice
        if (attackableTargets.length > 0 && sacrificeableAllies.length > 0) {
            // chúng ta sẽ tính toán xem nếu sacrifice thì sẽ có lợi hơn hay không
            const sacrificeScore = this._calculateSacrificeScore(sacrificeableAllies);
            const attackScore = this._calculateAttackScore(unit, attackableTargets);
            score = sacrificeScore > attackScore ? sacrificeScore : attackScore;
        }

        // TH 1: nếu có khả năng tấn công được quân thù
        if (attackableTargets.length > 0) {
            score = this._calculateAttackScore(unit, attackableTargets);
        }

        // TH 2: nếu có khả năng sacrifice
        if (sacrificeableAllies.length > 0) {
            score = this._calculateSacrificeScore(sacrificeableAllies);
        }

        // TH 4: nếu không có khả năng tấn công được quân thù và không có khả năng sacrifice
        // chúng ta sẽ đánh giá dựa trên tiêu chí: 
        // + gần với quân đang mất máu để sacrifice 
        // + gần với quân thù

        // tìm tất cả quân đội đồng minh đang mất máu
        const allies = this._getAllies(unit).filter(ally => ally.id !== unit.id) ;
        // tính bonus 
        for (const ally of allies) {
            // không ưu tiên tanker
            if (ally.armyType === 'Tanker') continue;

            const maxHp = UNIT_TYPES[ally.armyType].hp;
            
            // chỉ quan tâm đến quân đội bị mất máu
            let multiply = 0;
            if (ally.hp < maxHp) {
                multiply = 10 * maxHp / ally.hp;
            }
            // let multiply = 10 * maxHp / ally.hp;
            // ưu tiên những quân có range xa
            if (ally.range > 1) {
                multiply *= 2;
            }

            const d = this.gameLogic._getManhattanDistance({ row, col }, ally);
            score += 1 / d * multiply;
        }

        // tính bonus dựa trên khoảng cách đến quân thù
        // tổng khoảng cách đến quân thù càng nhỏ thì bonus càng lớn
        let distanceBonus = 0;
        const enemies = this._getEnemies(unit).filter(enemy => enemy.hp > 0 && enemy.armyType !== 'Base');
        for (const enemy of enemies) {
            const d = this.gameLogic._getManhattanDistance({ row, col }, enemy);
            distanceBonus  += 1 / d * this.alphaTable[enemy.armyType];
        }
        console.log(`distanceBonus: ${distanceBonus} of (${row}, ${col})`);
        score += distanceBonus;

        // tính bonus dựa trên số lượng quân thù có Adjacent Penalty
        const adjacentCount = this._countAdjacents(unit, row, col);
        score += adjacentCount * 10;
       
        // tiếp tục tính threat Count bằng cách duyệt qua toàn bộ quân thù
        // threat Count là số lượng quân thù có thể tấn công được ô đang đứng
        const threatCount = this._countThreats(unit, row, col);
        score -= threatCount * 10;

        return score;
    }

    chooseBestTarget(unit, row, col) {
        // tìm các allies có thể sacrifice
        const sacrificeableAllies = this._getSacrificeableAllies(unit, row, col);
        let sacrificeScore = this._calculateSacrificeScore(sacrificeableAllies);

        // tìm các quân thù có thể tấn công được
        const attackableTargets = this._getAttackableTargets(unit, row, col);
        let attackScore = this._calculateAttackScore(unit, attackableTargets);

        if (sacrificeScore > attackScore) {
            // tìm quân đội có score sacrifice cao nhất
            let bestTarget = null;
            let bestScore = 0;
            for (const ally of sacrificeableAllies) {
                let score = 0;
                if (ally.armyType === 'Ranger' || ally.armyType === 'Ara' || ally.armyType === 'Wizzi' || ally.armyType === 'Trarex') {
                    score += 40;
                } else if (ally.armyType === 'Assassin' || ally.armyType === 'Taki' || ally.armyType === 'Nizza' || ally.armyType === 'Trezdin') {
                    score += 25;
                } else {
                    score += 5;
                }

                // cộng thêm bonus dựa trên lượng máu còn lại, càng ít thì càng ưu tiên
                const maxHp = UNIT_TYPES[ally.armyType].hp;
                const hpRatio = ally.hp / maxHp;
                score += (1 - hpRatio) * 10;

                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = ally;
                }
            }

            return bestTarget;
        } else {
            return super.chooseBestTarget(unit, row, col);
        }
    }

    _calculateSacrificeScore(sacrificeableAllies) {
        let maxScore = 0;
        for (const ally of sacrificeableAllies) {
            if (ally.armyType === 'Ranger' || ally.armyType === 'Ara' || ally.armyType === 'Wizzi' || ally.armyType === 'Trarex') {
                maxScore = Math.max(maxScore, 65);
            } else if (ally.armyType === 'Assassin' || ally.armyType === 'Taki' || ally.armyType === 'Nizza' || ally.armyType === 'Trezdin') {
                maxScore = Math.max(maxScore, 40);
            } else {
                maxScore = Math.max(maxScore, 15);
            }
        }

        return maxScore;
    }

    _getSacrificeableAllies(unit, row, col) {
        const result = [];
        const allies = this._getAllies(unit);
        // tìm tất cả đồng đội mà có khoảng cách Manhattan đến ô (row, col) nhỏ hơn hoặc bằng range của unit
        // chỉ xét đồng đội không phải là tanker, vì sacrifice cho tanker khác không có lợi
        const sacrificeableAllies = allies.filter(ally => this.gameLogic._getManhattanDistance({ row, col }, ally) === 1 && ally.armyType !== 'Tanker');
        // chỉ xét đồng đội có hp < maxHp        
        for (const ally of sacrificeableAllies) {
            let maxHp = UNIT_TYPES[ally.armyType].hp;
            if (ally.hp < maxHp) {
                result.push(ally);
            }
        }
        return result;
    }
} 