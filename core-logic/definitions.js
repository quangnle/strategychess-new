// bàn cờ
const BOARD_COLS = 11;
const BOARD_ROWS = 12;

// effects
const ADJACENT_PENALTY = "adjacent penalty";
const SACRIFICE = "sacrifice";
const LOCK = "lock";
const BERSERK = "berserk";
const HEAL = "heal";
const SUICIDE = "suicide";
const WIND_WALK = "wind walk";
const DASH = "dash";

// unit definitions
const UNIT_TYPES = {
    "Base": {
        "name": "Base",
        "hp": 7,
        "speed": 0,
        "range": 0,
        "magicRange": 0,
        "abilities": [],
        "image_blue": "./imgs/base_blue.png",
        "image_red": "./imgs/base_red.png",
    },
    "Ranger": {
        "name": "Ranger",
        "hp": 2,
        "speed": 3,
        "range": 4,
        "magicRange": 0,
        "abilities": [ADJACENT_PENALTY],
        "image_blue": "./imgs/ranger_blue.png",
        "image_red": "./imgs/ranger_red.png",
    },
    "Tanker": {
        "name": "Tanker",
        "hp": 5,
        "speed": 2,
        "range": 1,
        "magicRange": 0,
        "abilities": [SACRIFICE],
        "image_blue": "./imgs/tanker_blue.png",
        "image_red": "./imgs/tanker_red.png",
    },
    "Assassin": {
        "name": "Assassin",
        "hp": 3,
        "speed": 5,
        "range": 1,
        "magicRange": 0,
        "abilities": [],
        "image_blue": "./imgs/assassin_blue.png",
        "image_red": "./imgs/assassin_red.png",
    },
    "Trezdin": {
        "name": "Trezdin",
        "hp": 7,
        "speed": 2.5,
        "range": 1,
        "magicRange": 0,
        "abilities": [BERSERK],
        "image_blue": "./imgs/heroes/trezdin_blue.png",
        "image_red": "./imgs/heroes/trezdin_red.png",
    },
    "Trarex": {
        "name": "Trarex",
        "hp": 3,
        "speed": 3.5,
        "range": 4,
        "magicRange": 0,
        "abilities": [],
        "image_blue": "./imgs/heroes/trarex_blue.png",
        "image_red": "./imgs/heroes/trarex_red.png",
    },
    "Taki": {
        "name": "Taki",
        "hp": 5,
        "speed": 3.5,
        "range": 1,
        "magicRange": 0,
        "abilities": [LOCK],
        "image_blue": "./imgs/heroes/taki_blue.png",
        "image_red": "./imgs/heroes/taki_red.png",
    },
    "Ara": {
        "name": "Ara",
        "hp": 3,
        "speed": 3.5,
        "range": 5,
        "magicRange": 0,
        "abilities": [ADJACENT_PENALTY],
        "image_blue": "./imgs/heroes/ara_blue.png",
        "image_red": "./imgs/heroes/ara_red.png",
    },
    "Nizza": {
        "name": "Nizza",
        "hp": 3,
        "speed": 5.5,
        "range": 1,
        "magicRange": 0,
        "abilities": [SUICIDE, WIND_WALK],
        "image_blue": "./imgs/heroes/nizza_blue.png",
        "image_red": "./imgs/heroes/nizza_red.png",
    },
    "Wizzi": {
        "name": "Wizzi",
        "hp": 3,
        "speed": 3.5,
        "range": 3,
        "magicRange": 5,
        "abilities": [HEAL],
        "image_blue": "./imgs/heroes/wizzi_blue.png",
        "image_red": "./imgs/heroes/wizzi_red.png",
    }
}

export { BOARD_COLS, BOARD_ROWS, ADJACENT_PENALTY, SACRIFICE, LOCK, DASH, BERSERK, HEAL, SUICIDE, WIND_WALK, UNIT_TYPES };