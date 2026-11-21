import { LEVELS, getOrderedLevelIds, isDevLevelsEnabled, registerCustomLevel } from '../levels/catalog.js';
import { CampaignMenu } from '../levels/campaign-menu.ts';
import { listWorkshopLevels, deleteWorkshopLevel } from '../levels/workshop-store.js';
import type { InputSystemHost } from '../game/systems/input-system.ts';
import type { LevelLoader } from '../game/systems/level-loader.ts';
import type { EngineContext } from '../types/engine-context.ts';
import type { FrameState } from '../types/frame-host.ts';
import type { MapDefinition } from '../types/map.ts';
import type { InitMultiplayerMenuHost } from './multiplayer-menu.ts';
import type { TouchControlsContext } from './touch-init.ts';
import { requireElement } from '../ui/dom.ts';

/** Menu-only members of the game. */
export interface LevelMenuContext {
    /** Chapter menu, built on the first `showLevelSelection()`. */
    campaignMenu?: CampaignMenu;
    /** `MapEditor`, set by the `?editor=1` boot (`bootMapEditor`). */
    mapEditor?: { isPlaytesting: boolean; exitPlaytest(): unknown } | null;
}

/** What `InitLevelMenu` uses on the game. */
export type InitLevelMenuHost =
    & LevelMenuContext
    & TouchControlsContext
    & Pick<EngineContext, 'camera' | 'campaignProgress'>
    & Pick<FrameState, 'currentLevel' | 'levelComplete' | 'cameraMode' | 'playerMarble'>
    & Pick<InputSystemHost, 'isPaused'>
    & Partial<Pick<InitMultiplayerMenuHost, 'network'>>
    & Pick<InitMultiplayerMenuHost, 'multiplayerMode'>
    & Pick<LevelLoader, 'loadLevel' | 'clearLevel'>;

export class InitLevelMenu {
    declare game: InitLevelMenuHost;

    constructor(game: InitLevelMenuHost) {
        this.game = game;
    }

    showLevelSelection(): void {
        const menu = requireElement('level-menu')
        const levelGrid = requireElement('level-grid')
        const gameUI = requireElement('ui')
        const pauseMenu = document.getElementById('pause-menu')
        const fadeOverlay = document.getElementById('fade-overlay')

        // Hide pause menu if open
        if (pauseMenu) pauseMenu.classList.remove('active')

        // Clear the black overlay so the menu is visible
        if (fadeOverlay) fadeOverlay.classList.add('fade-out')

        // Reset menu state
        menu.classList.remove('menu-hidden', 'menu-exiting')
        menu.classList.add('menu-entering')
        
        // Hide game UI
        gameUI.style.display = 'none'
        gameUI.classList.remove('hud-slide-left', 'hud-slide-right', 'hud-slide-up')
        
        levelGrid.innerHTML = ''

        const toolbar = document.getElementById('level-menu-toolbar')
        if (toolbar) toolbar.innerHTML = ''

        const devMode = isDevLevelsEnabled()

        if (devMode && toolbar) {
            const devBanner = document.createElement('p')
            devBanner.className = 'level-dev-banner'
            devBanner.textContent = 'Dev levels enabled (?devLevels=1) — includes code-only maps'
            toolbar.appendChild(devBanner)
        }

        if (toolbar) {
            const editorLink = document.createElement('a')
            editorLink.className = 'level-editor-link'
            editorLink.href = '?editor=1'
            editorLink.textContent = '🛠 Open Map Editor'
            toolbar.appendChild(editorLink)
        }

        if (this.game.campaignProgress) {
            if (!this.game.campaignMenu) {
                this.game.campaignMenu = new CampaignMenu(this.game.campaignProgress)
            }
            this.game.campaignProgress.setCatalog(LEVELS)
            this.game.campaignMenu.render(levelGrid, (id) => this.hideLevelSelection(() => this.game.loadLevel(id)))
        } else {
            this._renderFlatLevelList(levelGrid)
        }

        this._renderCommunityLevels(levelGrid)

        // Set up menu camera position (distant overview)
        this.setMenuCamera()
    }

