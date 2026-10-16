// Creates a match, records a few processAction calls, replays the file from
// scratch, and checks positions and HP. Uses REPLAY_DIR (temp) and deletes it.
import fs from 'fs';
import os from 'os';
import path from 'path';
import ServerGameManager from '../services/gameManager.js';
import { getReplay, upsertAiReplay } from '../services/replayStore.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-replay-'));
process.env.REPLAY_DIR = dir;

const teams = {
    blue: { hero: 'Trezdin', units: ['Tanker', 'Tanker', 'Ranger', 'Assassin', 'Assassin'] },
    red: { hero: 'Ara', units: ['Tanker', 'Ranger', 'Ranger', 'Assassin', 'Assassin'] }
};

function snapshot(game) {
    return game.gameLogic._getAllUnits()
        .map(unit => ({ id: unit.id, hp: unit.hp, row: unit.row, col: unit.col }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

function playerFor(game) {
    return game.gameLogic.currentTurnTeamId === 'blue' ? 'p1' : 'p2';
}

function legalMove(game) {
    const team = game.gameLogic.currentTurnTeamId;
    const units = game.gameLogic._getAllUnits().filter(unit =>
        unit.teamId === team && unit.hp > 0 && unit.name !== 'Base' && !game.gameLogic.hasEndedTurn(unit)
    );
    for (const unit of units) {
        const cells = game.gameLogic.getReachableCells(unit);
        if (cells.length) return { unit, cell: cells[0] };
    }
    return null;
}

function assert(cond, message) {
    if (!cond) throw new Error(message);
}

const live = new ServerGameManager(null);
const copy = new ServerGameManager(null);

try {
    const game = live.createGame('testreplay001', 'replay test', teams);
    assert(game, 'game was not created');
    game.addPlayer('p1');
    game.addPlayer('p2');

    let applied = 0;
    for (let n = 0; n < 4 && game.status === 'active'; n++) {
        const move = legalMove(game);
        assert(move, 'no legal move');
        const playerId = playerFor(game);
        const moved = game.processAction(playerId, 'move_unit', {
            unit: { id: move.unit.id },
            row: move.cell.row,
            col: move.cell.col
        });
        assert(moved.success, `move failed: ${moved.error}`);
        applied += 1;
        if (game.status === 'active' && game.gameLogic.currentTurnUnit && game.gameLogic.currentTurnUnit.id === move.unit.id) {
            const ended = game.processAction(playerFor(game), 'end_turn', { unit: { id: move.unit.id } });
            assert(ended.success, `end_turn failed: ${ended.error}`);
            applied += 1;
        }
    }
    assert(applied >= 2, `expected several actions, got ${applied}`);
    if (game.status === 'active') {
        const ended = game.processAction(playerFor(game), 'end_turn', {});
        assert(ended.success, `end_turn failed: ${ended.error}`);
        applied += 1;
    }

    assert(getReplay('../package') === null, 'path traversal id rejected');
    assert(getReplay('..') === null, 'dotdot rejected');
    assert(upsertAiReplay({ version: 1, matchId: '../secret', source: 'ai' }).status === 400, 'bad upload id');

    const saved = getReplay('testreplay001');
    assert(saved, 'replay file missing');
    assert(saved.version === 1, 'version');
    assert(saved.source === 'pvp', 'source');
    assert(saved.actions.length === applied, `file has ${saved.actions.length} actions, live applied ${applied}`);
    assert(saved.teams.blue.hero === 'Trezdin' && saved.teams.red.hero === 'Ara', 'teams');
    assert(saved.actions.every(action => action.action === 'move' || action.action === 'end_turn'), 'action names');
    assert(saved.actions.some(action => action.action === 'move' && action.unitId && Number.isInteger(action.row)), 'move shape');
    assert(saved.actions.some(action => action.action === 'end_turn'), 'end_turn recorded');
    assert(saved.players.some(player => player.userId === 'p1' && player.team === 'blue'), 'blue player');
    assert(saved.players.some(player => player.userId === 'p2' && player.team === 'red'), 'red player');
    assert(!saved.actions.some(action => action.oldPosition || action.deathAnalysis), 'stored input only');

    const replayed = copy.createGame('testreplay002', 'replay copy', saved.teams);
    replayed.addPlayer('p1');
    replayed.addPlayer('p2');
    for (const entry of saved.actions) {
        const action = entry.action === 'move' ? 'move_unit' : entry.action;
        const actionData = {};
        if (entry.unitId) actionData.unit = { id: entry.unitId };
        if (entry.targetId) actionData.target = { id: entry.targetId };
        if (entry.row !== undefined) actionData.row = entry.row;
        if (entry.col !== undefined) actionData.col = entry.col;
        const result = replayed.processAction(playerFor(replayed), action, actionData);
        assert(result.success, `replay ${entry.action} failed: ${result.error}`);
    }

    const liveSnap = snapshot(game);
    const replaySnap = snapshot(replayed);
    assert(JSON.stringify(liveSnap) === JSON.stringify(replaySnap), `state mismatch\n${JSON.stringify(liveSnap)}\n${JSON.stringify(replaySnap)}`);
    console.log(`replay ok: ${saved.actions.length} actions, ${liveSnap.length} units match`);
} finally {
    live.shutdown();
    copy.shutdown();
    fs.rmSync(dir, { recursive: true, force: true });
}
