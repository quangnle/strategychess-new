// Tinh chỉnh trọng số bằng self-play, và đo cân bằng hero.
//
//   node tools/tune.js --mode spsa    --iters 30 --games 8 --depth 2
//   node tools/tune.js --mode balance --games 60 --depth 2
//   node tools/tune.js --mode verify  --games 24 --depth 3
//
// SPSA (Simultaneous Perturbation Stochastic Approximation) được chọn thay vì
// dò từng tham số một vì ta có ~30 tham số: dò tuần tự cần O(n) trận cho mỗi
// bước, SPSA chỉ cần 2 trận bất kể n lớn bao nhiêu.
//
// Điểm mấu chốt: hai ứng viên theta+ và theta- đánh TRỰC TIẾP với nhau chứ không
// ai cũng đánh với một baseline cố định. Hiệu số của hai phép đo nhiễu độc lập
// thì nhiễu cộng dồn; đánh trực tiếp thì mỗi ván đã tự nó là một phép so sánh.

import fs from 'node:fs';
import { runMatch, mulberry32, RESULT } from './selfplay.js';
import { WEIGHTS, TUNABLE_SCALARS, cloneWeights } from '../ai-processor/search/weights.js';
import { SearchAgent } from '../ai-processor/search/index.js';

const HEROES = ['Trezdin', 'Trarex', 'Taki', 'Ara', 'Nizza', 'Wizzi'];
const TROOPS = ['Ranger', 'Tanker', 'Assassin'];

// Biên an toàn cho những tham số CÓ ý nghĩa là tỷ lệ, nên bắt buộc nằm trong [0,1].
// Mọi tham số khác dùng biên tương đối quanh giá trị gốc. Đừng thêm vào đây thứ chỉ
// "trông giống tỷ lệ": engagementFalloff = 9 là khoảng cách tính bằng ô, không phải tỷ lệ.
const BOUNDS = {
    kappa: [0.05, 0.95],
    baseRepairDiscount: [0, 1]
};
const DEFAULT_LO = 0.25;   // nhân với giá trị gốc
const DEFAULT_HI = 4.0;

function boundsFor(key, base) {
    if (BOUNDS[key]) return BOUNDS[key];
    const lo = base >= 0 ? base * DEFAULT_LO : base * DEFAULT_HI;
    const hi = base >= 0 ? base * DEFAULT_HI : base * DEFAULT_LO;
    return [Math.min(lo, hi), Math.max(lo, hi)];
}

function randomRoster(rng, teamId, teamName) {
    return {
        teamId, teamName,
        hero: HEROES[Math.floor(rng() * HEROES.length)],
        units: Array.from({ length: 5 }, () => TROOPS[Math.floor(rng() * TROOPS.length)])
    };
}

function makeSearchFactory(weights, depth) {
    // timeMs khổng lồ để depth là ràng buộc duy nhất -> kết quả tất định, hai ứng
    // viên được so trên đúng cùng một khối lượng tính toán chứ không phải cùng
    // một khoảng thời gian (thời gian thì phụ thuộc tải máy).
    return (gl) => new SearchAgent(gl, { weights, timeMs: 1e9, maxDepth: depth });
}

// Đánh `games` ván ghép cặp giữa hai bộ trọng số. Trả về điểm của A trong [-1,1].
function duel(weightsA, weightsB, { games, depth, seed }) {
    const rng = mulberry32(seed);
    const facA = makeSearchFactory(weightsA, depth);
    const facB = makeSearchFactory(weightsB, depth);

    let aWins = 0, bWins = 0, draws = 0;
    const pairs = Math.max(1, Math.ceil(games / 2));
    let played = 0;

    for (let p = 0; p < pairs; p++) {
        const blueRoster = randomRoster(rng, 'blue', 'BLUE');
        const redRoster = randomRoster(rng, 'red', 'RED');

        for (const aIsBlue of [true, false]) {
            if (played >= games) break;
            const res = runMatch(
                aIsBlue ? facA : facB,
                aIsBlue ? facB : facA,
                { blueRoster, redRoster }
            );
            played++;

            const aSide = aIsBlue ? RESULT.TEAM1 : RESULT.TEAM2;
            if (res.result === RESULT.DRAW || res.result === RESULT.ONGOING) draws++;
            else if (res.result === aSide) aWins++;
            else bWins++;
        }
    }

    return { score: (aWins - bWins) / played, aWins, bWins, draws, played };
}

