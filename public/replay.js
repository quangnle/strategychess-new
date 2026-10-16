import { t, initI18n } from './i18n.js';
import BattleGraphics from './battle-sketch.js';
import { applyLoggedAction } from '/core-logic/replay-actions.js';

initI18n();

let replays = [];
let current = null;
let graphics = null;
let cursor = 0;
let playing = false;
let playTimer = null;

const listEl = document.getElementById('replay-list');
const viewerEl = document.getElementById('replay-viewer');
const metaEl = document.getElementById('replay-meta');
const statusEl = document.getElementById('replay-status');
const stepEl = document.getElementById('replay-step');

function playerName(replay, team) {
    const player = (replay.players || []).find(item => item.team === team);
    return player?.username || (team === 'blue' ? 'Blue' : 'Red');
}

function winnerText(winner) {
    if (!winner) return t('replay.live');
    if (winner === 'draw') return t('replay.draw');
    if (winner === 'blue') return t('replay.blueWins');
    if (winner === 'red') return t('replay.redWins');
    if (typeof winner === 'object') {
        const team = winner.team === 'red' ? 'Red' : 'Blue';
        return t('replay.forfeit', { team });
    }
    return t('replay.live');
}

function sourceText(source) {
    return source === 'ai' ? t('replay.ai') : t('replay.pvp');
}

function formatWhen(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
}

function renderList() {
    if (!listEl) return;
    if (!replays.length) {
        listEl.innerHTML = `<div class="text-center text-gray-400 text-sm">${t('replay.empty')}</div>`;
        return;
    }
    listEl.innerHTML = '';
    replays.forEach(replay => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'w-full text-left bg-gray-900/80 hover:bg-gray-700 border border-gray-600 rounded p-3 flex items-center justify-between gap-3';
        const blue = playerName(replay, 'blue');
        const red = playerName(replay, 'red');
        row.innerHTML = `
            <div>
                <div class="font-semibold">${blue} <span class="text-gray-400">vs</span> ${red}</div>
                <div class="text-xs text-gray-400 mt-1">${sourceText(replay.source)} · ${winnerText(replay.winner)} · ${formatWhen(replay.createdAt)}</div>
            </div>
            <span class="text-xs font-bold text-yellow-300">${t('replay.watch')}</span>
        `;
        row.addEventListener('click', () => openReplay(replay.matchId));
        listEl.appendChild(row);
    });
}

async function loadList() {
    if (listEl) listEl.innerHTML = `<div class="text-center text-gray-400 text-sm">${t('replay.loading')}</div>`;
    try {
        const response = await fetch('/api/replays');
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        replays = Array.isArray(data.replays) ? data.replays : [];
        renderList();
    } catch {
        if (listEl) listEl.innerHTML = `<div class="text-center text-red-300 text-sm">${t('replay.loadError')}</div>`;
    }
}

function matchInfoFrom(replay) {
    return {
        matchId: replay.matchId,
        matchName: 'replay',
        team1: {
            teamId: 'blue',
            teamName: playerName(replay, 'blue'),
            hero: replay.teams.blue.hero,
            units: [...replay.teams.blue.units]
        },
        team2: {
            teamId: 'red',
            teamName: playerName(replay, 'red'),
            hero: replay.teams.red.hero,
            units: [...replay.teams.red.units]
        }
    };
}

function stopPlay() {
    playing = false;
    if (playTimer) {
        clearInterval(playTimer);
        playTimer = null;
    }
    const playBtn = document.getElementById('replay-play');
    if (playBtn) playBtn.textContent = t('replay.play');
}

function paintChrome() {
    if (!current) return;
    const total = current.actions.length;
    if (stepEl) stepEl.textContent = t('replay.step', { n: cursor, total });
    if (metaEl) {
        const round = graphics?.gameLogic?.roundNo ?? 0;
        metaEl.textContent = `${playerName(current, 'blue')} vs ${playerName(current, 'red')} · ${sourceText(current.source)} · ${winnerText(current.winner)} · ${t('replay.round', { n: round })}`;
    }
}

