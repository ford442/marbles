/**
 * @fileoverview Type definitions for zone methods
 * 
 * These types describe the expected structure of parameters used throughout
 * the zone creation and management system.
 */

/**
 * @typedef {Object} Vector3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} Quaternion
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} w
 */

/**
 * @typedef {Object} Size
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} Checkpoint
 * @property {Vector3} pos
 * @property {Vector3} halfExtents
 * @property {Object} entity - Filament entity
 * @property {Object} matInstance - Material instance
 * @property {Object} lightEntity - Light entity
 * @property {boolean} activated
 */

/**
 * @typedef {Object} MovingPlatform
 * @property {Object} rigidBody - Rapier rigid body
 * @property {Object} entity - Filament entity
 * @property {Vector3} halfExtents
 * @property {string} type - 'horizontal' | 'vertical' | 'depth'
 * @property {number} center
 * @property {number} amplitude
 * @property {Vector3} initialPos
 * @property {number} speed
 */

/**
 * @typedef {Object} PowerUp
 * @property {Object} rigidBody - Rapier rigid body
 * @property {Object} entity - Filament entity
 * @property {string} type - 'speed' | 'jump' | 'gravity'
 * @property {number} baseY
 * @property {number} rotation
 * @property {Vector3} pos
 */

/**
 * @typedef {Object} GoalEffect
 * @property {Vector3} pos
 * @property {Array<Object>} rings
 * @property {Object} light - Light entity
 * @property {Array<number>} baseColor
 * @property {Object} particleSpawner
 * @property {string} state - 'idle' | 'near' | 'completed'
 * @property {number} baseIntensity
 * @property {number} nearIntensity
 * @property {number} time
 * @property {number} id
 */

/**
 * @typedef {Object} GoalRing
 * @property {Object} entity - Filament entity
 * @property {Object} matInstance - Material instance
 * @property {number} baseY
 * @property {number} radius
 * @property {number} rotationSpeed
 * @property {number} bobPhase
 * @property {number} bobSpeed
 * @property {number} bobHeight
 * @property {number} index
 * @property {number} [rotation]
 */

/**
 * @typedef {Object} VisualParticle
 * @property {Object} entity - Filament entity
 * @property {Object} matInstance - Material instance
 * @property {Vector3} pos
 * @property {Vector3} vel
 * @property {number} spawnTime
 * @property {number} duration
 * @property {number} scale
 * @property {boolean} isGoalParticle
 */

export {};
