// Alpha-beta với node max/min tường minh.
//
// KHÔNG dùng negamax. Negamax giả định hai bên đi luân phiên nghiêm ngặt, còn ở
// game này lượt đi được quyết bởi movement point, nên MỘT PHE CÓ THỂ ĐI NHIỀU PLY
// LIÊN TIẾP. Lật dấu vô điều kiện sẽ cho ra điểm sai ngay khi điều đó xảy ra, mà
// nó xảy ra thường xuyên: đi quân chậm trước chính là cách giữ quyền đi tiếp.
//
// Quy ước: hàm lượng giá luôn nhìn từ phe 0. Phe 0 là bên MAX, phe 1 là bên MIN,
// bất kể ai đang tới lượt. Node là max hay min tra thẳng từ state.currentTeam.

import { SearchState, ONGOING, TEAM1_WIN, TEAM2_WIN, DRAW, ACT_NONE, moveUnit, moveDest, moveAction, NO_DEST } from './search-state.js';
import { Fields } from './fields.js';
import { MoveGen } from './move-gen.js';
import { Evaluator } from './evaluate.js';
import { WEIGHTS } from './weights.js';
import { hashState } from './zobrist.js';
import { N_CELLS } from './search-state.js';

const MATE = 1e6;
const MAX_PLY = 64;

const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

const TIME_CHECK_INTERVAL = 512;
const NO_MOVE = -1;

export class Minimax {
    constructor(options = {}) {
        const n = options.maxUnits || 16;
        this.weights = options.weights || WEIGHTS;
        this.fields = new Fields(n);
        this.moveGen = new MoveGen(n, options.maxBuckets);
        this.evaluator = new Evaluator(n, this.weights);

        // bảng chuyển vị
        this.useLmr = options.useLmr !== false;
        this.useTt = options.useTt !== false;

        const bits = options.ttBits || 20;
        this.ttSize = 1 << bits;
        this.ttMask = this.ttSize - 1;
        this.ttKey = new Int32Array(this.ttSize);
        this.ttMove = new Int32Array(this.ttSize);
        this.ttScore = new Float64Array(this.ttSize);
        this.ttDepth = new Int8Array(this.ttSize);
        this.ttFlag = new Uint8Array(this.ttSize);
        this.ttGen = new Uint8Array(this.ttSize);
        this.generation = 0;

        // heuristic sắp xếp nước đi
        this.killers = new Int32Array(MAX_PLY * 2);
        this.killers.fill(NO_MOVE);
        this.history = new Int32Array(n * (N_CELLS + 1));

        // bộ đệm nước đi theo từng ply, tránh cấp phát trong search
        this.moveBuf = [];
        this.scoreBuf = [];
        this.orderBuf = [];
        for (let p = 0; p < MAX_PLY; p++) {
            this.moveBuf.push([]);
            this.scoreBuf.push([]);
            this.orderBuf.push([]);
        }

        this._hash = new Int32Array(2);
        this.nodes = 0;
        this.stopped = false;
        this.deadline = 0;
    }

    setWeights(w) {
        this.weights = w;
        this.evaluator.setWeights(w);
    }

    clear() {
        this.ttKey.fill(0);
        this.ttDepth.fill(0);
        this.history.fill(0);
        this.killers.fill(NO_MOVE);
        this.generation = 0;
    }

