// Sinh nước đi cho một ply (= trọn một lượt của một quân), có cắt tỉa bằng bucketing.
//
// Branching thô của game này vào khoảng 6 quân x ~50 ô x ~2 hành động = 500-600.
// Ở mức đó thì depth 6 là bất khả thi. Bucketing gom các ô có cùng "chữ ký chiến
// thuật" lại thành một, đưa ~50 ô xuống còn khoảng 8-10 ô đại diện.
//
// Chữ ký gồm 7 thành phần (A, T, P, S, X, G, K). Hai thành phần G và K tồn tại
// riêng để nước CHẶN ĐƯỜNG không bị cắt mất: G là "ô này canh vành đai tiếp cận
// của đồng đội", K là "ô này nằm trên hành lang tiến quân của địch". Nếu thiếu
// chúng thì AI sẽ không bao giờ nhìn thấy nước bịt đường, vì đứng chắn không
// trực tiếp tạo ra đòn đánh nào.

import { BOARD_COLS } from '../../core-logic/definitions.js';
import {
    encodeMove, NO_DEST,
    ACT_NONE, ACT_ATTACK, ACT_HEAL, ACT_SACRIFICE, ACT_SUICIDE, ACT_PASS,
    AB_ADJACENT_PENALTY, AB_HEAL, AB_SACRIFICE, AB_SUICIDE,
    EF_ADJACENT_PENALTY, EF_LOCK
} from './search-state.js';

export const MAX_BUCKETS = 10;

// Điểm sắp xếp sơ bộ. Alpha-beta ăn hay dở phụ thuộc gần như hoàn toàn vào việc
// nước tốt có được thử trước hay không, nên phần này quan trọng ngang hàm lượng giá.
const ORDER_KILL = 100000;
const ORDER_BASE_HIT = 40000;
const ORDER_ATTACK = 10000;
const ORDER_PIN = 3000;
const ORDER_SUPPORT = 2000;
const ORDER_GUARD = 800;
const ORDER_SAFE = 300;

export class MoveGen {
    // maxBuckets = Infinity tắt hẳn việc rút gọn ứng viên. Chỉ dùng cho test: khi
    // tắt bucketing thì bộ tìm kiếm phải đối xứng TUYỆT ĐỐI, nhờ vậy ta tách bạch
    // được "alpha-beta thiên vị một phe" (lỗi thật) với "bucketing chọn ô đại diện
    // khác nhau ở hai bản gương" (hệ quả cố hữu của một heuristic có mất mát).
    constructor(n, maxBuckets = MAX_BUCKETS) {
        this.n = n;
        this.maxBuckets = maxBuckets;
        this._cells = [];
        this._reach = [];
        this._bucketMap = new Map();
        this._cands = [];
    }

    // Trả về số nước đi đã ghi vào moves/scores (hai mảng song song).
    generate(state, fields, moves, scores) {
        moves.length = 0;
        scores.length = 0;

        const team = state.currentTeam;
        let allyMask = 0, enemyMask = 0;
        for (let i = 0; i < state.n; i++) {
            if (state.hp[i] <= 0) continue;
            if (state.team[i] === team) allyMask |= (1 << i); else enemyMask |= (1 << i);
        }

        const myBase = state.baseIdx[team];
        const enemyBase = state.baseIdx[team ^ 1];

        for (let i = 0; i < state.n; i++) {
            if (state.team[i] !== team || state.hp[i] <= 0 || state.isBase[i]) continue;
            if (state.endedMask & (1 << i)) continue;
            this._genForUnit(state, fields, i, allyMask, enemyMask, myBase, enemyBase, moves, scores);
        }

        if (moves.length === 0) {
            // Không quân nào đi được: sinh một nước bỏ lượt để round vẫn tiến triển.
            for (let i = 0; i < state.n; i++) {
                if (state.team[i] === team && state.hp[i] > 0 && !state.isBase[i] && !(state.endedMask & (1 << i))) {
                    moves.push(encodeMove(i, NO_DEST, ACT_PASS, 0));
                    scores.push(0);
                    break;
                }
            }
        }

        return moves.length;
    }

    _genForUnit(state, fields, i, allyMask, enemyMask, myBase, enemyBase, moves, scores) {
        const locked = (state.effects[i] & EF_LOCK) !== 0;
        const selfBit = 1 << i;

        // ứng viên ô: luôn có ô đang đứng, cộng các ô đi tới được nếu không bị khoá
        const cells = this._cells;
        cells.length = 0;
        cells.push(state.idx(i));
        if (!locked) {
            const reach = state.reachableCells(i, this._reach);
            for (let k = 0; k < reach.length; k++) cells.push(reach[k]);
        }

        const kept = this._bucketCells(state, fields, i, cells, allyMask, enemyMask, myBase, selfBit);

        for (let k = 0; k < kept.length; k++) {
            this._genActionsAt(state, i, kept[k], enemyBase, moves, scores);
        }
    }

