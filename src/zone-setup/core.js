import { createMushroomBounceZone } from '../mushroom_bounce_zone.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { createSphere } from '../sphere.js';
import { createSpaceStationZone } from '../space_station.js';
import { createSkateParkZone } from '../skate_park.js';
import { createHelixZone } from '../helix_zone.js';
import { createPinballZone } from '../pinball_zone.js';
import { createClockworkZone } from '../clockwork_zone.js';
import { createBumperArenaZone } from '../bumper_arena.js';
import { createPinwheelAlleyZone } from '../pinwheel_alley.js';
import { createPlinkoZone } from '../plinko_zone.js';
import { createPlinkoObstacleZone } from '../plinko_obstacle_zone.js';
import { createCanyonRunZone } from '../canyon_run.js';
import { createVolcanoZone } from '../volcano_zone.js';
import { createWindTunnelZone } from '../wind_tunnel_zone.js';
import { createCyberTrackZone } from '../cyber_track_zone.js';
import { createWaterSlideZone } from '../water_slide_zone.js';
import { createGrappleCourseZone } from '../grapple_course_zone.js';
import { createIceCaveZone } from '../ice_cave_zone.js';
import { createAntigravityZone } from '../antigravity_zone.js';
import { createTrampolineParkZone } from '../zones/trampoline-park.js';
import { createSpaceElevatorZone } from '../zones/space-elevator.js';
import { createMysticForestZone } from '../zones/mystic-forest.js';
import { createCloudCityZone } from '../zones/cloud-city.js';
import { createDesertRuinsZone } from '../zones/desert-ruins.js';
import { createNeonGridZone } from '../zones/neon-grid.js';
import { createIceBridgesZone } from '../zones/ice-bridges.js';
import { createJungleRunZone } from '../zones/jungle-run.js';
import { createLavaTubesZone } from '../zones/lava-tubes.js';
import { createStarlightAscentZone } from '../zones/starlight-ascent.js';
import { createZenGardenZone } from '../zones/zen-garden.js';
import { createToxicSwampZone } from '../zones/toxic-swamp.js';
import { createGalaxySpiralZone } from '../zones/galaxy-spiral.js';
import { createGlacialChasmZone } from '../zones/glacial-chasm.js';
import { createQuantumLeapZone } from '../zones/quantum-leap.js';
import { createFrostbiteCavernZone } from '../zones/frostbite-cavern.js';
import { createMagneticCanyonZone } from '../zones/magnetic-canyon.js';
import { createMagneticCavernZone } from '../zones/magnetic-cavern.js';
import { createGravityWellZone } from '../zones/gravity-well.js';
import { createCyberIceTrackZone } from '../zones/cyber-ice-track.js';
import { createChronoCanyonZone } from '../zones/chrono-canyon.js';
import { createNeonAlleyZone } from '../zones/neon-alley.js';
import { createSynthwaveSurgeZone } from '../zones/synthwave-surge.js';
import { createMeteoriteHollowZone } from '../zones/meteorite-hollow.js';
import { createRadiantReactorZone } from "../zones/radiant-reactor.js";
import { createPlasmaPipelineZone } from "../zones/plasma-pipeline.js";
import { createNeonPulseGridZone } from "../zones/neon-pulse-grid.js";
import { createNebulaNexusZone } from "../zones/nebula-nexus.js";
import { createQuantumTunnelZone } from '../zones/quantum-tunnel.js';
import { CUBE_VERTICES, CUBE_INDICES } from '../cube-geometry.js';
import { audio } from '../audio.js';
import { DEFAULT_MSAA_SAMPLE_COUNT, getPostFxQualityFlags, getShadowQualityConfig } from '../rendering-defaults.js';
import { getBloomQualityConfig, getSsaoQualityConfig, getVignetteConfig, getColorGradingConfig, getEnvironmentColorGradingPreset, getFogQualityConfig, getEnvironmentFogPreset } from '../rendering/post-fx-presets.js';
import {
    buildEnvironmentLighting,
    destroyEnvironmentLighting,
    destroyEnvironmentWithCubemaps,
    upgradeEnvironmentWithCubemap,
    CUBEMAP_QUALITY_LEVELS,
    ENVIRONMENT_PRESETS,
} from '../rendering/environment.js';

