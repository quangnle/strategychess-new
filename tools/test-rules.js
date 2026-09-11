// Kiểm chứng từng luật đã ghi trong gameplay-vn.md bằng chính GameLogic.
//
//   node tools/test-rules.js
//
// Tài liệu luật cũ đã sai ở gần chục chỗ vì được viết tay rồi để trôi khỏi code.
// File này tồn tại để chuyện đó không lặp lại: mỗi khẳng định trong tài liệu có
// một assert tương ứng ở đây.

import MatchInfo from '../core-logic/match-info.js';
import GameLogic from '../core-logic/game-logic.js';
import { UNIT_TYPES, LOCK, ADJACENT_PENALTY, BOARD_ROWS, BOARD_COLS } from '../core-logic/definitions.js';

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
    if (ok) { pass++; console.log(`  ĐẠT   ${label}`); }
    else { fail++; console.log(`  HỎNG  ${label}${detail ? '  — ' + detail : ''}`); }
}

// Dựng ván rồi tự đặt lại vị trí quân để tạo đúng tình huống cần kiểm.
function scenario(blueHero, redHero, blueUnits = ['Ranger', 'Ranger', 'Tanker', 'Tanker', 'Assassin'], redUnits = blueUnits) {
    const mi = MatchInfo.createNewMatch(1, 'rules', 
        { teamId: 'blue', teamName: 'BLUE', hero: blueHero, units: [...blueUnits] },
        { teamId: 'red', teamName: 'RED', hero: redHero, units: [...redUnits] });
    const gl = new GameLogic(mi);
    gl.startMatch();
    return gl;
}

const find = (gl, team, name) => gl.matchInfo[team].units.find(u => u.name === name);

// Dời hết quân ra khỏi đường để chỉ còn lại những quân ta quan tâm.
function isolate(gl, keep) {
    const keepIds = new Set(keep.map(u => u.id));
    for (const u of gl._getAllUnits()) {
        if (!keepIds.has(u.id)) { u.row = -50; u.col = -50; }
    }
}

function place(u, row, col) { u.row = row; u.col = col; }

// Cho phép unit hành động ngay, bỏ qua thứ tự lượt.
function giveTurn(gl, u) {
    gl.currentTurnTeamId = u.teamId;
    gl.currentTurnUnit = u;
    gl._resetTurnActions();
}

console.log('\n=== Bàn cờ và Base ===');
{
    check('bàn cờ 12 hàng x 11 cột', BOARD_ROWS === 12 && BOARD_COLS === 11, `${BOARD_ROWS}x${BOARD_COLS}`);
    check('Base có 7 máu', UNIT_TYPES.Base.hp === 7, String(UNIT_TYPES.Base.hp));

    const gl = scenario('Trezdin', 'Taki');
    const base = find(gl, 'team2', 'Base');
    const ass = find(gl, 'team1', 'Assassin');
    isolate(gl, [base, ass]);
    place(base, 5, 5); place(ass, 5, 6);
    giveTurn(gl, ass);

    check('Base là mục tiêu tấn công hợp lệ', gl.getAttackableTargets(ass).includes(base));
    const hp0 = base.hp;
    gl.makeAttack(ass, base);
    check('đánh Base mất đúng 1 máu', base.hp === hp0 - 1, `${hp0} -> ${base.hp}`);

    // Base chặn đường: đứng cạnh Base thì ô của Base không nằm trong danh sách đi được.
    giveTurn(gl, ass);
    const cells = gl.getReachableCells(ass);
    check('Base chặn đường đi', !cells.some(c => c.row === 5 && c.col === 5));
}

console.log('\n=== Thắng thua và hoà ===');
{
    const gl = scenario('Trezdin', 'Taki');
    find(gl, 'team2', 'Base').hp = 0;
    check('Base về 0 máu là thua', gl.isGameEnd() === 1, `isGameEnd=${gl.isGameEnd()}`);

    const gl2 = scenario('Trezdin', 'Taki');
    for (const u of gl2.matchInfo.team2.units) if (u.name !== 'Base') u.hp = 0;
    check('hết sạch quân lính là thua (Base không cứu được)', gl2.isGameEnd() === 1);

    const gl3 = scenario('Trezdin', 'Taki');
    gl3.roundNo = 20;
    check('round 20 là hoà', gl3.isGameEnd() === 3, `isGameEnd=${gl3.isGameEnd()}`);
    gl3.roundNo = 19;
    check('round 19 vẫn còn đánh', gl3.isGameEnd() === 0);
}

