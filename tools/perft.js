// Đo branching factor và kiểm tra tính hợp lệ của bộ sinh nước đi.
//
//   node tools/perft.js [numPositions]
//
// Hai việc:
//  1. So branching thô (mọi ô x mọi hành động) với branching sau bucketing, để
//     xác nhận việc cắt tỉa có đưa được ~500 xuống ~10 như thiết kế hay không.
//  2. Với mỗi nước đi sinh ra, thực thi lại trên GameLogic thật. Nếu GameLogic
//     từ chối thì bộ sinh đang tạo ra nước bất hợp lệ.

import MatchInfo from '../core-logic/match-info.js';
import GameLogic from '../core-logic/game-logic.js';
import { BOARD_COLS } from '../core-logic/definitions.js';
import {
    SearchState, NO_DEST, ONGOING,
    ACT_ATTACK, ACT_HEAL, ACT_SACRIFICE, ACT_SUICIDE, ACT_PASS,
    moveUnit, moveDest, moveAction, moveTarget, describeMove,
    EF_LOCK, EF_ADJACENT_PENALTY, AB_ADJACENT_PENALTY, AB_HEAL, AB_SACRIFICE, AB_SUICIDE
} from '../ai-processor/search/search-state.js';
import { Fields } from '../ai-processor/search/fields.js';
import { MoveGen } from '../ai-processor/search/move-gen.js';

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

function randomRoster(rng, teamId, teamName) {
    return {
        teamId, teamName,
        hero: HEROES[Math.floor(rng() * HEROES.length)],
        units: Array.from({ length: 5 }, () => TROOPS[Math.floor(rng() * TROOPS.length)])
    };
}

// Branching thô: mọi ô đi tới được x mọi hành động khả dĩ, không cắt tỉa.
function rawBranching(state) {
    let total = 0;
    for (let i = 0; i < state.n; i++) {
        if (state.team[i] !== state.currentTeam || state.hp[i] <= 0 || state.isBase[i]) continue;
        if (state.endedMask & (1 << i)) continue;

        const locked = (state.effects[i] & EF_LOCK) !== 0;
        const cells = [state.idx(i)];
        if (!locked) for (const c of state.reachableCells(i)) cells.push(c);

        for (const cell of cells) {
            const r = (cell / BOARD_COLS) | 0, c = cell - r * BOARD_COLS;
            let actions = 1; // đứng yên không làm gì

            let penalized = (state.effects[i] & EF_ADJACENT_PENALTY) !== 0;
            if (!penalized && (state.abilities[i] & AB_ADJACENT_PENALTY)) {
                for (let j = 0; j < state.n; j++) {
                    if (state.team[j] === state.team[i] || state.hp[j] <= 0) continue;
                    if (Math.abs(state.row[j] - r) + Math.abs(state.col[j] - c) === 1) { penalized = true; break; }
                }
            }
            if (!penalized) {
                for (let j = 0; j < state.n; j++) {
                    if (state.team[j] === state.team[i] || state.hp[j] <= 0) continue;
                    if (Math.abs(state.row[j] - r) + Math.abs(state.col[j] - c) <= state.range[i]) actions++;
                }
            }
            if (state.abilities[i] & AB_HEAL) {
                for (let j = 0; j < state.n; j++) {
                    if (state.team[j] !== state.team[i] || state.hp[j] <= 0 || state.hp[j] >= state.maxHp[j]) continue;
                    if (Math.abs(state.row[j] - r) + Math.abs(state.col[j] - c) <= state.magicRange[i]) actions++;
                }
            }
            if ((state.abilities[i] & AB_SACRIFICE) && state.hp[i] > 1) {
                for (let j = 0; j < state.n; j++) {
                    if (j === i || state.team[j] !== state.team[i] || state.hp[j] <= 0 || state.hp[j] >= state.maxHp[j]) continue;
                    if (Math.abs(state.row[j] - r) + Math.abs(state.col[j] - c) === 1) actions++;
                }
            }
            if ((state.abilities[i] & AB_SUICIDE) && state.hp[i] === 1) actions++;

            total += actions;
        }
    }
    return total;
}

// Thực thi một nước đi của engine trên GameLogic thật để xác nhận nó hợp lệ.
function verifyLegal(gl, state, move) {
    const i = moveUnit(move), dest = moveDest(move), action = moveAction(move), target = moveTarget(move);
    if (action === ACT_PASS) return true;

    const snapshot = gl.matchInfo.clone();
    const probe = new GameLogic(snapshot);
    probe.roundNo = gl.roundNo;
    probe.priorityTeamId = gl.priorityTeamId;
    probe.currentTurnTeamId = gl.currentTurnTeamId;
    probe.alreadyEndedTurnUnits = probe._getAllUnits().filter(u => gl.hasEndedTurn(u));

    const all = probe._getAllUnits();
    const unit = all.find(u => u.id === state.unitIds[i]);
    const targetUnit = all.find(u => u.id === state.unitIds[target]);
    probe.currentTurnUnit = unit;

    if (dest !== NO_DEST) {
        const row = (dest / BOARD_COLS) | 0;
        const col = dest - row * BOARD_COLS;
        if (!probe.makeMove(unit, row, col)) return `makeMove bị từ chối: ${describeMove(state, move)}`;
    }
    switch (action) {
        case ACT_ATTACK: if (!probe.makeAttack(unit, targetUnit)) return `makeAttack bị từ chối: ${describeMove(state, move)}`; break;
        case ACT_HEAL: if (!probe.makeHeal(unit, targetUnit)) return `makeHeal bị từ chối: ${describeMove(state, move)}`; break;
        case ACT_SACRIFICE: if (!probe.makeSacrifice(unit, targetUnit)) return `makeSacrifice bị từ chối: ${describeMove(state, move)}`; break;
        case ACT_SUICIDE: if (!probe.makeSuicide(unit)) return `makeSuicide bị từ chối: ${describeMove(state, move)}`; break;
        default: break;
    }
    return true;
}

