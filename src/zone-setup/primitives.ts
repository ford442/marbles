/**
 * Level Format v2 primitives: the single typed builder for the data-driven
 * `box | ramp | mover | spinner | trigger` zone types.
 *
 * The module is split in two layers:
 *   - `compilePrimitive()` is pure: zone JSON → body poses, half-extents,
 *     surface properties and motion/trigger specs. The headless level harness
 *     (tests/levels/) and the editor reuse it without Filament.
 *   - `buildPrimitive()` turns a compiled primitive into Rapier bodies and
 *     Filament entities, registering every resource with the level's
 *     `ZoneScope` so `clearLevel()` disposes them (no leaked material
 *     instances by construction).
 *
 * Rotation is always given as named axes (`yawDeg`, `pitchDeg`, `rollDeg`)
 * and converted with `quatFromYawPitchRoll` — never positional Euler args.
 */
import { quatFromYawPitchRoll, quatMultiply, quatRotateVec3, type Quat, type Vec3 } from '../math.ts';
import { applyVelocityChange, type ImpulseBody } from '../game/systems/body-impulse.ts';

export type Vec3Input = readonly [number, number, number] | { x: number; y: number; z: number };
export type RGB = [number, number, number];

export interface RotationSpec {
    yawDeg?: number;
    pitchDeg?: number;
    rollDeg?: number;
}

interface SurfaceFields {
    color?: RGB;
    /** Track surface preset key or alias (see physics-world-pure.ts). */
    material?: string;
    friction?: number;
    restitution?: number;
}

export interface BoxZone extends SurfaceFields {
    type: 'box';
    pos: Vec3Input;
    /** Full extents (not half-extents). */
    size: Vec3Input;
    rot?: RotationSpec;
}

export interface RampZone extends SurfaceFields {
    type: 'ramp';
    /** Centre of the ramp's top surface at its start / end. */
    from: Vec3Input;
    to: Vec3Input;
    width: number;
    thickness?: number;
}

export type MoverEase = 'linear' | 'sine';

export interface MoverZone extends SurfaceFields {
    type: 'mover';
    shape?: 'box';
    size: Vec3Input;
    /** Waypoints (≥ 2). The body ping-pongs along them unless `loop` is true. */
    path: Vec3Input[];
    /** Seconds for one full cycle (there and back, or once round the loop). */
    period: number;
    ease?: MoverEase;
    loop?: boolean;
    /** Cycle offset in [0, 1). */
    phase?: number;
    rot?: RotationSpec;
}

export interface SpinnerZone extends SurfaceFields {
    type: 'spinner';
    pos: Vec3Input;
    size: Vec3Input;
    axis: 'x' | 'y' | 'z';
    /** Revolutions per minute; negative spins the other way. */
    rpm: number;
    /** Starting angle in degrees. */
    phaseDeg?: number;
    rot?: RotationSpec;
}

export interface TriggerAction {
    /** Velocity change in m/s, applied regardless of marble mass. */
    boost?: Vec3Input;
    /** Replace the marble's velocity (m/s). */
    setVelocity?: Vec3Input;
    /** Send the marble back to its respawn point. */
    respawn?: boolean;
}

export interface TriggerZone {
    type: 'trigger';
    pos: Vec3Input;
    size: Vec3Input;
    rot?: RotationSpec;
    on?: 'enter' | 'stay';
    do: TriggerAction;
    /** When set, a thin pad of this colour marks the trigger's floor. */
    color?: RGB;
}

export type PrimitiveZone = BoxZone | RampZone | MoverZone | SpinnerZone | TriggerZone;

export const PRIMITIVE_TYPES = ['box', 'ramp', 'mover', 'spinner', 'trigger'] as const;
export type PrimitiveType = (typeof PRIMITIVE_TYPES)[number];

export function isPrimitiveType(type: unknown): type is PrimitiveType {
    return typeof type === 'string' && (PRIMITIVE_TYPES as readonly string[]).includes(type);
}

/** Physical defaults per surface; render presets carry no friction. */
const SURFACE_PHYSICS: Readonly<Record<string, { friction?: number; restitution?: number }>> = {
    ice: { friction: 0.03 },
    neon_ice: { friction: 0.03 },
    crystal: { friction: 0.2 },
    glass: { friction: 0.2 },
    metal: { friction: 0.4 },
    rubber: { friction: 0.9, restitution: 0.75 },
    sand: { friction: 0.9 },
    concrete: { friction: 0.7 },
    wood: { friction: 0.6 },
    obsidian: { friction: 0.5 },
    volcanicRock: { friction: 0.6 },
};

