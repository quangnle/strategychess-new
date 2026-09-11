import { ADJACENT_PENALTY } from "../../core-logic/definitions.js";
import GameLogic from "../../core-logic/game-logic.js";

export class BaseStrategy {
    // Mặc định cho các strategy chưa override (Trarex / Taki / Nizza / Wizzi).
    // Thiếu bảng này thì chooseBestTarget luôn trả null và các hero đó không bao giờ tấn công.
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
        const allies = this._getAllies(unit).filter(ally => ally.hp > 0 && ally.id !== unit.id);
        let threatCount = 0;

        // giả lập unit đi đến vị trí row, col
        const gameLogicCopy = this._simulateMoveState(unit, row, col, this.gameLogic);
        for (const enemy of enemies) {
            // enemy đã đi xong lượt trong round này thì không thể phản đòn nữa
            if (this.gameLogic.hasEndedTurn(enemy)) {
                continue;
            }

            // chỉ kiểm tra những enemy đang không bị effect của ADJACENT_PENALTY
            if (enemy.effects.some(e => e.name === ADJACENT_PENALTY)) {
                continue;
            }

            // kiếm tra nếu enemy đó bị dính adjacent penalty nếu unit đó đứng ở vị trí row, col
            if (enemy.abilities.includes(ADJACENT_PENALTY)) {
                if (this.gameLogic._getManhattanDistance({ row, col }, enemy) === 1) {
                    continue; 
                }
            }            
            
            const enemyReachableCells = gameLogicCopy.getReachableCells(enemy);
            let threatScore = 0;
            for (const cell of enemyReachableCells) {
                // nếu enemy có thể đánh tới vị trí row, col
                if (gameLogicCopy._getManhattanDistance({ row, col }, cell) <= enemy.range) {
                    // giả lập enemy đi đến cell này
                    const gameLogicCopy2 = this._simulateMoveState(enemy, cell.row, cell.col, gameLogicCopy);
                    // kiếm tra xem có ally nào có thể đánh tới cell này không
                    let allyCanAttack = false;
                    for (const ally of allies) {
                        const allyReachableCells = gameLogicCopy2.getReachableCells(ally);
                        for (const allyCell of allyReachableCells) {
                            if (gameLogicCopy2._getManhattanDistance({ row: cell.row, col: cell.col }, allyCell) <= ally.range) {
                                allyCanAttack = true;
                                break;
                            }
                        }
                        if (allyCanAttack) break;
                    }
                    if (allyCanAttack) {
                        threatScore = 0.3;
                    } else {
                        threatScore = 1;
                    }
                    break;
                }
            } 
            threatCount += threatScore;
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

    // Đánh giá mặc định cho các strategy chưa override.
    // Trước đây trả về 0 nên Trarex / Taki / Nizza / Wizzi đứng yên tại chỗ.
    evaluatePosition(unit, row, col) {
        let score = 0;

        const attackableTargets = this._getAttackableTargets(unit, row, col);
        if (attackableTargets.length > 0) {
            score += this._calculateAttackScore(unit, attackableTargets);
        }

        score += this._countAdjacents(unit, row, col) * 10;
        score -= this._countThreats(unit, row, col) * 20;

        for (const enemy of this._getEnemies(unit)) {
            const d = this.gameLogic._getManhattanDistance({ row, col }, enemy);
            if (d > 0) score += (1 / d) * (this.alphaTable[enemy.armyType] ?? 10);
        }

        return score;
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

    _simulateMoveState(unit, row, col, gameLogic) {
        // tạo ra một bản sao của trạng thái bàn cờ hiện tại của game 
        // bằng cách tạo ra một bản sao của gameLogic
        // và sửa đổi vị trí của unit hiện tại thành row, col
        // sau đó trả về trạng thái bàn cờ mới
        const matchInfoCopy = gameLogic.matchInfo.clone();
        const gameLogicCopy = new GameLogic(matchInfoCopy);
        const unitCopy = gameLogicCopy._getAllUnits().filter(u => u.id === unit.id)[0];
        unitCopy.row = row;
        unitCopy.col = col;
        return gameLogicCopy;
    }
} 