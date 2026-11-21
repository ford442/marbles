/**
 * Pooled Filament entities for visualParticles, ability projectiles, and holo platforms.
 * Reduces spawn/teardown churn from bursts, abilities, and short-lived FX.
 */

import type RAPIER from '@dimforge/rapier3d-compat';
import { LIGHT_OWNER } from './lighting-budget.ts';
import type { ColorSyncOwner, TransformSyncOwner } from './game-loop/helpers.ts';
import type { EngineContext } from './types/engine-context.ts';
import type { FilamentHandle } from './types/filament.ts';
import type { FrameState } from './types/frame-host.ts';
import type { Vec3 } from './types/geometry.ts';
import type { SettingsContext } from './types/settings.ts';
import type { RgbColor, VisualParticle } from './types/world-objects.ts';

/** Per-tier caps on concurrently live FX. */
export interface EffectLimits {
    blackHole: number;
    missile: number;
    bomb: number;
    visualParticle: number;
    holoPlatform: number;
}

export const EFFECT_BUDGETS = {
    low: { blackHole: 1, missile: 2, bomb: 2, visualParticle: 48, holoPlatform: 2 },
    medium: { blackHole: 2, missile: 4, bomb: 3, visualParticle: 80, holoPlatform: 4 },
    high: { blackHole: 3, missile: 6, bomb: 5, visualParticle: 120, holoPlatform: 6 },
    ultra: { blackHole: 4, missile: 8, bomb: 6, visualParticle: 180, holoPlatform: 8 },
} satisfies Record<string, EffectLimits>;

/** String-keyed view for runtime quality names (unknown names fall back to medium). */
const EFFECT_BUDGETS_BY_QUALITY: Readonly<Partial<Record<string, EffectLimits>>> = EFFECT_BUDGETS;

/** Ability projectiles with a pooled body + point light. */
export type ProjectileKind = 'missile' | 'bomb' | 'blackHole';

/** Every pool, keyed like `EffectLimits`. */
export type EffectSlotKind = keyof EffectLimits;

const PROJECTILE_KINDS: readonly ProjectileKind[] = ['missile', 'bomb', 'blackHole'];

const POOL_PREWARM: Readonly<Record<EffectSlotKind, number>> = {
    visualParticle: 96,
    missile: 8,
    bomb: 6,
    blackHole: 4,
    holoPlatform: 8,
};

const POOL_CAPS: Readonly<Record<EffectSlotKind, number>> = {
    visualParticle: 160,
    missile: 12,
    bomb: 10,
    blackHole: 6,
    holoPlatform: 12,
};

/** Render + light defaults for a pooled projectile. */
export interface ProjectileConfig {
    halfExtent: number;
    color: [number, number, number];
    roughness: number;
    lightColor: [number, number, number];
    lightIntensity: number;
    falloff: number;
    useSphere: boolean;
}

const PROJECTILE_DEFAULTS: Readonly<Record<ProjectileKind, ProjectileConfig>> = {
    missile: {
        halfExtent: 0.2,
        color: [1.0, 0.5, 0.0],
        roughness: 0.2,
        lightColor: [1.0, 0.5, 0.0],
        lightIntensity: 20000,
        falloff: 5.0,
        useSphere: true,
    },
    bomb: {
        halfExtent: 0.4,
        color: [0.2, 0.2, 0.2],
        roughness: 0.2,
        lightColor: [1.0, 0.2, 0.0],
        lightIntensity: 25000,
        falloff: 10.0,
        useSphere: true,
    },
    blackHole: {
        halfExtent: 0.5,
        color: [0.05, 0.0, 0.1],
        roughness: 0.1,
        lightColor: [0.3, 0.0, 0.8],
        lightIntensity: 80000,
        falloff: 20.0,
        useSphere: true,
    },
};

/** A pooled renderable (entity + its own material instance). */
export interface EffectSlot {
    entity: FilamentHandle;
    matInstance: FilamentHandle;
    inUse: boolean;
    kind: EffectSlotKind;
    lightEntity?: FilamentHandle;
    /** Body the slot's light follows while acquired (`bindProjectileLight`). */
    _activeBody?: RAPIER.RigidBody | null;
}

export interface VisualSlot extends EffectSlot {
    kind: 'visualParticle';
}

