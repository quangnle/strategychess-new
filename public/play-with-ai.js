import { t, initI18n } from './i18n.js';

// Import modules
let UNIT_TYPES = null;
let P5BattleGraphics = null;

// Chat functionality
let chatSocket = null;
let currentUser = null;

// Load definitions and graphics
async function loadDefinitions() {
    try {
        // Since we're in the public directory, we need to use absolute paths
        const module = await import('/core-logic/definitions.js');
        UNIT_TYPES = module.UNIT_TYPES;
        console.log('Definitions loaded successfully:', Object.keys(UNIT_TYPES));
        
        const graphicsModule = await import('./battle-sketch.js');
        P5BattleGraphics = graphicsModule.default;
        console.log('Battle graphics module loaded successfully');
    } catch (error) {
        console.error('Error loading modules:', error);
        // Fallback to basic structure
        UNIT_TYPES = {
            "Trezdin": { name: "Trezdin", hp: 5, speed: 3, range: 1, image_blue: "./imgs/heroes/trezdin_blue.png", image_red: "./imgs/heroes/trezdin_red.png" },
            "Trarex": { name: "Trarex", hp: 3, speed: 3, range: 4, image_blue: "./imgs/heroes/trarex_blue.png", image_red: "./imgs/heroes/trarex_red.png" },
            "Taki": { name: "Taki", hp: 4, speed: 4, range: 1, image_blue: "./imgs/heroes/taki_blue.png", image_red: "./imgs/heroes/taki_red.png" },
            "Ara": { name: "Ara", hp: 4, speed: 4, range: 1, image_blue: "./imgs/heroes/ara_blue.png", image_red: "./imgs/heroes/ara_red.png" },
            "Nizza": { name: "Nizza", hp: 3, speed: 5, range: 1, image_blue: "./imgs/heroes/nizza_blue.png", image_red: "./imgs/heroes/nizza_red.png" },
            "Wizzi": { name: "Wizzi", hp: 3, speed: 3, range: 3, image_blue: "./imgs/heroes/wizzi_blue.png", image_red: "./imgs/heroes/wizzi_red.png" },
            "Tanker": { name: "Tanker", hp: 5, speed: 2, range: 1, image_blue: "./imgs/tanker_blue.png", image_red: "./imgs/tanker_red.png" },
            "Assassin": { name: "Assassin", hp: 3, speed: 5, range: 1, image_blue: "./imgs/assassin_blue.png", image_red: "./imgs/assassin_red.png" },
            "Ranger": { name: "Ranger", hp: 2, speed: 3, range: 4, image_blue: "./imgs/ranger_blue.png", image_red: "./imgs/ranger_red.png" }
        };
    }
}

// Team state management
class TeamManager {
    constructor(teamColor) {
        this.teamColor = teamColor;
        this.teamName = teamColor.toUpperCase();
        this.selectedHero = null;
        this.selectedUnits = [];
        this.maxUnits = 5;
        
        this.heroes = ['Trezdin', 'Trarex', 'Taki', 'Ara', 'Nizza', 'Wizzi'];
        this.regularUnits = ['Tanker', 'Assassin', 'Ranger'];
        
        // Don't call init() immediately, wait for UNIT_TYPES to be loaded
    }
    
    init() {
        this.renderHeroSelection();
        this.renderUnitSelection();
        this.updateUI();
        this.bindEvents();
    }
    
    renderHeroSelection() {
        const container = document.getElementById(`${this.teamColor}-hero-selection`);
        if (!container) {
            console.error(`Container not found: ${this.teamColor}-hero-selection`);
            return;
        }
        
        container.innerHTML = '';
        
        if (!UNIT_TYPES) {
            console.error('UNIT_TYPES not loaded yet');
            container.innerHTML = `<div class="text-red-400">${t('ai.loadingHeroes')}</div>`;
            return;
        }
        
        this.heroes.forEach(heroName => {
            const hero = UNIT_TYPES[heroName];
            if (!hero) {
                console.error(`Hero not found: ${heroName}`);
                return;
            }
            
            const card = document.createElement('div');
            card.className = `bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-${this.teamColor}-400 rounded p-1 cursor-pointer`;
            card.dataset.hero = heroName;
            card.title = `${heroName}  HP ${hero.hp}  Speed ${hero.speed}  Range ${hero.range}`;
            
            card.innerHTML = `
                <div class="text-center">
                    <img src="${hero[`image_${this.teamColor}`]}" alt="${heroName}" class="w-12 h-12 mx-auto">
                    <div class="text-[10px] leading-tight font-semibold text-gray-200 truncate">${heroName}</div>
                </div>
            `;
            
            card.addEventListener('click', () => this.selectHero(heroName));
            container.appendChild(card);
        });
    }
    
