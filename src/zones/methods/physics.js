import { audio } from '../../audio.js';

/**
 * Physics-related methods
 * These methods handle physics body creation and management
 */

export const physicsMethods = {
    createKinematicBox(pos, halfExtents, color, type, center, amplitude) {
        const budget = this.levelEffectBudget
        if (budget && !budget.canAllocate('kinematicMovers')) {
            return
        }
        if (budget) budget.allocate('kinematicMovers')

        const body = this.physicsWorld._createSimBody(
            'kinematic',
            pos,
            { x: 0, y: 0, z: 0, w: 1 },
            { type: 'cuboid', halfExtents, friction: 1.0 },
        );

        audio.registerBodyMaterial(body, 'metal');

        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.3);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity);

        this.scene.addEntity(entity);

        this.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: halfExtents,
            type: type,
            center: center,
            amplitude: amplitude,
            initialPos: { ...pos },
            speed: 1.5 + Math.random()
        });
    },

    createPowerUp(pos, type) {
        const body = this.physicsWorld._createSimBody(
            'fixed',
            pos,
            { x: 0, y: 0, z: 0, w: 1 },
            { type: 'sensor_ball', radius: 0.5 },
        );

        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();

        let color = [1, 1, 1];
        if (type === 'speed') color = [0, 1, 1];
        if (type === 'jump') color = [0, 1, 0];
        if (type === 'gravity') color = [1, 1, 0];

        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.2);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.4, 0.4, 0.4] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity);

        this.scene.addEntity(entity);

        this.powerUps.push({
            rigidBody: body,
            entity: entity,
            type: type,
            baseY: pos.y,
            rotation: 0,
            pos: pos
        });
    }
};
