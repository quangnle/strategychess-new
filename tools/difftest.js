// Differential test: chạy song song GameLogic (luật chính thức) và SearchState
// (bản sao phẳng của engine) trên cùng một chuỗi nước đi ngẫu nhiên, rồi so từng
// trường sau mỗi lượt. Bất kỳ sai lệch nào cũng có nghĩa engine đang tìm kiếm
// trên một trò chơi khác với trò chơi thật.
//
//   node tools/difftest.js [numGames]

import MatchInfo from '../core-logic/match-info.js';
import GameLogic from '../core-logic/game-logic.js';
import { LOCK, ADJACENT_PENALTY, HEAL, SACRIFICE, SUICIDE } from '../core-logic/definitions.js';
import {
    SearchState, encodeMove, NO_DEST,
    ACT_NONE, ACT_ATTACK, ACT_HEAL, ACT_SACRIFICE, ACT_SUICIDE,
    EF_ADJACENT_PENALTY, EF_LOCK, EF_DASH, EF_SUICIDE,
    ONGOING, describeMove
} from '../ai-processor/search/search-state.js';
import { BOARD_COLS } from '../core-logic/definitions.js';

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

// Sinh một nước đi ngẫu nhiên hợp lệ, mô tả theo chỉ số của SearchState.
function randomMove(ss, rng) {
    const candidates = [];
    for (let i = 0; i < ss.n; i++) {
        if (ss.team[i] !== ss.currentTeam || ss.hp[i] <= 0 || ss.isBase[i]) continue;
        if (ss.endedMask & (1 << i)) continue;
        candidates.push(i);
    }
    if (candidates.length === 0) return null;

    const i = candidates[Math.floor(rng() * candidates.length)];
    const locked = (ss.effects[i] & EF_LOCK) !== 0;

    let dest = NO_DEST;
    if (!locked) {
        const cells = ss.reachableCells(i);
        if (cells.length > 0 && rng() < 0.8) dest = cells[Math.floor(rng() * cells.length)];
    }

    const at = dest === NO_DEST ? ss.idx(i) : dest;

    // Adjacency penalty được cập nhật ngay khi di chuyển, nên phải mô phỏng ở đây
    // đúng như makeMove làm, trước khi quyết định có tấn công được không.
    let penalized = (ss.effects[i] & EF_ADJACENT_PENALTY) !== 0;
    if (!penalized && (ss.abilities[i] & 1)) {
        const r = (at / BOARD_COLS) | 0, c = at - r * BOARD_COLS;
        for (let j = 0; j < ss.n; j++) {
            if (ss.team[j] === ss.team[i] || ss.hp[j] <= 0) continue;
            if (Math.abs(ss.row[j] - r) + Math.abs(ss.col[j] - c) === 1) { penalized = true; break; }
        }
    }

    const options = [{ action: ACT_NONE, target: 0 }];

    if (!penalized) {
        for (const j of ss.enemiesWithinRangeFrom(i, at, ss.range[i])) {
            options.push({ action: ACT_ATTACK, target: j });
        }
    }
    if (ss.abilities[i] & 16) { // HEAL
        for (const j of ss.alliesWithinRangeFrom(i, at, ss.magicRange[i])) {
            if (ss.hp[j] < ss.maxHp[j]) options.push({ action: ACT_HEAL, target: j });
        }
    }
    if ((ss.abilities[i] & 2) && ss.hp[i] > 1) { // SACRIFICE
        const r = (at / BOARD_COLS) | 0, c = at - r * BOARD_COLS;
        for (let j = 0; j < ss.n; j++) {
            if (j === i || ss.team[j] !== ss.team[i] || ss.hp[j] <= 0) continue;
            if (ss.hp[j] >= ss.maxHp[j]) continue;
            if (Math.abs(ss.row[j] - r) + Math.abs(ss.col[j] - c) === 1) options.push({ action: ACT_SACRIFICE, target: j });
        }
    }
    if ((ss.abilities[i] & 32) && ss.hp[i] === 1) { // SUICIDE
        options.push({ action: ACT_SUICIDE, target: 0 });
    }

    const pick = options[Math.floor(rng() * options.length)];
    return encodeMove(i, dest, pick.action, pick.target);
}

function applyToGameLogic(gl, ss, move) {
    const i = move & 0xf;
    const dest = (move >> 4) & 0xff;
    const action = (move >> 12) & 0x7;
    const target = (move >> 15) & 0xf;

    const all = gl._getAllUnits();
    const unit = all.find(u => u.id === ss.unitIds[i]);
    const targetUnit = all.find(u => u.id === ss.unitIds[target]);

    gl.currentTurnUnit = unit;

    if (dest !== NO_DEST) {
        const row = (dest / BOARD_COLS) | 0;
        const col = dest - row * BOARD_COLS;
        if (!gl.makeMove(unit, row, col)) throw new Error(`GameLogic từ chối nước đi tới (${row},${col}) của ${unit.name}`);
    }

    switch (action) {
        case ACT_ATTACK: if (!gl.makeAttack(unit, targetUnit)) throw new Error(`GameLogic từ chối attack ${unit.name} -> ${targetUnit.name}`); break;
        case ACT_HEAL: if (!gl.makeHeal(unit, targetUnit)) throw new Error(`GameLogic từ chối heal`); break;
        case ACT_SACRIFICE: if (!gl.makeSacrifice(unit, targetUnit)) throw new Error(`GameLogic từ chối sacrifice`); break;
        case ACT_SUICIDE: if (!gl.makeSuicide(unit)) throw new Error(`GameLogic từ chối suicide`); break;
        default: break;
    }

    gl.newTurn();
}

