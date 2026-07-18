/**
 * Dynamic Lighting System
 * 
 * Manages environment-aware lighting with optional animation.
 * Applies sun/fill/back light colors and intensities from environment presets,
 * plus optional per-frame animations (lava flicker, neon pulse, etc.).
 */

export class LightingSystem {
    constructor(engine, scene, Filament) {
        this.engine = engine
        this.scene = scene
        this.Filament = Filament
        
        // Light entities (created and managed by init code)
        this.sunLight = null
        this.fillLight = null
        this.backLight = null
        
        // Current environment and animation state
        this.currentEnvironment = null
        this.animatedLights = []  // Array of { light: entity, behavior: string, params: {} }
        this.time = 0
        
        // Animation quality gating
        this.quality = 'high'
        this._animationsEnabled = true
        /** @type {(entity:number)=>boolean} */
        this.isLightActive = () => true
        /** @type {(entity:number)=>boolean} */
        this.isAnimateAllowed = () => true
    }
    
    /**
     * Register lights for management
     * Call this after lights are created in createLight()
     */
    registerLights(sunLight, fillLight, backLight) {
        this.sunLight = sunLight
        this.fillLight = fillLight
        this.backLight = backLight
    }
    
    /**
     * Apply environment lighting (sun/fill color and intensity)
     * @param {string} envName - Environment name from ENVIRONMENT_PRESETS
     * @param {object} envPreset - Environment preset with sunColor, sunIntensity, etc.
     */
    applyEnvironmentLighting(envName, envPreset) {
        if (!this.engine || !this.sunLight || !this.fillLight || !this.backLight) {
            console.warn('[LightingSystem] Lights not registered, cannot apply environment')
            return
        }
        
        this.currentEnvironment = envName
        
        try {
            const lm = this.engine.getLightManager()
            
            // Update sun light
            if (envPreset.sunColor && envPreset.sunIntensity) {
                const sunInst = lm.getInstance(this.sunLight)
                if (sunInst) {
                    const [r, g, b] = envPreset.sunColor
                    lm.setColor(sunInst, [r, g, b])
                    lm.setIntensity(sunInst, envPreset.sunIntensity)
                }
            }
            
            // Update fill light
            if (envPreset.fillColor && envPreset.fillIntensity) {
                const fillInst = lm.getInstance(this.fillLight)
                if (fillInst) {
                    const [r, g, b] = envPreset.fillColor
                    lm.setColor(fillInst, [r, g, b])
                    lm.setIntensity(fillInst, envPreset.fillIntensity)
                }
            }
            
            // Update back light
            if (envPreset.backColor && envPreset.backIntensity) {
                const backInst = lm.getInstance(this.backLight)
                if (backInst) {
                    const [r, g, b] = envPreset.backColor
                    lm.setColor(backInst, [r, g, b])
                    lm.setIntensity(backInst, envPreset.backIntensity)
                }
            }
            
            console.log(`[LightingSystem] Applied environment lighting: ${envName}`)
        } catch (e) {
            console.error('[LightingSystem] Failed to apply environment lighting:', e)
        }
    }
    
    setAnimationsEnabled(enabled) {
        this._animationsEnabled = enabled !== false
    }

    /**
     * Register an animated light
     * @param {entity} light - Filament light entity
     * @param {string} behavior - Animation behavior ('lavaFlicker', 'neonPulse', 'biolumSway', 'crystalShimmer')
     * @param {object} params - Optional animation parameters (speed, intensity, color override, etc.)
     */
    addAnimatedLight(light, behavior, params = {}) {
        // Skip animation on low quality
        if (this.quality === 'low') {
            return
        }
        
        this.animatedLights.push({
            light,
            behavior,
            params,
            startTime: this.time,
            // Store base state for animation
            baseColor: params.baseColor || [1, 1, 1],
            baseIntensity: params.baseIntensity || 1.0
        })
    }
    
    /**
     * Remove all animated lights (on zone change)
     */
    clearAnimatedLights() {
        this.animatedLights = []
    }
    
