import RAPIER from '@dimforge/rapier3d-compat';
import { quaternionToMat4 } from '../math.ts';

const MARBLE_RADIUS = 0.5;
const MARBLE_RESTITUTION = 0.5;
const MARBLE_FRICTION = 0.5;
const MARBLE_COLOR = [1.0, 0.45, 0.1];

/**
 * Live physics test marble for the map editor.
 * Reuses the editor's real Rapier world (the same one populated by
 * MapEditor.rebuildPreview() via game.createZone) and the real Filament
 * scene, so the marble rolls against the actual placed geometry/colliders
 * without spinning up a second physics world or render surface.
 */
export class EditorPhysicsPreview {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
        this.rigidBody = null;
        this.entity = null;
        this.matInstance = null;
    }

    get active() {
        return this.rigidBody !== null;
    }

    /**
     * (Re)spawn the test marble at the given position, replacing any
     * marble already in flight.
     * @param {{ x: number, y: number, z: number }} pos
     */
    spawn(pos) {
        const game = this.game;
        if (!game.world || !game.engine || !game.Filament) return;

        this.remove();

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y, pos.z)
            .setCanSleep(false);
        this.rigidBody = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.ball(MARBLE_RADIUS)
            .setRestitution(MARBLE_RESTITUTION)
            .setFriction(MARBLE_FRICTION)
            .setDensity(1.0);
        game.world.createCollider(colliderDesc, this.rigidBody);

        this.entity = game.Filament.EntityManager.get().create();
        this.matInstance = game.material.createInstance();
        this.matInstance.setColor3Parameter('baseColor', game.Filament.RgbType.sRGB, MARBLE_COLOR);
        this.matInstance.setFloatParameter('roughness', 0.25);

        game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [MARBLE_RADIUS, MARBLE_RADIUS, MARBLE_RADIUS] })
            .material(0, this.matInstance)
            .geometry(0, game.Filament.RenderableManager$PrimitiveType.TRIANGLES, game.sphereVb, game.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(game.engine, this.entity);

        game.scene.addEntity(this.entity);
        this._syncTransform();
    }

    /** Remove the test marble (body + render entity) if one exists. */
    remove() {
        const game = this.game;
        if (this.rigidBody) {
            game.world?.removeRigidBody(this.rigidBody);
            this.rigidBody = null;
        }
        if (this.entity) {
            game.scene?.remove(this.entity);
            if (this.matInstance) game.engine?.destroyMaterialInstance(this.matInstance);
            game.engine?.destroyEntity(this.entity);
            this.entity = null;
            this.matInstance = null;
        }
    }

    /** Step physics (if a marble is active) and sync its render transform. */
    tick() {
        if (!this.active) return;
        if (this.game.physicsWorld) {
            this.game.physicsWorld.step();
        } else {
            this.game.world.step();
        }
        this._syncTransform();
    }

    _syncTransform() {
        if (!this.rigidBody || !this.entity) return;
        const game = this.game;
        const translation = this.rigidBody.translation();
        const rotation = this.rigidBody.rotation();
        const mat = quaternionToMat4(translation, rotation);
        const tcm = game.engine.getTransformManager();
        tcm.setTransform(tcm.getInstance(this.entity), mat);
    }
}

export default EditorPhysicsPreview;
