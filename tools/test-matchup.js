// Kiểm tra mô hình khắc chế có tái tạo đúng vòng mà người thiết kế cố ý cài vào
// hay không: Ranger > Tanker > Assassin > Ranger.
//
// Đây là bài test quan trọng nhất của phần lượng giá. Nếu vòng này không rơi ra
// từ (range, speed, hp) thì nghĩa là mô hình đang hiểu sai bản chất trò chơi, và
// mọi thứ xây bên trên đều sai theo.
//
//   node tools/test-matchup.js

import MatchInfo from '../core-logic/match-info.js';
import GameLogic from '../core-logic/game-logic.js';
import { BOARD_COLS } from '../core-logic/definitions.js';
import { SearchState } from '../ai-processor/search/search-state.js';
import { classify, duelScore, CASE_NAMES } from '../ai-processor/search/matchup.js';
import { WEIGHTS as W } from '../ai-processor/search/weights.js';

// Dựng một thế cờ chỉ gồm hai quân, đặt giữa bàn trống để hình học không thiên vị.
function duel(nameA, nameB, distance = 6) {
    const mi = MatchInfo.createNewMatch(1, 'duel',
        { teamId: 'blue', teamName: 'BLUE', hero: heroFor(nameA), units: [troopFor(nameA), 'Ranger', 'Ranger', 'Ranger', 'Ranger'] },
        { teamId: 'red', teamName: 'RED', hero: heroFor(nameB), units: [troopFor(nameB), 'Ranger', 'Ranger', 'Ranger', 'Ranger'] });
    const gl = new GameLogic(mi);
    gl.startMatch();
    const ss = new SearchState(gl);

    const a = pick(ss, 0, nameA);
    const b = pick(ss, 1, nameB);

    // xoá mọi quân khác khỏi bàn
    for (let i = 0; i < ss.n; i++) {
        if (i === a || i === b) continue;
        const c = ss.idx(i);
        if (ss.occ[c] === i) ss.occ[c] = -1;
        ss.hp[i] = 0; ss.row[i] = -1; ss.col[i] = -1;
    }
    place(ss, a, 9, 5);
    place(ss, b, 9 - distance, 5);
    return { ss, a, b };
}

const HEROES = ['Trezdin', 'Trarex', 'Taki', 'Ara', 'Nizza', 'Wizzi'];
const heroFor = (n) => HEROES.includes(n) ? n : 'Trezdin';
const troopFor = (n) => HEROES.includes(n) ? 'Ranger' : n;

function pick(ss, team, name) {
    for (let i = 0; i < ss.n; i++) if (ss.team[i] === team && ss.name[i] === name) return i;
    throw new Error(`không tìm thấy ${name}`);
}

function place(ss, i, r, c) {
    const o = ss.idx(i);
    if (ss.occ[o] === i) ss.occ[o] = -1;
    ss.row[i] = r; ss.col[i] = c; ss.occ[r * BOARD_COLS + c] = i;
}

// Ở giữa bàn trống, cả hai bên đều còn nhiều đất lùi.
const OPEN_ESCAPE = 0.5;

function score(nameA, nameB, distance = 6, escape = OPEN_ESCAPE) {
    const { ss, a, b } = duel(nameA, nameB, distance);
    return duelScore(ss, W, a, b, escape, distance);
}

function kind(nameA, nameB) {
    const { ss, a, b } = duel(nameA, nameB);
    return CASE_NAMES[classify(ss, a, b)];
}

let failures = 0;
function check(label, condition, detail) {
    const ok = !!condition;
    if (!ok) failures++;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
}

console.log('\nPhân loại thế đối đầu\n');
const pairs = [
    ['Ranger', 'Tanker'], ['Tanker', 'Ranger'],
    ['Tanker', 'Assassin'], ['Assassin', 'Tanker'],
    ['Assassin', 'Ranger'], ['Ranger', 'Assassin']
];
for (const [x, y] of pairs) {
    console.log(`  ${x.padEnd(9)} vs ${y.padEnd(9)} -> ${kind(x, y)}`);
}