    renderUnitSelection() {
        const container = document.getElementById(`${this.teamColor}-units-selection`);
        if (!container) {
            console.error(`Container not found: ${this.teamColor}-units-selection`);
            return;
        }
        
        container.innerHTML = '';
        
        if (!UNIT_TYPES) {
            console.error('UNIT_TYPES not loaded yet');
            container.innerHTML = `<div class="text-red-400">${t('ai.loadingUnits')}</div>`;
            return;
        }
        
        this.regularUnits.forEach(unitName => {
            const unit = UNIT_TYPES[unitName];
            if (!unit) {
                console.error(`Unit not found: ${unitName}`);
                return;
            }
            
            const card = document.createElement('div');
            card.className = `bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-${this.teamColor}-400 rounded p-1 cursor-pointer`;
            card.dataset.unit = unitName;
            card.title = `${unitName}  HP ${unit.hp}  Speed ${unit.speed}  Range ${unit.range}`;
            
            card.innerHTML = `
                <div class="text-center">
                    <img src="${unit[`image_${this.teamColor}`]}" alt="${unitName}" class="w-10 h-10 mx-auto">
                    <div class="text-[10px] leading-tight font-semibold text-gray-200">${unitName}</div>
                </div>
            `;
            
            card.addEventListener('click', () => this.addUnit(unitName));
            container.appendChild(card);
        });
    }
    
    selectHero(heroName) {
        if (this.selectedHero === heroName) {
            this.deselectHero();
            return;
        }
        this.selectedHero = heroName;
        this.updateUI();
        this.paintHeroSelection();
    }

    paintHeroSelection() {
        const container = document.getElementById(`${this.teamColor}-hero-selection`);
        if (!container) return;
        container.querySelectorAll('[data-hero]').forEach(card => {
            const on = card.dataset.hero === this.selectedHero;
            card.className = on
                ? `bg-${this.teamColor}-800 border-2 border-${this.teamColor}-400 rounded p-1 cursor-pointer`
                : `bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-${this.teamColor}-400 rounded p-1 cursor-pointer`;
        });
        this.renderPickedHero();
    }

    renderPickedHero() {
        const el = document.getElementById(`${this.teamColor}-hero-picked`);
        if (!el) return;
        if (!this.selectedHero || !UNIT_TYPES[this.selectedHero]) {
            el.innerHTML = `<div class="text-xs text-gray-500">${t('ai.noHero')}</div>`;
            return;
        }
        const hero = UNIT_TYPES[this.selectedHero];
        const img = hero[`image_${this.teamColor}`];
        el.innerHTML = `
            <div class="flex items-center gap-3 bg-gray-900/50 rounded p-2 border border-${this.teamColor}-500">
                <img src="${img}" alt="" class="w-14 h-14 flex-shrink-0">
                <div>
                    <div class="font-bold text-sm">${hero.name}</div>
                    <div class="text-xs text-gray-300 mt-0.5">HP ${hero.hp} · Speed ${hero.speed} · Range ${hero.range}</div>
                </div>
            </div>
        `;
    }
    
    addUnit(unitName) {
        if (this.selectedUnits.length >= this.maxUnits) {
            alert(t('ai.maxUnits', { n: this.maxUnits }));
            return;
        }
        
        this.selectedUnits.push(unitName);
        this.updateUI();
        this.showSelectedUnits();
    }
    
    removeUnit(index) {
        this.selectedUnits.splice(index, 1);
        this.updateUI();
        this.showSelectedUnits();
    }
    
    showSelectedUnits() {
        const container = document.getElementById(`${this.teamColor}-units-selected`);
        if (!container) {
            console.error(`Container not found: ${this.teamColor}-units-selected`);
            return;
        }
        
        container.innerHTML = '';

        this.selectedUnits.forEach((unitName, index) => {
            const unit = UNIT_TYPES[unitName];
            if (!unit) return;
            const unitCard = document.createElement('div');
            unitCard.className = `bg-${this.teamColor}-800 border border-${this.teamColor}-400 rounded px-1 py-0.5 relative`;
            unitCard.innerHTML = `
                <div class="flex items-center gap-1 pr-3">
                    <img src="${unit[`image_${this.teamColor}`]}" alt="${unitName}" class="w-6 h-6">
                    <div class="text-[10px] text-${this.teamColor}-200">${unitName}</div>
                </div>
                <button class="remove-unit-btn absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                    ✕
                </button>
            `;
            const removeBtn = unitCard.querySelector('.remove-unit-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => this.removeUnit(index));
            }
            container.appendChild(unitCard);
        });
    }
    
