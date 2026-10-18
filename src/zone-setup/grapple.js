// @ts-check
import { audio } from '../audio.js';
import { getMarblePhysics } from '../wasm-bridge.js';
import { applyAcceleration, applyVelocityChange } from '../game/systems/body-impulse.ts';

/** @typedef {import('../types/mixin-host.ts').GameMixinHost} GameMixinHost */

const _springForceScratch = new Float32Array(3);

/** Upward acceleration (m/s²) while swinging below the anchor: partial gravity relief. */
const SWING_LIFT_ACCEL = 0.3 * 9.81;
/** Velocity change (m/s) of the slingshot release boost. */
const SLINGSHOT_DV = 15.0;
/** Rest-length reel-in rate while zipping (m/s of simulated time). */
const ZIP_REEL_SPEED = 30.0;

export class ZoneSetupGrapple {
    /** @this {GameMixinHost} */
    createGrappleLine() {
        this.grappleEntity = this.Filament.EntityManager.get().create()
        const grappleColor = [0.0, 1.0, 1.0]
        const matInstance = this.material.createInstance()
        this.grappleMatInstance = matInstance
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, grappleColor)
        matInstance.setFloatParameter('roughness', 0.2)
        if (this.hasProceduralMaterial) {
            matInstance.setFloatParameter('metallic', 0.8)
            matInstance.setFloatParameter('reflectance', 1.0)
            matInstance.setFloatParameter('bumpScale', 0.0)
            matInstance.setFloatParameter('bumpFrequency', 0.0)
        }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, this.grappleEntity)

        this.scene.addEntity(this.grappleEntity)

        const tcm = this.engine.getTransformManager()
        this.grappleInst = tcm.getInstance(this.grappleEntity)

        // Hide initially
        const zeroMat = new Float32Array(16)
        zeroMat[15] = 1
        tcm.setTransform(this.grappleInst, zeroMat)
    }

    /** @this {GameMixinHost} */
    createCueStick() {
        this.cueEntity = this.Filament.EntityManager.get().create()
        const cueColor = [1.0, 1.0, 0.0]
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, cueColor)
        matInstance.setFloatParameter('roughness', 0.2)
        if (this.hasProceduralMaterial) {
            matInstance.setFloatParameter('metallic', 0.0)
            matInstance.setFloatParameter('reflectance', 0.6)
            matInstance.setFloatParameter('bumpScale', 0.005)
            matInstance.setFloatParameter('bumpFrequency', 15.0)
        }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, this.cueEntity)

        this.scene.addEntity(this.cueEntity)

        const tcm = this.engine.getTransformManager()
        this.cueInst = tcm.getInstance(this.cueEntity)

        const zeroMat = new Float32Array(16)
        zeroMat[15] = 1
        tcm.setTransform(this.cueInst, zeroMat)
    }

    /** @this {GameMixinHost} */
    startGrapple() {
        if (!this.playerMarble || !this.physicsQueries) return

        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()

        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)
        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const rayDir = { x: dirX, y: dirY, z: dirZ }
        const hit = this.physicsQueries.castRay(pos, rayDir, this.grappleMaxDist, { excludeBody: rb })
        if (hit) {
            this.grappleTarget = { ...hit.point }

            // Dynamic bodies get yanked toward the player; anything else is an anchor.
            this.grappleTargetBody = hit.bodyType === 'dynamic' ? hit.body : null

            this.grappleRestLength = hit.toi * 0.8 // slightly pull them in initially
            this.isGrappling = true
            console.log("[GAME] Grapple attached at", this.grappleTarget)
            if (audio && audio.playCollect) audio.playCollect()
        }
    }

    /** @this {GameMixinHost} */
    stopGrapple() {
        // Slingshot Boost logic before releasing the grapple
        if (this.isGrappling && this.playerMarble && this.grappleTarget) {
            const rb = this.playerMarble.rigidBody
            const vel = rb.linvel()
            const speed = Math.hypot(vel.x, vel.y, vel.z)

            if (speed > 15.0) {
                // Forward and upward velocity kick
                const dirX = vel.x / speed
                const dirY = Math.max(0.2, vel.y / speed) + 0.5 // Add some vertical kick
                const dirZ = vel.z / speed

                applyVelocityChange(rb, {
                    x: dirX * SLINGSHOT_DV,
                    y: dirY * SLINGSHOT_DV,
                    z: dirZ * SLINGSHOT_DV
                })

                // Call awardTrickPoints if available
                if (typeof this.awardTrickPoints === 'function') {
                    this.awardTrickPoints('Slingshot Boost!', 150, '#ff00ff')
                }
            }
        }

        this.cancelGrapple()
    }

    /**
     * Drop the grapple with no release boost (respawn, level change, target
     * removed) and hide the line.
     * @this {GameMixinHost}
     */
    cancelGrapple() {
        this.isGrappling = false
        this.grappleTarget = null
        this.grappleTargetBody = null
        this.isGrappleZipping = false

        if (this.grappleInst) {
            const tcm = this.engine.getTransformManager()
            const zeroMat = new Float32Array(16)
            zeroMat[15] = 1
            tcm.setTransform(this.grappleInst, zeroMat)
        }
    }

    /** @this {GameMixinHost} */
    updateGrapple() {
        if (!this.isGrappling || !this.playerMarble || !this.grappleTarget) {
            if (this.isGrappling) this.cancelGrapple()
            return
        }

        // The yanked body can be removed mid-grapple (missile hit, cleanup).
        if (this.grappleTargetBody && !this.physicsQueries.isBodyAlive(this.grappleTargetBody)) {
            this.cancelGrapple()
            return
        }

        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()
        const simDt = this.simDt ?? 1 / 60

        if (this.grappleTargetBody) {
            const bodyPos = this.grappleTargetBody.translation()
            this.grappleTarget = { x: bodyPos.x, y: bodyPos.y, z: bodyPos.z }
        }
        const target = this.grappleTarget

        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const dz = target.z - pos.z
        const dist = Math.hypot(dx, dy, dz)
        if (!(dist > 1e-6)) return

        const dirX = dx / dist
        const dirY = dy / dist
        const dirZ = dz / dist

        // Apply Spring/Pendulum force instead of constant pull
        const restLength = this.grappleRestLength || 10.0

        if (this.isGrappleZipping) {
            // Quickly reel in by shrinking the rest length
            this.grappleRestLength = Math.max(1.0, this.grappleRestLength - ZIP_REEL_SPEED * simDt)
        }

        if (dist > restLength) {
            // Stiffness/damping are per unit mass, so the spring output is an
            // acceleration and every marble swings the same way.
            const stiffness = this.isGrappleZipping ? 50.0 : 15.0
            const damping = this.isGrappleZipping ? 5.0 : 2.0
            const vel = rb.linvel()
            const physics = getMarblePhysics()
            physics.computeSpringForceInto(
                _springForceScratch,
                pos.x, pos.y, pos.z,
                target.x, target.y, target.z,
                restLength, stiffness, damping,
                vel.x, vel.y, vel.z
            )
            const ax = _springForceScratch[0] ?? 0
            const ay = _springForceScratch[1] ?? 0
            const az = _springForceScratch[2] ?? 0

            if (ax * dirX + ay * dirY + az * dirZ > 0) {
                applyAcceleration(rb, { x: ax, y: ay, z: az }, simDt)

                // Yank: the target accelerates toward the player just as hard.
                if (this.grappleTargetBody) {
                    applyAcceleration(this.grappleTargetBody, { x: -ax, y: -ay, z: -az }, simDt)
                }
            }
        }

        // Counter-gravity when swinging
        if (dirY > 0 && dist > restLength) {
            applyAcceleration(rb, { x: 0, y: SWING_LIFT_ACCEL, z: 0 }, simDt)
        }

        // Visuals
        if (this.grappleInst) {
            if (this.grappleMatInstance) {
                if (this.isGrappleZipping) {
                    this.grappleMatInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, [1.0, 0.5, 0.0])
                } else {
                    this.grappleMatInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, [0.0, 1.0, 1.0])
                }
            }

            let ux = 0, uy = 1, uz = 0
            if (Math.abs(dirY) > 0.99) {
                ux = 1; uy = 0; uz = 0
            }

            let rx = uy * dirZ - uz * dirY
            let ry = uz * dirX - ux * dirZ
            let rz = ux * dirY - uy * dirX
            const rLen = Math.hypot(rx, ry, rz)
            rx /= rLen; ry /= rLen; rz /= rLen

            const newUx = dirY * rz - dirZ * ry
            const newUy = dirZ * rx - dirX * rz
            const newUz = dirX * ry - dirY * rx

            const thick = 0.05

            const midX = (pos.x + target.x) / 2
            const midY = (pos.y + target.y) / 2
            const midZ = (pos.z + target.z) / 2

            const mat = new Float32Array([
                rx * thick, ry * thick, rz * thick, 0,
                newUx * thick, newUy * thick, newUz * thick, 0,
                dx, dy, dz, 0,
                midX, midY, midZ, 1
            ])

            const tcm = this.engine.getTransformManager()
            tcm.setTransform(this.grappleInst, mat)
        }
    }

    /** @this {GameMixinHost} */
    shootMarble() {
        if (!this.playerMarble) return

        const force = 50.0 + this.chargePower * 150.0
        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)

        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        this.playerMarble.rigidBody.applyImpulse({
            x: dirX * force,
            y: dirY * force,
            z: dirZ * force
        }, true)

        this.chargePower = 0
        this.powerbarEl.style.width = '0%'
    }

}
