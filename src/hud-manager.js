/**
 * Consolidated HUD Manager
 * Manages the display of ability bars with contextual visibility
 */

// Ability definitions organized by category
export const ABILITY_CATEGORIES = {
    movement: {
        name: 'Movement',
        icon: '🏃',
        color: '#00ffff',
        abilities: ['boost', 'dash', 'hover', 'jetpack', 'teleport', 'blink', 'gravitypulse', 'glider']
    },
    combat: {
        name: 'Combat',
        icon: '⚔️',
        color: '#ff4444',
        abilities: ['bomb', 'missile', 'emp', 'groundslam', 'blackhole', 'vortex', 'timestop']
    },
    utility: {
        name: 'Utility',
        icon: '🛠️',
        color: '#ffaa00',
        abilities: ['rewind', 'holo', 'ice', 'phase', 'flip', 'size', 'violet', 'glider', 'build', 'magnet', 'focus', 'chameleon']
    }
};

// Ability metadata for display
export const ABILITY_METADATA = {
    boost: { icon: '⚡', key: 'Shift', name: 'Boost', color: '#f0f' },
    dash: { icon: '💨', key: 'V', name: 'Dash', color: '#ff8c00' },
    hover: { icon: '🛸', key: 'H', name: 'Hover', color: '#00ffcc' },
    jetpack: { icon: '🚀', key: 'J', name: 'Jetpack', color: '#ffaa00' },
    teleport: { icon: '✦', key: 'P', name: 'Teleport', color: '#cc00ff' },
    blink: { icon: '👁', key: 'B', name: 'Blink', color: '#ffcc00' },
    gravitypulse: { icon: '◉', key: 'G', name: 'Gravity Pulse', color: '#ffff00' },
    glider: { icon: '🪂', key: 'N/A', name: 'Glider', color: '#00ff88' },
    bomb: { icon: '💣', key: 'X', name: 'Bomb', color: '#ff4500' },
    missile: { icon: '🚀', key: 'L', name: 'Missile', color: '#ff8800' },
    emp: { icon: '⚡', key: 'K', name: 'EMP', color: '#00ccff' },
    groundslam: { icon: '💥', key: 'Digit0', name: 'Ground Slam', color: '#cd853f' },
    blackhole: { icon: '⚫', key: 'N/A', name: 'Black Hole', color: '#aa00ff' },
    vortex: { icon: '🌀', key: 'Y', name: 'Vortex', color: '#ff00ff' },
    timestop: { icon: '⏱', key: 'N/A', name: 'Time Stop', color: '#ffffff' },
    rewind: { icon: '⏪', key: 'T', name: 'Rewind', color: '#ff4500' },
    holo: { icon: '👻', key: 'N/A', name: 'Holo', color: '#00ffff' },
    ice: { icon: '❄', key: 'G', name: 'Frost Bridge', color: '#00ffff' },
    phase: { icon: '👤', key: '6', name: 'Phase Shift', color: '#aa00ff' },
    flip: { icon: '↕', key: 'U', name: 'Gravity Flip', color: '#ff00ff' },
    size: { icon: '⬛', key: 'I', name: 'Size Shift', color: '#ff8800' },
    violet: { icon: '💜', key: 'O', name: 'Violet Light', color: '#ee82ee' },
    build: { icon: '🔨', key: 'N/A', name: 'Build', color: '#32cd32' },
    magnet: { icon: '🧲', key: 'E/Q', name: 'Magnet', color: '#00ffff' },
    focus: { icon: '🎯', key: 'F', name: 'Focus', color: '#7b00ff' },
    chameleon: { icon: '🦎', key: 'K', name: 'Chameleon', color: '#00ff00' }
};

export class HUDManager {
    constructor(game) {
        this.game = game;
        this.abilityElements = new Map();
        this.allAbilityElements = new Map(); // Cache all-ability DOM elements
        this.abilityLastUsed = new Map();
        this.abilityVisible = new Map();
        this.showAllTimeout = null;
        this.categoryExpanded = {
            movement: true,
            combat: false,
            utility: false
        };
        
        this.init();
    }

