/**
 * Particle System Integration Guide
 * 
 * Quick reference for using particles in zones, abilities, and marble effects.
 */

/**
 * QUICK START
 * 
 * The particle system is initialized automatically with the game.
 * Access it via: `game.particleSystem`
 * 
 * Basic usage:
 *   game.particleSystem.emitParticles(type, position, count, params)
 * 
 * Particle Types: 'trail', 'impact', 'spark', 'bubble', 'dust'
 */

/**
 * PARTICLE TYPES & USE CASES
 */

// 1. TRAIL - Behind fast-moving objects
//    - Use: Speed feedback, marble trails
//    - Behavior: Fades, low drag, no gravity
//    example: emitParticles('trail', marblePos, 2, {
//        velocity: marbleVelocity,
//        lifetime: 0.3,
//        size: 0.2,
//        color: [1, 0, 0, 1]
//    })

// 2. IMPACT - On collision/impact
//    - Use: Landing feedback, explosion effects
//    - Behavior: Explosive spread, fast falloff
//    example: emitParticles('impact', collisionPos, 15, {
//        force: 4.0,
//        lifetime: 0.8,
//        color: [1, 0.8, 0.5, 1]
//    })

// 3. SPARK - Electric/hot effects
//    - Use: Electrical abilities, sparks on friction
//    - Behavior: Scattered velocity, high gravity
//    example: emitParticles('spark', abilityPos, 8, {
//        force: 3.0,
//        lifetime: 0.8,
//        color: [1, 1, 0, 1]  // Yellow
//    })

// 4. BUBBLE - Underwater/floating
//    - Use: Abyssal Trench ambience, water effects
//    - Behavior: Rising, buoyant, transparent
//    example: emitParticles('bubble', underwaterPos, 3, {
//        lifetime: 3.0,
//        color: [0.2, 0.8, 1, 0.6]  // Light cyan
//    })

// 5. DUST - Settling/ambient
//    - Use: Dust on landing, environmental haze
//    - Behavior: Slow settle, high drag
//    example: emitParticles('dust', landingPos, 5, {
//        lifetime: 1.5,
//        color: [0.7, 0.65, 0.6, 0.8]
//    })

/**
 * HELPER FUNCTIONS (in src/particle-materials.js:ParticleEmitters)
 */

import { ParticleEmitters } from './particle-materials.js';

// Speed trails (auto-emitted based on velocity)
ParticleEmitters.createSpeedTrail(
    particleSystem,
    marblePos,
    marbleVelocity,
    marbleColor,
    strength
);

// Impact bursts on collision
ParticleEmitters.createImpactBurst(
    particleSystem,
    collisionPos,
    collisionNormal  // Optional
);

// Boost/ability jets
ParticleEmitters.createBoostJet(
    particleSystem,
    marblePos,
    marbleVelocity,
    boostColor  // e.g. [1, 1, 0] for neon
);

// Abyssal Trench bubbles
ParticleEmitters.createAbyssalBubbles(
    particleSystem,
    spawnPos,
    count
);

// Volcanic zone sparks
ParticleEmitters.createVolcanicSparks(
    particleSystem,
    spawnPos,
    count
);

// Dust settling
ParticleEmitters.createDustPuff(
    particleSystem,
    spawnPos,
    count
);

/**
 * INTEGRATION EXAMPLES
 */

// ===== EXAMPLE 1: Speed trails on player marble =====
// In marble-management-methods.js or game-loop methods:
if (this.playerMarble && this.particleSystem) {
    const vel = this.playerMarble.rigidBody.linearVelocity();
    const speed = Math.sqrt(vel.x**2 + vel.y**2 + vel.z**2);
    
    if (speed > 5) {  // Only above threshold
        ParticleEmitters.createSpeedTrail(
            this.particleSystem,
            this.playerMarble.position,
            [vel.x, vel.y, vel.z],
            this.playerMarble.color || [1, 1, 1]
        );
    }
}

// ===== EXAMPLE 2: Impact particles on collision =====
// In game-loop-sync-methods.js processCollisionEvents():
function onCollision(event) {
    const collisionPos = event.position || { x: 0, y: 0, z: 0 };
    const force = event.force || 1.0;
    
    if (this.particleSystem && force > 2.0) {
        ParticleEmitters.createImpactBurst(this.particleSystem, collisionPos);
    }
}

