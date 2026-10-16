// Điều phối AI phía trình duyệt: quản lý worker, quyết định khi nào tới lượt AI,
// và thực thi kế hoạch mà engine trả về lên GameLogic thật.
//
// Có dự phòng chạy đồng bộ trên luồng chính nếu trình duyệt không tạo được module
// worker (mở trực tiếp bằng file:// chẳng hạn). Khi đó giao diện sẽ khựng trong lúc
// nghĩ, nên thời gian nghĩ được giảm xuống.

import { snapshotFromGameLogic } from '/ai-processor/search/search-state.js';
import { hasFollowUpActions } from '/core-logic/replay-actions.js';
import { t } from './i18n.js';

export const AI_MODE = {
    OFF: 'off',
    BLUE: 'blue',
    RED: 'red',
    BOTH: 'both'
};

export const THINK_LEVELS = [
    { label: 'Nhanh (1s)', ms: 1000 },
    { label: 'Vừa (3s)', ms: 3000 },
    { label: 'Mạnh (6s)', ms: 6000 },
    { label: 'Rất mạnh (10s)', ms: 10000 }
];

export class AIDriver {
    constructor(gameLogic, options = {}) {
        this.gameLogic = gameLogic;
        this.mode = options.mode || AI_MODE.OFF;
        this.timeMs = options.timeMs ?? 3000;
        this.autoPlay = options.autoPlay ?? true;
        this.moveDelayMs = options.moveDelayMs ?? 250;

        this.thinking = false;
        this.lastInfo = null;
        this.status = 'sẵn sàng';
        this.onUpdate = options.onUpdate || (() => { });
        this.onMoveApplied = options.onMoveApplied || (() => { });
        this.onLoggedActions = options.onLoggedActions || (() => { });

        this._requestId = 0;
        this._pending = null;
        this._nextAllowedAt = 0;
        this._worker = null;
        this._fallback = null;

        this._initWorker();
    }

