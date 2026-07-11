import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export class ZoneSetupGrapple {
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

    startGrapple() {
        if (!this.playerMarble || !this.world) return

        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()

        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)
        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
        const rayDir = { x: dirX, y: dirY, z: dirZ }
        const ray = new RAPIER.Ray(rayOrigin, rayDir)

        const hit = this.world.castRay(ray, this.grappleMaxDist, true)
        if (hit) {
            this.grappleTarget = {
                x: rayOrigin.x + rayDir.x * hit.toi,
                y: rayOrigin.y + rayDir.y * hit.toi,
                z: rayOrigin.z + rayDir.z * hit.toi
            }
            this.grappleRestLength = hit.toi * 0.8 // slightly pull them in initially
            this.isGrappling = true
            console.log("[GAME] Grapple attached at", this.grappleTarget)
            if (audio && audio.playCollect) audio.playCollect()
        }
    }

    stopGrapple() {
        // Slingshot Boost logic before releasing the grapple
        if (this.isGrappling && this.playerMarble && this.grappleTarget) {
            const rb = this.playerMarble.rigidBody
            const vel = rb.linvel()
            const speed = Math.hypot(vel.x, vel.y, vel.z)

            if (speed > 15.0) {
                // Apply forward and upward physics impulse
                const boostForce = 15.0
                const dirX = vel.x / speed
                const dirY = Math.max(0.2, vel.y / speed) + 0.5 // Add some vertical kick
                const dirZ = vel.z / speed

                rb.applyImpulse({
                    x: dirX * boostForce,
                    y: dirY * boostForce,
                    z: dirZ * boostForce
                }, true)

                // Call awardTrickPoints if available
                if (typeof this.awardTrickPoints === 'function') {
                    this.awardTrickPoints('Slingshot Boost!', 150, '#ff00ff')
                }
            }
        }

        this.isGrappling = false
        this.grappleTarget = null
        this.isGrappleZipping = false

        if (this.grappleInst) {
            const tcm = this.engine.getTransformManager()
            const zeroMat = new Float32Array(16)
            zeroMat[15] = 1
            tcm.setTransform(this.grappleInst, zeroMat)
        }
    }

    updateGrapple() {
        if (!this.isGrappling || !this.playerMarble || !this.grappleTarget) {
            if (this.isGrappling) this.stopGrapple()
            return
        }

        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()
        const target = this.grappleTarget

        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const dz = target.z - pos.z
        const dist = Math.hypot(dx, dy, dz)

        const dirX = dx / dist
        const dirY = dy / dist
        const dirZ = dz / dist

        // Apply Spring/Pendulum force instead of constant pull
        const restLength = this.grappleRestLength || 10.0

        if (this.isGrappleZipping) {
            // Powerfully pull marble towards target and quickly reel in
            const zipForce = 150.0
            rb.applyImpulse({
                x: dirX * zipForce * 0.016,
                y: dirY * zipForce * 0.016,
                z: dirZ * zipForce * 0.016
            }, true)
            this.grappleRestLength = Math.max(1.0, this.grappleRestLength - 0.5)
        } else {
            if (dist > restLength) {
                const stiffness = 15.0
                const damping = 2.0

                const springForce = (dist - restLength) * stiffness

                const vel = rb.linvel()
                const velAlongString = vel.x * dirX + vel.y * dirY + vel.z * dirZ
                const dampingForce = -velAlongString * damping

                const totalForce = springForce + dampingForce

                if (totalForce > 0) {
                    rb.applyImpulse({
                        x: dirX * totalForce * 0.016, // scale by rough dt
                        y: dirY * totalForce * 0.016,
                        z: dirZ * totalForce * 0.016
                    }, true)
                }
            }

            // Counter-gravity when swinging
            if (dirY > 0 && dist > restLength) {
                rb.applyImpulse({ x: 0, y: 0.5, z: 0 }, true)
            }
        }

        // Visuals
        if (this.grappleInst) {
            if (this.grappleMatInstance) {
                if (this.isGrappleZipping) {
                    this.grappleMatInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, [1.0, 0.0, 0.0])
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

export function applyZoneSetupGrapple(targetClass) {
    for (const name of Object.getOwnPropertyNames(ZoneSetupGrapple.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = ZoneSetupGrapple.prototype[name];
        }
    }
}
