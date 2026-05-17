import { LEVELS } from '../levels.js';

export class InitLevelMenu {
    showLevelSelection() {
        const menu = document.getElementById('level-menu')
        const levelGrid = document.getElementById('level-grid')
        const gameUI = document.getElementById('ui')
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

        // Create level cards with stagger animation
        Object.entries(LEVELS).forEach(([id, level], index) => {
            const card = document.createElement('div')
            card.className = 'level-card card-stagger'
            card.innerHTML = `
                <h3>${level.name}</h3>
                <p>${level.description}</p>
                <span class="goals">${level.goals.length} Goal${level.goals.length !== 1 ? 's' : ''}</span>
            `
            card.addEventListener('click', () => this.hideLevelSelection(() => this.loadLevel(id)))
            levelGrid.appendChild(card)

            // Trigger stagger animation with delay
            setTimeout(() => {
                card.classList.add('animate')
            }, 50 + (index * 50)) // 50ms base delay + 50ms stagger per card
        })

        // Set up menu camera position (distant overview)
        this.setMenuCamera()
    }

    hideLevelSelection(callback) {
        const menu = document.getElementById('level-menu')
        const cards = menu.querySelectorAll('.level-card')

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

    returnToMenu() {
        const gameUI = document.getElementById('ui')
        
        // Clear current level
        this.clearLevel()
        this.currentLevel = null
        this.levelComplete = false
        this.isPaused = false

        // Reset camera mode
        this.cameraMode = 'orbit'

        // Show level selection with animation
        this.showLevelSelection()
    }

    showLevelMenu() {
        // Alias for showLevelSelection for consistency
        this.showLevelSelection()
    }

    setMenuCamera() {
        // Position camera for menu overview
        if (this.camera) {
            this.camera.lookAt([0, 15, 40], [0, 0, 0], [0, 1, 0])
        }
    }

    transitionCameraToGameplay(duration = 1000) {
        if (!this.camera || !this.playerMarble) return Promise.resolve()

        const startPos = [0, 15, 40] // Menu camera position
        const startTarget = [0, 0, 0]
        
        const startTime = Date.now()
        
        return new Promise((resolve) => {
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

export function applyInitLevelMenu(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitLevelMenu.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitLevelMenu.prototype[name];
        }
    }
}
