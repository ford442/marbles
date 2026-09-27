import {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    getAbilityDefinition,
    resolveAbilityMask,
    type AbilityDefinition,
    type AbilityGameContext,
} from '../../abilities/registry.js';
import type { AbilityMask } from '../../types/map.ts';
import {
    cooldownFillRatio,
    isCooldownReady,
} from './ability-cooldown.ts';

/**
 * The slice of the game runtime `AbilitySystem` uses. Cooldown, energy, and HUD
 * element fields are looked up by the key names each registry entry declares
 * (`lastUseKey`, `energyKey`, `barKey`, …), hence the index signature.
 */
export interface AbilityHost extends AbilityGameContext {
    multiplayerMode?: boolean;
    network?: { room?: unknown; sendAbility(id: string): void } | null;
    jumpCharge?: number;
    hudManager?: {
        markAbilityUsed(id: string): void;
        abilityElements: Map<string, HTMLElement>;
    } | null;
    [stateKey: string]: unknown;
}

/** What `tickHudIcons` needs from the HUD. */
export interface AbilityHudIcons {
    updateAbilityCooldown(abilityId: string, progress: number, isActive?: boolean): void;
}

/**
 * Unified ability cooldown/energy tick, input routing, level masks, and HUD bar binding.
 */
export class AbilitySystem {
    game: AbilityHost;
    enabled: Set<string>;
    _codeToAbility: Map<string, string>;
    _keybindOverrides: Record<string, string>;

    constructor(game: AbilityHost) {
        this.game = game;
        this.enabled = new Set(ALL_ABILITY_IDS);
        this._codeToAbility = new Map();
        this._keybindOverrides = {};
    }

    /** Numeric game field named by a registry key, or `undefined` when unset / not a number. */
    private _num(key: string | undefined): number | undefined {
        if (!key) return undefined;
        const value = this.game[key];
        return typeof value === 'number' ? value : undefined;
    }

    /** HUD element stored on the game under a registry key. */
    private _el(key: string | undefined): HTMLElement | null {
        return key ? (this.game[key] as HTMLElement | null | undefined) ?? null : null;
    }

    /** Effective cooldown for a definition: the game's per-level override, else the registry default. */
    private _cooldownMs(def: AbilityDefinition): number {
        return this._num(def.cooldownKey) ?? def.cooldownMs ?? 0;
    }

    init(): void {
        this._syncCooldownDefaults();
        this._rebuildKeybindMap();
        this._applyHudVisibility();
    }

    /** Load optional per-ability key overrides from saved settings. */
    loadKeybinds(keybinds: Record<string, string> | undefined): void {
        this._keybindOverrides = keybinds ? { ...keybinds } : {};
        this._rebuildKeybindMap();
    }

    exportKeybinds(): Record<string, string> {
        const out: Record<string, string> = {};
        for (const id of ALL_ABILITY_IDS) {
            const def = getAbilityDefinition(id);
            if (!def?.input?.defaultCode) continue;
            const code = this.getKeyCode(id);
            if (code !== undefined && code !== def.input.defaultCode) {
                out[id] = code;
            }
        }
        return out;
    }

    getKeyCode(id: string): string | undefined {
        const override = this._keybindOverrides[id];
        if (override) return override;
        return getAbilityDefinition(id)?.input?.defaultCode;
    }

    isEnabled(id: string): boolean {
        return this.enabled.has(id);
    }

    /** Apply per-level ability subset from level JSON. */
    applyLevelMask(mask: AbilityMask | null | undefined): void {
        this.enabled = new Set(resolveAbilityMask(mask));
        this._applyHudVisibility();
    }

    /** @returns true when the code is owned by the registry (even if blocked) */
    handleKeyDown(code: string): boolean {
        const id = this._codeToAbility.get(code);
        if (!id) return false;

        const def = getAbilityDefinition(id);
        if (!def || def.input?.trigger === 'charge') return false;
        if (!this.isEnabled(id)) return true;
        if (!this.game.playerMarble) return true;

        this.tryActivate(id);
        return true;
    }

