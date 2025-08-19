class Team {
    constructor(teamId, teamName) {
        this.teamId = teamId;
        this.teamName = teamName;
        this.units = [];
    }

    addUnit(unit) {
        this.units.push(unit);
        unit.teamId = this.teamId;
    }

    removeUnit(unit) {
        this.units = this.units.filter(u => u.id !== unit.id);
    }
}

export default Team;