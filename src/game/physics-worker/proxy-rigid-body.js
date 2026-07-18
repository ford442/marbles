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
        createRigidBody() {
            throw new Error('[PhysicsWorker] createRigidBody on proxy world — use physicsBackend.registerBody');
        },
        createCollider() {
            throw new Error('[PhysicsWorker] createCollider on proxy world — use physicsBackend.registerBody');
        },
    };
}