    tryActivate(id: string): boolean {
        if (!this.isEnabled(id)) return false;

        const def = getAbilityDefinition(id);
        if (!def?.activate) return false;

        const game = this.game;
        const now = Date.now();

        if (def.cooldownMs && def.lastUseKey) {
            const lastUse = this._num(def.lastUseKey) ?? 0;
            const cooldown = this._num(def.cooldownKey) ?? def.cooldownMs;
            if (!isCooldownReady(lastUse, cooldown, now)) return false;
        }

        if (def.energyKey && def.energyCost) {
            const energy = this._num(def.energyKey) ?? 0;
            if (energy < def.energyCost) return false;
            game[def.energyKey] = energy - def.energyCost;
        }

        const result = def.activate(game);
        if (result !== false) {
            if (game.multiplayerMode && game.network?.room) {
                game.network.sendAbility(id);
            }
        }
        return result !== false;
    }

    tickHudBars(now: number, shouldUpdateHUD: boolean): void {
        if (!shouldUpdateHUD) return;

        for (const id of ALL_ABILITY_IDS) {
            const def = getAbilityDefinition(id);
            if (!def?.hudSlot) continue;

            const barEl = this._el(def.hudSlot.barKey);
            if (!barEl) continue;

            const containerEl = this._el(def.hudSlot.containerKey);
            const enabled = this.isEnabled(id);

            if (containerEl) {
                containerEl.style.display = enabled ? '' : 'none';
            }
            if (!enabled) continue;

            if (def.hudSlot.mode === 'charge') {
                const charge = this._num('jumpCharge') ?? 0;
                barEl.style.width = `${charge * 100}%`;
                continue;
            }

            if (def.hudSlot.mode === 'energy' && def.energyKey && def.maxEnergyKey) {
                const energy = this._num(def.energyKey) ?? 0;
                const max = this._num(def.maxEnergyKey) ?? 100;
                barEl.style.width = `${(energy / max) * 100}%`;
                continue;
            }

            if (def.hudSlot.mode === 'cooldown' && def.lastUseKey) {
                const lastUse = this._num(def.lastUseKey) ?? 0;
                const cooldown = this._cooldownMs(def);
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

    /** Drive HUDManager icon cooldowns for registry abilities. */
    tickHudIcons(hudManager: AbilityHudIcons, now: number): void {
        for (const id of ALL_ABILITY_IDS) {
            const def = getAbilityDefinition(id);
            if (!def?.hudIconId || !this.isEnabled(id)) continue;

            if (def.hudSlot?.mode === 'cooldown' && def.lastUseKey) {
                const lastUse = this._num(def.lastUseKey) ?? 0;
                const cooldown = this._cooldownMs(def);
                const progress = cooldownFillRatio(lastUse, cooldown, now);
                const active = def.hudSlot.activeWhen
                    ? this._resolvePath(def.hudSlot.activeWhen) > 0
                    : false;
                hudManager.updateAbilityCooldown(def.hudIconId, progress, active);
            }
        }
    }

    _syncCooldownDefaults(): void {
        for (const def of Object.values<AbilityDefinition>(ABILITY_REGISTRY)) {
            if (def.cooldownMs && def.cooldownKey && this.game[def.cooldownKey] === undefined) {
                this.game[def.cooldownKey] = def.cooldownMs;
            }
        }
    }

    _rebuildKeybindMap(): void {
        this._codeToAbility.clear();
        for (const id of ALL_ABILITY_IDS) {
            const code = this.getKeyCode(id);
            if (code) this._codeToAbility.set(code, id);
        }
    }

    _applyHudVisibility(): void {
        for (const id of ALL_ABILITY_IDS) {
            const def = getAbilityDefinition(id);
            if (!def?.hudSlot) continue;

            const show = this.isEnabled(id);
            const barEl = this._el(def.hudSlot.barKey);
            const containerEl = this._el(def.hudSlot.containerKey);

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

    /** @param path - e.g. `activeBlackHoles.length` */
    _resolvePath(path: string): number {
        let value: unknown = this.game;
        for (const part of path.split('.')) {
            value = (value as Record<string, unknown> | null | undefined)?.[part];
        }
        return typeof value === 'number' ? value : 0;
    }
}

export default AbilitySystem;
