import RAPIER from '@dimforge/rapier3d-compat';

const BODY_TYPE = {
    dynamic: RAPIER.RigidBodyType?.Dynamic ?? 0,
    fixed: RAPIER.RigidBodyType?.Fixed ?? 1,
    kinematic: RAPIER.RigidBodyType?.KinematicPositionBased ?? 2,
    kinematicVelocity: RAPIER.RigidBodyType?.KinematicVelocityBased ?? 3,
};

/**
 * @param {import('@dimforge/rapier3d-compat').RigidBodyDesc} bodyDesc
 */
export function serializeRigidBodyDesc(bodyDesc) {
    const status = bodyDesc.status;
    let type = 'dynamic';
    if (status === BODY_TYPE.fixed) type = 'fixed';
    else if (status === BODY_TYPE.kinematic) type = 'kinematic';
    else if (status === BODY_TYPE.kinematicVelocity) type = 'kinematic';

    const t = bodyDesc.translation;
    const r = bodyDesc.rotation;
    const lv = bodyDesc.linvel;

    return {
        type,
        translation: [t.x, t.y, t.z],
        rotation: [r.x, r.y, r.z, r.w],
        gravityScale: bodyDesc.gravityScale,
        linearDamping: bodyDesc.linearDamping,
        angularDamping: bodyDesc.angularDamping,
        canSleep: bodyDesc.canSleep,
        linvel: lv ? [lv.x, lv.y, lv.z] : undefined,
    };
}

/**
 * @param {import('@dimforge/rapier3d-compat').ColliderDesc} colliderDesc
 */
export function serializeColliderDesc(colliderDesc) {
    const shape = colliderDesc.shape;
    const shapeType = shape?.type;

    /** @type {object} */
    const collider = {
        friction: colliderDesc.friction,
        restitution: colliderDesc.restitution,
        density: colliderDesc.density,
    };

    if (colliderDesc.isSensor) {
        collider.type = 'sensor_ball';
    }

    if (shapeType === 0 || shape?.radius != null) {
        collider.type = colliderDesc.isSensor ? 'sensor_ball' : 'ball';
        collider.radius = shape.radius;
    } else if (shapeType === 1 || shape?.halfExtents != null) {
        collider.type = 'cuboid';
        const h = shape.halfExtents;
        collider.halfExtents = [h.x, h.y, h.z];
    } else {
        collider.type = 'cuboid';
        collider.halfExtents = [0.5, 0.5, 0.5];
    }

    if (colliderDesc.collisionGroups != null) {
        collider.collisionGroups = colliderDesc.collisionGroups;
    }

    return collider;
}
