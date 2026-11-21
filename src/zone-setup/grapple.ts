import { audio } from '../audio.js';
import { getMarblePhysics } from '../wasm-bridge.js';
import { applyAcceleration, applyVelocityChange } from '../game/systems/body-impulse.ts';
import type { GameLogicTricks } from '../game-logic/tricks.ts';
import type { InputSystemHost } from '../game/systems/input-system.ts';
import type { RigidBodyLike } from '../game/systems/physics-queries.ts';
import type { EngineContext } from '../types/engine-context.ts';
import type { FilamentHandle } from '../types/filament.ts';
import type { FrameExtras, FrameState } from '../types/frame-host.ts';
import type { GrappleTargetBody } from '../types/game-state.ts';

/** What the grapple / cue-stick slice uses on the game. */
export type ZoneSetupGrappleHost =
    & Pick<EngineContext, 'Filament' | 'engine' | 'scene' | 'material' | 'vb' | 'ib' | 'hasProceduralMaterial'>
    & Pick<FrameState,
        | 'playerMarble' | 'aimYaw' | 'pitchAngle' | 'chargePower' | 'powerbarEl'
        | 'isGrappling' | 'isGrappleZipping' | 'grappleMaxDist' | 'grappleTarget' | 'grappleTargetBody'
        | 'grappleEntity' | 'grappleInst' | 'cueInst'>
    & Pick<InputSystemHost, 'physicsQueries' | 'grappleRestLength'>
    & Pick<FrameExtras, 'simDt'>
    & {
        /** Grapple line material, recoloured while zipping. */
        grappleMatInstance?: FilamentHandle;
        cueEntity?: FilamentHandle;
        awardTrickPoints?: GameLogicTricks['awardTrickPoints'];
    };

/** Ray-hit bodies are `RigidBodyLike`; the yank needs the full body surface. */
function isGrappleTargetBody(body: RigidBodyLike | null): body is GrappleTargetBody {
    const b = body as Partial<GrappleTargetBody> | null;
    return !!b && typeof b.translation === 'function' && typeof b.mass === 'function'
        && typeof b.applyImpulse === 'function';
}

const _springForceScratch = new Float32Array(3);

/** Upward acceleration (m/s²) while swinging below the anchor: partial gravity relief. */
const SWING_LIFT_ACCEL = 0.3 * 9.81;
/** Velocity change (m/s) of the slingshot release boost. */
const SLINGSHOT_DV = 15.0;
/** Rest-length reel-in rate while zipping (m/s of simulated time). */
const ZIP_REEL_SPEED = 30.0;

export class ZoneSetupGrapple {
    declare game: ZoneSetupGrappleHost;

    constructor(game: ZoneSetupGrappleHost) {
        this.game = game;
    }

    createGrappleLine(): void {
        this.game.grappleEntity = this.game.Filament.EntityManager.get().create()
        const grappleColor = [0.0, 1.0, 1.0]
        const matInstance = this.game.material.createInstance()
        this.game.grappleMatInstance = matInstance
        matInstance.setColor3Parameter('baseColor', this.game.Filament['RgbType'].sRGB, grappleColor)
        matInstance.setFloatParameter('roughness', 0.2)
        if (this.game.hasProceduralMaterial) {
            matInstance.setFloatParameter('metallic', 0.8)
            matInstance.setFloatParameter('reflectance', 1.0)
            matInstance.setFloatParameter('bumpScale', 0.0)
            matInstance.setFloatParameter('bumpFrequency', 0.0)
        }

        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.game.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.game.vb, this.game.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.game.engine, this.game.grappleEntity)

        this.game.scene.addEntity(this.game.grappleEntity)

        const tcm = this.game.engine.getTransformManager()
        this.game.grappleInst = tcm.getInstance(this.game.grappleEntity)

