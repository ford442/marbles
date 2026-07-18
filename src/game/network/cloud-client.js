/**
 * Non-blocking cloud sync for campaign progress and ghost leaderboards.
 * No-ops when VITE_MARBLES_API_URL is unset or player has not opted in.
 */

export const DEVICE_ID_KEY = 'marbles3d_device_id';
export const CLOUD_OPT_IN_KEY = 'marbles3d_cloud_opt_in';
export const CLOUD_QUEUE_KEY = 'marbles3d_cloud_queue';
export const CLOUD_DISPLAY_NAME_KEY = 'marbles3d_cloud_display_name';

const LEADERBOARD_CACHE = new Map();
const MAX_QUEUE = 50;
const FLUSH_DELAY_MS = 0;

function defaultApiUrl() {
    const testUrl = typeof globalThis !== 'undefined'
        ? globalThis.__MARbles_TEST_API_URL__
        : null;
    if (testUrl) {
        return String(testUrl).replace(/\/$/, '');
    }
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MARBLES_API_URL) {
        return import.meta.env.VITE_MARBLES_API_URL.replace(/\/$/, '');
    }
    return null;
}

function readStorage(key, fallback = null) {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // private mode / quota
    }
}

export function getApiUrl() {
    return defaultApiUrl();
}

export function isCloudEnabled() {
    return Boolean(getApiUrl()) && readStorage(CLOUD_OPT_IN_KEY) === '1';
}

export function setCloudOptIn(enabled) {
    writeStorage(CLOUD_OPT_IN_KEY, enabled ? '1' : '0');
    if (enabled) {
        scheduleQueueFlush();
    }
}

export function getCloudOptIn() {
    return readStorage(CLOUD_OPT_IN_KEY) === '1';
}

export function getDeviceId() {
    let id = readStorage(DEVICE_ID_KEY);
    if (!id && typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = crypto.randomUUID();
        writeStorage(DEVICE_ID_KEY, id);
    }
    return id;
}

export function getDisplayName() {
    const saved = readStorage(CLOUD_DISPLAY_NAME_KEY);
    if (saved) return saved;
    const deviceId = getDeviceId();
    if (!deviceId) return 'Player';
    return `Player-${deviceId.slice(-4).toUpperCase()}`;
}

export function setDisplayName(name) {
    writeStorage(CLOUD_DISPLAY_NAME_KEY, (name || '').trim().slice(0, 32));
}

function authHeaders() {
    const deviceId = getDeviceId();
    if (!deviceId) return null;
    return {
        Authorization: `Bearer ${deviceId}`,
        'Content-Type': 'application/json',
    };
}

function readQueue() {
    try {
        const raw = readStorage(CLOUD_QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeQueue(queue) {
    writeStorage(CLOUD_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
}

function enqueue(op, payload) {
    if (!isCloudEnabled()) return;
    const queue = readQueue();
    queue.push({ op, payload, ts: Date.now() });
    writeQueue(queue);
    scheduleQueueFlush();
}

let flushScheduled = false;

export function scheduleQueueFlush() {
    if (flushScheduled || !isCloudEnabled()) return;
    flushScheduled = true;
    const run = () => {
        flushScheduled = false;
        void flushQueue();
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 2000 });
    } else {
        setTimeout(run, FLUSH_DELAY_MS);
    }
}

async function apiFetch(path, options = {}) {
    const base = getApiUrl();
    const headers = authHeaders();
    if (!base || !headers) return null;

    const res = await fetch(`${base}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
    });
    return res;
}

async function flushQueue() {
    if (!isCloudEnabled() || typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
    }

    let queue = readQueue();
    if (!queue.length) return;

    const remaining = [];
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

async function processQueueItem(item) {
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

export function scheduleProgressSync(campaignSave) {
    if (!isCloudEnabled() || !campaignSave) return;
    enqueue('progress', {
        version: campaignSave.version ?? 1,
        freePlay: campaignSave.freePlay ?? false,
        unlockedChapters: campaignSave.unlockedChapters ?? [],
        levels: campaignSave.levels ?? {},
        unlockedMarbles: campaignSave.unlockedMarbles ?? [],
        revision: campaignSave.revision ?? 0,
    });
}

export function scheduleGhostUpload(levelId, blob, bestTime) {
    if (!isCloudEnabled() || !blob || !levelId) return;
    enqueue('ghost', { levelId, blob, bestTime });
}

export async function fetchRemoteProgress() {
    if (!isCloudEnabled()) return null;
    const deviceId = getDeviceId();
    if (!deviceId) return null;

    try {
        const res = await apiFetch(`/v1/marbles/progress/${deviceId}`);
        if (res?.status === 404) return null;
        if (!res?.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn('[CLOUD] Progress fetch failed:', e);
        return null;
    }
}

export async function fetchLeaderboard(levelId) {
    if (!getApiUrl()) return [];
    const cached = LEADERBOARD_CACHE.get(levelId);
    if (cached && Date.now() - cached.at < 30000) {
        return cached.entries;
    }

    try {
        const res = await apiFetch(`/v1/marbles/leaderboards/${levelId}`);
        if (!res?.ok) return [];
        const data = await res.json();
        const entries = data.entries || [];
        LEADERBOARD_CACHE.set(levelId, { entries, at: Date.now() });
        return entries;
    } catch (e) {
        console.warn('[CLOUD] Leaderboard fetch failed:', e);
        return [];
    }
}

export async function fetchAndImportGhost(ghostId, ghostReplay, levelId) {
    if (!ghostReplay || !ghostId) return false;
    try {
        const res = await apiFetch(`/v1/marbles/ghosts/${ghostId}`);
        if (!res?.ok) return false;
        const data = await res.json();
        ghostReplay.importReplay(data.blob, levelId || data.levelId);
        return true;
    } catch (e) {
        console.warn('[CLOUD] Ghost import failed:', e);
        return false;
    }
}

export class CloudClient {
    /**
     * @param {object} game
     */
    constructor(game) {
        this.game = game;
        this._leaderboardGhostId = null;

        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => scheduleQueueFlush());
        }
        scheduleQueueFlush();
    }

    get enabled() {
        return isCloudEnabled();
    }

    scheduleProgressSync(campaignSave) {
        scheduleProgressSync(campaignSave);
    }

    scheduleGhostUpload(levelId, blob, bestTime) {
        scheduleGhostUpload(levelId, blob, bestTime);
    }

    async pullAndMergeCampaign() {
        if (!isCloudEnabled() || !this.game.campaignProgress) return;
        const remote = await fetchRemoteProgress();
        if (!remote) return;

        const { mergeCampaignSave } = await import('../systems/campaign-progress.js');
        this.game.campaignProgress.data = mergeCampaignSave(
            this.game.campaignProgress.data,
            remote,
        );
        this.game.campaignProgress.recalculateUnlocks();
        this.game.campaignProgress.save({ skipCloud: true });
    }

    fetchLeaderboard(levelId) {
        return fetchLeaderboard(levelId);
    }

    /**
     * @param {string} ghostId
     * @param {string} [levelId]
     */
    async loadLeaderboardGhost(ghostId, levelId) {
        this._leaderboardGhostId = ghostId;
        const ok = await fetchAndImportGhost(ghostId, this.game.ghostReplay, levelId);
        if (ok && levelId) {
            this.game.ghostReplay.loadPlayback(levelId);
        }
        return ok;
    }

    getLeaderboardGhostId() {
        return this._leaderboardGhostId;
    }

    clearLeaderboardGhostSelection() {
        this._leaderboardGhostId = null;
    }
}

export default CloudClient;