const DEFAULT_COLOR: RGB = [0.45, 0.45, 0.5];
const DEFAULT_MOVER_COLOR: RGB = [0.9, 0.55, 0.15];
const DEFAULT_SPINNER_COLOR: RGB = [0.85, 0.2, 0.35];
const DEFAULT_RAMP_THICKNESS = 0.5;
const TRIGGER_PAD_HEIGHT = 0.05;
const DEG = Math.PI / 180;

export function toVec3(v: Vec3Input | undefined, fallback: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
    if (!v) return fallback;
    if (Array.isArray(v)) return { x: Number(v[0]), y: Number(v[1]), z: Number(v[2]) };
    const o = v as { x: number; y: number; z: number };
    return { x: Number(o.x), y: Number(o.y), z: Number(o.z) };
}

export function rotationFromSpec(rot: RotationSpec | undefined): Quat {
    return quatFromYawPitchRoll({
        yaw: (rot?.yawDeg ?? 0) * DEG,
        pitch: (rot?.pitchDeg ?? 0) * DEG,
        roll: (rot?.rollDeg ?? 0) * DEG,
    });
}

function halfOf(size: Vec3): Vec3 {
    return { x: size.x / 2, y: size.y / 2, z: size.z / 2 };
}

function add(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function length(v: Vec3): number {
    return Math.hypot(v.x, v.y, v.z);
}

export interface Pose {
    pos: Vec3;
    rot: Quat;
}

export interface CompiledBody extends Pose {
    kind: 'fixed' | 'kinematic' | 'sensor';
    halfExtents: Vec3;
    friction: number | undefined;
    restitution: number | undefined;
    color: RGB;
    material: string | undefined;
}

export interface CompiledPrimitive {
    type: PrimitiveType;
    body: CompiledBody;
    /** Kinematic pose at simulated time `t` seconds (movers and spinners). */
    poseAt?: (t: number) => Pose;
    trigger?: { on: 'enter' | 'stay'; action: TriggerAction; padColor: RGB | undefined };
}

function surface(zone: SurfaceFields, fallbackColor: RGB) {
    const phys = zone.material ? SURFACE_PHYSICS[zone.material] : undefined;
    return {
        friction: zone.friction ?? phys?.friction,
        restitution: zone.restitution ?? phys?.restitution,
        color: zone.color ?? fallbackColor,
        material: zone.material,
    };
}

/** Box whose top-surface centre line runs from `from` to `to`. */
function compileRamp(zone: RampZone, offset: Vec3): CompiledBody {
    const from = add(toVec3(zone.from), offset);
    const to = add(toVec3(zone.to), offset);
    const d = sub(to, from);
    const horiz = Math.hypot(d.x, d.z);
    const len = length(d);
    const thickness = zone.thickness ?? DEFAULT_RAMP_THICKNESS;
    // Yaw points local +Z along the ramp; pitch about local X tilts it so the
    // far end rises for dy > 0 (right-hand rule: +pitch lowers +Z).
    const rot = quatFromYawPitchRoll({
        yaw: Math.atan2(d.x, d.z),
        pitch: -Math.atan2(d.y, horiz),
    });
    const down = quatRotateVec3(rot, { x: 0, y: -thickness / 2, z: 0 });
    return {
        kind: 'fixed',
        pos: add(lerp(from, to, 0.5), down),
        rot,
        halfExtents: { x: zone.width / 2, y: thickness / 2, z: len / 2 },
        ...surface(zone, DEFAULT_COLOR),
    };
}

function easeCycle(u: number, ease: MoverEase): number {
    return ease === 'sine' ? (1 - Math.cos(Math.PI * u)) / 2 : u;
}

/** Arc-length sampler over a polyline. */
function polylineSampler(points: Vec3[]): (s: number) => Vec3 {
    const segs: number[] = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        const l = length(sub(points[i]!, points[i - 1]!));
        segs.push(l);
        total += l;
    }
    return (s: number) => {
        if (!(total > 0)) return points[0]!;
        let dist = Math.min(Math.max(s, 0), 1) * total;
        for (let i = 0; i < segs.length; i++) {
            const l = segs[i]!;
            if (dist <= l || i === segs.length - 1) {
                return lerp(points[i]!, points[i + 1]!, l > 0 ? Math.min(dist / l, 1) : 0);
            }
            dist -= l;
        }
        return points[points.length - 1]!;
    };
}

