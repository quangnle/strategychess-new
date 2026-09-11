// Ảnh gương của một thế cờ: đổi phe hai bên và lật bàn cờ theo trục ngang.
// Dùng chung cho test đối xứng của cả hàm lượng giá lẫn bộ tìm kiếm.

import { BOARD_COLS, BOARD_ROWS } from '../core-logic/definitions.js';

export function mirror(src) {
    const m = Object.create(Object.getPrototypeOf(src));
    Object.assign(m, src);

    const n = src.n;
    const perm = new Int8Array(n);       // chỉ số cũ -> chỉ số mới
    const team0 = [], team1 = [];
    for (let i = 0; i < n; i++) (src.team[i] === 0 ? team0 : team1).push(i);

    // Đội hình hai bên phải cùng thành phần thì phép gương mới có nghĩa.
    const order = [...team1, ...team0];
    for (let k = 0; k < n; k++) perm[order[k]] = k;

    const copy = (arr, Ctor) => {
        const out = new Ctor(n);
        for (let i = 0; i < n; i++) out[perm[i]] = arr[i];
        return out;
    };

    m.team = new Int8Array(n);
    for (let i = 0; i < n; i++) m.team[perm[i]] = src.team[i] ^ 1;

    m.row = new Int8Array(n);
    m.col = new Int8Array(n);
    for (let i = 0; i < n; i++) {
        m.row[perm[i]] = src.row[i] < 0 ? -1 : (BOARD_ROWS - 1 - src.row[i]);
        m.col[perm[i]] = src.col[i] < 0 ? -1 : src.col[i];
    }

    m.hp = copy(src.hp, Int8Array);
    m.maxHp = copy(src.maxHp, Int8Array);
    m.speedX2 = copy(src.speedX2, Int8Array);
    m.baseSpeedX2 = copy(src.baseSpeedX2, Int8Array);
    m.range = copy(src.range, Int8Array);
    m.magicRange = copy(src.magicRange, Int8Array);
    m.abilities = copy(src.abilities, Uint8Array);
    m.effects = copy(src.effects, Uint8Array);
    m.lockDur = copy(src.lockDur, Int8Array);
    m.dashDur = copy(src.dashDur, Int8Array);
    m.dashValX2 = copy(src.dashValX2, Int8Array);
    m.isBase = copy(src.isBase, Uint8Array);

    m.name = new Array(n);
    m.armyType = new Array(n);
    m.unitIds = new Array(n);
    for (let i = 0; i < n; i++) {
        m.name[perm[i]] = src.name[i];
        m.armyType[perm[i]] = src.armyType[i];
        m.unitIds[perm[i]] = src.unitIds[i];
    }

    m.baseIdx = [perm[src.baseIdx[1]], perm[src.baseIdx[0]]];

    m.occ = new Int16Array(src.occ.length).fill(-1);
    for (let i = 0; i < n; i++) {
        if (m.hp[i] > 0 && m.row[i] >= 0) m.occ[m.row[i] * BOARD_COLS + m.col[i]] = i;
    }

    m.endedMask = 0;
    for (let i = 0; i < n; i++) if (src.endedMask & (1 << i)) m.endedMask |= (1 << perm[i]);

    m.roundNo = src.roundNo;
    m.priorityTeam = src.priorityTeam ^ 1;
    m.currentTeam = src.currentTeam ^ 1;

    m._undo = [];
    m._ply = 0;
    m._bfsDist = new Int16Array(src._bfsDist.length);
    m._bfsQueue = new Int16Array(src._bfsQueue.length);
    m._bfsStamp = new Int32Array(src._bfsStamp.length);
    m._bfsEpoch = 0;
    return m;
}

