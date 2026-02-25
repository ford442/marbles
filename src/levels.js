import { spaceStationLevel } from './space_station.js';
import { skateParkLevel } from './skate_park.js';

export const LEVELS = {
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
    space_station: spaceStationLevel,
    skate_park: skateParkLevel
};