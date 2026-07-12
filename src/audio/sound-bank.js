/**
 * Loads sound definitions from AssetRegistry and caches decoded buffers (or synthesis profiles).
 */

const SYNTH_PROFILES = new Set([
    'wood', 'metal', 'concrete', 'glass', 'rubber',
]);

/**
 * @param {import('../assets/AssetRegistry.js').AssetRegistry} registry
 */
export async function loadSoundBank(registry) {
    /** @type {Map<string, object>} */
    const sounds = new Map();
    /** @type {Map<string, AudioBuffer>} */
    const buffers = new Map();

    let matrix = null;
    try {
        const matrixUrl = 'assets/audio/collision_matrix.json';
        const res = await fetch(matrixUrl);
        if (res.ok) matrix = await res.json();
    } catch {
        /* optional */
    }

    for (const def of registry.getAllSounds()) {
        sounds.set(def.id, def);

        if (def.synthesis?.profile) {
            continue;
        }

        const fileEntry = pickWeightedFile(def.files);
        if (!fileEntry?.path) continue;

        const url = fileEntry.path.startsWith('assets/')
            ? fileEntry.path
            : `assets/${fileEntry.path}`;

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

/**
 * @param {Array<{ path?: string, weight?: number }> | undefined} files
 */
function pickWeightedFile(files) {
    if (!files?.length) return null;
    let total = 0;
    for (const f of files) total += f.weight ?? 1;
    let roll = Math.random() * total;
    for (const f of files) {
        roll -= f.weight ?? 1;
        if (roll <= 0) return f;
    }
    return files[0];
}

/**
 * @param {Map<string, object>} sounds
 * @param {string} soundId
 */
export function getSoundDef(sounds, soundId) {
    return sounds.get(soundId) || null;
}

/**
 * Resolve synthesis profile from sound def or id pattern collision_<profile>.
 * @param {object | null} def
 * @param {string} soundId
 */
export function resolveSynthesisProfile(def, soundId) {
    if (def?.synthesis?.profile && SYNTH_PROFILES.has(def.synthesis.profile)) {
        return def.synthesis.profile;
    }
    const match = /^collision_(.+)$/.exec(soundId);
    if (match && SYNTH_PROFILES.has(match[1])) return match[1];
    const rollMatch = /^roll_(.+)$/.exec(soundId);
    if (rollMatch && SYNTH_PROFILES.has(rollMatch[1])) return rollMatch[1];
    return 'concrete';
}

/**
 * @param {object | null} def
 */
export function soundProperties(def) {
    const p = def?.properties || {};
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
