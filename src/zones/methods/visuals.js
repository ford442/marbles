import { materialPresets } from '../../material-system.js';
import { ENVIRONMENT_PRESETS } from '../../rendering/environment.js';

/**
 * Visual-related methods
 * These methods handle visual effects, lighting, and particle systems
 */

/**
 * Create a themed point or spot light and register it as a static scene entity.
 *
 * @param {object} game         - The game instance (engine, scene, Filament, staticEntities)
 * @param {'POINT'|'SPOT'} type - Filament light type
 * @param {{x:number,y:number,z:number}} pos   - World-space position
 * @param {[number,number,number]} color        - Linear RGB color
 * @param {number} intensity    - Luminous intensity (lux or lm depending on type)
 * @param {number} falloff      - Light radius / falloff distance
 * @returns {object} The Filament entity for the created light
 */
export function createZoneLight(game, type, pos, color, intensity, falloff) {
    const F = game.Filament;
    const lightType = type === 'SPOT'
        ? F['LightManager$Type'].SPOT
        : F['LightManager$Type'].POINT;

    const lightEntity = F.EntityManager.get().create();
    F.LightManager.Builder(lightType)
        .color(color)
        .intensity(intensity)
        .position([pos.x, pos.y, pos.z])
        .falloff(falloff)
        .castShadows(false)
        .build(game.engine, lightEntity);
    game.scene.addEntity(lightEntity);
    game.staticEntities.push(lightEntity);
    return lightEntity;
}

