import { LEVELS } from '../levels/catalog.js';
import {
    CAMPAIGN_CHAPTERS,
    formatRunTime,
    medalEmoji,
} from '../levels/campaign.js';

/**
 * Renders chapter-based campaign UI into the level menu.
 */
export class CampaignMenu {
    /** @param {import('../game/systems/campaign-progress.js').CampaignProgress} campaign */
    constructor(campaign) {
        this.campaign = campaign;
        this.activeChapterId = 'tutorial';
    }

    /**
     * @param {HTMLElement} levelGrid
     * @param {(levelId: string) => void} onSelectLevel
     */
    render(levelGrid, onSelectLevel) {
        this.campaign.setCatalog(LEVELS);
        this._ensureNav();
        this._renderChapterNav();
        this._renderLevels(levelGrid, onSelectLevel);
        this._renderFreePlayToggle();
    }

    _ensureNav() {
        const menu = document.getElementById('level-menu');
        if (!menu || document.getElementById('campaign-nav')) return;

        const nav = document.createElement('div');
        nav.id = 'campaign-nav';
        nav.className = 'campaign-nav';

        const meta = document.createElement('div');
        meta.id = 'campaign-meta';
        meta.className = 'campaign-meta';

        const grid = document.getElementById('level-grid');
        menu.insertBefore(meta, grid);
        menu.insertBefore(nav, meta);
    }

    _renderChapterNav() {
        const nav = document.getElementById('campaign-nav');
        if (!nav) return;
        nav.innerHTML = '';

        for (const chapter of CAMPAIGN_CHAPTERS) {
            const unlocked = this.campaign.isChapterUnlocked(chapter.id);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'campaign-chapter-btn'
                + (chapter.id === this.activeChapterId ? ' active' : '')
                + (unlocked ? '' : ' locked');
            btn.innerHTML = `
                <span class="chapter-icon">${chapter.icon}</span>
                <span class="chapter-label">${chapter.name}</span>
                ${unlocked ? '' : '<span class="chapter-lock">🔒</span>'}
            `;
            btn.addEventListener('click', () => {
                this.activeChapterId = chapter.id;
                this._renderChapterNav();
                const grid = document.getElementById('level-grid');
                if (grid) {
                    this._renderLevels(grid, this._onSelectLevel);
                }
            });
            nav.appendChild(btn);
        }
    }

    /**
     * @param {HTMLElement} levelGrid
     * @param {(levelId: string) => void} onSelectLevel
     */
    _renderLevels(levelGrid, onSelectLevel) {
        this._onSelectLevel = onSelectLevel;
        levelGrid.innerHTML = '';

        const chapter = CAMPAIGN_CHAPTERS.find((c) => c.id === this.activeChapterId);
        const chapterUnlocked = this.campaign.isChapterUnlocked(this.activeChapterId);
        const layout = this.campaign.getChapterLayout();
        const levelIds = layout[this.activeChapterId] || [];

        if (!chapterUnlocked) {
            const lockMsg = document.createElement('p');
            lockMsg.className = 'campaign-lock-message';
            lockMsg.textContent = `🔒 ${chapter?.name || 'Chapter'} locked — ${this.campaign.getUnlockHint(this.activeChapterId)}`;
            levelGrid.appendChild(lockMsg);
            return;
        }

        if (levelIds.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'campaign-lock-message';
            empty.textContent = 'No levels in this chapter yet.';
            levelGrid.appendChild(empty);
            return;
        }

        const header = document.createElement('p');
        header.className = 'campaign-chapter-desc';
        header.textContent = chapter?.description || '';
        levelGrid.appendChild(header);

        levelIds.forEach((id, index) => {
            const level = LEVELS[id];
            if (!level) return;

            const progress = this.campaign.getLevelProgress(id);
            const playable = this.campaign.isLevelPlayable(id);
            const card = document.createElement('div');
            card.className = 'level-card card-stagger'
                + (playable ? '' : ' level-locked');

            const difficulty = level.difficulty ? `<span class="difficulty">${level.difficulty}</span>` : '';
            const sourceTag = level.source === 'code' ? '<span class="dev-tag">dev</span>' : '';
            const medal = progress?.medal ? medalEmoji(progress.medal) : '○';
            const bestTime = progress?.bestTime !== undefined
                ? `<span class="best-time">⏱ ${formatRunTime(progress.bestTime)}</span>`
                : '';
            const collectibles = progress?.collectiblesTotal
                ? `<span class="collectibles-pct">💎 ${progress.collectiblesPercent ?? 0}%</span>`
                : '';

            card.innerHTML = `
                <div class="level-card-header">
                    <span class="level-medal">${medal}</span>
                    <h3>${level.name}${sourceTag}</h3>
                </div>
                <p>${level.description || ''}</p>
                <div class="level-card-meta">
                    <span class="goals">${level.goals?.length || 0} Goal${(level.goals?.length || 0) !== 1 ? 's' : ''} ${difficulty}</span>
                    ${bestTime}
                    ${collectibles}
                </div>
            `;

            if (playable) {
                card.addEventListener('click', () => onSelectLevel(id));
            }

            levelGrid.appendChild(card);
            setTimeout(() => card.classList.add('animate'), 50 + index * 40);
        });
    }

    _renderFreePlayToggle() {
        const meta = document.getElementById('campaign-meta');
        if (!meta) return;

        const tutorialDone = this.campaign.countChapterCompletions('tutorial') > 0;
        meta.innerHTML = '';

        if (!tutorialDone) return;

        const label = document.createElement('label');
        label.className = 'free-play-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'free-play-toggle';
        input.checked = this.campaign.isFreePlay();
        input.addEventListener('change', () => {
            this.campaign.setFreePlay(input.checked);
            this._renderChapterNav();
            const grid = document.getElementById('level-grid');
            if (grid && this._onSelectLevel) {
                this._renderLevels(grid, this._onSelectLevel);
            }
        });
        label.appendChild(input);
        label.append(' Free Play — all chapters unlocked');
        meta.appendChild(label);
    }
}

export default CampaignMenu;
