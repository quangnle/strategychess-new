import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ID_RE = /^[A-Za-z0-9_-]{1,120}$/;
const AI_ID_RE = /^ai_[A-Za-z0-9_-]{1,100}$/;
const UNIT_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const HEROES = new Set(['Trezdin', 'Trarex', 'Taki', 'Ara', 'Nizza', 'Wizzi']);
const REGULARS = new Set(['Tanker', 'Ranger', 'Assassin']);
const ACTIONS = new Set(['move', 'attack', 'heal', 'sacrifice', 'suicide', 'end_turn']);

export function getReplayDir() {
    const configured = process.env.REPLAY_DIR;
    if (configured && String(configured).trim()) return path.resolve(String(configured));
    return path.join(projectRoot, 'data', 'replays');
}

export function isSafeReplayId(id) {
    return typeof id === 'string' && id !== 'index' && ID_RE.test(id);
}

function replayPath(matchId) {
    if (!isSafeReplayId(matchId)) return null;
    const dir = path.resolve(getReplayDir());
    const file = path.resolve(dir, `${matchId}.json`);
    if (file !== path.join(dir, `${matchId}.json`)) return null;
    return file;
}

function ensureDir() {
    fs.mkdirSync(getReplayDir(), { recursive: true });
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function writeJsonAtomic(file, value) {
    ensureDir();
    const json = JSON.stringify(value, null, 2);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, file);
}

function indexSummary(record) {
    return {
        matchId: record.matchId,
        players: Array.isArray(record.players) ? record.players : [],
        createdAt: record.createdAt || null,
        endedAt: record.endedAt || null,
        winner: record.winner ?? null,
        source: record.source === 'ai' ? 'ai' : 'pvp'
    };
}

function updateIndex(record) {
    const indexFile = path.join(getReplayDir(), 'index.json');
    const current = readJson(indexFile);
    const list = Array.isArray(current) ? current.filter(item => item && isSafeReplayId(item.matchId)) : [];
    const summary = indexSummary(record);
    const at = list.findIndex(item => item.matchId === record.matchId);
    if (at >= 0) list[at] = summary;
    else list.push(summary);
    writeJsonAtomic(indexFile, list);
}

export function saveReplay(record) {
    if (!record || !isSafeReplayId(record.matchId)) {
        throw new Error('Invalid replay id');
    }
    const file = replayPath(record.matchId);
    if (!file) throw new Error('Invalid replay path');
    writeJsonAtomic(file, record);
    updateIndex(record);
    return record;
}

export function getReplay(matchId) {
    const file = replayPath(matchId);
    if (!file || !fs.existsSync(file)) return null;
    const data = readJson(file);
    if (!data || data.matchId !== matchId || data.version !== 1) return null;
    return data;
}

export function listReplays() {
    const indexFile = path.join(getReplayDir(), 'index.json');
    const current = readJson(indexFile);
    const list = Array.isArray(current) ? current.filter(item => item && isSafeReplayId(item.matchId)) : [];
    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return list;
}

function cleanName(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
    return cleaned || fallback;
}

function sanitizeTeam(team) {
    if (!team || typeof team !== 'object') return null;
    if (!HEROES.has(team.hero)) return null;
    if (!Array.isArray(team.units) || team.units.length !== 5) return null;
    if (!team.units.every(name => REGULARS.has(name))) return null;
    return { hero: team.hero, units: [...team.units] };
}

function sanitizeAction(action) {
    if (!action || typeof action !== 'object' || !ACTIONS.has(action.action)) return null;
    const out = { action: action.action };
    if (action.unitId !== undefined) {
        if (typeof action.unitId !== 'string' || !UNIT_ID_RE.test(action.unitId)) return null;
        out.unitId = action.unitId;
    }
    if (action.targetId !== undefined) {
        if (typeof action.targetId !== 'string' || !UNIT_ID_RE.test(action.targetId)) return null;
        out.targetId = action.targetId;
    }
    if (action.action === 'move') {
        const row = Number(action.row);
        const col = Number(action.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (row < 0 || row > 11 || col < 0 || col > 10) return null;
        if (!out.unitId) return null;
        out.row = row;
        out.col = col;
    }
    if ((action.action === 'attack' || action.action === 'heal' || action.action === 'sacrifice') &&
        (!out.unitId || !out.targetId)) {
        return null;
    }
    if (action.action === 'suicide' && !out.unitId) return null;
    return out;
}

function sanitizeWinner(winner) {
    if (winner == null) return null;
    if (winner === 'blue' || winner === 'red' || winner === 'draw') return winner;
    if (typeof winner === 'object') {
        const team = winner.team === 'red' || winner.teamId === 'red' ? 'red' : 'blue';
        const reason = cleanName(winner.reason, 'forfeit');
        const playerId = typeof winner.playerId === 'string' && UNIT_ID_RE.test(winner.playerId)
            ? winner.playerId
            : null;
        return { team, playerId, reason };
    }
    return null;
}

function sanitizePlayers(players) {
    if (!Array.isArray(players)) return [];
    return players.slice(0, 4).map((player, index) => {
        const team = player?.team === 'red' ? 'red' : 'blue';
        const userId = typeof player?.userId === 'string' && UNIT_ID_RE.test(player.userId)
            ? player.userId
            : `player_${index}`;
        return {
            userId,
            username: cleanName(player?.username, userId),
            team
        };
    });
}

function validTime(value) {
    if (typeof value !== 'string' || !value) return null;
    const time = new Date(value);
    if (Number.isNaN(time.getTime())) return null;
    return time.toISOString();
}

// Client-submitted AI replays. Rejects path tricks and refuses to overwrite PvP files.
export function upsertAiReplay(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { status: 400, error: 'Invalid replay' };
    }
    if (body.version !== 1) return { status: 400, error: 'Unsupported replay version' };
    if (typeof body.matchId !== 'string' || !AI_ID_RE.test(body.matchId)) {
        return { status: 400, error: 'Invalid replay id' };
    }
    if (body.source !== 'ai') return { status: 400, error: 'Only AI replays can be uploaded' };

    const blue = sanitizeTeam(body.teams?.blue);
    const red = sanitizeTeam(body.teams?.red);
    if (!blue || !red) return { status: 400, error: 'Invalid teams' };
    if (!Array.isArray(body.actions) || body.actions.length > 8000) {
        return { status: 400, error: 'Invalid actions' };
    }
    const actions = [];
    for (const action of body.actions) {
        const clean = sanitizeAction(action);
        if (!clean) return { status: 400, error: 'Invalid action' };
        actions.push(clean);
    }

    const existing = getReplay(body.matchId);
    if (existing && existing.source !== 'ai') {
        return { status: 409, error: 'Replay is not editable' };
    }
    const revision = Number.isInteger(body.revision) && body.revision >= 0 ? body.revision : 0;
    if (existing && Number.isInteger(existing.revision) && existing.revision > revision) {
        return { status: 200, matchId: body.matchId, ignored: true };
    }

    const record = {
        version: 1,
        matchId: body.matchId,
        source: 'ai',
        createdAt: existing?.createdAt || validTime(body.createdAt) || new Date().toISOString(),
        endedAt: body.endedAt == null ? null : validTime(body.endedAt),
        players: sanitizePlayers(body.players),
        teams: { blue, red },
        actions,
        winner: sanitizeWinner(body.winner),
        revision
    };
    saveReplay(record);
    return { status: 200, matchId: record.matchId };
}
