/**
 * MAIN_JS_INTEGRATION_EXAMPLE.js
 * 
 * This file shows the exact changes needed in main.js to integrate MarbleVisual.
 * Copy these code sections into the appropriate locations in main.js.
 */

// ============================================================================
// 1. ADD IMPORT AT TOP OF main.js
// ============================================================================

// Add this import with the other imports
import { 
    MarbleVisual, 
    MarbleTheme, 
    MarbleVisualFactory,
    MARBLE_THEME_PRESETS 
} from './visuals/MarbleVisual.js';

// ============================================================================
// 2. ADD HELPER METHOD TO MarblesGame CLASS
// ============================================================================

/**
 * Map marble info to visual theme
 */
getThemeForMarble(info) {
    // Explicit theme mapping based on marble properties
    const name = info.name.toLowerCase();
    
    // Neon/Glow marbles
    if (info.emissive || name.includes('neon') || name.includes('plasma') || 
        name.includes('cosmic') || name.includes('sun') || name.includes('gold') ||
        name.includes('cyan') || name.includes('magma') || name.includes('quantum') ||
        name.includes('anti-matter') || name.includes('mercury')) {
        return MarbleTheme.NEON_GLOW;
    }
    
    // Glass marbles (smooth, non-metallic)
    if (name.includes('glass') || name.includes('ice') || name.includes('glacier') ||
        (info.roughness !== undefined && info.roughness < 0.1 && !info.emissive)) {
        return MarbleTheme.CLASSIC_GLASS;
    }
    
    // Obsidian/Metal marbles
    if (name.includes('obsidian') || name.includes('ninja') || name.includes('void') ||
        name.includes('pinball') || (info.roughness !== undefined && info.roughness < 0.05)) {
        return MarbleTheme.OBSIDIAN_METAL;
    }
    
    // Stone marbles (rough)
    if (name.includes('stone') || name.includes('mud') || name.includes('meteor') ||
        name.includes('slime') || name.includes('feather') ||
        (info.roughness !== undefined && info.roughness > 0.5)) {
        return MarbleTheme.STONE_VEIN;
    }
    
    // Default based on roughness
    if (info.roughness !== undefined) {
        if (info.roughness < 0.2) return MarbleTheme.CLASSIC_GLASS;
        if (info.roughness > 0.6) return MarbleTheme.STONE_VEIN;
    }
    
    // Default fallback
    return MarbleTheme.STONE_VEIN;
}

// ============================================================================
// 3. REPLACE createMarbles() METHOD
// ============================================================================

