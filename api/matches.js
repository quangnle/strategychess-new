import express from 'express';
import matchService from '../services/matchService.js';

const router = express.Router();

// Get waiting matches
router.get('/waiting', (req, res) => {
    try {
        const waitingMatches = matchService.getWaitingMatches();
        res.json({
            success: true,
            matches: waitingMatches
        });
    } catch (error) {
        console.error('Error getting waiting matches:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create a new match
router.post('/create', (req, res) => {
    try {
        const { creatorUserId, creatorUsername, matchName } = req.body;
        
        if (!creatorUserId || !creatorUsername) {
            return res.status(400).json({
                success: false,
                error: 'Creator user ID and username are required'
            });
        }
        
        const match = matchService.createMatch(creatorUserId, creatorUsername, matchName);
        
        res.json({
            success: true,
            match: {
                id: match.id,
                name: match.name,
                creatorUsername: match.creatorUsername,
                playerCount: match.players.size,
                maxPlayers: match.maxPlayers,
                createdAt: match.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating match:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Join a match
router.post('/join', (req, res) => {
    try {
        const { matchId, userId, username } = req.body;
        
        if (!matchId || !userId || !username) {
            return res.status(400).json({
                success: false,
                error: 'Match ID, user ID, and username are required'
            });
        }
        
        const match = matchService.joinMatch(matchId, userId, username);
        
        res.json({
            success: true,
            match: {
                id: match.id,
                name: match.name,
                status: match.status,
                players: matchService.store.getMatchPlayers(matchId)
            }
        });
    } catch (error) {
        console.error('Error joining match:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get match details
router.get('/:matchId', (req, res) => {
    try {
        const { matchId } = req.params;
        const match = matchService.getMatch(matchId);
        
        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        res.json({
            success: true,
            match: {
                id: match.id,
                name: match.name,
                status: match.status,
                creatorUsername: match.creatorUsername,
                playerCount: match.players.size,
                maxPlayers: match.maxPlayers,
                players: matchService.store.getMatchPlayers(matchId),
                createdAt: match.createdAt
            }
        });
    } catch (error) {
        console.error('Error getting match:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
