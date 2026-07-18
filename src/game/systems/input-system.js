import RAPIER from '@dimforge/rapier3d-compat';
import { findBestLockOnTarget as findBestLockOnTargetPure } from './input-target-lock.js';

/**
 * Keyboard, mouse, gamepad input and marble contact queries (Phase B subsystem).
 */
export class InputSystem {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
    }

    initMouseControls() {
        const g = this.game;
        g.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        g.canvas.addEventListener('click', () => {
            if (g.isPaused) return;
            if (document.pointerLockElement !== g.canvas) {
                g.canvas.requestPointerLock();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === g.canvas && !g.isPaused) {
                const baseSensitivity = g.getMouseSensitivity ? g.getMouseSensitivity() : 0.002;
                const sensitivity = baseSensitivity;
                const yMultiplier = g.isYAxisInverted ? -1 : 1;

                g.aimYaw -= e.movementX * sensitivity;
                g.pitchAngle -= e.movementY * sensitivity * yMultiplier;
                const maxPitch = 1.4;
                g.pitchAngle = Math.max(-maxPitch, Math.min(maxPitch, g.pitchAngle));

                if (g.cameraMode === 'orbit') {
                    g.targetCamAngle -= e.movementX * sensitivity * 2.0;
                    g.targetCamHeight += e.movementY * sensitivity * 10.0 * yMultiplier;
                    g.targetCamHeight = Math.max(1.0, Math.min(50.0, g.targetCamHeight));
                }
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === g.canvas && !g.isPaused) {
                if (e.button === 0) {
                    g.charging = true;
                    g.chargePower = 0;
                } else if (e.button === 1) {
                    e.preventDefault();
                    if (g.isGrappling) {
                        g.isGrappleZipping = true;
                    } else {
                        this.toggleTargetLockOn();
                    }
                } else if (e.button === 2) {
                    g.startGrapple();
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (document.pointerLockElement === g.canvas && !g.isPaused) {
                if (e.button === 0) {
                    if (g.charging) {
                        g.charging = false;
                        g.shootMarble();
                    }
                } else if (e.button === 1) {
                    g.isGrappleZipping = false;
                } else if (e.button === 2) {
                    g.stopGrapple();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (document.pointerLockElement === g.canvas && !g.isPaused) {
                if (e.key.toLowerCase() === 'l' && !e.repeat) {
                    this.toggleTargetLockOn();
                }
            }
        });

        document.addEventListener('wheel', (e) => {
            if (document.pointerLockElement === g.canvas && !g.isPaused) {
                if (g.isGrappling) {
                    const reelSpeed = 1.5;
                    if (e.deltaY > 0) {
                        g.grappleRestLength = Math.min(g.grappleMaxDist, (g.grappleRestLength || 10) + reelSpeed);
                    } else if (e.deltaY < 0) {
                        g.grappleRestLength = Math.max(1.0, (g.grappleRestLength || 10) - reelSpeed);
                    }
                } else if (g.cameraMode === 'follow' || g.cameraMode === 'action') {
                    const distSensitivity = 1.5;
                    g.followDist = g.followDist || 20.0;
                    if (e.deltaY > 0) {
                        g.followDist = Math.min(g.followDist + distSensitivity, 50.0);
                    } else if (e.deltaY < 0) {
                        g.followDist = Math.max(g.followDist - distSensitivity, 5.0);
                    }
                } else if (g.cameraMode === 'drone') {
                    const zoomSensitivity = 2.0;
                    g.droneDist = g.droneDist || 25.0;
                    if (e.deltaY > 0) {
                        g.droneDist = Math.min(100.0, g.droneDist + zoomSensitivity);
                    } else if (e.deltaY < 0) {
                        g.droneDist = Math.max(5.0, g.droneDist - zoomSensitivity);
                    }
                } else if (g.cameraMode === 'orbit') {
                    const zoomSensitivity = 2.0;
                    if (e.deltaY > 0) {
                        g.targetCamRadius = Math.min(100, g.targetCamRadius + zoomSensitivity);
                    } else if (e.deltaY < 0) {
                        g.targetCamRadius = Math.max(5, g.targetCamRadius - zoomSensitivity);
                    }
                } else {
                    const zoomSensitivity = 2.0;
                    g.currentFov = g.currentFov || 45;
                    if (e.deltaY > 0) {
                        g.currentFov = Math.min(g.currentFov + zoomSensitivity, 120);
                    } else if (e.deltaY < 0) {
                        g.currentFov = Math.max(g.currentFov - zoomSensitivity, 20);
                    }

                    if (g.view && g.camera && g.Filament) {
                        const width = g.canvas.width;
                        const height = g.canvas.height;
                        const aspect = width / height;
                        const CameraFov = g.Filament?.['Camera$Fov'];
                        const fovMode = CameraFov ? CameraFov.VERTICAL : 0;
                        g.camera.setProjectionFov(g.currentFov, aspect, 0.1, 1000.0, fovMode);
                    }
                }
            }
        });
    }

    pollGamepads() {
        const g = this.game;
        if (g.isPaused) return;

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (!gp) continue;

            const prevState = g.gamepadState[gp.index] || { buttons: [] };
            const currState = { buttons: [] };

            const buttonMap = {
                0: 'Space',
                1: 'KeyV',
                2: 'KeyX',
                3: 'KeyY',
                4: 'KeyH',
                5: 'KeyE',
                6: 'KeyF',
                7: 'ShiftLeft',
                8: 'KeyR',
                9: 'KeyM',
                11: 'Digit0',
                12: 'KeyL',
                13: 'KeyU',
                14: 'Digit6',
                15: 'KeyG',
            };

            for (let b = 0; b < gp.buttons.length; b++) {
                const pressed = gp.buttons[b].pressed || gp.buttons[b].value > 0.5;
                currState.buttons[b] = pressed;

                const keyCode = buttonMap[b];
                if (keyCode) {
                    const wasPressed = prevState.buttons[b];
                    if (pressed && !wasPressed) {
                        window.dispatchEvent(new KeyboardEvent('keydown', { code: keyCode }));
                    } else if (!pressed && wasPressed) {
                        window.dispatchEvent(new KeyboardEvent('keyup', { code: keyCode }));
                    }
                }
            }

            const deadzone = 0.2;
            const axesMap = {
                0: { pos: 'ArrowRight', neg: 'ArrowLeft' },
                1: { pos: 'ArrowDown', neg: 'ArrowUp' },
            };

            for (let a = 0; a <= 1; a++) {
                const val = gp.axes[a];
                const mapping = axesMap[a];

                const posPressed = val > deadzone;
                const posKeyCode = mapping.pos;
                const posWasPressed = prevState[posKeyCode] || false;
                currState[posKeyCode] = posPressed;
                if (posPressed && !posWasPressed) {
                    window.dispatchEvent(new KeyboardEvent('keydown', { code: posKeyCode }));
                } else if (!posPressed && posWasPressed) {
                    window.dispatchEvent(new KeyboardEvent('keyup', { code: posKeyCode }));
                }

                const negPressed = val < -deadzone;
                const negKeyCode = mapping.neg;
                const negWasPressed = prevState[negKeyCode] || false;
                currState[negKeyCode] = negPressed;
                if (negPressed && !negWasPressed) {
                    window.dispatchEvent(new KeyboardEvent('keydown', { code: negKeyCode }));
                } else if (!negPressed && negWasPressed) {
                    window.dispatchEvent(new KeyboardEvent('keyup', { code: negKeyCode }));
                }
            }

            const camDeadzone = 0.1;
            const camSensitivity = 0.05;

            const rx = gp.axes[2];
            const ry = gp.axes[3];

            if (g.cameraMode !== 'orbit') {
                if (Math.abs(rx) > camDeadzone) {
                    g.aimYaw -= rx * camSensitivity;
                }

                if (Math.abs(ry) > camDeadzone) {
                    g.pitchAngle -= ry * camSensitivity;
                    const maxPitch = 1.4;
                    g.pitchAngle = Math.max(-maxPitch, Math.min(maxPitch, g.pitchAngle));
                }
            } else {
                if (Math.abs(rx) > camDeadzone) {
                    g.targetCamAngle -= rx * camSensitivity;
                }

                if (Math.abs(ry) > camDeadzone) {
                    g.targetCamHeight += ry * camSensitivity * 5.0;
                    g.targetCamHeight = Math.max(1.0, Math.min(50.0, g.targetCamHeight));
                }
            }

            g.gamepadState[gp.index] = currState;
        }
    }

    isGrounded(marble) {
        const g = this.game;
        if (!marble?.rigidBody) return false;
        const rb = marble.rigidBody;
        const radius = marble.scale * 0.5 || 0.5;
        const pos = rb.translation();
        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z };
        const gravityDir = rb.gravityScale() < 0 ? 1 : -1;
        const rayDir = { x: 0, y: gravityDir, z: 0 };
        const ray = new RAPIER.Ray(rayOrigin, rayDir);
        const maxToi = radius + 0.1;
        const hit = g.world.castRay(ray, maxToi, true);

        if (hit) {
            const otherBody = hit.collider.parent();
            if (otherBody && otherBody.handle === rb.handle) {
                return false;
            }
            return true;
        }
        return false;
    }

    getWallContact(marble) {
        const g = this.game;
        if (!marble?.rigidBody) return null;
        const rb = marble.rigidBody;
        const radius = marble.scale * 0.5 || 0.5;
        const pos = rb.translation();

        const directions = [
            { x: 1, z: 0 }, { x: -1, z: 0 },
            { x: 0, z: 1 }, { x: 0, z: -1 },
            { x: 0.707, z: 0.707 }, { x: -0.707, z: 0.707 },
            { x: 0.707, z: -0.707 }, { x: -0.707, z: -0.707 },
        ];

        for (const dir of directions) {
            const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
            const ndir = { x: dir.x / len, y: 0, z: dir.z / len };

            const startDist = radius + 0.05;
            const rayOrigin = {
                x: pos.x + ndir.x * startDist,
                y: pos.y,
                z: pos.z + ndir.z * startDist,
            };

            const ray = new RAPIER.Ray(rayOrigin, ndir);
            const checkDist = 0.5;

            const hit = g.world.castRay(ray, checkDist, true);

            if (hit) {
                const otherBody = hit.collider.parent();
                if (otherBody && otherBody.handle !== rb.handle) {
                    return { normal: { x: -ndir.x, y: 0, z: -ndir.z } };
                }
            }
        }
        return null;
    }

    toggleTargetLockOn() {
        const g = this.game;
        const now = Date.now();
        if (now - (g.lastLockTime || 0) < 300) return;
        g.lastLockTime = now;

        if (g.isLockedOn) {
            g.isLockedOn = false;
            g.lockOnTarget = null;
            console.log('[GAME] Target Lock-On Disabled');
        } else {
            const target = this.findBestLockOnTarget();
            if (target) {
                g.isLockedOn = true;
                g.lockOnTarget = target;
                console.log('[GAME] Target Lock-On Enabled:', target.name);
            }
        }
    }

    findBestLockOnTarget() {
        const g = this.game;
        return findBestLockOnTargetPure(g.marbles, g.playerMarble);
    }
}

export { findBestLockOnTargetPure as findBestLockOnTarget } from './input-target-lock.js';
