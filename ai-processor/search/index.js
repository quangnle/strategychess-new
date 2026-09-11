// Điểm vào của engine. Cầu nối giữa GameLogic (luật chính thức) và bộ tìm kiếm.

import { BOARD_COLS } from '../../core-logic/definitions.js';
import {
    SearchState, NO_DEST,
    ACT_ATTACK, ACT_HEAL, ACT_SACRIFICE, ACT_SUICIDE, ACT_PASS,
    moveUnit, moveDest, moveAction, moveTarget, describeMove
} from './search-state.js';
import { Minimax, MATE } from './minimax.js';
import { WEIGHTS } from './weights.js';

export { SearchState, Minimax, WEIGHTS, describeMove, MATE };

// Chuyển nước đi đã đóng gói thành kế hoạch thuần dữ liệu mà driver hiểu được.
export function moveToPlan(state, move) {
    if (move == null || move < 0) return null;

    const i = moveUnit(move);
    const dest = moveDest(move);
    const action = moveAction(move);
    const target = moveTarget(move);

    const plan = { unitId: state.unitIds[i], dest: null, action: null };

    if (dest !== NO_DEST) {
        const row = (dest / BOARD_COLS) | 0;
        plan.dest = { row, col: dest - row * BOARD_COLS };
    }

    switch (action) {
        case ACT_ATTACK: plan.action = { type: 'attack', targetId: state.unitIds[target] }; break;
        case ACT_HEAL: plan.action = { type: 'heal', targetId: state.unitIds[target] }; break;
        case ACT_SACRIFICE: plan.action = { type: 'sacrifice', targetId: state.unitIds[target] }; break;
        case ACT_SUICIDE: plan.action = { type: 'suicide', targetId: null }; break;
        case ACT_PASS: plan.action = null; break;
        default: break;
    }

    return plan;
}

// API một phát: cho GameLogic đang ở lượt của một phe, trả về kế hoạch tốt nhất.
export function findBestTurn(gameLogic, options = {}) {
    const engine = options.engine || sharedEngine();
    const state = new SearchState(gameLogic);
    const result = engine.search(state, {
        timeMs: options.timeMs ?? 5000,
        maxDepth: options.maxDepth ?? 32
    });

    return {
        plan: moveToPlan(state, result.move),
        score: result.score,
        depth: result.depth,
        nodes: result.nodes,
        elapsed: result.elapsed,
        nps: result.elapsed > 0 ? Math.round(result.nodes / (result.elapsed / 1000)) : 0,
        pv: result.pv.map(m => describeMove(state, m)),
        text: result.move != null && result.move >= 0 ? describeMove(state, result.move) : '(không có nước đi)',
        // điểm quy về phía phe đang đi, để hiển thị cho dễ hiểu
        scoreForMover: state.currentTeam === 0 ? result.score : -result.score,
        isWinning: Math.abs(result.score) > MATE / 2
    };
}

let _shared = null;
function sharedEngine() {
    if (!_shared) _shared = new Minimax({ ttBits: 20 });
    return _shared;
}

// Adapter cho tools/selfplay.js và cho driver trên trình duyệt.
export class SearchAgent {
    constructor(gameLogic, options = {}) {
        this.name = options.name || 'search';
        this.timeMs = options.timeMs ?? 3000;
        this.maxDepth = options.maxDepth ?? 32;
        this.engine = new Minimax({ ttBits: options.ttBits ?? 20, weights: options.weights });
        this.lastInfo = null;
    }

    chooseTurn(gameLogic) {
        const info = findBestTurn(gameLogic, {
            engine: this.engine,
            timeMs: this.timeMs,
            maxDepth: this.maxDepth
        });
        this.lastInfo = info;
        return info.plan;
    }
}
