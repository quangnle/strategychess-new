// Bản sao phẳng của trạng thái ván đấu, tối ưu cho tìm kiếm.
//
// GameLogic vẫn là luật chính thức. File này chỉ mô phỏng lại đúng luật đó trên
// mảng typed + make/unmake, để search chạy hàng trăm nghìn node mà không phải
// clone object. Tính tương đương được kiểm chứng bằng differential test
// (tools/difftest.js).
//
// Quy ước:
//  - speed lưu dạng nhân 2 (speedX2) để 2.5 / 3.5 / 5.5 thành số nguyên.
//    Phần lẻ .5 không tạo thêm bước đi, nó chỉ dùng để phá hòa movement point.
//  - quân chết đặt row = col = -1, mọi phép tính đều phải lọc hp > 0 trước.

import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES } from '../../core-logic/definitions.js';

export const N_CELLS = BOARD_ROWS * BOARD_COLS;

// bitmask abilities
export const AB_ADJACENT_PENALTY = 1 << 0;
export const AB_SACRIFICE = 1 << 1;
export const AB_LOCK = 1 << 2;
export const AB_BERSERK = 1 << 3;
export const AB_HEAL = 1 << 4;
export const AB_SUICIDE = 1 << 5;
export const AB_WIND_WALK = 1 << 6;

// bitmask effects
export const EF_ADJACENT_PENALTY = 1 << 0;
export const EF_LOCK = 1 << 1;
export const EF_DASH = 1 << 2;
export const EF_SUICIDE = 1 << 3;

const ABILITY_BITS = {
    'adjacent penalty': AB_ADJACENT_PENALTY,
    'sacrifice': AB_SACRIFICE,
    'lock': AB_LOCK,
    'berserk': AB_BERSERK,
    'heal': AB_HEAL,
    'suicide': AB_SUICIDE,
    'wind walk': AB_WIND_WALK
};

const EFFECT_BITS = {
    'adjacent penalty': EF_ADJACENT_PENALTY,
    'lock': EF_LOCK,
    'dash': EF_DASH,
    'suicide': EF_SUICIDE
};

// hành động, khớp với mã đóng gói trong nước đi
export const ACT_NONE = 0;
export const ACT_ATTACK = 1;
export const ACT_HEAL = 2;
export const ACT_SACRIFICE = 3;
export const ACT_SUICIDE = 4;
export const ACT_PASS = 5;

export const NO_DEST = 255;

// kết quả ván
export const ONGOING = 0;
export const TEAM1_WIN = 1;
export const TEAM2_WIN = 2;
export const DRAW = 3;

export const MAX_ROUNDS = 20;
const DASH_CAP_X2 = 9; // trần 4.5 khi có DASH, khớp _getCurrentSpeed

// ---------------------------------------------------------------- mã hoá move
// unitIdx (4b) | destCell (8b) | action (3b) | targetIdx (4b)
export function encodeMove(unitIdx, destCell, action, targetIdx) {
    return (unitIdx & 0xf)
        | ((destCell & 0xff) << 4)
        | ((action & 0x7) << 12)
        | ((targetIdx & 0xf) << 15);
}

export const moveUnit = (m) => m & 0xf;
export const moveDest = (m) => (m >> 4) & 0xff;
export const moveAction = (m) => (m >> 12) & 0x7;
export const moveTarget = (m) => (m >> 15) & 0xf;

export function describeMove(state, m) {
    if (m == null || m < 0) return '(null)';
    const u = moveUnit(m), d = moveDest(m), a = moveAction(m), t = moveTarget(m);
    const names = ['none', 'attack', 'heal', 'sacrifice', 'suicide', 'pass'];
    const dest = d === NO_DEST ? 'stay' : `(${(d / BOARD_COLS) | 0},${d % BOARD_COLS})`;
    const target = (a === ACT_ATTACK || a === ACT_HEAL || a === ACT_SACRIFICE) ? ` -> ${state.name[t]}` : '';
    return `${state.name[u]} ${dest} ${names[a]}${target}`;
}