    // Gom ô theo chữ ký rồi chọn đại diện, có bảo hiểm cho các loại nước dễ bị cắt nhầm.
    _bucketCells(state, fields, i, cells, allyMask, enemyMask, myBase, selfBit) {
        const map = this._bucketMap;
        const cands = this._cands;
        map.clear();
        cands.length = 0;

        const range = state.range[i];
        const hasAdjPenalty = (state.abilities[i] & AB_ADJACENT_PENALTY) !== 0;
        const alreadyPenalized = (state.effects[i] & EF_ADJACENT_PENALTY) !== 0;
        const homeCell = state.idx(i);

        // Toàn bộ chữ ký lấy từ mặt nạ dựng sẵn: không còn vòng lặp O(n) trên từng ô.
        const attackMask = fields.rangeMaskEnemy[range];
        const healMask = (state.abilities[i] & AB_HEAL) ? fields.rangeMaskWounded[state.magicRange[i]] : null;
        const sacMask = ((state.abilities[i] & AB_SACRIFICE) && state.hp[i] > 1) ? fields.rangeMaskWounded[1] : null;
        const adjacentMask = fields.adjacentMask;
        const corridor = fields.corridor;

        for (let k = 0; k < cells.length; k++) {
            const cell = cells[k];

            const adjHere = adjacentMask[cell];
            const P = adjHere & fields.enemyAdjPenaltyMask;
            const adjacentEnemy = (adjHere & enemyMask) !== 0;

            const X = (alreadyPenalized || (hasAdjPenalty && adjacentEnemy)) ? 1 : 0;
            let A = X ? 0 : (attackMask ? attackMask[cell] : 0);

            const T = fields.threatNow[cell] & enemyMask;

            let S = 0;
            if (healMask) S |= healMask[cell];
            if (sacMask) S |= (sacMask[cell] & adjHere);
            S &= ~selfBit;

            // G: đứng ở đây thì canh được vành đai tiếp cận của đồng đội nào
            const G = adjHere & allyMask & ~selfBit;

            let K = corridor[cell];
            if (K > 2) K = 2;

            const entry = {
                cell,
                dest: cell === homeCell ? NO_DEST : cell,
                A, T, P, S, X, G, K,
                threatCount: popcount(T),
                isHome: cell === homeCell
            };

            if (this.maxBuckets === Infinity) { cands.push(entry); continue; }

            const key = hashSignature(A, T, P, S, X, G, K);
            const prev = map.get(key);
            if (prev === undefined) {
                map.set(key, cands.length);
                cands.push(entry);
            } else if (tiebreak(state, i, entry) > tiebreak(state, i, cands[prev])) {
                cands[prev] = entry;
            }
        }

        if (cands.length <= this.maxBuckets) return cands;

        // Vượt hạn mức: giữ lại theo ưu tiên, bảo đảm mỗi nhóm chiến thuật còn ít
        // nhất một đại diện. Thứ tự này chính là chỗ nước chặn đường được bảo vệ.
        const picked = [];
        const taken = new Set();
        const take = (pred) => {
            let best = -1;
            for (let k = 0; k < cands.length; k++) {
                if (taken.has(k) || !pred(cands[k])) continue;
                if (best === -1 || tiebreak(state, i, cands[k]) > tiebreak(state, i, cands[best])) best = k;
            }
            if (best !== -1) { taken.add(best); picked.push(cands[best]); }
        };

        take(e => e.A !== 0);                 // đánh được địch
        take(e => e.P !== 0);                 // khoá cung thủ địch
        take(e => e.S !== 0);                 // hỗ trợ đồng đội
        take(e => e.G !== 0);                 // canh đồng đội (bảo hiểm chặn đường)
        take(e => e.K === 2);                 // hành lang tiến quân của địch
        take(e => e.K === 1);
        take(e => e.T === 0);                 // an toàn tuyệt đối
        take(e => e.isHome);                  // đứng yên
        take(() => true);

        // còn chỗ thì lấp bằng các ô điểm cao nhất chưa chọn
        const rest = [];
        for (let k = 0; k < cands.length; k++) if (!taken.has(k)) rest.push(cands[k]);
        rest.sort((a, b) => tiebreak(state, i, b) - tiebreak(state, i, a));
        for (let k = 0; k < rest.length && picked.length < this.maxBuckets; k++) picked.push(rest[k]);

        return picked;
    }