export interface ProjectileSlot extends EffectSlot {
    kind: ProjectileKind;
    lightEntity: FilamentHandle;
    lightCfg: ProjectileConfig;
}

export interface HoloSlot extends EffectSlot {
    kind: 'holoPlatform';
    halfExtents: Vec3;
}

/**
 * What the release paths read off an FX object: the shared `VisualParticle` /
 * `ActiveProjectile` / `TemporaryPlatform` records, or a remote-FX stub
 * (`game/network/ability-sync.ts`). `_poolSlot` is opaque at those call sites;
 * only slots this manager created are released back to a pool.
 */
export interface PooledFxHandle {
    entity?: FilamentHandle;
    matInstance?: FilamentHandle;
    lightEntity?: FilamentHandle;
    _poolSlot?: unknown;
    _pooled?: boolean;
    /** Transform caches cleared on release. */
    _lightSync?: unknown;
    _lastTransformSync?: unknown;
    _transformInst?: unknown;
}

/** `spawnVisualParticle` input: a visual particle minus the pool-owned fields. */
export type VisualParticleConfig =
    & Omit<VisualParticle, 'entity' | 'matInstance' | 'spawnTime' | '_poolSlot' | '_pooled'>
    & { spawnTime?: number };

/** Per-particle caches dropped when a slot is reused. */
type ParticleCacheOwner = TransformSyncOwner & ColorSyncOwner & {
    _lastBlinkColor?: unknown;
    _lastBlinkColorAt?: unknown;
};

export interface EffectPoolStats {
    pooled: number;
    active: number;
    acquisitions: number;
    releases: number;
    allocationsThisFrame: number;
    visualActive: number;
    projectileActive: number;
    holoActive: number;
}

/** Live FX counts recorded at level start (`recordLevelBaseline`). */
export interface LevelEntityBaseline {
    visualParticles: number;
    missiles: number;
    bombs: number;
    blackHoles: number;
    holo: number;
    marbles: number;
}

declare global {
    interface Window {
        /** Live pool counters, for perf overlays and e2e probes. */
        effectPoolStats?: EffectPoolStats;
    }
}

/** Game members `EffectBudget` reads. */
export type EffectBudgetHost =
    & Pick<FrameState, 'visualParticles' | 'temporaryPlatforms' | 'activeMissiles' | 'activeBombs' | 'activeBlackHoles'>
    & Pick<EngineContext, 'particleSystem' | 'autoQualityGovernor'>
    & Pick<SettingsContext, 'settings'>;

/** Game members `EffectPoolManager` reads and writes (`new EffectPoolManager(game)` in main.js). */
export type EffectPoolHost =
    & EffectBudgetHost
    & Pick<FrameState, 'dynamicBodies' | 'marbles'>
    & Pick<EngineContext,
        | 'Filament' | 'engine' | 'scene' | 'material' | 'vb' | 'ib' | 'sphereVb' | 'sphereIb'
        | 'world' | 'lightingBudget'>
    & { rendererType?: string };

/** `{ r, g, b }` rather than an array (`Array.isArray` does not narrow readonly arrays). */
function isRgbObject(color: readonly number[] | RgbColor): color is RgbColor {
    return !Array.isArray(color);
}

function emptyStats(): EffectPoolStats {
    return {
        pooled: 0,
        active: 0,
        acquisitions: 0,
        releases: 0,
        allocationsThisFrame: 0,
        visualActive: 0,
        projectileActive: 0,
        holoActive: 0,
    };
}

export class EffectBudget {
    declare game: EffectBudgetHost;

    constructor(game: EffectBudgetHost) {
        this.game = game;
    }

    get quality(): string {
        const base = (this.game.settings?.graphics?.quality || 'medium').toLowerCase();
        const bias = this.game.autoQualityGovernor?.getEffectQualityBias?.() || 0;
        const order = ['low', 'medium', 'high', 'ultra'];
        const idx = Math.max(0, order.indexOf(base) - bias);
        return order[idx] || 'medium';
    }

    get limits(): EffectLimits {
        return EFFECT_BUDGETS_BY_QUALITY[this.quality] || EFFECT_BUDGETS.medium;
    }