// ------------------------------------------------------------------- SPSA
function runSpsa(opts) {
    const { iters, games, depth, seed, out } = opts;

    const keys = TUNABLE_SCALARS.filter(k => typeof WEIGHTS[k] === 'number');
    const base = keys.map(k => WEIGHTS[k]);
    const bounds = keys.map((k, i) => boundsFor(k, base[i]));

    // Làm việc trên toạ độ tương đối theta = giá trị / giá trị gốc. Nhờ vậy một
    // bước đi cùng độ lớn tác động ngang nhau lên cả lockValue (34) lẫn kappa (0.4).
    let theta = keys.map(() => 1);

    const a = opts.a ?? 0.12;      // độ lớn bước đi
    const c = opts.c ?? 0.08;      // độ lớn phép nhiễu
    const A = Math.max(1, iters * 0.1);
    const alpha = 0.602, gamma = 0.101;   // số mũ chuẩn của Spall

    const rng = mulberry32(seed ^ 0x5bd1e995);
    const history = [];

    const toWeights = (th) => {
        const w = cloneWeights(WEIGHTS);
        for (let i = 0; i < keys.length; i++) {
            const v = th[i] * base[i];
            w[keys[i]] = Math.min(bounds[i][1], Math.max(bounds[i][0], v));
        }
        return w;
    };

    // theta = 1 phải tái tạo đúng weights.js. Nếu một biên bị đặt sai (ví dụ coi một
    // khoảng cách tính bằng ô là tỷ lệ [0,1]) thì SPSA sẽ âm thầm khởi động từ một bộ
    // trọng số đã hỏng và mọi số đo sau đó đều vô nghĩa.
    const identity = toWeights(theta);
    const drift = keys.filter(k => identity[k] !== WEIGHTS[k]);
    if (drift.length) {
        throw new Error(`biên chặn sai giá trị gốc của: ${drift.map(k => `${k} (${WEIGHTS[k]} -> ${identity[k]})`).join(', ')}`);
    }

    console.log(`\nSPSA: ${keys.length} tham số, ${iters} vòng, ${games} ván/vòng, depth ${depth}`);
    console.log(`  a=${a} c=${c} alpha=${alpha} gamma=${gamma}\n`);

    const t0 = performance.now();

    for (let k = 0; k < iters; k++) {
        const ak = a / Math.pow(A + k + 1, alpha);
        const ck = c / Math.pow(k + 1, gamma);

        // Bernoulli ±1: phân phối duy nhất thoả điều kiện hội tụ của SPSA mà vẫn
        // rẻ; phân phối chuẩn sẽ vi phạm vì 1/delta có kỳ vọng vô hạn.
        const delta = keys.map(() => (rng() < 0.5 ? -1 : 1));

        const thPlus = theta.map((t, i) => t + ck * delta[i]);
        const thMinus = theta.map((t, i) => t - ck * delta[i]);

        // Đổi seed mỗi vòng để không overfit vào một tập đội hình cố định.
        const r = duel(toWeights(thPlus), toWeights(thMinus), {
            games, depth, seed: (seed + k * 7919) | 0
        });

        // y > 0 nghĩa là theta+ mạnh hơn -> đi theo hướng +delta.
        for (let i = 0; i < keys.length; i++) {
            const g = r.score / (2 * ck * delta[i]);
            theta[i] = theta[i] + ak * g;
            const lo = bounds[i][0] / base[i], hi = bounds[i][1] / base[i];
            theta[i] = Math.min(Math.max(theta[i], Math.min(lo, hi)), Math.max(lo, hi));
        }

        const el = (performance.now() - t0) / 1000;
        console.log(`  vòng ${String(k + 1).padStart(3)}/${iters}  y=${r.score.toFixed(3).padStart(6)}  (+${r.aWins}/-${r.bWins}/=${r.draws})  ak=${ak.toFixed(4)}  ${el.toFixed(0)}s`);
        history.push({ iter: k + 1, y: r.score, theta: theta.slice() });
    }

    const tuned = toWeights(theta);

    console.log('\n  thay đổi lớn nhất so với trọng số gốc:');
    const moved = keys
        .map((k, i) => ({ k, from: base[i], to: tuned[k], rel: theta[i] }))
        .sort((x, y) => Math.abs(y.rel - 1) - Math.abs(x.rel - 1));
    for (const m of moved.slice(0, 12)) {
        console.log(`    ${m.k.padEnd(26)} ${String(m.from).padStart(8)} -> ${m.to.toFixed(3).padStart(8)}  (x${m.rel.toFixed(2)})`);
    }

    // Cửa kiểm định cuối: bộ đã tune phải đánh thắng bộ gốc trên tập đội hình
    // CHƯA từng dùng trong lúc tune, nếu không ta chỉ đang overfit vào nhiễu.
    console.log('\n  kiểm định lại với bộ gốc trên seed mới...');
    const v = duel(tuned, cloneWeights(WEIGHTS), { games: games * 3, depth, seed: (seed + 999331) | 0 });
    console.log(`  đã tune vs gốc: thắng ${v.aWins}, thua ${v.bWins}, hoà ${v.draws}  ->  điểm ${v.score.toFixed(3)}`);

    const verdict = v.score > 0.1;
    console.log(verdict
        ? '\n  KẾT LUẬN: bộ đã tune mạnh hơn, nên áp dụng.'
        : '\n  KẾT LUẬN: chưa vượt được bộ gốc một cách thuyết phục, GIỮ NGUYÊN weights.js.');

    if (out) {
        fs.writeFileSync(out, JSON.stringify({
            keys, base, theta, tuned, verify: v, history
        }, null, 2));
        console.log(`  đã ghi ${out}`);
    }
    console.log('');
}

