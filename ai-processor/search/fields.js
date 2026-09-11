// Các bản đồ dẫn xuất từ trạng thái bàn cờ, tính một lần rồi tra bảng O(1).
//
// Điểm cốt lõi của toàn bộ thiết kế nằm ở đây: khoảng cách dùng BFS có trọng số
// trên occupancy thật, không dùng Manhattan. Nhờ vậy "chặn đường" không cần luật
// riêng nào cả, nó tự nổi lên: quân đứng chắn làm khoảng cách đường đi của địch
// tăng vọt, và mọi số hạng phụ thuộc khoảng cách trong hàm lượng giá tự đổi theo.
//
// Chi phí phân bổ theo đúng kế hoạch:
//  - distField (Dijkstra có trọng số) chỉ tính ở node lá, nơi thực sự cần chính xác.
//  - threat map dùng xấp xỉ đĩa Manhattan, rẻ và bi quan nên an toàn cho move-gen.

import { BOARD_COLS, BOARD_ROWS } from '../../core-logic/definitions.js';
import { N_CELLS, AB_WIND_WALK } from './search-state.js';

// chi phí đi vào một ô
export const COST_EMPTY = 1;
export const COST_ALLY = 2;   // đồng đội sẽ nhường đường, chỉ mất nhịp
export const COST_ENEMY = 5;  // phải giết hoặc đi vòng
const MAX_COST = COST_ENEMY;

export const UNREACHABLE = 30000;
const MAX_DIST = 200; // đủ xa cho bàn 12x11 với chi phí tối đa 5

export class Fields {
    constructor(n) {
        this.n = n;
        this.distField = new Int16Array(n * N_CELLS);
        this.hasField = new Uint8Array(n);

        // bit i = unit i có thể (di chuyển rồi) đánh tới mục tiêu đứng ở ô này
        this.threatNow = new Uint16Array(N_CELLS); // chỉ tính unit chưa đi trong round
        this.threatAny = new Uint16Array(N_CELLS); // mọi unit còn sống
        // bit i = unit i đánh tới ô này mà không cần di chuyển
        this.coverMask = new Uint16Array(N_CELLS);
        // bit i = ô này kề (Manhattan 1) với unit i
        this.adjacentMask = new Uint16Array(N_CELLS);

        // Mặt nạ phục vụ sinh nước đi, tính một lần mỗi node rồi tra bảng.
        // rangeMaskEnemy[r] : bit j = địch j nằm trong bán kính r của ô này
        // rangeMaskWounded[r]: bit j = đồng đội j đang mất máu, nằm trong bán kính r
        this.rangeMaskEnemy = [];
        this.rangeMaskWounded = [];
        this.corridor = new Uint8Array(N_CELLS);

        this.enemyMask = 0;
        this.allyMask = 0;
        this.enemyAdjPenaltyMask = 0;
        this.woundedAllyMask = 0;

        // escape[i] = tỉ lệ ô quanh i mà đứng vào thì xa địch gần nhất hơn hiện tại.
        // Đây là "đất lùi", đại lượng quyết định kite có khả thi hay không.
        this.escape = new Float32Array(n);
        this.nearestEnemy = new Int8Array(n);

        // bucket queue của Dial, dùng lại giữa các lần gọi
        this._buckets = Array.from({ length: MAX_COST + 1 }, () => []);
        this._stamp = new Int32Array(N_CELLS);
        this._epoch = 0;
    }

    reset() {
        this.hasField.fill(0);
    }

    _radiusBuffer(store, r) {
        let buf = store[r];
        if (!buf) { buf = new Uint16Array(N_CELLS); store[r] = buf; }
        else buf.fill(0);
        return buf;
    }