    // Tìm nước đi tốt nhất cho phe đang tới lượt trong state.
    // Trả về { move, score, depth, nodes, elapsed, pv }.
    search(state, options = {}) {
        const timeMs = options.timeMs ?? 5000;
        const maxDepth = options.maxDepth ?? 32;

        this.nodes = 0;
        this.stopped = false;
        this.deadline = performance.now() + timeMs;
        this.generation = (this.generation + 1) & 0xff;
        this.killers.fill(NO_MOVE);
        for (let i = 0; i < this.history.length; i++) this.history[i] = (this.history[i] / 8) | 0;

        const start = performance.now();
        const rootTeam = state.currentTeam;
        const maximizing = rootTeam === 0;

        let bestMove = NO_MOVE;
        let bestScore = maximizing ? -Infinity : Infinity;
        let completedDepth = 0;

        // Sinh nước đi gốc một lần, các vòng lặp sau chỉ sắp xếp lại.
        const rootMoves = [];
        const rootStatic = [];
        this.fields.reset();
        this.fields.computeMasks(state);
        this.fields.computeTurnMasks(state);
        this.moveGen.generate(state, this.fields, rootMoves, rootStatic);

        if (rootMoves.length === 0) {
            return { move: NO_MOVE, score: 0, depth: 0, nodes: 0, elapsed: 0, pv: [] };
        }
        if (rootMoves.length === 1) {
            return { move: rootMoves[0], score: 0, depth: 0, nodes: 0, elapsed: performance.now() - start, pv: [rootMoves[0]] };
        }

        const rootScores = new Float64Array(rootMoves.length);

        for (let depth = 1; depth <= maxDepth; depth++) {
            // sắp xếp: vòng trước tốt nhất lên đầu, còn lại theo điểm tĩnh
            const order = rootMoves.map((m, i) => i);
            if (depth === 1) {
                order.sort((a, b) => rootStatic[b] - rootStatic[a]);
            } else {
                order.sort((a, b) => {
                    const sa = rootScores[a], sb = rootScores[b];
                    return maximizing ? sb - sa : sa - sb;
                });
            }

            let alpha = -Infinity, beta = Infinity;
            let iterBest = NO_MOVE;
            let iterBestScore = maximizing ? -Infinity : Infinity;
            let searchedAny = false;

            for (let k = 0; k < order.length; k++) {
                const mi = order[k];
                const move = rootMoves[mi];

                state.make(move);
                const score = this._search(state, depth - 1, alpha, beta, 1);
                state.unmake();

                if (this.stopped) break;

                rootScores[mi] = score;
                searchedAny = true;

                if (maximizing) {
                    if (score > iterBestScore) { iterBestScore = score; iterBest = move; }
                    if (score > alpha) alpha = score;
                } else {
                    if (score < iterBestScore) { iterBestScore = score; iterBest = move; }
                    if (score < beta) beta = score;
                }
            }

            // Nhận kết quả của vòng này nếu có ít nhất một nước gốc được tìm xong.
            // Vì nước tốt nhất luôn được thử trước, kết quả dở dang vẫn thường tốt hơn
            // kết quả của độ sâu trước.
            if (searchedAny && iterBest !== NO_MOVE) {
                bestMove = iterBest;
                bestScore = iterBestScore;
                if (!this.stopped) completedDepth = depth;
            }

            if (this.stopped) break;
            if (Math.abs(bestScore) > MATE / 2) break; // đã thấy đường thắng ép
            if (performance.now() > this.deadline) break;
        }

        return {
            move: bestMove,
            score: bestScore,
            depth: completedDepth,
            nodes: this.nodes,
            elapsed: performance.now() - start,
            pv: this._extractPv(state, completedDepth)
        };
    }