        // Hide initially
        const zeroMat = new Float32Array(16)
        zeroMat[15] = 1
        tcm.setTransform(this.game.grappleInst, zeroMat)
    }

    createCueStick(): void {
        this.game.cueEntity = this.game.Filament.EntityManager.get().create()
        const cueColor = [1.0, 1.0, 0.0]
        const matInstance = this.game.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.game.Filament['RgbType'].sRGB, cueColor)
        matInstance.setFloatParameter('roughness', 0.2)
        if (this.game.hasProceduralMaterial) {
            matInstance.setFloatParameter('metallic', 0.0)
            matInstance.setFloatParameter('reflectance', 0.6)
            matInstance.setFloatParameter('bumpScale', 0.005)
            matInstance.setFloatParameter('bumpFrequency', 15.0)
        }

        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.game.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.game.vb, this.game.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.game.engine, this.game.cueEntity)

        this.game.scene.addEntity(this.game.cueEntity)

        const tcm = this.game.engine.getTransformManager()
        this.game.cueInst = tcm.getInstance(this.game.cueEntity)

        const zeroMat = new Float32Array(16)
        zeroMat[15] = 1
        tcm.setTransform(this.game.cueInst, zeroMat)
    }

    startGrapple(): void {
        if (!this.game.playerMarble || !this.game.physicsQueries) return

        const rb = this.game.playerMarble.rigidBody
        const pos = rb.translation()

        const cosP = Math.cos(this.game.pitchAngle)
        const sinP = Math.sin(this.game.pitchAngle)
        const dirX = Math.sin(this.game.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.game.aimYaw) * cosP

        const rayDir = { x: dirX, y: dirY, z: dirZ }
        const hit = this.game.physicsQueries.castRay(pos, rayDir, this.game.grappleMaxDist, { excludeBody: rb })
        if (hit) {
            this.game.grappleTarget = { ...hit.point }

            // Dynamic bodies get yanked toward the player; anything else is an anchor.
            this.game.grappleTargetBody = hit.bodyType === 'dynamic' && isGrappleTargetBody(hit.body) ? hit.body : null

            this.game.grappleRestLength = hit.toi * 0.8 // slightly pull them in initially
            this.game.isGrappling = true
            console.log("[GAME] Grapple attached at", this.game.grappleTarget)
            if (audio && audio.playCollect) audio.playCollect()
        }
    }

    stopGrapple(): void {
        // Slingshot Boost logic before releasing the grapple
        if (this.game.isGrappling && this.game.playerMarble && this.game.grappleTarget) {
            const rb = this.game.playerMarble.rigidBody
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
                if (typeof this.game.awardTrickPoints === 'function') {
                    this.game.awardTrickPoints('Slingshot Boost!', 150, '#ff00ff')
                }
            }
        }

        this.cancelGrapple()
    }

    /**
     * Drop the grapple with no release boost (respawn, level change, target
     * removed) and hide the line.
     */
    cancelGrapple(): void {
        this.game.isGrappling = false
        this.game.grappleTarget = null
        this.game.grappleTargetBody = null
        this.game.isGrappleZipping = false

        if (this.game.grappleInst) {
            const tcm = this.game.engine.getTransformManager()
            const zeroMat = new Float32Array(16)
            zeroMat[15] = 1
            tcm.setTransform(this.game.grappleInst, zeroMat)
        }
    }

    updateGrapple(): void {
        if (!this.game.isGrappling || !this.game.playerMarble || !this.game.grappleTarget) {
            if (this.game.isGrappling) this.cancelGrapple()
            return
        }

        // The yanked body can be removed mid-grapple (missile hit, cleanup).
        if (this.game.grappleTargetBody && !this.game.physicsQueries.isBodyAlive(this.game.grappleTargetBody)) {
            this.cancelGrapple()
            return
        }

        const rb = this.game.playerMarble.rigidBody
        const pos = rb.translation()
        const simDt = this.game.simDt ?? 1 / 60

        if (this.game.grappleTargetBody) {
            const bodyPos = this.game.grappleTargetBody.translation()
            this.game.grappleTarget = { x: bodyPos.x, y: bodyPos.y, z: bodyPos.z }
        }
        const target = this.game.grappleTarget

        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const dz = target.z - pos.z
        const dist = Math.hypot(dx, dy, dz)
        if (!(dist > 1e-6)) return

        const dirX = dx / dist
        const dirY = dy / dist
        const dirZ = dz / dist

        // Apply Spring/Pendulum force instead of constant pull
        const restLength = this.game.grappleRestLength || 10.0

        if (this.game.isGrappleZipping) {
            // Quickly reel in by shrinking the rest length
            this.game.grappleRestLength = Math.max(1.0, (this.game.grappleRestLength ?? restLength) - ZIP_REEL_SPEED * simDt)
        }

        if (dist > restLength) {
            // Stiffness/damping are per unit mass, so the spring output is an
            // acceleration and every marble swings the same way.
            const stiffness = this.game.isGrappleZipping ? 50.0 : 15.0
            const damping = this.game.isGrappleZipping ? 5.0 : 2.0
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
                if (this.game.grappleTargetBody) {
                    applyAcceleration(this.game.grappleTargetBody, { x: -ax, y: -ay, z: -az }, simDt)
                }
            }
        }

        // Counter-gravity when swinging
        if (dirY > 0 && dist > restLength) {
            applyAcceleration(rb, { x: 0, y: SWING_LIFT_ACCEL, z: 0 }, simDt)
        }

        // Visuals
        if (this.game.grappleInst) {
            if (this.game.grappleMatInstance) {
                if (this.game.isGrappleZipping) {
                    this.game.grappleMatInstance.setColor3Parameter('baseColor', this.game.Filament['RgbType'].sRGB, [1.0, 0.5, 0.0])
                } else {
                    this.game.grappleMatInstance.setColor3Parameter('baseColor', this.game.Filament['RgbType'].sRGB, [0.0, 1.0, 1.0])
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

            const tcm = this.game.engine.getTransformManager()
            tcm.setTransform(this.game.grappleInst, mat)
        }
    }

    shootMarble(): void {
        if (!this.game.playerMarble) return

        const force = 50.0 + this.game.chargePower * 150.0
        const cosP = Math.cos(this.game.pitchAngle)
        const sinP = Math.sin(this.game.pitchAngle)

        const dirX = Math.sin(this.game.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.game.aimYaw) * cosP

        this.game.playerMarble.rigidBody.applyImpulse({
            x: dirX * force,
            y: dirY * force,
            z: dirZ * force
        }, true)

        this.game.chargePower = 0
        if (this.game.powerbarEl) this.game.powerbarEl.style.width = '0%'
    }

}
