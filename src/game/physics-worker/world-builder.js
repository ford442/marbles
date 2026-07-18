import RAPIER from '@dimforge/rapier3d-compat';

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

    return bodyDesc;
}

/**
 * @param {BodyDescriptor['collider']} collider
 */
function buildColliderDesc(collider) {
    let colliderDesc;
    if (collider.type === 'ball') {
        colliderDesc = RAPIER.ColliderDesc.ball(collider.radius ?? 0.5);
    } else if (collider.type === 'sensor_ball') {
        colliderDesc = RAPIER.ColliderDesc.ball(collider.radius ?? 0.5).setSensor(true);
    } else {
        const h = collider.halfExtents || [0.5, 0.5, 0.5];
        colliderDesc = RAPIER.ColliderDesc.cuboid(h[0], h[1], h[2]);
    }

    if (collider.density != null) colliderDesc.setDensity(collider.density);
    if (collider.friction != null) colliderDesc.setFriction(collider.friction);
    if (collider.restitution != null) colliderDesc.setRestitution(collider.restitution);
    if (collider.collisionGroups != null) colliderDesc.setCollisionGroups(collider.collisionGroups);

    return colliderDesc;
}

/**
 * @param {{ x: number, y: number, z: number }} gravity
 * @param {BodyDescriptor[]} descriptors
 */
export function buildWorldFromDescriptors(gravity, descriptors) {
    const world = new RAPIER.World(gravity);
    const bodies = [];

    for (const desc of descriptors) {
        const bodyDesc = buildBodyDesc(desc);
        const body = world.createRigidBody(bodyDesc);
        const colliderDesc = buildColliderDesc(desc.collider);
        world.createCollider(colliderDesc, body);
        bodies.push(body);
    }

    return { world, bodies };
}

/**
 * @param {import('@dimforge/rapier3d-compat').RigidBody[]} bodies
 * @param {Float32Array} outF32
 * @param {number} slotOffsetFloats
 */
export function writeBodyTransforms(bodies, outF32, slotOffsetFloats) {
    for (let i = 0; i < bodies.length; i++) {
        if (!bodies[i]) continue;
        const t = bodies[i].translation();
        const r = bodies[i].rotation();
        const base = slotOffsetFloats + i * 8;
        outF32[base] = t.x;
        outF32[base + 1] = t.y;
        outF32[base + 2] = t.z;
        outF32[base + 3] = r.x;
        outF32[base + 4] = r.y;
        outF32[base + 5] = r.z;
        outF32[base + 6] = r.w;
        outF32[base + 7] = 1;
    }
}
