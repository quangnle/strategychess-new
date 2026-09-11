// Kiểm tra tính đối xứng zero-sum của hàm lượng giá.
//
// Phép thử: lấy một thế cờ bất kỳ, dựng ảnh gương của nó (đổi phe hai bên và lật
// bàn cờ theo trục ngang), rồi yêu cầu eval(gương) === -eval(gốc). Nếu lệch thì
// trong hàm lượng giá có thiên vị ẩn cho một phe, và AI sẽ chơi lệch mà rất khó
// phát hiện bằng cách quan sát ván đấu.
//
//   node tools/test-eval.js [numPositions]

import MatchInfo from '../core-logic/match-info.js';
import GameLogic from '../core-logic/game-logic.js';
import { BOARD_COLS, BOARD_ROWS } from '../core-logic/definitions.js';
import { SearchState, ONGOING } from '../ai-processor/search/search-state.js';
import { Fields } from '../ai-processor/search/fields.js';
import { MoveGen } from '../ai-processor/search/move-gen.js';
import { Evaluator } from '../ai-processor/search/evaluate.js';

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const HEROES = ['Trezdin', 'Trarex', 'Taki', 'Ara', 'Nizza', 'Wizzi'];
const TROOPS = ['Ranger', 'Tanker', 'Assassin'];

