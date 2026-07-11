import {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    getAbilityDefinition,
} from '../../abilities/registry.js';
import {
    cooldownFillRatio,
    isCooldownReady,
} from './ability-cooldown.js';

/**
 * Unified ability cooldown/energy tick, input routing, level masks, and HUD bar binding.
 */
export class AbilitySystem {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
        /** @type {Set<string>} */
        this.enabled = new Set(ALL_ABILITY_IDS);
        /** @type {Map<string, string>} */
        this._codeToAbility = new Map();
        this._keybindOverrides = {};
    }

    init() {
        this._syncCooldownDefaults();
        this._rebuildKeybindMap();
        this._applyHudVisibility();
    }

    /**
     * Load optional per-ability key overrides from saved settings.
     * @param {Record<string, string> | undefined} keybinds
     */
    loadKeybinds(keybinds) {
        this._keybindOverrides = keybinds ? { ...keybinds } : {};
        this._rebuildKeybindMap();
    }

    /**
     * @returns {Record<string, string>}
     */
    exportKeybinds() {
        const out = {};
        for (const id of ALL_ABILITY_IDS) {
            const def = getAbilityDefinition(id);
            if (!def?.input?.defaultCode) continue;
            const code = this.getKeyCode(id);
            if (code !== def.input.defaultCode) {
                out[id] = code;
            }
        }
        return out;
    }

    /**
     * @param {string} id
     * @returns {string | undefined}
     */
    getKeyCode(id) {
        if (this._keybindOverrides[id]) return this._keybindOverrides[id];
        return getAbilityDefinition(id)?.input?.defaultCode;
    }

    /**
     * @param {string} id
     */
    isEnabled(id) {
        return this.enabled.has(id);
    }

    /**
     * Apply per-level ability subset from level JSON.
     * @param {{ enabled?: string[], disabled?: string[] } | null | undefined} mask
     */
    applyLevelMask(mask) {
        if (!mask) {
            this.enabled = new Set(ALL_ABILITY_IDS);
        } else if (Array.isArray(mask.enabled)) {
            this.enabled = new Set(mask.enabled.filter((id) => ABILITY_REGISTRY[id]));
        } else if (Array.isArray(mask.disabled)) {
            const disabled = new Set(mask.disabled);
            this.enabled = new Set(ALL_ABILITY_IDS.filter((id) => !disabled.has(id)));
        } else {
            this.enabled = new Set(ALL_ABILITY_IDS);
        }
        this._applyHudVisibility();
    }

    /**
     * @param {string} code
     * @returns {boolean} true when the code is owned by the registry (even if blocked)
     */
    handleKeyDown(code) {
        const id = this._codeToAbility.get(code);
        if (!id) return false;

        const def = getAbilityDefinition(id);
        if (!def || def.input?.trigger === 'charge') return false;
        if (!this.isEnabled(id)) return true;
        if (!this.game.playerMarble) return true;

        this.tryActivate(id);
        return true;
    }

    /**
     * @param {string} id
     * @returns {boolean}
     */
    tryActivate(id) {
        if (!this.isEnabled(id)) return false;

        const def = getAbilityDefinition(id);
        if (!def?.activate) return false;

        const game = this.game;
        const now = Date.now();

        if (def.cooldownMs && def.lastUseKey) {
            const lastUse = game[def.lastUseKey] ?? 0;
            const cooldown = game[def.cooldownKey] ?? def.cooldownMs;
            if (!isCooldownReady(lastUse, cooldown, now)) return false;
        }

        if (def.energyKey && def.energyCost) {
            const energy = game[def.energyKey] ?? 0;
            if (energy < def.energyCost) return false;
            game[def.energyKey] = energy - def.energyCost;
        }

        const result = def.activate(game);
        return result !== false;
    }

    /**
     * @param {number} now
     * @param {boolean} shouldUpdateHUD
     */
    tickHudBars(now, shouldUpdateHUD) {
        if (!shouldUpdateHUD) return;

        for (const id of ALL_ABILITY_IDS) {
            const def = getAbilityDefinition(id);
            if (!def?.hudSlot) continue;

            const barEl = def.hudSlot.barKey ? this.game[def.hudSlot.barKey] : null;
            if (!barEl) continue;

            const containerEl = def.hudSlot.containerKey
                ? this.game[def.hudSlot.containerKey]
                : null;
            const enabled = this.isEnabled(id);

            if (containerEl) {
                containerEl.style.display = enabled ? '' : 'none';
            }
            if (!enabled) continue;

            if (def.hudSlot.mode === 'charge') {
                const charge = this.game.jumpCharge ?? 0;
                barEl.style.width = `${charge * 100}%`;
                continue;
            }

            if (def.hudSlot.mode === 'energy' && def.energyKey && def.maxEnergyKey) {
                const energy = this.game[def.energyKey] ?? 0;
                const max = this.game[def.maxEnergyKey] ?? 100;
                barEl.style.width = `${(energy / max) * 100}%`;
                continue;
            }

            if (def.hudSlot.mode === 'cooldown' && def.lastUseKey) {
                const lastUse = this.game[def.lastUseKey] ?? 0;
                const cooldown = this.game[def.cooldownKey] ?? def.cooldownMs ?? 0;
                const progress = cooldownFillRatio(lastUse, cooldown, now);
                barEl.style.width = `${progress * 100}%`;

                if (def.hudSlot.readyGlow) {
                    barEl.style.filter = progress >= 1
                        ? def.hudSlot.readyGlow
                        : 'brightness(0.7)';
                }

                if (def.hudSlot.activeWhen) {
                    const active = this._resolvePath(def.hudSlot.activeWhen);
                    if (containerEl) {
                        containerEl.style.display = active > 0 || progress < 1 ? 'block' : 'none';
                    }
                    if (active > 0) {
                        barEl.style.boxShadow = '0 0 10px #aa00ff';
                    } else {
                        barEl.style.boxShadow = 'none';
                    }
                } else if (containerEl && def.hudSlot.hideWhenReady) {
                    if (progress < 1) {
                        containerEl.style.display = 'block';
                    } else {
                        containerEl.style.display = 'none';
                        barEl.style.width = '100%';
                    }
                }
            }
        }
    }

    /**
     * Drive HUDManager icon cooldowns for registry abilities.
     * @param {import('../../hud-manager.js').HUDManager} hudManager
     * @param {number} now
     */
    tickHudIcons(hudManager, now) {
        for (const id of ALL_ABILITY_IDS) {
            const def = getAbilityDefinition(id);
            if (!def?.hudIconId || !this.isEnabled(id)) continue;

            if (def.hudSlot?.mode === 'cooldown' && def.lastUseKey) {
                const lastUse = this.game[def.lastUseKey] ?? 0;
                const cooldown = this.game[def.cooldownKey] ?? def.cooldownMs ?? 0;
                const progress = cooldownFillRatio(lastUse, cooldown, now);
                const active = def.hudSlot.activeWhen
                    ? this._resolvePath(def.hudSlot.activeWhen) > 0
                    : false;
                hudManager.updateAbilityCooldown(def.hudIconId, progress, active);
            }
        }
    }

    _syncCooldownDefaults() {
        for (const def of Object.values(ABILITY_REGISTRY)) {
            if (def.cooldownMs && def.cooldownKey && this.game[def.cooldownKey] === undefined) {
                this.game[def.cooldownKey] = def.cooldownMs;
            }
        }
    }

    _rebuildKeybindMap() {
        this._codeToAbility.clear();
        for (const id of ALL_ABILITY_IDS) {
            const code = this.getKeyCode(id);
            if (code) this._codeToAbility.set(code, id);
        }
    }

    _applyHudVisibility() {
        for (const id of ALL_ABILITY_IDS) {
            const def = getAbilityDefinition(id);
            if (!def?.hudSlot) continue;

            const show = this.isEnabled(id);
            const barEl = def.hudSlot.barKey ? this.game[def.hudSlot.barKey] : null;
            const containerEl = def.hudSlot.containerKey
                ? this.game[def.hudSlot.containerKey]
                : null;

            if (containerEl) {
                containerEl.style.display = show ? '' : 'none';
            } else if (barEl?.parentElement) {
                barEl.parentElement.style.display = show ? '' : 'none';
            }

            if (def.hudIconId && this.game.hudManager) {
                const icon = this.game.hudManager.abilityElements.get(def.hudIconId);
                if (icon && !show) icon.style.display = 'none';
            }
        }
    }

    /** @param {string} path - e.g. `activeBlackHoles.length` */
    _resolvePath(path) {
        const parts = path.split('.');
        let value = this.game;
        for (const part of parts) {
            value = value?.[part];
        }
        return typeof value === 'number' ? value : 0;
    }
}

export default AbilitySystem;
