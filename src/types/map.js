/**
 * @typedef {object} MapZoneDefinition
 * @property {string} type
 * @property {{ x: number, y: number, z: number }} pos
 * @property {{ x: number, y: number, z: number }} [size]
 * @property {number[]} [color]
 * @property {number} [rotY]
 * @property {number} [friction]
 * @property {number} [restitution]
 * @property {number} [slope]
 * @property {number} [boostForce]
 * @property {string} [model]
 * @property {'trimesh' | 'convexHull' | 'none'} [collider]
 * @property {number} [scale]
 * @property {string} [materialPreset]
 * @property {Array<{ model: string, distance: number }>} [lod]
 * @property {{ axis?: 'horizontal' | 'vertical' | 'circular', amplitude?: number, speed?: number, phase?: number }} [kinematic]
 * @property {{ kind?: string, value?: number }} [collectible]
 * @property {{ id?: string, radius?: number }} [grappleAnchor]
 * @property {number} [checkpoint]
 */

/**
 * @typedef {object} MapDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} version
 * @property {string} [author]
 * @property {'easy' | 'medium' | 'hard' | 'expert' | 'extreme'} [difficulty]
 * @property {'tutorial' | 'classic' | 'neon' | 'extreme' | 'expert'} [chapter]
 * @property {MapZoneDefinition[]} zones
 * @property {{ x: number, y: number, z: number }} spawn
 * @property {Array<{ id: number, range: { x: [number, number], y: [number, number], z: [number, number] } }>} goals
 * @property {{ mode?: string, angle?: number, height?: number, radius?: number, offset?: number }} [camera]
 * @property {{ enabled?: string[], disabled?: string[] }} [abilities]
 * @property {string} [music]
 * @property {string[]} [ambientSounds]
 * @property {boolean} [nightMode]
 * @property {number[]} [backgroundColor]
 * @property {'default' | 'space_nebula' | 'ice' | 'volcanic' | 'neon_city' | 'underwater'} [environment]
 * @property {string} [colorGrade]
 * @property {string[]} [behaviors]
 * @property {Array<{ id?: number, pos?: { x: number, y: number, z: number }, range?: object }>} [checkpoints]
 * @property {{ goldTime?: number, silverTime?: number, bronzeTime?: number, parTime?: number }} [medals]
 * @property {number} [collectiblesTotal]
 */

export {};