console.log('\n=== Tầm đánh dùng <= ===');
{
    const gl = scenario('Trezdin', 'Taki');
    const ranger = find(gl, 'team1', 'Ranger');   // range 4
    const foe = find(gl, 'team2', 'Tanker');
    isolate(gl, [ranger, foe]);

    place(ranger, 3, 4); place(foe, 5, 5);        // Manhattan = 3
    giveTurn(gl, ranger);
    check('khoảng cách 3 nằm trong range 4', gl.getAttackableTargets(ranger).includes(foe));

    place(foe, 7, 4);                              // Manhattan = 4, đúng bằng range
    giveTurn(gl, ranger);
    check('khoảng cách ĐÚNG BẰNG range vẫn đánh được (<=, không phải <)',
        gl.getAttackableTargets(ranger).includes(foe));

    place(foe, 8, 4);                              // Manhattan = 5
    giveTurn(gl, ranger);
    check('khoảng cách 5 nằm ngoài range 4', !gl.getAttackableTargets(ranger).includes(foe));
}

console.log('\n=== Chỉ số hero ===');
{
    const want = {
        Trezdin: [7, 2.5, 1], Trarex: [3, 3.5, 4], Taki: [5, 3.5, 1],
        Ara: [3, 3.5, 5], Nizza: [3, 5.5, 1], Wizzi: [3, 3.5, 3]
    };
    for (const [name, [hp, sp, rg]] of Object.entries(want)) {
        const d = UNIT_TYPES[name];
        check(`${name} = máu ${hp}, tốc độ ${sp}, tầm ${rg}`,
            d.hp === hp && d.speed === sp && d.range === rg,
            `thực tế ${d.hp}/${d.speed}/${d.range}`);
    }
    check('Wizzi tầm phép 5 (khác tầm đánh 3)', UNIT_TYPES.Wizzi.magicRange === 5);
}

console.log('\n=== Tốc độ lẻ .5 ===');
{
    const gl = scenario('Trezdin', 'Nizza');
    const trez = find(gl, 'team1', 'Trezdin');    // 2.5, đi bộ
    const nizza = find(gl, 'team2', 'Nizza');     // 5.5, wind walk
    isolate(gl, [trez, nizza]);
    place(trez, 2, 5); place(nizza, 9, 5);

    const far = (u) => gl.getReachableCells(u)
        .reduce((m, c) => Math.max(m, Math.abs(c.row - u.row) + Math.abs(c.col - u.col)), 0);

    check('tốc độ 2.5 đi bộ được 3 bước (làm tròn LÊN)', far(trez) === 3, `đi xa ${far(trez)}`);
    check('tốc độ 5.5 wind walk đi được 5 ô (làm tròn XUỐNG)', far(nizza) === 5, `đi xa ${far(nizza)}`);
}

console.log('\n=== Luật một lượt ===');
{
    const gl = scenario('Trezdin', 'Taki');
    const ass = find(gl, 'team1', 'Assassin');
    const foe = find(gl, 'team2', 'Tanker');
    isolate(gl, [ass, foe]);
    place(ass, 5, 5); place(foe, 5, 6);
    giveTurn(gl, ass);

    check('đánh được khi ở trong tầm', gl.makeAttack(ass, foe) === true);
    check('ĐÃ ĐÁNH thì không được di chuyển nữa', gl.makeMove(ass, 6, 5) === false);

    giveTurn(gl, ass);
    check('đi trước rồi đánh sau thì hợp lệ',
        gl.makeMove(ass, 4, 6) === true && gl.makeAttack(ass, foe) === true);

    giveTurn(gl, ass);
    gl.makeMove(ass, 4, 5);
    check('mỗi lượt chỉ được di chuyển một lần', gl.makeMove(ass, 4, 4) === false);
}