// Ảnh chụp trạng thái dạng JSON thuần, không chứa instance của class nào.
// Cần cho Web Worker: postMessage chỉ chuyển được dữ liệu thuần, không chuyển
// được prototype của GameLogic / MatchInfo / Unit.
export function snapshotFromGameLogic(gameLogic) {
    const t1 = gameLogic.matchInfo.team1;
    const t2 = gameLogic.matchInfo.team2;
    const units = [...t1.units, ...t2.units].map(u => ({
        id: u.id,
        name: u.name,
        armyType: u.armyType,
        teamId: u.teamId,
        row: u.row,
        col: u.col,
        hp: u.hp,
        speed: u.speed,
        range: u.range,
        magicRange: u.magicRange,
        abilities: [...u.abilities],
        effects: u.effects.map(e => ({ ...e })),
        ended: gameLogic.hasEndedTurn(u)
    }));

    return {
        teamIds: [t1.teamId, t2.teamId],
        units,
        roundNo: gameLogic.roundNo,
        priorityTeamId: gameLogic.priorityTeamId,
        currentTurnTeamId: gameLogic.currentTurnTeamId
    };
}

export class SearchState {
    // Nhận vào GameLogic hoặc ảnh chụp thuần dữ liệu (xem snapshotFromGameLogic).
    constructor(source) {
        const snap = (source && source.matchInfo) ? snapshotFromGameLogic(source) : source;

        const units = snap.units;
        const n = units.length;

        this.n = n;
        this.teamIds = snap.teamIds;
        this.unitIds = units.map(u => u.id);
        this.name = units.map(u => u.name);

        this.team = new Int8Array(n);
        this.row = new Int8Array(n);
        this.col = new Int8Array(n);
        this.hp = new Int8Array(n);
        this.maxHp = new Int8Array(n);
        this.speedX2 = new Int8Array(n);
        this.baseSpeedX2 = new Int8Array(n);
        this.range = new Int8Array(n);
        this.magicRange = new Int8Array(n);
        this.abilities = new Uint8Array(n);
        this.effects = new Uint8Array(n);
        this.lockDur = new Int8Array(n);
        this.dashDur = new Int8Array(n);
        this.dashValX2 = new Int8Array(n);
        this.isBase = new Uint8Array(n);
        this.armyType = units.map(u => u.armyType);

        this.baseIdx = [-1, -1];
        this.occ = new Int16Array(N_CELLS).fill(-1);

        for (let i = 0; i < n; i++) {
            const u = units[i];
            this.team[i] = u.teamId === this.teamIds[0] ? 0 : 1;
            this.row[i] = u.hp > 0 ? u.row : -1;
            this.col[i] = u.hp > 0 ? u.col : -1;
            this.hp[i] = u.hp;
            this.maxHp[i] = UNIT_TYPES[u.name].hp;
            this.speedX2[i] = Math.round(u.speed * 2);
            this.baseSpeedX2[i] = Math.round(u.speed * 2);
            this.range[i] = u.range;
            this.magicRange[i] = u.magicRange;
            this.isBase[i] = u.name === 'Base' ? 1 : 0;
            if (this.isBase[i]) this.baseIdx[this.team[i]] = i;

            let ab = 0;
            for (const a of u.abilities) ab |= (ABILITY_BITS[a] || 0);
            this.abilities[i] = ab;

            let ef = 0;
            for (const e of u.effects) {
                ef |= (EFFECT_BITS[e.name] || 0);
                if (e.name === 'lock') this.lockDur[i] = e.duration ?? 0;
                if (e.name === 'dash') { this.dashDur[i] = e.duration ?? 0; this.dashValX2[i] = Math.round((e.value ?? 0) * 2); }
            }
            this.effects[i] = ef;

            if (this.hp[i] > 0) this.occ[this.row[i] * BOARD_COLS + this.col[i]] = i;
        }

        this.endedMask = 0;
        for (let i = 0; i < n; i++) {
            if (units[i].ended) this.endedMask |= (1 << i);
        }

        this.roundNo = snap.roundNo;
        this.priorityTeam = snap.priorityTeamId === this.teamIds[0] ? 0 : 1;
        this.currentTeam = snap.currentTurnTeamId === this.teamIds[0] ? 0
            : snap.currentTurnTeamId === this.teamIds[1] ? 1 : -1;
        if (this.currentTeam === -1) this.selectNextTeam();

        // bộ nhớ tạm dùng lại giữa các lần gọi, tránh cấp phát trong vòng lặp search
        this._undo = [];
        this._ply = 0;
        this._bfsDist = new Int16Array(N_CELLS);
        this._bfsQueue = new Int16Array(N_CELLS);
        this._bfsStamp = new Int32Array(N_CELLS);
        this._bfsEpoch = 0;
    }

    // ------------------------------------------------------------ truy vấn cơ bản
    idx(i) { return this.row[i] * BOARD_COLS + this.col[i]; }
    alive(i) { return this.hp[i] > 0; }

    currentSpeedX2(i) {
        let s = this.speedX2[i];
        if (this.effects[i] & EF_DASH) s = Math.min(DASH_CAP_X2, s + this.dashValX2[i]);
        return s;
    }

