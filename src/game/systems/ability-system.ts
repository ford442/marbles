import {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    getAbilityDefinition,
    resolveAbilityMask,
    type AbilityDefinition,
} from '../../abilities/registry.js';
import type { AbilityMask } from '../../types/map.ts';
import {
    cooldownFillRatio,
    isCooldownReady,
} from './ability-cooldown.ts';

/**
 * The slice of the game runtime `AbilitySystem` uses. Cooldown, energy, and HUD
 * element fields are looked up by the key names each registry entry declares
 * (`lastUseKey`, `energyKey`, `barKey`, …), hence the index signature; the
 * registry hooks receive the whole game.
 */
export interface AbilityHost {
    playerMarble?: unknown;
    keys?: Record<string, boolean>;
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
    /** `hold` abilities whose press hook ran and whose release is pending. */
    _held: Set<string>;
    /** `charge` abilities whose key was down last frame (edge detection). */
    _chargeDown: Set<string>;

    constructor(game: AbilityHost) {
        this.game = game;
        this.enabled = new Set(ALL_ABILITY_IDS);
        this._codeToAbility = new Map();
        this._keybindOverrides = {};
        this._held = new Set();
        this._chargeDown = new Set();
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
        return this._num(def.cooldownKey) ?? (def.cooldownSec ?? 0) * 1000;
    }

    /** Off cooldown (or has none) at `now`. */
    private _ready(def: AbilityDefinition, now: number): boolean {
        if (!def.lastUseKey) return true;
        const cooldown = this._cooldownMs(def);
        return cooldown <= 0 || isCooldownReady(this._num(def.lastUseKey) ?? 0, cooldown, now);
    }

    /** Enabled, and has the player marble when it needs one. */
    private _usable(def: AbilityDefinition): boolean {
        return this.isEnabled(def.id) && (def.requiresMarble === false || Boolean(this.game.playerMarble));
    }