console.log('\n=== Lock chỉ cấm di chuyển ===');
{
    // Dùng Assassin làm mục tiêu bị lock: nó KHÔNG có Adjacent Penalty, nên nếu
    // nó vẫn đánh được thì đó đúng là do Lock không cấm đánh, chứ không phải do
    // một hiệu ứng khác vô tình cho qua.
    const gl = scenario('Taki', 'Trezdin');
    const taki = find(gl, 'team1', 'Taki');
    const foe = find(gl, 'team2', 'Assassin');
    isolate(gl, [taki, foe]);
    place(taki, 5, 5); place(foe, 5, 6);

    giveTurn(gl, taki);
    gl.makeAttack(taki, foe);

    check('Taki đánh trúng thì địch dính Lock 2 round',
        foe.effects.some(e => e.name === LOCK && e.duration === 2));
    check('Taki nhận Dash +1 tốc độ', taki.effects.some(e => e.name === 'dash' && e.value === 1));
    check('tốc độ Taki bị chặn ở 4.5', gl._getCurrentSpeed(taki) === 4.5, String(gl._getCurrentSpeed(taki)));

    giveTurn(gl, foe);
    check('quân bị Lock KHÔNG di chuyển được', gl.makeMove(foe, 4, 6) === false);
    giveTurn(gl, foe);
    check('quân bị Lock VẪN tấn công được (Lock chỉ khoá chân)',
        gl.makeAttack(foe, taki) === true);

    // Chồng Lock lên Ranger thì mới thành bia đứng yên: khoá chân + mất đòn.
    const gl2 = scenario('Taki', 'Trezdin');
    const taki2 = find(gl2, 'team1', 'Taki');
    const ranger = find(gl2, 'team2', 'Ranger');
    isolate(gl2, [taki2, ranger]);
    place(taki2, 5, 5); place(ranger, 5, 6);

    giveTurn(gl2, taki2);
    gl2.makeAttack(taki2, ranger);
    gl2.currentTurnUnit = null;
    gl2._adjacentPenaltyEffect();
    giveTurn(gl2, ranger);
    check('quân bị Lock cạnh quân cận chiến = vừa không chạy vừa không đánh',
        gl2.makeMove(ranger, 4, 6) === false && gl2.getAttackableTargets(ranger).length === 0);

    check('Lock thì không còn ô đi được để highlight', gl2.getReachableCells(ranger).length === 0);

    // duration 2: hết round lần 1 còn lock, hết round lần 2 thì hết hẳn (không để duration=0 treo thêm round).
    const gl3 = scenario('Taki', 'Trezdin');
    const taki3 = find(gl3, 'team1', 'Taki');
    const ass3 = find(gl3, 'team2', 'Assassin');
    isolate(gl3, [taki3, ass3]);
    place(taki3, 5, 5); place(ass3, 5, 6);
    giveTurn(gl3, taki3);
    gl3.makeAttack(taki3, ass3);
    check('vừa lock xong thì duration = 2', ass3.effects.some(e => e.name === LOCK && e.duration === 2));
    gl3._reduceEffectDuration();
    check('sau 1 round vẫn còn Lock', ass3.effects.some(e => e.name === LOCK && e.duration === 1));
    giveTurn(gl3, ass3);
    check('round thứ hai vẫn không đi được', gl3.makeMove(ass3, 4, 6) === false);
    gl3._reduceEffectDuration();
    check('sau 2 round Lock biến mất hẳn', !ass3.effects.some(e => e.name === LOCK));
    giveTurn(gl3, ass3);
    check('hết Lock thì đi được lại', gl3.makeMove(ass3, 4, 6) === true);
}

