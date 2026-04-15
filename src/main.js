import RAPIER from '@dimforge/rapier3d-compat';
import { applyZoneMethods } from './zones/methods/index.js';
import { applyInputMethods } from './input-methods.js';
import { loadFilament, applyInitMethods } from './init-methods.js';
import { applyZoneSetupMethods } from './zone-setup-methods.js';
import { applyPhysicsFactoryMethods } from './physics-factory-methods.js';
import { applyMarbleManagementMethods } from './marble-management-methods.js';
import { applyGameLogicMethods } from './game-logic-methods.js';
import { applyAbilityMethods } from './ability-methods.js';
import { applyGameLoopMethods } from './game-loop-methods.js';
import { applyGameLoopRenderMethods } from './game-loop-render-methods.js';
import { applyGameLoopSyncMethods } from './game-loop-sync-methods.js';
import { HUDManager } from './hud-manager.js';

class MarblesGame {
    constructor() {
        this.canvas = document.getElementById('canvas')
        this.marbles = []
        this.staticBodies = []
        this.staticEntities = []
        this.dynamicObjects = []
        this.checkpoints = []
        this.collectibles = []
        this.collectibleRotation = 0
        this.powerUps = []
        this.activeEffects = { speed: 0, jump: 0 }
        this.movingPlatforms = []
        this.rotatingPlatforms = []
        this.temporaryPlatforms = []
        this.holoDuration = 3000
        this.holoCooldown = 5000
        this.lastHoloTime = 0

        this.activeBombs = []
        this.lastBombTime = 0
        this.bombCooldown = 5000

        this.activeMissiles = []
        this.lastMissileTime = 0
        this.missileCooldown = 1500
        this.missileBarEl = document.getElementById('missilebar')
        this.missileBarContainerEl = document.getElementById('missilebar-container')

        this.activeBlackHoles = []
        this.lastBlackHoleTime = 0
        this.blackHoleCooldown = 5000
        this.blackHoleBarEl = document.getElementById('blackholebar')
        this.blackHoleBarContainerEl = document.getElementById('blackholebar-container')

        this.Filament = null
        this.material = null
        this.cubeMesh = null

        this.camAngle = 0
        this.camHeight = 10
        this.camRadius = 25

        this.keys = {}
        this.cameraMode = 'orbit'
        this.score = 0
        this.scoreEl = document.getElementById('score')
        this.comboEl = document.getElementById('combo')
        this.combobarContainerEl = document.getElementById('combobar-container')
        this.combobarEl = document.getElementById('combobar')
        this.combo = 1
        this.comboTimer = 0
        this.maxComboTime = 3000
        this.timerEl = document.getElementById('timer')
        this.levelNameEl = document.getElementById('level-name')
        this.selectedEl = document.getElementById('selected')
        this.aimEl = document.getElementById('aim')
        this.powerbarEl = document.getElementById('powerbar')
        this.jumpBarEl = document.getElementById('jumpbar')
        this.boostBarEl = document.getElementById('boostbar')
        this.dashBarEl = document.getElementById('dashbar')
        this.magnetBarEl = document.getElementById('magnetbar')
        this.focusBarEl = document.getElementById('focusbar')
        this.rewindBarEl = document.getElementById('rewindbar')
        this.gravityBarEl = document.getElementById('gravitybar')
        this.holobarEl = document.getElementById('holobar')
        this.holobarContainerEl = document.getElementById('holobar-container')
        this.bombBarEl = document.getElementById('bombbar')
        this.bombBarContainerEl = document.getElementById('bombbar-container')
        this.missileBarEl = document.getElementById('missilebar')
        this.missileBarContainerEl = document.getElementById('missilebar-container')

        // Size Shift Mechanic
        this.lastSizeShiftTime = 0
        this.sizeShiftCooldown = 1000
        this.sizebarEl = document.getElementById('sizebar')
        this.sizebarContainerEl = document.getElementById('sizebar-container')

        // Shield Mechanic
        this.shieldEnergy = 100
        this.maxShieldEnergy = 100
        this.shieldActive = false
        this.shieldbarEl = document.getElementById('shieldbar')
        this.shieldbarContainerEl = document.getElementById('shieldbar-container')

        // Teleport Mechanic
        this.lastTeleportTime = 0
        this.teleportCooldown = 5000
        this.teleportDistance = 15.0

        // Blink Mechanic
        this.lastBlinkTime = 0
        this.blinkCooldown = 2000
        this.blinkBarEl = document.getElementById('blinkbar')
        this.blinkBarContainerEl = document.getElementById('blinkbar-container')

        this.teleportBarEl = document.getElementById('teleportbar')
        this.teleportBarContainerEl = document.getElementById('teleportbar-container')

        // Glider Mechanic
        this.gliderEnergy = 100
        this.maxGliderEnergy = 100
        this.gliderActive = false
        this.gliderBarEl = document.getElementById('gliderbar')
        this.gliderBarContainerEl = document.getElementById('gliderbar-container')

        this.chameleonBarEl = document.getElementById('chameleonbar')
        this.chameleonBarContainerEl = document.getElementById('chameleonbar-container')
        this.hoverBarEl = document.getElementById('hoverbar')
        this.hoverBarContainerEl = document.getElementById('hoverbar-container')
        this.effectEl = document.getElementById('effects')
        this.currentMarbleIndex = 0
        this.aimYaw = 0
        this.jumpCharge = 0
        this.lastBoostTime = 0
        this.boostCooldown = 3000
        this.isChargingJump = false
        this.pitchAngle = 0
        this.chargePower = 0
        this.charging = false
        this.isAiming = false
        this.playerMarble = null
        this.lastDashTime = 0
        this.dashCooldown = 2000
        this.cueInst = null
        this.jumpCount = 0
        this.maxJumps = 2
        this.powerUpRotation = 0
        this.isStomping = false
        this.stompStartTime = 0
        this.trickState = { airTime: 0, spin: 0, wallRides: 0, highSpeed: 0, flips: 0, rolls: 0, wallBounces: 0 }

        this.isWallRiding = false
        this.wallRideTime = 0

        this.magnetPower = 1.0
        this.magnetActive = false
        this.magnetMode = null

        this.isGrappling = false
        this.grappleTarget = null
        this.grappleEntity = null
        this.grappleInst = null
        this.grappleMaxDist = 50.0
        this.grappleForce = 40.0

        // Sandbox Builder Mechanic
        this.buildEnergy = 100
        this.maxBuildEnergy = 100
        this.buildbarEl = document.getElementById('buildbar')
        this.buildbarContainerEl = document.getElementById('buildbar-container')

        // Focus / Time Slow Mechanic
        this.timeScale = 1.0
        this.focusEnergy = 100
        this.maxFocusEnergy = 100
        this.focusActive = false

        // Hover Mechanic
        this.hoverEnergy = 100
        this.maxHoverEnergy = 100
        this.hoverActive = false

        // Jetpack Mechanic
        this.jetpackEnergy = 100
        this.maxJetpackEnergy = 100
        this.jetpackActive = false
        this.jetpackbarEl = document.getElementById('jetpackbar')
        this.jetpackbarContainerEl = document.getElementById('jetpackbar-container')
        this.visualParticles = []

        // Frost Bridge Mechanic
        this.iceEnergy = 100
        this.maxIceEnergy = 100
        this.lastIceTime = 0
        this.iceCooldown = 150
        this.iceActive = false
        this.icebarEl = document.getElementById('icebar')
        this.icebarContainerEl = document.getElementById('icebar-container')

        // Phase Shift Mechanic
        this.phaseEnergy = 100
        this.maxPhaseEnergy = 100
        this.phaseActive = false
        this.phasebarEl = document.getElementById('phasebar')
        this.phasebarContainerEl = document.getElementById('phasebar-container')

        // Gravity Flip Mechanic
        this.flipEnergy = 100
        this.maxFlipEnergy = 100
        this.flipActive = false
        this.flipbarEl = document.getElementById('flipbar')
        this.flipbarContainerEl = document.getElementById('flipbar-container')

        // Vortex Mechanic
        this.vortexEnergy = 100
        this.maxVortexEnergy = 100
        this.vortexActive = false
        this.vortexbarEl = document.getElementById('vortexbar')
        this.vortexbarContainerEl = document.getElementById('vortexbar-container')

        // EMP Shockwave Mechanic
        this.empEnergy = 100
        this.maxEmpEnergy = 100
        this.empActive = false
        this.lastEmpTime = 0
        this.empCooldown = 3000
        this.empBarEl = document.getElementById('empbar')
        this.empBarContainerEl = document.getElementById('empbar-container')

        // Violet Light Mechanic
        this.violetEnergy = 100
        this.maxVioletEnergy = 100
        this.violetActive = false
        this.violetLightEntity = null
        this.violetbarEl = document.getElementById('violetbar')
        this.violetbarContainerEl = document.getElementById('violetbar-container')

        // Time Stop Mechanic
        this.timeStopEnergy = 100
        this.maxTimeStopEnergy = 100
        this.timeStopActive = false
        this.timeStopbarEl = document.getElementById('timestopbar')
        this.timeStopbarContainerEl = document.getElementById('timestopbar-container')
        this.timeStopSavedStates = new Map() // Store linear and angular velocity

        // Portal Mechanic
        this.portalA = null
        this.portalB = null
        this.lastPortalTeleportTime = 0
        this.portalCooldown = 500

        // Chameleon Mechanic
        this.chameleonState = 0
        this.lastChameleonTime = 0
        this.chameleonCooldown = 1000
        this.chameleonProfiles = [
            { name: 'Normal', color: [1, 1, 1], gravityScale: 1.0 },
            { name: 'Heavy', color: [0.2, 0.2, 0.2], gravityScale: 2.5 },
            { name: 'Bouncy', color: [1, 0.2, 0.8], gravityScale: 0.5 },
            { name: 'Floaty', color: [0.2, 0.8, 1.0], gravityScale: 0.1 }
        ]

        // Adrenaline Mechanic
        this.adrenaline = 0
        this.maxAdrenaline = 100
        this.baseFov = 45
        this.currentFov = 45
        this.cameraShake = { x: 0, y: 0, z: 0 }
        this.cameraFollowPos = null
        this.cameraFollowLookAt = null
        this.followDist = 20.0
        this.nearMisses = new Map()
        this.adrenalineBarEl = document.getElementById('adrenalinebar')
        this.adrenalineBarContainerEl = document.getElementById('adrenalinebar-container')

        // Rewind Mechanic
        this.rewindHistory = []
        this.isRewinding = false
        this.maxRewindFrames = 300 // 5 seconds at 60fps

        // Ghost Mechanic
        this.ghostRecording = []
        this.bestGhosts = {}
        this.ghostPlaybackIndex = 0
        this.ghostEntity = null
        this.ghostMaterialInstance = null
        this.ghostLightEntity = null

        this.currentLevel = null
        this.levelStartTime = 0
        this.levelComplete = false
        this.goalDefinitions = []
        this.checkpointDefinitions = []
        this.goalEffects = []

        // Gravity Pulse Mechanic
        this.gravityPulseCooldown = 5000
        this.lastGravityPulseTime = 0
        this.gravityPulseBarEl = document.getElementById('gravitypulsebar')
        this.gravityPulseBarContainerEl = document.getElementById('gravitypulsebar-container')

        // Gamepad State
        this.gamepadState = {}

        // Initialize HUD Manager
        this.hudManager = new HUDManager(this)
    }
}

// Apply all mixins
applyZoneMethods(MarblesGame);
applyInputMethods(MarblesGame);
applyInitMethods(MarblesGame);
applyZoneSetupMethods(MarblesGame);
applyPhysicsFactoryMethods(MarblesGame);
applyMarbleManagementMethods(MarblesGame);
applyGameLogicMethods(MarblesGame);
applyAbilityMethods(MarblesGame);
applyGameLoopMethods(MarblesGame);
applyGameLoopRenderMethods(MarblesGame);
applyGameLoopSyncMethods(MarblesGame);

window.game = new MarblesGame();
window.game.init().catch(err => {
    console.error('[FATAL] Game initialization failed:', err)
    const loading = document.getElementById('loading')
    const status = loading && loading.querySelector('.loading-status')
    if (status) status.textContent = 'Error: ' + err.message
    const spinner = loading && loading.querySelector('.loading-spinner')
    if (spinner) spinner.style.borderTopColor = '#ff4444'
});