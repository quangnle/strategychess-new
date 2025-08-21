import { ADJACENT_PENALTY } from "../../core-logic/definitions.js";
import GameLogic from "../../core-logic/game-logic.js";

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

            // kiếm tra nếu enemy đó bị dính adjacent penalty nếu unit đó đứng ở vị trí row, col
            if (enemy.abilities.includes(ADJACENT_PENALTY)) {
                if (this.gameLogic._getManhattanDistance({ row, col }, enemy) === 1) {
                    continue; 
                }
            }
            
            const gameLogicCopy = this._simulateMoveState(unit, row, col);
            const enemyReachableCells = gameLogicCopy.getReachableCells(enemy);
            for (const cell of enemyReachableCells) {
                if (gameLogicCopy._getManhattanDistance({ row, col }, cell) <= enemy.range) {
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

    chooseBestTarget(unit, row, col) {
        const attackableTargets = this._getAttackableTargets(unit, row, col);
        if (attackableTargets.length === 0) {
            return null;
        }

        let bestTarget = null;  // target có score cao nhất
        let bestScore = 0;
        for (const target of attackableTargets) {
            let score = this.attackBonusTable[target.armyType];

            // ưu tiên tấn công quân có hp = 1 để diệt bớt attack turn của địch
            if (target.hp === 1) {
                score += 10;
            }

            // ưu tiên tấn công quân có speed cao hơn unit hiện tại nếu unit hiện tại bị effect của ADJACENT_PENALTY
            if (unit.abilities.includes(ADJACENT_PENALTY) && target.speed > unit.speed) {
                score += 5;
            }

            // chọn target có score cao nhất
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }

        return bestTarget;
    }

    _simulateMoveState(unit, row, col) {
        // tạo ra một bản sao của trạng thái bàn cờ hiện tại của game 
        // bằng cách tạo ra một bản sao của gameLogic
        // và sửa đổi vị trí của unit hiện tại thành row, col
        // sau đó trả về trạng thái bàn cờ mới
        const matchInfoCopy = this.gameLogic.matchInfo.clone();
        const gameLogicCopy = new GameLogic(matchInfoCopy);
        const unitCopy = gameLogicCopy._getAllUnits().filter(u => u.id === unit.id)[0];
        unitCopy.row = row;
        unitCopy.col = col;
        return gameLogicCopy;
    }
} 