// ===== EXAMPLE 3: Zone ambient particles =====
// In zone setup (e.g., createAbyssalTrenchZone in zone-setup-methods.js):
function setupAbyssalTrench() {
    // ... zone geometry setup ...
    
    // Continuous bubble emitter
    this.abyssalBubbleEmitter = setInterval(() => {
        if (this.particleSystem) {
            const randomPos = {
                x: Math.random() * 50 - 25,
                y: Math.random() * 10,
                z: Math.random() * 50 - 25
            };
            ParticleEmitters.createAbyssalBubbles(
                this.particleSystem,
                randomPos,
                1
            );
        }
    }, 100);  // One bubble every 100ms
}

// ===== EXAMPLE 4: Ability-triggered particles =====
// In ability-methods.js for missile, bomb, black hole:
if (this.playerMarble && this.particleSystem) {
    const marblePos = this.playerMarble.position;
    const marbleColor = this.playerMarble.color || [1, 1, 1];
    
    // Missile: boost jet
    ParticleEmitters.createBoostJet(
        this.particleSystem,
        marblePos,
        [marbleVel.x * 2, marbleVel.y * 2, marbleVel.z * 2],
        [1, 0.5, 0]  // Orange for missiles
    );
    
    // Bomb: spark burst
    ParticleEmitters.createVolcanicSparks(
        this.particleSystem,
        bombPos,
        20  // More particles for bigger impact
    );
    
    // Black hole: vortex (custom)
    this.particleSystem.emitParticles('spark', blackHolePos, 5, {
        force: 8.0,  // High force for spiral effect
        lifetime: 1.0,
        color: [0.2, 0, 0.2, 1]  // Purple
    });
}

/**
 * QUALITY TIERS
 * 
 * Particle budgets are automatically configured based on graphics quality:
 * 
 * Low:    50 particles max
 * Medium: 200 particles max
 * High:   600 particles max
 * Ultra:  1200 particles max
 * 
 * System automatically culls particles when budget is exceeded (FIFO).
 * No manual gating needed - system handles graceful degradation.
 */

/**
 * PERFORMANCE TIPS
 * 
 * 1. Emit strategically:
 *    - Use speed threshold (e.g., only emit trails if speed > 5)
 *    - Batch emissions (prefer 1 call with count=10 vs 10 calls with count=1)
 *    - Limit frequency (e.g., emit every 2-3 frames, not every frame)
 * 
 * 2. Type selection:
 *    - Trail: cheapest, best for continuous motion
 *    - Impact: moderate cost, good visual feedback
 *    - Spark/Bubble/Dust: similar cost, choose based on effect type
 * 
 * 3. Zone ambience:
 *    - Use intervals/timers instead of per-frame emission
 *    - Example: bubble emitter every 100ms = ~10 bubbles/sec
 *    - Much cheaper than per-frame emission
 * 
 * 4. Avoid:
 *    - Do NOT emit particles every frame for every marble
 *    - Do NOT emit thousands of particles at once
 *    - Do NOT use excessive particles in update() hot loop
 * 
 * Target performance on medium tier: <0.5ms per frame (particles)
 */

/**
 * API REFERENCE
 */

/**
 * particleSystem.emitParticles(type, pos, count, params)
 * 
 * @param {string} type - Particle type: 'trail', 'impact', 'spark', 'bubble', 'dust'
 * @param {object} pos - Position {x, y, z} or [x, y, z]
 * @param {number} count - Number of particles to emit (auto-clamped to budget)
 * @param {object} params - Optional parameters:
 *     lifetime: number (seconds, default: type-specific)
 *     velocity: [x, y, z] (for trail particles)
 *     force: number (spread force for impact/spark)
 *     size: number (0.1-0.3 typical)
 *     color: [r, g, b] or [r, g, b, a] (0-1 range)
 */

/**
 * particleSystem.update(deltaTime)
 * 
 * Called automatically by game loop each frame.
 * Updates particle positions, velocities, lifetimes.
 * Do NOT call manually.
 * 
 * @param {number} deltaTime - Frame time in seconds (typically 0.016)
 */

/**
 * particleSystem.stats
 * 
 * Active statistics:
 * - stats.activeCount: Number of currently alive particles
 * - stats.emittedThisFrame: Number emitted in current frame
 * 
 * Use for debugging/profiling:
 *   console.log(`Particles: ${game.particleSystem.stats.activeCount}`);
 */

/**
 * CLEANUP
 * 
 * Particles are automatically cleaned up when:
 * 1. Lifetime expires (each particle tracks its own lifetime)
 * 2. Pool is exhausted (oldest particles removed FIFO)
 * 3. Zone changes (particle system persists, but zone-specific emitters stop)
 * 
 * No manual cleanup needed for the particle system itself.
 * Just stop calling emit() when you want particles to stop.
 */