export const visualMethods = {
    createGoalEffects(goalPos, baseColor) {
        if (!this.goalEffects) this.goalEffects = [];
        
        const F = this.Filament;
        const goldColor = [1.0, 0.84, 0.0];
        const amberColor = [1.0, 0.6, 0.0];
        
        // Create 3 concentric glowing rings floating above goal
        const rings = [];
        const ringConfigs = [
            { radius: 1.2, height: 1.5, speed: 0.5, phase: 0 },
            { radius: 0.9, height: 2.0, speed: 0.7, phase: Math.PI * 0.67 },
            { radius: 0.6, height: 2.5, speed: 0.9, phase: Math.PI * 1.33 }
        ];
        
        for (let i = 0; i < ringConfigs.length; i++) {
            const config = ringConfigs[i];
            const ringEntity = F.EntityManager.get().create();
            const ringMat = this.material.createInstance();
            
            // Golden emissive color with slight variation per ring
            const ringColor = i === 0 ? goldColor : (i === 1 ? [1.0, 0.75, 0.2] : [1.0, 0.9, 0.4]);
            ringMat.setColor3Parameter('baseColor', F.RgbType.sRGB, ringColor);
            ringMat.setFloatParameter('roughness', 0.1);
            
            // Create thin ring geometry using flattened box
            F.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [config.radius, 0.02, config.radius] })
                .material(0, ringMat)
                .geometry(0, F.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
                .receiveShadows(false)
                .castShadows(false)
                .build(this.engine, ringEntity);
            
            this.scene.addEntity(ringEntity);
            
            rings.push({
                entity: ringEntity,
                matInstance: ringMat,
                baseY: goalPos.y + config.height,
                radius: config.radius,
                rotationSpeed: config.speed,
                bobPhase: config.phase,
                bobSpeed: 1.5 + i * 0.3,
                bobHeight: 0.15,
                index: i
            });
        }
        
        // Create pulsing point light at goal center
        const lightEntity = F.EntityManager.get().create();
        F.LightManager.Builder(F['LightManager$Type'].POINT)
            .color(amberColor)
            .intensity(50000.0)
            .position([goalPos.x, goalPos.y + 2, goalPos.z])
            .falloff(15.0)
            .build(this.engine, lightEntity);
        this.scene.addEntity(lightEntity);
        
        // Create particle fountain spawners
        const particleSpawner = {
            nextSpawnTime: 0,
            spawnInterval: 50, // ms between spawns
            particles: []
        };
        
        const goalEffect = {
            pos: { ...goalPos },
            rings: rings,
            light: lightEntity,
            baseColor: baseColor,
            particleSpawner: particleSpawner,
            state: 'idle', // 'idle', 'near', 'completed'
            baseIntensity: 50000.0,
            nearIntensity: 150000.0,
            time: 0,
            id: this.goalEffects.length
        };
        
        this.goalEffects.push(goalEffect);
        return goalEffect;
    },

    updateGoalEffects(deltaTime, playerPos) {
        if (!this.goalEffects || this.goalEffects.length === 0) return;
        
        const now = Date.now();
        const F = this.Filament;
        const tcm = this.engine.getTransformManager();
        
        for (const effect of this.goalEffects) {
            effect.time += deltaTime;
            
            // Calculate distance to player for intensity changes
            let playerDist = Infinity;
            if (playerPos) {
                const dx = playerPos.x - effect.pos.x;
                const dy = playerPos.y - effect.pos.y;
                const dz = playerPos.z - effect.pos.z;
                playerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
            
            // Determine state based on distance
            const wasNear = effect.state === 'near';
            if (playerDist < 10) {
                effect.state = 'near';
            } else {
                effect.state = 'idle';
            }
            
            // Update pulsing light intensity
            const pulseSpeed = effect.state === 'near' ? 8 : 4;
            const baseInt = effect.state === 'near' ? effect.nearIntensity : effect.baseIntensity;
            const pulseIntensity = baseInt * (0.8 + 0.2 * Math.sin(effect.time * pulseSpeed));
            
            // Update light - rebuild with new intensity
            if (effect.light) {
                F.LightManager.Builder(F['LightManager$Type'].POINT)
                    .color([1.0, 0.6, 0.0])
                    .intensity(pulseIntensity)
                    .position([effect.pos.x, effect.pos.y + 2, effect.pos.z])
                    .falloff(effect.state === 'near' ? 20 : 15)
                    .build(this.engine, effect.light);
            }
            
            // Update rings - rotation and bobbing
            for (const ring of effect.rings) {
                // Rotation
                ring.rotation += ring.rotationSpeed * deltaTime * (effect.state === 'near' ? 2 : 1);
                
                // Vertical bobbing (sine wave)
                const bobOffset = Math.sin(effect.time * ring.bobSpeed + ring.bobPhase) * ring.bobHeight;
                const y = ring.baseY + bobOffset;
                
                // Create transform matrix with rotation around Y axis
                const cosR = Math.cos(ring.rotation);
                const sinR = Math.sin(ring.rotation);
                
                // Build rotation matrix for Y-axis rotation
                const mat = new Float32Array([
                    cosR * ring.radius, 0, sinR * ring.radius, 0,
                    0, 0.02, 0, 0,
                    -sinR * ring.radius, 0, cosR * ring.radius, 0,
                    effect.pos.x, y, effect.pos.z, 1
                ]);
                
                const inst = tcm.getInstance(ring.entity);
                tcm.setTransform(inst, mat);
                
                // Fade rings in sequence
                if (effect.state === 'near') {
                    // All rings bright when near
                    ring.matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, [1.0, 0.95, 0.5]);
                } else {
                    // Sequential fade based on time
                    const fadePhase = (effect.time * 0.5 + ring.index * 0.3) % 3;
                    const brightness = fadePhase < 1 ? fadePhase : (fadePhase < 2 ? 1 : 3 - fadePhase);
                    const r = 1.0;
                    const g = 0.84 * brightness;
                    const b = 0.0;
                    ring.matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, [r, g, b]);
                }
            }
            
            // Spawn particle fountain particles
            if (now > effect.particleSpawner.nextSpawnTime) {
                effect.particleSpawner.nextSpawnTime = now + effect.particleSpawner.spawnInterval;
                this.spawnGoalParticle(effect);
            }
        }
    },

    spawnGoalParticle(effect) {
        const F = this.Filament;
        const particleEntity = F.EntityManager.get().create();
        const particleMat = this.material.createInstance();
        
        // Golden sparkle color with slight variation
        const hue = Math.random() * 0.1; // Slight gold variation
        const brightness = 0.8 + Math.random() * 0.2;
        particleMat.setColor3Parameter('baseColor', F.RgbType.sRGB, 
            [brightness, brightness * 0.9, brightness * 0.3]);
        particleMat.setFloatParameter('roughness', 0.0);
        
        F.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.05, 0.05, 0.05] })
            .material(0, particleMat)
            .geometry(0, F.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, particleEntity);
        
        this.scene.addEntity(particleEntity);
        
        // Random position in center area with outward velocity
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.3;
        const x = effect.pos.x + Math.cos(angle) * radius;
        const z = effect.pos.z + Math.sin(angle) * radius;
        const y = effect.pos.y + 0.5;
        
        // Upward velocity with slight spread
        const spread = 0.5;
        const vel = {
            x: (Math.random() - 0.5) * spread,
            y: 1.5 + Math.random() * 1.0, // Upward
            z: (Math.random() - 0.5) * spread
        };
        
        this.visualParticles.push({
            entity: particleEntity,
            matInstance: particleMat,
            pos: { x, y, z },
            vel: vel,
            spawnTime: Date.now(),
            duration: 1500 + Math.random() * 500,
            scale: 1.0,
            isGoalParticle: true
        });
    },

    triggerGoalCompletionEffect(goalId) {
        if (!this.goalEffects) return;
        
        const effect = this.goalEffects[goalId];
        if (!effect) return;
        
        effect.state = 'completed';
        
        // Burst effect - spawn many particles
        for (let i = 0; i < 30; i++) {
            setTimeout(() => this.spawnGoalParticle(effect), i * 20);
        }
        
        // Flash all rings bright
        for (const ring of effect.rings) {
            ring.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 1.0, 0.8]);
        }
        
        // Temporarily boost light
        if (effect.light) {
            this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
                .color([1.0, 1.0, 0.5])
                .intensity(300000.0)
                .position([effect.pos.x, effect.pos.y + 2, effect.pos.z])
                .falloff(30.0)
                .build(this.engine, effect.light);
        }
        
        // Return to normal after 1 second
        setTimeout(() => {
            effect.state = 'idle';
        }, 1000);
    },

    setNightMode(enabled, bgColor) {
        const F = this.Filament;
        if (enabled) {
            this.currentClearColor = bgColor || [0.02, 0.02, 0.08, 1.0];
            this.renderer.setClearOptions({ clearColor: this.currentClearColor, clear: true });

            F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
                .color([0.4, 0.5, 0.7])
                .intensity(20000.0)
                .direction([0.3, -1.0, -0.5])
                .castShadows(true)
                .build(this.engine, this.light);

            F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
                .color([0.3, 0.2, 0.5])
                .intensity(5000.0)
                .direction([-0.3, -0.3, 0.8])
                .castShadows(false)
                .build(this.engine, this.fillLight);

            F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
                .color([0.2, 0.2, 0.3])
                .intensity(3000.0)
                .direction([0.0, 1.0, 0.0])
                .castShadows(false)
                .build(this.engine, this.backLight);

            // Apply the default night IBL.  If the level specifies an explicit
            // environment, loadLevel() calls setEnvironment() after this which
            // will override this choice.
            this.applyEnvironment('space_nebula');
        } else {
            this.currentClearColor = [0.1, 0.1, 0.1, 1.0];
            this.renderer.setClearOptions({ clearColor: this.currentClearColor, clear: true });
            this.createLight();
            this.applyEnvironment('default');
        }
    },

    /**
     * Explicitly switch to a named IBL environment.
     * Call this *after* setNightMode() in loadLevel() so it takes precedence.
     *
     * @param {string} envName - Key from ENVIRONMENT_PRESETS
     */
    setEnvironment(envName) {
        if (!envName || !ENVIRONMENT_PRESETS[envName]) {
            console.warn(`[ENV] Unknown environment "${envName}", keeping current.`);
            return;
        }
        this.applyEnvironment(envName);
    },
};