    _search(state, depth, alpha, beta, ply) {
        if (this.stopped) return 0;

        if ((++this.nodes & (TIME_CHECK_INTERVAL - 1)) === 0) {
            if (performance.now() > this.deadline) { this.stopped = true; return 0; }
        }

        const result = state.gameResult();
        if (result !== ONGOING) return terminalScore(result, ply);
        if (depth <= 0 || ply >= MAX_PLY - 1) {
            this.fields.reset();
            this.fields.computeMasks(state);
            return this.evaluator.evaluate(state, this.fields);
        }

        const maximizing = state.currentTeam === 0;
        const alphaOrig = alpha, betaOrig = beta;

        // -------------------------------------------------- transposition table
        hashState(state, this._hash);
        const idx = this._hash[0] & this.ttMask;
        const key = this._hash[1];
        let ttMove = NO_MOVE;

        if (this.useTt && this.ttKey[idx] === key && key !== 0) {
            ttMove = this.ttMove[idx];
            if (this.ttDepth[idx] >= depth) {
                const s = this.ttScore[idx];
                const flag = this.ttFlag[idx];
                if (flag === TT_EXACT) return s;
                if (flag === TT_LOWER && s > alpha) alpha = s;
                else if (flag === TT_UPPER && s < beta) beta = s;
                if (alpha >= beta) return s;
            }
        }

        // -------------------------------------------------- sinh và sắp xếp nước đi
        const moves = this.moveBuf[ply];
        const statics = this.scoreBuf[ply];
        const order = this.orderBuf[ply];

        this.fields.reset();
        this.fields.computeMasks(state);
        this.fields.computeTurnMasks(state);
        this.moveGen.generate(state, this.fields, moves, statics);

        const count = moves.length;
        if (count === 0) {
            this.fields.reset();
            this.fields.computeMasks(state);
            return this.evaluator.evaluate(state, this.fields);
        }

        const k1 = this.killers[ply * 2], k2 = this.killers[ply * 2 + 1];
        order.length = count;
        for (let i = 0; i < count; i++) order[i] = i;

        const rank = new Float64Array(count);
        for (let i = 0; i < count; i++) {
            const m = moves[i];
            let s = statics[i];
            if (m === ttMove && ttMove !== NO_MOVE) s += 1e9;
            else if (m === k1 && k1 !== NO_MOVE) s += 5e6;
            else if (m === k2 && k2 !== NO_MOVE) s += 4e6;
            s += this.history[moveUnit(m) * (N_CELLS + 1) + histSlot(m)];
            rank[i] = s;
        }
        order.sort((a, b) => rank[b] - rank[a]);

        // -------------------------------------------------- vòng lặp chính
        let best = maximizing ? -Infinity : Infinity;
        let bestMove = NO_MOVE;

        for (let k = 0; k < count; k++) {
            const move = moves[order[k]];
            const quiet = moveAction(move) === ACT_NONE;

            state.make(move);

            let score;
            // Late move reduction: nước lặng ở cuối danh sách hiếm khi là nước hay,
            // tìm nông trước, chỉ tìm lại đầy đủ nếu nó bất ngờ vượt được alpha/beta.
            const reduce = (this.useLmr && depth >= 3 && k >= 4 && quiet) ? (k >= 10 ? 2 : 1) : 0;

            if (reduce > 0) {
                score = this._search(state, depth - 1 - reduce, alpha, beta, ply + 1);
                const promising = maximizing ? score > alpha : score < beta;
                if (promising && !this.stopped) {
                    score = this._search(state, depth - 1, alpha, beta, ply + 1);
                }
            } else {
                score = this._search(state, depth - 1, alpha, beta, ply + 1);
            }

            state.unmake();

            if (this.stopped) return maximizing ? best : best;

            if (maximizing) {
                if (score > best) { best = score; bestMove = move; }
                if (best > alpha) alpha = best;
            } else {
                if (score < best) { best = score; bestMove = move; }
                if (best < beta) beta = best;
            }

            if (alpha >= beta) {
                // cắt beta: ghi nhận nước gây cắt để lần sau thử sớm hơn
                if (quiet) {
                    if (this.killers[ply * 2] !== move) {
                        this.killers[ply * 2 + 1] = this.killers[ply * 2];
                        this.killers[ply * 2] = move;
                    }
                    this.history[moveUnit(move) * (N_CELLS + 1) + histSlot(move)] += depth * depth;
                }
                break;
            }
        }

        // -------------------------------------------------- lưu TT
        let flag = TT_EXACT;
        if (best <= alphaOrig) flag = TT_UPPER;
        else if (best >= betaOrig) flag = TT_LOWER;

        if (this.ttKey[idx] === 0 || this.ttGen[idx] !== this.generation || this.ttDepth[idx] <= depth) {
            this.ttKey[idx] = key;
            this.ttMove[idx] = bestMove;
            this.ttScore[idx] = best;
            this.ttDepth[idx] = depth;
            this.ttFlag[idx] = flag;
            this.ttGen[idx] = this.generation;
        }

        return best;
    }

    _extractPv(state, depth) {
        const pv = [];
        let pushed = 0;
        for (let d = 0; d < depth && d < 12; d++) {
            hashState(state, this._hash);
            const idx = this._hash[0] & this.ttMask;
            if (this.ttKey[idx] !== this._hash[1]) break;
            const move = this.ttMove[idx];
            if (move == null || move < 0) break;
            pv.push(move);
            state.make(move);
            pushed++;
        }
        for (let d = 0; d < pushed; d++) state.unmake();
        return pv;
    }
}

// Thắng sớm hơn thì tốt hơn: trừ dần theo ply để AI không chần chừ kết liễu.
function terminalScore(result, ply) {
    if (result === TEAM1_WIN) return MATE - ply;
    if (result === TEAM2_WIN) return -MATE + ply;
    return 0; // hoà
}

function histSlot(move) {
    const d = moveDest(move);
    return d === NO_DEST ? N_CELLS : d;
}

export { MATE };