function destroyBoard() {
    if (graphics) {
        graphics.destroy();
        graphics = null;
    }
    const host = document.getElementById('battle-canvas-container');
    if (host) host.innerHTML = '';
}

function mountAt(index) {
    if (!current) return;
    destroyBoard();
    graphics = new BattleGraphics(matchInfoFrom(current), {
        mode: 'off',
        autoPlay: false,
        replay: true
    });
    cursor = 0;
    const target = Math.max(0, Math.min(index, current.actions.length));
    for (let i = 0; i < target; i++) {
        const applied = applyLoggedAction(graphics.gameLogic, current.actions[i]);
        if (!applied.ok) {
            if (statusEl) statusEl.textContent = t('replay.applyError');
            cursor = i;
            paintChrome();
            return;
        }
        graphics.recentActions = applied.trace || [];
        cursor = i + 1;
    }
    if (statusEl) statusEl.textContent = '';
    paintChrome();
}

function stepForward() {
    if (!current || !graphics) return;
    if (cursor >= current.actions.length) {
        stopPlay();
        return;
    }
    const applied = applyLoggedAction(graphics.gameLogic, current.actions[cursor]);
    if (!applied.ok) {
        if (statusEl) statusEl.textContent = t('replay.applyError');
        stopPlay();
        return;
    }
    graphics.recentActions = applied.trace || [];
    cursor += 1;
    if (statusEl) statusEl.textContent = '';
    paintChrome();
    if (cursor >= current.actions.length) stopPlay();
}

function stepBack() {
    if (!current || cursor <= 0) return;
    stopPlay();
    mountAt(cursor - 1);
}

async function openReplay(matchId) {
    stopPlay();
    destroyBoard();
    current = null;
    try {
        const response = await fetch(`/api/replays/${encodeURIComponent(matchId)}`);
        if (!response.ok) throw new Error(String(response.status));
        current = await response.json();
    } catch {
        if (statusEl) statusEl.textContent = t('replay.missing');
        viewerEl?.classList.remove('hidden');
        return;
    }
    if (!current?.teams?.blue || !current?.teams?.red || !Array.isArray(current.actions)) {
        if (statusEl) statusEl.textContent = t('replay.missing');
        viewerEl?.classList.remove('hidden');
        return;
    }
    listEl?.classList.add('hidden');
    viewerEl?.classList.remove('hidden');
    const url = new URL(window.location.href);
    url.searchParams.set('id', current.matchId);
    history.replaceState(null, '', url);
    mountAt(0);
}

function showList() {
    stopPlay();
    destroyBoard();
    current = null;
    viewerEl?.classList.add('hidden');
    listEl?.classList.remove('hidden');
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    history.replaceState(null, '', url);
    renderList();
}

function togglePlay() {
    if (!current) return;
    if (playing) {
        stopPlay();
        return;
    }
    if (cursor >= current.actions.length) mountAt(0);
    playing = true;
    const playBtn = document.getElementById('replay-play');
    if (playBtn) playBtn.textContent = t('replay.pause');
    playTimer = setInterval(stepForward, 800);
}

document.getElementById('replay-back-list')?.addEventListener('click', showList);
document.getElementById('replay-start')?.addEventListener('click', () => { stopPlay(); mountAt(0); });
document.getElementById('replay-back')?.addEventListener('click', stepBack);
document.getElementById('replay-forward')?.addEventListener('click', () => { stopPlay(); stepForward(); });
document.getElementById('replay-end')?.addEventListener('click', () => {
    stopPlay();
    if (current) mountAt(current.actions.length);
});
document.getElementById('replay-play')?.addEventListener('click', togglePlay);

window.addEventListener('sc:lang', () => {
    renderList();
    paintChrome();
    const playBtn = document.getElementById('replay-play');
    if (playBtn) playBtn.textContent = playing ? t('replay.pause') : t('replay.play');
});

loadList().then(() => {
    const id = new URL(window.location.href).searchParams.get('id');
    if (id) openReplay(id);
});
