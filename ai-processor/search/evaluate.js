// Hàm lượng giá. Luôn trả về điểm nhìn từ phe 0, theo quy ước zero-sum: điểm phe 0
// trừ điểm phe 1, tính bằng ĐÚNG MỘT đoạn code cho cả hai phe. Nhờ vậy không thể
// có thiên vị ẩn cho một bên, và tools/test-eval.js kiểm chứng được điều đó.
//
// Năm khối, mỗi khối có hệ số tỉ lệ riêng:
//   1. Vật chất  - quân và Base. Đây là MỎ NEO, mọi khối khác chỉ được là gia giảm.
//   2. Đối đầu   - vòng khắc chế, lấy trung bình có trọng số chứ không cộng dồn
//   3. Bảo vệ    - mối đe doạ đang treo và quyền kiểm soát ô tiếp cận
//   4. Kỹ năng   - adjacency lock, LOCK, heal, sacrifice, suicide, berserk
//   5. Vị trí    - sức ép lên Base địch, cự ly quân tầm xa, nhịp movement point
//
// Việc tách hệ số tỉ lệ ra riêng là có chủ ý: tools/test-eval.js đo được biên độ
// thực tế của từng khối, nên ta biết chắc không khối phụ nào lấn át vật chất.

import { BOARD_COLS, BOARD_ROWS } from '../../core-logic/definitions.js';
import {
    AB_ADJACENT_PENALTY, AB_HEAL, AB_SACRIFICE, AB_SUICIDE, AB_BERSERK,
    EF_ADJACENT_PENALTY, EF_LOCK
} from './search-state.js';
import { duelRaw, duelProximity } from './matchup.js';
import { WEIGHTS } from './weights.js';
import { popcount } from './move-gen.js';
import { UNREACHABLE } from './fields.js';

const BASE_MAX_HP = 7;

export class Evaluator {
    constructor(n, weights = WEIGHTS) {
        this.n = n;
        this.W = weights;
        this._value = new Float32Array(n);
        this._teamMask = [0, 0];
        this._trace = null;
    }

    setWeights(w) { this.W = w; }

    evaluate(state, fields) {
        this._prepare(state, fields);
        return this._sideScore(state, fields, 0) - this._sideScore(state, fields, 1);
    }

    // Phân tích từng khối cho cả hai phe. Chỉ dùng cho test và gỡ lỗi.
    breakdown(state, fields) {
        this._prepare(state, fields);
        const out = {};
        for (const t of [0, 1]) {
            this._trace = {};
            out[t] = this._trace;
            this._sideScore(state, fields, t);
        }
        this._trace = null;
        return out;
    }

    _prepare(state, fields) {
        fields.computeEscape(state);
        for (let i = 0; i < state.n; i++) {
            if (state.hp[i] > 0 && !state.isBase[i]) fields.ensureField(state, i);
        }

        let mask0 = 0, mask1 = 0;
        for (let i = 0; i < state.n; i++) {
            this._value[i] = 0;
            if (state.hp[i] <= 0) continue;
            if (state.team[i] === 0) mask0 |= (1 << i); else mask1 |= (1 << i);
            if (!state.isBase[i]) this._value[i] = this._unitValue(state, i);
        }
        this._teamMask[0] = mask0;
        this._teamMask[1] = mask1;
    }

    // Giá trị một quân. Mọi đòn đánh đều gây đúng 1 damage nên SỨC ĐÁNH không giảm
    // theo máu: Ranger 1/2 máu bắn hệt Ranger 2/2. Chỉ độ bền là giảm. Vì thế giá trị
    // tách làm hai phần: phần "còn sống là còn nguy hiểm" (kappa) và phần độ bền.
    // Bậc nhảy tại điểm chết chính là kill bonus, không cần code riêng.
    _unitValue(state, i) {
        const W = this.W;
        const P = W.unitValue[state.name[i]] ?? 100;
        return P * (W.kappa + (1 - W.kappa) * state.hp[i] / state.maxHp[i]);
    }

    // Phe t còn phương tiện hồi máu không. Còn thì sát thương chưa giết được ai chỉ
    // là tổn thất tạm thời, phải chiết khấu. Áp dụng cho cả máu Base.
    _repairCapacity(state, t) {
        let best = 0;
        for (let i = 0; i < state.n; i++) {
            if (state.team[i] !== t || state.hp[i] <= 0) continue;
            if (state.abilities[i] & AB_HEAL) return 1;
            if ((state.abilities[i] & AB_SACRIFICE) && state.hp[i] > 1) best = 0.6;
        }
        return best;
    }

