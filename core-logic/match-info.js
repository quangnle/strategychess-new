import { UNIT_TYPES } from "./definitions.js";
import Unit from "./unit.js";
import Team from "./team.js";

class MatchInfo {
    constructor(matchId, matchName, team1, team2) {
        this.matchId = matchId;
        this.matchName = matchName;        
        this.team1 = team1;
        this.team2 = team2;
        this.winner = null;
        this.loser = null;
        this.state = null;
    }

    static createNewMatch(matchId, matchName, team1Data, team2Data) {        
        const team1 = this._setupTeam(team1Data, true);
        const team2 = this._setupTeam(team2Data, false);
        const newMatch = new MatchInfo(matchId, matchName, team1, team2);
        newMatch.state = "waiting";
        return newMatch;
    }

    static _setupTeam(teamData, isBlueTeam) {
        const team = new Team(teamData.teamId, teamData.teamName);
        
        const baseRow = isBlueTeam ? 11 : 0;
        const unitRow = isBlueTeam ? 10 : 1;
        const heroRow = isBlueTeam ? 9 : 2;        
        let startCol = 3;

        // team là một array của tên của các binh chủng có thể lấy thông tin từ UNIT_TYPES        
        for (let i = 0; i < teamData.units.length; i++) {
            let unit = null;
            const unitName = teamData.units[i];
            const unitType = this._getUnitTypeFromName(unitName);
            switch (unitType) {
                case UNIT_TYPES.Tanker:
                    unit = Unit.createTanker(`${teamData.teamName}_${unitType.name}_${i}`, teamData.teamId, unitRow, startCol + i - 1);
                    break;
                case UNIT_TYPES.Ranger:
                    unit = Unit.createRanger(`${teamData.teamName}_${unitType.name}_${i}`, teamData.teamId, unitRow, startCol + i - 1);
                    break;
                case UNIT_TYPES.Assassin:
                    unit = Unit.createAssassin(`${teamData.teamName}_${unitType.name}_${i}`, teamData.teamId, unitRow, startCol + i - 1);
                    break;
                case UNIT_TYPES.Trezdin:
                    unit = Unit.createTrezdin(`${teamData.teamName}_${unitType.name}`, teamData.teamId, heroRow, 5);
                    break;
                case UNIT_TYPES.Trarex:
                    unit = Unit.createTrarex(`${teamData.teamName}_${unitType.name}`, teamData.teamId, heroRow, 5);
                    break;
                case UNIT_TYPES.Taki:
                    unit = Unit.createTaki(`${teamData.teamName}_${unitType.name}`, teamData.teamId, heroRow, 5);
                    break;
                case UNIT_TYPES.Ara:
                    unit = Unit.createAra(`${teamData.teamName}_${unitType.name}`, teamData.teamId, heroRow, 5);
                    break;
                case UNIT_TYPES.Wizzi:
                    unit = Unit.createWizzi(`${teamData.teamName}_${unitType.name}`, teamData.teamId, heroRow, 5);
                    break;
                case UNIT_TYPES.Nizza:
                    unit = Unit.createNizza(`${teamData.teamName}_${unitType.name}`, teamData.teamId, heroRow, 5);
                    break;
                default:
                    throw new Error(`Unit type ${unitType.name} not found`);
            }
            
            team.addUnit(unit);     
        }
        // tạo base cho team
        team.addUnit(Unit.createBase(`${teamData.teamName}_base`, teamData.teamId, baseRow, 5));
        return team;
    }

    static _getUnitTypeFromName(name) {
        for (const unitType in UNIT_TYPES) {
            if (UNIT_TYPES[unitType].name === name) {
                return UNIT_TYPES[unitType];
            }
        }
    }

    clone() { 
        const newMatch = new MatchInfo(this.matchId, this.matchName, this.team1.clone(), this.team2.clone());
        newMatch.winner = this.winner;
        newMatch.loser = this.loser;
        newMatch.state = this.state;
        return newMatch;
    }
}

export default MatchInfo;