    _renderCommunityLevels(levelGrid: HTMLElement): void {
        const entries = listWorkshopLevels()
        if (!entries.length) return

        const header = document.createElement('div')
        header.className = 'campaign-chapter-desc community-levels-header'
        header.textContent = '— Community Levels —'
        levelGrid.appendChild(header)

        entries.forEach((entry, index) => {
            let mapDef: MapDefinition
            try {
                // Stored by the editor's own export (workshop-store.js); trusted as a map.
                mapDef = JSON.parse(entry.mapJson) as MapDefinition
            } catch {
                return
            }
            const goalCount = mapDef.goals?.length || 0
            const card = document.createElement('div')
            card.className = 'level-card card-stagger community-level-card'
            card.innerHTML = `
                <button type="button" class="community-level-delete" title="Remove from Community Levels">✕</button>
                <h3>${entry.name}</h3>
                <p>${entry.description || ''}</p>
                <span class="goals">${goalCount} Goal${goalCount !== 1 ? 's' : ''}</span>
            `
            // Present: the card markup above always renders the delete button.
            card.querySelector('.community-level-delete')?.addEventListener('click', (ev) => {
                ev.stopPropagation()
                deleteWorkshopLevel(entry.id)
                this.showLevelSelection()
            })
            card.addEventListener('click', () => {
                registerCustomLevel(mapDef)
                this.hideLevelSelection(() => this.game.loadLevel(mapDef.id))
            })
            levelGrid.appendChild(card)
            setTimeout(() => card.classList.add('animate'), 50 + index * 50)
        })
    }

    _renderFlatLevelList(levelGrid: HTMLElement): void {
        const levelIds = getOrderedLevelIds()
        levelIds.forEach((id, index) => {
            const level = LEVELS[id]
            // getOrderedLevelIds() lists LEVELS' own keys.
            if (!level) return
            const card = document.createElement('div')
            card.className = 'level-card card-stagger'
            const difficulty = level.difficulty ? `<span class="difficulty">${level.difficulty}</span>` : ''
            const sourceTag = level.source === 'code' ? '<span class="dev-tag">dev</span>' : ''
            card.innerHTML = `
                <h3>${level.name}${sourceTag}</h3>
                <p>${level.description || ''}</p>
                <span class="goals">${level.goals.length} Goal${level.goals.length !== 1 ? 's' : ''} ${difficulty}</span>
            `
            card.addEventListener('click', () => this.hideLevelSelection(() => this.game.loadLevel(id)))
            levelGrid.appendChild(card)
            setTimeout(() => card.classList.add('animate'), 50 + index * 50)
        })
    }

    hideLevelSelection(callback?: () => void): void {
        const menu = requireElement('level-menu')
        const cards = menu.querySelectorAll<HTMLElement>('.level-card')

        // Animate cards out
        cards.forEach((card, index) => {
            card.classList.remove('animate')
            card.classList.add('card-exit')
            card.style.animationDelay = `${index * 30}ms`
        })

        // Animate menu out after cards start exiting
        setTimeout(() => {
            menu.classList.remove('menu-entering')
            menu.classList.add('menu-exiting')
        }, 100)

        // Hide menu after animation completes
        setTimeout(() => {
            menu.classList.remove('menu-entering', 'menu-exiting')
            menu.classList.add('menu-hidden')
            if (callback) callback()
        }, 400)
    }

    returnToMenu(): void {
        if (this.game.mapEditor?.isPlaytesting) {
            this.game.mapEditor.exitPlaytest()
            return
        }

        const gameUI = document.getElementById('ui')
        
        // Clear current level
        this.game.clearLevel()
        this.game.network?.disconnect()
        this.game.multiplayerMode = false
        this.game.touchControls?.setGameplayActive(false)
        this.game.currentLevel = null
        this.game.levelComplete = false
        this.game.isPaused = false

        // Reset camera mode
        this.game.cameraMode = 'orbit'

        // Show level selection with animation
        this.showLevelSelection()
    }

    showLevelMenu(): void {
        // Alias for showLevelSelection for consistency
        this.showLevelSelection()
    }

    setMenuCamera(): void {
        // Position camera for menu overview
        if (this.game.camera) {
            this.game.camera.lookAt([0, 15, 40], [0, 0, 0], [0, 1, 0])
        }
    }

    transitionCameraToGameplay(duration = 1000): Promise<void> {
        if (!this.game.camera || !this.game.playerMarble) return Promise.resolve()

        const startPos = [0, 15, 40] // Menu camera position
        const startTarget = [0, 0, 0]
        
        const startTime = Date.now()
        
        return new Promise<void>((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                // Easing function (ease-out-cubic)
                const ease = 1 - Math.pow(1 - progress, 3)
                
                // We'll let the regular camera update take over smoothly
                // by just resolving when transition is done
                if (progress >= 1) {
                    resolve()
                } else {
                    requestAnimationFrame(animate)
                }
            }
            requestAnimationFrame(animate)
        })
    }
}