export function moverPoseFn(zone: MoverZone, offset: Vec3, rot: Quat): (t: number) => Pose {
    const points = zone.path.map((p) => add(toVec3(p), offset));
    if (zone.loop) points.push(points[0]!);
    const sample = polylineSampler(points);
    const period = zone.period > 0 ? zone.period : 1;
    const ease = zone.ease ?? 'sine';
    const phase = zone.phase ?? 0;
    return (t: number) => {
        const cycle = (((t / period + phase) % 1) + 1) % 1;
        let s: number;
        if (zone.loop) {
            s = easeCycle(cycle, ease === 'sine' ? 'linear' : ease);
        } else {
            // Ping-pong: 0 → 1 over the first half, back over the second.
            const tri = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
            s = easeCycle(tri, ease);
        }
        return { pos: sample(s), rot };
    };
}

const AXES: Record<'x' | 'y' | 'z', Vec3> = {
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
};

export function spinnerPoseFn(zone: SpinnerZone, pos: Vec3, base: Quat): (t: number) => Pose {
    const axis = AXES[zone.axis] ?? AXES.y;
    const omega = (zone.rpm / 60) * 2 * Math.PI;
    const start = (zone.phaseDeg ?? 0) * DEG;
    return (t: number) => {
        const a = (start + omega * t) / 2;
        const spin: Quat = { x: axis.x * Math.sin(a), y: axis.y * Math.sin(a), z: axis.z * Math.sin(a), w: Math.cos(a) };
        // Spin about the zone's own (rotated) axis.
        return { pos, rot: quatMultiply(base, spin) };
    };
}

/**
 * Pure compile step. `offset` is added to every position (zone stamps placed
 * inside composite zones); top-level primitives use the origin.
 */
export function compilePrimitive(zone: PrimitiveZone, offset: Vec3 = { x: 0, y: 0, z: 0 }): CompiledPrimitive {
    switch (zone.type) {
        case 'box': {
            const rot = rotationFromSpec(zone.rot);
            return {
                type: 'box',
                body: {
                    kind: 'fixed',
                    pos: add(toVec3(zone.pos), offset),
                    rot,
                    halfExtents: halfOf(toVec3(zone.size)),
                    ...surface(zone, DEFAULT_COLOR),
                },
            };
        }
        case 'ramp':
            return { type: 'ramp', body: compileRamp(zone, offset) };
        case 'mover': {
            const rot = rotationFromSpec(zone.rot);
            const poseAt = moverPoseFn(zone, offset, rot);
            const start = poseAt(0);
            return {
                type: 'mover',
                body: {
                    kind: 'kinematic',
                    pos: start.pos,
                    rot,
                    halfExtents: halfOf(toVec3(zone.size)),
                    ...surface(zone, DEFAULT_MOVER_COLOR),
                },
                poseAt,
            };
        }
        case 'spinner': {
            const base = rotationFromSpec(zone.rot);
            const pos = add(toVec3(zone.pos), offset);
            const poseAt = spinnerPoseFn(zone, pos, base);
            return {
                type: 'spinner',
                body: {
                    kind: 'kinematic',
                    pos,
                    rot: poseAt(0).rot,
                    halfExtents: halfOf(toVec3(zone.size)),
                    ...surface(zone, DEFAULT_SPINNER_COLOR),
                },
                poseAt,
            };
        }
        case 'trigger':
            return {
                type: 'trigger',
                body: {
                    kind: 'sensor',
                    pos: add(toVec3(zone.pos), offset),
                    rot: rotationFromSpec(zone.rot),
                    halfExtents: halfOf(toVec3(zone.size)),
                    friction: undefined,
                    restitution: undefined,
                    color: zone.color ?? DEFAULT_COLOR,
                    material: undefined,
                },
                trigger: { on: zone.on ?? 'enter', action: zone.do ?? {}, padColor: zone.color },
            };
        default: {
            const unknown: never = zone;
            throw new Error(`[primitives] unknown primitive type ${(unknown as { type?: string }).type}`);
        }
    }
}

/** True when the point lies inside the oriented box. */
export function pointInBody(body: Pose & { halfExtents: Vec3 }, p: Vec3, margin = 0): boolean {
    const inv: Quat = { x: -body.rot.x, y: -body.rot.y, z: -body.rot.z, w: body.rot.w };
    const local = quatRotateVec3(inv, sub(p, body.pos));
    const h = body.halfExtents;
    return Math.abs(local.x) <= h.x + margin
        && Math.abs(local.y) <= h.y + margin
        && Math.abs(local.z) <= h.z + margin;
}

// ── Runtime (bodies, entities, per-level scope) ─────────────────────────────

