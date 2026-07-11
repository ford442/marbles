import {
    CAMPAIGN_CHAPTERS,
    CHAPTER_UNLOCK_RULES,
    buildChapterLayout,
    computeMedal,
    getChapterForLevel,
    getMedalThresholds,
    medalRank,
} from '../../levels/campaign.js';

export const CAMPAIGN_STORAGE_KEY = 'marbles3d_campaign';
const SAVE_VERSION = 1;

/**
 * @typedef {object} LevelProgress
 * @property {boolean} completed
 * @property {number} [bestTime]
 * @property {'gold' | 'silver' | 'bronze' | null} [medal]
 * @property {number} [collectibles]
 * @property {number} [collectiblesTotal]
 * @property {number} [collectiblesPercent]
 */

/**
 * @typedef {object} CampaignSave
 * @property {number} version
 * @property {boolean} freePlay
 * @property {string[]} unlockedChapters
 * @property {Record<string, LevelProgress>} levels
 * @property {string[]} unlockedMarbles
 */

function createDefaultSave() {
    return {
        version: SAVE_VERSION,
        freePlay: false,
        unlockedChapters: ['tutorial'],
        levels: {},
        unlockedMarbles: ['classic_red', 'classic_blue', 'classic_green'],
    };
}

export class CampaignProgress {
    constructor() {
        /** @type {CampaignSave} */
        this.data = this.load();
        /** @type {Record<string, string[]> | null} */
        this._chapterLayout = null;
    }

    /** @returns {CampaignSave} */
    load() {
        try {
            const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
            if (!raw) return createDefaultSave();
            const parsed = JSON.parse(raw);
            return {
                ...createDefaultSave(),
                ...parsed,
                levels: parsed.levels || {},
                unlockedChapters: parsed.unlockedChapters || ['tutorial'],
                unlockedMarbles: parsed.unlockedMarbles || ['classic_red', 'classic_blue', 'classic_green'],
            };
        } catch {
            return createDefaultSave();
        }
    }

    save() {
        try {
            localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[CAMPAIGN] Failed to save progress:', e);
        }
    }

    /**
     * @param {Record<string, object>} levelsCatalog
     */
    setCatalog(levelsCatalog) {
        this._chapterLayout = buildChapterLayout(levelsCatalog);
        this._levelsCatalog = levelsCatalog;
        this.recalculateUnlocks();
    }

    getChapterLayout() {
        return this._chapterLayout || {};
    }

    isFreePlay() {
        return this.data.freePlay;
    }

    setFreePlay(enabled) {
        this.data.freePlay = enabled;
        this.save();
    }

    /**
     * @param {string} chapterId
     */
    isChapterUnlocked(chapterId) {
        if (this.data.freePlay) return true;
        return this.data.unlockedChapters.includes(chapterId);
    }

    /**
     * @param {string} levelId
     */
    isLevelPlayable(levelId) {
        if (this.data.freePlay) return true;
        const chapterId = getChapterForLevel(levelId, this._levelsCatalog?.[levelId]);
        return this.isChapterUnlocked(chapterId);
    }

    /**
     * @param {string} levelId
     * @returns {LevelProgress | undefined}
     */
    getLevelProgress(levelId) {
        return this.data.levels[levelId];
    }

    countChapterCompletions(chapterId) {
        const ids = this._chapterLayout?.[chapterId] || [];
        return ids.filter((id) => this.data.levels[id]?.completed).length;
    }

    countChapterGoldMedals(chapterId) {
        const ids = this._chapterLayout?.[chapterId] || [];
        return ids.filter((id) => this.data.levels[id]?.medal === 'gold').length;
    }

    recalculateUnlocks() {
        const unlocked = new Set(['tutorial']);

        for (const chapter of CAMPAIGN_CHAPTERS) {
            const rule = CHAPTER_UNLOCK_RULES[chapter.id];
            if (!rule) continue;

            let meets = false;
            if (rule.type === 'always') {
                meets = true;
            } else if (rule.type === 'completeChapter') {
                meets = this.countChapterCompletions(rule.chapterId) >= (rule.minCompletions ?? 1);
            } else if (rule.type === 'goldMedals') {
                meets = this.countChapterGoldMedals(rule.chapterId) >= rule.count;
            }

            if (meets) unlocked.add(chapter.id);
        }

        this.data.unlockedChapters = CAMPAIGN_CHAPTERS
            .filter((c) => unlocked.has(c.id))
            .map((c) => c.id);
    }

    /**
     * @param {string} levelId
     * @param {{ time: number, level: object, collectibles?: number, collectiblesTotal?: number }} result
     */
    recordCompletion(levelId, result) {
        const thresholds = getMedalThresholds(result.level);
        const medal = computeMedal(result.time, thresholds);

        const existing = this.data.levels[levelId] || { completed: false };
        const bestTime = existing.bestTime === undefined
            ? result.time
            : Math.min(existing.bestTime, result.time);

        const collectiblesTotal = result.collectiblesTotal
            ?? result.level.collectiblesTotal
            ?? 0;
        const collectibles = result.collectibles ?? existing.collectibles ?? 0;
        const collectiblesPercent = collectiblesTotal > 0
            ? Math.round((collectibles / collectiblesTotal) * 100)
            : (existing.collectiblesPercent ?? 100);

        const bestMedal = medalRank(medal) > medalRank(existing.medal) ? medal : (existing.medal ?? medal);

        this.data.levels[levelId] = {
            completed: true,
            bestTime,
            medal: bestMedal,
            collectibles: Math.max(collectibles, existing.collectibles ?? 0),
            collectiblesTotal,
            collectiblesPercent: Math.max(collectiblesPercent, existing.collectiblesPercent ?? 0),
        };

        this.recalculateUnlocks();

        if (bestMedal === 'gold') {
            this._maybeUnlockMarbles(levelId);
        }

        this.save();
        return this.data.levels[levelId];
    }

    /** @param {string} levelId */
    _maybeUnlockMarbles(levelId) {
        const goldCount = Object.values(this.data.levels).filter((l) => l.medal === 'gold').length;
        const marbleUnlocks = {
            3: 'volcanic_magma',
            6: 'shadow_ninja',
            10: 'cosmic_nebula',
        };
        for (const [threshold, marbleId] of Object.entries(marbleUnlocks)) {
            if (goldCount >= Number(threshold) && !this.data.unlockedMarbles.includes(marbleId)) {
                this.data.unlockedMarbles.push(marbleId);
            }
        }
    }

    /**
     * Human-readable unlock hint for a locked chapter.
     * @param {string} chapterId
     */
    getUnlockHint(chapterId) {
        const rule = CHAPTER_UNLOCK_RULES[chapterId];
        if (!rule) return 'Complete prior chapters';
        if (rule.type === 'completeChapter') {
            const chapter = CAMPAIGN_CHAPTERS.find((c) => c.id === rule.chapterId);
            return `Complete ${chapter?.name || rule.chapterId}`;
        }
        if (rule.type === 'goldMedals') {
            const chapter = CAMPAIGN_CHAPTERS.find((c) => c.id === rule.chapterId);
            return `Earn ${rule.count} gold medals in ${chapter?.name || rule.chapterId}`;
        }
        return '';
    }
}

export default CampaignProgress;