// Ảnh gương: phe 0 <-> phe 1, hàng r -> (BOARD_ROWS-1-r).
// Vì hai đội được xếp đối xứng qua trục ngang, phép này cho ra một thế cờ hợp lệ
// giống hệt thế gốc nhưng đảo vai.
function mirror(src) {
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

const positions = parseInt(process.argv[2] || '120', 10);
const rng = mulberry32(424242);

const fields = new Fields(14);
const fieldsM = new Fields(14);
const gen = new MoveGen(14);
const evaluator = new Evaluator(14);
const moves = [], scores = [];

function evalOf(state, f) {
    f.reset();
    f.computeMasks(state);
    return evaluator.evaluate(state, f);
}

let worst = 0, worstDetail = '';
let checked = 0;
let evalUs = 0;

const BLOCKS = ['material', 'duel', 'protection', 'abilities', 'positional', 'progress'];
const blockSum = {}, blockMax = {};

for (let p = 0; p < positions; p++) {
    // Hai đội PHẢI cùng thành phần, nếu không thì ảnh gương không phải cùng một thế cờ.
    const hero = HEROES[Math.floor(rng() * HEROES.length)];
    const units = Array.from({ length: 5 }, () => TROOPS[Math.floor(rng() * TROOPS.length)]);
    const matchInfo = MatchInfo.createNewMatch(1, 'sym',
        { teamId: 'blue', teamName: 'BLUE', hero, units },
        { teamId: 'red', teamName: 'RED', hero, units });
    const gl = new GameLogic(matchInfo);
    gl.startMatch();
    const state = new SearchState(gl);

    // Thế xuất phát hoàn toàn cân bằng: eval phải đúng bằng 0.
    if (p === 0) {
        const s0 = evalOf(state, fields);
        console.log(`\n  thế xuất phát cân bằng, eval = ${s0.toFixed(6)}  ${Math.abs(s0) < 1e-6 ? 'OK' : 'FAIL'}`);
        if (Math.abs(s0) > 1e-6) worst = Math.max(worst, Math.abs(s0));
    }

    const plies = Math.floor(rng() * 24);
    for (let t = 0; t < plies && state.gameResult() === ONGOING; t++) {
        fields.reset();
        fields.computeMasks(state);
        fields.computeTurnMasks(state);
        gen.generate(state, fields, moves, scores);
        if (moves.length === 0) break;
        state.make(moves[Math.floor(rng() * moves.length)]);
    }
    if (state.gameResult() !== ONGOING) continue;

    const t0 = performance.now();
    const a = evalOf(state, fields);
    evalUs += (performance.now() - t0) * 1000;

    const b = evalOf(mirror(state), fieldsM);
    checked++;

    const diff = Math.abs(a + b);
    if (diff > worst) { worst = diff; worstDetail = `eval=${a.toFixed(4)} mirror=${b.toFixed(4)}`; }

}

// Biên độ từng khối phải đo trên ĐỘI HÌNH LỆCH NHAU. Nếu đo trên đội hình giống hệt
// (điều kiện bắt buộc của phép thử gương) thì khối đối đầu tự triệt tiêu và ta sẽ
// kết luận sai rằng nó không quan trọng.
const rng2 = mulberry32(555);
let magSamples = 0;
for (let p = 0; p < positions; p++) {
    const matchInfo = MatchInfo.createNewMatch(1, 'mag',
        {
            teamId: 'blue', teamName: 'BLUE',
            hero: HEROES[Math.floor(rng2() * HEROES.length)],
            units: Array.from({ length: 5 }, () => TROOPS[Math.floor(rng2() * TROOPS.length)])
        },
        {
            teamId: 'red', teamName: 'RED',
            hero: HEROES[Math.floor(rng2() * HEROES.length)],
            units: Array.from({ length: 5 }, () => TROOPS[Math.floor(rng2() * TROOPS.length)])
        });
    const gl = new GameLogic(matchInfo);
    gl.startMatch();
    const state = new SearchState(gl);

    const plies = Math.floor(rng2() * 30);
    for (let t = 0; t < plies && state.gameResult() === ONGOING; t++) {
        fields.reset();
        fields.computeMasks(state);
        fields.computeTurnMasks(state);
        gen.generate(state, fields, moves, scores);
        if (moves.length === 0) break;
        state.make(moves[Math.floor(rng2() * moves.length)]);
    }
    if (state.gameResult() !== ONGOING) continue;

    fields.reset();
    fields.computeMasks(state);
    const br = evaluator.breakdown(state, fields);
    magSamples++;
    for (const k of BLOCKS) {
        const d = Math.abs((br[0][k] || 0) - (br[1][k] || 0));
        blockSum[k] = (blockSum[k] || 0) + d;
        blockMax[k] = Math.max(blockMax[k] || 0, d);
    }
}

console.log(`\n  ${checked} thế cờ được kiểm tra đối xứng`);
console.log(`  sai lệch lớn nhất |eval(gốc) + eval(gương)| = ${worst.toExponential(3)}  ${worstDetail}`);
console.log(`  chi phí lượng giá ${(evalUs / Math.max(1, checked)).toFixed(1)}us / node lá`);

console.log(`\n  Biên độ chênh lệch giữa hai phe theo từng khối, trên ${magSamples} thế cờ đội hình lệch:\n`);
for (const k of BLOCKS) {
    const avg = (blockSum[k] || 0) / Math.max(1, magSamples);
    console.log(`    ${k.padEnd(12)} trung bình ${avg.toFixed(1).padStart(7)}   lớn nhất ${(blockMax[k] || 0).toFixed(1).padStart(7)}`);
}

// Tiêu chí: một mạng quân (biên độ vật chất lớn nhất) phải đáng giá hơn hẳn bất kỳ
// khối vị trí nào, nếu không AI sẽ thí quân để đổi lấy thế đứng đẹp.
const matMax = blockMax.material || 0;
const worstOther = Math.max(...BLOCKS.filter(k => k !== 'material').map(k => blockMax[k] || 0));
console.log(`\n    vật chất lớn nhất / khối phụ lớn nhất = ${(matMax / Math.max(1e-9, worstOther)).toFixed(2)}  (cần > 1.5)`);

const symOk = worst < 1e-3;
const anchorOk = matMax > worstOther * 1.5;
console.log(`\n  ${symOk ? 'ĐỐI XỨNG ZERO-SUM ĐẠT' : 'ĐỐI XỨNG KHÔNG ĐẠT'}`);
console.log(`  ${anchorOk ? 'VẬT CHẤT GIỮ VAI TRÒ MỎ NEO - ĐẠT' : 'KHỐI PHỤ LẤN ÁT VẬT CHẤT - KHÔNG ĐẠT'}\n`);
process.exit(symOk && anchorOk ? 0 : 1);
