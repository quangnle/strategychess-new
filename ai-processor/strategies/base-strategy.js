import { ADJACENT_PENALTY } from "../../core-logic/definitions.js";

export class BaseStrategy {
    constructor(gameLogic) {
        this.gameLogic = gameLogic;
    }

    _getAllies(unit) {
        // lấy tất cả units của team đồng minh
        const allies = this.gameLogic._getAllUnits().filter(u => u.teamId === unit.teamId && u.hp > 0 && u.id !== unit.id);
        return allies;
    }

    _getEnemies(unit) {
        // lấy tất cả units của team đối thủ
        const enemies = this.gameLogic._getAllUnits().filter(u => u.teamId !== unit.teamId && u.hp > 0);
        return enemies;
    }

    // Common utility methods used by multiple strategies
    _getAttackableTargets(unit, row, col) {
        const enemies = this._getEnemies(unit);
        const attackableTargets = enemies.filter(enemy => 
            this.gameLogic._getManhattanDistance({ row, col }, enemy) <= unit.range
        );
        return attackableTargets;
    }

    _getAdjacentEnemies(unit, row, col) {
        const enemies = this._getEnemies(unit);
        const adjacentEnemies = enemies.filter(enemy => 
            this.gameLogic._getManhattanDistance({ row, col }, enemy) <= 1
        );
        return adjacentEnemies;
    }

    _countThreats(unit, row, col) {        
        const enemies = this._getEnemies(unit);
        let threatCount = 0;
        for (const enemy of enemies) {
            // chỉ kiểm tra những enemy đang không bị effect của ADJACENT_PENALTY
            if (enemy.effects.includes(ADJACENT_PENALTY)) {
                continue;
            }
            
            const enemyReachableCells = this.gameLogic.getReachableCells(enemy);
            for (const cell of enemyReachableCells) {
                if (this.gameLogic._getManhattanDistance({ row, col }, cell) <= enemy.range) {
                    threatCount++;
                    break;
                }
            }
        }
        return threatCount;
    }

    _calculateAttackScore(unit, attackableTargets) {
        let maxScore = 0;
        for (const target of attackableTargets) {
            const score = this.attackBonusTable[target.armyType];
            let finalScore = score;
            // Bonus for low HP targets
            if (target.hp === 1) {
                finalScore += 10;
            }
            maxScore = Math.max(maxScore, finalScore);
        }
        return maxScore;
    }

    _countAdjacents(unit, row, col) {
        const enemies = this._getEnemies(unit);
        let adjacentCount = 0;
        for (const enemy of enemies) {
            if (this.gameLogic._getManhattanDistance({ row, col }, enemy) === 1 && enemy.abilities.includes(ADJACENT_PENALTY)) {
                adjacentCount++;
            }
        }
        return adjacentCount;
    }

    // Base evaluatePosition method that can be overridden
    evaluatePosition(unit, row, col) {
        // Default implementation - subclasses should override this
        return 0;
    }
} 