// Canvas 2D Battle Graphics cho Multiplayer - chỉ render, không xử lý game logic
import { BOARD_COLS, BOARD_ROWS, UNIT_TYPES } from '/core-logic/definitions.js';
import { t } from './i18n.js';
import GameLogic from '/core-logic/game-logic.js';
import { mountCanvas, loadImages, drawImage, rgba, fillTriangle, drawHpHearts, drawActedMarker, unitHasActed } from './canvas-2d.js';

class BattleGraphicsMultiplayer {
    constructor(matchInfo, gameSocket, currentUserId, playerTeam) {
        
        this.matchInfo = matchInfo;
        this.gameSocket = gameSocket;
        this.currentUserId = currentUserId;
        this.playerTeam = playerTeam; // 'blue' or 'red'
        this.gameLogic = null; // Will be updated from server
        
        // Perspective settings - always show player team at bottom
        this.isPlayerBlue = (playerTeam === 'blue');
        
        // UI state
        this.selectedUnit = null;
        this.highlightedCells = [];
        this.actionIndicators = [];
        this.currentTurnActionArrows = [];
        this.lastTurnTeamId = null;
        
        // Device detection and responsive sizing
        this.deviceType = this.detectDeviceType();
        this.viewportSize = this.getViewportSize();
        
        // Canvas dimensions - now responsive
        const canvasConfig = this.calculateCanvasSize();
        this.canvasWidth = canvasConfig.width;
        this.canvasHeight = canvasConfig.height;
        this.topPanelHeight = canvasConfig.topPanelHeight;
        
        // Calculate cell size with responsive constraints
        this.cellSize = this.calculateCellSize();
        
        // Cell dimensions are set by calculateCellSize method
        // this.cellWidth and this.cellHeight are already set
        
        // Board positioning
        this.boardWidth = BOARD_COLS * this.cellWidth;
        this.boardHeight = BOARD_ROWS * this.cellHeight;
        
        // For mobile: center board horizontally, top panel at top
        if (this.deviceType === 'mobile') {
            this.offsetX = 0; // No horizontal offset for mobile (already centered by margin)
            this.offsetY = this.topPanelHeight + 5; // 5px gap below top panel
        } else {
            // For tablet/desktop: center board in canvas
            this.offsetX = (this.canvasWidth - this.boardWidth) / 2;
            this.offsetY = this.topPanelHeight + 5;
        }
        
        this.images = {};
        this.host = null;
        this.ctx = null;
        this.loadImages();
        this.initCanvas();
    }

    // Device detection and responsive sizing methods
    detectDeviceType() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Mobile detection
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
                        (width <= 768 && height <= 1024);
        
        // Tablet detection
        const isTablet = !isMobile && (width <= 1024 && width > 768);
        
