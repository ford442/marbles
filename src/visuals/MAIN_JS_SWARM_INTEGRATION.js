/**
 * Main.js Swarm Integration Example
 * Shows how to integrate Agent Swarm refinements into the main game
 * 
 * Copy relevant parts into your main.js or import as a module
 */

// ============================================================================
// IMPORTS (add to top of main.js)
// ============================================================================

// Option 1: Import specific modules
// import { 
//   SwarmMarbleVisual, 
//   ExtendedMarbleTheme,
//   createSwarmTrackMaterial,
//   TrackSurfaceType,
//   SwarmTrackManager
// } from './visuals/MarbleVisualSwarmIntegration.js';

// Option 2: Import everything from index
// import * as SwarmVisuals from './visuals/index.js';

// ============================================================================
// MARBLE CREATION (replace in MarblesGame class)
// ============================================================================

/**
 * Create a marble with swarm visual enhancements
 * Replace the existing createMarble or similar function
 */
async function createSwarmMarble(marbleType, position, useAdvancedVisuals = true) {
    // Load physics body as before
    const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z)
            .setLinearDamping(0.1)
            .setAngularDamping(0.1)
    );
    
    const collider = this.world.createCollider(
        RAPIER.ColliderDesc.ball(0.5)
            .setRestitution(0.7)
            .setFriction(0.3),
        body
    );
    
    // Create visual with swarm enhancements
    let visual;
    if (useAdvancedVisuals && this.Filament) {
        // Use extended marble visual with swarm features
        const { SwarmMarbleVisual, getExtendedThemeForMarble } = 
            await import('./visuals/MarbleVisualSwarmIntegration.js');
        
        const theme = getExtendedThemeForMarble(marbleType);
        
        visual = new SwarmMarbleVisual(
            this.engine,
            this.scene,
            {
                theme: theme,
                position: [position.x, position.y, position.z],
                rotation: [0, 0, 0, 1],
                swarmConfig: {
                    useAdvancedShaders: true,
                    enableParticles: true,
                    qualityTier: this.detectQualityTier(),
                    lodLevel: 0 // HIGH
                }
            }
        );
    } else {
        // Fallback to basic visual
        const { createMarbleVisual, getThemeForMarble } = 
            await import('./visuals/MarbleVisual.js');
        
        visual = createMarbleVisual(
            this.engine,
            this.scene,
            getThemeForMarble(marbleType),
            [position.x, position.y, position.z]
        );
    }
    
    return {
        body,
        collider,
        visual,
        type: marbleType,
        boosts: 3,
        dashes: 3,
        jumps: 2
    };
}

// ============================================================================
// TRACK MATERIAL CREATION (replace in createZone/createStaticBox)
// ============================================================================

/**
 * Create track zone with swarm surface materials
 * Enhanced version of createTrackZone or createStaticBox
 */
async function createSwarmTrackZone(zoneData) {
    const pos = zoneData.pos || { x: 0, y: 0, z: 0 };
    const offset = { ...pos };
    
    // Determine surface type from zone type
    let surfaceType = TrackSurfaceType.OBSIDIAN; // default
    
    switch (zoneData.type) {
        case 'ice_cave':
        case 'ice_section':
            surfaceType = TrackSurfaceType.ICE;
            break;
        case 'volcano_zone':
        case 'volcanic_path':
            surfaceType = TrackSurfaceType.VOLCANIC_ROCK;
            break;
        case 'crystal_cave':
            surfaceType = TrackSurfaceType.CRYSTAL;
            break;
        case 'sand_trap':
        case 'desert_zone':
            surfaceType = TrackSurfaceType.SAND;
            break;
        case 'cyber_track':
            surfaceType = TrackSurfaceType.METAL;
            break;
        case 'wooden_ramp':
            surfaceType = TrackSurfaceType.WOOD;
            break;
        case 'urban_zone':
            surfaceType = TrackSurfaceType.CONCRETE;
            break;
        case 'rubber_bounce':
            surfaceType = TrackSurfaceType.RUBBER;
            break;
    }
    
    // Get swarm-enhanced material
    const { createSwarmTrackMaterial, TrackSurfaceType } = 
        await import('./visuals/MarbleVisualSwarmIntegration.js');
    
    const material = createSwarmTrackMaterial(
        this.engine,
        {
            zoneId: zoneData.id || `zone_${Math.random().toString(36).substr(2, 9)}`,
            surfaceType: surfaceType,
            enableWear: true,
            reflectionProbeHint: zoneData.reflectionProbeHint
        },
        zoneData.trafficIntensity || 0
    );
    
    // Create physics body
    const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
            .setTranslation(offset.x, offset.y, offset.z)
    );
    
    // Create visual with swarm material
    const entity = this.createStaticBox(
        offset,
        { x: 0, y: 0, z: 0, w: 1 },
        zoneData.size || { x: 10, y: 1, z: 10 },
        material.properties.baseColor,
        material.properties
    );
    
    return { body, entity, material };
}

