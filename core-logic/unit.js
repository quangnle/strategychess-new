// import thông tin từ definitions.js
import { UNIT_TYPES } from "./definitions.js";

class Unit {
    constructor(armyType, id, teamId, name, row, col, hp, speed, range, magicRange) {
        this.id = id;
        this.teamId = teamId;
        this.name = name;
        this.armyType = armyType;
        this.row = row;
        this.col = col;
        this.hp = hp;
        this.speed = speed;
        this.range = range;
        this.magicRange = magicRange;
        this.abilities = [];
        this.effects = [];
    }

    static createTanker(id, teamId, row, col) {
        const unit = new Unit(
            UNIT_TYPES.Tanker.name,
            id,
            teamId,
            UNIT_TYPES.Tanker.name,
            row,
            col,
            UNIT_TYPES.Tanker.hp,
            UNIT_TYPES.Tanker.speed,
            UNIT_TYPES.Tanker.range,
            UNIT_TYPES.Tanker.magicRange
        );
        unit.abilities = UNIT_TYPES.Tanker.abilities;
        return unit;
    }

    static createRanger(id, teamId, row, col) {
        const unit = new Unit(
            UNIT_TYPES.Ranger.name,
            id,
            teamId,
            UNIT_TYPES.Ranger.name,            
            row,
            col,
            UNIT_TYPES.Ranger.hp,
            UNIT_TYPES.Ranger.speed,
            UNIT_TYPES.Ranger.range,
            UNIT_TYPES.Ranger.magicRange
        );
        unit.abilities = UNIT_TYPES.Ranger.abilities;
        return unit;
    }

    static createAssassin(id, teamId, row, col) {
        const unit = new Unit(
            UNIT_TYPES.Assassin.name,
            id,
            teamId,
            UNIT_TYPES.Assassin.name,
            row,
            col,
            UNIT_TYPES.Assassin.hp,
            UNIT_TYPES.Assassin.speed,
            UNIT_TYPES.Assassin.range,
            UNIT_TYPES.Assassin.magicRange
        );
        unit.abilities = UNIT_TYPES.Assassin.abilities;
        return unit;
    }

    static createTrezdin(id, teamId, row, col) {
        const unit = new Unit(
            UNIT_TYPES.Trezdin.name,
            id,
            teamId,
            "Trezdin",
            row,
            col,
            UNIT_TYPES.Trezdin.hp,
            UNIT_TYPES.Trezdin.speed,
            UNIT_TYPES.Trezdin.range,
            UNIT_TYPES.Trezdin.magicRange
        );
        unit.abilities = UNIT_TYPES.Trezdin.abilities;
        return unit;
    }

    static createTrarex(id, teamId, row, col) {
        const unit = new Unit(
            UNIT_TYPES.Trarex.name,
            id,
            teamId,
            "Trarex",
            row,
            col,
            UNIT_TYPES.Trarex.hp,
            UNIT_TYPES.Trarex.speed,
            UNIT_TYPES.Trarex.range,
            UNIT_TYPES.Trarex.magicRange
        );
        unit.abilities = UNIT_TYPES.Trarex.abilities;
        return unit;
    }

    static createTaki(id, teamId, row, col) {
        const unit = new Unit(
            UNIT_TYPES.Taki.name,
            id,
            teamId,
            "Taki",
            row,
            col,
            UNIT_TYPES.Taki.hp,
            UNIT_TYPES.Taki.speed,
            UNIT_TYPES.Taki.range,
            UNIT_TYPES.Taki.magicRange
        );
        unit.abilities = UNIT_TYPES.Taki.abilities;
        return unit;
    }

    static createAra(id, teamId, row, col) {   
        const unit = new Unit(
            UNIT_TYPES.Ara.name,
            id,
            teamId,
            "Ara",
            row,
            col,
            UNIT_TYPES.Ara.hp,
            UNIT_TYPES.Ara.speed,
            UNIT_TYPES.Ara.range,
            UNIT_TYPES.Ara.magicRange
        );
        unit.abilities = UNIT_TYPES.Ara.abilities;
        return unit;
    }

    static createNizza(id, teamId, row, col) {
        const unit = new Unit(
            UNIT_TYPES.Nizza.name,
            id,
            teamId,
            "Nizza",
            row,
            col,
            UNIT_TYPES.Nizza.hp,
            UNIT_TYPES.Nizza.speed,
            UNIT_TYPES.Nizza.range,
            UNIT_TYPES.Nizza.magicRange
        );
        unit.abilities = UNIT_TYPES.Nizza.abilities;
        return unit;
    }

    static createWizzi(id, teamId, row, col) {
        const unit = new Unit(
            UNIT_TYPES.Wizzi.name,
            id,
            teamId,
            "Wizzi",
            row,
            col,
            UNIT_TYPES.Wizzi.hp,
            UNIT_TYPES.Wizzi.speed,
            UNIT_TYPES.Wizzi.range,
            UNIT_TYPES.Wizzi.magicRange
        );
        unit.abilities = UNIT_TYPES.Wizzi.abilities;
        return unit;
    }

    static createBase(id, teamId, row, col) {
        const unit = new Unit(
            UNIT_TYPES.Base.name,
            id,
            teamId,
            "Base",
            row,
            col,
            UNIT_TYPES.Base.hp,
            UNIT_TYPES.Base.speed,
            UNIT_TYPES.Base.range,
            UNIT_TYPES.Base.magicRange
        );
        unit.abilities = UNIT_TYPES.Base.abilities;
        return unit;
    }
}

export default Unit;