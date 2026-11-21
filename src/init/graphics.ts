import type { EngineContext } from '../types/engine-context.ts';
import type { FilamentHandle } from '../types/filament.ts';
import type { SettingsContext } from '../types/settings.ts';

/** What `InitGraphics` uses on the game. */
export type InitGraphicsHost =
    & Pick<EngineContext, 'Filament' | 'engine' | 'scene' | 'sunLight' | 'fillLight' | 'backLight' | 'lightsInitialized'>
    & Pick<SettingsContext, 'settings'>;

export class InitGraphics {
    declare game: InitGraphicsHost;

    constructor(game: InitGraphicsHost) {
        this.game = game;
    }

    createLight(): void {
        const F = this.game.Filament;
        const em = F.EntityManager.get();

        if (!this.game.sunLight) this.game.sunLight = em.create();
        if (!this.game.fillLight) this.game.fillLight = em.create();
        if (!this.game.backLight) this.game.backLight = em.create();

        // Primary sun light with shadows
        const shadowsEnabled = this.game.settings?.graphics?.shadows !== false;
        const builder = F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([1.0, 0.96, 0.88])
            .intensity(80000.0)
            .direction([0.3, -1.0, 0.2]);

        if (shadowsEnabled) {
            builder.castShadows(true);
        } else {
            builder.castShadows(false);
        }

        builder.build(this.game.engine, this.game.sunLight);
        this.game.scene.addEntity(this.game.sunLight);

        // Fill light (soft ambient fill)
        F.LightManager.Builder(F['LightManager$Type'].POINT)
            .color([0.65, 0.78, 1.0])
            .position([0, 8, -12])
            .intensity(1200.0)
            .falloff(25.0)
            .castShadows(false)
            .build(this.game.engine, this.game.fillLight);
        this.game.scene.addEntity(this.game.fillLight);

        // Back / rim light
        F.LightManager.Builder(F['LightManager$Type'].POINT)
            .color([1.0, 0.95, 0.9])
            .position([-15, 5, 8])
            .intensity(600.0)
            .falloff(30.0)
            .castShadows(false)
            .build(this.game.engine, this.game.backLight);
        this.game.scene.addEntity(this.game.backLight);

        this.game.lightsInitialized = true;
    }

    enableShadowsOnEntity(entity: FilamentHandle): void {
        if (!this.game.engine || !entity) return
        const rcm = this.game.engine.getRenderableManager()
        const inst = rcm.getInstance(entity)
        if (inst) {
            rcm.setCastShadows(inst, true)
            rcm.setReceiveShadows(inst, true)
        }
    }

    getMouseSensitivity(): number {
        if (!this.game.settings) return 0.002
        // Convert 10-200 range to 0.001-0.01
        return this.game.settings.controls.sensitivity * 0.00004
    }

    isYAxisInverted(): boolean {
        return this.game.settings?.controls?.invertY ?? false
    }

    getScreenShakeIntensity(): number {
        if (!this.game.settings) return 1.0
        return this.game.settings.accessibility.screenShake / 100
    }
}