// ============================================================================
// GAME LOOP INTEGRATION
// ============================================================================

/**
 * Enhanced game loop with swarm visual updates
 * Add to your existing gameLoop or update method
 */
function swarmEnhancedGameLoop(time) {
    const deltaTime = (time - this.lastTime) / 1000;
    this.lastTime = time;
    
    // Update physics
    this.world.step(deltaTime);
    
    // Update marbles with swarm visuals
    for (const marble of this.marbles) {
        if (marble.visual && marble.visual.update) {
            // Get physics state
            const pos = marble.body.translation();
            const rot = marble.body.rotation();
            const vel = marble.body.linvel();
            const angVel = marble.body.angvel();
            
            // Update visual with physics
            marble.visual.update(deltaTime, {
                velocity: [vel.x, vel.y, vel.z],
                angularVelocity: [angVel.x, angVel.y, angVel.z],
                contactPoints: [] // Would get from collision events
            });
            
            // Sync transform
            marble.visual.updateTransform(
                [pos.x, pos.y, pos.z],
                [rot.x, rot.y, rot.z, rot.w],
                1.0
            );
        }
    }
    
    // Update track wear based on marble traffic
    if (this.trackManager) {
        this.trackManager.update(deltaTime);
    }
    
    // Adaptive quality adjustment
    if (this.qualityManager) {
        const frameTime = performance.now() - time;
        this.qualityManager.recordFrameTime(frameTime);
        
        const adjustment = this.qualityManager.shouldAdjustQuality();
        if (adjustment.adjust && adjustment.newTier) {
            this.qualityManager.applyQualityTier(adjustment.newTier);
            this.applyQualityTier(adjustment.newTier);
        }
    }
    
    // Render
    if (this.renderer) {
        this.renderer.render();
    }
    
    requestAnimationFrame(this.gameLoop.bind(this));
}

// ============================================================================
// QUALITY TIER MANAGEMENT
// ============================================================================

/**
 * Detect appropriate quality tier based on hardware
 */
function detectQualityTier() {
    // Check WebGL capabilities
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    
    if (!gl) {
        return 'low'; // WebGL 1 fallback
    }
    
    // Check for advanced extensions
    const hasFloatTextures = gl.getExtension('EXT_color_buffer_float');
    const hasDerivatives = gl.getExtension('OES_standard_derivatives');
    
    // Check screen resolution (proxy for GPU power)
    const pixelCount = window.innerWidth * window.innerHeight;
    const isHighRes = pixelCount > 1920 * 1080;
    
    // Check device type
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
    
    if (isMobile) {
        return isHighRes ? 'medium' : 'low';
    }
    
    if (hasFloatTextures && hasDerivatives && !isHighRes) {
        return 'ultra';
    }
    
    return 'high';
}

/**
 * Apply quality tier to all visuals
 */
