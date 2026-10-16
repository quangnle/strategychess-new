import express from 'express';
import { getReplay, listReplays, upsertAiReplay } from '../services/replayStore.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ replays: listReplays() });
});

router.get('/:id', (req, res) => {
    const replay = getReplay(req.params.id);
    if (!replay) {
        res.status(404).json({ error: 'Replay not found' });
        return;
    }
    res.json(replay);
});

router.post('/', (req, res) => {
    const result = upsertAiReplay(req.body);
    if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
    }
    res.json({ ok: true, matchId: result.matchId, ignored: !!result.ignored });
});

export default router;