    manhattan(r1, c1, r2, c2) { return Math.abs(r1 - r2) + Math.abs(c1 - c2); }

    distUnits(a, b) {
        return Math.abs(this.row[a] - this.row[b]) + Math.abs(this.col[a] - this.col[b]);
    }

    // Ô mà unit i có thể đi tới. Trả về mảng chỉ số ô (không gồm ô đang đứng).
    reachableCells(i, out = []) {
        out.length = 0;
        if (!this.alive(i) || this.isBase[i]) return out;

        const rangeX2 = this.currentSpeedX2(i);
        if (rangeX2 <= 0) return out;

        if (this.abilities[i] & AB_WIND_WALK) {
            // xuyên vật cản: mọi ô trống trong bán kính Manhattan
            const steps = rangeX2 >> 1;
            const r0 = this.row[i], c0 = this.col[i];
            for (let r = Math.max(0, r0 - steps); r <= Math.min(BOARD_ROWS - 1, r0 + steps); r++) {
                const budget = steps - Math.abs(r - r0);
                for (let c = Math.max(0, c0 - budget); c <= Math.min(BOARD_COLS - 1, c0 + budget); c++) {
                    const cell = r * BOARD_COLS + c;
                    if (this.occ[cell] === -1) out.push(cell);
                }
            }
            return out;
        }

        const steps = rangeX2 >> 1;
        const epoch = ++this._bfsEpoch;
        const stamp = this._bfsStamp, dist = this._bfsDist, queue = this._bfsQueue;

        const start = this.idx(i);
        stamp[start] = epoch; dist[start] = 0;
        let head = 0, tail = 0;
        queue[tail++] = start;

        const occ = this.occ;
        while (head < tail) {
            const cur = queue[head++];
            const d = dist[cur];
            if (d >= steps) continue;

            const r = (cur / BOARD_COLS) | 0;
            const c = cur - r * BOARD_COLS;

            for (let k = 0; k < 4; k++) {
                const nr = r + (k === 0 ? -1 : k === 1 ? 1 : 0);
                const nc = c + (k === 2 ? -1 : k === 3 ? 1 : 0);
                if (nr < 0 || nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS) continue;
                const cell = nr * BOARD_COLS + nc;
                if (stamp[cell] === epoch) continue;
                if (occ[cell] !== -1) continue;
                stamp[cell] = epoch;
                dist[cell] = d + 1;
                out.push(cell);
                queue[tail++] = cell;
            }
        }
        return out;
    }

    enemiesWithinRange(i, range, out = []) {
        out.length = 0;
        const t = this.team[i], r = this.row[i], c = this.col[i];
        for (let j = 0; j < this.n; j++) {
            if (this.team[j] === t || this.hp[j] <= 0) continue;
            if (Math.abs(this.row[j] - r) + Math.abs(this.col[j] - c) <= range) out.push(j);
        }
        return out;
    }

    enemiesWithinRangeFrom(i, cell, range, out = []) {
        out.length = 0;
        const t = this.team[i];
        const r = (cell / BOARD_COLS) | 0, c = cell - r * BOARD_COLS;
        for (let j = 0; j < this.n; j++) {
            if (this.team[j] === t || this.hp[j] <= 0) continue;
            if (Math.abs(this.row[j] - r) + Math.abs(this.col[j] - c) <= range) out.push(j);
        }
        return out;
    }

    alliesWithinRangeFrom(i, cell, range, out = []) {
        out.length = 0;
        const t = this.team[i];
        const r = (cell / BOARD_COLS) | 0, c = cell - r * BOARD_COLS;
        for (let j = 0; j < this.n; j++) {
            if (this.team[j] !== t || this.hp[j] <= 0) continue;
            if (Math.abs(this.row[j] - r) + Math.abs(this.col[j] - c) <= range) out.push(j);
        }
        return out;
    }

    teamMovementPointX2(t) {
        let total = 0;
        for (let i = 0; i < this.n; i++) {
            if (this.team[i] !== t || this.hp[i] <= 0 || this.isBase[i]) continue;
            if (this.endedMask & (1 << i)) continue;
            total += this.currentSpeedX2(i);
        }
        return total;
    }

    isRoundComplete() {
        for (let i = 0; i < this.n; i++) {
            if (this.hp[i] <= 0 || this.isBase[i]) continue;
            if (!(this.endedMask & (1 << i))) return false;
        }
        return true;
    }

    selectNextTeam() {
        const m0 = this.teamMovementPointX2(0);
        const m1 = this.teamMovementPointX2(1);
        this.currentTeam = m0 > m1 ? 0 : m1 > m0 ? 1 : this.priorityTeam;
    }

