import { UNIT_TYPES } from "../../core-logic/definitions.js";
import { BaseStrategy } from "./base-strategy.js";

export class TankerStrategy extends BaseStrategy {
    alphaTable = {
        'Tanker': 16,
        'Assassin': 30,
        'Ranger': 40,
        'Base': 10,
        'Trezdin': 20,
        'Taki': 15,
        'Trarex': 50,
        'Ara': 50,
        'Nizza': 40,
        'Wizzi': 40
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
            return sacrificeScore > attackScore ? sacrificeScore : attackScore;
        }

        // TH 1: nếu có khả năng tấn công được quân thù
        if (attackableTargets.length > 0) {
            return this._calculateAttackScore(unit, attackableTargets);
        }

        // TH 2: nếu có khả năng sacrifice
        if (sacrificeableAllies.length > 0) {
            return this._calculateSacrificeScore(sacrificeableAllies);
        }

        // TH 4: nếu không có khả năng tấn công được quân thù và không có khả năng sacrifice
        // chúng ta sẽ đánh giá dựa trên tiêu chí: 
        // + gần với quân đang mất máu để sacrifice 
        // + gần với quân thù

        // tìm tất cả quân đội đồng minh đang mất máu
        const allies = this._getAllies(unit);
        // chỉ cần tìm những quân đội nào trong tầm 1 bước đi kế tiếp có thể đến được và nó đang mất máu và nó không phải là tanker
        const alliesInRange = allies.filter(ally => this.gameLogic._getManhattanDistance({ row, col }, ally) <= unit.speed && ally.hp < ally.maxHp && ally.type !== 'Tanker');
        // tính bonus 
        for (const ally of alliesInRange) {
            const d = this.gameLogic._getManhattanDistance({ row, col }, ally);
            // ưu tiên những quân có range xa
            let multiply = 10;
            if (ally.range > 1) {
                multiply = 20;
            }
            score += 1 / d * multiply;
        }

        // tính bonus dựa trên khoảng cách đến quân thù
        // tổng khoảng cách đến quân thù càng nhỏ thì bonus càng lớn
        const enemies = this._getEnemies(unit);
        for (const enemy of enemies) {
            const d = this.gameLogic._getManhattanDistance({ row, col }, enemy);
            score += 1 / d * this.alphaTable[enemy.armyType];
        }

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
                if (ally.type === 'Ranger' || ally.type === 'Ara' || ally.type === 'Wizzi' || ally.type === 'Trarex') {
                    score += 40;
                } else if (ally.type === 'Assassin' || ally.type === 'Taki' || ally.type === 'Nizza' || ally.type === 'Trezdin') {
                    score += 25;
                } else {
                    score += 5;
                }

                // cộng thêm bonus dựa trên lượng máu còn lại, càng ít thì càng ưu tiên
                const maxHp = UNIT_TYPES[ally.armyType].maxHp;
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
            if (ally.type === 'Ranger' || ally.type === 'Ara' || ally.type === 'Wizzi' || ally.type === 'Trarex') {
                maxScore = Math.max(maxScore, 40);
            } else if (ally.type === 'Assassin' || ally.type === 'Taki' || ally.type === 'Nizza' || ally.type === 'Trezdin') {
                maxScore = Math.max(maxScore, 25);
            } else {
                maxScore = Math.max(maxScore, 5);
            }
        }

        return maxScore;
    }

    _getSacrificeableAllies(unit, row, col) {
        const allies = this._getAllies(unit);
        // tìm tất cả đồng đội mà có khoảng cách Manhattan đến ô (row, col) nhỏ hơn hoặc bằng range của unit
        let sacrificeableAllies = allies.filter(ally => this.gameLogic._getManhattanDistance({ row, col }, ally) === 1);
        // chỉ xét đồng đội không phải là tanker, vì sacrifice cho tanker khác không có lợi
        sacrificeableAllies = sacrificeableAllies.filter(ally => ally.type !== 'Tanker');
        // chỉ xét đồng đội có hp < maxHp
        sacrificeableAllies = sacrificeableAllies.filter(ally => ally.hp < ally.maxHp);
        return sacrificeableAllies;
    }
} 