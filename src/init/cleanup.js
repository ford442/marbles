export class InitCleanup {
    clearLevel() {
        for (const m of this.marbles) {
            this.world.removeRigidBody(m.rigidBody)
            this.scene.remove(m.entity)
            if (m.matInstance) this.engine.destroyMaterialInstance(m.matInstance)
            this.engine.destroyEntity(m.entity)
        }
        if (this.activeMarbleLightEntity) {
            this.scene.remove(this.activeMarbleLightEntity)
            this.engine.destroyEntity(this.activeMarbleLightEntity)
            this.Filament.EntityManager.get().destroy(this.activeMarbleLightEntity)
            this.activeMarbleLightEntity = null
        }
        this.marbles = []
        this.playerMarble = null

        for (const body of this.staticBodies) {
            this.world.removeRigidBody(body)
        }
        this.staticBodies = []

        for (const entity of this.staticEntities) {
            this.scene.remove(entity)
            this.engine.destroyEntity(entity)
        }
        this.staticEntities = []
        
        // Clear animated lights from zone
        if (this.lightingSystem) {
            this.lightingSystem.clearAnimatedLights()
        }

        // Clear volumetric shaft and caustic sources
        if (this.volumetricLights) {
            this.volumetricLights.clearSources()
        }

        // Clear ambient zone particle emitters
        if (this.particleSystem) {
            this.particleSystem.clearAmbientEmitters()
        }

        for (const obj of this.dynamicObjects) {
            this.world.removeRigidBody(obj.rigidBody)
            this.scene.remove(obj.entity)
            this.engine.destroyEntity(obj.entity)
        }
        this.dynamicObjects = []

        for (const cp of this.checkpoints) {
            this.scene.remove(cp.entity)
            this.engine.destroyEntity(cp.entity)
        }
        this.checkpoints = []

        for (const c of this.collectibles) {
            this.scene.remove(c.entity)
            this.engine.destroyEntity(c.entity)
        }
        this.collectibles = []

        for (const p of this.powerUps) {
            this.world.removeRigidBody(p.rigidBody)
            this.scene.remove(p.entity)
            this.engine.destroyEntity(p.entity)
        }
        this.powerUps = []
        this.activeEffects = {}

        for (const platform of this.movingPlatforms) {
            this.world.removeRigidBody(platform.rigidBody)
            this.scene.remove(platform.entity)
            this.engine.destroyEntity(platform.entity)
        }
        this.movingPlatforms = []

        for (const platform of this.rotatingPlatforms) {
            this.world.removeRigidBody(platform.rigidBody)
            this.scene.remove(platform.entity)
            this.engine.destroyEntity(platform.entity)
        }
        this.rotatingPlatforms = []

        if (this.ghostEntity) {
            this.scene.remove(this.ghostEntity)
            if (this.ghostMaterialInstance) this.engine.destroyMaterialInstance(this.ghostMaterialInstance)
            this.engine.destroyEntity(this.ghostEntity)
            this.Filament.EntityManager.get().destroy(this.ghostEntity)
            this.ghostEntity = null
            this.ghostMaterialInstance = null
        }

        if (this.ghostLightEntity) {
            this.scene.remove(this.ghostLightEntity)
            this.engine.destroyEntity(this.ghostLightEntity)
            this.Filament.EntityManager.get().destroy(this.ghostLightEntity)
            this.ghostLightEntity = null
        }

        if (this.portalA) this.destroyPortal(this.portalA)
        if (this.portalB) this.destroyPortal(this.portalB)
        this.portalA = null
        this.portalB = null
        document.getElementById('portal-a-status').style.color = '#444'
        document.getElementById('portal-b-status').style.color = '#444'

        if (this.temporaryPlatforms) {
            for (const p of this.temporaryPlatforms) {
                this.world.removeRigidBody(p.rigidBody)
                this.scene.remove(p.entity)
                if (p.matInstance) this.engine.destroyMaterialInstance(p.matInstance)
                this.engine.destroyEntity(p.entity)
                this.Filament.EntityManager.get().destroy(p.entity)
            }
            this.temporaryPlatforms = []
        }

        if (this.visualParticles) {
            for (const p of this.visualParticles) {
                this.scene.remove(p.entity)
                if (p.matInstance) this.engine.destroyMaterialInstance(p.matInstance)
                this.engine.destroyEntity(p.entity)
                this.Filament.EntityManager.get().destroy(p.entity)
            }
            this.visualParticles = []
        }

        if (this.activeMissiles) {
            for (const m of this.activeMissiles) {
                this.world.removeRigidBody(m.rigidBody)
                this.scene.remove(m.entity)
                if (m.matInstance) this.engine.destroyMaterialInstance(m.matInstance)
                this.engine.destroyEntity(m.entity)
                this.Filament.EntityManager.get().destroy(m.entity)

                if (m.lightEntity) {
                    this.scene.remove(m.lightEntity)
                    this.engine.destroyEntity(m.lightEntity)
                    this.Filament.EntityManager.get().destroy(m.lightEntity)
                }
            }
            this.activeMissiles = []
        }

        if (this.activeBombs) {
            for (const b of this.activeBombs) {
                this.world.removeRigidBody(b.rigidBody)
                this.scene.remove(b.entity)
                if (b.matInstance) this.engine.destroyMaterialInstance(b.matInstance)
                this.engine.destroyEntity(b.entity)
                this.Filament.EntityManager.get().destroy(b.entity)

                if (b.lightEntity) {
                    this.scene.remove(b.lightEntity)
                    this.engine.destroyEntity(b.lightEntity)
                    this.Filament.EntityManager.get().destroy(b.lightEntity)
                }
            }
            this.activeBombs = []
        }

        if (this.activeBlackHoles) {
            for (const bh of this.activeBlackHoles) {
                this.world.removeRigidBody(bh.rigidBody)
                this.scene.remove(bh.entity)
                if (bh.matInstance) this.engine.destroyMaterialInstance(bh.matInstance)
                this.engine.destroyEntity(bh.entity)
                this.Filament.EntityManager.get().destroy(bh.entity)

                if (bh.lightEntity) {
                    this.scene.remove(bh.lightEntity)
                    this.engine.destroyEntity(bh.lightEntity)
                    this.Filament.EntityManager.get().destroy(bh.lightEntity)
                }
            }
            this.activeBlackHoles = []
        }

        this.adrenaline = 0
        if (this.nearMisses) this.nearMisses.clear()

        this.dynamicBodies = new Set()
        this.setNightMode(false)
    }
}

export function applyInitCleanup(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitCleanup.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitCleanup.prototype[name];
        }
    }
}
