export class InitCleanup {
    clearLevel() {
        for (const m of this.marbles) {
            this.world.removeRigidBody(m.rigidBody)
            this.scene.remove(m.entity)
            if (m.matInstance) this.engine.destroyMaterialInstance(m.matInstance)
            this.engine.destroyEntity(m.entity)
        }
        if (this.activeMarbleLightEntity) {
            this.lightingBudget?.unregister(this.activeMarbleLightEntity)
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
        if (this.staticBatchResources) {
            for (const batch of this.staticBatchResources) {
                if (batch.matInstance) this.engine.destroyMaterialInstance(batch.matInstance)
            }
            this.staticBatchResources = []
        }
        if (this._staticBoxBatchGroups) this._staticBoxBatchGroups.clear()
        if (this._decorativeBatchGroups) this._decorativeBatchGroups.clear()
        this.staticBatchStats = { groups: 0, boxes: 0, collapsedEntities: 0 }
        this.cullingManager?.reset()
        this.marbleLodManager?.reset()
        this.effectPool?.reset()
        this.levelEffectBudget?.reset()
        this.lightingBudget?.reset()
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

        this.effectPool?.drainAllActiveVisuals()

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