console.log('\n=== Adjacent Penalty ===');
{
    const gl = scenario('Trezdin', 'Trarex');
    const ranger = find(gl, 'team1', 'Ranger');
    const ass = find(gl, 'team2', 'Assassin');
    const rbase = find(gl, 'team2', 'Base');
    isolate(gl, [ranger, ass, rbase]);
    place(ranger, 5, 5); place(ass, 5, 6); place(rbase, 0, 0);

    gl.currentTurnUnit = null;
    gl._adjacentPenaltyEffect();
    check('địch áp sát thì Ranger dính Adjacent Penalty',
        ranger.effects.some(e => e.name === ADJACENT_PENALTY));

    giveTurn(gl, ranger);
    check('Ranger dính penalty thì không đánh được gì', gl.getAttackableTargets(ranger).length === 0);
    gl.makeMove(ranger, 8, 5);
    check('chạy đi chỗ khác vẫn mất đòn cả lượt', gl.makeAttack(ranger, ass) === false);

    // Base địch cũng tính là địch đứng sát.
    const gl2 = scenario('Trezdin', 'Trarex');
    const r2 = find(gl2, 'team1', 'Ranger');
    const b2 = find(gl2, 'team2', 'Base');
    isolate(gl2, [r2, b2]);
    place(b2, 5, 5); place(r2, 5, 6);
    gl2.currentTurnUnit = null;
    gl2._adjacentPenaltyEffect();
    check('đứng sát BASE địch cũng dính Adjacent Penalty',
        r2.effects.some(e => e.name === ADJACENT_PENALTY));

    // Trarex miễn nhiễm.
    const gl3 = scenario('Trarex', 'Trezdin');
    const trarex = find(gl3, 'team1', 'Trarex');
    const a3 = find(gl3, 'team2', 'Assassin');
    isolate(gl3, [trarex, a3]);
    place(trarex, 5, 5); place(a3, 5, 6);
    gl3.currentTurnUnit = null;
    gl3._adjacentPenaltyEffect();
    giveTurn(gl3, trarex);
    check('Trarex bị áp sát vẫn đánh được', gl3.getAttackableTargets(trarex).includes(a3));
}

console.log('\n=== Berserk (Trezdin) ===');
{
    const gl = scenario('Trezdin', 'Taki');
    const trez = find(gl, 'team1', 'Trezdin');
    trez.hp = 4;
    for (const u of gl.matchInfo.team1.units) if (u.name !== 'Base' && u.name !== 'Trezdin') u.hp = 0;

    gl._berserkEffect();
    check('Berserk hồi +1 máu khi Trezdin còn một mình', trez.hp === 5, String(trez.hp));
    check('Berserk +1 tốc độ: 2.5 -> 3.5', trez.speed === 3.5, String(trez.speed));

    const sp = trez.speed;
    gl._berserkEffect();
    check('Berserk chỉ kích hoạt đúng một lần', trez.speed === sp && trez.hp === 5);

    const gl2 = scenario('Trezdin', 'Taki');
    const t2 = find(gl2, 'team1', 'Trezdin');
    t2.hp = 7;
    for (const u of gl2.matchInfo.team1.units) if (u.name !== 'Base' && u.name !== 'Trezdin') u.hp = 0;
    gl2._berserkEffect();
    check('Berserk không hồi vượt máu gốc 7', t2.hp === 7, String(t2.hp));
}

console.log('\n=== Nizza: Wind Walk + Suicide ===');
{
    const gl = scenario('Nizza', 'Trezdin');
    const nizza = find(gl, 'team1', 'Nizza');
    const walls = gl.matchInfo.team2.units.filter(u => u.name !== 'Base').slice(0, 3);
    isolate(gl, [nizza, ...walls]);
    place(nizza, 5, 5);
    place(walls[0], 5, 4); place(walls[1], 4, 5); place(walls[2], 6, 5);

    const cells = gl.getReachableCells(nizza);
    check('Nizza đi xuyên qua tường quân', cells.some(c => c.row === 5 && c.col === 2));
    check('nhưng ô đích vẫn phải trống', !cells.some(c => c.row === 5 && c.col === 4));

    // Tự sát: đánh cả địch lẫn đồng đội lẫn Base.
    const gl2 = scenario('Nizza', 'Trezdin');
    const n2 = find(gl2, 'team1', 'Nizza');
    const ally = find(gl2, 'team1', 'Tanker');
    const foe = find(gl2, 'team2', 'Assassin');
    const foeBase = find(gl2, 'team2', 'Base');
    isolate(gl2, [n2, ally, foe, foeBase]);
    place(n2, 5, 5); place(ally, 5, 4); place(foe, 5, 6); place(foeBase, 4, 4);
    n2.hp = 2;

    giveTurn(gl2, n2);
    check('còn 2 máu thì chưa tự sát được', gl2.makeSuicide(n2) === false);

    n2.hp = 1;
    gl2._suicideEffect();
    giveTurn(gl2, n2);
    const before = { ally: ally.hp, foe: foe.hp, base: foeBase.hp };
    check('còn đúng 1 máu thì tự sát được', gl2.makeSuicide(n2) === true);
    check('Nizza chết sau khi tự sát', n2.hp === 0);
    check('tự sát gây sát thương cho ĐỊCH', foe.hp === before.foe - 1);
    check('tự sát gây sát thương cho ĐỒNG ĐỘI', ally.hp === before.ally - 1);
    check('tự sát gây sát thương cả BASE (ô chéo cũng dính)', foeBase.hp === before.base - 1);
}

