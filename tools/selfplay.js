// Harness chạy đối kháng headless giữa hai AI bất kỳ.
//
//   node tools/selfplay.js --games 20 --blue legacy --red random
//
// Harness giữ quyền thực thi nước đi và quyền kết thúc lượt, agent chỉ trả về
// kế hoạch. Nhờ vậy mọi agent đều đi qua đúng một đường luật và kết quả so sánh
// được với nhau.

import MatchInfo from '../core-logic/match-info.js';
import GameLogic from '../core-logic/game-logic.js';
import { LegacyAgent, RandomAgent, ACTION } from './agents.js';

export const RESULT = { ONGOING: 0, TEAM1: 1, TEAM2: 2, DRAW: 3 };

const DEFAULT_ROSTERS = {
    blue: { teamId: 'blue', teamName: 'BLUE', hero: 'Trezdin', units: ['Ranger', 'Ranger', 'Tanker', 'Tanker', 'Assassin'] },
    red: { teamId: 'red', teamName: 'RED', hero: 'Taki', units: ['Ranger', 'Ranger', 'Tanker', 'Tanker', 'Assassin'] }
};

export function createMatch(blueRoster = DEFAULT_ROSTERS.blue, redRoster = DEFAULT_ROSTERS.red) {
    const matchInfo = MatchInfo.createNewMatch(1, 'selfplay', blueRoster, redRoster);
    const gameLogic = new GameLogic(matchInfo);
    gameLogic.startMatch();
    return gameLogic;
}

function findUnitById(gameLogic, id) {
    return gameLogic._getAllUnits().find(u => u.id === id) || null;
}

// Thực thi kế hoạch của agent. Trả về true nếu lượt đó thực sự tiêu thụ một unit.
function applyPlan(gameLogic, plan) {
    if (!plan) return false;

    const unit = findUnitById(gameLogic, plan.unitId);
    if (!unit) return false;

    // Bám đúng luật: unit đang đi phải được ghi nhận trước khi hành động.
    if (!gameLogic.currentTurnUnit) {
        gameLogic.currentTurnUnit = unit;
    }

    if (plan.dest) {
        gameLogic.makeMove(unit, plan.dest.row, plan.dest.col);
    }

    if (plan.action) {
        const target = plan.action.targetId ? findUnitById(gameLogic, plan.action.targetId) : null;
        switch (plan.action.type) {
            case ACTION.ATTACK: if (target) gameLogic.makeAttack(unit, target); break;
            case ACTION.HEAL: if (target) gameLogic.makeHeal(unit, target); break;
            case ACTION.SACRIFICE: if (target) gameLogic.makeSacrifice(unit, target); break;
            case ACTION.SUICIDE: gameLogic.makeSuicide(unit); break;
            default: break;
        }
    }

    // currentTurnUnit có thể vẫn null nếu mọi hành động đều bị từ chối; ép lại để
    // newTurn() chắc chắn tiêu thụ được unit này, tránh vòng lặp vô hạn.
    if (!gameLogic.currentTurnUnit) {
        gameLogic.currentTurnUnit = unit;
    }
    return true;
}

