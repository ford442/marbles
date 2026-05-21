export class InitSettingsTabs {
    initSettingsTabs() {
        const tabs = document.querySelectorAll('.settings-tab')
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

    initSettingsInputs() {
        // Graphics settings
        const qualitySelect = document.getElementById('setting-quality')
        if (qualitySelect) {
            qualitySelect.addEventListener('change', (e) => {
                if (this.settings) {
                    this.settings.graphics.quality = e.target.value
                    this.applyGraphicsSettings()
                }
            })
        }

        const shadowToggle = document.getElementById('setting-shadows')
        if (shadowToggle) {
            shadowToggle.addEventListener('change', (e) => {
                if (this.settings) this.settings.graphics.shadows = e.target.checked
            })
        }

        const bloomSlider = document.getElementById('setting-bloom')
        const bloomValue = document.getElementById('value-bloom')
        if (bloomSlider && bloomValue) {
            bloomSlider.addEventListener('input', (e) => {
                bloomValue.textContent = `${e.target.value}%`
                if (this.settings) {
                    this.settings.graphics.bloom = parseInt(e.target.value)
                    this.applyGraphicsSettings()
                }
            })
        }

        const ssaoToggle = document.getElementById('setting-ssao')
        if (ssaoToggle) {
            ssaoToggle.addEventListener('change', (e) => {
                if (this.settings) {
                    this.settings.graphics.ssao = e.target.checked
                    this.applyGraphicsSettings()
                }
            })
        }

        // Audio settings
        const masterSlider = document.getElementById('setting-master')
        const masterValue = document.getElementById('value-master')
        if (masterSlider && masterValue) {
            masterSlider.addEventListener('input', (e) => {
                masterValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.audio.master = parseInt(e.target.value)
            })
        }

        const sfxSlider = document.getElementById('setting-sfx')
        const sfxValue = document.getElementById('value-sfx')
        if (sfxSlider && sfxValue) {
            sfxSlider.addEventListener('input', (e) => {
                sfxValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.audio.sfx = parseInt(e.target.value)
            })
        }

        const musicSlider = document.getElementById('setting-music')
        const musicValue = document.getElementById('value-music')
        if (musicSlider && musicValue) {
            musicSlider.addEventListener('input', (e) => {
                musicValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.audio.music = parseInt(e.target.value)
            })
        }

        // Controls settings
        const sensitivitySlider = document.getElementById('setting-sensitivity')
        const sensitivityValue = document.getElementById('value-sensitivity')
        if (sensitivitySlider && sensitivityValue) {
            sensitivitySlider.addEventListener('input', (e) => {
                sensitivityValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.controls.sensitivity = parseInt(e.target.value)
            })
        }

        const invertYToggle = document.getElementById('setting-invert-y')
        if (invertYToggle) {
            invertYToggle.addEventListener('change', (e) => {
                if (this.settings) this.settings.controls.invertY = e.target.checked
            })
        }

        // Accessibility settings
        const uiScaleSlider = document.getElementById('setting-ui-scale')
        const uiScaleValue = document.getElementById('value-ui-scale')
        if (uiScaleSlider && uiScaleValue) {
            uiScaleSlider.addEventListener('input', (e) => {
                uiScaleValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.accessibility.uiScale = parseInt(e.target.value)
                this.applyUIScale(parseInt(e.target.value))
            })
        }

        const highContrastToggle = document.getElementById('setting-high-contrast')
        if (highContrastToggle) {
            highContrastToggle.addEventListener('change', (e) => {
                if (this.settings) this.settings.accessibility.highContrast = e.target.checked
                this.applyHighContrast(e.target.checked)
            })
        }

        const shakeSlider = document.getElementById('setting-shake')
        const shakeValue = document.getElementById('value-shake')
        if (shakeSlider && shakeValue) {
            shakeSlider.addEventListener('input', (e) => {
                shakeValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.accessibility.screenShake = parseInt(e.target.value)
            })
        }
    }

    populateSettingsValues() {
        if (!this.settings) return

        const s = this.settings

        // Graphics
        const qualitySelect = document.getElementById('setting-quality')
        if (qualitySelect) qualitySelect.value = s.graphics.quality

        const shadowToggle = document.getElementById('setting-shadows')
        if (shadowToggle) shadowToggle.checked = s.graphics.shadows

        const bloomSlider = document.getElementById('setting-bloom')
        const bloomValue = document.getElementById('value-bloom')
        if (bloomSlider) bloomSlider.value = s.graphics.bloom
        if (bloomValue) bloomValue.textContent = `${s.graphics.bloom}%`

        const ssaoToggle = document.getElementById('setting-ssao')
        if (ssaoToggle) ssaoToggle.checked = s.graphics.ssao

        // Audio
        const masterSlider = document.getElementById('setting-master')
        const masterValue = document.getElementById('value-master')
        if (masterSlider) masterSlider.value = s.audio.master
        if (masterValue) masterValue.textContent = `${s.audio.master}%`

        const sfxSlider = document.getElementById('setting-sfx')
        const sfxValue = document.getElementById('value-sfx')
        if (sfxSlider) sfxSlider.value = s.audio.sfx
        if (sfxValue) sfxValue.textContent = `${s.audio.sfx}%`

        const musicSlider = document.getElementById('setting-music')
        const musicValue = document.getElementById('value-music')
        if (musicSlider) musicSlider.value = s.audio.music
        if (musicValue) musicValue.textContent = `${s.audio.music}%`

        // Controls
        const sensitivitySlider = document.getElementById('setting-sensitivity')
        const sensitivityValue = document.getElementById('value-sensitivity')
        if (sensitivitySlider) sensitivitySlider.value = s.controls.sensitivity
        if (sensitivityValue) sensitivityValue.textContent = `${s.controls.sensitivity}%`

        const invertYToggle = document.getElementById('setting-invert-y')
        if (invertYToggle) invertYToggle.checked = s.controls.invertY

        // Accessibility
        const uiScaleSlider = document.getElementById('setting-ui-scale')
        const uiScaleValue = document.getElementById('value-ui-scale')
        if (uiScaleSlider) uiScaleSlider.value = s.accessibility.uiScale
        if (uiScaleValue) uiScaleValue.textContent = `${s.accessibility.uiScale}%`

        const highContrastToggle = document.getElementById('setting-high-contrast')
        if (highContrastToggle) highContrastToggle.checked = s.accessibility.highContrast

        const shakeSlider = document.getElementById('setting-shake')
        const shakeValue = document.getElementById('value-shake')
        if (shakeSlider) shakeSlider.value = s.accessibility.screenShake
        if (shakeValue) shakeValue.textContent = `${s.accessibility.screenShake}%`
    }
}

export function applyInitSettingsTabs(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitSettingsTabs.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitSettingsTabs.prototype[name];
        }
    }
}
