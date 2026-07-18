/**
 * Zone stamps available in the map editor palette.
 * Types must match keys in src/zone-setup/registry.js (ZONE_HANDLERS).
 */
import { TRACK_CATALOG } from './track-catalog.js';

export const EDITOR_BUILTIN_STAMPS = [
    {
        id: 'floor',
        label: 'Floor Block',
        type: 'floor',
        icon: '▬',
        defaults: {
            size: { x: 8, y: 0.5, z: 8 },
            color: [0.35, 0.35, 0.4],
        },
    },
    {
        id: 'track',
        label: 'Ramp Track',
        type: 'track',
        icon: '╱',
        defaults: {},
    },
    {
        id: 'landing',
        label: 'Landing Pad',
        type: 'landing',
        icon: '▣',
        defaults: {},
    },
    {
        id: 'jump',
        label: 'Jump Pad',
        type: 'jump',
        icon: '⤒',
        defaults: {},
    },
    {
        id: 'slalom',
        label: 'Slalom',
        type: 'slalom',
        icon: '〰',
        defaults: {},
    },
    {
        id: 'staircase',
        label: 'Staircase',
        type: 'staircase',
        icon: '▤',
        defaults: {},
    },
    {
        id: 'goal',
        label: 'Goal Zone',
        type: 'goal',
        icon: '★',
        defaults: {
            color: [1.0, 0.84, 0.0],
        },
    },
];

/** Gameplay stamps beyond MVP built-ins. */
export const EDITOR_GAMEPLAY_STAMPS = [
    {
        id: 'checkpoint',
        label: 'Checkpoint',
        type: 'checkpoint',
        icon: '⛳',
        defaults: {
            size: { x: 6, y: 0.2, z: 2 },
        },
    },
    {
        id: 'collectible',
        label: 'Collectible',
        type: 'collectible',
        icon: '💎',
        defaults: {
            collectible: { kind: 'coin', value: 50 },
        },
    },
    {
        id: 'grapple_anchor',
        label: 'Grapple Anchor',
        type: 'grapple_anchor',
        icon: '🎯',
        defaults: {
            grappleAnchor: { id: 'a1', radius: 12 },
        },
    },
];

/** Factory zone stamps (procedural geometry; reference by type + pos only). */
export const EDITOR_FACTORY_STAMPS = [
    {
        id: 'storm_peak',
        label: 'Storm Peak',
        type: 'storm_peak',
        icon: '⛈',
        defaults: {},
    },
    {
        id: 'stellar_forge',
        label: 'Stellar Forge',
        type: 'stellar_forge',
        icon: '🔨',
        defaults: {},
    },
    {
        id: 'prismatic_speedway',
        label: 'Prismatic Speedway',
        type: 'prismatic_speedway',
        icon: '◈',
        defaults: {},
    },
    {
        id: 'space_station',
        label: 'Space Station',
        type: 'space_station',
        icon: '🛸',
        defaults: {},
    },
    {
        id: 'neon_grid',
        label: 'Neon Grid',
        type: 'neon_grid',
        icon: '▦',
        defaults: {},
    },
];

/** GLB model track stamps (one entry per catalog track). */
export const EDITOR_MODEL_STAMPS = TRACK_CATALOG.map((track) => ({
    id: `model_${track.id}`,
    label: track.label,
    type: 'model',
    icon: '🛤',
    trackId: track.id,
    defaults: {
        model: track.model,
        collider: track.collider || 'trimesh',
        materialPreset: track.materialPreset,
        lod: track.lod,
    },
}));

export const EDITOR_STAMPS = [
    ...EDITOR_BUILTIN_STAMPS,
    ...EDITOR_GAMEPLAY_STAMPS,
    ...EDITOR_MODEL_STAMPS,
    ...EDITOR_FACTORY_STAMPS,
];

/** @type {Record<string, typeof EDITOR_STAMPS[number]>} */
export const STAMP_BY_ID = Object.fromEntries(EDITOR_STAMPS.map((s) => [s.id, s]));

/**
 * @param {typeof EDITOR_STAMPS[number]} stamp
 * @param {{ x: number, y: number, z: number }} pos
 */
export function createZoneFromStamp(stamp, pos) {
    const zone = {
        type: stamp.type,
        pos: { ...pos },
    };
    if (stamp.defaults.size) zone.size = { ...stamp.defaults.size };
    if (stamp.defaults.color) zone.color = [...stamp.defaults.color];
    if (stamp.defaults.collectible) zone.collectible = { ...stamp.defaults.collectible };
    if (stamp.defaults.grappleAnchor) zone.grappleAnchor = { ...stamp.defaults.grappleAnchor };
    if (stamp.defaults.model) zone.model = stamp.defaults.model;
    if (stamp.defaults.collider) zone.collider = stamp.defaults.collider;
    if (stamp.defaults.materialPreset) zone.materialPreset = stamp.defaults.materialPreset;
    if (stamp.defaults.lod) zone.lod = stamp.defaults.lod.map((l) => ({ ...l }));
    return zone;
}