    deselectHero() {
        this.selectedHero = null;
        this.updateUI();
        this.paintHeroSelection();
    }
    
    updateUI() {
        // Update unit counter
        const counter = document.getElementById(`${this.teamColor}-unit-counter`);
        if (counter) {
            counter.textContent = `(${this.selectedUnits.length}/${this.maxUnits})`;
        }
        
        // Update team name
        const nameInput = document.getElementById(`${this.teamColor}-team-name`);
        if (nameInput) {
            this.teamName = nameInput.value;
        }
        
        this.renderPickedHero();
        this.updateGlobalStartButton();
    }
    
    updateGlobalStartButton() {
        const desktop = document.getElementById('global-start-btn');
        const ready = window.teamManagers && window.teamManagers.blue && window.teamManagers.red
            && window.teamManagers.blue.isReady() && window.teamManagers.red.isReady();
        if (desktop) desktop.disabled = !ready;
        applyMobilePickStep();
    }
    
    isReady() {
        return this.selectedHero && this.selectedUnits.length === this.maxUnits;
    }
    
    getTeamData() {
        return {
            name: this.teamName,
            hero: this.selectedHero,
            units: [...this.selectedUnits]
        };
    }
    
    bindEvents() {
        const nameInput = document.getElementById(`${this.teamColor}-team-name`);
        if (nameInput) {
            nameInput.addEventListener('input', () => this.updateUI());
        }
    }
}

// Initialize team managers
let teamManagers = null;

