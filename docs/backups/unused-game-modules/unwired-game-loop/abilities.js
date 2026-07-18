import { quaternionToMat4 } from '../math.js';

export class GameLoopAbilities {
    updateAbilities(now, frameDeltaSec) {
        if (this.activeBlackHoles && this.activeBlackHoles.length > 0) {
            for (let i = this.activeBlackHoles.length - 1; i >= 0; i--) {
                const bh = this.activeBlackHoles[i]
                const timeAlive = (now - bh.startTime) / 1000

                if (timeAlive > bh.duration) {
                    if (bh.rigidBody) {
                        this.world.removeRigidBody(bh.rigidBody)
                    }
                    if (bh.entity) {
                        this.scene.removeEntity(bh.entity)
                        this.Filament.EntityManager.get().destroy(bh.entity)
                    }
                    if (bh.lightEntity) {
                        this.scene.removeEntity(bh.lightEntity)
                        this.Filament.EntityManager.get().destroy(bh.lightEntity)
                    }
                    if (bh.matInstance) {
                        this.engine.destroyMaterialInstance(bh.matInstance)
                    }
                    this.activeBlackHoles.splice(i, 1)
                    continue
                }

                if (bh.rigidBody) {
                    const t = bh.rigidBody.translation()
                    const pullStrength = bh.pullStrength
                    const radius = bh.radius

                    for (const m of this.marbles) {
                        const mt = m.rigidBody.translation()
                        const dx = t.x - mt.x
                        const dy = t.y - mt.y
                        const dz = t.z - mt.z
                        const dist = Math.hypot(dx, dy, dz)

                        if (dist < radius && dist > 0.5) {
                            const force = pullStrength / (dist * dist)
                            m.rigidBody.applyImpulse({
                                x: (dx / dist) * force,
                                y: (dy / dist) * force,
                                z: (dz / dist) * force
                            }, true)
                        }
                    }

                    for (const body of this.dynamicBodies) {
                        if (body === bh.rigidBody) continue
                        const bt = body.translation()
                        const dx = t.x - bt.x
                        const dy = t.y - bt.y
                        const dz = t.z - bt.z
                        const dist = Math.hypot(dx, dy, dz)

                        if (dist < radius && dist > 0.5) {
                            const force = pullStrength / (dist * dist)
                            body.applyImpulse({
                                x: (dx / dist) * force,
                                y: (dy / dist) * force,
                                z: (dz / dist) * force
                            }, true)
                        }
                    }

                    if (bh.entity) {
                        const tcm = this.engine.getTransformManager()
                        const inst = tcm.getInstance(bh.entity)
                        const mat = quaternionToMat4(t, { x: 0, y: 0, z: 0, w: 1 })
                        tcm.setTransform(inst, mat)
                    }
                    if (bh.lightEntity) {
                        const tcm = this.engine.getTransformManager()
                        const lightInst = tcm.getInstance(bh.lightEntity)
                        const lightMat = quaternionToMat4(t, { x: 0, y: 0, z: 0, w: 1 })
                        tcm.setTransform(lightInst, lightMat)
                    }
                }
            }
        }

        for (let i = this.activeMissiles.length - 1; i >= 0; i--) {
            const m = this.activeMissiles[i]
            const timeAlive = (now - m.startTime) / 1000

            if (m.rigidBody) {
                const vel = m.rigidBody.linvel()
                const speed = Math.hypot(vel.x, vel.y, vel.z)
                let hitTarget = false

                if (speed > 0.1) {
                    const rayDir = { x: vel.x / speed, y: vel.y / speed, z: vel.z / speed }
                    const rayOrigin = m.rigidBody.translation()
                    const ray = new RAPIER.Ray(rayOrigin, rayDir)

                    const hit = this.world.castRay(ray, speed * frameDeltaSec * 2.0, true)

                    if (hit) {
                        const otherBody = hit.collider.parent()
                        if (!(otherBody && this.playerMarble && otherBody.handle === this.playerMarble.rigidBody.handle)) {
                            hitTarget = true
                            if (otherBody && otherBody.isDynamic()) {
                                const impactForce = 150.0
                                otherBody.applyImpulse({ x: rayDir.x * impactForce, y: rayDir.y * impactForce, z: rayDir.z * impactForce }, true)
                            }
                        }
                    }
                }

                if (hitTarget || timeAlive > m.duration) {
                    if (hitTarget) {
                        this.createExplosionEffect(m.rigidBody.translation(), 10.0, 500.0)
                    }
                    this.world.removeRigidBody(m.rigidBody)
                    if (m.entity) {
                        this.scene.removeEntity(m.entity)
                        this.Filament.EntityManager.get().destroy(m.entity)
                    }
                    if (m.lightEntity) {
                        this.scene.removeEntity(m.lightEntity)
                        this.Filament.EntityManager.get().destroy(m.lightEntity)
                    }
                    if (m.matInstance) {
                        this.engine.destroyMaterialInstance(m.matInstance)
                    }
                    this.activeMissiles.splice(i, 1)
                    continue
                }

                const t = m.rigidBody.translation()
                const q = m.rigidBody.rotation()
                const tcm = this.engine.getTransformManager()
                if (m.entity) {
                    const inst = tcm.getInstance(m.entity)
                    const mat = quaternionToMat4(t, q)
                    tcm.setTransform(inst, mat)
                }
                if (m.lightEntity) {
                    const lightInst = tcm.getInstance(m.lightEntity)
                    const lightMat = quaternionToMat4(t, { x: 0, y: 0, z: 0, w: 1 })
                    tcm.setTransform(lightInst, lightMat)
                }
            }
        }

        for (let i = this.activeBombs.length - 1; i >= 0; i--) {
            const b = this.activeBombs[i]
            const timeAlive = (now - b.startTime) / 1000

            if (timeAlive > b.duration) {
                if (b.rigidBody) {
                    this.createExplosionEffect(b.rigidBody.translation(), b.blastRadius, b.blastForce)
                    this.world.removeRigidBody(b.rigidBody)
                }
                if (b.entity) {
                    this.scene.removeEntity(b.entity)
                    this.Filament.EntityManager.get().destroy(b.entity)
                }
                if (b.lightEntity) {
                    this.scene.removeEntity(b.lightEntity)
                    this.Filament.EntityManager.get().destroy(b.lightEntity)
                }
                if (b.matInstance) {
                    this.engine.destroyMaterialInstance(b.matInstance)
                }
                this.activeBombs.splice(i, 1)
                continue
            }

            if (b.rigidBody) {
                const t = b.rigidBody.translation()
                const q = b.rigidBody.rotation()
                const tcm = this.engine.getTransformManager()

                if (b.matInstance) {
                    const pulse = Math.sin(timeAlive * 10) * 0.5 + 0.5
                    b.matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, [1.0, pulse, 0.0])
                }

                if (b.entity) {
                    const inst = tcm.getInstance(b.entity)
                    const mat = quaternionToMat4(t, q)
                    tcm.setTransform(inst, mat)
                }
                if (b.lightEntity) {
                    const lightInst = tcm.getInstance(b.lightEntity)
                    const lightMat = quaternionToMat4(t, { x: 0, y: 0, z: 0, w: 1 })
                    tcm.setTransform(lightInst, lightMat)
                }
            }
        }
    }
}

export function applyGameLoopAbilities(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopAbilities.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopAbilities.prototype[name];
        }
    }
}
