export class InitGraphics {
    createLight() {
        const F = this.Filament

        // Primary sun light with shadows
        this.sunLight = F.EntityManager.get().create()
        const shadowsEnabled = this.settings?.graphics?.shadows !== false
        const builder = F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([1.0, 0.96, 0.88])
            .intensity(150000.0)
            .direction([0.4, -1.0, -0.65])

        if (shadowsEnabled) {
            builder.castShadows(true)
        } else {
            builder.castShadows(false)
        }

        builder.build(this.engine, this.sunLight)
        this.scene.addEntity(this.sunLight)

        // Blue-sky fill light from opposite direction
        this.fillLight = F.EntityManager.get().create()
        F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([0.65, 0.78, 1.0])
            .intensity(45000.0)
            .direction([-0.4, -0.2, 0.7])
            .castShadows(false)
            .build(this.engine, this.fillLight)
        this.scene.addEntity(this.fillLight)
    }

    enableShadowsOnEntity(entity) {
        if (!this.engine || !entity) return
        const rcm = this.engine.getRenderableManager()
        const inst = rcm.getInstance(entity)
        if (inst) {
            rcm.setCastShadows(inst, true)
            rcm.setReceiveShadows(inst, true)
        }
    }

    getMouseSensitivity() {
        if (!this.settings) return 0.002
        // Convert 10-200 range to 0.001-0.01
        return this.settings.controls.sensitivity * 0.00004
    }

    isYAxisInverted() {
        return this.settings?.controls?.invertY ?? false
    }

    getScreenShakeIntensity() {
        if (!this.settings) return 1.0
        return this.settings.accessibility.screenShake / 100
    }
}

export function applyInitGraphics(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitGraphics.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitGraphics.prototype[name];
        }
    }
}
