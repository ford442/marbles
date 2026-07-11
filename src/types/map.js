/**
 * @typedef {object} MapDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} version
 * @property {string} [author]
 * @property {'easy' | 'medium' | 'hard' | 'expert' | 'extreme'} [difficulty]
 * @property {Array<{ type: string, pos: { x: number, y: number, z: number }, size?: { x: number, y: number, z: number }, color?: number[], rotY?: number }>} zones
 * @property {{ x: number, y: number, z: number }} spawn
 * @property {Array<{ id: number, range: { x: [number, number], y: [number, number], z: [number, number] } }>} goals
 * @property {{ mode?: string, angle?: number, height?: number, radius?: number }} [camera]
 * @property {{ enabled?: string[], disabled?: string[] }} [abilities]
 * @property {string} [music]
 * @property {string[]} [ambientSounds]
 * @property {boolean} [nightMode]
 * @property {number[]} [backgroundColor]
 * @property {string} [environment]
 * @property {string} [colorGrade]
 * @property {unknown[]} [checkpoints]
 */

export {};
