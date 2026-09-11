// Kiểm tra tính đối xứng của BỘ TÌM KIẾM (không chỉ của hàm lượng giá).
//
// Hàm lượng giá đã được chứng minh là zero-sum tuyệt đối. Nhưng nếu bản thân
// alpha-beta xử lý phe MAX và phe MIN không đều tay thì AI vẫn sẽ chơi lệch.
//
// Phép thử chạy HAI PHA, vì "đối xứng" ở đây có hai nghĩa rất khác nhau:
//
//   Pha A - tắt bucketing. Bộ tìm kiếm nhìn thấy toàn bộ nước đi, nên nó BẮT BUỘC
//           phải đối xứng tuyệt đối. Lệch một chút cũng là lỗi thật trong alpha-beta,
//           trong TT, trong LMR hoặc trong make/unmake.
//
//   Pha B - bật bucketing như lúc chạy thật. Ở đây lệch là chuyện đương nhiên: khi
//           soi gương, chỉ số của các unit bị hoán vị, nên trong số những ô có CÙNG
//           chữ ký chiến thuật, bộ rút gọn sẽ chọn ô đại diện khác. Đó là cái giá
//           của một heuristic có mất mát, không phải lỗi. Pha này chỉ canh cho độ
//           lệch không phình to ra so với mức đã biết.
//
//   node tools/test-search.js [numPositions] [depth]

import MatchInfo from '../core-logic/match-info.js';
import GameLogic from '../core-logic/game-logic.js';
import { SearchState, ONGOING } from '../ai-processor/search/search-state.js';
import { Fields } from '../ai-processor/search/fields.js';
import { MoveGen } from '../ai-processor/search/move-gen.js';
import { Minimax } from '../ai-processor/search/minimax.js';
import { mirror } from './mirror.js';

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

const positions = parseInt(process.argv[2] || '25', 10);
const depth = parseInt(process.argv[3] || '4', 10);

// Ngưỡng của pha B. Không phải con số thần thánh: nó là mức lệch đo được của
// bucketing hiện tại cộng biên an toàn. Nếu một thay đổi làm nó vọt qua ngưỡng thì
// nghĩa là việc rút gọn ứng viên vừa trở nên thiên vị hơn hẳn, cần xem lại.
const BUCKET_TOLERANCE = 80;

// Sinh sẵn một tập thế cờ để cả hai pha dùng chung, so sánh mới có nghĩa.
function buildPositions() {
    const rng = mulberry32(987654321);
    const fields = new Fields(14);
    const gen = new MoveGen(14);
    const moves = [], scores = [];
    const out = [];

    for (let p = 0; p < positions; p++) {
        const hero = HEROES[Math.floor(rng() * HEROES.length)];
        const units = Array.from({ length: 5 }, () => TROOPS[Math.floor(rng() * TROOPS.length)]);
        const matchInfo = MatchInfo.createNewMatch(1, 'symsearch',
            { teamId: 'blue', teamName: 'BLUE', hero, units },
            { teamId: 'red', teamName: 'RED', hero, units });
        const gl = new GameLogic(matchInfo);
        gl.startMatch();
        const state = new SearchState(gl);

        const plies = Math.floor(rng() * 18);
        for (let t = 0; t < plies && state.gameResult() === ONGOING; t++) {
            fields.reset();
            fields.computeMasks(state);
            fields.computeTurnMasks(state);
            gen.generate(state, fields, moves, scores);
            if (moves.length === 0) break;
            state.make(moves[Math.floor(rng() * moves.length)]);
        }
        if (state.gameResult() !== ONGOING) continue;
        out.push(state);
    }
    return out;
}

function measure(states, d, maxBuckets) {
    let worst = 0, detail = '';
    for (const state of states) {
        // TT riêng cho mỗi lần tìm, tránh kết quả của thế này rò sang thế kia.
        const opts = { ttBits: 16, maxBuckets, useLmr: process.env.LMR !== '0', useTt: process.env.TT !== '0' };
        const a = new Minimax(opts).search(state, { timeMs: 1e9, maxDepth: d });
        const b = new Minimax(opts).search(mirror(state), { timeMs: 1e9, maxDepth: d });

        const diff = Math.abs(a.score + b.score);
        if (diff > worst) {
            worst = diff;
            detail = `gốc=${a.score.toFixed(3)} (d${a.depth}) gương=${b.score.toFixed(3)} (d${b.depth})`;
        }
    }
    return { worst, detail };
}

const states = buildPositions();
let failed = false;

// -------------------------------------------------- Pha A: không bucketing
// Depth thấp hơn vì không rút gọn thì cây nước đi phình rất nhanh.
const depthA = Math.min(depth, 3);
console.log(`\n  Pha A — TẮT bucketing, ${states.length} thế cờ, depth ${depthA}`);
const a = measure(states, depthA, Infinity);
console.log(`    sai lệch lớn nhất = ${a.worst.toExponential(3)}`);
if (a.detail) console.log(`    ${a.detail}`);
if (a.worst < 1e-6) {
    console.log('    ĐẠT — alpha-beta, TT, LMR và make/unmake đều không thiên vị phe nào.');
} else {
    console.log('    KHÔNG ĐẠT — bộ tìm kiếm thiên vị một phe, đây là LỖI THẬT.');
    failed = true;
}

// -------------------------------------------------- Pha B: bucketing như thật
console.log(`\n  Pha B — BẬT bucketing (cấu hình chạy thật), ${states.length} thế cờ, depth ${depth}`);
const b = measure(states, depth, undefined);
console.log(`    sai lệch lớn nhất = ${b.worst.toFixed(1)}  (ngưỡng ${BUCKET_TOLERANCE})`);
if (b.detail) console.log(`    ${b.detail}`);
if (b.worst <= BUCKET_TOLERANCE) {
    console.log('    ĐẠT — độ lệch do bucketing vẫn nằm trong mức đã biết.');
} else {
    console.log('    KHÔNG ĐẠT — bucketing đã trở nên thiên vị hơn mức chấp nhận được.');
    failed = true;
}

console.log(`\n  ${failed ? 'KIỂM TRA ĐỐI XỨNG - KHÔNG ĐẠT' : 'KIỂM TRA ĐỐI XỨNG - ĐẠT'}\n`);
process.exit(failed ? 1 : 0);
