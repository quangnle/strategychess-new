// Web Worker chạy bộ tìm kiếm.
//
// Bắt buộc phải tách luồng: engine nghĩ 5-10 giây, chạy trên luồng chính thì p5
// đứng hình và người chơi tưởng game treo. Ở worker thì bàn cờ vẫn vẽ mượt và ta
// hiện được tiến độ "đang nghĩ ở độ sâu mấy".
//
// Nạp bằng: new Worker('/ai-processor/ai-worker.js', { type: 'module' })

import { SearchState } from './search/search-state.js';
import { Minimax } from './search/minimax.js';
import { moveToPlan } from './search/index.js';
import { describeMove } from './search/search-state.js';
import { MATE } from './search/minimax.js';

let engine = null;

self.onmessage = (event) => {
    const msg = event.data || {};

    if (msg.type === 'reset') {
        if (engine) engine.clear();
        self.postMessage({ type: 'ready', requestId: msg.requestId });
        return;
    }

    if (msg.type !== 'search') return;

    try {
        if (!engine) engine = new Minimax({ ttBits: msg.ttBits ?? 19 });

        const state = new SearchState(msg.snapshot);
        const result = engine.search(state, {
            timeMs: msg.timeMs ?? 3000,
            maxDepth: msg.maxDepth ?? 32
        });

        self.postMessage({
            type: 'result',
            requestId: msg.requestId,
            plan: moveToPlan(state, result.move),
            depth: result.depth,
            nodes: result.nodes,
            elapsed: result.elapsed,
            nps: result.elapsed > 0 ? Math.round(result.nodes / (result.elapsed / 1000)) : 0,
            score: state.currentTeam === 0 ? result.score : -result.score,
            isWinning: Math.abs(result.score) > MATE / 2,
            text: result.move != null && result.move >= 0 ? describeMove(state, result.move) : '(không có nước đi)',
            pv: result.pv.map(m => describeMove(state, m))
        });
    } catch (err) {
        self.postMessage({
            type: 'error',
            requestId: msg.requestId,
            message: err && err.message ? err.message : String(err),
            stack: err && err.stack ? err.stack : null
        });
    }
};
