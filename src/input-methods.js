import RAPIER from '@dimforge/rapier3d-compat';

export class InputMethods {
    initMouseControls() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault())

        this.canvas.addEventListener('click', () => {
            if (document.pointerLockElement !== this.canvas) {
                this.canvas.requestPointerLock()
            }
        })

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.canvas) {
                const sensitivity = 0.002
                this.aimYaw -= e.movementX * sensitivity
                this.pitchAngle -= e.movementY * sensitivity
                const maxPitch = 1.4
                this.pitchAngle = Math.max(-maxPitch, Math.min(maxPitch, this.pitchAngle))
            }
        })

        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === this.canvas) {
                if (e.button === 0) {
                    this.charging = true
                    this.chargePower = 0
                } else if (e.button === 2) {
                    this.startGrapple()
                }
            }
        })

        document.addEventListener('mouseup', (e) => {
            if (document.pointerLockElement === this.canvas) {
                if (e.button === 0) {
                    if (this.charging) {
                        this.charging = false
                        this.shootMarble()
                    }
                } else if (e.button === 2) {
                    this.stopGrapple()
                }
            }
        })

        document.addEventListener('wheel', (e) => {
            if (document.pointerLockElement === this.canvas) {
                // Adjust field of view based on wheel scroll direction
                const zoomSensitivity = 2.0;
                    this.currentFov = this.currentFov || 45;
                if (e.deltaY > 0) {
                    this.currentFov = Math.min(this.currentFov + zoomSensitivity, 120); // Zoom out
                } else if (e.deltaY < 0) {
                    this.currentFov = Math.max(this.currentFov - zoomSensitivity, 20); // Zoom in
                }

                // Immediately update camera projection if view and camera are available
                if (this.view && this.camera && this.Filament) {
                    const width = this.canvas.width;
                    const height = this.canvas.height;
                    const aspect = width / height;
                    const Fov = this.Filament.Camera$Fov;
                    this.camera.setProjectionFov(this.currentFov, aspect, 0.1, 1000.0, Fov.VERTICAL);
                }
            }
        })
    }

    pollGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i]
            if (!gp) continue

            const prevState = this.gamepadState[gp.index] || { buttons: [] }
            const currState = { buttons: [] }

            // Common Gamepad Button Mapping (Standard Gamepad)
            // 0: A/Cross (Jump)
            // 1: B/Circle (Dash)
            // 2: X/Square (Bomb)
            // 3: Y/Triangle (Vortex)
            // 4: LB/L1 (Hover)
            // 5: RB/R1 (Magnet)
            // 6: LT/L2 (Focus)
            // 7: RT/R2 (Boost)
            // 8: Back/Select (Reset)
            // 9: Start (Menu)
            // 12: D-pad Up (Missile)
            // 13: D-pad Down (Gravity Flip)
            // 14: D-pad Left (Phase Shift)
            // 15: D-pad Right (Glider)

            const buttonMap = {
                0: 'Space',       // A -> Jump
                1: 'KeyV',        // B -> Dash
                2: 'KeyX',        // X -> Bomb
                3: 'KeyY',        // Y -> Vortex
                4: 'KeyH',        // LB -> Hover
                5: 'KeyE',        // RB -> Magnet Attract
                6: 'KeyF',        // LT -> Focus
                7: 'ShiftLeft',   // RT -> Boost
                8: 'KeyR',        // Select -> Reset
                9: 'KeyM',        // Start -> Menu
                12: 'KeyL',       // D-pad Up -> Missile
                13: 'KeyU',       // D-pad Down -> Gravity Flip
                14: 'Digit6',     // D-pad Left -> Phase Shift
                15: 'KeyG'        // D-pad Right -> Gravity Pulse
            }

            for (let b = 0; b < gp.buttons.length; b++) {
                const pressed = gp.buttons[b].pressed || gp.buttons[b].value > 0.5
                currState.buttons[b] = pressed

                const keyCode = buttonMap[b]
                if (keyCode) {
                    const wasPressed = prevState.buttons[b]
                    if (pressed && !wasPressed) {
                        window.dispatchEvent(new KeyboardEvent('keydown', { code: keyCode }))
                    } else if (!pressed && wasPressed) {
                        window.dispatchEvent(new KeyboardEvent('keyup', { code: keyCode }))
                    }
                }
            }

            // Left Stick -> WASD Mapping (Movement)
            const deadzone = 0.2
            const axesMap = {
                // Left Stick X -> A / D
                0: { pos: 'ArrowRight', neg: 'ArrowLeft' },
                // Left Stick Y -> W / S
                1: { pos: 'ArrowDown', neg: 'ArrowUp' }
            }

            for (let a = 0; a <= 1; a++) {
                const val = gp.axes[a]
                const mapping = axesMap[a]

                // Positive axis
                const posPressed = val > deadzone
                const posKeyCode = mapping.pos
                const posWasPressed = prevState[posKeyCode] || false
                currState[posKeyCode] = posPressed
                if (posPressed && !posWasPressed) {
                    window.dispatchEvent(new KeyboardEvent('keydown', { code: posKeyCode }))
                } else if (!posPressed && posWasPressed) {
                    window.dispatchEvent(new KeyboardEvent('keyup', { code: posKeyCode }))
                }

                // Negative axis
                const negPressed = val < -deadzone
                const negKeyCode = mapping.neg
                const negWasPressed = prevState[negKeyCode] || false
                currState[negKeyCode] = negPressed
                if (negPressed && !negWasPressed) {
                    window.dispatchEvent(new KeyboardEvent('keydown', { code: negKeyCode }))
                } else if (!negPressed && negWasPressed) {
                    window.dispatchEvent(new KeyboardEvent('keyup', { code: negKeyCode }))
                }
            }

            // Right Stick -> Camera Controls (Aim / Pitch)
            // Axes 2 (X) and 3 (Y)
            if (this.cameraMode !== 'orbit') {
                const camDeadzone = 0.1
                const camSensitivity = 0.05

                const rx = gp.axes[2]
                const ry = gp.axes[3]

                if (Math.abs(rx) > camDeadzone) {
                    this.aimYaw -= rx * camSensitivity
                }

                if (Math.abs(ry) > camDeadzone) {
                    this.pitchAngle -= ry * camSensitivity
                    const maxPitch = 1.4
                    this.pitchAngle = Math.max(-maxPitch, Math.min(maxPitch, this.pitchAngle))
                }
            }

            this.gamepadState[gp.index] = currState
        }
    }

    isGrounded(marble) {
        if (!marble || !marble.rigidBody) return false
        const rb = marble.rigidBody
        const radius = marble.scale * 0.5 || 0.5
        const pos = rb.translation()
        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
        const gravityDir = rb.gravityScale() < 0 ? 1 : -1
        const rayDir = { x: 0, y: gravityDir, z: 0 }
        const ray = new RAPIER.Ray(rayOrigin, rayDir)
        const maxToi = radius + 0.1
        const hit = this.world.castRay(ray, maxToi, true)

        if (hit) {
            const otherBody = hit.collider.parent()
            if (otherBody && otherBody.handle === rb.handle) {
                return false // Hit self, ignore
            }
            return true
        }
        return false
    }

    getWallContact(marble) {
        if (!marble || !marble.rigidBody) return null
        const rb = marble.rigidBody
        const radius = marble.scale * 0.5 || 0.5
        const pos = rb.translation()

        // 8 directions
        const directions = [
            { x: 1, z: 0 }, { x: -1, z: 0 },
            { x: 0, z: 1 }, { x: 0, z: -1 },
            { x: 0.707, z: 0.707 }, { x: -0.707, z: 0.707 },
            { x: 0.707, z: -0.707 }, { x: -0.707, z: -0.707 }
        ]

        // We need to check collisions that are NOT the marble itself.

        for (const dir of directions) {
             const len = Math.sqrt(dir.x*dir.x + dir.z*dir.z)
             const ndir = { x: dir.x/len, y: 0, z: dir.z/len }

             const startDist = radius + 0.05
             const rayOrigin = {
                 x: pos.x + ndir.x * startDist,
                 y: pos.y,
                 z: pos.z + ndir.z * startDist
             }

             const ray = new RAPIER.Ray(rayOrigin, ndir)
             const checkDist = 0.5

             const hit = this.world.castRay(ray, checkDist, true)

             if (hit) {
                 const otherBody = hit.collider.parent()
                 if (otherBody && otherBody.handle !== rb.handle) {
                     // Found a wall!
                     return { normal: { x: -ndir.x, y: 0, z: -ndir.z } }
                 }
             }
        }
        return null
    }

}

export function applyInputMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(InputMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InputMethods.prototype[name];
        }
    }
}