    init() {
        this.createAbilityElements();
        this.setupEventListeners();
        this.setupCategoryToggles();
    }

    /**
     * Create DOM elements for all abilities
     */
    createAbilityElements() {
        // Create elements for each category
        for (const [categoryKey, category] of Object.entries(ABILITY_CATEGORIES)) {
            const container = document.getElementById(`${categoryKey}-abilities`);
            const allContainer = document.getElementById(`all-${categoryKey}`);
            
            if (!container || !allContainer) continue;

            for (const abilityId of category.abilities) {
                const meta = ABILITY_METADATA[abilityId];
                if (!meta) continue;

                // Create compact icon for HUD
                const iconEl = this.createAbilityIcon(abilityId, meta);
                container.appendChild(iconEl);
                this.abilityElements.set(abilityId, iconEl);
                this.abilityVisible.set(abilityId, false);

                // Create element for "all abilities" overlay and cache it
                const allEl = this.createAllAbilityItem(abilityId, meta);
                allContainer.appendChild(allEl);
                this.allAbilityElements.set(abilityId, allEl);
            }
        }
    }

    /**
     * Create a circular ability icon element
     */
    createAbilityIcon(abilityId, meta) {
        const el = document.createElement('div');
        el.className = 'ability-icon';
        el.id = `ability-${abilityId}`;
        el.style.color = meta.color;
        el.style.borderColor = meta.color;
        el.innerHTML = `
            ${meta.icon}
            <div class="ability-cooldown-overlay"></div>
            <span class="ability-key">${meta.key}</span>
            <div class="ability-tooltip">${meta.name}</div>
        `;
        el.style.display = 'none'; // Hidden by default
        return el;
    }

    /**
     * Create element for "all abilities" overlay
     */
    createAllAbilityItem(abilityId, meta) {
        const el = document.createElement('div');
        el.className = 'ability-icon';
        el.id = `all-ability-${abilityId}`;
        el.style.color = meta.color;
        el.style.borderColor = meta.color;
        el.innerHTML = `
            ${meta.icon}
            <div class="ability-cooldown-overlay"></div>
            <span class="ability-key">${meta.key}</span>
            <div class="ability-tooltip">${meta.name}</div>
        `;
        return el;
    }

    /**
     * Setup category collapse/expand toggles
     */
    setupCategoryToggles() {
        document.querySelectorAll('.hud-category-header').forEach(header => {
            header.addEventListener('click', () => {
                const category = header.parentElement;
                category.classList.toggle('collapsed');
                const categoryKey = category.dataset.category;
                this.categoryExpanded[categoryKey] = !category.classList.contains('collapsed');
            });
        });
    }