        if (isMobile) return 'mobile';
        if (isTablet) return 'tablet';
        return 'desktop';
    }
    
    getViewportSize() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }
    
    calculateCanvasSize() {
        const { width: viewportWidth, height: viewportHeight } = this.viewportSize;
        
        let config = {
            width: 800,
            height: 730,
            topPanelHeight: 100
        };
        
        switch (this.deviceType) {
            case 'mobile':
                // Mobile: Fixed layout with specific measurements
                const mobileMargin = 5; // 5px margin each side
                const availableWidth = viewportWidth - (mobileMargin * 2); // Total 10px margin
                const topPanelHeight = 100; // Fixed 100px top panel
                
                // Calculate cell dimensions
                const cellWidth = availableWidth / BOARD_COLS; // (W - 10) / 11
                const cellHeight = cellWidth * 1.1; // 110% of width
                
                // Calculate total board height
                const boardHeight = BOARD_ROWS * cellHeight;
                
                // Calculate total canvas height needed
                const totalCanvasHeight = topPanelHeight + boardHeight + 10; // 10px bottom margin
                
                config.width = availableWidth;
                config.height = Math.min(totalCanvasHeight, viewportHeight * 0.95); // Max 95% of viewport
                config.topPanelHeight = topPanelHeight;
                break;
                
            case 'tablet':
                // Tablet: Balanced approach
                const tabletWidth = Math.min(viewportWidth * 0.9, 800);
                const tabletHeight = Math.min(viewportHeight * 0.85, 650);
                config.width = tabletWidth;
                config.height = tabletHeight;
                config.topPanelHeight = Math.max(70, tabletWidth * 0.1);
                break;
                
            case 'desktop':
            default:
                // Desktop: Keep original size
                break;
        }
        
        return config;
    }
    
    calculateCellSize() {
        const gameAreaHeight = this.canvasHeight - this.topPanelHeight;
        
        // Calculate cell sizes separately for width and height
        const cellWidth = this.canvasWidth / BOARD_COLS;
        const cellHeight = gameAreaHeight / BOARD_ROWS;
        
        // For mobile: use fixed layout calculations
        if (this.deviceType === 'mobile') {
            // Use the calculated values from calculateCanvasSize
            const mobileMargin = 5;
            const availableWidth = this.canvasWidth;
            const calculatedCellWidth = availableWidth / BOARD_COLS;
            const calculatedCellHeight = calculatedCellWidth * 1.1;
            
            this.cellWidth = calculatedCellWidth;
            this.cellHeight = calculatedCellHeight;
            
            return calculatedCellHeight; // Return height as primary cell size
        }
        
        // For tablet and desktop: keep square cells
        const baseCellSize = Math.min(cellWidth, cellHeight);
        
        let minCellSize, maxCellSize;
        switch (this.deviceType) {
            case 'tablet':
                minCellSize = 30;
                maxCellSize = 50;
                break;
            case 'desktop':
            default:
                minCellSize = 35;
                maxCellSize = 60;
                break;
        }
        
        const constrainedSize = Math.max(minCellSize, Math.min(maxCellSize, baseCellSize));
        this.cellWidth = constrainedSize;
        this.cellHeight = constrainedSize;
        
        return constrainedSize;
    }
    
    handleWindowResize() {
        // Debounce resize events
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = setTimeout(() => {
            // Update viewport size
            this.viewportSize = this.getViewportSize();
            
            // Recalculate canvas size
            const canvasConfig = this.calculateCanvasSize();
            this.canvasWidth = canvasConfig.width;
            this.canvasHeight = canvasConfig.height;
            this.topPanelHeight = canvasConfig.topPanelHeight;
            
            // Recalculate cell size
            this.cellSize = this.calculateCellSize();
            
            // Update board dimensions
            this.boardWidth = BOARD_COLS * this.cellWidth;
            this.boardHeight = BOARD_ROWS * this.cellHeight;
            
            // Update board positioning based on device type
            if (this.deviceType === 'mobile') {
                this.offsetX = 0; // No horizontal offset for mobile
                this.offsetY = this.topPanelHeight + 5;
            } else {
                this.offsetX = (this.canvasWidth - this.boardWidth) / 2;
                this.offsetY = this.topPanelHeight + 5;
            }
            
            if (this.host) {
                this.host.setCssSize(this.canvasWidth, this.canvasHeight);
            }
            
            console.log(`📱 Canvas resized for ${this.deviceType}: ${this.canvasWidth}x${this.canvasHeight}, cellSize: ${this.cellWidth.toFixed(1)}x${this.cellHeight.toFixed(1)}px`);
        }, 250); // 250ms debounce
    }
    
    // Debug method to show responsive info
    logResponsiveInfo() {
        console.log('📱 Responsive Canvas Info:', {
            deviceType: this.deviceType,
            viewport: this.viewportSize,
            canvas: { width: this.canvasWidth, height: this.canvasHeight },
            cellSize: { width: this.cellWidth, height: this.cellHeight },
            board: { width: this.boardWidth, height: this.boardHeight },
            offsets: { x: this.offsetX, y: this.offsetY },
            topPanelHeight: this.topPanelHeight
        });
        
        // Mobile layout verification
        if (this.deviceType === 'mobile') {
            const expectedCellWidth = (this.viewportSize.width - 10) / BOARD_COLS;
            const expectedCellHeight = expectedCellWidth * 1.1;
            console.log('📐 Mobile Layout Check:', {
                expectedCellWidth: expectedCellWidth.toFixed(1),
                actualCellWidth: this.cellWidth.toFixed(1),
                expectedCellHeight: expectedCellHeight.toFixed(1),
                actualCellHeight: this.cellHeight.toFixed(1),
                topPanelHeight: this.topPanelHeight,
                aspectRatio: (this.cellHeight / this.cellWidth).toFixed(2)
            });
        }
    }

    loadImages() {
        this.imagePaths = {};
        Object.keys(UNIT_TYPES).forEach(unitType => {
            const unitData = UNIT_TYPES[unitType];
            if (unitData.image_blue) {
                this.imagePaths[`${unitType}_blue`] = unitData.image_blue;
            }
            if (unitData.image_red) {
                this.imagePaths[`${unitType}_red`] = unitData.image_red;
            }
        });
    }

    initCanvas() {
        this.host = mountCanvas('game-canvas-container');
        this.ctx = this.host.ctx;
        this.host.setCssSize(this.canvasWidth, this.canvasHeight);

        this.images = loadImages(this.imagePaths);

        this._onPointer = (e) => {
            e.preventDefault();
            const { x, y } = this.host.eventToLocal(e);
            this.handleCanvasClick(x, y);
        };
        this.host.canvas.addEventListener('pointerdown', this._onPointer);

        this._onKey = (e) => {
            this.handleKeyPress(e.key);
        };
        window.addEventListener('keydown', this._onKey);

        this._onResize = () => this.handleWindowResize();
        window.addEventListener('resize', this._onResize);

        this.host.startLoop(() => this.draw());
    }

    destroy() {
        if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
        if (this.host) {
            this.host.canvas.removeEventListener('pointerdown', this._onPointer);
            window.removeEventListener('keydown', this._onKey);
            window.removeEventListener('resize', this._onResize);
            this.host.destroy();
            this.host = null;
        }
        this.ctx = null;
    }

    // Update game state from server
    updateGameState(gameState) {
        
        // Store server game state for movement points
        this.serverGameState = gameState;
        
        if (gameState && gameState.gameBoard) {
            // Server sends gameLogic as plain object - need to recreate GameLogic instance
            const gameLogicData = gameState.gameBoard;
            
            if (gameLogicData.matchInfo) {
                // Create new GameLogic instance from server data
                this.gameLogic = new GameLogic(gameLogicData.matchInfo);
                
                // Restore state from server
                this.gameLogic.roundNo = gameLogicData.roundNo || 0;
                this.gameLogic.priorityTeamId = gameLogicData.priorityTeamId;
                this.gameLogic.alreadyEndedTurnUnits = gameLogicData.alreadyEndedTurnUnits || [];
                this.gameLogic.currentTurnUnit = gameLogicData.currentTurnUnit;
                this.gameLogic.currentTurnTeamId = gameLogicData.currentTurnTeamId;
                this.gameLogic.currentTurnActions = gameLogicData.currentTurnActions || {
                    hasMoved: false,
                    hasAttacked: false,
                    hasHealed: false,
                    hasSacrificed: false,
                    hasSuicided: false
                };
                
                // Track team changes for other purposes (no arrow clearing needed)
                if (this.lastTurnTeamId !== null && this.lastTurnTeamId !== this.gameLogic.currentTurnTeamId) {
                    console.log('🔄 Team turn changed from', this.lastTurnTeamId, 'to', this.gameLogic.currentTurnTeamId);
                    // Note: Arrow clearing now handled per-action, not per-team-change
                }
                
                this.lastTurnTeamId = this.gameLogic.currentTurnTeamId;
                
                // Clear selection in appropriate cases
                const shouldClearSelection = 
                    // Not our turn anymore
                    this.gameLogic.currentTurnTeamId !== this.playerTeam ||
                    // Selected unit has ended turn (check by ID)
                    (this.selectedUnit && this.gameLogic.alreadyEndedTurnUnits && 
                     this.gameLogic.alreadyEndedTurnUnits.some(endedUnit => endedUnit.id === this.selectedUnit.id)) ||
                    // Selected unit is dead
                    (this.selectedUnit && this.selectedUnit.hp <= 0);
                
                if (shouldClearSelection) {
            this.selectedUnit = null;
                    this.highlightedCells = [];
                    // Clear UI info
                    if (window.updateSelectedUnitInfo) window.updateSelectedUnitInfo(null);
                    if (window.updateActionInfo) window.updateActionInfo('');
                } else if (this.selectedUnit) {
                    // 🎯 CRITICAL: Tìm unit với updated data từ server bằng ID
                    const allUnits = [...this.gameLogic.matchInfo.team1.units, ...this.gameLogic.matchInfo.team2.units];
                    const updatedUnit = allUnits.find(unit => unit.id === this.selectedUnit.id);
                    
                    if (updatedUnit && updatedUnit.hp > 0) {
                        // Update selected unit reference với server data (bao gồm position mới)
                        this.selectedUnit = updatedUnit;
                        // Update highlights for current selection với new position
                        this.updateHighlights();
                        // Update UI
                        if (window.updateSelectedUnitInfo) window.updateSelectedUnitInfo(updatedUnit);
                    } else {
                        // Unit đã chết hoặc không tìm thấy, clear selection
                        this.selectedUnit = null;
                        this.highlightedCells = [];
                        if (window.updateSelectedUnitInfo) window.updateSelectedUnitInfo(null);
                        if (window.updateActionInfo) window.updateActionInfo('');
                    }
                }
            }
        }
    }

    // Clear current selection
    clearSelection() {
            this.selectedUnit = null;
        this.highlightedCells = [];
        
        // Clear UI info
        if (window.updateSelectedUnitInfo) {
            window.updateSelectedUnitInfo(null);
        }
        
        if (window.updateActionInfo) {
            const isMyTurn = this.gameLogic && this.gameLogic.currentTurnTeamId === this.playerTeam;
            if (isMyTurn) {
                window.updateActionInfo('Select a unit to see available actions');
            } else {
                window.updateActionInfo("Opponent's turn");
            }
        }
    }

    // Action visualization methods
    addActionVisualization(actionDetails) {
        if (!actionDetails) {
            console.warn('❌ actionDetails is null/undefined');
            return;
        }
        
        const arrows = this.createActionArrow(actionDetails);
        
        if (arrows) {
            if (Array.isArray(arrows)) {
                // Multiple arrows (e.g., suicide)
                this.currentTurnActionArrows.push(...arrows);
            } else {
                // Single arrow
                this.currentTurnActionArrows.push(arrows);
            }
        } else {
            console.warn('❌ createActionArrow returned null/undefined for:', actionDetails.type);
        }
    }

    // 🔧 PHASE 3: Death-aware arrow creation using server arrowData
    createActionArrow(details) {
        if (!details) {
            console.warn('❌ createActionArrow: details is null/undefined');
            return null;
        }

        // Use new arrowData structure from server (with death handling)
        if (details.arrowData && Array.isArray(details.arrowData)) {
            const arrows = details.arrowData.map(arrowData => this.createSingleArrow(arrowData, details));
            return arrows;
        }

        // Fallback for old format (backward compatibility)
        console.warn('⚠️ Using fallback arrow creation for:', details.type);
        return this.createLegacyArrow(details);
    }

    // Create individual arrow with death-aware styling
    createSingleArrow(arrowData, actionDetails) {
        // ✅ FIXED: Use raw server coordinates - getBoardPosition() handles perspective transformation
        const baseArrow = {
            from: arrowData.from,
            to: arrowData.to,
            metadata: {
                actionType: actionDetails.type,
                deaths: actionDetails.deaths || [],
                style: arrowData.style,
                timestamp: actionDetails.timestamp
            }
        };

        // ✅ Style-specific customization based on death analysis
        switch (arrowData.style) {
            case 'move':
                return { 
                    ...baseArrow, 
                    color: [0, 100, 255, 120], 
                    style: 'solid', 
                    width: 8 
                };
            
            case 'damage':
                return { 
                    ...baseArrow, 
                    color: [255, 99, 71, 120], 
                    style: 'solid', 
                    width: 8 
                };
            
            case 'kill':
                return { 
                    ...baseArrow, 
                    color: [255, 0, 0, 150], 
                    style: 'solid', 
                    width: 11 
                };
            
            case 'suicide_kill':
                return { 
                    ...baseArrow, 
                    color: [255, 0, 0, 150], 
                    style: 'solid', 
                    width: 11 
                };
            
            case 'suicide_damage':
                return { 
                    ...baseArrow, 
                    color: [255, 165, 0, 120], 
                    style: 'solid', 
                    width: 8 
                };
            
            case 'sacrifice':
                return { 
                    ...baseArrow, 
                    color: [148, 0, 211, 120], 
                    style: 'solid', 
                    width: 8 
                };
            
            case 'sacrifice_death':
                return { 
                    ...baseArrow, 
                    color: [75, 0, 130, 150], 
                    style: 'dashed', 
                    width: 10 
                };
            
            case 'heal':
                return { 
                    ...baseArrow, 
                    color: [0, 255, 0, 120], 
                    style: 'solid', 
                    width: 7 
                };
            
            default:
                console.warn('Unknown arrow style:', arrowData.style);
                return { 
                    ...baseArrow, 
                    color: [128, 128, 128, 120], 
                    style: 'solid', 
                    width: 6 
                };
        }
    }

    // Legacy arrow creation for backward compatibility
    createLegacyArrow(details) {
        switch(details.type) {
            case 'move':
                return {
                    from: details.fromPosition,
                    to: details.toPosition,
                    color: [0, 100, 255, 120],
                    style: 'solid',
                    width: 8,
                    metadata: { actionType: 'move', style: 'move' }
                };
                
            case 'attack':
                if (!details.attacker || !details.target) {
                    console.warn('❌ Attack arrow: Missing attacker or target');
                    return null;
                }
                
                return {
                    from: { row: details.attacker.row, col: details.attacker.col },
                    to: { row: details.target.row, col: details.target.col },
                    color: [255, 0, 0, 120],
                    style: 'solid',
                    width: 8,
                    metadata: { actionType: 'attack', style: 'damage' }
                };
                
            case 'heal':
                return {
                    from: { row: details.healer.row, col: details.healer.col },
                    to: { row: details.target.row, col: details.target.col },
                    color: [0, 255, 0, 120],
                    style: 'solid',
                    width: 7,
                    metadata: { actionType: 'heal', style: 'heal' }
                };
                
            case 'sacrifice':
                return {
                    from: { row: details.sacrificer.row, col: details.sacrificer.col },
                    to: { row: details.target.row, col: details.target.col },
                    color: [148, 0, 211, 120],
                    style: 'solid',
                    width: 8,
                    metadata: { actionType: 'sacrifice', style: 'sacrifice' }
                };
                
            case 'suicide':
                if (!details.affectedTargets || details.affectedTargets.length === 0) {
                    return null;
                }
                
                return details.affectedTargets.map(target => ({
                    from: details.suicidePosition,
                    to: { row: target.row, col: target.col },
                    color: [139, 0, 0, 120],
                    style: 'dashed',
                    width: 10,
                    metadata: { actionType: 'suicide', style: 'suicide_kill' }
                }));
                
            default:
                console.warn('Unknown legacy action type:', details.type);
                return null;
        }
    }

    clearActionArrows() {
        this.currentTurnActionArrows = [];
    }

    // Main draw function
    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = rgba(40, 40, 50);
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        if (!this.gameLogic || !this.matchInfo) {
            this.drawLoadingScreen();
            return;
        }

        const gameEndResult = this.gameLogic.isGameEnd ? this.gameLogic.isGameEnd() : 0;
        if (gameEndResult !== 0) {
            this.drawGameEndScreen(gameEndResult);
            return;
        }

        this.drawTopPanel();
        this.drawBoard();
        this.drawHighlights();
        this.drawUnits();
        this.drawActionArrows();
        this.drawActionIndicators();
    }

    drawLoadingScreen() {
        const ctx = this.ctx;
        ctx.fillStyle = rgba(255);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '24px sans-serif';
        ctx.fillText('Loading Game...', this.canvasWidth / 2, this.canvasHeight / 2);
    }

    drawGameEndScreen(result) {
        const ctx = this.ctx;
        ctx.fillStyle = rgba(0, 0, 0, 180);
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        ctx.fillStyle = rgba(255);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '36px sans-serif';

        let resultText = '';
        let resultColor = [255, 255, 255];

        if (result === 1) {
            resultText = this.isPlayerBlue ? t('end.victory') : t('end.defeat');
            resultColor = this.isPlayerBlue ? [0, 255, 0] : [255, 0, 0];
        } else if (result === 2) {
            resultText = this.isPlayerBlue ? t('end.defeat') : t('end.victory');
            resultColor = this.isPlayerBlue ? [255, 0, 0] : [0, 255, 0];
        } else {
            resultText = t('end.drawCaps');
            resultColor = [255, 255, 0];
        }

        const winImg = result === 1 ? this.images['Base_blue'] : result === 2 ? this.images['Base_red'] : null;
        if (winImg) {
            const size = Math.min(this.canvasWidth, this.canvasHeight) * 0.22;
            drawImage(ctx, winImg, this.canvasWidth / 2 - size / 2, this.canvasHeight / 2 - size - 20, size, size);
        }
        ctx.fillStyle = rgba(resultColor[0], resultColor[1], resultColor[2]);
        ctx.fillText(resultText, this.canvasWidth / 2, this.canvasHeight / 2);
    }

    drawTopPanel() {
        const ctx = this.ctx;
        ctx.fillStyle = rgba(60, 60, 70);
        ctx.fillRect(this.offsetX, 0, this.boardWidth, this.topPanelHeight);
        ctx.strokeStyle = rgba(100, 100, 120);
        ctx.lineWidth = 2;
        ctx.strokeRect(this.offsetX, 0, this.boardWidth, this.topPanelHeight);
        
        // Team info
        const teamPanelWidth = this.boardWidth / 3;
        
        // Use gameLogic.matchInfo for updated data
        const matchInfo = this.gameLogic?.matchInfo || this.matchInfo;
        
        // Opponent team (always at top of panel)
        const opponentTeam = this.isPlayerBlue ? matchInfo.team2 : matchInfo.team1;
        this.drawTeamPanel(opponentTeam, this.offsetX, 0, teamPanelWidth, this.topPanelHeight, false);
        
        // Current unit panel (middle)
        this.drawCurrentUnitPanel(this.offsetX + teamPanelWidth, 0, teamPanelWidth, this.topPanelHeight);
        
        // Player team (always at bottom of panel)
        const playerTeam = this.isPlayerBlue ? matchInfo.team1 : matchInfo.team2;
        this.drawTeamPanel(playerTeam, this.offsetX + teamPanelWidth * 2, 0, teamPanelWidth, this.topPanelHeight, true);
    }

    drawTeamPanel(team, x, y, width, height, isPlayerTeam) {
        // Determine if this team has current turn
        const isCurrentTeam = this.gameLogic && team.teamId === this.gameLogic.currentTurnTeamId;
        const isMyTurn = isCurrentTeam && isPlayerTeam;
        
        const ctx = this.ctx;
        ctx.fillStyle = isCurrentTeam ? rgba(60, 120, 60) : rgba(50, 50, 60);
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = rgba(isCurrentTeam ? 120 : 80);
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = rgba(255);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px sans-serif';

        const teamLabel = isPlayerTeam ? 'YOU' : 'OPPONENT';
        ctx.fillText(teamLabel, x + width / 2, y + 15);
        
        // Movement points - prefer server-calculated values, fallback to client calculation
        let movementPoints = 0;
        
        // Try to get from server first
        if (this.serverGameState) {
            if (team.teamId === this.gameLogic?.matchInfo?.team1?.teamId) {
                movementPoints = this.serverGameState.team1MovementPoints || 0;
            } else if (team.teamId === this.gameLogic?.matchInfo?.team2?.teamId) {
                movementPoints = this.serverGameState.team2MovementPoints || 0;
            }
        }
        
        // Fallback: calculate directly if server data not available
        if (movementPoints === 0 && this.gameLogic && team) {
            const aliveUnits = team.units.filter(u => u.hp > 0 && u.name !== "Base");
            const notYetEndedTurnUnits = aliveUnits.filter(u => {
                // Use ID comparison instead of object reference
                return !this.gameLogic.alreadyEndedTurnUnits.some(endedUnit => endedUnit.id === u.id);
            });
            movementPoints = notYetEndedTurnUnits.reduce((total, unit) => {
                // Get current speed - use same logic as core-logic
                const currentSpeed = this.gameLogic._getCurrentSpeed ? 
                    this.gameLogic._getCurrentSpeed(unit) : unit.speed;
                return total + currentSpeed;
            }, 0);
        }
        
        ctx.font = '10px sans-serif';
        ctx.fillText(`Movement: ${movementPoints}`, x + width / 2, y + 30);

        if (isMyTurn) {
            ctx.fillStyle = rgba(255, 255, 0);
            ctx.font = '10px sans-serif';
            ctx.fillText('YOUR TURN', x + width / 2, y + 45);
        } else if (isCurrentTeam) {
            ctx.fillStyle = rgba(255, 100, 100);
            ctx.font = '10px sans-serif';
            ctx.fillText('OPPONENT TURN', x + width / 2, y + 45);
        }

        if (this.gameLogic && team.teamId === this.gameLogic.priorityTeamId) {
            ctx.fillStyle = rgba(255, 255, 0);
            ctx.font = '8px sans-serif';
            ctx.fillText('★ PRIORITY', x + width / 2, y + height - 10);
        }
    }

    drawCurrentUnitPanel(x, y, width, height) {
        const ctx = this.ctx;
        ctx.fillStyle = rgba(50, 50, 60);
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = rgba(80);
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = rgba(255);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('SELECTED UNIT', x + width / 2, y + 12);

        if (this.selectedUnit) {
            const unitSize = 40;
            const unitX = x + width / 2 - unitSize / 2;
            const unitY = y + 20;
            const imageKey = this.getUnitImageKey(this.selectedUnit);
            if (this.images[imageKey]) {
                drawImage(ctx, this.images[imageKey], unitX, unitY, unitSize, unitSize);
            }
            ctx.font = '9px sans-serif';
            ctx.fillText(this.selectedUnit.name, x + width / 2, y + 65);
            ctx.font = '8px sans-serif';
            const statsText = `❤️ ${this.selectedUnit.hp}  🦵 ${this.selectedUnit.speed}`;
            ctx.fillText(statsText, x + width / 2, y + 78);
        } else {
            ctx.font = '9px sans-serif';
            ctx.fillText('Click unit to select', x + width / 2, y + 50);
        }
    }

    drawBoard() {
        const ctx = this.ctx;
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const { x, y } = this.getBoardPosition(row, col);
                const isLight = (row + col) % 2 === 0;
                ctx.fillStyle = isLight ? rgba(240) : rgba(220);
                ctx.fillRect(x, y, this.cellWidth, this.cellHeight);
                ctx.strokeStyle = rgba(200);
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, this.cellWidth - 1, this.cellHeight - 1);
            }
        }
    }

    drawHighlights() {
        const ctx = this.ctx;
        this.highlightedCells.forEach((cell) => {
            const { x, y } = this.getBoardPosition(cell.row, cell.col);
            ctx.fillStyle = rgba(cell.color[0], cell.color[1], cell.color[2], cell.color[3] || 255);
            ctx.fillRect(x, y, this.cellWidth, this.cellHeight);
            ctx.strokeStyle = rgba(cell.borderColor[0], cell.borderColor[1], cell.borderColor[2]);
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, this.cellWidth, this.cellHeight);
        });
    }

    // 🔧 STEP 5: Enhanced action arrows with suicide explosion center
    drawActionArrows() {
        // Track suicide explosion centers to avoid duplicate drawing
        const explosionCenters = new Set();
        
        this.currentTurnActionArrows.forEach((arrow, index) => {
            // ✅ Draw basic arrow
            this.drawArrow(arrow.from, arrow.to, arrow.color, arrow.style, arrow.width);
            
            // ✅ Add death effects if applicable
            if (arrow.metadata && this.shouldShowDeathEffect(arrow.metadata.style)) {
                this.drawDeathEffect(arrow.to);
            }
            
            // ✅ Draw explosion center for suicide actions
            if (arrow.metadata && arrow.metadata.actionType === 'suicide') {
                const centerKey = `${arrow.from.row},${arrow.from.col}`;
                if (!explosionCenters.has(centerKey)) {
                    explosionCenters.add(centerKey);
                    this.drawExplosionCenter(arrow.from);
                }
            }
        });
    }

    // Draw explosion center at suicide position
    drawExplosionCenter(position) {
        // ✅ PERSPECTIVE FIX: Use getBoardPosition for correct perspective transformation
        const { x, y } = this.getBoardPosition(position.row, position.col);
        const centerX = x + this.cellWidth / 2;
        const centerY = y + this.cellHeight / 2;
        
        const ctx = this.ctx;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '24px sans-serif';
        ctx.fillStyle = rgba(255, 150, 0, 240);
        ctx.fillText('💥', centerX, centerY);
    }

    // Determine if arrow style represents a death
    shouldShowDeathEffect(style) {
        return ['kill', 'suicide_kill', 'sacrifice_death'].includes(style);
    }

    // 🔧 STEP 5: Enhanced death effects for suicide with explosion center
    drawDeathEffect(position) {
        // ✅ PERSPECTIVE FIX: Use getBoardPosition for correct perspective transformation
        const { x, y } = this.getBoardPosition(position.row, position.col);
        const centerX = x + this.cellWidth / 2;
        const centerY = y + this.cellHeight / 2;
        
        const ctx = this.ctx;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '20px sans-serif';
        ctx.fillStyle = rgba(255, 255, 255, 220);
        ctx.fillText('☠️', centerX, centerY + 5);
    }

    drawArrow(from, to, color, style = 'solid', width = 8) {
        if (!from || !to) {
            console.warn('❌ drawArrow: Invalid from/to positions:', { from, to });
            return;
        }
        
        if (from.row === undefined || from.col === undefined || to.row === undefined || to.col === undefined) {
            console.warn('❌ drawArrow: Missing row/col in positions:', { from, to });
            return;
        }
        
        // Get screen positions
        const fromPos = this.getBoardPosition(from.row, from.col);
        const toPos = this.getBoardPosition(to.row, to.col);
        
        // Calculate center of cells
        const x1 = fromPos.x + this.cellWidth / 2;
        const y1 = fromPos.y + this.cellHeight / 2;
        const x2 = toPos.x + this.cellWidth / 2;
        const y2 = toPos.y + this.cellHeight / 2;
        
        // Don't draw arrow if from and to are the same
        if (x1 === x2 && y1 === y2) return;
        
        const ctx = this.ctx;
        ctx.strokeStyle = rgba(color[0], color[1], color[2], 210);
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (style === 'dashed') {
            this.drawDashedLine(x1, y1, x2, y2, 10, 5);
        } else {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        // Draw arrowhead
        this.drawArrowHead(x1, y1, x2, y2, color, width);
    }

    drawDashedLine(x1, y1, x2, y2, dashLength, gapLength) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const totalDashGap = dashLength + gapLength;
        const numDashes = Math.floor(distance / totalDashGap);
        
        const deltaX = (x2 - x1) / distance;
        const deltaY = (y2 - y1) / distance;
        
        for (let i = 0; i < numDashes; i++) {
            const startX = x1 + deltaX * i * totalDashGap;
            const startY = y1 + deltaY * i * totalDashGap;
            const endX = startX + deltaX * dashLength;
            const endY = startY + deltaY * dashLength;
            
            const ctx = this.ctx;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }

    drawArrowHead(x1, y1, x2, y2, color, width) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = Math.max(18, width * 2.6);
        
        // Calculate arrowhead points
        const x3 = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
        const y3 = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
        const x4 = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
        const y4 = y2 - arrowSize * Math.sin(angle + Math.PI / 6);
        
        const ctx = this.ctx;
        ctx.fillStyle = rgba(color[0], color[1], color[2], 235);
        fillTriangle(ctx, x2, y2, x3, y3, x4, y4);
    }

    drawUnits() {
        if (!this.gameLogic || !this.gameLogic.matchInfo || !this.gameLogic.matchInfo.team1 || !this.gameLogic.matchInfo.team2) {
            return;
        }
        
        // Draw all units from both teams using updated gameLogic data
        const allUnits = [...this.gameLogic.matchInfo.team1.units, ...this.gameLogic.matchInfo.team2.units];
        
        allUnits.forEach(unit => {
            if (unit.hp > 0 && unit.row >= 0 && unit.col >= 0) {
                this.drawUnit(unit);
            }
        });
    }
    
    drawUnit(unit) {
        const { x, y } = this.getBoardPosition(unit.row, unit.col);
        
        // Determine unit color based on perspective
        const isPlayerUnit = (unit.teamId === this.playerTeam);
        const unitColor = isPlayerUnit ? 'blue' : 'red';
        
        const ctx = this.ctx;
        if (this.selectedUnit && this.selectedUnit.id === unit.id) {
            ctx.strokeStyle = rgba(255, 255, 0);
            ctx.lineWidth = 3;
            ctx.strokeRect(x - 2, y - 2, this.cellWidth + 4, this.cellHeight + 4);
        }

        if (this.canSelectUnit(unit)) {
            ctx.strokeStyle = rgba(0, 255, 0);
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, this.cellWidth, this.cellHeight);
        }

        const imageKey = `${unit.armyType || unit.name}_${unitColor}`;
        if (this.images[imageKey]) {
            const imgSize = Math.min(this.cellWidth, this.cellHeight) * 0.8;
            const imgX = x + (this.cellWidth - imgSize) / 2;
            const imgY = y + (this.cellHeight - imgSize) / 2;
            drawImage(ctx, this.images[imageKey], imgX, imgY, imgSize, imgSize);
        }

        if (unitHasActed(this.gameLogic, unit)) {
            drawActedMarker(ctx, x, y, this.cellWidth, this.cellHeight);
        }
        const unitType = UNIT_TYPES[unit.name] || UNIT_TYPES[unit.armyType || unit.name];
        const maxHp = unitType ? unitType.hp : (unit.hp || 1);
        drawHpHearts(ctx, x, y, this.cellWidth, this.cellHeight, unit.hp, maxHp, isPlayerUnit ? 'blue' : 'red');
        this.drawEffectIndicators(unit, x, y);
    }
    
    drawEffectIndicators(unit, x, y) {
        if (!unit.effects || unit.effects.length === 0) return;
        
        const ctx = this.ctx;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '10px sans-serif';
        ctx.fillStyle = rgba(255, 255, 255, 200);

        unit.effects.forEach((effect, index) => {
            const iconX = x + 8 + (index * 12);
            const iconY = y + this.cellHeight - 12;
            switch (effect.name) {
                case 'lock':
                    ctx.fillText('🔒', iconX, iconY);
                    break;
                case 'adjacent penalty':
                    ctx.fillText('⛔', iconX, iconY);
                    break;
                case 'dash':
                    ctx.fillText('💨', iconX, iconY);
                    break;
                case 'SUICIDE':
                case 'suicide':
                    ctx.fillText('💣', iconX, iconY);
                    break;
                default:
                    ctx.fillText('●', iconX, iconY);
                    break;
            }
        });
    }

    drawActionIndicators() {
        // Draw any additional action indicators here
        // For example, arrows showing recent moves
    }

    // Event handlers
    handleCanvasClick(mouseX, mouseY) {
        
        
        // Check if it's our turn
        if (!this.gameLogic || this.gameLogic.currentTurnTeamId !== this.playerTeam) {
            //console.log('❌ Not your turn - currentTurn:', this.gameLogic?.currentTurnTeamId, 'playerTeam:', this.playerTeam);
            return;
        }
        
        // Check if click is within board
        if (mouseX < this.offsetX || mouseX > this.offsetX + this.boardWidth ||
            mouseY < this.offsetY || mouseY > this.offsetY + this.boardHeight) {
            // console.log('❌ Click outside board bounds');
            return;
        }
        
        // Convert to board coordinates
        const { row, col } = this.getLogicalPosition(mouseX, mouseY);
        
        if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
            // console.log('❌ Invalid board coordinates:', row, col);
            return;
        }

        // console.log(`🎯 Clicked on valid board position: (${row}, ${col})`);
        
        // Find unit at clicked position
        const clickedUnit = this.getUnitAtPosition(row, col);
        // console.log('🔍 Unit at position:', clickedUnit?.name || 'none');

        if (!this.selectedUnit) {
            // Try to select a unit
            if (clickedUnit && this.canSelectUnit(clickedUnit)) {
                // console.log('✅ Selecting unit:', clickedUnit.name);
                this.selectUnit(clickedUnit);
            } else {
                console.log('❌ Cannot select unit at this position');
                if (clickedUnit) {
                    //console.log('🐛 DEBUG canSelectUnit failed for unit:', {
                    //    name: clickedUnit.name,
                    //    teamId: clickedUnit.teamId,
                    //    playerTeam: this.playerTeam,
                    //    hasGameLogic: !!this.gameLogic,
                    //    currentTurnTeamId: this.gameLogic?.currentTurnTeamId,
                    //    alreadyEndedTurnUnits: this.gameLogic?.alreadyEndedTurnUnits?.length || 0
                    //});
                }
            }
        } else {
        // Handle action with selected unit
            // console.log('🎮 Handling action with selected unit:', this.selectedUnit.name);
            this.handleActionClick(row, col, clickedUnit);
        }
    }

    handleKeyPress(key) {
        if (key === 'Escape') {
            this.clearSelection();
        } else if (key === 's' || key === 'S') {
            // Skip turn
            if (this.gameLogic && this.gameLogic.currentTurnTeamId === this.playerTeam) {
                this.sendAction('end_turn', {});
                if (window.addGameLog) {
                    window.addGameLog('You skipped your turn');
                }
            }
        }
    }

    // Helper functions
    getBoardPosition(row, col) {
        // Convert logical board position to screen coordinates
        // Apply perspective transformation here
        let displayRow = row;
        let displayCol = col;
        
        // If player is red team, flip the board so player team appears at bottom
        if (!this.isPlayerBlue) {
            displayRow = BOARD_ROWS - 1 - row;
            displayCol = BOARD_COLS - 1 - col;
        }
        
        return {
            x: this.offsetX + displayCol * this.cellWidth,
            y: this.offsetY + displayRow * this.cellHeight
        };
    }


    getLogicalPosition(screenX, screenY) {
        // Convert screen coordinates to logical board position
        let col = Math.floor((screenX - this.offsetX) / this.cellWidth);
        let row = Math.floor((screenY - this.offsetY) / this.cellHeight);
        
        // Apply reverse perspective transformation
        if (!this.isPlayerBlue) {
            row = BOARD_ROWS - 1 - row;
            col = BOARD_COLS - 1 - col;
        }
        
        return { row, col };
    }

    getUnitAtPosition(row, col) {
        if (!this.gameLogic || !this.gameLogic.matchInfo) return null;
        
        // Use gameLogic.matchInfo to get updated unit data
        const allUnits = [...this.gameLogic.matchInfo.team1.units, ...this.gameLogic.matchInfo.team2.units];
        const unit = allUnits.find(unit => 
            unit.row === row && unit.col === col && unit.hp > 0
        );
        
        return unit;
    }

    getUnitImageKey(unit) {
        const isPlayerUnit = (unit.teamId === this.playerTeam);
        const unitColor = isPlayerUnit ? 'blue' : 'red';
        return `${unit.armyType || unit.name}_${unitColor}`;
    }

    canSelectUnit(unit) {
        if (!this.gameLogic || !unit) return false;
        
        // If there's a currentTurnUnit, only allow selecting that specific unit
        if (this.gameLogic.currentTurnUnit) {
            return unit.id === this.gameLogic.currentTurnUnit.id;
        }
        
        // Original logic for when no currentTurnUnit (start of turn selection)
        // Check if unit has ended turn by ID comparison (not object reference)
        const hasEndedTurn = this.gameLogic.alreadyEndedTurnUnits && 
            this.gameLogic.alreadyEndedTurnUnits.some(endedUnit => endedUnit.id === unit.id);
        
        return unit.teamId === this.playerTeam &&
               unit.teamId === this.gameLogic.currentTurnTeamId &&
               !hasEndedTurn &&
               unit.name !== "Base" &&
               unit.hp > 0;
    }

    selectUnit(unit) {
        // console.log(`✅ Selected unit: ${unit.name}`);
        this.selectedUnit = unit;
        this.updateHighlights();
        
        // Update UI
        if (window.addGameLog) {
            window.addGameLog(`Selected ${unit.name}`);
        }
        
        if (window.updateSelectedUnitInfo) {
            window.updateSelectedUnitInfo(unit);
        }
        
        if (window.updateActionInfo) {
            window.updateActionInfo(`Selected ${unit.name} - Choose your action`);
        }
    }

    // Check if currently selected unit has available actions
    hasAvailableActionsForSelectedUnit() {
        if (!this.selectedUnit || !this.gameLogic) return false;
        
        // Same workaround as updateHighlights for action preview
        const originalCurrentTurnUnit = this.gameLogic.currentTurnUnit;
        const isCurrentTurnUnit = this.selectedUnit.id === originalCurrentTurnUnit?.id;
        
        if (!isCurrentTurnUnit && this.selectedUnit.teamId === this.gameLogic.currentTurnTeamId) {
            this.gameLogic.currentTurnUnit = this.selectedUnit;
        }
        
        const canAttack = this.gameLogic.getAttackableTargets ? 
            this.gameLogic.getAttackableTargets(this.selectedUnit).length > 0 : false;
        const canHeal = this.gameLogic.getHealableTargets ? 
            this.gameLogic.getHealableTargets(this.selectedUnit).length > 0 : false;
        const canSacrifice = this.gameLogic.getSacrificeableTargets ? 
            this.gameLogic.getSacrificeableTargets(this.selectedUnit).length > 0 : false;
        
        // Restore original currentTurnUnit
        if (!isCurrentTurnUnit) {
            this.gameLogic.currentTurnUnit = originalCurrentTurnUnit;
        }
            
        return canAttack || canHeal || canSacrifice;
    }

    updateHighlights() {
        this.highlightedCells = [];
        
        if (!this.selectedUnit || !this.gameLogic) return;
        
        // Get ALL possible actions from game logic (theo gameplay-vn.md)
        let reachableCells = this.gameLogic.getReachableCells ? 
            this.gameLogic.getReachableCells(this.selectedUnit) : [];
        
        // 🔧 WORKAROUND: getAttackableTargets chỉ hoạt động khi unit = currentTurnUnit
        // Nếu chưa phải currentTurnUnit, tạm set để preview targets
        let attackableTargets = [];
        let healableTargets = [];
        let sacrificeableTargets = [];
        
        const originalCurrentTurnUnit = this.gameLogic.currentTurnUnit;
        const isCurrentTurnUnit = this.selectedUnit.id === originalCurrentTurnUnit?.id;
        
        if (!isCurrentTurnUnit && this.selectedUnit.teamId === this.gameLogic.currentTurnTeamId) {
            // Tạm set làm currentTurnUnit để preview actions
            this.gameLogic.currentTurnUnit = this.selectedUnit;
        }
        
        attackableTargets = this.gameLogic.getAttackableTargets ? 
            this.gameLogic.getAttackableTargets(this.selectedUnit) : [];
        healableTargets = this.gameLogic.getHealableTargets ? 
            this.gameLogic.getHealableTargets(this.selectedUnit) : [];
        sacrificeableTargets = this.gameLogic.getSacrificeableTargets ? 
            this.gameLogic.getSacrificeableTargets(this.selectedUnit) : [];
        
        // Restore original currentTurnUnit
        if (!isCurrentTurnUnit) {
            this.gameLogic.currentTurnUnit = originalCurrentTurnUnit;
        }


        // Nếu unit hiện tại đã move thì không hiển thị ô moveable
        if (this.gameLogic.currentTurnActions.hasMoved) {
            reachableCells = [];
        }
        
        // Add highlights for moveable cells (GREEN)
        reachableCells.forEach(cell => {
            this.highlightedCells.push({
                row: cell.row,
                col: cell.col,
                type: 'move',
                color: [144, 238, 144, 120], // Light green with more opacity
                borderColor: [34, 139, 34]
            });
        });
        
        // Add highlights for attackable targets (RED)
        attackableTargets.forEach(target => {
            this.highlightedCells.push({
                row: target.row,
                col: target.col,
                type: 'attack',
                color: [255, 99, 71, 150], // Red with more opacity
                borderColor: [220, 20, 60]
            });
        });
        
        // Add highlights for healable targets (BLUE)
        healableTargets.forEach(target => {
            this.highlightedCells.push({
                row: target.row,
                col: target.col,
                type: 'heal',
                color: [173, 216, 230, 150], // Light blue with more opacity
                borderColor: [65, 105, 225]
            });
        });
        
        // Add highlights for sacrificeable targets (YELLOW)
        sacrificeableTargets.forEach(target => {
            this.highlightedCells.push({
                row: target.row,
                col: target.col,
                type: 'sacrifice',
                color: [255, 255, 224, 150], // Light yellow with more opacity
                borderColor: [218, 165, 32]
            });
        });
    }

    handleActionClick(row, col, clickedUnit) {
        const selectedUnit = this.selectedUnit;
        
        // console.log(`🎯 Action click at (${row}, ${col}), clickedUnit:`, clickedUnit?.name || 'none');
        
        if (clickedUnit) {
            // Clicked on a unit - determine action type
            if (clickedUnit.id === selectedUnit.id) {
                // Clicked on same unit - try suicide
                // console.log('🔥 Attempting suicide action');
                this.sendAction('suicide', { unit: selectedUnit });
                return;
            }
            
            // Check what type of action this unit can receive
            const isAttackTarget = this.isUnitInHighlights(clickedUnit, 'attack');
            const isHealTarget = this.isUnitInHighlights(clickedUnit, 'heal');
            const isSacrificeTarget = this.isUnitInHighlights(clickedUnit, 'sacrifice');
            
            if (isAttackTarget) {
                // console.log('⚔️ Attacking target:', clickedUnit.name);
                this.sendAction('attack', { 
                    unit: selectedUnit, 
                    target: clickedUnit 
                });
            } else if (isHealTarget) {
                // console.log('💚 Healing target:', clickedUnit.name);
                this.sendAction('heal', { 
                    unit: selectedUnit, 
                    target: clickedUnit 
                });
            } else if (isSacrificeTarget) {
                // console.log('🩸 Sacrificing for target:', clickedUnit.name);
                this.sendAction('sacrifice', { 
                    unit: selectedUnit, 
                    target: clickedUnit 
                });
            } else {
                // Not a valid target, try to select this unit instead
                if (this.canSelectUnit(clickedUnit)) {
                    // console.log('🎯 Selecting new unit:', clickedUnit.name);
                    this.selectUnit(clickedUnit);
                } else {
                    // console.log('❌ Invalid target and cannot select unit');
                }
            }
        } else {
            // Clicked on empty cell - check if it's a moveable cell
            const isMoveableCell = this.isCellInHighlights(row, col, 'move');
            
            if (isMoveableCell) {
                // console.log('🚶 Moving to:', row, col);
                this.sendAction('move_unit', { 
                    unit: selectedUnit, 
                    row: row, 
                    col: col 
                });
        } else {
                // console.log('❌ Not a moveable cell');
                // Clear selection if clicked on invalid cell
                this.clearSelection();
            }
        }
    }
    
    // Helper function to check if unit is in highlights of specific type
    isUnitInHighlights(unit, actionType) {
        return this.highlightedCells.some(cell => 
            cell.row === unit.row && 
            cell.col === unit.col && 
            cell.type === actionType
        );
    }
    
    // Helper function to check if cell is in highlights of specific type
    isCellInHighlights(row, col, actionType) {
        return this.highlightedCells.some(cell => 
            cell.row === row && 
            cell.col === col && 
            cell.type === actionType
        );
    }

    sendAction(action, actionData) {
        // console.log(`📤 Sending action: ${action}`, actionData);
        
        if (window.sendGameAction) {
            window.sendGameAction(action, actionData);
        } else {
            // console.error('❌ sendGameAction not available');
        }
        
        // Don't clear selection immediately - wait for server response
        // Selection will be cleared when:
        // 1. Server updates game state and unit is in alreadyEndedTurnUnits
        // 2. Or when it's not our turn anymore
        // console.log('⏳ Action sent, waiting for server response...');
    }
}

export default BattleGraphicsMultiplayer;