function applyQualityTier(tier) {
    console.log(`[Swarm] Applying quality tier: ${tier}`);
    
    for (const marble of this.marbles) {
        if (marble.visual && marble.visual.swarmConfig) {
            marble.visual.swarmConfig.qualityTier = tier;
            
            // Adjust LOD based on tier
            switch (tier) {
                case 'ultra':
                    marble.visual.swarmConfig.lodLevel = 0; // HIGH
                    marble.visual.swarmConfig.enableParticles = true;
                    break;
                case 'high':
                    marble.visual.swarmConfig.lodLevel = 0; // HIGH
                    marble.visual.swarmConfig.enableParticles = true;
                    break;
                case 'medium':
                    marble.visual.swarmConfig.lodLevel = 1; // MEDIUM
                    marble.visual.swarmConfig.enableParticles = true;
                    break;
                case 'low':
                    marble.visual.swarmConfig.lodLevel = 2; // LOW
                    marble.visual.swarmConfig.enableParticles = false;
                    break;
            }
        }
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize swarm systems
 * Call from your init() or constructor
 */
async function initializeSwarmSystems() {
    // Import swarm modules
    const { 
        SwarmTrackManager, 
        AdaptiveQualityManager 
    } = await import('./visuals/MarbleVisualSwarmIntegration.js');
    
    // Initialize track manager
    this.trackManager = new SwarmTrackManager();
    
    // Initialize quality manager
    this.qualityManager = new AdaptiveQualityManager(60);
    
    // Detect and apply initial quality
    const initialTier = this.detectQualityTier();
    this.qualityManager.applyQualityTier(initialTier);
    
    console.log('[Swarm] Systems initialized with quality tier:', initialTier);
}

// ============================================================================
// COLLISION HANDLING
// ============================================================================

/**
 * Enhanced collision handler with swarm features
 */
function handleSwarmCollision(marble, other, contact) {
    // Calculate impact force
    const vel = marble.body.linvel();
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    const impactForce = speed * marble.body.mass();
    
    // Trigger visual contact effect
    if (marble.visual && marble.visual.onContact) {
        marble.visual.onContact(impactForce);
    }
    
    // Update track wear if hitting a track surface
    if (other.isTrack && this.trackManager) {
        this.trackManager.recordContact(
            other.zoneId,
            { x: contact.point.x, y: contact.point.y, z: contact.point.z },
            impactForce
        );
    }
    
    // Play material-specific sound
    this.playMaterialImpactSound(marble.type, other.materialType, impactForce);
}

// ============================================================================
// BOOST HANDLING
// ============================================================================

/**
 * Enhanced boost with swarm visuals
 */
function activateSwarmBoost(marble) {
    // Apply physics boost
    const forward = this.getMarbleForwardVector(marble);
    const boostForce = 20.0;
    
    marble.body.applyImpulse(
        { x: forward.x * boostForce, y: forward.y * boostForce, z: forward.z * boostForce },
        true
    );
    
    // Trigger visual boost effect
    if (marble.visual && marble.visual.onBoostStart) {
        marble.visual.onBoostStart();
    }
    
    // Spawn boost particles
    const pos = marble.body.translation();
    this.spawnBoostParticles(pos.x, pos.y, pos.z, marble.type);
}

// ============================================================================
// UI INTEGRATION
// ============================================================================

/**
 * Update UI with swarm performance metrics
 */
function updateSwarmUI() {
    if (!this.qualityManager) return;
    
    const avgFrameTime = this.qualityManager.getAverageFrameTime();
    const currentTier = this.qualityManager.getCurrentTier();
    
    // Update performance display if exists
    const perfElement = document.getElementById('performance-metrics');
    if (perfElement) {
        perfElement.innerHTML = `
            <div>Tier: ${currentTier.toUpperCase()}</div>
            <div>Frame: ${avgFrameTime.toFixed(2)}ms</div>
            <div>FPS: ${(1000 / avgFrameTime).toFixed(0)}</div>
        `;
    }
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
In your MarblesGame class:

class MarblesGame {
    constructor() {
        // ... existing initialization ...
        
        // Initialize swarm systems
        this.initializeSwarmSystems();
    }
    
    async init() {
        // ... existing init code ...
        
        // Create player marble with swarm visuals
        this.playerMarble = await this.createSwarmMarble(
            'quantum_crystal', // or any theme
            { x: 0, y: 5, z: 0 },
            true // use advanced visuals
        );
        
        // Create track with swarm materials
        for (const zone of level.zones) {
            await this.createSwarmTrackZone(zone);
        }
    }
    
    gameLoop(time) {
        this.swarmEnhancedGameLoop(time);
    }
}
*/

// ============================================================================
// EXPORTS (if using as module)
// ============================================================================

export {
    createSwarmMarble,
    createSwarmTrackZone,
    swarmEnhancedGameLoop,
    detectQualityTier,
    applyQualityTier,
    initializeSwarmSystems,
    handleSwarmCollision,
    activateSwarmBoost,
    updateSwarmUI
};
