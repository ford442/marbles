/**
 * Non-blocking cloud sync for campaign progress and ghost leaderboards.
 * No-ops when VITE_MARBLES_API_URL is unset or player has not opted in.
 */

import type { CampaignSave } from '../systems/campaign-progress.ts';

export type { CampaignSave };

export interface GhostPayload {
    levelId: string;
    blob: unknown;
    bestTime: number;
}

export type QueueItem =
    | { op: 'progress'; payload: Partial<CampaignSave>; ts: number }
    | { op: 'ghost'; payload: GhostPayload; ts: number };

export interface GhostReplayClient {
    importReplay: (blob: unknown, levelId: string) => void;
    loadPlayback: (levelId: string) => void;
}

export interface CampaignProgressClient {
    data: CampaignSave;
    recalculateUnlocks: () => void;
    save: (options?: { skipCloud?: boolean }) => void;
}

export interface CloudGame {
    campaignProgress?: CampaignProgressClient;
    ghostReplay: GhostReplayClient;
}

export interface LeaderboardEntry {
    rank?: number;
    displayName?: string;
    bestTime?: number;
    ghostId?: string;
    [key: string]: unknown;
}

export const DEVICE_ID_KEY = 'marbles3d_device_id';
export const CLOUD_OPT_IN_KEY = 'marbles3d_cloud_opt_in';
export const CLOUD_QUEUE_KEY = 'marbles3d_cloud_queue';
export const CLOUD_DISPLAY_NAME_KEY = 'marbles3d_cloud_display_name';

const LEADERBOARD_CACHE: Map<string, { entries: unknown[]; at: number }> = new Map();
const MAX_QUEUE = 50;
const FLUSH_DELAY_MS = 0;

function defaultApiUrl(): string | null {
    const testUrl = typeof globalThis !== 'undefined'
        ? (globalThis as any).__MARbles_TEST_API_URL__
        : null;
    if (testUrl) {
        return String(testUrl).replace(/\/$/, '');
    }
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MARBLES_API_URL) {
        return import.meta.env.VITE_MARBLES_API_URL.replace(/\/$/, '');
    }
    return null;
}

function readStorage(key: string, fallback: string | null = null): string | null {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // private mode / quota
    }
}

export function getApiUrl(): string | null {
    return defaultApiUrl();
}

export function isCloudEnabled(): boolean {
    return Boolean(getApiUrl()) && readStorage(CLOUD_OPT_IN_KEY) === '1';
}

export function setCloudOptIn(enabled: boolean): void {
    writeStorage(CLOUD_OPT_IN_KEY, enabled ? '1' : '0');
    if (enabled) {
        scheduleQueueFlush();
    }
}

export function getCloudOptIn(): boolean {
    return readStorage(CLOUD_OPT_IN_KEY) === '1';
}

export function getDeviceId(): string | null {
    let id = readStorage(DEVICE_ID_KEY);
    if (!id && typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = crypto.randomUUID();
        writeStorage(DEVICE_ID_KEY, id);
    }
    return id;
}

export function getDisplayName(): string {
    const saved = readStorage(CLOUD_DISPLAY_NAME_KEY);
    if (saved) return saved;
    const deviceId = getDeviceId();
    if (!deviceId) return 'Player';
    return `Player-${deviceId.slice(-4).toUpperCase()}`;
}

export function setDisplayName(name: string): void {
    writeStorage(CLOUD_DISPLAY_NAME_KEY, (name || '').trim().slice(0, 32));
}

function authHeaders(): Record<string, string> | null {
    const deviceId = getDeviceId();
    if (!deviceId) return null;
    return {
        Authorization: `Bearer ${deviceId}`,
        'Content-Type': 'application/json',
    };
}

function readQueue(): QueueItem[] {
    try {
        const raw = readStorage(CLOUD_QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
    } catch {
        return [];
    }
}

function writeQueue(queue: QueueItem[]): void {
    writeStorage(CLOUD_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
}

const BACKGROUND_SYNC_TAG = 'cloud-flush';

/**
 * Ask the service worker to wake us up via Background Sync once connectivity
 * returns, in case the tab is backgrounded and misses the `online` event.
 * No-ops silently where SW/Background Sync isn't supported (e.g. Safari).
 */
function registerBackgroundSync(): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
        .then((registration: any) => registration.sync?.register(BACKGROUND_SYNC_TAG))
        .catch(() => {
            // Background Sync unsupported/denied — the `online` listener below still covers it.
        });
}

function enqueue(item: QueueItem): void {
    if (!isCloudEnabled()) return;
    const queue = readQueue();
    queue.push(item);
    writeQueue(queue);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        registerBackgroundSync();
    }
    scheduleQueueFlush();
}

let flushScheduled = false;

