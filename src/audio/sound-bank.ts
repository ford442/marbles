/**
 * Loads sound definitions from AssetRegistry and caches decoded buffers (or synthesis profiles).
 */

import { resolveAssetUrl } from '../assets/AssetRegistry.js';
import type { SoundSchema } from '../types/generated/sound-schema.ts';
import type { CollisionMatrix } from './collision-matrix.ts';

const SYNTH_PROFILES = new Set([
    'wood', 'metal', 'concrete', 'glass', 'rubber',
]);

/** A sound definition from `assets/sounds/*.json`. */
export type SoundDef = SoundSchema;

/** The part of `AssetRegistry` the sound bank reads. */
export interface SoundBankSource {
    getAllSounds(): readonly SoundDef[];
}

export interface SoundBank {
    sounds: Map<string, SoundDef>;
    buffers: Map<string, AudioBuffer>;
    matrix: CollisionMatrix | null;
}

/** Playback/trigger properties of a sound def with their defaults applied. */
export interface SoundProperties {
    volume: number;
    pitchMin: number;
    pitchMax: number;
    loop: boolean;
    spatial: boolean;
    maxDistance: number;
    cooldown: number;
    threshold: number;
}

/**
 * `synthesis.profile` of a sound def. `synthesis` is not part of the sound
 * schema (it falls under the schema's open index signature), so it is read
 * defensively.
 */
export function getSynthesisProfile(def: SoundDef | null | undefined): string | undefined {
    const synthesis = def?.synthesis;
    if (typeof synthesis !== 'object' || synthesis === null || !('profile' in synthesis)) return undefined;
    const profile = synthesis.profile;
    return typeof profile === 'string' ? profile : undefined;
}

export async function loadSoundBank(registry: SoundBankSource): Promise<SoundBank> {
    const sounds = new Map<string, SoundDef>();
    const buffers = new Map<string, AudioBuffer>();

    let matrix: CollisionMatrix | null = null;
    try {
        const matrixUrl = resolveAssetUrl('audio/collision_matrix.json');
        const res = await fetch(matrixUrl);
        if (res.ok) matrix = await res.json();
    } catch {
        /* optional */
    }

    for (const def of registry.getAllSounds()) {
        sounds.set(def.id, def);

        if (getSynthesisProfile(def)) {
            continue;
        }

        const fileEntry = pickWeightedFile(def.files);
        if (!fileEntry?.path) continue;

        const url = resolveAssetUrl(fileEntry.path);

        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const arrayBuffer = await response.arrayBuffer();
            const ctx = new OfflineAudioContext(1, 1, 44100);
            const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
            buffers.set(def.id, buffer);
        } catch {
            /* missing file — synthesis fallback at runtime */
        }
    }

    return { sounds, buffers, matrix };
}

function pickWeightedFile<F extends { path?: string; weight?: number }>(files: readonly F[] | undefined): F | null {
    if (!files?.length) return null;
    let total = 0;
    for (const f of files) total += f.weight ?? 1;
    let roll = Math.random() * total;
    for (const f of files) {
        roll -= f.weight ?? 1;
        if (roll <= 0) return f;
    }
    return files[0] ?? null;
}

export function getSoundDef(sounds: Map<string, SoundDef>, soundId: string): SoundDef | null {
    return sounds.get(soundId) || null;
}

/**
 * Resolve synthesis profile from sound def or id pattern collision_<profile>.
 */
export function resolveSynthesisProfile(def: SoundDef | null, soundId: string): string {
    const declared = getSynthesisProfile(def);
    if (declared && SYNTH_PROFILES.has(declared)) {
        return declared;
    }
    const match = /^collision_(.+)$/.exec(soundId)?.[1];
    if (match && SYNTH_PROFILES.has(match)) return match;
    const rollMatch = /^roll_(.+)$/.exec(soundId)?.[1];
    if (rollMatch && SYNTH_PROFILES.has(rollMatch)) return rollMatch;
    return 'concrete';
}

export function soundProperties(def: SoundDef | null): SoundProperties {
    const p: NonNullable<SoundDef['properties']> = def?.properties || {};
    return {
        volume: p.volume ?? 0.7,
        pitchMin: p.pitchMin ?? 0.95,
        pitchMax: p.pitchMax ?? 1.05,
        loop: !!p.loop,
        spatial: !!p.spatial,
        maxDistance: p.maxDistance ?? 40,
        cooldown: def?.trigger?.cooldown ?? 0.08,
        threshold: def?.trigger?.threshold ?? 0.5,
    };
}