/** Minimal Rapier/worker body surface the scope drives. */
export interface ScopeBody extends ImpulseBody {
    translation(): Vec3;
    linvel(): Vec3;
    setLinvel(v: Vec3, wake: boolean): void;
    setAngvel?(v: Vec3, wake: boolean): void;
    setTranslation?(t: Vec3, wake: boolean): void;
    setNextKinematicTranslation(t: Vec3): void;
    setNextKinematicRotation(r: Quat): void;
}

interface AnimatedEntry {
    body: ScopeBody;
    entity: unknown;
    halfExtents: Vec3;
    poseAt: (t: number) => Pose;
}

interface TriggerEntry {
    volume: Pose & { halfExtents: Vec3 };
    on: 'enter' | 'stay';
    action: TriggerAction;
    inside: WeakSet<object>;
}

export interface ScopeMarble {
    rigidBody: ScopeBody;
    respawnPos?: Vec3;
    initialPos?: Vec3;
}

/** Host fields `ZoneScope` reads; satisfied by MarblesGame and the headless host. */
export interface ZoneScopeHost {
    world?: { removeRigidBody(body: unknown): void } | null;
    physicsBackend?: { isWorkerMode?(): boolean } | null;
    scene?: { remove(entity: unknown): void; addEntity?(entity: unknown): void } | null;
    engine?: {
        destroyEntity(entity: unknown): void;
        destroyMaterialInstance(mi: unknown): void;
        getTransformManager?(): {
            getInstance(entity: unknown): unknown;
            setTransform(inst: unknown, mat: ArrayLike<number>): void;
        };
    } | null;
    marbles?: ScopeMarble[];
}

/**
 * Owns everything the v2 builder creates for one level. `clearLevel()` calls
 * `dispose()`; nothing created through `buildPrimitive` outlives the level.
 */
export class ZoneScope {
    bodies: unknown[] = [];
    entities: unknown[] = [];
    materialInstances: unknown[] = [];
    animated: AnimatedEntry[] = [];
    triggers: TriggerEntry[] = [];

    addBody<T>(body: T): T {
        this.bodies.push(body);
        return body;
    }

    addEntity<T>(entity: T): T {
        this.entities.push(entity);
        return entity;
    }

    addMaterialInstance<T>(mi: T): T {
        this.materialInstances.push(mi);
        return mi;
    }

    addAnimated(entry: AnimatedEntry): void {
        this.animated.push(entry);
    }

    addTrigger(volume: Pose & { halfExtents: Vec3 }, on: 'enter' | 'stay', action: TriggerAction): void {
        this.triggers.push({ volume, on, action, inside: new WeakSet() });
    }

    get size(): number {
        return this.bodies.length + this.entities.length + this.materialInstances.length;
    }

    /** Simulated seconds since the level was built (drives movers/spinners). */
    time = 0;

    /**
     * Advance kinematic primitives by `dt` simulated seconds (frozen while
     * `paused`, e.g. time-stop) and run trigger volumes against the host's
     * marbles. `setTransform` (optional) pushes each new pose to its entity.
     */
    tick(
        host: ZoneScopeHost,
        dt: number,
        setTransform?: (entry: AnimatedEntry, pose: Pose) => void,
        paused = false,
    ): void {
        if (!paused && dt > 0) this.time += dt;
        for (const entry of this.animated) {
            const pose = entry.poseAt(this.time);
            entry.body.setNextKinematicTranslation(pose.pos);
            entry.body.setNextKinematicRotation(pose.rot);
            setTransform?.(entry, pose);
        }
        if (this.triggers.length === 0 || !host.marbles) return;
        for (const marble of host.marbles) {
            const rb = marble.rigidBody;
            if (!rb) continue;
            const p = rb.translation();
            for (const trig of this.triggers) {
                const inside = pointInBody(trig.volume, p);
                const wasInside = trig.inside.has(marble);
                if (inside && !wasInside) trig.inside.add(marble);
                else if (!inside && wasInside) trig.inside.delete(marble);
                if (inside && (trig.on === 'stay' || !wasInside)) {
                    runTriggerAction(marble, trig.action);
                }
            }
        }
    }

    dispose(host: ZoneScopeHost): void {
        const workerActive = Boolean(host.physicsBackend?.isWorkerMode?.());
        if (!workerActive && host.world) {
            for (const body of this.bodies) host.world.removeRigidBody(body);
        }
        for (const entity of this.entities) {
            host.scene?.remove(entity);
            host.engine?.destroyEntity(entity);
        }
        for (const mi of this.materialInstances) host.engine?.destroyMaterialInstance(mi);
        this.bodies = [];
        this.entities = [];
        this.materialInstances = [];
        this.animated = [];
        this.triggers = [];
        this.time = 0;
    }
}