export function scheduleQueueFlush(): void {
    if (flushScheduled || !isCloudEnabled()) return;
    flushScheduled = true;
    const run = () => {
        flushScheduled = false;
        void flushQueue();
    };
    if (typeof (globalThis as any).requestIdleCallback === 'function') {
        (globalThis as any).requestIdleCallback(run, { timeout: 2000 });
    } else {
        setTimeout(run, FLUSH_DELAY_MS);
    }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response | null> {
    const base = getApiUrl();
    const headers = authHeaders();
    if (!base || !headers) return null;

    const requestHeaders = new Headers(options.headers);
    for (const [name, value] of Object.entries(headers)) requestHeaders.set(name, value);
    const res = await fetch(`${base}${path}`, {
        ...options,
        headers: requestHeaders,
    });
    return res;
}

async function flushQueue(): Promise<void> {
    if (!isCloudEnabled() || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        return;
    }

    const queue = readQueue();
    if (!queue.length) return;

    const remaining: QueueItem[] = [];
    for (const item of queue) {
        try {
            const ok = await processQueueItem(item);
            if (!ok) remaining.push(item);
        } catch (e) {
            console.warn('[CLOUD] Queue item failed:', e);
            remaining.push(item);
        }
    }
    writeQueue(remaining);
}

async function processQueueItem(item: QueueItem): Promise<boolean> {
    const deviceId = getDeviceId();
    if (!deviceId) return true;

    if (item.op === 'progress') {
        const res = await apiFetch(`/v1/marbles/progress/${deviceId}`, {
            method: 'PUT',
            body: JSON.stringify(item.payload),
        });
        return res?.ok === true;
    }

    if (item.op === 'ghost') {
        const res = await apiFetch('/v1/marbles/ghosts', {
            method: 'POST',
            body: JSON.stringify({
                levelId: item.payload.levelId,
                bestTime: item.payload.bestTime,
                blob: item.payload.blob,
                displayName: getDisplayName(),
            }),
        });
        return res?.ok === true;
    }

    return true;
}

export function scheduleProgressSync(campaignSave: Partial<CampaignSave> | null | undefined): void {
    if (!isCloudEnabled() || !campaignSave) return;
    enqueue({
        op: 'progress',
        payload: {
            version: campaignSave.version ?? 1,
            freePlay: campaignSave.freePlay ?? false,
            unlockedChapters: campaignSave.unlockedChapters ?? [],
            levels: campaignSave.levels ?? {},
            unlockedMarbles: campaignSave.unlockedMarbles ?? [],
            revision: campaignSave.revision ?? 0,
        },
        ts: Date.now(),
    });
}

export function scheduleGhostUpload(levelId: string, blob: unknown, bestTime: number): void {
    if (!isCloudEnabled() || !blob || !levelId) return;
    enqueue({ op: 'ghost', payload: { levelId, blob, bestTime }, ts: Date.now() });
}

export async function fetchRemoteProgress(): Promise<Partial<CampaignSave> | null> {
    if (!isCloudEnabled()) return null;
    const deviceId = getDeviceId();
    if (!deviceId) return null;

    try {
        const res = await apiFetch(`/v1/marbles/progress/${deviceId}`);
        if (res?.status === 404) return null;
        if (!res?.ok) return null;
        return (await res.json()) as Partial<CampaignSave>;
    } catch (e) {
        console.warn('[CLOUD] Progress fetch failed:', e);
        return null;
    }
}

export async function fetchLeaderboard(levelId: string): Promise<unknown[]> {
    if (!getApiUrl()) return [];
    const cached = LEADERBOARD_CACHE.get(levelId);
    if (cached && Date.now() - cached.at < 30000) {
        return cached.entries;
    }

    try {
        const res = await apiFetch(`/v1/marbles/leaderboards/${levelId}`);
        if (!res?.ok) return [];
        const data = (await res.json()) as { entries?: unknown[] };
        const entries = data.entries || [];
        LEADERBOARD_CACHE.set(levelId, { entries, at: Date.now() });
        return entries;
    } catch (e) {
        console.warn('[CLOUD] Leaderboard fetch failed:', e);
        return [];
    }
}

export async function fetchAndImportGhost(
    ghostId: string,
    ghostReplay?: GhostReplayClient | null,
    levelId?: string
): Promise<boolean> {
    if (!ghostReplay || !ghostId) return false;
    try {
        const res = await apiFetch(`/v1/marbles/ghosts/${ghostId}`);
        if (!res?.ok) return false;
        const data = (await res.json()) as { blob: unknown; levelId: string };
        ghostReplay.importReplay(data.blob, levelId || data.levelId);
        return true;
    } catch (e) {
        console.warn('[CLOUD] Ghost import failed:', e);
        return false;
    }
}

export class CloudClient {
    game: CloudGame;
    private _leaderboardGhostId: string | null;

    constructor(game: CloudGame) {
        this.game = game;
        this._leaderboardGhostId = null;

        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => scheduleQueueFlush());
        }
        scheduleQueueFlush();
    }

    get enabled(): boolean {
        return isCloudEnabled();
    }

    scheduleProgressSync(campaignSave: Partial<CampaignSave>): void {
        scheduleProgressSync(campaignSave);
    }

    scheduleGhostUpload(levelId: string, blob: unknown, bestTime: number): void {
        scheduleGhostUpload(levelId, blob, bestTime);
    }

    async pullAndMergeCampaign(): Promise<void> {
        if (!isCloudEnabled() || !this.game.campaignProgress) return;
        const remote = await fetchRemoteProgress();
        if (!remote) return;

        const { mergeCampaignSave } = await import('../systems/campaign-progress.ts');
        this.game.campaignProgress.data = mergeCampaignSave(
            this.game.campaignProgress.data,
            remote,
        );
        this.game.campaignProgress.recalculateUnlocks();
        this.game.campaignProgress.save({ skipCloud: true });
    }

    fetchLeaderboard(levelId: string): Promise<unknown[]> {
        return fetchLeaderboard(levelId);
    }

    async loadLeaderboardGhost(ghostId: string, levelId?: string): Promise<boolean> {
        this._leaderboardGhostId = ghostId;
        const ok = await fetchAndImportGhost(ghostId, this.game.ghostReplay, levelId);
        if (ok && levelId) {
            this.game.ghostReplay.loadPlayback(levelId);
        }
        return ok;
    }

    getLeaderboardGhostId(): string | null {
        return this._leaderboardGhostId;
    }

    clearLeaderboardGhostSelection(): void {
        this._leaderboardGhostId = null;
    }
}

export default CloudClient;