function initializeTeamManagers() {
    teamManagers = {
        blue: new TeamManager('blue'),
        red: new TeamManager('red')
    };
    
    // Initialize both team managers
    teamManagers.blue.init();
    teamManagers.red.init();
    
    // Make team managers globally accessible for button handlers
    window.teamManagers = teamManagers;
}

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    initI18n();
    window.addEventListener('sc:lang', () => {
        applyMobilePickStep();
        if (window.teamManagers) {
            window.teamManagers.blue.renderPickedHero();
            window.teamManagers.red.renderPickedHero();
        }
        if (battleGraphics) {
            updateAiStatusLine(battleGraphics.ai);
            renderBattleHud(battleGraphics);
        }
    });
    // Load definitions first
    await loadDefinitions();
    
    // Then initialize team managers
    initializeTeamManagers();
    
    // AI settings panel
    setupAiSettings();
    
    // Initialize chat functionality
    initializeChat();
    
    // Global start button handler
    const startBattleIfReady = () => {
        if (teamManagers && teamManagers.blue.isReady() && teamManagers.red.isReady()) {
            startBattle();
        }
    };
    ['global-start-btn', 'global-start-btn-mobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', startBattleIfReady);
    });

    const mobileNext = document.getElementById('mobile-pick-next');
    if (mobileNext) {
        mobileNext.addEventListener('click', () => {
            const you = playerTeamColor();
            if (!teamManagers || !teamManagers[you] || !teamManagers[you].isReady()) return;
            mobilePickStep = 2;
            applyMobilePickStep();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    const mobileBack = document.getElementById('mobile-pick-back');
    if (mobileBack) {
        mobileBack.addEventListener('click', () => {
            mobilePickStep = 1;
            applyMobilePickStep();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    window.addEventListener('resize', () => applyMobilePickStep());
    applyMobilePickStep();
    
    // Back to selection button handler
    const backToSelectionBtn = document.getElementById('back-to-selection');
    if (backToSelectionBtn) {
        backToSelectionBtn.addEventListener('click', () => {
            showSelectionScreen();
        });
    }

    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.addEventListener('click', handleEndTurn);
    }

    const deselectCurrent = () => {
        if (battleGraphics && battleGraphics.gameLogic.currentTurnUnit) {
            battleGraphics.gameLogic.currentTurnUnit = null;
        }
    };
    const currentUnitPanel = document.getElementById('current-unit-panel');
    if (currentUnitPanel) currentUnitPanel.addEventListener('click', deselectCurrent);
    const mobileCurrent = document.getElementById('mobile-current-unit');
    if (mobileCurrent) mobileCurrent.addEventListener('click', deselectCurrent);

    const autoBtn = document.getElementById('ai-auto-btn');
    if (autoBtn) {
        autoBtn.addEventListener('click', () => {
            if (battleGraphics) battleGraphics.handleKeyPress('a');
        });
    }
    const stepBtn = document.getElementById('ai-step-btn');
    if (stepBtn) {
        stepBtn.addEventListener('click', () => {
            if (battleGraphics) battleGraphics.handleKeyPress('d');
        });
    }

    document.addEventListener('keydown', (e) => {
        const battle = document.getElementById('battle-screen');
        if (!battle || battle.classList.contains('hidden') || !battleGraphics) return;
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'CANVAS') return;
        if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D' || e.key === 'Escape') {
            e.preventDefault();
            battleGraphics.handleKeyPress(e.key);
        }
    });
});

// Battle functions
function startBattle() {
    const blueTeam = teamManagers.blue.getTeamData();
    const redTeam = teamManagers.red.getTeamData();
    
    console.log('Starting battle with teams:', { blueTeam, redTeam });
    
    // Create matchInfo
    const matchInfo = createMatchInfo(blueTeam, redTeam);
    
    // Switch to battle screen
    showBattleScreen();
    
    // Initialize battle graphics
    initializeBattleGraphics(matchInfo);
}

function createMatchInfo(blueTeam, redTeam) {
    // Hero phải truyền riêng, KHÔNG gộp vào mảng units. MatchInfo._setupTeam chỉ
    // nhận Tanker/Ranger/Assassin trong units và sẽ ném lỗi nếu gặp tên hero ở đó.
    const matchInfo = {
        matchId: 1,
        matchName: "battle",
        team1: {
            teamId: "blue",
            teamName: blueTeam.name,
            hero: blueTeam.hero,
            units: [...blueTeam.units]
        },
        team2: {
            teamId: "red", 
            teamName: redTeam.name,
            hero: redTeam.hero,
            units: [...redTeam.units]
        }
    };
    
    console.log('Created matchInfo:', matchInfo);
    return matchInfo;
}

function showBattleScreen() {
    const selectionScreen = document.getElementById('selection-screen');
    const battleScreen = document.getElementById('battle-screen');
    
    if (selectionScreen) selectionScreen.classList.add('hidden');
    if (battleScreen) battleScreen.classList.remove('hidden');
    requestAnimationFrame(() => {
        if (battleGraphics && battleGraphics.resizeBoard) battleGraphics.resizeBoard();
        window.dispatchEvent(new Event('resize'));
    });
}

function showSelectionScreen() {
    destroyBattleGraphics();
    const battleScreen = document.getElementById('battle-screen');
    const selectionScreen = document.getElementById('selection-screen');
    
    if (battleScreen) battleScreen.classList.add('hidden');
    if (selectionScreen) selectionScreen.classList.remove('hidden');
}

let battleGraphics = null;

// Cài đặt AI chọn ở màn hình chuẩn bị, nhớ lại giữa các lần chơi.
const aiSettings = {
    mode: localStorage.getItem('sc_ai_mode') || 'red',
    timeMs: parseInt(localStorage.getItem('sc_ai_time') || '3000', 10)
};

let mobilePickStep = 1;

function playerTeamColor() {
    return aiSettings.mode === 'blue' ? 'red' : 'blue';
}

function otherTeamColor() {
    return playerTeamColor() === 'blue' ? 'red' : 'blue';
}

function teamLabel(color) {
    return color === 'blue' ? t('ai.blue') : t('ai.red');
}

function isMobilePick() {
    return window.matchMedia('(max-width: 767px)').matches;
}

function applyMobilePickStep() {
    const blue = document.getElementById('blue-team-panel');
    const red = document.getElementById('red-team-panel');
    const title = document.getElementById('mobile-pick-title');
    const hint = document.getElementById('mobile-pick-hint');
    const nextBtn = document.getElementById('mobile-pick-next');
    const startBtn = document.getElementById('global-start-btn-mobile');
    const backBtn = document.getElementById('mobile-pick-back');
    if (!blue || !red) return;

    if (!isMobilePick()) {
        blue.classList.remove('hidden');
        red.classList.remove('hidden');
        blue.classList.add('md:block');
        red.classList.add('md:block');
        if (nextBtn) nextBtn.classList.add('hidden');
        if (startBtn) {
            startBtn.classList.remove('hidden');
            const bothReady = teamManagers && teamManagers.blue.isReady() && teamManagers.red.isReady();
            startBtn.disabled = !bothReady;
        }
        if (backBtn) backBtn.classList.add('hidden');
        return;
    }

    if (mobilePickStep !== 1 && mobilePickStep !== 2) mobilePickStep = 1;
    const you = playerTeamColor();
    const other = otherTeamColor();
    const show = mobilePickStep === 1 ? you : other;
    blue.classList.toggle('hidden', show !== 'blue');
    red.classList.toggle('hidden', show !== 'red');
    blue.classList.add('md:block');
    red.classList.add('md:block');

    const youReady = teamManagers && teamManagers[you] && teamManagers[you].isReady();
    const otherReady = teamManagers && teamManagers[other] && teamManagers[other].isReady();

    if (title) {
        if (aiSettings.mode === 'both') {
            title.textContent = mobilePickStep === 1
                ? t('ai.stepBoth1', { team: teamLabel(you) })
                : t('ai.stepBoth2', { team: teamLabel(other) });
        } else if (mobilePickStep === 1) {
            title.textContent = t('ai.stepYou', { team: teamLabel(you) });
        } else if (aiSettings.mode === 'off') {
            title.textContent = t('ai.stepOpp', { team: teamLabel(other) });
        } else {
            title.textContent = t('ai.stepAi', { team: teamLabel(other) });
        }
    }
    if (hint) {
        if (mobilePickStep === 1) hint.textContent = t('ai.stepHintYou');
        else if (aiSettings.mode === 'off') hint.textContent = t('ai.stepHintOpp');
        else hint.textContent = t('ai.stepHintAi');
    }
    if (backBtn) backBtn.classList.toggle('hidden', mobilePickStep !== 2);

    if (nextBtn && startBtn) {
        if (mobilePickStep === 1) {
            nextBtn.classList.remove('hidden');
            startBtn.classList.add('hidden');
            nextBtn.disabled = !youReady;
            const nextLabel = nextBtn.querySelector('[data-i18n]') || nextBtn;
            if (aiSettings.mode === 'off') nextLabel.textContent = t('ai.nextOpp');
            else if (aiSettings.mode === 'both') nextLabel.textContent = t('ai.nextTeam');
            else nextLabel.textContent = t('ai.nextAi');
        } else {
            nextBtn.classList.add('hidden');
            startBtn.classList.remove('hidden');
            startBtn.disabled = !otherReady;
        }
    }
}

function paintAiSettings() {
    document.querySelectorAll('.ai-side-btn').forEach(btn => {
        const on = btn.dataset.mode === aiSettings.mode;
        btn.classList.toggle('border-green-400', on);
        btn.classList.toggle('bg-green-700', on);
        btn.classList.toggle('bg-gray-700', !on);
        btn.classList.toggle('border-transparent', !on);
    });
    document.querySelectorAll('.ai-time-btn').forEach(btn => {
        const on = parseInt(btn.dataset.ms, 10) === aiSettings.timeMs;
        btn.classList.toggle('border-green-400', on);
        btn.classList.toggle('bg-green-700', on);
        btn.classList.toggle('bg-gray-700', !on);
        btn.classList.toggle('border-transparent', !on);
    });
}

function setupAiSettings() {
    document.querySelectorAll('.ai-side-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            aiSettings.mode = btn.dataset.mode;
            localStorage.setItem('sc_ai_mode', aiSettings.mode);
            paintAiSettings();
            mobilePickStep = 1;
            applyMobilePickStep();
        });
    });
    document.querySelectorAll('.ai-time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            aiSettings.timeMs = parseInt(btn.dataset.ms, 10);
            localStorage.setItem('sc_ai_time', String(aiSettings.timeMs));
            paintAiSettings();
        });
    });
    paintAiSettings();
}