export class ZoneSetupCore {
    async createZone(zone) {
        const pos = zone.pos || { x: 0, y: 0, z: 0 }
        const offset = { x: pos.x, y: pos.y, z: pos.z }

        switch (zone.type) {
            case 'floor':
                this.createFloorZone(offset, zone.size)
                break
            case 'track':
                this.createTrackZone(offset)
                break
            case 'landing':
                this.createLandingZone(offset)
                break
            case 'jump':
                this.createJumpZone(offset)
                break
            case 'slalom':
                this.createSlalomZone(offset)
                break
            case 'staircase':
                this.createStaircaseZone(offset)
                break
            case 'split':
                this.createSplitZone(offset)
                break
            case 'forest':
                this.createForestZone(offset)
                break
            case 'goal':
                this.createGoalZone(offset, zone.color)
                break
            case 'orchard':
                this.createOrchardZone(zone.center, zone.radius)
                break
            case 'spiral':
                this.createSpiralZone(offset)
                break
            case 'zigzag':
                this.createZigZagZone(offset)
                break
            case 'pinwheel_alley':
                createPinwheelAlleyZone(this, offset)
                break
            case 'plinko':
                createPlinkoZone(this, offset)
                break;
            case 'plinko_obstacle':
                createPlinkoObstacleZone(this, offset)
                break;
            case 'neon_city':
                this.createNeonCityZone(offset)
                break
            case 'loop':
                this.createLoopZone(offset)
                break
            case 'block':
                this.createBlockZone(offset)
                break
            case 'bowling':
                this.createBowlingZone(offset)
                break
            case 'castle':
                this.createCastleZone(offset)
                break
            case 'checkpoint':
                this.createCheckpointZone(offset, zone.size)
                break
            case 'domino':
                this.createDominoZone(offset)
                break
            case 'pyramid':
                this.createPyramidZone(offset)
                break
            case 'powerup':
                this.createPowerUpZone(offset)
                break
            case 'space_station':
                createSpaceStationZone(this, offset)
                break
            case 'skate_park':
                createSkateParkZone(this, offset)
                break
            case 'helix':
                createHelixZone(this, offset)
                break
            case 'pinball':
                createPinballZone(this, offset)
                break
            case 'moving':
                this.createMovingZone(offset)
                break
            case 'clockwork':
                createClockworkZone(this, offset)
                break
            case 'bumper_arena':
                createBumperArenaZone(this, offset)
                break
            case 'canyon_run':
                createCanyonRunZone(this, offset)
                break
            case 'volcano':
                createVolcanoZone(this, offset)
                break
            case 'mushroom_bounce':
                createMushroomBounceZone(this, offset)
                break
            case 'wind_tunnel':
                createWindTunnelZone(this, offset)
                break
            case 'cyber_track':
                createCyberTrackZone(this, offset)
                break
            case 'water_slide':
                createWaterSlideZone(this, offset)
                break
            case 'grapple_course':
                createGrappleCourseZone(this, offset)
                break
            case 'ice_cave':
                createIceCaveZone(this, offset)
                break
            case 'antigravity':
                createAntigravityZone(this, offset)
                break
            case 'trampoline_park':
                createTrampolineParkZone(this, offset)
                break
            case 'space_elevator':
                createSpaceElevatorZone(this, offset)
                break
            case 'mystic_forest':
                createMysticForestZone(this, offset)
                break
            case 'cloud_city':
                createCloudCityZone(this, offset)
                break
            case 'desert_ruins':
                createDesertRuinsZone(this, offset)
                break
            case 'neon_grid':
                createNeonGridZone(this, offset)
                break
            case 'ice_bridges':
                createIceBridgesZone(this, offset)
                break
            case 'jungle_run':
                createJungleRunZone(this, offset)
                break
            case 'lava_tubes':
                createLavaTubesZone(this, offset)
                break
            case 'quantum_leap':
                createQuantumLeapZone(this, offset)
                break
            case 'frostbite_cavern':
                createFrostbiteCavernZone(this, offset)
                break
            case 'magnetic_canyon':
                createMagneticCanyonZone(this, offset)
                break
            case 'magnetic_cavern':
                createMagneticCavernZone(this, offset)
                break
            case 'gravity_well':
                createGravityWellZone(this, offset)
                break
            case 'cyber_ice_track':
                createCyberIceTrackZone(this, offset)
                break
            case 'neon_alley':
                createNeonAlleyZone(this, offset)
                break
            case 'chrono_canyon':
                createChronoCanyonZone(this, offset)
                break
            case 'synthwave_surge':
                createSynthwaveSurgeZone(this, offset)
                break
            case 'meteorite_hollow':
                createMeteoriteHollowZone(this, offset)
                break
            case 'radiant_reactor':
                createRadiantReactorZone(this, offset)
                break
            case 'plasma_pipeline':
                createPlasmaPipelineZone(this, offset)
                break
            case 'starlight_ascent':
                createStarlightAscentZone(this, offset)
                break
            case 'zen_garden':
                createZenGardenZone(this, offset)
                break
            case 'toxic_swamp':
                createToxicSwampZone(this, offset)
                break
            case 'galaxy_spiral':
                createGalaxySpiralZone(this, offset)
                break
            case 'glacial_chasm':
                createGlacialChasmZone(this, offset)
                break
            case 'neon_pulse_grid':
                createNeonPulseGridZone(this, offset)
                break
            case 'nebula_nexus':
                createNebulaNexusZone(this, offset)
                break
            case 'quantum_tunnel':
                createQuantumTunnelZone(this, offset)
                break
            case 'abyssal_trench':
                createAbyssalTrenchZone(this, offset)
                break
        }
    }
}

export function applyZoneSetupCore(targetClass) {
    for (const name of Object.getOwnPropertyNames(ZoneSetupCore.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = ZoneSetupCore.prototype[name];
        }
    }
}
import { createAbyssalTrenchZone } from '../zones/abyssal-trench.js';
