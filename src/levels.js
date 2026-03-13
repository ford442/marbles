import { spaceStationLevel } from './space_station.js';
import { skateParkLevel } from './skate_park.js';
import { pinballLevel } from './pinball_zone.js';
import { canyonRunLevel } from './canyon_run.js';

export const LEVELS = {
    wind_tunnel: {
        name: 'Wind Tunnel',
        description: 'Navigate through the giant fans!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'wind_tunnel', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 70 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [65, 75], y: [-1, 3] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    plinko_obstacle: {
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
    tutorial: {
        name: 'Tutorial Ramp',
        description: 'Learn the basics on a simple ramp',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 32.5 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [30.5, 34.5], y: [0, 2] } }
        ],
        camera: { mode: 'orbit', angle: 0, height: 10, radius: 25 }
    },
    landing: {
        name: 'Landing Zone',
        description: 'Navigate around pillars',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 32.5 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [30.5, 34.5], y: [0, 2] } }
        ],
        camera: { mode: 'orbit', angle: 0, height: 12, radius: 30 }
    },
    jump: {
        name: 'The Jump',
        description: 'Make the big leap!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 60, y: 0.5, z: 80 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'jump', pos: { x: 0, y: 0, z: 37.5 } },
            { type: 'goal', pos: { x: 0, y: -1.4, z: 63 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [61, 65], y: [-3, -1] } }
        ],
        camera: { mode: 'follow', height: 12, offset: -20 }
    },
    slalom: {
        name: 'Slalom Challenge',
        description: 'Weave through the pillars',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 60, y: 0.5, z: 120 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'slalom', pos: { x: 0, y: -2, z: 85 } },
            { type: 'goal', pos: { x: 0, y: -1.4, z: 100 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [98, 102], y: [-2, 0] } }
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
        backgroundColor: [0.05, 0.05, 0.1, 1.0]
    },
    loop_challenge: {
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
    block_challenge: {
        name: 'Block Challenge',
        description: 'Navigate through the obstacle course',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'block', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 50 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [48, 52], y: [0, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    bowling_alley: {
        name: 'Bowling Alley',
        description: 'Knock down the pins!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'bowling', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 55 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-10, 10], z: [53, 57], y: [0, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    castle_siege: {
        name: 'Castle Siege',
        description: 'Storm the castle!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'castle', pos: { x: 0, y: 0, z: 35 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 65 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [63, 67], y: [0, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    domino_effect: {
        name: 'Domino Effect',
        description: 'Set off the chain reaction!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'domino', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 60 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [58, 62], y: [0, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    pyramid_climb: {
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
    helix_havoc: {
        name: 'Helix Havoc',
        description: 'Spiral down the double helix!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 80, y: 0.5, z: 80 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'helix', pos: { x: 0, y: 0, z: 30 } },
            { type: 'goal', pos: { x: 0, y: 44, z: 30 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [25, 35], y: [42, 46] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    clockwork_chaos: {
        name: 'Clockwork Chaos',
        description: 'Jump across the rotating gears!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'clockwork', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 4, z: 100 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [98, 102], y: [3, 7] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    plinko_challenge: {
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
    bumper_arena: {
        name: 'Bumper Arena',
        description: 'Navigate through the bouncy obstacles!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'bumper_arena', pos: { x: 0, y: 0, z: 30 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 60 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [58, 62], y: [0, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    pinwheel_alley: {
        name: 'Pinwheel Alley',
        description: 'Dodge the sweeping arms and cross the spinning pinwheels!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'pinwheel_alley', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 3.25, z: 105 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [103, 107], y: [3, 8] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    volcano_run: {
        name: 'Volcano Run',
        description: 'Cross the glowing lava pit!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'volcano', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 70 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [65, 75], y: [-1, 3] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.0, 0.0, 1.0]
    },
    cyber_run: {
        name: 'Cyber Run',
        description: 'Race across the neon tracks and dodge the lasers!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'cyber_track', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: -0.75, z: 85 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [80, 90], y: [-2, 2] } }
        ],
        camera: { mode: 'follow', height: 12, offset: -20 },
        nightMode: true,
        backgroundColor: [0.05, 0.05, 0.1, 1.0]
    },
    water_slide: {
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
    ice_cave_run: {
        name: 'Ice Cave',
        description: 'Navigate the slippery slopes and rotating ice platforms!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'ice_cave', pos: { x: 0, y: 0, z: 25 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [95, 110], y: [-10, 0] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 },
        nightMode: true,
        backgroundColor: [0.05, 0.1, 0.2, 1.0]
    },
    space_station: spaceStationLevel,
    skate_park: skateParkLevel,
    pinball_wizard: pinballLevel,
    canyon_run: canyonRunLevel
};