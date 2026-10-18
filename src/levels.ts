import { skateParkLevel } from './zones/skate-park.js';
import { antigravityLevel } from './zones/antigravity-zone.js';

import type { RuntimeLevel } from './types/map.ts';

/** Code-only levels (experimental / not yet migrated to JSON). Shown when `?devLevels=1`. */
/**
 * Every DEV_LEVELS entry must say why it is not a shipped JSON map
 * (tests/levels/test_dev_levels_policy.js). New levels ship as JSON — see
 * docs/architecture/level-pipeline.md.
 */
const UNPROVEN = 'Builds cleanly and passes the static + smoke checks, but completability is unproven: the greedy autopilot does not finish it. Needs a v2 port with an authored solution.';
const GRAPPLE_ROUTE = 'Route needs the grapple, which the completability autopilot cannot drive yet.';
const RANDOM_LAYOUT = 'Layout is randomised per build (Math.random) and the greedy route fails on the seeded headless layout; needs a deterministic v2 port.';
const GRAVITY_MECHANIC = 'Route depends on gravity power-ups, which the headless harness does not collect or simulate; completability unproven.';
export const DEV_LEVELS: Record<string, any> = {
    plinko_obstacle: {
        devOnly: UNPROVEN,
        name: 'Plinko Obstacle Course',
        description: 'Navigate the slanted board full of pegs!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'plinko_obstacle', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: -5, z: 56 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-10, 10], z: [54, 58], y: [-7, -3] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    aether_core_run: {
        name: 'Aether Core Run',
        description: 'Navigate the glowing purple tracks and master the jump pads!',
        zones: [
            { type: 'aether_core', pos: { x: 0, y: 0, z: 0 } }
        ],
        spawn: { x: 0, y: 5, z: -30 },
        goals: [
            { id: 1, range: { x: [-10, 10], z: [105, 115], y: [5, 15] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.02, 0.1, 1.0],
        environment: 'space_nebula'
    },
    neon_hologram_run: {
        name: 'Neon Hologram',
        description: 'Navigate the icy cyan hologram track, dodge magenta blockers, and launch to the exit!',
        zones: [
            { type: 'neon_hologram', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: 10, z: 75 } }
        ],
        spawn: { x: 0, y: 5, z: -10 },
        goals: [
            { id: 1, range: { x: [-10, 10], z: [70, 80], y: [5, 15] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.02, 0.02, 0.05, 1.0],
        environment: 'neon_city'
    },
    neon_city_heights_run: {
        name: 'Neon City Heights',
        description: 'Navigate the neon platforms, low-friction purple track, and moving hover cars!',
        zones: [
            { type: 'neon_city_heights', pos: { x: 0, y: 0, z: 0 } }
        ],
        spawn: { x: 0, y: 5, z: -30 },
        goals: [
            { id: 1, range: { x: [-10, 10], z: [110, 120], y: [5, 15] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.01, 0.01, 0.05, 1.0],
        environment: 'neon_city'
    },
    cyber_reactor_run: {
        name: 'Cyber Reactor Run',
        description: 'Brave the icy track and jump across the glowing red reactor cores!',
        zones: [
            { type: 'cyber_reactor', pos: { x: 0, y: 0, z: 0 } }
        ],
        spawn: { x: 0, y: 5, z: -30 },
        goals: [
            { id: 1, range: { x: [-10, 10], z: [105, 115], y: [5, 15] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.05, 0.1, 1.0],
        environment: 'space_nebula'
    },
    crystal_cavern_run: {
        name: 'Crystal Cavern Run',
        description: 'Navigate the icy depths and dodge the glowing purple crystals!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 150 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'crystal_cavern', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: -3, z: 125 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-10, 10], z: [120, 130], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    staircase: {
        name: 'Stairway to Heaven',
        description: 'Climb the steps to victory',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 80, y: 0.5, z: 180 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'slalom', pos: { x: 0, y: -2, z: 85 } },
            { type: 'checkpoint', pos: { x: 0, y: -1.5, z: 110 }, size: { x: 10, y: 4, z: 2 } },
            { type: 'staircase', pos: { x: 0, y: -2, z: 110 } },
            { type: 'goal', pos: { x: 0, y: 9, z: 154 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-3, 3], z: [152, 156], y: [7, 15] } }
        ],
        camera: { mode: 'follow', height: 18, offset: -30 }
    },
    full_course: {
        name: 'Full Course',
        description: 'The complete challenge - all zones!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 50 }, size: { x: 100, y: 0.5, z: 200 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 32.5 }, color: [1, 0.84, 0] },
            { type: 'jump', pos: { x: 0, y: 0, z: 37.5 } },
            { type: 'slalom', pos: { x: 0, y: -2, z: 85 } },
            { type: 'goal', pos: { x: 0, y: -1.4, z: 100 }, color: [1, 0.84, 0] },
            { type: 'staircase', pos: { x: 0, y: -2, z: 110 } },
            { type: 'goal', pos: { x: 0, y: 9, z: 154 }, color: [1, 0.5, 0] }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [30.5, 34.5], y: [0, 2] } },
            { id: 2, range: { x: [-2, 2], z: [98, 102], y: [-2, 0] } },
            { id: 3, range: { x: [-3, 3], z: [152, 156], y: [7, 15] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    sandbox: {
        name: 'Sandbox',
        description: 'Open area to test all marbles',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 100, y: 0.5, z: 100 } }
        ],
        spawn: { x: 0, y: 5, z: 0 },
        goals: [],
        camera: { mode: 'orbit', angle: 0, height: 15, radius: 40 }
    },
    crystal_orchard: {
        devOnly: UNPROVEN,
        name: 'Crystal Orchard',
        description: 'Night falls on the glowing fruit trees',
        zones: [
            { type: 'orchard', center: { x: 0, y: -2, z: 0 }, radius: 60 }
        ],
        spawn: { x: 0, y: 3, z: 0 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [50, 60], y: [0, 10] } }
        ],
        camera: { mode: 'orbit', angle: 0, height: 20, radius: 50 },
        nightMode: true,
        backgroundColor: [0.02, 0.02, 0.08, 1.0]
    },
    spiral_madness: {
        devOnly: UNPROVEN,
        name: 'Spiral Madness',
        description: 'Dizzying heights!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 100, y: 0.5, z: 100 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'spiral', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 3.8, y: 18.7, z: 25.8 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
             { id: 1, range: { x: [1, 7], z: [23, 29], y: [16, 20] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    zigzag: {
        devOnly: UNPROVEN,
        name: 'ZigZag Challenge',
        description: 'Sharp turns ahead!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'zigzag', pos: { x: 0, y: 0, z: 25 } },
            { type: 'checkpoint', pos: { x: 0, y: 0, z: 38 }, size: { x: 10, y: 4, z: 2 } },
            { type: 'goal', pos: { x: 0, y: -2, z: 80 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        checkpoints: [
            { id: 1, range: { x: [-5, 5], z: [36, 40], y: [-2, 2] }, respawn: { x: 0, y: 5, z: 38 } }
        ],
        goals: [
            { id: 1, range: { x: [-5, 5], z: [78, 82], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    neon_dash: {
        devOnly: UNPROVEN,
        name: 'Neon Dash',
        description: 'Race through the glowing city!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 60, y: 0.5, z: 100 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'neon_city', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 4, z: 90 }, color: [0.0, 1.0, 1.0] }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-3, 3], z: [88, 92], y: [2, 6] } }
        ],
        camera: { mode: 'follow', height: 12, offset: -20 },
        nightMode: true,
        backgroundColor: [0.05, 0.05, 0.1, 1.0],
        environment: 'neon_city'
    },
    loop_challenge: {
        devOnly: UNPROVEN,
        name: 'Loop-the-Loop',
        description: 'Defy gravity!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'loop', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 60 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [58, 62], y: [0, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    pyramid_climb: {
        devOnly: UNPROVEN,
        name: 'Pyramid Climb',
        description: 'Ascend the ancient structure',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 60, y: 0.5, z: 60 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'pyramid', pos: { x: 0, y: 0, z: 35 } },
            { type: 'goal', pos: { x: 0, y: 6.5, z: 35 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [33, 37], y: [6, 10] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    powerup_park: {
        devOnly: UNPROVEN,
        name: 'Power-Up Park',
        description: 'Test your abilities with power-ups!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 60, y: 0.5, z: 80 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'powerup', pos: { x: 0, y: 0, z: 30 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 60 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [58, 62], y: [0, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    moving_madness: {
        devOnly: UNPROVEN,
        name: 'Moving Madness',
        description: 'Watch your step on these moving platforms!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 60, y: 0.5, z: 60 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'moving', pos: { x: 0, y: 0, z: 30 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 70 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [68, 72], y: [0, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    plinko_challenge: {
        devOnly: UNPROVEN,
        name: 'Plinko Challenge',
        description: 'Drop the marble and hope for the best!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'plinko', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: -4, z: 50 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-10, 10], z: [48, 52], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    water_slide: {
        devOnly: UNPROVEN,
        name: 'Water Slide',
        description: 'Slide down the curvy water slide!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'water_slide', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-50, 50], z: [80, 150], y: [-30, 10] } } // This will be adjusted after seeing the level
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: false
    },
    grapple_course_run: {
        devOnly: GRAPPLE_ROUTE,
        name: 'Grapple Course Run',
        description: 'Use the grapple hook (Right Click) and wall-ride to cross the void!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'grapple_course', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 150 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [145, 155], y: [-2, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.02, 0.05, 0.1, 1.0]
    },
    space_elevator: {
        devOnly: UNPROVEN,
        name: 'Space Elevator',
        description: 'Take the elevator to the top!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'space_elevator', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [35, 45], y: [50, 70] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    mystic_forest_run: {
        devOnly: UNPROVEN,
        name: 'Mystic Forest Run',
        description: 'Navigate the glowing forest!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'mystic_forest', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [115, 125], y: [-2, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.05, 0.1, 1.0]
    },
    cloud_city_run: {
        devOnly: UNPROVEN,
        name: 'Cloud City Run',
        description: 'Bounce across the clouds!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'cloud_city', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [115, 125], y: [-2, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: false
    },
    desert_ruins_run: {
        devOnly: UNPROVEN,
        name: 'Desert Ruins Run',
        description: 'Navigate through ancient ruins and dodging falling blocks!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'desert_ruins', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [100, 110], y: [-2, 3] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: false
    },
    ice_bridges_run: {
        devOnly: UNPROVEN,
        name: 'Ice Bridges Run',
        description: 'Cross the slippery, spinning ice bridges!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'ice_bridges', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            // The exit platform and goal stamp sit at z 95 (ice-bridges.js).
            { id: 1, range: { x: [-5, 5], z: [90, 100], y: [0, 4] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    lava_tubes_run: {
        devOnly: UNPROVEN,
        name: 'Lava Tubes Run',
        description: 'Navigate the treacherous lava tubes!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'lava_tubes', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [95, 105], y: [-2, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    starlight_ascent_run: {
        devOnly: UNPROVEN,
        name: 'Starlight Ascent Run',
        description: 'Ascend the glowing platforms to the starry exit!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'starlight_ascent', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [100, 115], y: [10, 25] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.02, 0.02, 0.08, 1.0],
        environment: 'space_nebula'
    },
    quantum_leap_run: {
        devOnly: UNPROVEN,
        name: 'Quantum Leap Run',
        description: 'Leap across the volatile quantum platforms!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'quantum_leap', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [110, 130], y: [18, 25] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.01, 0.05, 1.0]
    },
    glacial_chasm_run: {
        devOnly: UNPROVEN,
        name: 'Glacial Chasm Run',
        description: 'Navigate the treacherous ice bridges!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'glacial_chasm', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0, z: 100 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [95, 105], y: [-2, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.1, 0.2, 1.0],
        environment: 'ice'
    },
    frostbite_cavern_run: {
        devOnly: UNPROVEN,
        name: 'Frostbite Cavern Run',
        description: 'Slide down the icy slopes and navigate moving floes!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'frostbite_cavern', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: -4, z: 80 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [75, 85], y: [-6, 0] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.1, 0.2, 1.0],
        environment: 'ice'
    },
    magnetic_canyon_run: {
        devOnly: UNPROVEN,
        name: 'Magnetic Canyon Run',
        description: 'Navigate the icy paths and magnetic floating platforms!',
        zones: [
            { type: 'magnetic_canyon', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -1, z: 80 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [75, 85], y: [-3, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    magnetic_cavern_run: {
        devOnly: UNPROVEN,
        name: 'Magnetic Cavern Run',
        description: 'Navigate the icy paths and magnetic floating platforms in the cavern!',
        zones: [
            { type: 'magnetic_cavern', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -1, z: 80 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [75, 85], y: [-3, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.05, 0.15, 1.0]
    },
    gravity_well_run: {
        devOnly: RANDOM_LAYOUT,
        name: 'Gravity Well',
        description: 'Navigate the icy funnel without falling into the core!',
        zones: [
            { type: 'gravity_well', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -1, z: 50 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [45, 55], y: [-3, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.02, 0.05, 0.08, 1.0]
    },
    neon_plunge_run: {
        devOnly: UNPROVEN,
        name: 'Neon Plunge Run',
        description: 'A steep neon dive with moving platforms.',
        zones: [
            { type: 'neon_plunge', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -20, z: 120 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [115, 125], y: [-25, -15] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.01, 0.0, 0.05, 1.0],
        environment: 'neon_city'
    },
    cyber_ice_track_run: {
        devOnly: UNPROVEN,
        name: 'Cyber Ice Track',
        description: 'Navigate low friction ice and dodging platforms!',
        zones: [
            { type: 'cyber_ice_track', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -1, z: 120 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [115, 125], y: [-3, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.0, 0.05, 0.1, 1.0],
        environment: 'ice'
    },
    neon_alley_run: {
        devOnly: UNPROVEN,
        name: 'Neon Alley Run',
        description: 'Navigate the high speed neon icy slide and dodging laser sweepers!',
        zones: [
            { type: 'neon_alley', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -4, z: 50 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [45, 55], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.01, 0.0, 0.05, 1.0],
        environment: 'neon_city'
    },
    chrono_canyon_run: {
        devOnly: UNPROVEN,
        name: 'Chrono Canyon Run',
        description: 'Navigate the high friction sands and erratic time-distorted platforms!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'chrono_canyon', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: -1, z: 140 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [135, 145], y: [-3, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.08, 0.03, 0.05, 1.0]
    },
    synthwave_surge_run: {
        devOnly: UNPROVEN,
        name: 'Synthwave Surge',
        description: 'Ride the neon ice and dodge the moving platforms!',
        zones: [
            { type: 'synthwave_surge', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -2, z: 120 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [115, 125], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.01, 0.08, 1.0],
        environment: 'neon_city'
    },
    radiant_reactor_run: {
        devOnly: UNPROVEN,
        name: 'Radiant Reactor',
        description: 'Navigate the hazardous coolant pool and dodge the active reactor rods!',
        zones: [
            { type: 'radiant_reactor', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -2, z: 80 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [75, 85], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.01, 0.05, 0.02, 1.0],
        environment: 'volcanic'
    },
    plasma_pipeline_run: {
        devOnly: UNPROVEN,
        name: 'Plasma Pipeline',
        description: 'Navigate the cyan ice track and alternating moving platforms!',
        zones: [
            { type: 'plasma_pipeline', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -3, z: 115 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [110, 120], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.0, 0.05, 0.1, 1.0],
        environment: 'neon_city'
    },
    neon_pulse_grid_run: {
        devOnly: UNPROVEN,
        name: 'Neon Pulse Grid',
        description: 'Slide through the dark grid and avoid the glowing pulse walls!',
        zones: [
            { type: 'neon_pulse_grid', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -2, z: 80 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [75, 85], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.0, 0.1, 1.0],
        environment: 'neon_city'
    },
    nebula_nexus_run: {
        devOnly: UNPROVEN,
        name: 'Nebula Nexus',
        description: 'Navigate the low friction ice track and vertical moving platforms!',
        zones: [
            { type: 'nebula_nexus', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -2, z: 120 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [115, 125], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.0, 0.1, 1.0],
        environment: 'space_nebula'
    },
    quantum_tunnel_run: {
        devOnly: UNPROVEN,
        name: 'Quantum Tunnel',
        description: 'Navigate the twisting translucent paths and quantum shifting obstacles!',
        zones: [
            { type: 'quantum_tunnel', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -2, z: 120 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [115, 125], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.0, 0.1, 1.0],
        environment: 'space_nebula'
    },
    void_station_run: {
        devOnly: UNPROVEN,
        name: 'Void Station Run',
        description: 'Navigate the zero-G glass track and void rings!',
        zones: [
            { type: 'void_station', pos: { x: 0, y: 0, z: 0 } },
            { type: 'goal', pos: { x: 0, y: -2, z: 60 } }
        ],
        spawn: { x: 0, y: 5, z: -5 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [55, 65], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.01, 0.0, 0.05, 1.0],
        environment: 'space_nebula'
    },
    skate_park: { ...skateParkLevel, devOnly: UNPROVEN },
    antigravity_chamber: { ...antigravityLevel, devOnly: GRAVITY_MECHANIC },
};