    _initWorker() {
        try {
            this._worker = new Worker('/ai-processor/ai-worker.js', { type: 'module' });
            this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
            this._worker.onerror = (e) => {
                console.warn('AI worker lỗi, chuyển sang chạy trên luồng chính:', e.message);
                this._worker = null;
                this.thinking = false;
            };
        } catch (err) {
            console.warn('Không tạo được AI worker, sẽ chạy trên luồng chính:', err);
            this._worker = null;
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.status = mode === AI_MODE.OFF ? 'đã tắt' : 'sẵn sàng';
        this.onUpdate(this);
    }

    setTimeMs(ms) { this.timeMs = ms; }
    setAutoPlay(on) { this.autoPlay = on; this.onUpdate(this); }

    // AI có điều khiển phe đang tới lượt không.
    controlsCurrentTurn() {
        const teamId = this.gameLogic.currentTurnTeamId;
        if (!teamId || this.mode === AI_MODE.OFF) return false;
        if (this.mode === AI_MODE.BOTH) return true;
        const blueId = this.gameLogic.matchInfo.team1.teamId;
        return this.mode === AI_MODE.BLUE ? teamId === blueId : teamId !== blueId;
    }

    // Gọi mỗi khung hình từ vòng lặp vẽ.
    tick() {
        if (!this.autoPlay || this.thinking) return;
        if (this.gameLogic.isGameEnd() !== 0) return;
        if (!this.controlsCurrentTurn()) return;
        if (performance.now() < this._nextAllowedAt) return;
        this.think();
    }

    // Bắt AI tính một nước ngay, kể cả khi auto-play đang tắt (dùng cho phím d).
    think() {
        if (this.thinking) return;
        if (this.gameLogic.isGameEnd() !== 0) return;

        const snapshot = snapshotFromGameLogic(this.gameLogic);
        if (!snapshot.currentTurnTeamId) return;

        this.thinking = true;
        this.status = 'đang nghĩ...';
        this._requestId++;
        this.onUpdate(this);

        if (this._worker) {
            this._pending = this._requestId;
            this._worker.postMessage({
                type: 'search',
                requestId: this._requestId,
                snapshot,
                timeMs: this.timeMs
            });
        } else {
            this._thinkOnMainThread(snapshot);
        }
    }

    async _thinkOnMainThread(snapshot) {
        try {
            if (!this._fallback) {
                const [{ SearchState }, { Minimax }, { moveToPlan }] = await Promise.all([
                    import('/ai-processor/search/search-state.js'),
                    import('/ai-processor/search/minimax.js'),
                    import('/ai-processor/search/index.js')
                ]);
                this._fallback = { SearchState, engine: new Minimax({ ttBits: 18 }), moveToPlan };
            }

            const { SearchState, engine, moveToPlan } = this._fallback;
            const state = new SearchState(snapshot);
            // không có worker thì mỗi giây nghĩ là một giây giao diện đứng hình
            const result = engine.search(state, { timeMs: Math.min(this.timeMs, 1500) });

            this._onWorkerMessage({
                type: 'result',
                requestId: this._requestId,
                plan: moveToPlan(state, result.move),
                depth: result.depth,
                nodes: result.nodes,
                elapsed: result.elapsed,
                nps: result.elapsed > 0 ? Math.round(result.nodes / (result.elapsed / 1000)) : 0,
                score: state.currentTeam === 0 ? result.score : -result.score,
                text: ''
            });
        } catch (err) {
            this.thinking = false;
            this.status = 'lỗi: ' + err.message;
            this.onUpdate(this);
        }
    }

    _onWorkerMessage(msg) {
        if (msg.type === 'error') {
            console.error('AI worker:', msg.message, msg.stack);
            this.thinking = false;
            this.status = 'lỗi: ' + msg.message;
            this.onUpdate(this);
            return;
        }
        if (msg.type !== 'result') return;
        if (msg.requestId !== this._requestId) return; // kết quả cũ, bỏ qua

        this.thinking = false;
        this.lastInfo = msg;
        this.status = 'sẵn sàng';
        this._nextAllowedAt = performance.now() + this.moveDelayMs;

        this.applyPlan(msg.plan);
        this.onUpdate(this);
    }

    // Thực thi kế hoạch lên GameLogic thật. Đây là nơi duy nhất engine chạm vào ván
    // đấu; mọi thứ trước đó chỉ là tính toán trên bản sao.
    applyPlan(plan) {
        const gl = this.gameLogic;
        if (!plan) {
            gl.passTurn();
            this.onLoggedActions([{ action: 'end_turn' }]);
            this.onMoveApplied([]);
            if (gl.isGameEnd() === 0) gl.newTurn();
            return;
        }

        const all = gl._getAllUnits();
        const unit = all.find(u => u.id === plan.unitId);
        if (!unit) {
            gl.passTurn();
            this.onLoggedActions([{ action: 'end_turn' }]);
            this.onMoveApplied([]);
            if (gl.isGameEnd() === 0) gl.newTurn();
            return;
        }

        gl.currentTurnUnit = unit;
        const trace = [];
        const logged = [];
        const from = { row: unit.row, col: unit.col };
        let moved = false;

        if (plan.dest) {
            if (gl.makeMove(unit, plan.dest.row, plan.dest.col)) {
                moved = true;
                trace.push({ type: 'move', from, to: { row: plan.dest.row, col: plan.dest.col } });
                logged.push({ action: 'move', unitId: unit.id, row: plan.dest.row, col: plan.dest.col });
            }
        }

        let acted = false;
        if (plan.action) {
            const target = plan.action.targetId ? all.find(u => u.id === plan.action.targetId) : null;
            const here = { row: unit.row, col: unit.col };
            const to = target ? { row: target.row, col: target.col } : here;
            let ok = false;
            switch (plan.action.type) {
                case 'attack': ok = target && gl.makeAttack(unit, target); break;
                case 'heal': ok = target && gl.makeHeal(unit, target); break;
                case 'sacrifice': ok = target && gl.makeSacrifice(unit, target); break;
                case 'suicide': ok = gl.makeSuicide(unit); break;
                default: break;
            }
            if (ok) {
                acted = true;
                trace.push({ type: plan.action.type, from: here, to });
                const entry = { action: plan.action.type, unitId: unit.id };
                if (plan.action.targetId && plan.action.type !== 'suicide') entry.targetId = plan.action.targetId;
                logged.push(entry);
            }
        }

        // A lone move ends the turn on the server only when nothing else is legal.
        // The AI always advances, so record an explicit end_turn when actions remain.
        if (moved && !acted && hasFollowUpActions(gl, unit)) {
            logged.push({ action: 'end_turn', unitId: unit.id });
        }
        if (!logged.length) logged.push({ action: 'end_turn', unitId: unit.id });
        this.onLoggedActions(logged);

        if (!gl.currentTurnUnit) gl.currentTurnUnit = unit;

        // Đứng yên / pass cũng phải có dấu trên bàn, nếu không người chơi tưởng AI skip.
        if (trace.length === 0) {
            trace.push({ type: 'stay', from, to: { row: unit.row, col: unit.col } });
        }

        this.onMoveApplied(trace);

        if (gl.isGameEnd() === 0) gl.newTurn();
    }

    // Dòng chữ hiển thị góc màn hình.
    statusLine() {
        if (this.mode === AI_MODE.OFF) return t('ai.off');
        const side = this.mode === AI_MODE.BOTH ? t('ai.sideBoth')
            : this.mode === AI_MODE.BLUE ? t('ai.sideBlue') : t('ai.sideRed');
        if (this.thinking) return t('ai.thinking', { side });
        const i = this.lastInfo;
        if (!i) return t('ai.idle', { side });
        return t('ai.stats', {
            side,
            depth: i.depth,
            score: i.score.toFixed(0),
            sec: (i.elapsed / 1000).toFixed(1),
            nodes: (i.nodes / 1000).toFixed(0)
        });
    }

    destroy() {
        if (this._worker) { this._worker.terminate(); this._worker = null; }
    }
}