    /**
     * Setup Tab key listener for showing all abilities
     */
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.showAllAbilities();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Tab') {
                this.hideAllAbilities();
            }
        });
    }

    /**
     * Show the "all abilities" overlay
     */
    showAllAbilities() {
        const overlay = document.getElementById('hud-all-abilities');
        if (overlay) {
            overlay.classList.add('visible');
        }
    }

    /**
     * Hide the "all abilities" overlay
     */
    hideAllAbilities() {
        const overlay = document.getElementById('hud-all-abilities');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    /**
     * Update ability cooldown display
     * @param {string} abilityId - The ability identifier
     * @param {number} progress - Cooldown progress (0-1, where 1 is ready)
     * @param {boolean} isActive - Whether the ability is currently active
     */
    updateAbilityCooldown(abilityId, progress, isActive = false) {
        const el = this.abilityElements.get(abilityId);
        if (!el) return;

        const now = Date.now();
        const overlay = el.querySelector('.ability-cooldown-overlay');
        
        // Calculate cooldown angle for circular progress (0-360 degrees)
        const angle = progress * 360;
        overlay.style.setProperty('--cooldown-angle', `${angle}deg`);

        // Update visual state
        el.classList.toggle('active', isActive);
        el.classList.toggle('cooldown', progress < 1);
        el.classList.toggle('ready', progress >= 1 && !isActive);

        // Determine visibility
        const wasVisible = this.abilityVisible.get(abilityId);
        const recentlyUsed = (now - (this.abilityLastUsed.get(abilityId) || 0)) < 3000;
        const shouldShow = isActive || progress < 1 || recentlyUsed;

        if (shouldShow && !wasVisible) {
            el.style.display = 'flex';
            this.abilityVisible.set(abilityId, true);
        } else if (!shouldShow && wasVisible) {
            el.style.display = 'none';
            this.abilityVisible.set(abilityId, false);
        }

        // Update "all abilities" overlay using cached element
        const allEl = this.allAbilityElements.get(abilityId);
        if (allEl) {
            const allOverlay = allEl.querySelector('.ability-cooldown-overlay');
            allOverlay.style.setProperty('--cooldown-angle', `${angle}deg`);
            allEl.classList.toggle('active', isActive);
            allEl.classList.toggle('cooldown', progress < 1);
            allEl.classList.toggle('ready', progress >= 1 && !isActive);
        }
    }

    /**
     * Mark an ability as recently used
     */
    markAbilityUsed(abilityId) {
        this.abilityLastUsed.set(abilityId, Date.now());
    }

    /**
     * Update all ability displays - call this from the game loop.
     * Throttled to ~10Hz to reduce DOM layout pressure.
     */
    updateAllAbilities() {
        const now = Date.now();

        // Throttle HUD updates to every 100ms to reduce layout/paint overhead
        if (now - (this._lastHudUpdate || 0) < 100) return;
        this._lastHudUpdate = now;

        const g = this.game;

        // Movement abilities
        if (g.lastBoostTime !== undefined && g.boostCooldown) {
            const progress = Math.min(1, (now - g.lastBoostTime) / g.boostCooldown);
            this.updateAbilityCooldown('boost', progress);
        }

        if (g.lastDashTime !== undefined && g.dashCooldown) {
            const progress = Math.min(1, (now - g.lastDashTime) / g.dashCooldown);
            this.updateAbilityCooldown('dash', progress);
        }

        if (g.hoverEnergy !== undefined && g.maxHoverEnergy) {
            const progress = g.hoverEnergy / g.maxHoverEnergy;
            this.updateAbilityCooldown('hover', progress, g.hoverActive);
        }

        if (g.jetpackEnergy !== undefined && g.maxJetpackEnergy) {
            const progress = g.jetpackEnergy / g.maxJetpackEnergy;
            this.updateAbilityCooldown('jetpack', progress, g.jetpackActive);
        }

        if (g.lastTeleportTime !== undefined && g.teleportCooldown) {
            const progress = Math.min(1, (now - g.lastTeleportTime) / g.teleportCooldown);
            this.updateAbilityCooldown('teleport', progress);
        }

        if (g.lastBlinkTime !== undefined && g.blinkCooldown) {
            const progress = Math.min(1, (now - g.lastBlinkTime) / g.blinkCooldown);
            this.updateAbilityCooldown('blink', progress);
        }

        if (g.lastGravityPulseTime !== undefined && g.gravityPulseCooldown) {
            const progress = Math.min(1, (now - g.lastGravityPulseTime) / g.gravityPulseCooldown);
            this.updateAbilityCooldown('gravitypulse', progress);
        }

        if (g.gliderEnergy !== undefined && g.maxGliderEnergy) {
            const progress = g.gliderEnergy / g.maxGliderEnergy;
            this.updateAbilityCooldown('glider', progress, g.gliderActive);
        }

        // Combat abilities
        if (g.lastBombTime !== undefined && g.bombCooldown) {
            const progress = Math.min(1, (now - g.lastBombTime) / g.bombCooldown);
            this.updateAbilityCooldown('bomb', progress);
        }

        if (g.lastMissileTime !== undefined && g.missileCooldown) {
            const progress = Math.min(1, (now - g.lastMissileTime) / g.missileCooldown);
            this.updateAbilityCooldown('missile', progress);
        }

        if (g.lastEmpTime !== undefined && g.empCooldown) {
            const progress = Math.min(1, (now - g.lastEmpTime) / g.empCooldown);
            this.updateAbilityCooldown('emp', progress);
        }

        if (g.lastTremorTime !== undefined && g.tremorCooldown) {
            const progress = Math.min(1, (now - g.lastTremorTime) / g.tremorCooldown);
            this.updateAbilityCooldown('groundslam', progress);
        }

        if (g.lastBlackHoleTime !== undefined && g.blackHoleCooldown) {
            const progress = Math.min(1, (now - g.lastBlackHoleTime) / g.blackHoleCooldown);
            this.updateAbilityCooldown('blackhole', progress, g.activeBlackHoles?.length > 0);
        }

        if (g.vortexEnergy !== undefined && g.maxVortexEnergy) {
            const progress = g.vortexEnergy / g.maxVortexEnergy;
            this.updateAbilityCooldown('vortex', progress, g.vortexActive);
        }

        if (g.timeStopEnergy !== undefined && g.maxTimeStopEnergy) {
            const progress = g.timeStopEnergy / g.maxTimeStopEnergy;
            this.updateAbilityCooldown('timestop', progress, g.timeStopActive);
        }

        // Utility abilities
        if (g.rewindHistory) {
            const progress = g.rewindHistory.length / (g.maxRewindFrames || 300);
            this.updateAbilityCooldown('rewind', progress, g.isRewinding);
        }

        if (g.lastHoloTime !== undefined && g.holoCooldown) {
            const progress = Math.min(1, (now - g.lastHoloTime) / g.holoCooldown);
            this.updateAbilityCooldown('holo', progress);
        }

        if (g.iceEnergy !== undefined && g.maxIceEnergy) {
            const progress = g.iceEnergy / g.maxIceEnergy;
            this.updateAbilityCooldown('ice', progress, g.iceActive);
        }

        if (g.phaseEnergy !== undefined && g.maxPhaseEnergy) {
            const progress = g.phaseEnergy / g.maxPhaseEnergy;
            this.updateAbilityCooldown('phase', progress, g.phaseActive);
        }

        if (g.flipEnergy !== undefined && g.maxFlipEnergy) {
            const progress = g.flipEnergy / g.maxFlipEnergy;
            this.updateAbilityCooldown('flip', progress, g.flipActive);
        }

        if (g.lastSizeShiftTime !== undefined && g.sizeShiftCooldown) {
            const progress = Math.min(1, (now - g.lastSizeShiftTime) / g.sizeShiftCooldown);
            this.updateAbilityCooldown('size', progress);
        }

        if (g.violetEnergy !== undefined && g.maxVioletEnergy) {
            const progress = g.violetEnergy / g.maxVioletEnergy;
            this.updateAbilityCooldown('violet', progress, g.violetActive);
        }

        if (g.buildEnergy !== undefined && g.maxBuildEnergy) {
            const progress = g.buildEnergy / g.maxBuildEnergy;
            this.updateAbilityCooldown('build', progress);
        }

        if (g.magnetPower !== undefined) {
            this.updateAbilityCooldown('magnet', g.magnetPower, g.magnetActive);
        }

        if (g.focusEnergy !== undefined && g.maxFocusEnergy) {
            const progress = g.focusEnergy / g.maxFocusEnergy;
            this.updateAbilityCooldown('focus', progress, g.focusActive);
        }

        if (g.lastChameleonTime !== undefined && g.chameleonCooldown) {
            const progress = Math.min(1, (now - g.lastChameleonTime) / g.chameleonCooldown);
            this.updateAbilityCooldown('chameleon', progress);
        }
    }
}

export default HUDManager;