    _sideScore(state, fields, t) {
        const W = this.W;
        const o = t ^ 1;
        const myMask = this._teamMask[t];
        const enemyMask = this._teamMask[o];
        const repair = this._repairCapacity(state, t);
        const keep = 1 - repair * W.baseRepairDiscount; // phần tổn thất thực sự mất

        const myBase = state.baseIdx[t];
        const enemyBase = state.baseIdx[o];
        const baseHp = Math.max(0, Math.min(BASE_MAX_HP, state.hp[myBase]));

        // ============================================================ 1. vật chất
        let material = 0;
        for (let i = 0; i < state.n; i++) {
            if (state.team[i] !== t || state.hp[i] <= 0 || state.isBase[i]) continue;
            const full = W.unitValue[state.name[i]] ?? 100;
            material += full - (full - this._value[i]) * keep;
        }
        const baseFull = W.baseValueByHp[BASE_MAX_HP];
        material += baseFull - (baseFull - W.baseValueByHp[baseHp]) * keep;

        // ============================================================ 2. đối đầu
        // Trung bình CÓ TRỌNG SỐ theo mức liên quan, không phải tổng. Cộng dồn 36 cặp
        // sẽ cho ra con số hàng nghìn, lấn át hoàn toàn khối vật chất và khiến AI sẵn
        // sàng thí quân để đổi lấy một thế đứng đẹp vô nghĩa.
        let duel = 0;
        for (let a = 0; a < state.n; a++) {
            if (state.team[a] !== t || state.hp[a] <= 0 || state.isBase[a]) continue;
            let num = 0, den = 0;
            for (let d = 0; d < state.n; d++) {
                if (state.team[d] === t || state.hp[d] <= 0 || state.isBase[d]) continue;
                let pathDist = fields.distToUnit(state, a, d);
                if (pathDist >= UNREACHABLE) pathDist = 60;
                const w = duelProximity(state, W, a, d, pathDist);
                num += w * duelRaw(state, W, a, d, fields.escape[a]);
                den += w;
            }
            if (den > 0) duel += num / den;
        }

        // ============================================================ 3. bảo vệ
        let protection = 0;
        for (let v = 0; v < state.n; v++) {
            if (state.team[v] !== t || state.hp[v] <= 0) continue;
            const cell = state.idx(v);
            const threats = popcount(fields.threatNow[cell] & enemyMask);
            if (threats === 0) continue;

            if (state.isBase[v]) {
                protection -= threats * W.baseThreatPenalty;
                continue;
            }

            const importance = this._value[v] / 100;
            protection -= threats * W.threatPerEnemy * importance;
            if (state.hp[v] === 1) protection -= W.threatOnLowHp;

            // Bàn cờ trống trơn nên chắn bằng thân là yếu. Chặn thật sự là kiểm soát
            // nhúm ô mà địch BẮT BUỘC phải đứng vào mới đánh được quân này.
            let total = 0, denied = 0;
            const r = state.row[v], c = state.col[v];
            for (let k = 0; k < 4; k++) {
                const nr = r + (k === 0 ? -1 : k === 1 ? 1 : 0);
                const nc = c + (k === 2 ? -1 : k === 3 ? 1 : 0);
                if (nr < 0 || nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS) continue;
                total++;
                const ap = nr * BOARD_COLS + nc;
                const occupant = state.occ[ap];
                if ((occupant !== -1 && state.team[occupant] === t) ||
                    (fields.coverMask[ap] & myMask & ~(1 << v)) !== 0) denied++;
            }
            if (total > 0) protection += (denied / total) * W.approachControl * importance;
        }

        for (let e = 0; e < state.n; e++) {
            if (state.team[e] === t || state.hp[e] !== 1 || state.isBase[e]) continue;
            if ((fields.coverMask[state.idx(e)] & myMask) !== 0) protection += W.killableBonus;
        }

        // ============================================================ 4. kỹ năng
        let abilities = 0;
        for (let e = 0; e < state.n; e++) {
            if (state.team[e] === t || state.hp[e] <= 0) continue;
            // cung thủ địch bị ép sát thì coi như mất khả năng chiến đấu
            if (state.effects[e] & EF_ADJACENT_PENALTY) {
                abilities += (W.unitValue[state.name[e]] ?? 100) * W.adjacencyLockBonus;
            }
            if (state.effects[e] & EF_LOCK) {
                const dependence = (state.range[e] >= 3 ? 1 : 0.5) + state.currentSpeedX2(e) / 22;
                abilities += W.lockValue * dependence * (1 + state.lockDur[e]);
            }
        }

        for (let i = 0; i < state.n; i++) {
            if (state.team[i] !== t || state.hp[i] <= 0) continue;

            if (state.abilities[i] & AB_HEAL) {
                for (let j = 0; j < state.n; j++) {
                    if (state.team[j] !== t || state.hp[j] <= 0 || state.hp[j] >= state.maxHp[j]) continue;
                    if (state.distUnits(i, j) <= state.magicRange[i]) { abilities += W.healPotential; break; }
                }
            }

            if ((state.abilities[i] & AB_SACRIFICE) && state.hp[i] > 1) {
                for (let j = 0; j < state.n; j++) {
                    if (j === i || state.team[j] !== t || state.hp[j] <= 0) continue;
                    if (state.hp[j] < state.maxHp[j] && state.distUnits(i, j) === 1) { abilities += W.sacrificePotential; break; }
                }
            }

            // Nizza 1 máu đứng giữa đám địch là một quả bom hẹn giờ
            if ((state.abilities[i] & AB_SUICIDE) && state.hp[i] === 1) {
                let net = 0;
                for (let j = 0; j < state.n; j++) {
                    if (j === i || state.hp[j] <= 0) continue;
                    if (Math.abs(state.row[j] - state.row[i]) <= 1 && Math.abs(state.col[j] - state.col[i]) <= 1) {
                        net += state.team[j] === t ? -1 : 1;
                    }
                }
                if (net > 0) abilities += net * W.suicideThreat;
            }

            if (state.abilities[i] & AB_BERSERK) {
                let allies = 0;
                for (let j = 0; j < state.n; j++) {
                    if (state.team[j] === t && state.hp[j] > 0 && !state.isBase[j]) allies++;
                }
                if (allies === 2) abilities += W.berserkPending;
            }
        }

        // Base đang mất máu thì giữ phương tiện cứu nó ở gần là đáng giá.
        if (baseHp < BASE_MAX_HP && repair > 0) {
            for (let i = 0; i < state.n; i++) {
                if (state.team[i] !== t || state.hp[i] <= 0 || state.isBase[i]) continue;
                const fixRange = (state.abilities[i] & AB_HEAL) ? state.magicRange[i]
                    : ((state.abilities[i] & AB_SACRIFICE) && state.hp[i] > 1) ? 1 : -1;
                if (fixRange >= 0 && state.distUnits(i, myBase) <= fixRange) abilities += W.baseGuardBonus;
            }
        }

        // ============================================================ 5. vị trí
        let positional = 0;
        for (let i = 0; i < state.n; i++) {
            if (state.team[i] !== t || state.hp[i] <= 0 || state.isBase[i]) continue;

            let d = fields.distToUnit(state, i, enemyBase);
            if (d >= UNREACHABLE) d = 60;
            positional -= W.advanceToBase * Math.min(d, 40) / 10;

            // Quân tầm xa nên đứng đúng rìa tầm bắn: dí sát là tự vứt lợi thế tầm,
            // đứng quá xa thì không đóng góp gì vào trận đánh.
            if (state.range[i] >= 3) {
                const e = fields.nearestEnemy[i];
                if (e >= 0) positional -= W.kiterStandoff * Math.abs(state.distUnits(i, e) - state.range[i]) / 4;
            }
        }
        positional += state.teamMovementPointX2(t) / 2 * W.tempoPerMovePoint;

        // ============================================================ đồng hồ hoà
        // Search 6 ply không bao giờ nhìn thấy round 20. Không mã hoá vào eval thì phe
        // đang hơn quân sẽ ngồi im ăn hoà thay vì kết liễu.
        const enemyBaseDamage = BASE_MAX_HP - Math.max(0, state.hp[enemyBase]);
        const progress = enemyBaseDamage * (W.baseProgressBase + W.baseProgressPerRound * state.roundNo);

        const total = material
            + duel * W.duelScale
            + protection * W.protectionScale
            + abilities * W.abilityScale
            + positional * W.positionalScale
            + progress;

        if (this._trace) {
            this._trace.material = material;
            this._trace.duel = duel * W.duelScale;
            this._trace.protection = protection * W.protectionScale;
            this._trace.abilities = abilities * W.abilityScale;
            this._trace.positional = positional * W.positionalScale;
            this._trace.progress = progress;
            this._trace.total = total;
        }

        return total;
    }
}
