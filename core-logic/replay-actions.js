// Shared replay step. Mirrors GameInstance.processAction's successful mutations
// (move / attack / heal / sacrifice / suicide / end_turn) so a saved action list
// reproduces the same board. No I/O.

const LOGGED_ACTIONS = new Set(['move', 'attack', 'heal', 'sacrifice', 'suicide', 'end_turn']);

export function toReplayEntry(action, actionData = {}) {
    const name = action === 'move_unit' ? 'move' : action;
    const entry = { action: name };
    const unitId = actionData.unit?.id || actionData.unitId;
    const targetId = actionData.target?.id || actionData.targetId;
    if (unitId) entry.unitId = unitId;
    if (targetId) entry.targetId = targetId;
    if (name === 'move') {
        entry.row = actionData.row;
        entry.col = actionData.col;
    }
    return entry;
}

export function isLoggedAction(action) {
    return LOGGED_ACTIONS.has(action);
}

function findUnit(gameLogic, unitId) {
    if (!unitId || !gameLogic?.matchInfo) return null;
    const units = [
        ...(gameLogic.matchInfo.team1?.units || []),
        ...(gameLogic.matchInfo.team2?.units || [])
    ];
    return units.find(unit => unit.id === unitId) || null;
}

// Attack / heal / sacrifice still available after a move. Suicide is not included,
// matching GameInstance.hasAvailableActions.
export function hasFollowUpActions(gameLogic, unit) {
    if (!unit || !gameLogic) return false;
    const canAttack = gameLogic.getAttackableTargets
        ? gameLogic.getAttackableTargets(unit).length > 0
        : false;
    const canHeal = gameLogic.getHealableTargets
        ? gameLogic.getHealableTargets(unit).length > 0
        : false;
    const canSacrifice = gameLogic.getSacrificeableTargets
        ? gameLogic.getSacrificeableTargets(unit).length > 0
        : false;
    return canAttack || canHeal || canSacrifice;
}

function teamById(gameLogic, teamId) {
    if (!gameLogic?.matchInfo) return null;
    if (gameLogic.matchInfo.team1?.teamId === teamId) return gameLogic.matchInfo.team1;
    if (gameLogic.matchInfo.team2?.teamId === teamId) return gameLogic.matchInfo.team2;
    return null;
}

/**
 * Apply one logged action. Returns { ok, error, trace } where trace is the
 * arrow list the board already understands ({ type, from, to }).
 */
export function applyLoggedAction(gameLogic, entry) {
    if (!gameLogic || !entry || !LOGGED_ACTIONS.has(entry.action)) {
        return { ok: false, error: 'Unknown action', trace: [] };
    }

    switch (entry.action) {
        case 'move': {
            const unit = findUnit(gameLogic, entry.unitId);
            if (!unit) return { ok: false, error: 'Unit not found', trace: [] };
            const from = { row: unit.row, col: unit.col };
            const ok = gameLogic.makeMove(unit, entry.row, entry.col);
            if (!ok) return { ok: false, error: 'Action failed', trace: [] };
            if (!hasFollowUpActions(gameLogic, unit)) gameLogic.newTurn();
            return {
                ok: true,
                trace: [{ type: 'move', from, to: { row: entry.row, col: entry.col } }]
            };
        }
        case 'attack':
            return finishAction(gameLogic, entry, 'attack', (unit, target) => gameLogic.makeAttack(unit, target));
        case 'heal':
            return finishAction(gameLogic, entry, 'heal', (unit, target) => gameLogic.makeHeal(unit, target));
        case 'sacrifice':
            return finishAction(gameLogic, entry, 'sacrifice', (unit, target) => gameLogic.makeSacrifice(unit, target));
        case 'suicide': {
            const unit = findUnit(gameLogic, entry.unitId);
            if (!unit) return { ok: false, error: 'Unit not found', trace: [] };
            const from = { row: unit.row, col: unit.col };
            const ok = gameLogic.makeSuicide(unit);
            if (!ok) return { ok: false, error: 'Action failed', trace: [] };
            gameLogic.newTurn();
            return { ok: true, trace: [{ type: 'suicide', from, to: from }] };
        }
        case 'end_turn': {
            if (entry.unitId && !gameLogic.currentTurnUnit) {
                const specified = findUnit(gameLogic, entry.unitId);
                if (specified &&
                    specified.hp > 0 &&
                    specified.name !== 'Base' &&
                    specified.teamId === gameLogic.currentTurnTeamId &&
                    !gameLogic.hasEndedTurn(specified)) {
                    gameLogic.currentTurnUnit = specified;
                }
            }

            let stay = null;
            if (gameLogic.currentTurnUnit === null) {
                const currentTeam = teamById(gameLogic, gameLogic.currentTurnTeamId);
                const availableUnit = currentTeam?.units?.find(unit =>
                    unit.hp > 0 &&
                    unit.name !== 'Base' &&
                    !gameLogic.alreadyEndedTurnUnits.includes(unit)
                );
                if (availableUnit) {
                    gameLogic.alreadyEndedTurnUnits.push(availableUnit);
                    stay = { row: availableUnit.row, col: availableUnit.col };
                }
            } else {
                stay = { row: gameLogic.currentTurnUnit.row, col: gameLogic.currentTurnUnit.col };
                gameLogic.endTurn();
            }
            gameLogic.newTurn();
            return {
                ok: true,
                trace: stay ? [{ type: 'stay', from: stay, to: stay }] : []
            };
        }
        default:
            return { ok: false, error: 'Unknown action', trace: [] };
    }
}

function finishAction(gameLogic, entry, type, run) {
    const unit = findUnit(gameLogic, entry.unitId);
    const target = findUnit(gameLogic, entry.targetId);
    if (!unit || !target) return { ok: false, error: 'Unit not found', trace: [] };
    const from = { row: unit.row, col: unit.col };
    const to = { row: target.row, col: target.col };
    const ok = run(unit, target);
    if (!ok) return { ok: false, error: 'Action failed', trace: [] };
    gameLogic.newTurn();
    return { ok: true, trace: [{ type, from, to }] };
}
