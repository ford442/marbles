import { quaternionToMat4 } from '../../math.js';
import { playerColorForIndex } from './protocol.js';

export class RemotePlayers {
    /**
     * @param {object} game
     */
    constructor(game) {
        this.game = game;
        /** @type {Map<string, { entity: number, materialInstance: object, lightEntity: number | null, name: string, color: [number, number, number] }>} */
        this.players = new Map();
    }

    /**
     * @param {string} playerId
     * @param {string} name
     * @param {number} colorIndex
     */
    ensurePlayer(playerId, name, colorIndex) {
        if (this.players.has(playerId)) return;
        if (!this.game.engine || !this.game.Filament || !this.game.scene) return;

        const color = playerColorForIndex(colorIndex);
        const entity = this.game.Filament.EntityManager.get().create();
        const materialInstance = this.game.material.createInstance();
        materialInstance.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, color);
        materialInstance.setFloatParameter('roughness', 0.25);
        materialInstance.setFloatParameter('metallic', 0.1);

        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, materialInstance)
            .geometry(0, this.game.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.game.sphereVb, this.game.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.game.engine, entity);

        this.game.scene.addEntity(entity);

        let lightEntity = null;
        if (this.game.lightingBudget?.canAddPointLight?.()) {
            lightEntity = this.game.Filament.EntityManager.get().create();
            this.game.Filament.LightManager.Builder(this.game.Filament.LightManager$Type.POINT)
                .color(color)
                .intensity(12000.0)
                .falloff(12.0)
                .build(this.game.engine, lightEntity);
            this.game.scene.addEntity(lightEntity);
            this.game.lightingBudget?.register?.(lightEntity);
        }

        this.players.set(playerId, {
            entity,
            materialInstance,
            lightEntity,
            name,
            color,
        });
    }

    /**
     * @param {string} playerId
     * @param {{ x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number }} frame
     */
    updatePlayer(playerId, frame) {
        const remote = this.players.get(playerId);
        if (!remote || !frame) return;

        const tcm = this.game.engine.getTransformManager();
        const pos = { x: frame.x, y: frame.y, z: frame.z };
        const rot = { x: frame.qx, y: frame.qy, z: frame.qz, w: frame.qw };
        const mat = quaternionToMat4(pos, rot);
        tcm.setTransform(tcm.getInstance(remote.entity), mat);

        if (remote.lightEntity) {
            const lightMat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 });
            tcm.setTransform(tcm.getInstance(remote.lightEntity), lightMat);
        }

        if (this.game.particleSystem && this.game.frameCount % 4 === 0) {
            this.game.particleSystem.emitParticles('trail', pos, 1, {
                lifetime: 0.3,
                size: 0.1,
                color: remote.color,
            });
        }
    }

    /**
     * @param {string} playerId
     */
    removePlayer(playerId) {
        const remote = this.players.get(playerId);
        if (!remote) return;

        this.game.scene.remove(remote.entity);
        if (remote.materialInstance) {
            this.game.engine.destroyMaterialInstance(remote.materialInstance);
        }
        this.game.engine.destroyEntity(remote.entity);
        this.game.Filament.EntityManager.get().destroy(remote.entity);

        if (remote.lightEntity) {
            this.game.lightingBudget?.unregister?.(remote.lightEntity);
            this.game.scene.remove(remote.lightEntity);
            this.game.engine.destroyEntity(remote.lightEntity);
            this.game.Filament.EntityManager.get().destroy(remote.lightEntity);
        }

        this.players.delete(playerId);
    }

    clear() {
        for (const playerId of [...this.players.keys()]) {
            this.removePlayer(playerId);
        }
    }

    /**
     * @param {{ id: string, name: string }[]} roster
     * @param {string} localPlayerId
     */
    syncRoster(roster, localPlayerId) {
        const remoteIds = roster
            .map((p, index) => ({ ...p, index }))
            .filter((p) => p.id !== localPlayerId);

        for (const { id, name, index } of remoteIds) {
            this.ensurePlayer(id, name, index);
        }

        for (const id of [...this.players.keys()]) {
            if (!remoteIds.some((p) => p.id === id)) {
                this.removePlayer(id);
            }
        }
    }
}

export default RemotePlayers;