export function runTriggerAction(marble: ScopeMarble, action: TriggerAction): void {
    const rb = marble.rigidBody;
    if (action.respawn) {
        const target = marble.respawnPos ?? marble.initialPos;
        if (target && rb.setTranslation) {
            rb.setTranslation(target, true);
            rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
            rb.setAngvel?.({ x: 0, y: 0, z: 0 }, true);
        }
        return;
    }
    if (action.setVelocity) rb.setLinvel(toVec3(action.setVelocity), true);
    if (action.boost) applyVelocityChange(rb, toVec3(action.boost));
}

/** Builder services the game (or headless host) provides to `buildPrimitive`. */
export interface PrimitiveBuildHost extends ZoneScopeHost {
    zoneScope: ZoneScope;
    physicsWorld: {
        _createSimBody(
            type: 'fixed' | 'dynamic' | 'kinematic',
            pos: Vec3,
            rotation: Quat,
            collider: Record<string, unknown>,
        ): ScopeBody;
        isStaticBatchingEnabled(): boolean;
        resolveStaticSurfacePreset(preset: string | undefined): unknown;
        queueStaticBoxBatch(pos: Vec3, rot: Quat, he: Vec3, color: RGB, preset: string | undefined, surface: unknown): void;
        createStaticMaterialInstance(color: RGB, preset: string | undefined, surface: unknown): unknown;
    };
    /** Creates a unit-cube renderable (or a stub when headless). */
    createPrimitiveRenderable?: ((materialInstance: unknown, halfExtents: Vec3) => unknown) | undefined;
    setEntityTransform?: ((entity: unknown, pose: Pose, halfExtents: Vec3) => void) | undefined;
}

/** Build one primitive into the host's world, registering it with `host.zoneScope`. */
export function buildPrimitive(host: PrimitiveBuildHost, zone: PrimitiveZone, offset?: Vec3): CompiledPrimitive {
    const compiled = compilePrimitive(zone, offset);
    const { body } = compiled;
    const scope = host.zoneScope;
    const pw = host.physicsWorld;

    if (body.kind === 'sensor') {
        // Triggers are evaluated by ZoneScope.tick (works in worker mode too),
        // so they need no collider; only the optional floor pad is rendered.
        scope.addTrigger(body, compiled.trigger!.on, compiled.trigger!.action);
        const padColor = compiled.trigger!.padColor;
        if (padColor) {
            const padHalf = { x: body.halfExtents.x, y: TRIGGER_PAD_HEIGHT / 2, z: body.halfExtents.z };
            const padPos = add(body.pos, quatRotateVec3(body.rot, { x: 0, y: -body.halfExtents.y + padHalf.y, z: 0 }));
            renderEntity(host, { pos: padPos, rot: body.rot }, padHalf, padColor, undefined);
        }
        return compiled;
    }

    const collider: Record<string, unknown> = { type: 'cuboid', halfExtents: body.halfExtents };
    if (body.friction != null) collider.friction = body.friction;
    if (body.restitution != null) collider.restitution = body.restitution;
    const rb = scope.addBody(pw._createSimBody(body.kind, body.pos, body.rot, collider));

    if (body.kind === 'fixed') {
        if (pw.isStaticBatchingEnabled()) {
            // Batch resources are owned and destroyed by clearLevel's batch pass.
            const surfacePreset = pw.resolveStaticSurfacePreset(body.material);
            pw.queueStaticBoxBatch(body.pos, body.rot, body.halfExtents, body.color, body.material, surfacePreset);
        } else {
            renderEntity(host, body, body.halfExtents, body.color, body.material);
        }
        return compiled;
    }

    const entity = renderEntity(host, body, body.halfExtents, body.color, body.material);
    scope.addAnimated({ body: rb, entity, halfExtents: body.halfExtents, poseAt: compiled.poseAt! });
    return compiled;
}

function renderEntity(host: PrimitiveBuildHost, pose: Pose, halfExtents: Vec3, color: RGB, material: string | undefined): unknown {
    if (!host.createPrimitiveRenderable) return null;
    const pw = host.physicsWorld;
    const surfacePreset = pw.resolveStaticSurfacePreset(material);
    const mi = host.zoneScope.addMaterialInstance(pw.createStaticMaterialInstance(color, material, surfacePreset));
    const entity = host.zoneScope.addEntity(host.createPrimitiveRenderable(mi, halfExtents));
    host.setEntityTransform?.(entity, pose, halfExtents);
    return entity;
}