    /**
     * Update animated lights (call once per frame)
     * @param {number} deltaTime - Frame time in seconds
     */
    update(deltaTime) {
        if (!this._animationsEnabled) return
        this.time += deltaTime
        
        if (this.animatedLights.length === 0) return
        
        const lm = this.engine.getLightManager()
        
        for (const entry of this.animatedLights) {
            const {light, behavior, params, baseColor, baseIntensity} = entry

            if (!this.isLightActive(light)) continue
            if (!this.isAnimateAllowed(light)) continue
            
            try {
                const inst = lm.getInstance(light)
                if (!inst) continue
                
                const color = [...baseColor]
                let intensity = baseIntensity
                
                // Apply behavior-specific animation
                switch (behavior) {
                    case 'lavaFlicker':
                        this.animateLavaFlicker(this.time, params, color, baseIntensity, {color, intensity: (i) => {intensity = i}})
                        break
                    case 'neonPulse':
                        this.animateNeonPulse(this.time, params, color, baseIntensity, {color, intensity: (i) => {intensity = i}})
                        break
                    case 'biolumSway':
                        this.animateBiolumSway(this.time, params, color, baseIntensity, {color, intensity: (i) => {intensity = i}})
                        break
                    case 'crystalShimmer':
                        this.animateCrystalShimmer(this.time, params, color, baseIntensity, {color, intensity: (i) => {intensity = i}})
                        break
                    default:
                        continue
                }
                
                // Apply computed color and intensity
                lm.setColor(inst, color)
                lm.setIntensity(inst, intensity)
            } catch (e) {
                console.warn('[LightingSystem] Failed to update animated light:', e)
            }
        }
    }
    
    /**
     * Lava Flicker: irregular, rapid flickering + orange color shift
     */
    animateLavaFlicker(time, params, color, baseIntensity, output) {
        const speed = params.speed || 8.0
        const flicker = params.flicker || 0.4
        
        // Multiple overlapping noise functions for natural flicker
        const t1 = Math.sin(time * speed * 0.7) * 0.5 + 0.5
        const t2 = Math.sin(time * speed * 1.3 + 100) * 0.5 + 0.5
        const t3 = Math.sin(time * speed * 0.3 + 200) * 0.5 + 0.5
        const combined = (t1 + t2 * 0.6 + t3 * 0.4) / 2.0
        
        const brighten = 1.0 + combined * flicker
        
        // Shift toward orange-red during peaks
        color[0] = Math.min(1.0, color[0] + combined * 0.2)
        color[1] = Math.max(0.0, color[1] - combined * 0.15)
        color[2] = Math.max(0.0, color[2] - combined * 0.25)
        
        output.intensity(baseIntensity * brighten)
    }
    
    /**
     * Neon Pulse: smooth sine-wave intensity pulse
     */
    animateNeonPulse(time, params, color, baseIntensity, output) {
        const speed = params.speed || 2.0
        const intensity = params.intensity || 0.3
        
        const pulse = Math.sin(time * speed * Math.PI * 2) * 0.5 + 0.5
        const brighten = 1.0 + pulse * intensity
        
        output.intensity(baseIntensity * brighten)
    }
    
    /**
     * Biolum Sway: gentle color + intensity modulation, slow wave
     */
    animateBiolumSway(time, params, color, baseIntensity, output) {
        const speed = params.speed || 0.5
        const sway = params.sway || 0.2
        
        const t = Math.sin(time * speed * Math.PI * 2) * 0.5 + 0.5
        const brighten = 1.0 + (t - 0.5) * sway * 2
        
        // Subtle color shift (cyan/blue sway)
        const colorShift = (Math.sin(time * speed * Math.PI * 2 + 1.0) * 0.5 + 0.5) * 0.15
        color[0] = Math.max(0.0, color[0] - colorShift * 0.5)
        color[1] = Math.min(1.0, color[1] + colorShift)
        color[2] = Math.min(1.0, color[2] + colorShift * 0.7)
        
        output.intensity(baseIntensity * brighten)
    }
    
    /**
     * Crystal Shimmer: fast, irregular sparkle + color twinkle
     */
    animateCrystalShimmer(time, params, color, baseIntensity, output) {
        const speed = params.speed || 4.0
        const shimmer = params.shimmer || 0.5
        
        // Fast sine for main shimmer
        const s1 = Math.sin(time * speed * 1.5) * 0.5 + 0.5
        // Secondary faster oscillation
        const s2 = Math.sin(time * speed * 3.1 + 50) * 0.5 + 0.5
        // Combined for complex shimmer
        const combined = (s1 + s2 * 0.4) / 1.4
        
        const brighten = 1.0 + (combined - 0.5) * shimmer * 2
        
        // Color twinkle (cyan/white shift)
        const colorTwinkle = (Math.sin(time * speed * 2.3) * 0.5 + 0.5) * 0.1
        color[0] = Math.min(1.0, color[0] + colorTwinkle * 0.5)
        color[1] = Math.min(1.0, color[1] + colorTwinkle)
        color[2] = Math.min(1.0, color[2] + colorTwinkle)
        
        output.intensity(baseIntensity * brighten)
    }
    
    /**
     * Set quality tier (affects animation complexity)
     */
    setQuality(quality) {
        this.quality = quality
    }
}

export default LightingSystem