    gameResult() {
        if (this.hp[this.baseIdx[0]] <= 0) return TEAM2_WIN;
        if (this.hp[this.baseIdx[1]] <= 0) return TEAM1_WIN;

        let a0 = 0, a1 = 0;
        for (let i = 0; i < this.n; i++) {
            if (this.hp[i] <= 0 || this.isBase[i]) continue;
            if (this.team[i] === 0) a0++; else a1++;
        }
        if (a0 === 0) return TEAM2_WIN;
        if (a1 === 0) return TEAM1_WIN;
        if (this.roundNo >= MAX_ROUNDS) return DRAW;
        return ONGOING;
    }

    // ------------------------------------------------------------ hiệu ứng
    _adjacentEnemyCount(i) {
        const r = this.row[i], c = this.col[i], t = this.team[i];
        let count = 0;
        for (let k = 0; k < 4; k++) {
            const nr = r + (k === 0 ? -1 : k === 1 ? 1 : 0);
            const nc = c + (k === 2 ? -1 : k === 3 ? 1 : 0);
            if (nr < 0 || nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS) continue;
            const j = this.occ[nr * BOARD_COLS + nc];
            if (j !== -1 && this.team[j] !== t && this.hp[j] > 0) count++;
        }
        return count;
    }

    // chỉ thêm, khớp _adjacentPenaltyEffect
    applyAdjacentPenalty() {
        for (let i = 0; i < this.n; i++) {
            if (!(this.abilities[i] & AB_ADJACENT_PENALTY)) continue;
            if (this.hp[i] <= 0) continue;
            if (this.effects[i] & EF_ADJACENT_PENALTY) continue;
            if (this._adjacentEnemyCount(i) > 0) this.effects[i] |= EF_ADJACENT_PENALTY;
        }
    }

    // chỉ gọi ở đầu lượt mới, khớp _removeAdjacentPenaltyEffect
    clearStaleAdjacentPenalty() {
        for (let i = 0; i < this.n; i++) {
            const hasAbility = (this.abilities[i] & AB_ADJACENT_PENALTY) && this.hp[i] > 0;
            const adjacent = hasAbility ? this._adjacentEnemyCount(i) : 0;
            if (adjacent === 0) this.effects[i] &= ~EF_ADJACENT_PENALTY;
        }
    }

    applySuicideFlag() {
        for (let i = 0; i < this.n; i++) {
            if (!(this.abilities[i] & AB_SUICIDE)) continue;
            if (this.hp[i] === 1 && !(this.effects[i] & EF_SUICIDE)) this.effects[i] |= EF_SUICIDE;
        }
    }

    applyBerserk() {
        for (let i = 0; i < this.n; i++) {
            if (!(this.abilities[i] & AB_BERSERK)) continue;
            if (this.hp[i] <= 0 || this.isBase[i]) continue;
            let allies = 0;
            for (let j = 0; j < this.n; j++) {
                if (this.team[j] === this.team[i] && this.hp[j] > 0 && !this.isBase[j]) allies++;
            }
            if (allies === 1) {
                this.hp[i] = Math.min(this.hp[i] + 1, this.maxHp[i]);
                this.speedX2[i] += 2;
                this.abilities[i] &= ~AB_BERSERK;
            }
        }
    }

    reduceEffectDurations() {
        for (let i = 0; i < this.n; i++) {
            if (this.hp[i] <= 0) continue;
            if (this.effects[i] & EF_LOCK) {
                this.lockDur[i] -= 1;
                if (this.lockDur[i] <= 0) {
                    this.effects[i] &= ~EF_LOCK;
                    this.lockDur[i] = 0;
                }
            }
            if (this.effects[i] & EF_DASH) {
                this.dashDur[i] -= 1;
                if (this.dashDur[i] <= 0) {
                    this.effects[i] &= ~EF_DASH;
                    this.dashDur[i] = 0;
                    this.dashValX2[i] = 0;
                }
            }
        }
    }

    removeDeadUnits() {
        for (let i = 0; i < this.n; i++) {
            if (this.hp[i] > 0) continue;
            if (this.row[i] >= 0) {
                const cell = this.idx(i);
                if (this.occ[cell] === i) this.occ[cell] = -1;
                this.row[i] = -1; this.col[i] = -1;
            }
        }
    }

