// @ts-check
/** Camera pose, modes, FOV, shake, lock-on. */

/** @returns {import('../../types/game-state.js').CameraState} */
export function createCameraState() {
    return {
        camAngle: 0,
        targetCamAngle: 0,
        targetCamRadius: 25,
        targetCamHeight: 10,
        camHeight: 10,
        camRadius: 25,
        cameraMode: 'orbit',
        isLockedOn: false,
        lockOnTarget: null,
        lastLockTime: 0,
        baseFov: 45,
        currentFov: 45,
        cameraShake: { x: 0, y: 0, z: 0 },
        cameraFollowPos: null,
        cameraFollowLookAt: null,
        followDist: 20.0,
    };
}