function effectMaskOf(unit) {
    let m = 0;
    for (const e of unit.effects) {
        if (e.name === ADJACENT_PENALTY) m |= EF_ADJACENT_PENALTY;
        if (e.name === LOCK) m |= EF_LOCK;
        if (e.name === 'dash') m |= EF_DASH;
        if (e.name === SUICIDE) m |= EF_SUICIDE;
    }
    return m;
}

function compare(gl, ss, ctx) {
    const all = [...gl.matchInfo.team1.units, ...gl.matchInfo.team2.units];
    const problems = [];

    for (let i = 0; i < ss.n; i++) {
        const u = all[i];
        if (u.id !== ss.unitIds[i]) problems.push(`thứ tự unit lệch tại ${i}`);
        if (u.hp !== ss.hp[i]) problems.push(`${u.name}: hp ${u.hp} vs ${ss.hp[i]}`);

        const glRow = u.hp > 0 ? u.row : -1;
        const glCol = u.hp > 0 ? u.col : -1;
        if (glRow !== ss.row[i] || glCol !== ss.col[i]) {
            problems.push(`${u.name}: pos (${glRow},${glCol}) vs (${ss.row[i]},${ss.col[i]})`);
        }

        if (Math.round(u.speed * 2) !== ss.speedX2[i]) problems.push(`${u.name}: speed ${u.speed} vs ${ss.speedX2[i] / 2}`);

        const em = effectMaskOf(u);
        if (em !== ss.effects[i]) problems.push(`${u.name}: effects ${em.toString(2)} vs ${ss.effects[i].toString(2)}`);

        const lock = u.effects.find(e => e.name === LOCK);
        if ((lock ? lock.duration : 0) !== ss.lockDur[i] && (em & EF_LOCK)) {
            problems.push(`${u.name}: lockDur ${lock?.duration} vs ${ss.lockDur[i]}`);
        }

        const glEnded = gl.hasEndedTurn(u);
        const ssEnded = (ss.endedMask & (1 << i)) !== 0;
        if (glEnded !== ssEnded) problems.push(`${u.name}: endedTurn ${glEnded} vs ${ssEnded}`);
    }

    if (gl.roundNo !== ss.roundNo) problems.push(`roundNo ${gl.roundNo} vs ${ss.roundNo}`);

    const glPriority = gl.priorityTeamId === gl.matchInfo.team1.teamId ? 0 : 1;
    if (glPriority !== ss.priorityTeam) problems.push(`priorityTeam ${glPriority} vs ${ss.priorityTeam}`);

    const glCurrent = gl.currentTurnTeamId === gl.matchInfo.team1.teamId ? 0 : 1;
    if (glCurrent !== ss.currentTeam) problems.push(`currentTeam ${glCurrent} vs ${ss.currentTeam}`);

    if (gl.isGameEnd() !== ss.gameResult()) problems.push(`result ${gl.isGameEnd()} vs ${ss.gameResult()}`);

    if (problems.length) {
        throw new Error(`Lệch trạng thái sau ${ctx}:\n  - ${problems.join('\n  - ')}`);
    }
}

// Kiểm tra unmake khôi phục đúng trạng thái trước đó.
function checkUnmake(ss, move) {
    const before = snapshotOf(ss);
    ss.make(move);
    ss.unmake();
    const after = snapshotOf(ss);
    for (const key of Object.keys(before)) {
        if (before[key] !== after[key]) {
            throw new Error(`unmake không khôi phục đúng trường "${key}": ${before[key]} vs ${after[key]}`);
        }
    }
}

function snapshotOf(ss) {
    return {
        row: ss.row.join(','), col: ss.col.join(','), hp: ss.hp.join(','),
        speedX2: ss.speedX2.join(','), abilities: ss.abilities.join(','),
        effects: ss.effects.join(','), lockDur: ss.lockDur.join(','),
        dashDur: ss.dashDur.join(','), dashValX2: ss.dashValX2.join(','),
        occ: ss.occ.join(','), endedMask: ss.endedMask, roundNo: ss.roundNo,
        priorityTeam: ss.priorityTeam, currentTeam: ss.currentTeam
    };
}

function runOne(seed) {
    const rng = mulberry32(seed);
    const matchInfo = MatchInfo.createNewMatch(1, 'diff',
        randomRoster(rng, 'blue', 'BLUE'), randomRoster(rng, 'red', 'RED'));
    const gl = new GameLogic(matchInfo);
    gl.startMatch();

    const ss = new SearchState(gl);
    compare(gl, ss, 'khởi tạo');

    let turns = 0;
    while (ss.gameResult() === ONGOING && turns < 400) {
        const move = randomMove(ss, rng);
        if (!move && move !== 0) break;

        checkUnmake(ss, move);

        const desc = describeMove(ss, move);
        applyToGameLogic(gl, ss, move);
        ss.make(move);
        turns++;
        compare(gl, ss, `lượt ${turns} (${desc})`);
    }
    return turns;
}

const games = parseInt(process.argv[2] || '200', 10);
let totalTurns = 0;
for (let s = 1; s <= games; s++) {
    try {
        totalTurns += runOne(s * 7919);
    } catch (err) {
        console.error(`\nFAIL tại seed ${s}:\n${err.message}\n`);
        process.exit(1);
    }
}
console.log(`difftest OK: ${games} ván, ${totalTurns} lượt, SearchState khớp GameLogic từng trường một.`);
