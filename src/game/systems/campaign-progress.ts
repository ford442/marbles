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

export type Medal = 'gold' | 'silver' | 'bronze' | null;

export interface LevelProgress {
    completed: boolean;
    bestTime?: number;
    medal?: Medal;
    collectibles?: number;
    collectiblesTotal?: number;
    collectiblesPercent?: number;
}

export interface CampaignSave {
    version: number;
    freePlay: boolean;
    unlockedChapters: string[];
    levels: Record<string, LevelProgress>;
    unlockedMarbles: string[];
    revision?: number;
    updatedAt?: string;
}

export interface LevelCompletionResult {
    time: number;
    level: {
        collectiblesTotal?: number;
        medals?: Record<string, number>;
        difficulty?: string;
        [key: string]: unknown;
    };
    collectibles?: number;
    collectiblesTotal?: number;
}

function createDefaultSave(): CampaignSave {
    return {
        version: SAVE_VERSION,
        freePlay: false,
        unlockedChapters: ['tutorial'],
        levels: {},
        unlockedMarbles: ['classic_red', 'classic_blue', 'classic_green'],
        revision: 0,
    };
}

export function mergeLevelProgress(
    local?: LevelProgress | null,
    remote?: LevelProgress | null,
): LevelProgress {
    if (!local && !remote) return { completed: false };
    if (!local) return { ...remote! };
    if (!remote) return { ...local };

    const merged: LevelProgress = { ...local };
    merged.completed = Boolean(local.completed || remote.completed);

    const lt = local.bestTime;
    const rt = remote.bestTime;
    if (lt !== undefined && rt !== undefined) {
        merged.bestTime = Math.min(lt, rt);
    } else if (rt !== undefined) {
        merged.bestTime = rt;
    }

    merged.medal = medalRank(remote.medal ?? null) > medalRank(local.medal ?? null)
        ? remote.medal
        : (local.medal ?? remote.medal);

    merged.collectibles = Math.max(local.collectibles ?? 0, remote.collectibles ?? 0);
    merged.collectiblesPercent = Math.max(
        local.collectiblesPercent ?? 0,
        remote.collectiblesPercent ?? 0,
    );
    merged.collectiblesTotal = local.collectiblesTotal ?? remote.collectiblesTotal;

    return merged;
}

export function mergeCampaignSave(local: CampaignSave, remote: Partial<CampaignSave>): CampaignSave {
    const base = createDefaultSave();
    const l = { ...base, ...local, levels: { ...local.levels } };
    const r = remote || {};

    const allLevelIds = new Set([
        ...Object.keys(l.levels),
        ...Object.keys(r.levels || {}),
    ]);

    const levels: Record<string, LevelProgress> = {};
    for (const levelId of allLevelIds) {
        levels[levelId] = mergeLevelProgress(l.levels[levelId], r.levels?.[levelId]);
    }

    return {
        version: Math.max(l.version, r.version ?? 1),
        freePlay: Boolean(l.freePlay || r.freePlay),
        unlockedChapters: [...new Set([
            ...(l.unlockedChapters || []),
            ...(r.unlockedChapters || []),
        ])],
        unlockedMarbles: [...new Set([
            ...(l.unlockedMarbles || []),
            ...(r.unlockedMarbles || []),
        ])],
        levels,
        revision: Math.max(l.revision ?? 0, r.revision ?? 0),
        updatedAt: r.updatedAt ?? l.updatedAt,
    };
}

export class CampaignProgress {
    data: CampaignSave;
    private _chapterLayout: Record<string, string[]> | null = null;
    private _levelsCatalog: Record<string, { name?: string; difficulty?: string; goals?: unknown[]; [key: string]: unknown }> | undefined;

    constructor() {
        this.data = this.load();
    }

    load(): CampaignSave {
        try {
            const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
            if (!raw) return createDefaultSave();
            const parsed = JSON.parse(raw) as Partial<CampaignSave>;
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

    save(options?: { skipCloud?: boolean }): void {
        try {
            localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[CAMPAIGN] Failed to save progress:', e);
        }

        if (!options?.skipCloud) {
            void import('../network/cloud-client.js').then((m) => {
                m.scheduleProgressSync?.(this.data);
            }).catch(() => {});
        }
    }

    setCatalog(levelsCatalog: Record<string, { name?: string; difficulty?: string; goals?: unknown[]; [key: string]: unknown }>): void {
        this._chapterLayout = buildChapterLayout(levelsCatalog);
        this._levelsCatalog = levelsCatalog;
        this.recalculateUnlocks();
    }

    getChapterLayout(): Record<string, string[]> {
        return this._chapterLayout || {};
    }

    isFreePlay(): boolean {
        return this.data.freePlay;
    }

    setFreePlay(enabled: boolean): void {
        this.data.freePlay = enabled;
        this.save();
    }

    isChapterUnlocked(chapterId: string): boolean {
        if (this.data.freePlay) return true;
        return this.data.unlockedChapters.includes(chapterId);
    }

    isLevelPlayable(levelId: string): boolean {
        if (this.data.freePlay) return true;
        const chapterId = getChapterForLevel(levelId, this._levelsCatalog?.[levelId]);
        return this.isChapterUnlocked(chapterId);
    }

    getLevelProgress(levelId: string): LevelProgress | undefined {
        return this.data.levels[levelId];
    }

    countChapterCompletions(chapterId: string): number {
        const ids = this._chapterLayout?.[chapterId] || [];
        return ids.filter((id) => this.data.levels[id]?.completed).length;
    }

    countChapterGoldMedals(chapterId: string): number {
        const ids = this._chapterLayout?.[chapterId] || [];
        return ids.filter((id) => this.data.levels[id]?.medal === 'gold').length;
    }

    recalculateUnlocks(): void {
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

    recordCompletion(levelId: string, result: LevelCompletionResult): LevelProgress {
        const thresholds = getMedalThresholds(result.level);
        const medal = computeMedal(result.time, thresholds) as Medal;

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

        const existingMedal = existing.medal ?? null;
        const bestMedal = medalRank(medal) > medalRank(existingMedal) ? medal : (existingMedal ?? medal);

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
        return this.data.levels[levelId]!;
    }

    private _maybeUnlockMarbles(_levelId: string): void {
        const goldCount = Object.values(this.data.levels).filter((l) => l.medal === 'gold').length;
        const marbleUnlocks: Record<number, string> = {
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

    getUnlockHint(chapterId: string): string {
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