    canSpawnProjectile(kind: ProjectileKind): boolean {
        const limit = this.limits[kind] ?? 4;
        const list = kind === 'blackHole'
            ? this.game.activeBlackHoles
            : kind === 'missile' ? this.game.activeMissiles : this.game.activeBombs;
        const active = list?.length || 0;
        return active < limit;
    }

    canSpawnVisualParticle(): boolean {
        return (this.game.visualParticles?.length || 0) < this.limits.visualParticle;
    }

    getVisualBurstCount(requested: number): number {
        const headroom = Math.max(0, this.limits.visualParticle - (this.game.visualParticles?.length || 0));
        return Math.min(requested, headroom);
    }

    canSpawnHoloPlatform(): boolean {
        return (this.game.temporaryPlatforms?.length || 0) < this.limits.holoPlatform;
    }

    /** Scale ambient ParticleSystem emitters when FX pressure is high. */
    applyParticleSystemPressure(): void {
        const ps = this.game.particleSystem;
        if (!ps?.ambientEmitters?.length) return;
        const visualLoad = (this.game.visualParticles?.length || 0) / Math.max(1, this.limits.visualParticle);
        const scale = visualLoad > 0.85 ? 0.45 : visualLoad > 0.65 ? 0.7 : 1.0;
        for (const emitter of ps.ambientEmitters) {
            emitter._rateScale = scale;
        }
    }
}

export class EffectPoolManager {
    declare game: EffectPoolHost;
    declare budget: EffectBudget;
    declare initialized: boolean;
    declare visualPool: VisualSlot[];
    declare projectilePools: Record<ProjectileKind, ProjectileSlot[]>;
    declare holoPool: HoloSlot[];
    declare stats: EffectPoolStats;
    declare _levelEntityBaseline: LevelEntityBaseline | null;
    /**
     * Every slot this manager created (only `_create*Slot` adds to it), so a
     * release can narrow an opaque `_poolSlot` to an `EffectSlot`.
     */
    declare _ownSlots: WeakSet<object>;

    constructor(game: EffectPoolHost) {
        this.game = game;
        this.budget = new EffectBudget(game);
        this.initialized = false;
        this.visualPool = [];
        this.projectilePools = { missile: [], bomb: [], blackHole: [] };
        this.holoPool = [];
        this.stats = emptyStats();
        this._levelEntityBaseline = null;
        this._ownSlots = new WeakSet();
        window.effectPoolStats = this.stats;
    }

    beginFrame(): void {
        this.stats.allocationsThisFrame = 0;
        this.budget.applyParticleSystemPressure();
    }

    reset(): void {
        this.stats = emptyStats();
        this._levelEntityBaseline = null;
        window.effectPoolStats = this.stats;
    }

    prewarm(): void {
        const game = this.game;
        if (this.initialized || game.rendererType === 'simple-webgl' || !game.material || !game.engine) {
            return;
        }

        for (let i = 0; i < POOL_PREWARM.visualParticle; i++) {
            const slot = this._createVisualSlot();
            if (slot) this.visualPool.push(slot);
        }

        for (const kind of PROJECTILE_KINDS) {
            for (let i = 0; i < POOL_PREWARM[kind]; i++) {
                const slot = this._createProjectileSlot(kind);
                if (slot) this.projectilePools[kind].push(slot);
            }
        }

        for (let i = 0; i < POOL_PREWARM.holoPlatform; i++) {
            const slot = this._createHoloSlot();
            if (slot) this.holoPool.push(slot);
        }

        this.initialized = true;
        this._refreshStats();
        console.log('[EFFECT-POOL] Prewarmed visual/projectile/holo pools');
    }

    _refreshStats(): void {
        const pooled =
            this.visualPool.filter(s => !s.inUse).length +
            Object.values(this.projectilePools).reduce((n, arr) => n + arr.filter(s => !s.inUse).length, 0) +
            this.holoPool.filter(s => !s.inUse).length;
        this.stats.pooled = pooled;
        this.stats.visualActive = this.visualPool.filter(s => s.inUse).length;
        this.stats.projectileActive = Object.values(this.projectilePools)
            .reduce((n, arr) => n + arr.filter(s => s.inUse).length, 0);
        this.stats.holoActive = this.holoPool.filter(s => s.inUse).length;
        this.stats.active = this.stats.visualActive + this.stats.projectileActive + this.stats.holoActive;
        window.effectPoolStats = this.stats;
    }

