// Adapter cho các AI khác nhau về cùng một giao diện để harness so sánh được.
//
// Một agent chỉ cần trả về "kế hoạch lượt đi" thuần dữ liệu:
//   { unitId, dest: {row, col} | null, action: { type, targetId } | null }
// Harness sẽ tự thực thi qua GameLogic và tự gọi newTurn(), nên mọi agent
// đều đi qua đúng một đường luật giống nhau.

import Processor from '../ai-processor/processor.js';
import { SACRIFICE, HEAL, SUICIDE, LOCK } from '../core-logic/definitions.js';

export const ACTION = {
    NONE: 'none',
    ATTACK: 'attack',
    HEAL: 'heal',
    SACRIFICE: 'sacrifice',
    SUICIDE: 'suicide'
};

export function getPlayableUnits(gameLogic, teamId) {
    const team = teamId === gameLogic.matchInfo.team1.teamId
        ? gameLogic.matchInfo.team1
        : gameLogic.matchInfo.team2;
    return team.units.filter(u => u.hp > 0 && u.name !== 'Base' && !gameLogic.hasEndedTurn(u));
}

// AI cũ dựa trên Processor + các strategy theo từng loại quân.
// Processor không có logic chọn quân nào đi trước, nên ở đây mở rộng theo cách
// tự nhiên nhất: chấm điểm ô tốt nhất của từng quân rồi chọn quân có điểm cao nhất.
export class LegacyAgent {
    constructor(gameLogic, options = {}) {
        this.name = options.name || 'legacy';
        this.gameLogic = gameLogic;
        this.processor = new Processor(gameLogic);
    }

    chooseTurn(gameLogic, teamId) {
        const units = getPlayableUnits(gameLogic, teamId);
        if (units.length === 0) return null;

        let best = null;

        for (const unit of units) {
            const isLocked = !!unit.effects.find(e => e.name === LOCK);
            const cells = isLocked
                ? [{ row: unit.row, col: unit.col }]
                : [...gameLogic.getReachableCells(unit), { row: unit.row, col: unit.col }];

            for (const cell of cells) {
                const score = this.processor.evaluatePosition(unit, cell.row, cell.col);
                if (!best || score > best.score) {
                    best = { score, unit, row: cell.row, col: cell.col };
                }
            }
        }

        if (!best) return null;

        const moved = best.row !== best.unit.row || best.col !== best.unit.col;
        const target = this.processor.chooseBestTarget(best.unit, best.row, best.col);

        let action = null;
        if (target) {
            if (target.teamId === best.unit.teamId) {
                if (best.unit.abilities.includes(SACRIFICE) && best.unit.hp > 1) {
                    action = { type: ACTION.SACRIFICE, targetId: target.id };
                } else if (best.unit.abilities.includes(HEAL)) {
                    action = { type: ACTION.HEAL, targetId: target.id };
                }
            } else {
                action = { type: ACTION.ATTACK, targetId: target.id };
            }
        }

        return {
            unitId: best.unit.id,
            dest: moved ? { row: best.row, col: best.col } : null,
            action
        };
    }
}

// Agent ngẫu nhiên, dùng làm mốc dưới và để sinh thế cờ đa dạng cho test.
export class RandomAgent {
    constructor(gameLogic, options = {}) {
        this.name = options.name || 'random';
        this.rng = options.rng || Math.random;
    }

    chooseTurn(gameLogic, teamId) {
        const units = getPlayableUnits(gameLogic, teamId);
        if (units.length === 0) return null;

        const unit = units[Math.floor(this.rng() * units.length)];
        const isLocked = !!unit.effects.find(e => e.name === LOCK);

        let dest = null;
        if (!isLocked) {
            const cells = gameLogic.getReachableCells(unit);
            if (cells.length > 0 && this.rng() < 0.85) {
                const c = cells[Math.floor(this.rng() * cells.length)];
                dest = { row: c.row, col: c.col };
            }
        }

        // Đánh giá hành động tại vị trí giả định sau khi di chuyển.
        const at = dest || { row: unit.row, col: unit.col };
        const enemies = gameLogic._getAllUnits().filter(u =>
            u.teamId !== unit.teamId && u.hp > 0 &&
            gameLogic._getManhattanDistance(at, u) <= unit.range
        );

        let action = null;
        const penalized = unit.effects.some(e => e.name === 'adjacent penalty');
        if (enemies.length > 0 && !penalized) {
            action = { type: ACTION.ATTACK, targetId: enemies[Math.floor(this.rng() * enemies.length)].id };
        } else if (unit.abilities.includes(SUICIDE) && unit.hp === 1 && this.rng() < 0.3) {
            action = { type: ACTION.SUICIDE, targetId: null };
        }

        return { unitId: unit.id, dest, action };
    }
}