// REPLACE the entire createMarbles method with this version:
createMarbles(spawnPos) {
    const baseSpawn = spawnPos || { x: 0, y: 8, z: -12 };

    for (const info of marblesInfo) {
        const radius = info.radius || 0.5;
        const scale = radius / 0.5;
        const pos = {
            x: baseSpawn.x + info.offset.x,
            y: baseSpawn.y + info.offset.y,
            z: baseSpawn.z + info.offset.z
        };

        // Create physics body
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y, pos.z)
            .setCanSleep(false);

        if (info.gravityScale !== undefined) bodyDesc.setGravityScale(info.gravityScale);
        if (info.linearDamping !== undefined) bodyDesc.setLinearDamping(info.linearDamping);
        if (info.angularDamping !== undefined) bodyDesc.setAngularDamping(info.angularDamping);

        const rigidBody = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.ball(radius)
            .setRestitution(info.restitution !== undefined ? info.restitution : 0.5);

        if (info.density) colliderDesc.setDensity(info.density);
        if (info.friction !== undefined) colliderDesc.setFriction(info.friction);

        this.world.createCollider(colliderDesc, rigidBody);

        // Create visual system
        const theme = this.getThemeForMarble(info);
        const isPlayer = this.marbles.length === 0; // First marble is player
        
        const marbleVisual = MarbleVisualFactory.create(
            `marble_${this.marbles.length}`,
            theme,
            this.engine,
            this.material,
            {
                theme: theme,
                enableParticles: isPlayer, // Only player marble gets particles
                enableEmissive: info.emissive || false,
                enableRefraction: theme === MarbleTheme.CLASSIC_GLASS,
                enableCustomShader: true,
                lodDistance: MARBLE_THEME_PRESETS[theme]?.lodDistance || [10, 30, 60]
            }
        );

        // Get material instance from visual system
        const matInstance = marbleVisual.getMaterialInstance();
        
        // If the theme didn't set color (stone uses texture), set base color
        if (theme !== MarbleTheme.STONE_VEIN) {
            matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, info.color);
        }

        const vb = info.geometry === 'cube' ? this.vb : this.sphereVb;
        const ib = info.geometry === 'cube' ? this.ib : this.sphereIb;

        const entity = this.Filament.EntityManager.get().create();
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, vb, ib)
            .build(this.engine, entity);

        this.scene.addEntity(entity);

        const marbleObj = {
            name: info.name || `Marble ${this.marbles.length + 1}`,
            rigidBody,
            entity,
            visual: marbleVisual,  // ADDED: Store visual reference
            scale,
            color: info.color,
            initialPos: pos,
            respawnPos: { ...pos },
            scoredGoals: new Set(),
            rainbow: info.rainbow
        };

        // Note: Emissive light is now handled by MarbleVisual system
        // Only create additional light for special cases
        if (info.emissive && !marbleVisual) {
            const lightEntity = this.Filament.EntityManager.get().create();
            this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
                .color(info.lightColor || info.color)
                .intensity(info.lightIntensity || 10000.0)
                .falloff(20.0)
                .build(this.engine, lightEntity);
            this.scene.addEntity(lightEntity);
            marbleObj.lightEntity = lightEntity;
        }

        this.marbles.push(marbleObj);
    }

    this.currentMarbleIndex = 0;
    this.playerMarble = this.marbles[0];
    this.selectedEl.textContent = `Selected: ${this.playerMarble.name}`;
}

// ============================================================================
// 4. UPDATE GAME LOOP (loop() method)
// ============================================================================

// FIND the marble update section in loop() (around line 1954):
// REPLACE that section with:

const tcm = this.engine.getTransformManager();
for (const m of this.marbles) {
    const t = m.rigidBody.translation();
    const r = m.rigidBody.rotation();
    const mat = quaternionToMat4(t, r);

    if (m.scale && m.scale !== 1.0) {
        mat[0] *= m.scale; mat[1] *= m.scale; mat[2] *= m.scale;
        mat[4] *= m.scale; mat[5] *= m.scale; mat[6] *= m.scale;
        mat[8] *= m.scale; mat[9] *= m.scale; mat[10] *= m.scale;
    }

    const inst = tcm.getInstance(m.entity);
    tcm.setTransform(inst, mat);

    // UPDATE MARBLE VISUAL
    if (m.visual) {
        const vel = m.rigidBody.linvel();
        const angVel = m.rigidBody.angvel();
        
        // Calculate distance to camera for LOD
        let camPos;
        if (this.cameraMode === 'follow' && this.playerMarble) {
            // Approximate camera position
            const pt = this.playerMarble.rigidBody.translation();
            const eyeX = pt.x - Math.sin(this.aimYaw) * 20;
            const eyeZ = pt.z - Math.cos(this.aimYaw) * 20;
            camPos = { x: eyeX, y: pt.y + 10, z: eyeZ };
        } else {
            camPos = {
                x: this.camRadius * Math.sin(this.camAngle),
                y: this.camHeight,
                z: this.camRadius * Math.cos(this.camAngle)
            };
        }
        
        const dist = Math.sqrt(
            (t.x - camPos.x) ** 2 +
            (t.y - camPos.y) ** 2 +
            (t.z - camPos.z) ** 2
        );
        
        m.visual.setLOD(dist);
        m.visual.update(1/60 * this.timeScale, vel, angVel);
    }

    // Legacy rainbow effect (keep for Chameleon marble)
    if (m.rainbow) {
        const time = Date.now() * 0.002;
        const rc = Math.sin(time) * 0.5 + 0.5;
        const gc = Math.sin(time + 2.094) * 0.5 + 0.5;
        const bc = Math.sin(time + 4.188) * 0.5 + 0.5;
        const rcm = this.engine.getRenderableManager();
        const renderInst = rcm.getInstance(m.entity);
        rcm.getMaterialInstanceAt(renderInst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [rc, gc, bc]);
    }

    // Update light position if exists
    if (m.lightEntity) {
        const lightInst = tcm.getInstance(m.lightEntity);
        const lightMat = quaternionToMat4(t, { x: 0, y: 0, z: 0, w: 1 });
        tcm.setTransform(lightInst, lightMat);
    }
}

