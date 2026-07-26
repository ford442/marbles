import { serializeColliderDesc, serializeRigidBodyDesc } from './rapier-desc-serializer.js';

/**
 * Rapier-shaped facade backed by SharedArrayBuffer + command ring.
 * @param {import('../systems/physics-backend.js').WorkerPhysicsBackend} backend
 * @param {number} bodyIndex
 */
export function createProxyRigidBody(backend, bodyIndex) {
    const proxy = {
        handle: bodyIndex,
        _bodyIndex: bodyIndex,
        _backend: backend,
        translation() {
            return backend.getTranslation(bodyIndex);
        },
        rotation() {
            return backend.getRotation(bodyIndex);
        },
        linvel() {
            return backend.getLinvel(bodyIndex);
        },
        angvel() {
            return backend.getAngvel(bodyIndex);
        },
        gravityScale() {
            return backend.getGravityScale(bodyIndex);
        },
        applyImpulse(force, wake = true) {
            backend.queueImpulse(bodyIndex, force, wake);
        },
        applyTorqueImpulse(torque, wake = true) {
            backend.queueTorque(bodyIndex, torque, wake);
        },
        setLinvel(v, wake = true) {
            backend.queueSetLinvel(bodyIndex, v, wake);
        },
        setAngvel(v, wake = true) {
            backend.queueSetAngvel(bodyIndex, v, wake);
        },
        setGravityScale(scale, wake = true) {
            backend.queueSetGravityScale(bodyIndex, scale, wake);
        },
        setNextKinematicTranslation(t) {
            backend.queueKinematicTranslation(bodyIndex, t);
        },
        setNextKinematicRotation(r) {
            backend.queueKinematicRotation(bodyIndex, r);
        },
        setTranslation(t, wake = true) {
            backend.queueSetTranslation(bodyIndex, t, wake);
            backend._linvelCache.set(bodyIndex, { x: 0, y: 0, z: 0 });
        },
        setRotation(r, wake = true) {
            backend.queueSetRotation(bodyIndex, r, wake);
        },
    };
    backend.registerProxy(bodyIndex, proxy);
    return proxy;
}

/**
 * @param {import('../systems/physics-backend.js').WorkerPhysicsBackend} backend
 */
export function createProxyWorld(backend) {
    return {
        get timestep() {
            return backend.timestep;
        },
        set timestep(value) {
            backend.setTimestep(value);
        },
        castRay(ray, maxDist, solid = true, filterFlags, filterGroups, filterExcludeCollider, filterExcludeRigidBody) {
            return backend.castRay({
                ray,
                maxDist,
                solid,
                filterFlags,
                filterGroups,
                filterExcludeCollider,
                filterExcludeRigidBody,
            });
        },
        removeRigidBody(body) {
            backend.removeRigidBody(body);
        },
        step() {
            // Worker loop owns simulation; main thread only drains commands via backend.step().
        },
        createRigidBody(bodyDesc) {
            const bodyIndex = backend.reserveBodyIndex();
            const partial = serializeRigidBodyDesc(bodyDesc);
            backend._pendingBodies.set(bodyIndex, partial);
            return createProxyRigidBody(backend, bodyIndex);
        },
        createCollider(colliderDesc, body) {
            const bodyIndex = body?.handle ?? body?._bodyIndex;
            if (bodyIndex == null) {
                throw new Error('[PhysicsWorker] createCollider requires a proxy rigid body');
            }

            const partial = backend._pendingBodies.get(bodyIndex);
            if (!partial) {
                throw new Error(`[PhysicsWorker] missing pending body for index ${bodyIndex}`);
            }

            partial.collider = serializeColliderDesc(colliderDesc);
            backend._pendingBodies.delete(bodyIndex);
            backend.finalizeBodyDescriptor(bodyIndex, partial);
            return {
                parent() {
                    return body;
                },
            };
        },
    };
}
