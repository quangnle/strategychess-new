import { BaseStrategy } from "./strategies/base-strategy.js";
import { RangerStrategy } from "./strategies/ranger-strategy.js";
import { TankerStrategy } from "./strategies/tanker-strategy.js";
import { AssassinStrategy } from "./strategies/assassin-strategy.js";
import { TrezdinStrategy } from "./strategies/hero-strategies/trezdin-strategy.js";
import { TakiStrategy } from "./strategies/hero-strategies/taki-strategy.js";
import { TrarexStrategy } from "./strategies/hero-strategies/trarex-strategy.js";
import { AraStrategy } from "./strategies/hero-strategies/ara-strategy.js";
import { NizzaStrategy } from "./strategies/hero-strategies/nizza-strategy.js";
import { WizziStrategy } from "./strategies/hero-strategies/wizzi-strategy.js";

class Processor {
    constructor(gameLogic) {
        this.gameLogic = gameLogic;
        this.strategies = this._initializeStrategies();
    }

    _initializeStrategies() {
        return {
            'Ranger': new RangerStrategy(this.gameLogic),
            'Tanker': new TankerStrategy(this.gameLogic),
            'Assassin': new AssassinStrategy(this.gameLogic),
            'Trezdin': new TrezdinStrategy(this.gameLogic),
            'Taki': new TakiStrategy(this.gameLogic),
            'Trarex': new TrarexStrategy(this.gameLogic),
            'Ara': new AraStrategy(this.gameLogic),
            'Nizza': new NizzaStrategy(this.gameLogic),
            'Wizzi': new WizziStrategy(this.gameLogic),
            'Base': new BaseStrategy(this.gameLogic)
        };
    }

    evaluatePosition(unit, row, col) {
        const strategy = this.strategies[unit.name];
        return strategy ? strategy.evaluatePosition(unit, row, col) : -1;
    }

    evaluatePositions(unit) {
        // Lấy tất cả các ô mà unit có thể di chuyển đến
        const reachableCells = this.gameLogic.getReachableCells(unit);
        // Bao gồm cả vị trí hiện tại
        reachableCells.push({ row: unit.row, col: unit.col });
        // Đánh giá từng ô
        const results = reachableCells.map(cell => {
            const score = this.evaluatePosition(unit, cell.row, cell.col);
            return { row: cell.row, col: cell.col, score };
        });
        return results;
    }
}

export default Processor;