import { serializeColliderDesc, serializeRigidBodyDesc } from './rapier-desc-serializer.js';

/**
 * Rapier-shaped facade backed by SharedArrayBuffer + command ring. Reads
 * (pose, velocities, mass, type) come from the worker's last published
 * snapshot; writes are queued and applied before the worker's next step.
 * @param {import('../systems/physics-backend.ts').WorkerPhysicsBackend} backend
 * @param {number} bodyIndex
 */
export function createProxyRigidBody(backend, bodyIndex) {
    // Body indices are recycled (layout v4). Once this proxy is removed, the
    // backend freezes its last snapshot into `_tombstone` and may give the
    // index to a new body: reads then return the frozen values and writes are
    // dropped, so a stale proxy never observes or drives its successor.
    /** @returns {boolean} */
    const current = () => backend.isCurrentProxy(bodyIndex, proxy);
    const proxy = {
        handle: bodyIndex,
        _bodyIndex: bodyIndex,
        _backend: backend,
        /** @type {null | { translation: any, rotation: any, linvel: any, angvel: any, mass: number, type: number }} */
        _tombstone: null,
        translation() {
            return proxy._tombstone ? { ...proxy._tombstone.translation } : backend.getTranslation(bodyIndex);
        },
        rotation() {
            return proxy._tombstone ? { ...proxy._tombstone.rotation } : backend.getRotation(bodyIndex);
        },
        linvel() {
            return proxy._tombstone ? { ...proxy._tombstone.linvel } : backend.getLinvel(bodyIndex);
        },
        angvel() {
            return proxy._tombstone ? { ...proxy._tombstone.angvel } : backend.getAngvel(bodyIndex);
        },
        mass() {
            return proxy._tombstone ? proxy._tombstone.mass : backend.getMass(bodyIndex);
        },
        bodyType() {
            return proxy._tombstone ? proxy._tombstone.type : backend.getBodyType(bodyIndex);
        },
        isValid() {
            return backend.isBodyAlive(proxy);
        },
        gravityScale() {
            return backend.getGravityScale(bodyIndex);
        },
        enableCcd(enabled) {
            if (current()) backend.queueSetCcd(bodyIndex, enabled);
        },
        applyImpulse(force, wake = true) {
            if (current()) backend.queueImpulse(bodyIndex, force, wake);
        },
        applyTorqueImpulse(torque, wake = true) {
            if (current()) backend.queueTorque(bodyIndex, torque, wake);
        },
        setLinvel(v, wake = true) {
            if (current()) backend.queueSetLinvel(bodyIndex, v, wake);
        },
        setAngvel(v, wake = true) {
            if (current()) backend.queueSetAngvel(bodyIndex, v, wake);
        },
        setGravityScale(scale, wake = true) {
            if (current()) backend.queueSetGravityScale(bodyIndex, scale, wake);
        },
        setNextKinematicTranslation(t) {
            if (current()) backend.queueKinematicTranslation(bodyIndex, t);
        },
        setNextKinematicRotation(r) {
            if (current()) backend.queueKinematicRotation(bodyIndex, r);
        },
        setTranslation(t, wake = true) {
            if (current()) backend.queueSetTranslation(bodyIndex, t, wake);
        },
        setRotation(r, wake = true) {
            if (current()) backend.queueSetRotation(bodyIndex, r, wake);
        },
    };
    backend.registerProxy(bodyIndex, proxy);
    return proxy;
}

/**
 * @param {import('../systems/physics-backend.ts').WorkerPhysicsBackend} backend
 */
export function createProxyWorld(backend) {
    // Ray queries go through `game.physicsQueries`, which routes to
    // `backend.castRay`; the proxy world deliberately has no `castRay`.
    return {
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
