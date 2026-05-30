export class InitGraphics {
    createLight() {
        const F = this.Filament;
        const em = F.EntityManager.get();

        if (!this.sunLight) this.sunLight = em.create();
        if (!this.fillLight) this.fillLight = em.create();
        if (!this.backLight) this.backLight = em.create();

        // Primary sun light with shadows
        const shadowsEnabled = this.settings?.graphics?.shadows !== false;
        const builder = F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([1.0, 0.96, 0.88])
            .intensity(80000.0)
            .direction([0.3, -1.0, 0.2]);

        if (shadowsEnabled) {
            builder.castShadows(true);
        } else {
            builder.castShadows(false);
        }

        builder.build(this.engine, this.sunLight);
        this.scene.addEntity(this.sunLight);

        // Fill light (soft ambient fill)
        F.LightManager.Builder(F['LightManager$Type'].POINT)
            .color([0.65, 0.78, 1.0])
            .position([0, 8, -12])
            .intensity(1200.0)
            .falloff(25.0)
            .build(this.engine, this.fillLight);
        this.scene.addEntity(this.fillLight);

        // Back / rim light
        F.LightManager.Builder(F['LightManager$Type'].POINT)
            .color([1.0, 0.95, 0.9])
            .position([-15, 5, 8])
            .intensity(600.0)
            .falloff(30.0)
            .build(this.engine, this.backLight);
        this.scene.addEntity(this.backLight);

        this.lightsInitialized = true;
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
