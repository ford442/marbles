/**
 * Camera pose types shared by the rendering / lighting modules and the
 * `_cameraState` game field (`CameraState` in game-state.ts).
 */

/** World-space `[x, y, z]`. */
export type Vec3Tuple = [number, number, number];

/**
 * Camera eye / look-at target recorded after `camera.lookAt()` each frame
 * (`game-loop/camera.js` writes it to `game._cameraState`).
 */
export interface CameraPose {
    eye: Vec3Tuple;
    target: Vec3Tuple;
}