// -------------------------------------------------------- cân bằng hero
// Engine đánh với chính nó, chỉ khác hero. Nếu một hero thắng vượt trội thì đó là
// mất cân bằng của trò chơi chứ không phải của AI, vì hai bên dùng chung trọng số.
function runBalance(opts) {
    const { games, depth, seed } = opts;
    const rng = mulberry32(seed);
    const fac = makeSearchFactory(cloneWeights(WEIGHTS), depth);

    const stat = {};
    for (const h of HEROES) stat[h] = { w: 0, l: 0, d: 0 };

    console.log(`\nCân bằng hero: engine tự đánh, ${games} ván, depth ${depth}\n`);
    const t0 = performance.now();

    // Vòng tròn đủ cặp thay vì bốc ngẫu nhiên: bốc ngẫu nhiên ở cỡ mẫu nhỏ sẽ để
    // vài hero không đánh ván nào, và bảng kết quả khi đó chỉ phản ánh việc ai được
    // bốc trúng chứ không phản ánh sức mạnh.
    const matchups = [];
    for (let i = 0; i < HEROES.length; i++) {
        for (let j = i + 1; j < HEROES.length; j++) matchups.push([HEROES[i], HEROES[j]]);
    }

    let played = 0;
    for (let cycle = 0; played < games; cycle++) {
        for (const [h1, h2] of matchups) {
            if (played >= games) break;

            // Cùng một bộ lính cho cả hai bên: cô lập biến số hero.
            const troops = Array.from({ length: 5 }, () => TROOPS[Math.floor(rng() * TROOPS.length)]);

            for (const swap of [false, true]) {
                if (played >= games) break;
                const blueHero = swap ? h2 : h1;
                const redHero = swap ? h1 : h2;

                const res = runMatch(fac, fac, {
                    blueRoster: { teamId: 'blue', teamName: 'BLUE', hero: blueHero, units: [...troops] },
                    redRoster: { teamId: 'red', teamName: 'RED', hero: redHero, units: [...troops] }
                });
                played++;

                if (res.result === RESULT.TEAM1) { stat[blueHero].w++; stat[redHero].l++; }
                else if (res.result === RESULT.TEAM2) { stat[redHero].w++; stat[blueHero].l++; }
                else { stat[blueHero].d++; stat[redHero].d++; }
            }
        }
    }

    const el = (performance.now() - t0) / 1000;
    console.log('  hero      ván   thắng   thua   hoà   tỉ lệ thắng');
    const rows = HEROES.map(h => {
        const s = stat[h];
        const n = s.w + s.l + s.d;
        return { h, n, ...s, wr: n ? (s.w + s.d * 0.5) / n : 0 };
    }).sort((a, b) => b.wr - a.wr);

    for (const r of rows) {
        console.log(`  ${r.h.padEnd(9)} ${String(r.n).padStart(3)}   ${String(r.w).padStart(4)}   ${String(r.l).padStart(4)}  ${String(r.d).padStart(4)}   ${(r.wr * 100).toFixed(1)}%`);
    }

    // Chỉ so những hero thực sự có ván; hero chưa đánh ván nào có wr = 0 sẽ giả vờ
    // là hero yếu nhất và thổi phồng chênh lệch.
    const seen = rows.filter(r => r.n > 0);
    const spread = seen.length ? seen[0].wr - seen[seen.length - 1].wr : 0;
    const minN = seen.length ? Math.min(...seen.map(r => r.n)) : 0;

    console.log(`\n  chênh lệch mạnh nhất - yếu nhất: ${(spread * 100).toFixed(1)} điểm phần trăm`);
    if (minN < 20) {
        console.log(`  Cỡ mẫu quá nhỏ (hero ít ván nhất mới có ${minN} ván) để kết luận bất cứ điều gì.`);
        console.log('  Cần ít nhất ~20 ván mỗi hero, tức --games 120 trở lên.');
    } else if (spread > 0.35) {
        console.log('  CẢNH BÁO: nghi ngờ mất cân bằng hero, cần thêm ván để khẳng định.');
    } else {
        console.log('  Chênh lệch nằm trong khoảng nhiễu ở cỡ mẫu này.');
    }
    console.log(`  tổng thời gian: ${el.toFixed(0)}s\n`);
}

