import type { EngineContext } from '../types/engine-context.ts';
import type { SettingsContext } from '../types/settings.ts';
import { requireSettings, type InitSettings } from './settings.ts';
import type { InitTouchControls } from './touch-init.ts';

/** What `InitSettingsTabs` uses on the game. */
export type InitSettingsTabsHost =
    & Pick<SettingsContext, 'settings'>
    & Pick<EngineContext, 'autoQualityGovernor' | 'cloudClient'>
    & Pick<InitSettings, 'applyGraphicsSettings' | 'applySettings' | 'applyUIScale' | 'applyHighContrast'>
    & Partial<Pick<InitTouchControls, 'applyTouchSettings'>>;

/** `#id` when it is an `<input>` (settings.html); null when absent. */
function inputById(id: string): HTMLInputElement | null {
    const el = document.getElementById(id)
    return el instanceof HTMLInputElement ? el : null
}

/** `#id` when it is a `<select>` (settings.html); null when absent. */
function selectById(id: string): HTMLSelectElement | null {
    const el = document.getElementById(id)
    return el instanceof HTMLSelectElement ? el : null
}

export class InitSettingsTabs {
    declare game: InitSettingsTabsHost;

    constructor(game: InitSettingsTabsHost) {
        this.game = game;
    }

    initSettingsTabs(): void {
        const tabs = document.querySelectorAll<HTMLElement>('.settings-tab')
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'))
                // Add active class to clicked tab
                tab.classList.add('active')

                // Show corresponding section
                const tabId = tab.dataset.tab
                document.querySelectorAll('.settings-section').forEach(section => {
                    section.classList.remove('active')
                })
                const targetSection = document.getElementById(`tab-${tabId}`)
                if (targetSection) {
                    targetSection.classList.add('active')
                }
            })
        })
    }

    initSettingsInputs(): void {
        // Graphics settings
        const qualitySelect = selectById('setting-quality')
        if (qualitySelect) {
            qualitySelect.addEventListener('change', () => {
                if (this.game.settings) {
                    this.game.settings.graphics.quality = qualitySelect.value
                    this.game.applyGraphicsSettings()
                }
            })
        }

        const shadowToggle = inputById('setting-shadows')
        if (shadowToggle) {
            shadowToggle.addEventListener('change', () => {
                if (this.game.settings) this.game.settings.graphics.shadows = shadowToggle.checked
            })
        }

        const bloomSlider = inputById('setting-bloom')
        const bloomValue = document.getElementById('value-bloom')
        if (bloomSlider && bloomValue) {
            bloomSlider.addEventListener('input', () => {
                bloomValue.textContent = `${bloomSlider.value}%`
                if (this.game.settings) {
                    this.game.settings.graphics.bloom = parseInt(bloomSlider.value)
                    this.game.applyGraphicsSettings()
                }
            })
        }

        const ssaoToggle = inputById('setting-ssao')
        if (ssaoToggle) {
            ssaoToggle.addEventListener('change', () => {
                if (this.game.settings) {
                    this.game.settings.graphics.ssao = ssaoToggle.checked
                    this.game.applyGraphicsSettings()
                }
            })
        }

        const renderScaleSlider = inputById('setting-renderscale')
        const renderScaleValue = document.getElementById('value-renderscale')
        if (renderScaleSlider) {
            renderScaleSlider.addEventListener('change', () => {
                const pct = parseInt(renderScaleSlider.value)
                if (renderScaleValue) renderScaleValue.textContent = `${pct}%`
                if (this.game.settings) {
                    this.game.settings.graphics.renderScale = pct / 100
                    this.game.applyGraphicsSettings()
                }
            })
            renderScaleSlider.addEventListener('input', () => {
                if (renderScaleValue) renderScaleValue.textContent = `${renderScaleSlider.value}%`
            })
        }

        const dynResToggle = inputById('setting-dynres')
        if (dynResToggle) {
            dynResToggle.addEventListener('change', () => {
                if (this.game.settings) {
                    this.game.settings.graphics.dynamicResolution = dynResToggle.checked
                    this.game.applyGraphicsSettings()
                }
            })
        }

        const targetFpsSelect = selectById('setting-target-fps')
        if (targetFpsSelect) {
            targetFpsSelect.addEventListener('change', () => {
                if (this.game.settings) {
                    const val = targetFpsSelect.value
                    this.game.settings.graphics.targetFps = val === 'unlimited' ? 'unlimited' : parseInt(val, 10)
                }
            })
        }

        const perfModeSelect = selectById('setting-performance-mode')
        if (perfModeSelect) {
            perfModeSelect.addEventListener('change', () => {
                if (this.game.settings) {
                    this.game.settings.graphics.performanceMode = perfModeSelect.value
                    if (perfModeSelect.value === 'locked') {
                        this.game.autoQualityGovernor?.reset()
                    }
                    this.game.applySettings()
                }
            })
        }

        // Audio settings
        const masterSlider = inputById('setting-master')
        const masterValue = document.getElementById('value-master')
        if (masterSlider && masterValue) {
            masterSlider.addEventListener('input', () => {
                masterValue.textContent = `${masterSlider.value}%`
                if (this.game.settings) this.game.settings.audio.master = parseInt(masterSlider.value)
            })
        }

        const sfxSlider = inputById('setting-sfx')
        const sfxValue = document.getElementById('value-sfx')
        if (sfxSlider && sfxValue) {
            sfxSlider.addEventListener('input', () => {
                sfxValue.textContent = `${sfxSlider.value}%`
                if (this.game.settings) this.game.settings.audio.sfx = parseInt(sfxSlider.value)
            })
        }

        const musicSlider = inputById('setting-music')
        const musicValue = document.getElementById('value-music')
        if (musicSlider && musicValue) {
            musicSlider.addEventListener('input', () => {
                musicValue.textContent = `${musicSlider.value}%`
                if (this.game.settings) this.game.settings.audio.music = parseInt(musicSlider.value)
            })
        }

        // Controls settings
        const sensitivitySlider = inputById('setting-sensitivity')
        const sensitivityValue = document.getElementById('value-sensitivity')
        if (sensitivitySlider && sensitivityValue) {
            sensitivitySlider.addEventListener('input', () => {
                sensitivityValue.textContent = `${sensitivitySlider.value}%`
                if (this.game.settings) this.game.settings.controls.sensitivity = parseInt(sensitivitySlider.value)
            })
        }

        const invertYToggle = inputById('setting-invert-y')
        if (invertYToggle) {
            invertYToggle.addEventListener('change', () => {
                if (this.game.settings) this.game.settings.controls.invertY = invertYToggle.checked
            })
        }

        // The touch handlers (unguarded before) throw if settings never loaded.
        const touchEnabled = selectById('setting-touch-enabled')
        if (touchEnabled) {
            touchEnabled.addEventListener('change', () => {
                const controls = requireSettings(this.game).controls
                if (!controls.touch) controls.touch = {}
                controls.touch.enabled = touchEnabled.value
                this.game.applyTouchSettings?.()
            })
        }

        const touchCamSlider = inputById('setting-touch-camera')
        const touchCamValue = document.getElementById('value-touch-camera')
        if (touchCamSlider && touchCamValue) {
            touchCamSlider.addEventListener('input', () => {
                touchCamValue.textContent = `${touchCamSlider.value}%`
                const controls = requireSettings(this.game).controls
                if (!controls.touch) controls.touch = {}
                controls.touch.cameraSensitivity = parseInt(touchCamSlider.value, 10)
            })
        }

        const touchInvert = inputById('setting-touch-invert-y')
        if (touchInvert) {
            touchInvert.addEventListener('change', () => {
                const controls = requireSettings(this.game).controls
                if (!controls.touch) controls.touch = {}
                controls.touch.invertCameraY = touchInvert.checked
            })
        }

        const touchJoystickSide = selectById('setting-touch-joystick-side')
        if (touchJoystickSide) {
            touchJoystickSide.addEventListener('change', () => {
                const controls = requireSettings(this.game).controls
                if (!controls.touch) controls.touch = {}
                controls.touch.joystickSide = touchJoystickSide.value
                this.game.applyTouchSettings?.()
            })
        }

        const touchSwapButtons = inputById('setting-touch-swap-buttons')
        if (touchSwapButtons) {
            touchSwapButtons.addEventListener('change', () => {
                const controls = requireSettings(this.game).controls
                if (!controls.touch) controls.touch = {}
                const swapped = touchSwapButtons.checked
                controls.touch.jumpSlot = swapped ? 'secondary' : 'primary'
                controls.touch.boostSlot = swapped ? 'primary' : 'secondary'
                this.game.applyTouchSettings?.()
            })
        }

        // Accessibility settings
        const uiScaleSlider = inputById('setting-ui-scale')
        const uiScaleValue = document.getElementById('value-ui-scale')
        if (uiScaleSlider && uiScaleValue) {
            uiScaleSlider.addEventListener('input', () => {
                uiScaleValue.textContent = `${uiScaleSlider.value}%`
                if (this.game.settings) this.game.settings.accessibility.uiScale = parseInt(uiScaleSlider.value)
                this.game.applyUIScale(parseInt(uiScaleSlider.value))
            })
        }

        const highContrastToggle = inputById('setting-high-contrast')
        if (highContrastToggle) {
            highContrastToggle.addEventListener('change', () => {
                if (this.game.settings) this.game.settings.accessibility.highContrast = highContrastToggle.checked
                this.game.applyHighContrast(highContrastToggle.checked)
            })
        }

        const shakeSlider = inputById('setting-shake')
        const shakeValue = document.getElementById('value-shake')
        if (shakeSlider && shakeValue) {
            shakeSlider.addEventListener('input', () => {
                shakeValue.textContent = `${shakeSlider.value}%`
                if (this.game.settings) this.game.settings.accessibility.screenShake = parseInt(shakeSlider.value)
            })
        }

        const cloudOptIn = inputById('setting-cloud-opt-in')
        if (cloudOptIn) {
            cloudOptIn.addEventListener('change', () => {
                void import('../game/network/cloud-client.ts').then((m) => {
                    m.setCloudOptIn(cloudOptIn.checked)
                    if (cloudOptIn.checked) {
                        m.scheduleQueueFlush()
                        this.game.cloudClient?.pullAndMergeCampaign()
                    }
                })
            })
        }

        const cloudDisplayName = inputById('setting-cloud-display-name')
        if (cloudDisplayName) {
            cloudDisplayName.addEventListener('change', () => {
                void import('../game/network/cloud-client.ts').then((m) => {
                    m.setDisplayName(cloudDisplayName.value)
                })
            })
        }
    }

    populateSettingsValues(): void {
        if (!this.game.settings) return

        const s = this.game.settings

        // Graphics
        const qualitySelect = selectById('setting-quality')
        if (qualitySelect) qualitySelect.value = s.graphics.quality

        const shadowToggle = inputById('setting-shadows')
        if (shadowToggle) shadowToggle.checked = s.graphics.shadows

        const bloomSlider = inputById('setting-bloom')
        const bloomValue = document.getElementById('value-bloom')
        if (bloomSlider) bloomSlider.value = String(s.graphics.bloom)
        if (bloomValue) bloomValue.textContent = `${s.graphics.bloom}%`

        const ssaoToggle = inputById('setting-ssao')
        if (ssaoToggle) ssaoToggle.checked = s.graphics.ssao

        const renderScaleSlider = inputById('setting-renderscale')
        const renderScaleValue = document.getElementById('value-renderscale')
        const renderScalePct = Math.round((s.graphics.renderScale ?? 1.0) * 100)
        if (renderScaleSlider) renderScaleSlider.value = String(renderScalePct)
        if (renderScaleValue) renderScaleValue.textContent = `${renderScalePct}%`

        const dynResToggle = inputById('setting-dynres')
        if (dynResToggle) dynResToggle.checked = s.graphics.dynamicResolution !== false

        const targetFpsSelect = selectById('setting-target-fps')
        if (targetFpsSelect) {
            targetFpsSelect.value = String(s.graphics.targetFps ?? 60)
        }

        const perfModeSelect = selectById('setting-performance-mode')
        if (perfModeSelect) {
            perfModeSelect.value = s.graphics.performanceMode || 'auto'
        }

        // Audio
        const masterSlider = inputById('setting-master')
        const masterValue = document.getElementById('value-master')
        if (masterSlider) masterSlider.value = String(s.audio.master)
        if (masterValue) masterValue.textContent = `${s.audio.master}%`

        const sfxSlider = inputById('setting-sfx')
        const sfxValue = document.getElementById('value-sfx')
        if (sfxSlider) sfxSlider.value = String(s.audio.sfx)
        if (sfxValue) sfxValue.textContent = `${s.audio.sfx}%`

        const musicSlider = inputById('setting-music')
        const musicValue = document.getElementById('value-music')
        if (musicSlider) musicSlider.value = String(s.audio.music)
        if (musicValue) musicValue.textContent = `${s.audio.music}%`

        // Controls
        const sensitivitySlider = inputById('setting-sensitivity')
        const sensitivityValue = document.getElementById('value-sensitivity')
        if (sensitivitySlider) sensitivitySlider.value = String(s.controls.sensitivity)
        if (sensitivityValue) sensitivityValue.textContent = `${s.controls.sensitivity}%`

        const invertYToggle = inputById('setting-invert-y')
        if (invertYToggle) invertYToggle.checked = s.controls.invertY

        const touch = s.controls.touch || {}
        const touchEnabled = selectById('setting-touch-enabled')
        if (touchEnabled) touchEnabled.value = touch.enabled || 'auto'

        const touchCamSlider = inputById('setting-touch-camera')
        const touchCamValue = document.getElementById('value-touch-camera')
        const touchCam = touch.cameraSensitivity ?? 50
        if (touchCamSlider) touchCamSlider.value = String(touchCam)
        if (touchCamValue) touchCamValue.textContent = `${touchCam}%`

        const touchInvert = inputById('setting-touch-invert-y')
        if (touchInvert) touchInvert.checked = touch.invertCameraY === true

        const touchJoystickSide = selectById('setting-touch-joystick-side')
        if (touchJoystickSide) touchJoystickSide.value = touch.joystickSide || 'left'

        const touchSwapButtons = inputById('setting-touch-swap-buttons')
        if (touchSwapButtons) touchSwapButtons.checked = touch.jumpSlot === 'secondary'

        // Accessibility
        const uiScaleSlider = inputById('setting-ui-scale')
        const uiScaleValue = document.getElementById('value-ui-scale')
        if (uiScaleSlider) uiScaleSlider.value = String(s.accessibility.uiScale)
        if (uiScaleValue) uiScaleValue.textContent = `${s.accessibility.uiScale}%`

        const highContrastToggle = inputById('setting-high-contrast')
        if (highContrastToggle) highContrastToggle.checked = s.accessibility.highContrast

        const shakeSlider = inputById('setting-shake')
        const shakeValue = document.getElementById('value-shake')
        if (shakeSlider) shakeSlider.value = String(s.accessibility.screenShake)
        if (shakeValue) shakeValue.textContent = `${s.accessibility.screenShake}%`

        void import('../game/network/cloud-client.ts').then((m) => {
            const cloudOptIn = inputById('setting-cloud-opt-in')
            if (cloudOptIn) cloudOptIn.checked = m.getCloudOptIn()

            const cloudDisplayName = inputById('setting-cloud-display-name')
            if (cloudDisplayName) cloudDisplayName.value = m.getDisplayName()
        })
    }
}
