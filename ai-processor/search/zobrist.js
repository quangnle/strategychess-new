// Băm Zobrist cho transposition table.
//
// Ở game này TT có giá trị lớn bất thường: thứ tự kích hoạt quân trong một round
// hoán vị được, nên "A đi rồi B đi" và "B đi rồi A đi" cho ra đúng cùng một thế
// cờ. Số thế cờ trùng lặp vì thế rất lớn.
//
// Băm lại từ đầu ở mỗi node thay vì cập nhật tăng dần: chỉ tốn ~14 vòng lặp, không
// đáng kể so với ~25us của hàm lượng giá, mà tránh được cả một lớp bug đồng bộ.

import { N_CELLS } from './search-state.js';

const MAX_UNITS = 16;
const MAX_HP = 10;
const MAX_EFFECTS = 16;
const MAX_SPEED = 16;
const MAX_ROUND = 24;

function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5; s >>>= 0;
        return s | 0;
    };
}

function table(rng, size) {
    const lo = new Int32Array(size);
    const hi = new Int32Array(size);
    for (let i = 0; i < size; i++) { lo[i] = rng(); hi[i] = rng(); }
    return { lo, hi };
}

const rng = makeRng(0x9E3779B9);

export const Z_POS = table(rng, MAX_UNITS * (N_CELLS + 1));
export const Z_HP = table(rng, MAX_UNITS * MAX_HP);
export const Z_EFF = table(rng, MAX_UNITS * MAX_EFFECTS);
export const Z_SPEED = table(rng, MAX_UNITS * MAX_SPEED);
export const Z_ENDED = table(rng, MAX_UNITS);
export const Z_ROUND = table(rng, MAX_ROUND);
export const Z_SIDE = table(rng, 4);

// Trả về [lo, hi] qua mảng out để không cấp phát trong vòng lặp search.
export function hashState(state, out) {
    let lo = 0, hi = 0;

    for (let i = 0; i < state.n; i++) {
        const cell = state.hp[i] > 0 ? state.idx(i) : N_CELLS;
        const p = i * (N_CELLS + 1) + cell;
        lo ^= Z_POS.lo[p]; hi ^= Z_POS.hi[p];

        const h = i * MAX_HP + Math.max(0, Math.min(MAX_HP - 1, state.hp[i]));
        lo ^= Z_HP.lo[h]; hi ^= Z_HP.hi[h];

        const e = i * MAX_EFFECTS + (state.effects[i] & (MAX_EFFECTS - 1));
        lo ^= Z_EFF.lo[e]; hi ^= Z_EFF.hi[e];

        // berserk thay đổi vĩnh viễn tốc độ nên tốc độ phải nằm trong khoá băm
        const s = i * MAX_SPEED + Math.max(0, Math.min(MAX_SPEED - 1, state.speedX2[i]));
        lo ^= Z_SPEED.lo[s]; hi ^= Z_SPEED.hi[s];

        if (state.endedMask & (1 << i)) { lo ^= Z_ENDED.lo[i]; hi ^= Z_ENDED.hi[i]; }
    }

    const r = Math.max(0, Math.min(MAX_ROUND - 1, state.roundNo));
    lo ^= Z_ROUND.lo[r]; hi ^= Z_ROUND.hi[r];

    lo ^= Z_SIDE.lo[state.currentTeam & 1]; hi ^= Z_SIDE.hi[state.currentTeam & 1];
    lo ^= Z_SIDE.lo[2 + (state.priorityTeam & 1)]; hi ^= Z_SIDE.hi[2 + (state.priorityTeam & 1)];

    out[0] = lo; out[1] = hi;
    return out;
}