// ---------------------------------------------------- xác nhận vs AI cũ
async function runVerify(opts) {
    const { games, depth, seed } = opts;
    const { LegacyAgent } = await import('./agents.js');
    const rng = mulberry32(seed);
    const fac = makeSearchFactory(cloneWeights(WEIGHTS), depth);
    const legacy = (gl) => new LegacyAgent(gl);

    let w = 0, l = 0, d = 0, played = 0;
    const pairs = Math.max(1, Math.ceil(games / 2));

    console.log(`\nXác nhận: minimax (depth ${depth}) vs AI cũ, ${games} ván ghép cặp\n`);
    const t0 = performance.now();

    for (let p = 0; p < pairs; p++) {
        const blueRoster = randomRoster(rng, 'blue', 'BLUE');
        const redRoster = randomRoster(rng, 'red', 'RED');
        for (const aIsBlue of [true, false]) {
            if (played >= games) break;
            const res = runMatch(aIsBlue ? fac : legacy, aIsBlue ? legacy : fac, { blueRoster, redRoster });
            played++;
            const aSide = aIsBlue ? RESULT.TEAM1 : RESULT.TEAM2;
            if (res.result === RESULT.DRAW || res.result === RESULT.ONGOING) d++;
            else if (res.result === aSide) w++;
            else l++;
            process.stdout.write(`\r  đã đánh ${played}/${games}  thắng ${w} thua ${l} hoà ${d}   `);
        }
    }

    const el = (performance.now() - t0) / 1000;
    const wr = (w + d * 0.5) / played;
    console.log(`\n\n  minimax thắng ${w}, thua ${l}, hoà ${d}  ->  ${(wr * 100).toFixed(1)}%`);
    console.log(wr >= 0.7 ? '  ĐẠT: minimax thắng ổn định trước AI cũ.' : '  CHƯA ĐẠT ngưỡng 70%.');
    console.log(`  tổng thời gian: ${el.toFixed(0)}s\n`);
}

function parseArgs(argv) {
    const args = { mode: 'spsa', iters: 20, games: 8, depth: 2, seed: 4242, out: null, a: null, c: null };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        if (k === '--mode') args.mode = argv[++i];
        else if (k === '--iters') args.iters = parseInt(argv[++i], 10);
        else if (k === '--games') args.games = parseInt(argv[++i], 10);
        else if (k === '--depth') args.depth = parseInt(argv[++i], 10);
        else if (k === '--seed') args.seed = parseInt(argv[++i], 10);
        else if (k === '--out') args.out = argv[++i];
        else if (k === '--a') args.a = parseFloat(argv[++i]);
        else if (k === '--c') args.c = parseFloat(argv[++i]);
    }
    if (args.a === null) delete args.a;
    if (args.c === null) delete args.c;
    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.mode === 'balance') runBalance(args);
    else if (args.mode === 'verify') await runVerify(args);
    else runSpsa(args);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