function initializeBattleGraphics(matchInfo) {
    if (!P5BattleGraphics) {
        console.error('P5BattleGraphics not loaded');
        return;
    }

    destroyBattleGraphics();
    
    try {
        battleGraphics = new P5BattleGraphics(matchInfo, {
            mode: aiSettings.mode,
            timeMs: aiSettings.timeMs,
            autoPlay: true,
            onUpdate: updateAiStatusLine,
            onHudUpdate: renderBattleHud
        });
        console.log('P5 Battle graphics initialized successfully');
        updateAiStatusLine(battleGraphics.ai);
        renderBattleHud(battleGraphics);
        requestAnimationFrame(() => {
            if (battleGraphics && battleGraphics.resizeBoard) battleGraphics.resizeBoard();
        });
    } catch (error) {
        console.error('Error initializing P5 battle graphics:', error);
    }
}

function destroyBattleGraphics() {
    if (!battleGraphics) return;
    if (battleGraphics.destroy) battleGraphics.destroy();
    battleGraphics = null;
    const canvasHost = document.getElementById('battle-canvas-container');
    if (canvasHost) canvasHost.innerHTML = '';
}

function updateAiStatusLine(driver) {
    const el = document.getElementById('ai-status-line');
    if (!el || !driver) return;
    el.textContent = driver.statusLine();
    el.classList.toggle('text-yellow-300', !!driver.thinking);
    el.classList.toggle('text-amber-200', !driver.thinking);
    const autoBtn = document.getElementById('ai-auto-btn');
    if (autoBtn) {
        autoBtn.textContent = driver.autoPlay ? t('ai.autoOn') : t('ai.auto');
        autoBtn.classList.toggle('bg-green-700', !!driver.autoPlay);
        autoBtn.classList.toggle('bg-gray-700', !driver.autoPlay);
    }
}