    // ------------------------------------------------------------ make / unmake
    _snapshot() {
        let s = this._undo[this._ply];
        if (!s) {
            const n = this.n;
            s = {
                row: new Int8Array(n), col: new Int8Array(n), hp: new Int8Array(n),
                speedX2: new Int8Array(n), abilities: new Uint8Array(n), effects: new Uint8Array(n),
                lockDur: new Int8Array(n), dashDur: new Int8Array(n), dashValX2: new Int8Array(n),
                occ: new Int16Array(N_CELLS)
            };
            this._undo[this._ply] = s;
        }
        s.row.set(this.row); s.col.set(this.col); s.hp.set(this.hp);
        s.speedX2.set(this.speedX2); s.abilities.set(this.abilities); s.effects.set(this.effects);
        s.lockDur.set(this.lockDur); s.dashDur.set(this.dashDur); s.dashValX2.set(this.dashValX2);
        s.occ.set(this.occ);
        s.endedMask = this.endedMask;
        s.roundNo = this.roundNo;
        s.priorityTeam = this.priorityTeam;
        s.currentTeam = this.currentTeam;
        return s;
    }

    make(move) {
        this._snapshot();
        this._ply++;

        const i = moveUnit(move);
        const dest = moveDest(move);
        const action = moveAction(move);
        const target = moveTarget(move);

        if (dest !== NO_DEST) {
            const from = this.idx(i);
            if (this.occ[from] === i) this.occ[from] = -1;
            this.row[i] = (dest / BOARD_COLS) | 0;
            this.col[i] = dest - this.row[i] * BOARD_COLS;
            this.occ[dest] = i;
            // makeMove gọi _adjacentPenaltyEffect ngay sau khi dời quân
            this.applyAdjacentPenalty();
        }

        switch (action) {
            case ACT_ATTACK: this._doAttack(i, target); break;
            case ACT_HEAL: this._doHeal(i, target); break;
            case ACT_SACRIFICE: this._doSacrifice(i, target); break;
            case ACT_SUICIDE: this._doSuicide(i); break;
            default: break;
        }

        this._advanceTurn(i);
    }

    unmake() {
        this._ply--;
        const s = this._undo[this._ply];
        this.row.set(s.row); this.col.set(s.col); this.hp.set(s.hp);
        this.speedX2.set(s.speedX2); this.abilities.set(s.abilities); this.effects.set(s.effects);
        this.lockDur.set(s.lockDur); this.dashDur.set(s.dashDur); this.dashValX2.set(s.dashValX2);
        this.occ.set(s.occ);
        this.endedMask = s.endedMask;
        this.roundNo = s.roundNo;
        this.priorityTeam = s.priorityTeam;
        this.currentTeam = s.currentTeam;
    }

    _doAttack(i, target) {
        this.hp[target] -= 1;
        if (this.abilities[i] & AB_LOCK) {
            if (this.hp[target] > 0) {
                this.effects[target] |= EF_LOCK;
                this.lockDur[target] = 2;
            }
            if (!(this.effects[i] & EF_DASH)) {
                this.effects[i] |= EF_DASH;
                this.dashDur[i] = 2;
                this.dashValX2[i] = 2;
            }
        }
        this.applySuicideFlag();
        this.applyAdjacentPenalty();
    }

    _doHeal(i, target) {
        this.hp[target] += 1;
        this.applySuicideFlag();
    }

    _doSacrifice(i, target) {
        this.hp[i] -= 1;
        this.hp[target] += 1;
        this.applyAdjacentPenalty();
        this.applySuicideFlag();
    }

    _doSuicide(i) {
        this.hp[i] = 0;
        const r = this.row[i], c = this.col[i];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS) continue;
                const j = this.occ[nr * BOARD_COLS + nc];
                if (j !== -1 && this.hp[j] > 0) this.hp[j] -= 1;
            }
        }
        this.applyAdjacentPenalty();
    }

    // tương đương GameLogic.newTurn()
    _advanceTurn(actedUnit) {
        this.removeDeadUnits();
        this.applyBerserk();
        this.applyAdjacentPenalty();
        this.clearStaleAdjacentPenalty();
        this.applySuicideFlag();

        this.endedMask |= (1 << actedUnit);

        if (this.isRoundComplete()) {
            this.roundNo++;
            this.reduceEffectDurations();
            this.endedMask = 0;
            this.priorityTeam = this.priorityTeam === 0 ? 1 : 0;
        }

        this.selectNextTeam();
    }

    // ------------------------------------------------------------ tiện ích
    hashKeyParts() {
        return { endedMask: this.endedMask, roundNo: this.roundNo, priorityTeam: this.priorityTeam, currentTeam: this.currentTeam };
    }

    unitIndexById(id) {
        return this.unitIds.indexOf(id);
    }
}
