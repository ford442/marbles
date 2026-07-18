import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../../audio.js';
import { marblesInfo } from '../../marbles_data.js';
import {
    createMarbleMaterialInstance,
    applyMarbleMaterialPreset,
    MATERIAL_TIER,
} from '../../marble-material-tier.js';
import { shouldUseMarbleProxyLight, LIGHT_OWNER } from '../../lighting-budget.js';
import { extractMarbleMaterialFields } from './marble-material-fields.js';

/**
 * Marble spawn, reset, respawn, and collision-audio routing (Phase B subsystem).
 */
export class MarbleRegistry {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
    }

    createMarbles(spawnPos) {
        const g = this.game;
        const baseSpawn = spawnPos || { x: 0, y: 8, z: -12 };

        for (const info of marblesInfo) {
            const radius = info.radius || 0.5;
            const scale = radius / 0.5;
            const pos = {
                x: baseSpawn.x + info.offset.x,
                y: baseSpawn.y + info.offset.y,
                z: baseSpawn.z + info.offset.z,
            };

            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(pos.x, pos.y, pos.z)
                .setCanSleep(false);

            if (info.gravityScale !== undefined) bodyDesc.setGravityScale(info.gravityScale);
            if (info.linearDamping !== undefined) bodyDesc.setLinearDamping(info.linearDamping);
            if (info.angularDamping !== undefined) bodyDesc.setAngularDamping(info.angularDamping);

            let rigidBody;
            let collider = null;

            if (g.physicsBackend?.isWorkerMode?.()) {
                rigidBody = g.physicsBackend.registerBody({
                    type: 'dynamic',
                    translation: [pos.x, pos.y, pos.z],
                    rotation: [0, 0, 0, 1],
                    collider: {
                        type: 'ball',
                        radius,
                        density: info.density,
                        friction: info.friction !== undefined ? info.friction : undefined,
                        restitution: info.restitution !== undefined ? info.restitution : 0.5,
                    },
                    gravityScale: info.gravityScale,
                    linearDamping: info.linearDamping,
                    angularDamping: info.angularDamping,
                    canSleep: false,
                });
            } else {
                rigidBody = g.world.createRigidBody(bodyDesc);

                const colliderDesc = RAPIER.ColliderDesc.ball(radius)
                    .setRestitution(info.restitution !== undefined ? info.restitution : 0.5);

                if (info.density) colliderDesc.setDensity(info.density);
                if (info.friction !== undefined) colliderDesc.setFriction(info.friction);

                collider = g.world.createCollider(colliderDesc, rigidBody);
            }

            const entity = g.Filament.EntityManager.get().create();

            const isCube = info.geometry === 'cube';
            const isPlayerSpawn = g.marbles.length === 0;
            const spawnTier = isPlayerSpawn ? MATERIAL_TIER.FULL : MATERIAL_TIER.SIMPLIFIED;
            const presetName = info.materialType || 'polishedMarble';

            const { instance: matInstance, preset } = createMarbleMaterialInstance(
                g,
                presetName,
                info.color,
                spawnTier,
            );

            const startLod = isCube ? null : (isPlayerSpawn ? 0 : 1);
            const lodMeshes = isCube ? null : g.marbleLodMeshes;
            const vb = isCube ? g.vb : (lodMeshes?.[startLod]?.vb ?? g.sphereVb);
            const ib = isCube ? g.ib : (lodMeshes?.[startLod]?.ib ?? g.sphereIb);
            const castShadows = isCube ? true : (lodMeshes?.[startLod]?.castShadows !== false);

            g.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
                .material(0, matInstance)
                .geometry(0, g.Filament['RenderableManager$PrimitiveType'].TRIANGLES, vb, ib)
                .receiveShadows(true)
                .castShadows(castShadows)
                .build(g.engine, entity);

            g.scene.addEntity(entity);

            const marbleObj = {
                name: info.name || `Marble ${g.marbles.length + 1}`,
                rigidBody,
                collider,
                entity,
                scale,
                baseScale: scale,
                baseRadius: radius,
                baseRestitution: info.restitution !== undefined ? info.restitution : 0.5,
                baseFriction: info.friction !== undefined ? info.friction : 0.5,
                baseDensity: info.density,
                color: [...info.color],
                originalColor: [...info.color],
                initialPos: pos,
                respawnPos: { ...pos },
                scoredGoals: new Set(),
                rainbow: info.rainbow,
                baseGravityScale: info.gravityScale !== undefined ? info.gravityScale : 1.0,
                originalGravityScale: info.gravityScale !== undefined ? info.gravityScale : 1.0,
                materialPreset: { ...(preset || {}), ...extractMarbleMaterialFields(info) },
                materialPresetName: presetName,
                matInstance,
                _materialTier: spawnTier,
                geometry: info.geometry || 'sphere',
                lodMeshes,
                lodLevel: startLod ?? 1,
            };

            if (info.emissive) {
                marbleObj.emissive = true;
                marbleObj.lightColor = info.lightColor || info.color;
                marbleObj.lightIntensity = info.lightIntensity || 10000.0;
            } else if (preset?.emissiveIntensity > 0) {
                marbleObj.emissive = true;
                marbleObj.lightColor = preset.rimLightColor || preset.emissive || info.color || [1, 1, 1];
                marbleObj.lightIntensity = preset.emissiveIntensity * 10000;
            }

            g.marbles.push(marbleObj);
            g.dynamicBodies.add(rigidBody);
            applyMarbleMaterialPreset(marbleObj, g, spawnTier);
            this._applyMarbleMaterialOverrides(marbleObj, info);
        }

        g.currentMarbleIndex = 0;
        g.playerMarble = g.marbles[0];
        g.selectedEl.textContent = `Selected: ${g.playerMarble.name}`;
        this.updateActiveMarbleLight();
    }

    _applyMarbleMaterialOverrides(marble, info) {
        const g = this.game;
        const mat = marble?.matInstance;
        if (!mat) return;
        if (info.roughness !== undefined) mat.setFloatParameter('roughness', info.roughness);
        if (!g.hasProceduralMaterial) return;
        if (info.metallic !== undefined) mat.setFloatParameter('metallic', info.metallic);
        if (info.reflectance !== undefined) mat.setFloatParameter('reflectance', info.reflectance);
        if (info.clearCoat !== undefined) mat.setFloatParameter('clearCoat', info.clearCoat);
        if (info.clearCoatRoughness !== undefined) mat.setFloatParameter('clearCoatRoughness', info.clearCoatRoughness);
        if (info.bumpScale !== undefined) mat.setFloatParameter('bumpScale', info.bumpScale);
        if (info.bumpFrequency !== undefined) mat.setFloatParameter('bumpFrequency', info.bumpFrequency);
        if (info.anisotropy !== undefined) mat.setFloatParameter('anisotropyStrength', info.anisotropy);
        if (info.grainScale !== undefined) mat.setFloatParameter('grainScale', info.grainScale);
        if (info.scratchesIntensity !== undefined) mat.setFloatParameter('scratchesIntensity', info.scratchesIntensity);
        if (info.emissive !== undefined) {
            mat.setColor3Parameter('emissive', g.Filament.RgbType.LINEAR, info.emissive);
        }
        if (info.emissiveIntensity !== undefined) {
            mat.setFloatParameter('emissiveIntensity', info.emissiveIntensity);
        }
    }

    updateActiveMarbleLight() {
        const g = this.game;
        if (g.activeMarbleLightEntity) {
            g.lightingBudget?.unregister(g.activeMarbleLightEntity);
            g.scene.remove(g.activeMarbleLightEntity);
            g.engine.destroyEntity(g.activeMarbleLightEntity);
            g.Filament.EntityManager.get().destroy(g.activeMarbleLightEntity);
            g.activeMarbleLightEntity = null;
        }

        const marble = g.playerMarble;
        if (!marble?.emissive) return;

        const quality = g.settings?.graphics?.quality || 'medium';
        if (!shouldUseMarbleProxyLight(quality)) {
            return;
        }

        const lightEntity = g.Filament.EntityManager.get().create();
        g.Filament.LightManager.Builder(g.Filament['LightManager$Type'].POINT)
            .color(marble.lightColor || marble.color)
            .intensity(marble.lightIntensity || 10000.0)
            .falloff(20.0)
            .castShadows(false)
            .build(g.engine, lightEntity);
        g.scene.addEntity(lightEntity);
        g.activeMarbleLightEntity = lightEntity;
        marble.lightEntity = lightEntity;

        g.lightingBudget?.register({
            entity: lightEntity,
            owner: LIGHT_OWNER.player,
            getPos: () => {
                const t = marble.rigidBody?.translation?.();
                return t ? { x: t.x, y: t.y, z: t.z } : marble.initialPos;
            },
            falloff: 20,
            baseIntensity: marble.lightIntensity || 10000,
            castsShadow: false,
        });
    }

    getLeader() {
        const g = this.game;
        let maxZ = -Infinity;
        let leader = null;
        for (const m of g.marbles) {
            const t = m.rigidBody.translation();
            if (t.z > maxZ) {
                maxZ = t.z;
                leader = m;
            }
        }
        return leader;
    }

    respawnToLastCheckpoint() {
        const g = this.game;
        if (!g.playerMarble) return;

        const m = g.playerMarble;
        const respawn = m.respawnPos || m.initialPos;
        m.rigidBody.setTranslation(respawn, true);
        m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        m.scoredGoals.clear();

        g._rewindHead = 0;
        g._rewindCount = 0;
        if (g.score > 0) {
            g.score = Math.max(0, g.score - 50);
            if (g.scoreEl) g.scoreEl.textContent = 'Score: ' + g.score;
            if (typeof g.showTrickMessage === 'function') {
                g.showTrickMessage('-50 Respawn Penalty', '#ff0000');
            }
        }

        g.combo = 1;
        if (g.comboEl) {
            g.comboEl.style.display = 'none';
            g.comboEl.textContent = 'Combo: x1';
        }
        if (g.combobarContainerEl) {
            g.combobarContainerEl.style.display = 'none';
        }

        if (typeof g.triggerCheckpointFlash === 'function') {
            g.triggerCheckpointFlash();
        }

        if (typeof audio !== 'undefined' && audio.playJump) {
            audio.playJump();
        }
    }

    resetMarbles() {
        const g = this.game;
        audio.stopAllRolling();

        for (const m of g.marbles) {
            m.rigidBody.setTranslation(m.initialPos, true);
            m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
            m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
            m.scoredGoals.clear();
            m.respawnPos = { ...m.initialPos };

            m.sizeState = 0;
            if (m.scale !== m.baseScale) {
                if (m.collider) {
                    g.world.removeCollider(m.collider, true);
                }
                const desc = RAPIER.ColliderDesc.ball(m.baseRadius)
                    .setRestitution(m.baseRestitution !== undefined ? m.baseRestitution : 0.5)
                    .setFriction(m.baseFriction !== undefined ? m.baseFriction : 0.5);
                if (m.baseDensity) {
                    desc.setDensity(m.baseDensity);
                }
                m.collider = g.world.createCollider(desc, m.rigidBody);
                m.scale = m.baseScale;
            }
        }

        for (const cp of g.checkpoints) {
            cp.activated = false;
            if (cp.matInstance) {
                cp.matInstance.setColor3Parameter('baseColor', g.Filament.RgbType.sRGB, [0.0, 1.0, 1.0]);
            }
        }

        g.score = 0;
        g.scoreEl.textContent = 'Score: 0';
        g.combo = 1;
        g.comboTimer = 0;
        if (g.comboEl) {
            g.comboEl.style.display = 'none';
            g.comboEl.textContent = 'Combo: x1';
        }
        if (g.combobarContainerEl) g.combobarContainerEl.style.display = 'none';
        if (g.combobarEl) g.combobarEl.style.width = '0%';

        g.currentMarbleIndex = 0;
        g.playerMarble = g.marbles[0];
        g.selectedEl.textContent = `Selected: ${g.playerMarble ? g.playerMarble.name : 'None'}`;

        g.adrenaline = 0;
        g.currentFov = g.baseFov;
        if (g.nearMisses) g.nearMisses.clear();

        g.chameleonState = 0;
        if (g.playerMarble) {
            g.playerMarble.baseGravityScale = g.playerMarble.originalGravityScale || g.playerMarble.baseGravityScale || 1.0;
            g.playerMarble.rigidBody.setGravityScale(g.playerMarble.baseGravityScale, true);
            const rcm = g.engine.getRenderableManager();
            const inst = rcm.getInstance(g.playerMarble.entity);
            if (g.playerMarble.originalColor) {
                g.playerMarble.color = [...g.playerMarble.originalColor];
                rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', g.Filament.RgbType.sRGB, g.playerMarble.originalColor);
            }
        }

        g.flipActive = false;
        g.jetpackActive = false;
        g.aimYaw = 0;
        g.chargePower = 0;
        g.charging = false;
        g.powerbarEl.style.width = '0%';
        g.levelComplete = false;
        g._rewindHead = 0;
        g._rewindCount = 0;
        g.ghostReplay?.beginRecording();
        g.ghostReplay?.resetPlayback();
        g.levelStartTime = Date.now();

        if (g.portalA) g.destroyPortal(g.portalA);
        if (g.portalB) g.destroyPortal(g.portalB);
        g.portalA = null;
        g.portalB = null;
        document.getElementById('portal-a-status').style.color = '#444';
        document.getElementById('portal-b-status').style.color = '#444';

        const drainProjectiles = (list) => {
            if (!list?.length) return [];
            for (const obj of [...list]) {
                if (obj.rigidBody) {
                    g.dynamicBodies.delete(obj.rigidBody);
                    g.world.removeRigidBody(obj.rigidBody);
                }
                g.effectPool?.releaseProjectile(obj);
            }
            return [];
        };

        g.activeMissiles = drainProjectiles(g.activeMissiles);
        g.activeBombs = drainProjectiles(g.activeBombs);
        g.activeBlackHoles = drainProjectiles(g.activeBlackHoles);

        g.dynamicBodies = new Set();
        for (const m of g.marbles) g.dynamicBodies.add(m.rigidBody);
        for (const obj of g.dynamicObjects) g.dynamicBodies.add(obj.rigidBody);
    }

    returnToMenu() {
        const g = this.game;
        audio.stopAllRolling();
        g.clearLevel();
        g.showLevelSelection();
    }

    processCollisionEvents() {
        const g = this.game;
        if (!g.world) return;

        const processedCollisions = new Set();
        const touchingSurfaces = new Map();

        for (let i = 0; i < g.marbles.length; i++) {
            const marble = g.marbles[i];
            const rb = marble.rigidBody;
            const velocity = rb.linvel();
            const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
            const angVel = rb.angvel();
            const angularSpeed = Math.hypot(angVel.x, angVel.y, angVel.z);

            const radius = marble.scale * 0.5 || 0.5;
            const pos = rb.translation();

            const rayOrigin = { x: pos.x, y: pos.y, z: pos.z };
            const rayDir = { x: 0, y: g.flipActive ? 1 : -1, z: 0 };
            const ray = new RAPIER.Ray(rayOrigin, rayDir);
            const maxToi = radius + 0.1;

            const hit = g.world.castRay(ray, maxToi, true);
            if (hit) {
                const otherCollider = hit.collider;
                const otherBody = otherCollider.parent();

                if (otherBody && otherBody !== rb) {
                    if (otherBody.bodyType() === RAPIER.RigidBodyType.Fixed) {
                        const material = audio.getMaterial(otherBody.handle);

                        touchingSurfaces.set(i, { material, speed, angularSpeed, radius });

                        const collisionId = `${rb.handle}-${otherBody.handle}`;
                        if (!processedCollisions.has(collisionId) && speed > 2.5) {
                            processedCollisions.add(collisionId);
                            const marbleMat = marble.materialPresetName || 'glass';
                            audio.playCollision({
                                velocity: speed,
                                radius,
                                marbleMaterial: marbleMat,
                                surfaceMaterial: material,
                                id: `surface-${rb.handle}`,
                                position: { x: pos.x, y: pos.y, z: pos.z },
                            });
                        }
                    }
                }
            }
        }

        for (let i = 0; i < g.marbles.length; i++) {
            const marbleId = `marble-${i}`;
            const surfaceInfo = touchingSurfaces.get(i);

            if (surfaceInfo && surfaceInfo.speed > 0.3) {
                const rollingId = `${marbleId}-rolling`;
                if (!audio.rollingSounds || !audio.rollingSounds.has(rollingId)) {
                    audio.startRolling(rollingId, surfaceInfo.radius, surfaceInfo.material);
                }
                audio.updateRolling(rollingId, surfaceInfo.speed, surfaceInfo.angularSpeed);
            } else {
                audio.stopRolling(`${marbleId}-rolling`);
            }
        }
    }
}

export { extractMarbleMaterialFields } from './marble-material-fields.js';
