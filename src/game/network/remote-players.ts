import { quaternionToMat4 } from '../../math.ts';
import { playerColorForIndex } from './protocol.js';
import type { EngineContext } from '../../types/engine-context.ts';
import type { FilamentHandle } from '../../types/filament.ts';
import type { FrameExtras } from '../../types/frame-host.ts';
import type { ReplayFrame } from '../systems/replay-codec.ts';
import type { RoomPlayer } from './protocol-types.ts';

/** What `RemotePlayers` reads on the game: Filament handles, particles, lighting budget, frame counter. */
export type RemotePlayersHost =
    & Partial<Pick<EngineContext, 'Filament' | 'engine' | 'scene' | 'material' | 'sphereVb' | 'sphereIb' | 'particleSystem' | 'lightingBudget'>>
    & Pick<FrameExtras, 'frameCount'>;

/** A remote player's render entity (Filament handles). */
interface RemotePlayer {
    entity: FilamentHandle;
    materialInstance: FilamentHandle;
    lightEntity: FilamentHandle | null;
    name: string;
    color: [number, number, number];
}

export class RemotePlayers {
    declare game: RemotePlayersHost;
    declare players: Map<string, RemotePlayer>;

    constructor(game: RemotePlayersHost) {
        this.game = game;
        this.players = new Map();
    }

    ensurePlayer(playerId: string, name: string, colorIndex: number): void {
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

        // No per-player point light: the former branch was gated on
        // `lightingBudget.canAddPointLight()`, which LightingBudgetManager never
        // had, so it could not run. `updatePlayer`/`removePlayer` still handle one.
        const lightEntity: FilamentHandle | null = null;

        this.players.set(playerId, {
            entity,
            materialInstance,
            lightEntity,
            name,
            color,
        });
    }

    updatePlayer(playerId: string, frame: Omit<ReplayFrame, 't'> | null): void {
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

        if (this.game.particleSystem && this.game.frameCount !== undefined && this.game.frameCount % 4 === 0) {
            this.game.particleSystem.emitParticles('trail', pos, 1, {
                lifetime: 0.3,
                size: 0.1,
                color: remote.color,
            });
        }
    }

    removePlayer(playerId: string): void {
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

    clear(): void {
        for (const playerId of [...this.players.keys()]) {
            this.removePlayer(playerId);
        }
    }

    syncRoster(roster: readonly RoomPlayer[], localPlayerId: string): void {
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
