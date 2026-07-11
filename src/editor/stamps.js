/**
 * Zone stamps available in the map editor palette.
 * Types must stay within assets/schemas/map-schema.json zone enum.
 */
export const EDITOR_STAMPS = [
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
    return zone;
}