// ============================================================================
// 5. UPDATE COLLISION HANDLER (processCollisionEvents)
// ============================================================================

// IN processCollisionEvents(), ADD after collision detection:

for (let i = 0; i < this.marbles.length; i++) {
    const marble = this.marbles[i];
    const rb = marble.rigidBody;
    const velocity = rb.linvel();
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const angVel = rb.angvel();
    const angularSpeed = Math.hypot(angVel.x, angVel.y, angVel.z);

    const radius = marble.scale * 0.5 || 0.5;
    const pos = rb.translation();

    const rayOrigin = { x: pos.x, y: pos.y, z: pos.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    const ray = new RAPIER.Ray(rayOrigin, rayDir);
    const maxToi = radius + 0.1;

    const hit = this.world.castRay(ray, maxToi, true);
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
                    audio.playSurfaceHit(speed, radius, material, `surface-${rb.handle}`);
                    
                    // ADDED: Trigger visual contact effect
                    if (marble.visual) {
                        marble.visual.onContact(speed);
                    }
                }
            }
        }
    }
}

// ============================================================================
// 6. UPDATE BOOST HANDLER
// ============================================================================

// IN the boost section of loop(), REPLACE the boost code with:

if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
    const now = Date.now();
    if (this.playerMarble && now - this.lastBoostTime > this.boostCooldown) {
        const force = 60.0;
        let boostYaw = this.aimYaw;
        const dirX = Math.sin(boostYaw);
        const dirZ = Math.cos(boostYaw);

        this.playerMarble.rigidBody.applyImpulse({
            x: dirX * force,
            y: 0,
            z: dirZ * force
        }, true);

        this.lastBoostTime = now;
        
        // ADDED: Trigger boost visual effect
        if (this.playerMarble.visual) {
            this.playerMarble.visual.onBoostStart();
        }
        
        audio.playBoost();
    }
}

// ============================================================================
// 7. UPDATE clearLevel() FOR CLEANUP
// ============================================================================

// IN clearLevel(), REPLACE the marble cleanup section with:

clearLevel() {
    // ADDED: Destroy all visual instances
    MarbleVisualFactory.destroyAll();

    for (const m of this.marbles) {
        this.world.removeRigidBody(m.rigidBody);
        this.scene.remove(m.entity);
        this.engine.destroyEntity(m.entity);
        if (m.lightEntity) {
            this.scene.remove(m.lightEntity);
            this.engine.destroyEntity(m.lightEntity);
        }
        // Note: m.visual.destroy() is called by factory
    }
    this.marbles = [];
    this.playerMarble = null;

    // ... rest of clearLevel() remains unchanged
}

// ============================================================================
// 8. DEBUG COMMAND (Optional - add to window for debugging)
// ============================================================================

// IN init() or at end of file, add:

// Expose debug functions
window.marbleDebug = {
    getStats: () => {
        return MarbleVisualFactory.getAllStats();
    },
    setTheme: (index, theme) => {
        const m = window.game.marbles[index];
        if (m && m.visual) {
            // Note: Theme change would require recreating material
            console.log('Theme change requires visual rebuild');
        }
    },
    forceLOD: (level) => {
        window.game.marbles.forEach(m => {
            if (m.visual) {
                m.visual.setLOD([5, 15, 40][level] || 100);
            }
        });
    }
};

// ============================================================================
// END OF INTEGRATION EXAMPLE
// ============================================================================