    /** Every code that drives an ability: its (possibly overridden) binding plus `alt` codes. */
    getKeyCodes(id: string): string[] {
        const code = this.getKeyCode(id);
        const alt = getAbilityDefinition(id)?.binding.alt ?? [];
        return code ? [code, ...alt] : [...alt];
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
            if (!def?.binding.code) continue;
            const code = this.getKeyCode(id);
            if (code !== undefined && code !== def.binding.code) {
                out[id] = code;
            }
        }
        return out;
    }

    getKeyCode(id: string): string | undefined {
        const override = this._keybindOverrides[id];
        if (override) return override;
        return getAbilityDefinition(id)?.binding.code;
    }

    isEnabled(id: string): boolean {
        return this.enabled.has(id);
    }

    /** Apply per-level ability subset from level JSON. */
    applyLevelMask(mask: AbilityMask | null | undefined): void {
        this.enabled = new Set(resolveAbilityMask(mask));
        // A held ability the new level disables is let go now.
        for (const id of [...this._held]) {
            if (!this.enabled.has(id)) this.releaseAbility(id);
        }
        this._applyHudVisibility();
    }

    /**
     * Whether a HUD icon should show: icons no registry entry drives are always
     * allowed; otherwise at least one ability driving it must be enabled.
     */
    isHudIconEnabled(iconId: string): boolean {
        let driven = false;
        for (const id of ALL_ABILITY_IDS) {
            const def: AbilityDefinition = ABILITY_REGISTRY[id];
            if (def.hudIconId !== iconId && !def.hudIconAliases?.includes(iconId)) continue;
            if (this.isEnabled(id)) return true;
            driven = true;
        }
        return !driven;
    }

    /** Key label(s) for a HUD icon from the current bindings (e.g. `E/-`), or undefined. */
    hudKeyLabel(iconId: string): string | undefined {
        const labels: string[] = [];
        for (const id of ALL_ABILITY_IDS) {
            const def: AbilityDefinition = ABILITY_REGISTRY[id];
            if (def.hudIconId !== iconId && !def.hudIconAliases?.includes(iconId)) continue;
            const code = this.getKeyCode(id);
            if (code) labels.push(keyLabel(code));
        }
        return labels.length ? [...new Set(labels)].join('/') : undefined;
    }

    /** Held right now (enabled and any of its codes down) — for `poll` abilities. */
    isHeld(id: string): boolean {
        if (!this.isEnabled(id)) return false;
        const keys = this.game.keys ?? {};
        return this.getKeyCodes(id).some((code) => Boolean(keys[code]));
    }

    /**
     * Keyboard dispatch for `press` and `hold` abilities.
     * @returns true when the code is owned by the registry (even if blocked)
     */
    handleKeyDown(code: string): boolean {
        const id = this._codeToAbility.get(code);
        if (!id) return false;

        const def = getAbilityDefinition(id);
        if (!def) return false;
        const trigger = def.binding.trigger;
        if (trigger === 'press') {
            this.tryActivate(id);
        } else if (trigger === 'hold') {
            this.pressAbility(id);
        }
        // `charge` / `poll` read the held-key map; they still own the code.
        return true;
    }

    /** Keyboard release for `hold` abilities. @returns true when the code is registry-owned */
    handleKeyUp(code: string): boolean {
        const id = this._codeToAbility.get(code);
        if (!id) return false;
        if (getAbilityDefinition(id)?.binding.trigger === 'hold') this.releaseAbility(id);
        return true;
    }

    /**
     * Start a `hold` ability (keyboard, or a mouse binding routed by the host).
     * Ignores key repeat; blocked when disabled, without a marble, or on cooldown.
     */
    pressAbility(id: string, now = Date.now()): boolean {
        const def = getAbilityDefinition(id);
        if (!def?.press || this._held.has(id)) return false;
        if (!this._usable(def) || !this._ready(def, now)) return false;
        this._held.add(id);
        def.press(this.game, now);
        return true;
    }

    /** End a `hold` ability whose press ran. */
    releaseAbility(id: string, now = Date.now()): void {
        if (!this._held.delete(id)) return;
        getAbilityDefinition(id)?.release?.(this.game, now);
    }

    /**
     * Edge-detect `charge` abilities from the held-key map once per frame
     * (air dash, dash, stomp): press when a binding goes down while usable and
     * off cooldown, release when it comes up.
     */
    tickChargeInputs(now: number): void {
        const keys = this.game.keys ?? {};
        for (const id of ALL_ABILITY_IDS) {
            const def: AbilityDefinition = ABILITY_REGISTRY[id];
            if (def.binding.trigger !== 'charge') continue;
            const down = this.getKeyCodes(id).some((code) => Boolean(keys[code]));
            const wasDown = this._chargeDown.has(id);
            if (down && !wasDown) {
                this._chargeDown.add(id);
                if (this._usable(def) && this._ready(def, now)) def.press?.(this.game, now);
            } else if (!down && wasDown) {
                this._chargeDown.delete(id);
                def.release?.(this.game, now);
            }
        }
    }

    /** Fire a `press` ability: enabled, marble present if needed, off cooldown, enough energy. */
    tryActivate(id: string, dt?: number): boolean {
        const def = getAbilityDefinition(id);
        if (!def?.activate || !this._usable(def)) return false;

        const game = this.game;
        const now = Date.now();

        if (!this._ready(def, now)) return false;

        if (def.energyKey && def.energyCost) {
            const energy = this._num(def.energyKey) ?? 0;
            if (energy < def.energyCost) return false;
            game[def.energyKey] = energy - def.energyCost;
        }

        const result = def.activate(game, dt);
        if (result !== false && def.broadcast) {
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
            if (def.cooldownSec && def.cooldownKey && this.game[def.cooldownKey] === undefined) {
                this.game[def.cooldownKey] = def.cooldownSec * 1000;
            }
        }
    }

    _rebuildKeybindMap(): void {
        this._codeToAbility.clear();
        for (const id of ALL_ABILITY_IDS) {
            // Implied abilities (double jump) share and are driven by their parent's key.
            if (getAbilityDefinition(id)?.impliedBy) continue;
            for (const code of this.getKeyCodes(id)) this._codeToAbility.set(code, id);
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
                if (icon && !this.isHudIconEnabled(def.hudIconId)) icon.style.display = 'none';
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

/** Short HUD label for a binding code (`KeyE` → `E`, `Digit0` → `0`, …). */
export function keyLabel(code: string): string {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    const named: Record<string, string> = {
        Minus: '-', Equal: '=', Backquote: '`', Space: 'Space',
        ShiftLeft: 'Shift', ShiftRight: 'Shift', Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB',
    };
    return named[code] ?? code;
}

export default AbilitySystem;