export function runMatch(makeBlueAgent, makeRedAgent, options = {}) {
    const { blueRoster, redRoster, maxTurns = 600, onTurn = null } = options;
    const gameLogic = createMatch(blueRoster, redRoster);

    const agents = {
        [gameLogic.matchInfo.team1.teamId]: makeBlueAgent(gameLogic),
        [gameLogic.matchInfo.team2.teamId]: makeRedAgent(gameLogic)
    };

    const timeSpent = {};
    const turnCount = {};
    for (const id of Object.keys(agents)) { timeSpent[id] = 0; turnCount[id] = 0; }

    let turns = 0;
    let stalls = 0;

    while (gameLogic.isGameEnd() === RESULT.ONGOING && turns < maxTurns) {
        const teamId = gameLogic.currentTurnTeamId;
        const agent = agents[teamId];
        if (!agent) break;

        const t0 = performance.now();
        const plan = agent.chooseTurn(gameLogic, teamId);
        timeSpent[teamId] += performance.now() - t0;
        turnCount[teamId] += 1;

        const acted = applyPlan(gameLogic, plan);
        if (!acted) {
            // Không có quân nào đi được: bỏ lượt để round vẫn tiến triển.
            if (!gameLogic.passTurn()) {
                stalls += 1;
                if (stalls > 4) break;
            }
        }

        if (onTurn) onTurn(gameLogic, teamId, plan);

        gameLogic.newTurn();
        turns += 1;
    }

    const result = gameLogic.isGameEnd();
    return {
        result,
        rounds: gameLogic.roundNo,
        turns,
        timeSpent,
        turnCount,
        avgMsPerTurn: Object.fromEntries(
            Object.entries(timeSpent).map(([k, v]) => [k, turnCount[k] ? v / turnCount[k] : 0])
        ),
        survivors: {
            [gameLogic.matchInfo.team1.teamId]: gameLogic.matchInfo.team1.units.filter(u => u.hp > 0 && u.name !== 'Base').length,
            [gameLogic.matchInfo.team2.teamId]: gameLogic.matchInfo.team2.units.filter(u => u.hp > 0 && u.name !== 'Base').length
        },
        baseHp: {
            [gameLogic.matchInfo.team1.teamId]: gameLogic.matchInfo.team1.units.find(u => u.name === 'Base').hp,
            [gameLogic.matchInfo.team2.teamId]: gameLogic.matchInfo.team2.units.find(u => u.name === 'Base').hp
        }
    };
}

const HEROES = ['Trezdin', 'Trarex', 'Taki', 'Ara', 'Nizza', 'Wizzi'];
const TROOPS = ['Ranger', 'Tanker', 'Assassin'];

export function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomRoster(rng, teamId, teamName) {
    return {
        teamId, teamName,
        hero: HEROES[Math.floor(rng() * HEROES.length)],
        units: Array.from({ length: 5 }, () => TROOPS[Math.floor(rng() * TROOPS.length)])
    };
}

// Chạy N cặp ván. Mỗi cặp dùng CÙNG một bộ đội hình ngẫu nhiên, đánh hai lượt với
// A cầm xanh rồi A cầm đỏ. Cách ghép cặp này triệt tiêu cả lợi thế đi trước lẫn
// lợi thế đội hình, nên chênh lệch còn lại đúng là chênh lệch trình độ.
export function runSeries(makeAgentA, makeAgentB, options = {}) {
    const { games = 10, verbose = false, seed = 12345, randomizeRosters = true } = options;
    const rng = mulberry32(seed);
    const pairs = Math.max(1, Math.ceil(games / 2));

    const tally = { aWins: 0, bWins: 0, draws: 0, unfinished: 0 };
    let totalRounds = 0, played = 0;
    const msA = { total: 0, turns: 0 };
    const msB = { total: 0, turns: 0 };

    for (let i = 0; i < pairs; i++) {
        const blueRoster = randomizeRosters ? randomRoster(rng, 'blue', 'BLUE') : DEFAULT_ROSTERS.blue;
        const redRoster = randomizeRosters ? randomRoster(rng, 'red', 'RED') : DEFAULT_ROSTERS.red;

        for (const aIsBlue of [true, false]) {
            if (played >= games) break;

            const res = runMatch(
                aIsBlue ? makeAgentA : makeAgentB,
                aIsBlue ? makeAgentB : makeAgentA,
                { ...options, blueRoster, redRoster }
            );

            const aSide = aIsBlue ? 'blue' : 'red';
            const bSide = aIsBlue ? 'red' : 'blue';

            msA.total += res.timeSpent[aSide]; msA.turns += res.turnCount[aSide];
            msB.total += res.timeSpent[bSide]; msB.turns += res.turnCount[bSide];
            totalRounds += res.rounds;
            played++;

            const winnerSide = res.result === RESULT.TEAM1 ? 'blue' : res.result === RESULT.TEAM2 ? 'red' : null;
            if (res.result === RESULT.DRAW) tally.draws++;
            else if (res.result === RESULT.ONGOING) tally.unfinished++;
            else if (winnerSide === aSide) tally.aWins++;
            else tally.bWins++;

            if (verbose) {
                const label = res.result === RESULT.DRAW ? 'hoà'
                    : res.result === RESULT.ONGOING ? 'chưa xong'
                        : (winnerSide === aSide ? 'A thắng' : 'B thắng');
                console.log(`  ván ${String(played).padStart(3)}  A=${aSide.padEnd(4)} ${label.padEnd(10)} ${blueRoster.hero}/${redRoster.hero}  round=${String(res.rounds).padStart(2)} baseHp=${res.baseHp.blue}/${res.baseHp.red} alive=${res.survivors.blue}/${res.survivors.red}`);
            }
        }
    }

    return {
        ...tally,
        games: played,
        avgRounds: totalRounds / played,
        avgMsPerTurnA: msA.turns ? msA.total / msA.turns : 0,
        avgMsPerTurnB: msB.turns ? msB.total / msB.turns : 0
    };
}

