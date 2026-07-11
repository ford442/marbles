/**
 * Campaign chapter layout and unlock rules.
 * Levels not listed explicitly are auto-assigned by heuristics.
 */

/** @typedef {{ id: string, name: string, icon: string, description: string, order: number }} ChapterDef */

/** @type {ChapterDef[]} */
export const CAMPAIGN_CHAPTERS = [
    {
        id: 'tutorial',
        name: 'Tutorial',
        icon: '📘',
        description: 'Learn movement and goals',
        order: 0,
    },
    {
        id: 'classic',
        name: 'Classic',
        icon: '🏛',
        description: 'Core runs and fundamentals',
        order: 1,
    },
    {
        id: 'neon',
        name: 'Neon',
        icon: '🌃',
        description: 'Synth tracks and cyber zones',
        order: 2,
    },
    {
        id: 'extreme',
        name: 'Extreme',
        icon: '🔥',
        description: 'Hard routes and hazards',
        order: 3,
    },
    {
        id: 'expert',
        name: 'Expert',
        icon: '👑',
        description: 'Master challenges',
        order: 4,
    },
];

/** Explicit level → chapter overrides (manifest JSON + key dev levels). */
export const LEVEL_CHAPTER_OVERRIDES = {
    tutorial: 'tutorial',
    tutorial_extreme: 'extreme',
    landing: 'tutorial',
    jump: 'classic',
    slalom: 'classic',
    slalom_extreme: 'extreme',
    staircase: 'classic',
    staircase_extreme: 'extreme',
    sandbox: 'classic',
    volcano_run: 'extreme',
    volcano_run_extreme: 'extreme',
    full_course: 'expert',
};

const NEON_KEYWORDS = /neon|cyber|synth|prismatic|plasma|pulse|chrono|grid_run|alley/i;
const EXTREME_KEYWORDS = /extreme|volcano|lava|storm|abyssal|void|toxic|magnetic|gravity_well|frostbite|glacial/i;

/**
 * @param {string} levelId
 * @param {{ difficulty?: string, name?: string }} [level]
 * @returns {string}
 */
export function getChapterForLevel(levelId, level = {}) {
    if (LEVEL_CHAPTER_OVERRIDES[levelId]) {
        return LEVEL_CHAPTER_OVERRIDES[levelId];
    }

    const id = levelId.toLowerCase();
    const name = (level.name || '').toLowerCase();
    const difficulty = level.difficulty || 'medium';

    if (id.includes('tutorial')) return 'tutorial';
    if (id === 'full_course' || difficulty === 'expert') return 'expert';
    if (id.endsWith('_extreme') || difficulty === 'extreme') return 'extreme';
    if (NEON_KEYWORDS.test(id) || NEON_KEYWORDS.test(name)) return 'neon';
    if (EXTREME_KEYWORDS.test(id) || EXTREME_KEYWORDS.test(name) || difficulty === 'hard') {
        return 'extreme';
    }
    if (difficulty === 'easy' && (id === 'landing' || id.includes('sandbox'))) {
        return id === 'landing' ? 'tutorial' : 'classic';
    }

    return 'classic';
}

/**
 * @typedef {{ type: 'always' } | { type: 'completeChapter', chapterId: string, minCompletions?: number } | { type: 'goldMedals', chapterId: string, count: number }} UnlockRule
 */

/** @type {Record<string, UnlockRule>} */
export const CHAPTER_UNLOCK_RULES = {
    tutorial: { type: 'always' },
    classic: { type: 'completeChapter', chapterId: 'tutorial', minCompletions: 1 },
    neon: { type: 'goldMedals', chapterId: 'classic', count: 2 },
    extreme: { type: 'goldMedals', chapterId: 'neon', count: 3 },
    expert: { type: 'goldMedals', chapterId: 'extreme', count: 3 },
};

/**
 * Build chapter → level id lists from the runtime catalog.
 * @param {Record<string, object>} levels
 * @returns {Record<string, string[]>}
 */
export function buildChapterLayout(levels) {
    /** @type {Record<string, string[]>} */
    const layout = Object.fromEntries(CAMPAIGN_CHAPTERS.map((c) => [c.id, []]));

    for (const levelId of Object.keys(levels)) {
        const chapterId = getChapterForLevel(levelId, levels[levelId]);
        if (!layout[chapterId]) layout[chapterId] = [];
        layout[chapterId].push(levelId);
    }

    for (const chapterId of Object.keys(layout)) {
        layout[chapterId].sort((a, b) => {
            const da = levels[a]?.difficulty || 'medium';
            const db = levels[b]?.difficulty || 'medium';
            const order = { easy: 0, medium: 1, hard: 2, expert: 3, extreme: 4 };
            return (order[da] ?? 1) - (order[db] ?? 1) || a.localeCompare(b);
        });
    }

    return layout;
}

/** Default medal thresholds when map JSON omits `medals`. */
export const DEFAULT_MEDALS_BY_DIFFICULTY = {
    easy: { goldTime: 30, silverTime: 60, bronzeTime: 120, parTime: 45 },
    medium: { goldTime: 45, silverTime: 90, bronzeTime: 180, parTime: 75 },
    hard: { goldTime: 60, silverTime: 120, bronzeTime: 240, parTime: 100 },
    expert: { goldTime: 90, silverTime: 180, bronzeTime: 300, parTime: 150 },
    extreme: { goldTime: 75, silverTime: 150, bronzeTime: 270, parTime: 120 },
};

/**
 * @param {{ medals?: object, difficulty?: string }} level
 */
export function getMedalThresholds(level) {
    if (level?.medals) return level.medals;
    const diff = level?.difficulty || 'medium';
    return DEFAULT_MEDALS_BY_DIFFICULTY[diff] || DEFAULT_MEDALS_BY_DIFFICULTY.medium;
}

/**
 * @param {number} timeSeconds
 * @param {{ goldTime: number, silverTime: number, bronzeTime: number }} thresholds
 * @returns {'gold' | 'silver' | 'bronze' | null}
 */
export function computeMedal(timeSeconds, thresholds) {
    if (timeSeconds <= thresholds.goldTime) return 'gold';
    if (timeSeconds <= thresholds.silverTime) return 'silver';
    if (timeSeconds <= thresholds.bronzeTime) return 'bronze';
    return null;
}

/** @param {'gold' | 'silver' | 'bronze' | null | undefined} medal */
export function medalEmoji(medal) {
    if (medal === 'gold') return '🥇';
    if (medal === 'silver') return '🥈';
    if (medal === 'bronze') return '🥉';
    return '—';
}

/** @param {'gold' | 'silver' | 'bronze' | null | undefined} medal */
export function medalRank(medal) {
    if (medal === 'gold') return 3;
    if (medal === 'silver') return 2;
    if (medal === 'bronze') return 1;
    return 0;
}

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatRunTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}