console.log('\n=== Wizzi: Heal ===');
{
    const gl = scenario('Wizzi', 'Trezdin');
    const wizzi = find(gl, 'team1', 'Wizzi');
    const ally = find(gl, 'team1', 'Tanker');
    const base = find(gl, 'team1', 'Base');
    const foe = find(gl, 'team2', 'Tanker');
    isolate(gl, [wizzi, ally, base, foe]);

    place(wizzi, 5, 5); place(ally, 5, 9); place(base, 1, 5); place(foe, 5, 6);
    ally.hp = 2; base.hp = 4; wizzi.hp = 1; foe.hp = 1;

    giveTurn(gl, wizzi);
    check('heal đồng đội trong tầm phép 5 (xa hơn tầm đánh 3)',
        gl.makeHeal(wizzi, ally) === true && ally.hp === 3);

    giveTurn(gl, wizzi);
    check('Wizzi tự heal cho chính mình được', gl.makeHeal(wizzi, wizzi) === true && wizzi.hp === 2);

    giveTurn(gl, wizzi);
    check('Wizzi heal được cho Base nhà', gl.makeHeal(wizzi, base) === true && base.hp === 5);

    giveTurn(gl, wizzi);
    check('không heal cho quân địch', gl.makeHeal(wizzi, foe) === false);

    ally.hp = UNIT_TYPES.Tanker.hp;
    giveTurn(gl, wizzi);
    check('không heal vượt máu gốc', gl.makeHeal(wizzi, ally) === false);
}

console.log('\n=== Tanker: Sacrifice ===');
{
    const gl = scenario('Trezdin', 'Taki');
    const tank = find(gl, 'team1', 'Tanker');
    const ally = find(gl, 'team1', 'Ranger');
    const base = find(gl, 'team1', 'Base');
    isolate(gl, [tank, ally, base]);

    place(tank, 5, 5); place(ally, 5, 6); place(base, 4, 5);
    ally.hp = 1; base.hp = 4; tank.hp = 5;

    giveTurn(gl, tank);
    check('sacrifice: mất 1 máu mình, hồi 1 máu đồng đội sát bên',
        gl.makeSacrifice(tank, ally) === true && tank.hp === 4 && ally.hp === 2);

    giveTurn(gl, tank);
    check('sacrifice được cho Base nhà khi đứng cạnh',
        gl.makeSacrifice(tank, base) === true && base.hp === 5);

    giveTurn(gl, tank);
    check('không tự sacrifice cho chính mình', gl.makeSacrifice(tank, tank) === false);

    // Đồng đội ở xa 2 ô thì ngoài tầm.
    place(ally, 5, 7); ally.hp = 1;
    giveTurn(gl, tank);
    check('chỉ sacrifice cho quân ở 4 ô sát bên', gl.makeSacrifice(tank, ally) === false);
}

console.log('\n=== Movement point quyết định lượt ===');
{
    const gl = scenario('Trezdin', 'Nizza');
    const mp1 = gl._calculateTeamMovementPoint('blue');
    const mp2 = gl._calculateTeamMovementPoint('red');
    // Cùng bộ lính, chỉ khác hero: 2.5 so với 5.5.
    check('movement point = tổng tốc độ quân chưa đi', mp2 - mp1 === 3, `${mp1} vs ${mp2}`);
    check('bên nhiều movement point hơn được đi trước', gl.currentTurnTeamId === 'red');

    // Base không đóng góp movement point.
    const gl2 = scenario('Trezdin', 'Trezdin');
    check('hai bên giống hệt nhau thì movement point bằng nhau',
        gl2._calculateTeamMovementPoint('blue') === gl2._calculateTeamMovementPoint('red'));
    check('bằng điểm thì bên giữ quyền ưu tiên được đi',
        gl2.currentTurnTeamId === gl2.priorityTeamId);
}

console.log(`\n${pass} đạt, ${fail} hỏng\n`);
if (fail > 0) process.exitCode = 1;