const AGENT_FACTORIES = {
    legacy: (gl) => new LegacyAgent(gl),
    random: (gl) => new RandomAgent(gl)
};

export function registerAgent(name, factory) {
    AGENT_FACTORIES[name] = factory;
}

export function getAgentFactory(name) {
    const f = AGENT_FACTORIES[name];
    if (!f) throw new Error(`Unknown agent "${name}". Available: ${Object.keys(AGENT_FACTORIES).join(', ')}`);
    return f;
}

function parseArgs(argv) {
    const args = { games: 10, blue: 'legacy', red: 'legacy', verbose: false, time: null, seed: 12345, depth: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--games') args.games = parseInt(argv[++i], 10);
        else if (a === '--blue') args.blue = argv[++i];
        else if (a === '--red') args.red = argv[++i];
        else if (a === '--time') args.time = parseInt(argv[++i], 10);
        else if (a === '--depth') args.depth = parseInt(argv[++i], 10);
        else if (a === '--seed') args.seed = parseInt(argv[++i], 10);
        else if (a === '--verbose' || a === '-v') args.verbose = true;
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    // Nạp agent minimax nếu đã có, để CLI dùng được ngay mà không cần import vòng.
    try {
        const mod = await import('../ai-processor/search/index.js');
        // depth cố định cho kết quả tất định và nhanh; time budget cho chế độ thực chiến
        const opts = args.depth
            ? { timeMs: 1e9, maxDepth: args.depth }
            : { timeMs: args.time ?? 1000 };
        registerAgent('search', (gl) => new mod.SearchAgent(gl, opts));
    } catch (e) { console.warn('không nạp được engine:', e.message); }

    const budget = args.depth ? `depth ${args.depth}` : `${args.time ?? 1000}ms`;
    console.log(`\nSelf-play: A=${args.blue} vs B=${args.red}, ${args.games} ván (${budget}, đội hình ngẫu nhiên, ghép cặp đổi bên)\n`);

    const t0 = performance.now();
    const summary = runSeries(getAgentFactory(args.blue), getAgentFactory(args.red), {
        games: args.games,
        verbose: args.verbose,
        seed: args.seed
    });
    const elapsed = (performance.now() - t0) / 1000;

    const pct = (n) => `${((n / summary.games) * 100).toFixed(1)}%`;
    console.log(`\n  A (${args.blue})  thắng ${summary.aWins}  (${pct(summary.aWins)})`);
    console.log(`  B (${args.red})  thắng ${summary.bWins}  (${pct(summary.bWins)})`);
    console.log(`  hòa ${summary.draws}  (${pct(summary.draws)})   chưa xong ${summary.unfinished}`);
    console.log(`  số round trung bình: ${summary.avgRounds.toFixed(1)}`);
    console.log(`  thời gian mỗi lượt: A ${summary.avgMsPerTurnA.toFixed(2)}ms, B ${summary.avgMsPerTurnB.toFixed(2)}ms`);
    console.log(`  tổng thời gian: ${elapsed.toFixed(1)}s\n`);
}

if (process.argv[1] && process.argv[1].endsWith('selfplay.js')) {
    main();
}