const positions = parseInt(process.argv[2] || '150', 10);
const rng = mulberry32(20260911);

const fields = new Fields(14);
const gen = new MoveGen(14);
const moves = [], scores = [];

let rawTotal = 0, prunedTotal = 0, samples = 0;
let rawMax = 0, prunedMax = 0;
let illegal = 0;
let genUs = 0;

for (let p = 0; p < positions; p++) {
    const matchInfo = MatchInfo.createNewMatch(1, 'perft',
        randomRoster(rng, 'blue', 'BLUE'), randomRoster(rng, 'red', 'RED'));
    const gl = new GameLogic(matchInfo);
    gl.startMatch();
    let state = new SearchState(gl);

    // đi vài lượt ngẫu nhiên để thế cờ đa dạng, không chỉ đo thế xuất phát
    const plies = 1 + Math.floor(rng() * 25);
    for (let t = 0; t < plies && state.gameResult() === ONGOING; t++) {
        fields.reset();
        fields.computeMasks(state);
        fields.computeTurnMasks(state);
        gen.generate(state, fields, moves, scores);
        if (moves.length === 0) break;
        state.make(moves[Math.floor(rng() * moves.length)]);
    }
    if (state.gameResult() !== ONGOING) continue;

    fields.reset();

    const t0 = performance.now();
    fields.computeMasks(state);
    fields.computeTurnMasks(state);
    gen.generate(state, fields, moves, scores);
    genUs += (performance.now() - t0) * 1000;

    const raw = rawBranching(state);
    rawTotal += raw; prunedTotal += moves.length; samples++;
    rawMax = Math.max(rawMax, raw);
    prunedMax = Math.max(prunedMax, moves.length);

    // kiểm tra tính hợp lệ trên một mẫu con (verify qua GameLogic khá đắt)
    if (p % 10 === 0) {
        for (const m of moves) {
            const res = verifyLegal(gl_sync(gl, state), state, m);
            if (res !== true) { console.error('BẤT HỢP LỆ: ' + res); illegal++; }
        }
    }
}

// GameLogic dùng để verify phải đứng đúng ở thế cờ hiện tại của SearchState
function gl_sync(gl, state) {
    for (const u of gl._getAllUnits()) {
        const i = state.unitIds.indexOf(u.id);
        u.hp = state.hp[i];
        u.row = state.row[i] < 0 ? -Infinity : state.row[i];
        u.col = state.col[i] < 0 ? -Infinity : state.col[i];
        u.speed = state.speedX2[i] / 2;
        u.effects = [];
        if (state.effects[i] & 1) u.effects.push({ name: 'adjacent penalty' });
        if (state.effects[i] & 2) u.effects.push({ name: 'lock', duration: state.lockDur[i] });
        if (state.effects[i] & 4) u.effects.push({ name: 'dash', duration: state.dashDur[i], value: state.dashValX2[i] / 2 });
        if (state.effects[i] & 8) u.effects.push({ name: 'suicide' });
    }
    gl.roundNo = state.roundNo;
    gl.priorityTeamId = state.teamIds[state.priorityTeam];
    gl.currentTurnTeamId = state.teamIds[state.currentTeam];
    gl.currentTurnUnit = null;
    gl._resetTurnActions();
    gl.alreadyEndedTurnUnits = gl._getAllUnits().filter(u => {
        const i = state.unitIds.indexOf(u.id);
        return (state.endedMask & (1 << i)) !== 0;
    });
    return gl;
}

console.log(`\nperft: ${samples} thế cờ ngẫu nhiên\n`);
console.log(`  branching thô     trung bình ${(rawTotal / samples).toFixed(1)}   lớn nhất ${rawMax}`);
console.log(`  sau bucketing     trung bình ${(prunedTotal / samples).toFixed(1)}   lớn nhất ${prunedMax}`);
console.log(`  hệ số cắt giảm    ${(rawTotal / prunedTotal).toFixed(1)}x`);
console.log(`  chi phí sinh nước ${(genUs / samples).toFixed(1)}us / node`);
console.log(`  nước bất hợp lệ   ${illegal}\n`);

const b = prunedTotal / samples;
for (const d of [4, 6, 8]) {
    console.log(`  ước lượng node depth ${d} (alpha-beta lý tưởng b^(d/2)): ${Math.round(Math.pow(b, d / 2)).toLocaleString()}`);
}
console.log('');