function effectBadgesHtml(unit) {
    if (!unit || !unit.effects) return '';
    const parts = [];
    const lock = unit.effects.find(e => e.name === 'lock' && (e.duration === undefined || e.duration > 0));
    if (lock)         parts.push(`<span class="text-[9px] bg-purple-800 text-purple-100 px-1 rounded">${t('ai.lock')}</span>`);
    if (unit.effects.some(e => e.name === 'adjacent penalty')) {
        parts.push(`<span class="text-[9px] bg-red-800 text-red-100 px-1 rounded">${t('ai.noAttack')}</span>`);
    }
    const dash = unit.effects.find(e => e.name === 'dash' && (e.duration === undefined || e.duration > 0));
    if (dash) parts.push(`<span class="text-[9px] bg-sky-800 text-sky-100 px-1 rounded">${t('ai.dash')}</span>`);
    return parts.length ? `<span class="inline-flex gap-0.5 ml-1">${parts.join('')}</span>` : '';
}

function unitPortrait(unit, teamId) {
    const def = UNIT_TYPES && UNIT_TYPES[unit.armyType || unit.name];
    const color = teamId === 'red' ? 'red' : 'blue';
    if (def && def[`image_${color}`]) return def[`image_${color}`];
    return '';
}

function renderTeamColumn(team, headerId, listId, accent) {
    if (!battleGraphics) return;
    const gl = battleGraphics.gameLogic;
    const header = document.getElementById(headerId);
    const list = document.getElementById(listId);
    if (!header || !list) return;

    const isTurn = team.teamId === gl.currentTurnTeamId;
    const mp = gl._calculateTeamMovementPoint(team.teamId);
    const prio = team.teamId === gl.priorityTeamId;
    const aside = document.getElementById(accent === 'blue' ? 'blue-battle-aside' : 'red-battle-aside');
    if (aside) {
        aside.classList.toggle('ring-2', isTurn);
        aside.classList.toggle('ring-green-400', isTurn);
    }

    const nameColor = accent === 'blue' ? 'text-blue-300' : 'text-red-300';
    header.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="font-bold ${nameColor}">${team.teamName || team.teamId}</div>
            ${isTurn ? `<span class="text-[10px] bg-green-700 text-white px-1.5 py-0.5 rounded">${t('ai.turn')}</span>` : ''}
        </div>
        <div class="text-xs text-gray-300 mt-0.5">MP ${mp}${prio ? ' · ' + t('ai.priority') : ''} · ${t('ai.round', { n: gl.roundNo })}</div>
    `;

    const units = team.units.filter(u => u.hp > 0);
    list.innerHTML = '';
    units.forEach(unit => {
        const ended = gl.hasEndedTurn(unit);
        const isCurrent = gl.currentTurnUnit && gl.currentTurnUnit.id === unit.id;
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `w-full flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs ${
            isCurrent ? 'bg-yellow-700/50 ring-1 ring-yellow-400' : ended ? 'opacity-40' : 'hover:bg-gray-700'
        }`;
        const img = unitPortrait(unit, team.teamId);
        const maxHp = UNIT_TYPES && UNIT_TYPES[unit.name] ? UNIT_TYPES[unit.name].hp : unit.hp;
        const tags = [];
        if (ended && unit.name !== 'Base') tags.push(t('ai.acted'));
        const badges = effectBadgesHtml(unit);
        row.innerHTML = `
            ${img ? `<img src="${img}" alt="" class="w-7 h-7 flex-shrink-0">` : ''}
            <div class="min-w-0 flex-1">
                <div class="truncate flex items-center gap-1">${unit.name}${badges}</div>
                <div class="text-[10px] text-gray-400">HP ${unit.hp}/${maxHp}${tags.length ? ' · ' + tags.join(' · ') : ''}</div>
            </div>
        `;
        row.addEventListener('click', () => {
            if (!battleGraphics) return;
            if (unit.name === 'Base') return;
            if (battleGraphics.canSelectUnit(unit)) {
                battleGraphics.gameLogic.currentTurnUnit = unit;
            }
        });
        list.appendChild(row);
    });
}

function currentUnitMarkup(compact) {
    if (!battleGraphics) return '';
    const unit = battleGraphics.gameLogic.currentTurnUnit;
    if (!unit) {
        return compact
            ? `<div class="text-xs text-gray-500">${t('ai.noUnitCompact')}</div>`
            : `<div class="text-xs text-gray-400">${t('ai.current')}</div>
            <div class="text-sm text-gray-500 mt-1">${t('ai.noUnit')}</div>`;
    }
    const img = unitPortrait(unit, unit.teamId);
    const badges = effectBadgesHtml(unit);
    return `
        <div class="${compact ? '' : 'text-xs text-gray-400 mb-1'}">
            ${compact ? '' : `${t('ai.current')} <span class="text-gray-500">${t('ai.tapDeselect')}</span>`}
        </div>
        <div class="flex items-center gap-2">
            ${img ? `<img src="${img}" alt="" class="${compact ? 'w-8 h-8' : 'w-10 h-10'}">` : ''}
            <div>
                <div class="font-semibold text-sm flex items-center">${unit.name}${badges}</div>
                <div class="text-xs text-gray-300">HP ${unit.hp} · Speed ${unit.speed} · Range ${unit.range}</div>
            </div>
        </div>
    `;
}

function renderCurrentUnitPanel() {
    const el = document.getElementById('current-unit-panel');
    if (el) el.innerHTML = currentUnitMarkup(false);
    const mobile = document.getElementById('mobile-current-unit');
    if (mobile) mobile.innerHTML = currentUnitMarkup(true);
}

function renderMobileRoster(graphics) {
    const bar = document.getElementById('mobile-roster');
    const mpBlue = document.getElementById('mobile-mp-blue');
    const mpRed = document.getElementById('mobile-mp-red');
    if (!bar || !graphics) return;
    const gl = graphics.gameLogic;
    if (mpBlue) mpBlue.textContent = `B ${gl._calculateTeamMovementPoint('blue')}`;
    if (mpRed) mpRed.textContent = `R ${gl._calculateTeamMovementPoint('red')}`;

    bar.innerHTML = '';
    const teams = [graphics.matchInfo.team1, graphics.matchInfo.team2];
    teams.forEach(team => {
        team.units.filter(u => u.hp > 0 && u.name !== 'Base').forEach(unit => {
            const ended = gl.hasEndedTurn(unit);
            const isCurrent = gl.currentTurnUnit && gl.currentTurnUnit.id === unit.id;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `flex-shrink-0 rounded p-0.5 ${isCurrent ? 'ring-2 ring-yellow-400' : ended ? 'opacity-40' : ''}`;
            const img = unitPortrait(unit, team.teamId);
            const ring = team.teamId === 'red' ? 'border-red-500' : 'border-blue-500';
            btn.innerHTML = `
                <img src="${img}" alt="${unit.name}" class="w-9 h-9 border ${ring} rounded">
                ${effectBadgesHtml(unit)}
            `;
            btn.title = unit.name;
            btn.addEventListener('click', () => {
                if (graphics.canSelectUnit(unit)) {
                    graphics.gameLogic.currentTurnUnit = unit;
                }
            });
            bar.appendChild(btn);
        });
    });
}

function renderBattleHud(graphics) {
    if (!graphics) return;
    renderTeamColumn(graphics.matchInfo.team1, 'blue-team-header', 'blue-team-units', 'blue');
    renderTeamColumn(graphics.matchInfo.team2, 'red-team-header', 'red-team-units', 'red');
    renderCurrentUnitPanel();
    renderMobileRoster(graphics);
}

function handleEndTurn() {
    if (!battleGraphics) return;
    const gameLogic = battleGraphics.gameLogic;

    if (gameLogic.currentTurnUnit === null) {
        const currentTeam = gameLogic.matchInfo.team1.teamId === gameLogic.currentTurnTeamId ?
            gameLogic.matchInfo.team1 : gameLogic.matchInfo.team2;
        const availableUnit = currentTeam.units.find(unit =>
            unit.hp > 0 &&
            unit.name !== 'Base' &&
            !gameLogic.hasEndedTurn(unit)
        );
        if (availableUnit) {
            gameLogic.markEndedTurn(availableUnit);
        }
    } else {
        gameLogic.endTurn();
    }
    gameLogic.newTurn();
}


// Chat functionality
function initializeChat() {
    console.log('Initializing chat functionality...');
    
    // Connect to chat namespace
    chatSocket = io('/chat');
    
    // Chat UI elements
    const chatContainer = document.getElementById('chat-container');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-message');
    const toggleButton = document.getElementById('toggle-chat');
    const usernameInput = document.getElementById('username-input');
    const changeUsernameButton = document.getElementById('change-username');
    const onlineCount = document.getElementById('online-count');
    
    // Toggle chat visibility
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            chatContainer.classList.toggle('hidden');
            if (!chatContainer.classList.contains('hidden')) {
                chatInput.focus();
            }
        });
    }
    
    // Send message
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message && chatSocket) {
            chatSocket.emit('chat:message', { message });
            chatInput.value = '';
        }
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Change username
    if (changeUsernameButton) {
        changeUsernameButton.addEventListener('click', () => {
            const newUsername = usernameInput.value.trim();
            if (newUsername && chatSocket) {
                chatSocket.emit('user:change_username', { username: newUsername });
                usernameInput.value = '';
            }
        });
    }
    
    // Socket event handlers
    chatSocket.on('connect', () => {
        console.log('Connected to chat server');
        if (chatMessages) {
            chatMessages.innerHTML = `<div class="text-center text-green-500 text-sm">${t('chat.connected')}</div>`;
        }
    });
    
    chatSocket.on('user:connected', (data) => {
        currentUser = data;
        console.log('User connected:', data);
        if (chatMessages) {
            chatMessages.innerHTML = `<div class="text-center text-green-500 text-sm">${t('chat.welcome')}</div>`;
        }
        if (onlineCount) {
            updateOnlineCount(data.onlineUsers.length);
        }
    });
    
    chatSocket.on('chat:messages', (messages) => {
        displayMessages(messages);
    });
    
    chatSocket.on('chat:message', (message) => {
        addMessage(message);
    });
    
    chatSocket.on('user:joined', (data) => {
        addSystemMessage(`${data.username} joined the chat`);
        if (onlineCount) {
            updateOnlineCount(data.onlineUsers.length);
        }
    });
    
    chatSocket.on('user:left', (data) => {
        addSystemMessage(`${data.username} left the chat`);
        if (onlineCount) {
            updateOnlineCount(data.onlineUsers.length);
        }
    });
    
    chatSocket.on('user:username_changed', (data) => {
        if (data.userId === currentUser?.userId) {
            currentUser.username = data.newUsername;
        }
        addSystemMessage(`${data.oldUsername} changed name to ${data.newUsername}`);
    });
    
    chatSocket.on('chat:typing', (data) => {
        // Handle typing indicator
        console.log(`${data.username} is typing...`);
    });
    
    chatSocket.on('error', (data) => {
        addSystemMessage(`Error: ${data.message}`, 'error');
    });
    
    chatSocket.on('disconnect', () => {
        addSystemMessage('Disconnected from chat server', 'error');
    });
    
    // Helper functions
    function displayMessages(messages) {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        messages.forEach(message => addMessage(message));
    }
    
    function addMessage(message) {
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-2';
        
        const time = new Date(message.timestamp).toLocaleTimeString();
        const isOwnMessage = message.userId === currentUser?.userId;
        
        messageDiv.innerHTML = `
            <div class="flex ${isOwnMessage ? 'justify-end' : 'justify-start'}">
                <div class="max-w-xs ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'} rounded-lg px-3 py-2">
                    <div class="text-xs text-gray-300 mb-1">${message.username} • ${time}</div>
                    <div class="text-sm">${escapeHtml(message.message)}</div>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function addSystemMessage(message, type = 'info') {
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-2 text-center';
        
        const colorClass = type === 'error' ? 'text-red-400' : 'text-gray-400';
        
        messageDiv.innerHTML = `
            <div class="text-xs ${colorClass} italic">${escapeHtml(message)}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function updateOnlineCount(count) {
        if (onlineCount) {
            onlineCount.textContent = t('home.online', { n: count });
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
