import RAPIER from '@dimforge/rapier3d-compat';
import {
    BODY_ANGVEL,
    BODY_FLOATS,
    BODY_LINVEL,
    BODY_MASS,
    BODY_TYPE,
    BODY_VALID,
    MAX_BODIES,
} from './protocol.js';

/**
 * @typedef {object} BodyDescriptor
 * @property {string} type fixed|dynamic|kinematic
 * @property {number[]} translation
 * @property {number[]} rotation
 * @property {object} collider
 * @property {number} [gravityScale]
 * @property {number} [linearDamping]
 * @property {number} [angularDamping]
 * @property {boolean} [canSleep]
 * @property {number[]} [linvel]
 * @property {boolean} [ccd]
 */

/**
 * @param {BodyDescriptor} desc
 */
function buildBodyDesc(desc) {
    let bodyDesc;
    if (desc.type === 'fixed') {
        bodyDesc = RAPIER.RigidBodyDesc.fixed();
    } else if (desc.type === 'kinematic') {
        bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    } else {
        bodyDesc = RAPIER.RigidBodyDesc.dynamic();
    }

    const t = desc.translation || [0, 0, 0];
    const r = desc.rotation || [0, 0, 0, 1];
    bodyDesc.setTranslation(t[0], t[1], t[2]);
    bodyDesc.setRotation({ x: r[0], y: r[1], z: r[2], w: r[3] });

    if (desc.gravityScale != null) bodyDesc.setGravityScale(desc.gravityScale);
    if (desc.linearDamping != null) bodyDesc.setLinearDamping(desc.linearDamping);
    if (desc.angularDamping != null) bodyDesc.setAngularDamping(desc.angularDamping);
    if (desc.canSleep === false) bodyDesc.setCanSleep(false);
    if (desc.ccd) bodyDesc.setCcdEnabled(true);

    return bodyDesc;
}

/**
 * @param {BodyDescriptor['collider']} collider
 */
function buildShapeDesc(collider) {
    switch (collider.type) {
        case 'ball':
        case 'sensor_ball':
            return RAPIER.ColliderDesc.ball(collider.radius ?? 0.5);
        case 'cuboid': {
            const h = collider.halfExtents || [0.5, 0.5, 0.5];
            return RAPIER.ColliderDesc.cuboid(h[0], h[1], h[2]);
        }
        case 'capsule':
            return RAPIER.ColliderDesc.capsule(collider.halfHeight, collider.radius);
        case 'cylinder':
            return RAPIER.ColliderDesc.cylinder(collider.halfHeight, collider.radius);
        case 'cone':
            return RAPIER.ColliderDesc.cone(collider.halfHeight, collider.radius);
        case 'trimesh':
            return RAPIER.ColliderDesc.trimesh(
                new Float32Array(collider.vertices),
                new Uint32Array(collider.indices),
            );
        default:
            throw new Error(`[PhysicsWorker] unsupported collider type '${collider.type}'`);
    }
}

/**
 * @param {BodyDescriptor['collider']} collider
 */
function buildColliderDesc(collider) {
    const colliderDesc = buildShapeDesc(collider);
    if (collider.sensor || collider.type === 'sensor_ball') colliderDesc.setSensor(true);
    if (collider.offset) {
        const o = collider.offset;
        colliderDesc.setTranslation(o[0], o[1], o[2]);
    }
    if (collider.offsetRotation) {
        const r = collider.offsetRotation;
        colliderDesc.setRotation({ x: r[0], y: r[1], z: r[2], w: r[3] });
    }

    if (collider.density != null) colliderDesc.setDensity(collider.density);
    if (collider.friction != null) colliderDesc.setFriction(collider.friction);
    if (collider.restitution != null) colliderDesc.setRestitution(collider.restitution);
    if (collider.collisionGroups != null) colliderDesc.setCollisionGroups(collider.collisionGroups);

    return colliderDesc;
}

/**
 * @param {BodyDescriptor} desc
 */
export function createBodyFromDescriptor(world, desc) {
    const bodyDesc = buildBodyDesc(desc);
    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = buildColliderDesc(desc.collider);
    world.createCollider(colliderDesc, body);

    if (desc.linvel) {
        body.setLinvel(
            { x: desc.linvel[0], y: desc.linvel[1], z: desc.linvel[2] },
            false,
        );
    }

    return body;
}

/**
 * @param {{ x: number, y: number, z: number }} gravity
 * @param {BodyDescriptor[]} descriptors
 */
export function buildWorldFromDescriptors(gravity, descriptors) {
    const world = new RAPIER.World(gravity);
    const bodies = [];

    for (const desc of descriptors) {
        bodies.push(createBodyFromDescriptor(world, desc));
    }

    return { world, bodies };
}

/**
 * Insert a body at a stable index (sparse array).
 * @param {import('@dimforge/rapier3d-compat').World} world
 * @param {Array<import('@dimforge/rapier3d-compat').RigidBody | null>} bodies
 * @param {BodyDescriptor} desc
 * @param {number} bodyIndex
 */
export function insertBodyAtIndex(world, bodies, desc, bodyIndex) {
    if (bodyIndex >= MAX_BODIES) {
        throw new RangeError(`[PhysicsWorker] bodyIndex ${bodyIndex} exceeds MAX_BODIES=${MAX_BODIES}`);
    }
    while (bodies.length <= bodyIndex) {
        bodies.push(null);
    }
    bodies[bodyIndex] = createBodyFromDescriptor(world, desc);
    return bodies[bodyIndex];
}

/**
 * @param {import('@dimforge/rapier3d-compat').RigidBody[]} bodies
 * @returns {number}
 */
export function getBodySlotCount(bodies) {
    return Math.min(bodies.length, MAX_BODIES);
}

/**
 * Write each body's snapshot record (pose, velocities, mass, type).
 * Removed bodies are marked invalid. Bodies past `MAX_BODIES` are not
 * published (they would overrun the slot).
 * @param {Array<import('@dimforge/rapier3d-compat').RigidBody | null>} bodies
 * @param {Float32Array} outF32
 * @param {number} slotOffsetFloats
 */
export function writeBodyTransforms(bodies, outF32, slotOffsetFloats) {
    const count = Math.min(bodies.length, MAX_BODIES);
    for (let i = 0; i < count; i++) {
        const body = bodies[i];
        const base = slotOffsetFloats + i * BODY_FLOATS;
        if (!body) {
            outF32[base + BODY_VALID] = 0;
            continue;
        }
        const t = body.translation();
        const r = body.rotation();
        const v = body.linvel();
        const w = body.angvel();
        outF32[base] = t.x;
        outF32[base + 1] = t.y;
        outF32[base + 2] = t.z;
        outF32[base + 3] = r.x;
        outF32[base + 4] = r.y;
        outF32[base + 5] = r.z;
        outF32[base + 6] = r.w;
        outF32[base + BODY_VALID] = 1;
        outF32[base + BODY_LINVEL] = v.x;
        outF32[base + BODY_LINVEL + 1] = v.y;
        outF32[base + BODY_LINVEL + 2] = v.z;
        outF32[base + BODY_ANGVEL] = w.x;
        outF32[base + BODY_ANGVEL + 1] = w.y;
        outF32[base + BODY_ANGVEL + 2] = w.z;
        outF32[base + BODY_MASS] = body.mass();
        outF32[base + BODY_TYPE] = body.bodyType();
    }
}