    /** Narrow an FX object's opaque `_poolSlot` to a slot owned by this manager. */
    _isOwnSlot(value: unknown): value is EffectSlot {
        return typeof value === 'object' && value !== null && this._ownSlots.has(value);
    }

    _createVisualSlot(): VisualSlot {
        const game = this.game;
        const F = game.Filament;
        const entity = F.EntityManager.get().create();
        const matInstance = game.material.createInstance();
        matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, [1, 1, 1]);
        matInstance.setFloatParameter('roughness', 0.2);

        F.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.1, 0.1, 0.1] })
            .material(0, matInstance)
            .geometry(0, F.RenderableManager$PrimitiveType.TRIANGLES, game.vb, game.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(game.engine, entity);

        const slot: VisualSlot = { entity, matInstance, inUse: false, kind: 'visualParticle' };
        this._ownSlots.add(slot);
        return slot;
    }

    _createProjectileSlot(kind: ProjectileKind): ProjectileSlot | null {
        const game = this.game;
        const F = game.Filament;
        const cfg = PROJECTILE_DEFAULTS[kind];
        if (!cfg) return null;

        const entity = F.EntityManager.get().create();
        const matInstance = game.material.createInstance();
        matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, cfg.color);
        matInstance.setFloatParameter('roughness', cfg.roughness);

        const he = cfg.halfExtent;
        const vb = cfg.useSphere ? game.sphereVb : game.vb;
        const ib = cfg.useSphere ? game.sphereIb : game.ib;

        F.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [he, he, he] })
            .material(0, matInstance)
            .geometry(0, F.RenderableManager$PrimitiveType.TRIANGLES, vb, ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(game.engine, entity);

        const lightEntity = F.EntityManager.get().create();
        F.LightManager.Builder(F.LightManager$Type.POINT)
            .color(cfg.lightColor)
            .intensity(cfg.lightIntensity)
            .falloff(cfg.falloff)
            .castShadows(false)
            .build(game.engine, lightEntity);

        const slot: ProjectileSlot = { entity, matInstance, lightEntity, inUse: false, kind, lightCfg: cfg };
        this._ownSlots.add(slot);
        return slot;
    }

    _createHoloSlot(): HoloSlot {
        const game = this.game;
        const F = game.Filament;
        const halfExtents = { x: 3, y: 0.2, z: 3 };

        const entity = F.EntityManager.get().create();
        const matInstance = game.material.createInstance();
        matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, [0.0, 1.0, 1.0]);
        matInstance.setFloatParameter('roughness', 0.1);

        F.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, F.RenderableManager$PrimitiveType.TRIANGLES, game.vb, game.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(game.engine, entity);

        const slot: HoloSlot = { entity, matInstance, halfExtents, inUse: false, kind: 'holoPlatform' };
        this._ownSlots.add(slot);
        return slot;
    }

    _acquireFromPool<S extends EffectSlot>(pool: S[], cap: number, createFn: () => S | null): S | null {
        let slot = pool.find(s => !s.inUse);
        if (!slot && pool.length < cap) {
            const created = createFn();
            if (created) {
                slot = created;
                pool.push(slot);
                this.stats.allocationsThisFrame += 1;
            }
        }
        if (!slot) return null;
        slot.inUse = true;
        this.stats.acquisitions += 1;
        return slot;
    }

    _releaseSlot(slot: EffectSlot | null | undefined): void {
        if (!slot) return;
        const game = this.game;
        if (slot.lightEntity) game.lightingBudget?.unregister(slot.lightEntity);
        delete slot._activeBody;
        game.scene.remove(slot.entity);
        if (slot.lightEntity) game.scene.remove(slot.lightEntity);
        slot.inUse = false;
        this.stats.releases += 1;
    }

    _resetParticleCaches(p: ParticleCacheOwner): void {
        delete p._lastTransformSync;
        delete p._transformEntity;
        delete p._transformInst;
        delete p._lastBaseColor;
        delete p._lastBaseColorAt;
        delete p._lastBlinkColor;
        delete p._lastBlinkColorAt;
        delete p._forceTransformSync;
    }

    spawnVisualParticle(config: VisualParticleConfig): VisualParticle | null {
        const game = this.game;
        if (!game.visualParticles || !this.budget.canSpawnVisualParticle()) return null;

        const slot = this._acquireFromPool(this.visualPool, POOL_CAPS.visualParticle, () => this._createVisualSlot());
        if (!slot) return null;

        const F = game.Filament;
        const color = config.color;
        if (color) {
            const c = isRgbObject(color)
                ? [color.r, color.g, color.b]
                : color;
            slot.matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, c);
        }
        if (config.roughness !== undefined) {
            slot.matInstance.setFloatParameter('roughness', config.roughness);
        }

        const particle: VisualParticle = {
            ...config,
            entity: slot.entity,
            matInstance: slot.matInstance,
            spawnTime: config.spawnTime ?? Date.now(),
            _poolSlot: slot,
            _pooled: true,
        };
        this._resetParticleCaches(particle);
        game.scene.addEntity(slot.entity);
        game.visualParticles.push(particle);
        this._refreshStats();
        return particle;
    }

    releaseVisualParticle(p: PooledFxHandle | null | undefined): void {
        if (!p) return;
        if (p._pooled && p._poolSlot) {
            if (this._isOwnSlot(p._poolSlot)) this._releaseSlot(p._poolSlot);
        } else if (p.entity) {
            const game = this.game;
            game.scene.remove(p.entity);
            if (p.matInstance) game.engine.destroyMaterialInstance(p.matInstance);
            game.engine.destroyEntity(p.entity);
            game.Filament.EntityManager.get().destroy(p.entity);
            this.stats.allocationsThisFrame += 1;
        }
        this._refreshStats();
    }

    _configurePooledLight(slot: ProjectileSlot, pos: Vec3 | null | undefined): void {
        const game = this.game;
        const cfg = slot.lightCfg || PROJECTILE_DEFAULTS[slot.kind];
        if (!slot.lightEntity || !cfg) return;

        const F = game.Filament;
        F.LightManager.Builder(F.LightManager$Type.POINT)
            .color(cfg.lightColor)
            .intensity(cfg.lightIntensity)
            .falloff(cfg.falloff)
            .castShadows(false)
            .build(game.engine, slot.lightEntity);

        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(slot.lightEntity);
        const mat = new Float32Array(16);
        mat[0] = 1; mat[5] = 1; mat[10] = 1; mat[15] = 1;
        mat[12] = pos?.x ?? 0;
        mat[13] = pos?.y ?? 0;
        mat[14] = pos?.z ?? 0;
        tcm.setTransform(inst, mat);

        game.lightingBudget?.register({
            entity: slot.lightEntity,
            owner: LIGHT_OWNER.ability,
            getPos: () => {
                const body = slot._activeBody;
                const t = body?.translation?.();
                return t ? { x: t.x, y: t.y, z: t.z } : { x: 0, y: 0, z: 0 };
            },
            falloff: cfg.falloff,
            baseIntensity: cfg.lightIntensity,
            castsShadow: false,
        });
    }

    acquireProjectile(kind: ProjectileKind, spawnPos: Vec3 | null = null): ProjectileSlot | null {
        if (!this.budget.canSpawnProjectile(kind)) return null;
        const pool = this.projectilePools[kind];
        const slot = this._acquireFromPool(pool, POOL_CAPS[kind], () => this._createProjectileSlot(kind));
        if (!slot) return null;

        const game = this.game;
        game.scene.addEntity(slot.entity);
        game.scene.addEntity(slot.lightEntity);
        this._configurePooledLight(slot, spawnPos);
        this._refreshStats();
        return slot;
    }

    bindProjectileLight(slot: EffectSlot | null | undefined, rigidBody: RAPIER.RigidBody): void {
        if (!slot) return;
        slot._activeBody = rigidBody;
    }

    releaseProjectile(obj: PooledFxHandle | null | undefined): void {
        if (!obj) return;
        const poolSlot = obj._poolSlot;
        if (poolSlot) {
            if (this._isOwnSlot(poolSlot)) {
                this._releaseSlot(poolSlot);
                poolSlot.inUse = false;
            }
        } else {
            const game = this.game;
            if (obj.entity) {
                game.scene.remove(obj.entity);
                if (obj.matInstance) game.engine.destroyMaterialInstance(obj.matInstance);
                game.engine.destroyEntity(obj.entity);
                game.Filament.EntityManager.get().destroy(obj.entity);
            }
            if (obj.lightEntity) {
                game.lightingBudget?.unregister(obj.lightEntity);
                game.scene.remove(obj.lightEntity);
                game.engine.destroyEntity(obj.lightEntity);
                game.Filament.EntityManager.get().destroy(obj.lightEntity);
            }
            this.stats.allocationsThisFrame += 1;
        }
        delete obj._lightSync;
        delete obj._lastTransformSync;
        delete obj._transformInst;
        this._refreshStats();
    }

    acquireHoloPlatform(color: readonly number[] = [0.0, 1.0, 1.0], roughness = 0.1): HoloSlot | null {
        if (!this.budget.canSpawnHoloPlatform()) return null;
        const slot = this._acquireFromPool(this.holoPool, POOL_CAPS.holoPlatform, () => this._createHoloSlot());
        if (!slot) return null;

        slot.matInstance.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, color);
        slot.matInstance.setFloatParameter('roughness', roughness);
        this.game.scene.addEntity(slot.entity);
        this._refreshStats();
        return slot;
    }

    releaseHoloPlatform(p: PooledFxHandle | null | undefined): void {
        if (!p) return;
        if (p._poolSlot) {
            if (this._isOwnSlot(p._poolSlot)) this._releaseSlot(p._poolSlot);
        } else if (p.entity) {
            const game = this.game;
            game.scene.remove(p.entity);
            if (p.matInstance) game.engine.destroyMaterialInstance(p.matInstance);
            game.engine.destroyEntity(p.entity);
            game.Filament.EntityManager.get().destroy(p.entity);
            this.stats.allocationsThisFrame += 1;
        }
        this._refreshStats();
    }

    /** Return all active FX visuals to pools (physics bodies handled separately). */
    drainAllActiveVisuals(): void {
        const game = this.game;
        if (game.visualParticles?.length) {
            for (const p of [...game.visualParticles]) {
                this.releaseVisualParticle(p);
            }
            game.visualParticles = [];
        }

        const drainProjectiles = (list: readonly (PooledFxHandle & { rigidBody?: RAPIER.RigidBody })[] | undefined): void => {
            if (!list?.length) return;
            for (const obj of [...list]) {
                if (obj.rigidBody) {
                    game.dynamicBodies?.delete(obj.rigidBody);
                    game.world?.removeRigidBody(obj.rigidBody);
                }
                this.releaseProjectile(obj);
            }
        };

        drainProjectiles(game.activeMissiles);
        game.activeMissiles = [];
        drainProjectiles(game.activeBombs);
        game.activeBombs = [];
        drainProjectiles(game.activeBlackHoles);
        game.activeBlackHoles = [];

        if (game.temporaryPlatforms?.length) {
            for (const p of [...game.temporaryPlatforms]) {
                if (p.rigidBody) game.world?.removeRigidBody(p.rigidBody);
                this.releaseHoloPlatform(p);
            }
            game.temporaryPlatforms = [];
        }

        this._refreshStats();
    }

    recordLevelBaseline(): void {
        const game = this.game;
        this._levelEntityBaseline = {
            visualParticles: 0,
            missiles: 0,
            bombs: 0,
            blackHoles: 0,
            holo: 0,
            marbles: game.marbles?.length || 0,
        };
    }

    auditEntityLeaks(): void {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('effectAudit') && !params.has('perf')) return;

        const game = this.game;
        const active =
            (game.visualParticles?.length || 0) +
            (game.activeMissiles?.length || 0) +
            (game.activeBombs?.length || 0) +
            (game.activeBlackHoles?.length || 0) +
            (game.temporaryPlatforms?.length || 0);

        if (active > 0 && params.has('effectAudit')) {
            console.warn('[EFFECT-POOL] Active FX after settle:', {
                visualParticles: game.visualParticles?.length || 0,
                missiles: game.activeMissiles?.length || 0,
                bombs: game.activeBombs?.length || 0,
                blackHoles: game.activeBlackHoles?.length || 0,
                holo: game.temporaryPlatforms?.length || 0,
            });
        }
    }
}

export default EffectPoolManager;
