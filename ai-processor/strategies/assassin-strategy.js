import { BaseStrategy } from "./base-strategy.js";

export class AssassinStrategy extends BaseStrategy {
    alphaTable = {
        'Tanker': 8,
        'Assassin': 15,
        'Ranger': 21,
        'Base': 5,
        'Trezdin': 10,
        'Taki': 7,
        'Trarex': 24,
        'Ara': 27,
        'Nizza': 15,
        'Wizzi': 24
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
        // kiểm tra nếu có enemy có thể đánh được hay không
        const attackableTargets = this._getAttackableTargets(unit, row, col);

        if (attackableTargets.length > 0) {
            const attackScore = this._calculateAttackScore(unit, attackableTargets);
            score += attackScore;
        } 

        // đếm xem có bao nhiêu quân ranger bị tiếp cận ở ô hiện tại
        const adjacentCount = this._countAdjacents(unit, row, col);
        score += adjacentCount * 10;

        // kiểm tra ô hiện tại có thể bị tấn công từ bao nhiêu enemy
        const threatCount = this._countThreats(unit, row, col);
        score -= threatCount * 30;

        // tính bonus dựa trên khoảng cách đến quân thù
        // tổng khoảng cách đến quân thù càng nhỏ thì bonus càng lớn
        const enemies = this._getEnemies(unit);
        for (const enemy of enemies) {
            const d = this.gameLogic._getManhattanDistance({ row, col }, enemy);
            score += 1 / d * this.alphaTable[enemy.armyType];
        }

        return score;
    }
} 