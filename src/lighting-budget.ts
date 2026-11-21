/**
 * Runtime light budget — caps active Filament point/spot lights by quality tier,
 * distance-fades distant zone decor, and prioritizes player / goal / ability lights.
 */

import { downgradeQualityTier } from './level-effect-budget.js';
import type { EngineContext } from './types/engine-context.ts';
import type { FilamentHandle } from './types/filament.ts';
import type { FrameState } from './types/frame-host.ts';
import type { Vec3 } from './types/geometry.ts';
import type { GameHost } from './types/game-host.ts';
import type { SettingsContext } from './types/settings.ts';

/** Per-quality-tier light caps. */
export interface LightBudgetTier {
    maxPointSpot: number;
    maxShadowCasters: number;
    maxAnimated: number;
}

/** A tier's caps plus the dynamic-light allowance left after the baseline lights. */
export interface LightBudgetLimits extends LightBudgetTier {
    maxDynamic: number;
}

/** Live counters, mirrored to `window.lightingBudgetStats` for the perf overlay. */
export interface LightBudgetStats {
    registered: number;
    active: number;
    budget: number;
    animatedActive: number;
    culledByDistance: number;
    culledByBudget: number;
    shadowCasters: number;
}

declare global {
    interface Window {
        lightingBudgetStats?: LightBudgetStats;
    }
}

export const LIGHT_BUDGETS = {
    low: { maxPointSpot: 4, maxShadowCasters: 0, maxAnimated: 0 },
    medium: { maxPointSpot: 8, maxShadowCasters: 1, maxAnimated: 2 },
    high: { maxPointSpot: 12, maxShadowCasters: 2, maxAnimated: 4 },
    ultra: { maxPointSpot: 16, maxShadowCasters: 3, maxAnimated: 6 },
} satisfies Record<'low' | 'medium' | 'high' | 'ultra', LightBudgetTier>;

const LIGHT_BUDGETS_BY_TIER: Readonly<Record<string, LightBudgetTier | undefined>> = LIGHT_BUDGETS;

/** Reserved for sun (directional) + fill + back point lights — not tracked here. */
export const BASELINE_POINT_LIGHTS = 2;

export const LIGHT_OWNER = {
    zone: 'zone',
    ability: 'ability',
    player: 'player',
    goal: 'goal',
} as const;

/** Who registered a light; decides its default priority and who adds it to the scene. */
export type LightOwner = typeof LIGHT_OWNER[keyof typeof LIGHT_OWNER];

export const LIGHT_PRIORITY = {
    player: 900,
    goal: 800,
    ability: 700,
    zoneHero: 550,
    zone: 200,
};

const DISTANCE_FADE = {
    fadeStartMul: 1.8,
    hideMul: 3.2,
    showMul: 2.6,
};

/** What `register()` takes. Optional fields accept `undefined` and fall back to defaults. */
export interface LightBudgetSpec {
    /** Filament light entity. */
    entity: FilamentHandle;
    type?: 'POINT' | 'SPOT' | undefined;
    owner?: LightOwner | undefined;
    priority?: number | undefined;
    /** Zone lights only: use the zoneHero priority. */
    hero?: boolean | undefined;
    castsShadow?: boolean | undefined;
    /** Static position (ignored when `getPos` is given). */
    pos?: Vec3 | null | undefined;
    /** Live position for lights that follow something. */
    getPos?: (() => Vec3 | null | undefined) | undefined;
    falloff?: number | undefined;
    animated?: boolean | undefined;
    baseIntensity?: number | undefined;
}

/** Tracked state for one registered light. */
export interface LightBudgetEntry {
    entity: FilamentHandle;
    type: 'POINT' | 'SPOT';
    owner: LightOwner;
    priority: number;
    castsShadow: boolean;
    pos: Vec3 | null | undefined;
    getPos: (() => Vec3 | null | undefined) | undefined;
    falloff: number;
    animated: boolean;
    baseIntensity: number;
    distance: number;
    distanceEligible: boolean;
    distanceHidden: boolean;
    budgetActive: boolean;
    animateAllowed: boolean;
    inScene: boolean;
    culledVisible: boolean;
    /** Set on every entry at the start of each `update()`. */
    effectivePriority?: number;
}

/** Game members `LightingBudgetManager` reads (`new LightingBudgetManager(game)` in main.js). */
export type LightingBudgetHost =
    & Pick<EngineContext, 'scene' | 'cullingManager' | 'autoQualityGovernor'>
    & Pick<FrameState, 'playerMarble' | '_cameraState'>
    & Pick<SettingsContext, 'settings'>
    & Pick<GameHost, 'rendererType'>;