    // Mặt nạ phụ thuộc phe đang đi. Thay thế các vòng lặp O(n) trên từng ô trong
    // move-gen bằng tra bảng O(1), đây là phần chiếm gần hết chi phí sinh nước đi.
    computeTurnMasks(state) {
        const team = state.currentTeam;

        this.enemyMask = 0; this.allyMask = 0;
        this.enemyAdjPenaltyMask = 0; this.woundedAllyMask = 0;

        const radii = new Set();
        const woundedRadii = new Set();

        for (let i = 0; i < state.n; i++) {
            if (state.hp[i] <= 0) continue;
            const bit = 1 << i;
            if (state.team[i] === team) {
                this.allyMask |= bit;
                if (state.hp[i] < state.maxHp[i]) this.woundedAllyMask |= bit;
                if (state.isBase[i] || (state.endedMask & bit)) continue;
                radii.add(state.range[i]);
                if (state.magicRange[i] > 0) woundedRadii.add(state.magicRange[i]);
                if (state.abilities[i] & 2 /* AB_SACRIFICE */) woundedRadii.add(1);
            } else {
                this.enemyMask |= bit;
                if (state.abilities[i] & 1 /* AB_ADJACENT_PENALTY */) this.enemyAdjPenaltyMask |= bit;
            }
        }

        for (const r of radii) {
            const buf = this._radiusBuffer(this.rangeMaskEnemy, r);
            for (let j = 0; j < state.n; j++) {
                if (state.hp[j] <= 0 || state.team[j] === team) continue;
                fillDiamond(buf, state.row[j], state.col[j], r, 1 << j);
            }
        }

        for (const r of woundedRadii) {
            const buf = this._radiusBuffer(this.rangeMaskWounded, r);
            for (let j = 0; j < state.n; j++) {
                if (state.hp[j] <= 0 || state.team[j] !== team) continue;
                if (state.hp[j] >= state.maxHp[j]) continue;
                fillDiamond(buf, state.row[j], state.col[j], r, 1 << j);
            }
        }

        // Hành lang tiến quân: ô nằm trên đường Manhattan ngắn nhất từ một quân địch
        // về Base của phe đang đi. Đây là proxy rẻ cho "chỗ đáng đứng chặn".
        this.corridor.fill(0);
        const myBase = state.baseIdx[team];
        if (myBase >= 0) {
            const rb = state.row[myBase], cb = state.col[myBase];
            for (let j = 0; j < state.n; j++) {
                if (state.hp[j] <= 0 || state.team[j] === team || state.isBase[j]) continue;
                const rj = state.row[j], cj = state.col[j];
                const dEB = Math.abs(rj - rb) + Math.abs(cj - cb);
                const rMin = Math.min(rj, rb), rMax = Math.max(rj, rb);
                const cMin = Math.min(cj, cb), cMax = Math.max(cj, cb);
                for (let r = rMin; r <= rMax; r++) {
                    for (let c = cMin; c <= cMax; c++) {
                        const dEC = Math.abs(rj - r) + Math.abs(cj - c);
                        const dCB = Math.abs(r - rb) + Math.abs(c - cb);
                        if (dEC + dCB === dEB) this.corridor[r * BOARD_COLS + c]++;
                    }
                }
            }
        }
    }

    // -------------------------------------------------------- bản đồ đe doạ
    computeMasks(state) {
        this.threatNow.fill(0);
        this.threatAny.fill(0);
        this.coverMask.fill(0);
        this.adjacentMask.fill(0);

        for (let i = 0; i < state.n; i++) {
            if (state.hp[i] <= 0) continue;
            const bit = 1 << i;
            const r0 = state.row[i], c0 = state.col[i];
            const range = state.range[i];
            const ended = (state.endedMask & bit) !== 0;

            // cover: đánh tới được mà không cần di chuyển
            fillDiamond(this.coverMask, r0, c0, range, bit);

            // Vành đai kề. Base cũng phải có vành đai này: nó là mục tiêu sacrifice
            // hợp lệ, và đứng cạnh Base địch vẫn kích hoạt adjacency penalty.
            fillRing1(this.adjacentMask, r0, c0, bit);

            if (state.isBase[i]) continue;

            // threat: xấp xỉ đĩa steps + range. Bỏ qua vật cản nên đây là ước lượng
            // bi quan (rộng hơn thực tế), an toàn cho việc cắt tỉa nước đi.
            const steps = state.currentSpeedX2(i) >> 1;
            fillDiamond(this.threatAny, r0, c0, steps + range, bit);
            if (!ended) fillDiamond(this.threatNow, r0, c0, steps + range, bit);
        }
    }

    // Đất lùi của từng quân so với địch gần nhất. Dùng đĩa Manhattan trên ô trống
    // thay vì BFS đầy đủ: rẻ hơn nhiều mà vẫn đủ để phân biệt "thoáng" với "bị dồn".
    computeEscape(state) {
        this.escape.fill(0);
        this.nearestEnemy.fill(-1);

        for (let i = 0; i < state.n; i++) {
            if (state.hp[i] <= 0 || state.isBase[i]) continue;

            let nearest = -1, bestD = 1e9;
            for (let j = 0; j < state.n; j++) {
                if (state.hp[j] <= 0 || state.team[j] === state.team[i] || state.isBase[j]) continue;
                const d = state.distUnits(i, j);
                if (d < bestD) { bestD = d; nearest = j; }
            }
            this.nearestEnemy[i] = nearest;
            if (nearest === -1) { this.escape[i] = 1; continue; }

            const steps = state.currentSpeedX2(i) >> 1;
            if (steps <= 0) { this.escape[i] = 0; continue; }

            const r0 = state.row[i], c0 = state.col[i];
            const re = state.row[nearest], ce = state.col[nearest];
            let free = 0, away = 0;

            const rMin = Math.max(0, r0 - steps), rMax = Math.min(BOARD_ROWS - 1, r0 + steps);
            for (let r = rMin; r <= rMax; r++) {
                const budget = steps - Math.abs(r - r0);
                const cMin = Math.max(0, c0 - budget), cMax = Math.min(BOARD_COLS - 1, c0 + budget);
                for (let c = cMin; c <= cMax; c++) {
                    if (state.occ[r * BOARD_COLS + c] !== -1) continue;
                    free++;
                    if (Math.abs(r - re) + Math.abs(c - ce) > bestD) away++;
                }
            }
            this.escape[i] = free === 0 ? 0 : away / free;
        }
    }

