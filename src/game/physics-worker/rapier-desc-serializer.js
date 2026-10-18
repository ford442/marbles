import RAPIER from '@dimforge/rapier3d-compat';

const BODY_TYPE = {
    dynamic: RAPIER.RigidBodyType?.Dynamic ?? 0,
    fixed: RAPIER.RigidBodyType?.Fixed ?? 1,
    kinematic: RAPIER.RigidBodyType?.KinematicPositionBased ?? 2,
    kinematicVelocity: RAPIER.RigidBodyType?.KinematicVelocityBased ?? 3,
};

const SHAPE_TYPE = {
    ball: RAPIER.ShapeType?.Ball ?? 0,
    cuboid: RAPIER.ShapeType?.Cuboid ?? 1,
    capsule: RAPIER.ShapeType?.Capsule ?? 2,
    trimesh: RAPIER.ShapeType?.TriMesh ?? 6,
    cylinder: RAPIER.ShapeType?.Cylinder ?? 10,
    cone: RAPIER.ShapeType?.Cone ?? 11,
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
        ccd: bodyDesc.ccdEnabled === true,
    };
}

/**
 * Shape fields for a descriptor. Throws on shapes the worker cannot rebuild
 * rather than silently substituting a box.
 * @param {any} shape
 */
function serializeShape(shape) {
    switch (shape?.type) {
        case SHAPE_TYPE.ball:
            return { type: 'ball', radius: shape.radius };
        case SHAPE_TYPE.cuboid: {
            const h = shape.halfExtents;
            return { type: 'cuboid', halfExtents: [h.x, h.y, h.z] };
        }
        case SHAPE_TYPE.capsule:
            return { type: 'capsule', halfHeight: shape.halfHeight, radius: shape.radius };
        case SHAPE_TYPE.cylinder:
            return { type: 'cylinder', halfHeight: shape.halfHeight, radius: shape.radius };
        case SHAPE_TYPE.cone:
            return { type: 'cone', halfHeight: shape.halfHeight, radius: shape.radius };
        case SHAPE_TYPE.trimesh:
            return {
                type: 'trimesh',
                vertices: Array.from(shape.vertices),
                indices: Array.from(shape.indices),
            };
        default:
            throw new Error(
                `[PhysicsWorker] cannot serialize collider shape type ${shape?.type}; `
                + 'add it to rapier-desc-serializer.js and world-builder.js',
            );
    }
}

/**
 * @param {import('@dimforge/rapier3d-compat').ColliderDesc} colliderDesc
 */
export function serializeColliderDesc(colliderDesc) {
    /** @type {Record<string, unknown>} */
    const collider = {
        ...serializeShape(colliderDesc.shape),
        friction: colliderDesc.friction,
        restitution: colliderDesc.restitution,
        density: colliderDesc.density,
    };

    if (colliderDesc.isSensor) collider.sensor = true;

    const t = colliderDesc.translation;
    if (t && (t.x !== 0 || t.y !== 0 || t.z !== 0)) {
        collider.offset = [t.x, t.y, t.z];
    }
    const r = colliderDesc.rotation;
    if (r && (r.x !== 0 || r.y !== 0 || r.z !== 0 || r.w !== 1)) {
        collider.offsetRotation = [r.x, r.y, r.z, r.w];
    }

    if (colliderDesc.collisionGroups != null) {
        collider.collisionGroups = colliderDesc.collisionGroups;
    }

    return collider;
}