function dist3(a: Vec3, b: Vec3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.hypot(dx, dy, dz);
}

export function shouldUseMarbleProxyLight(quality: string | null | undefined): boolean {
    const q = (quality || 'medium').toLowerCase();
    return q === 'high' || q === 'ultra';
}

export class LightingBudgetManager {
    declare game: LightingBudgetHost;
    declare lights: Map<FilamentHandle, LightBudgetEntry>;
    declare stats: LightBudgetStats;
    declare forceAllZoneLights: boolean;

    constructor(game: LightingBudgetHost) {
        this.game = game;
        this.lights = new Map();
        this.stats = this.emptyStats();
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        this.forceAllZoneLights = Boolean(params?.has('forceZoneLights'));
        if (typeof window !== 'undefined') {
            window.lightingBudgetStats = this.stats;
        }
    }

    emptyStats(): LightBudgetStats {
        return {
            registered: 0,
            active: 0,
            budget: 0,
            animatedActive: 0,
            culledByDistance: 0,
            culledByBudget: 0,
            shadowCasters: 0,
        };
    }

    reset(): void {
        this.lights.clear();
        this.stats = this.emptyStats();
        if (typeof window !== 'undefined') {
            window.lightingBudgetStats = this.stats;
        }
    }

    getEffectiveQuality(): string {
        const base = this.game.settings?.graphics?.quality || 'medium';
        const bias = this.game.autoQualityGovernor?.getEffectQualityBias?.() || 0;
        return downgradeQualityTier(base, bias);
    }

    getLimits(): LightBudgetLimits {
        const tier = LIGHT_BUDGETS_BY_TIER[this.getEffectiveQuality()] || LIGHT_BUDGETS.medium;
        return {
            ...tier,
            maxDynamic: Math.max(0, tier.maxPointSpot - BASELINE_POINT_LIGHTS),
        };
    }

    getPlayerPos(): Vec3 {
        const t = this.game.playerMarble?.rigidBody?.translation?.();
        if (t) return { x: t.x, y: t.y, z: t.z };
        const eye = this.game._cameraState?.eye;
        if (eye) return { x: eye[0], y: eye[1], z: eye[2] };
        return { x: 0, y: 0, z: 0 };
    }

    resolvePos(entry: LightBudgetEntry): Vec3 | null | undefined {
        if (typeof entry.getPos === 'function') {
            return entry.getPos();
        }
        return entry.pos;
    }

    register(spec: LightBudgetSpec | null | undefined): LightBudgetEntry | null {
        if (!spec?.entity) return null;

        const owner: LightOwner = spec.owner || LIGHT_OWNER.zone;
        let priority = spec.priority;
        if (priority === undefined) {
            if (owner === LIGHT_OWNER.player) priority = LIGHT_PRIORITY.player;
            else if (owner === LIGHT_OWNER.goal) priority = LIGHT_PRIORITY.goal;
            else if (owner === LIGHT_OWNER.ability) priority = LIGHT_PRIORITY.ability;
            else priority = spec.hero ? LIGHT_PRIORITY.zoneHero : LIGHT_PRIORITY.zone;
        }

        const entry: LightBudgetEntry = {
            entity: spec.entity,
            type: spec.type || 'POINT',
            owner,
            priority,
            castsShadow: spec.castsShadow === true,
            pos: spec.pos,
            getPos: spec.getPos,
            falloff: spec.falloff ?? 15,
            animated: spec.animated === true,
            baseIntensity: spec.baseIntensity ?? 1,
            distance: 0,
            distanceEligible: true,
            distanceHidden: false,
            budgetActive: true,
            animateAllowed: true,
            inScene: true,
            culledVisible: true,
        };

        this.lights.set(spec.entity, entry);
        this.stats.registered = this.lights.size;
        return entry;
    }

    unregister(entity: FilamentHandle): void {
        if (!entity) return;
        this.lights.delete(entity);
        this.stats.registered = this.lights.size;
    }

    isBudgetActive(entity: FilamentHandle): boolean {
        const entry = this.lights.get(entity);
        if (!entry) return true;
        return entry.budgetActive && entry.distanceEligible && entry.culledVisible !== false;
    }

    isAnimateAllowed(entity: FilamentHandle): boolean {
        const entry = this.lights.get(entity);
        if (!entry) return true;
        return this.isBudgetActive(entity) && entry.animateAllowed;
    }