    _genActionsAt(state, i, entry, enemyBase, moves, scores) {
        const { dest, A, S, P, T, G } = entry;

        let posScore = 0;
        if (P !== 0) posScore += ORDER_PIN * popcount(P);
        if (G !== 0) posScore += ORDER_GUARD;
        if (T === 0) posScore += ORDER_SAFE;
        posScore -= popcount(T) * 120;

        let produced = 0;

        // tấn công
        if (A !== 0) {
            for (let j = 0; j < state.n; j++) {
                if (!(A & (1 << j))) continue;
                let s = posScore + ORDER_ATTACK;
                if (state.hp[j] === 1) s += ORDER_KILL;
                if (j === enemyBase) s += ORDER_BASE_HIT + (8 - state.hp[j]) * 500;
                s += 200 - state.maxHp[j] * 10;
                moves.push(encodeMove(i, dest, ACT_ATTACK, j));
                scores.push(s);
                produced++;
            }
        }

        // heal / sacrifice
        if (S !== 0) {
            const canHeal = (state.abilities[i] & AB_HEAL) !== 0;
            const canSac = (state.abilities[i] & AB_SACRIFICE) !== 0 && state.hp[i] > 1;
            const r = dest === NO_DEST ? state.row[i] : ((dest / BOARD_COLS) | 0);
            const c = dest === NO_DEST ? state.col[i] : (dest - ((dest / BOARD_COLS) | 0) * BOARD_COLS);

            for (let j = 0; j < state.n; j++) {
                if (!(S & (1 << j))) continue;
                const d = Math.abs(state.row[j] - r) + Math.abs(state.col[j] - c);
                const missing = state.maxHp[j] - state.hp[j];
                if (canHeal && d <= state.magicRange[i]) {
                    moves.push(encodeMove(i, dest, ACT_HEAL, j));
                    scores.push(posScore + ORDER_SUPPORT + missing * 150);
                    produced++;
                }
                if (canSac && d === 1) {
                    moves.push(encodeMove(i, dest, ACT_SACRIFICE, j));
                    scores.push(posScore + ORDER_SUPPORT + missing * 100 - 200);
                    produced++;
                }
            }
        }

        // tự sát AoE của Nizza
        if ((state.abilities[i] & AB_SUICIDE) && state.hp[i] === 1) {
            const r = dest === NO_DEST ? state.row[i] : ((dest / BOARD_COLS) | 0);
            const c = dest === NO_DEST ? state.col[i] : (dest - ((dest / BOARD_COLS) | 0) * BOARD_COLS);
            let hitEnemies = 0, hitAllies = 0;
            for (let j = 0; j < state.n; j++) {
                if (j === i || state.hp[j] <= 0) continue;
                if (Math.abs(state.row[j] - r) <= 1 && Math.abs(state.col[j] - c) <= 1) {
                    if (state.team[j] === state.team[i]) hitAllies++; else hitEnemies++;
                }
            }
            if (hitEnemies > 0) {
                moves.push(encodeMove(i, dest, ACT_SUICIDE, 0));
                scores.push(posScore + hitEnemies * 1500 - hitAllies * 1500);
                produced++;
            }
        }

        // chỉ di chuyển, không hành động
        moves.push(encodeMove(i, dest, ACT_NONE, 0));
        scores.push(posScore - (produced > 0 ? 500 : 0));
    }
}

// Ưu tiên khi phải chọn một đại diện trong nhóm ô tương đương về chiến thuật.
function tiebreak(state, i, e) {
    let s = 0;
    s += popcount(e.A) * 40;
    s += popcount(e.P) * 30;
    s += popcount(e.S) * 20;
    s += popcount(e.G) * 12;
    s += e.K * 10;
    s -= e.threatCount * 25;
    s -= e.X * 35;
    if (e.isHome) s += 2;
    return s;
}

function hashSignature(A, T, P, S, X, G, K) {
    let h = 2166136261;
    h = Math.imul(h ^ A, 16777619);
    h = Math.imul(h ^ T, 16777619);
    h = Math.imul(h ^ P, 16777619);
    h = Math.imul(h ^ S, 16777619);
    h = Math.imul(h ^ (X | (K << 1)), 16777619);
    h = Math.imul(h ^ G, 16777619);
    return h | 0;
}

export function popcount(x) {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0f0f0f0f;
    return (x * 0x01010101) >> 24;
}