    // -------------------------------------------------------- trường khoảng cách
    // Dijkstra có trọng số từ vị trí của unit i. Ô đích tính chi phí đi VÀO ô đó.
    computeField(state, i) {
        const off = i * N_CELLS;
        const dist = this.distField;
        dist.fill(UNREACHABLE, off, off + N_CELLS);

        if (state.hp[i] <= 0) { this.hasField[i] = 1; return; }

        // Nizza xuyên vật cản nên khoảng cách của nó luôn là Manhattan thuần:
        // không ai chặn được nó, và hàm lượng giá phải phản ánh đúng điều đó.
        if (state.abilities[i] & AB_WIND_WALK) {
            const r0 = state.row[i], c0 = state.col[i];
            for (let r = 0; r < BOARD_ROWS; r++) {
                for (let c = 0; c < BOARD_COLS; c++) {
                    dist[off + r * BOARD_COLS + c] = Math.abs(r - r0) + Math.abs(c - c0);
                }
            }
            this.hasField[i] = 1;
            return;
        }

        const team = state.team[i];
        const occ = state.occ;
        const buckets = this._buckets;
        for (let b = 0; b < buckets.length; b++) buckets[b].length = 0;

        const start = state.idx(i);
        dist[off + start] = 0;
        buckets[0].push(start);

        let remaining = 1;
        for (let d = 0; d <= MAX_DIST && remaining > 0; d++) {
            const bucket = buckets[d % (MAX_COST + 1)];
            while (bucket.length > 0) {
                const cur = bucket.pop();
                remaining--;
                if (dist[off + cur] !== d) continue; // mục đã cũ

                const r = (cur / BOARD_COLS) | 0;
                const c = cur - r * BOARD_COLS;

                for (let k = 0; k < 4; k++) {
                    const nr = r + (k === 0 ? -1 : k === 1 ? 1 : 0);
                    const nc = c + (k === 2 ? -1 : k === 3 ? 1 : 0);
                    if (nr < 0 || nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS) continue;

                    const cell = nr * BOARD_COLS + nc;
                    const occupant = occ[cell];
                    let w = COST_EMPTY;
                    if (occupant !== -1) {
                        w = state.team[occupant] === team ? COST_ALLY : COST_ENEMY;
                    }

                    const nd = d + w;
                    if (nd < dist[off + cell]) {
                        dist[off + cell] = nd;
                        buckets[nd % (MAX_COST + 1)].push(cell);
                        remaining++;
                    }
                }
            }
        }

        this.hasField[i] = 1;
    }

    ensureField(state, i) {
        if (!this.hasField[i]) this.computeField(state, i);
    }

    distTo(i, cell) {
        return this.distField[i * N_CELLS + cell];
    }

    // Khoảng cách đường đi từ unit i tới ô mà unit j đang đứng. Vì ô của j bị j
    // chiếm, giá trị này đã bao gồm chi phí "đâm vào" j, đúng ý nghĩa cần dùng.
    distToUnit(state, i, j) {
        if (state.hp[j] <= 0) return UNREACHABLE;
        return this.distField[i * N_CELLS + state.idx(j)];
    }

    // Số ô trong tầm với của unit i mà làm tăng khoảng cách tới địch e.
    // Đây là thước đo "còn đất lùi" quyết định việc kite có khả thi không.
    escapeRatio(state, i, e, reachable) {
        if (reachable.length === 0) return 0;
        const cur = state.distUnits(i, e);
        let better = 0;
        for (let k = 0; k < reachable.length; k++) {
            const cell = reachable[k];
            const r = (cell / BOARD_COLS) | 0;
            const c = cell - r * BOARD_COLS;
            const d = Math.abs(r - state.row[e]) + Math.abs(c - state.col[e]);
            if (d > cur) better++;
        }
        return better / reachable.length;
    }
}

function fillDiamond(mask, r0, c0, radius, bit) {
    if (radius < 0) return;
    const rMin = Math.max(0, r0 - radius), rMax = Math.min(BOARD_ROWS - 1, r0 + radius);
    for (let r = rMin; r <= rMax; r++) {
        const budget = radius - Math.abs(r - r0);
        const cMin = Math.max(0, c0 - budget), cMax = Math.min(BOARD_COLS - 1, c0 + budget);
        const base = r * BOARD_COLS;
        for (let c = cMin; c <= cMax; c++) mask[base + c] |= bit;
    }
}

function fillRing1(mask, r0, c0, bit) {
    if (r0 > 0) mask[(r0 - 1) * BOARD_COLS + c0] |= bit;
    if (r0 < BOARD_ROWS - 1) mask[(r0 + 1) * BOARD_COLS + c0] |= bit;
    if (c0 > 0) mask[r0 * BOARD_COLS + c0 - 1] |= bit;
    if (c0 < BOARD_COLS - 1) mask[r0 * BOARD_COLS + c0 + 1] |= bit;
}