    updateDistanceFade(entry: LightBudgetEntry, playerPos: Vec3): void {
        if (this.forceAllZoneLights && entry.owner === LIGHT_OWNER.zone) {
            entry.distanceEligible = true;
            entry.distanceHidden = false;
            return;
        }

        const pos = this.resolvePos(entry);
        if (!pos) {
            entry.distanceEligible = true;
            return;
        }

        const dist = dist3(pos, playerPos);
        entry.distance = dist;
        const falloff = entry.falloff || 15;
        const hideAt = falloff * DISTANCE_FADE.hideMul;
        const showAt = falloff * DISTANCE_FADE.showMul;

        if (entry.distanceHidden) {
            entry.distanceHidden = dist > showAt;
        } else if (dist > hideAt) {
            entry.distanceHidden = true;
        }
        entry.distanceEligible = !entry.distanceHidden;
    }

    _applySceneState(entry: LightBudgetEntry): void {
        const game = this.game;
        if (!game.scene || !entry.entity) return;

        const shouldShow = entry.budgetActive && entry.distanceEligible && entry.culledVisible !== false;

        // Goal/ability lights: budget gates via isBudgetActive(); culling/spawn own scene add/remove.
        if (entry.owner !== LIGHT_OWNER.zone && entry.owner !== LIGHT_OWNER.player) {
            entry.inScene = shouldShow;
            return;
        }

        if (shouldShow === entry.inScene) return;

        if (shouldShow) {
            game.scene.addEntity(entry.entity);
        } else {
            game.scene.remove(entry.entity);
        }
        entry.inScene = shouldShow;
    }

    update(): void {
        const game = this.game;
        if (!game.scene || game.rendererType === 'simple-webgl' ||
            (typeof window !== 'undefined' && window.usingSimpleRenderer)) {
            return;
        }

        const limits = this.getLimits();
        const playerPos = this.getPlayerPos();
        let culledByDistance = 0;
        let culledByBudget = 0;

        for (const entry of this.lights.values()) {
            if (entry.owner === LIGHT_OWNER.zone) {
                this.updateDistanceFade(entry, playerPos);
            } else {
                const pos = this.resolvePos(entry);
                entry.distance = pos ? dist3(pos, playerPos) : 0;
                entry.distanceEligible = true;
            }

            if (entry.owner === LIGHT_OWNER.zone && game.cullingManager?.enabled) {
                const pos = this.resolvePos(entry);
                if (pos) {
                    entry.culledVisible = game.cullingManager.isVisible(
                        `zone-light:${entry.entity}`,
                        [pos.x, pos.y, pos.z],
                        entry.falloff,
                        'dynamic'
                    );
                }
            } else {
                entry.culledVisible = true;
            }

            if (!entry.distanceEligible) culledByDistance += 1;

            entry.effectivePriority = entry.priority - entry.distance * 0.25;
        }

        for (const entry of this.lights.values()) {
            entry.budgetActive = false;
            entry.animateAllowed = false;
        }

        const candidates = [...this.lights.values()]
            .filter(e => e.distanceEligible && e.culledVisible !== false)
            // effectivePriority was just set on every entry above.
            .sort((a, b) => (b.effectivePriority ?? 0) - (a.effectivePriority ?? 0));

        let active = 0;
        let animatedActive = 0;
        let shadowCasters = 0;

        for (const entry of candidates) {
            if (active >= limits.maxDynamic) {
                culledByBudget += 1;
                continue;
            }

            if (entry.castsShadow) {
                if (shadowCasters >= limits.maxShadowCasters) {
                    entry.castsShadow = false;
                } else {
                    shadowCasters += 1;
                }
            }

            entry.budgetActive = true;
            active += 1;

            if (entry.animated) {
                if (animatedActive < limits.maxAnimated) {
                    entry.animateAllowed = true;
                    animatedActive += 1;
                }
            }
        }

        for (const entry of this.lights.values()) {
            this._applySceneState(entry);
        }

        this.stats = {
            registered: this.lights.size,
            active,
            budget: limits.maxDynamic,
            animatedActive,
            culledByDistance,
            culledByBudget,
            shadowCasters,
        };
        if (typeof window !== 'undefined') {
            window.lightingBudgetStats = this.stats;
        }
    }

    getStatus(): LightBudgetStats & {
        quality: string;
        limits: LightBudgetLimits;
        forceAllZoneLights: boolean;
    } {
        const limits = this.getLimits();
        return {
            quality: this.getEffectiveQuality(),
            limits,
            forceAllZoneLights: this.forceAllZoneLights,
            ...this.stats,
        };
    }
}

export default LightingBudgetManager;
