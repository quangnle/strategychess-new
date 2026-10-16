// Browser-side log for matches played in the page (AI / local). The server
// stores the same JSON shape it writes for PvP.

export function winnerFromResult(result) {
    if (result === 1) return 'blue';
    if (result === 2) return 'red';
    if (result === 3) return 'draw';
    return null;
}

export function createReplayRecorder({ teams, players }) {
    const matchId = `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const record = {
        version: 1,
        matchId,
        source: 'ai',
        createdAt: new Date().toISOString(),
        endedAt: null,
        players: players || [],
        teams,
        actions: [],
        winner: null,
        revision: 0
    };

    let timer = null;
    let chain = Promise.resolve();

    function post(keepalive) {
        record.revision += 1;
        const body = JSON.stringify(record);
        const send = () => fetch('/api/replays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: !!keepalive
        }).catch(() => {});
        chain = chain.then(send, send);
    }

    return {
        record,
        log(entries) {
            const list = Array.isArray(entries) ? entries : [entries];
            for (const entry of list) {
                if (entry && entry.action) record.actions.push(entry);
            }
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                post(false);
            }, 250);
        },
        finish(winner) {
            if (record.endedAt) return;
            record.winner = winner ?? null;
            record.endedAt = new Date().toISOString();
            if (timer) clearTimeout(timer);
            timer = null;
            post(true);
        },
        flush(keepalive) {
            if (timer) clearTimeout(timer);
            timer = null;
            if (keepalive && typeof navigator !== 'undefined' && navigator.sendBeacon) {
                record.revision += 1;
                const blob = new Blob([JSON.stringify(record)], { type: 'application/json' });
                navigator.sendBeacon('/api/replays', blob);
                return;
            }
            post(!!keepalive);
        }
    };
}