console.log('\nVòng khắc chế cố ý của người thiết kế\n');

const rangerVsTanker = score('Ranger', 'Tanker');
const tankerVsRanger = score('Tanker', 'Ranger');
check('Ranger khắc Tanker', rangerVsTanker > 0 && rangerVsTanker > tankerVsRanger,
    `${rangerVsTanker.toFixed(1)} vs ${tankerVsRanger.toFixed(1)}`);

const tankerVsAssassin = score('Tanker', 'Assassin');
const assassinVsTanker = score('Assassin', 'Tanker');
check('Tanker khắc Assassin', tankerVsAssassin > assassinVsTanker,
    `${tankerVsAssassin.toFixed(1)} vs ${assassinVsTanker.toFixed(1)}`);

const assassinVsRanger = score('Assassin', 'Ranger');
const rangerVsAssassin = score('Ranger', 'Assassin');
check('Assassin khắc Ranger', assassinVsRanger > 0 && assassinVsRanger > rangerVsAssassin,
    `${assassinVsRanger.toFixed(1)} vs ${rangerVsAssassin.toFixed(1)}`);

console.log('\nKite phụ thuộc đất lùi\n');
const kiteOpen = score('Ranger', 'Tanker', 6, 0.9);
const kiteCornered = score('Ranger', 'Tanker', 6, 0.0);
check('Ranger bị dồn vào góc thì kite mất giá', kiteOpen > kiteCornered,
    `thoáng ${kiteOpen.toFixed(1)} vs bí ${kiteCornered.toFixed(1)}`);

console.log('\nHero bẻ vòng khắc chế\n');

// Taki có LOCK: khoá được thì cung thủ hết đường kite, nên Taki áp sát Ranger tốt.
check('Taki (LOCK) áp đảo Ranger', kind('Taki', 'Ranger') === 'DIVE', kind('Taki', 'Ranger'));
const takiVsRanger = score('Taki', 'Ranger');
const tankerVsRanger2 = score('Tanker', 'Ranger');
check('Taki xử Ranger tốt hơn Tanker xử Ranger', takiVsRanger > tankerVsRanger2,
    `${takiVsRanger.toFixed(1)} vs ${tankerVsRanger2.toFixed(1)}`);

// Trarex bắn xa 4 mà KHÔNG dính ADJACENT_PENALTY, nên lao vào nó kém lời hơn Ranger.
const assassinVsTrarex = score('Assassin', 'Trarex');
check('Lao vào Trarex kém lời hơn lao vào Ranger', assassinVsRanger > assassinVsTrarex,
    `Ranger ${assassinVsRanger.toFixed(1)} vs Trarex ${assassinVsTrarex.toFixed(1)}`);

// Ara tầm 5, nhanh 3.5: kite được cả Ranger.
check('Ara kite được Ranger', kind('Ara', 'Ranger') === 'KITE', kind('Ara', 'Ranger'));

// Nizza xuyên vật cản, tốc 5.5: lao vào ai cũng được.
check('Nizza lao vào Ranger', kind('Nizza', 'Ranger') === 'DIVE', kind('Nizza', 'Ranger'));

console.log('\nKhoảng cách làm loãng ảnh hưởng\n');
const near = score('Ranger', 'Tanker', 4);
const far = score('Ranger', 'Tanker', 30);
check('Cặp ở xa thì ảnh hưởng nhỏ hơn hẳn', near > far * 2,
    `gần ${near.toFixed(1)} vs xa ${far.toFixed(1)}`);

console.log(`\n${failures === 0 ? 'TẤT CẢ ĐỀU ĐẠT' : `${failures} MỤC KHÔNG ĐẠT`}\n`);
process.exit(failures === 0 ? 0 : 1);
