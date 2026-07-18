export class GameLoopHUD {
    updateHUD(now, frameDeltaSec) {
        const shouldUpdateHUD = (now - (this._lastHudStyleUpdate || 0)) >= 100
        if (!shouldUpdateHUD) return;

        if (this.boostBarEl) {
            const timeSince = now - this.lastBoostTime
            const progress = Math.min(1.0, timeSince / this.boostCooldown)
            this.boostBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.boostBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #f0f)'
            } else {
               this.boostBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (this.dashBarEl) {
            if (this.isChargingDash) {
                this.dashCharge = Math.min(this.maxDashCharge, this.dashCharge + (frameDeltaSec * 0.66))
                this.dashBarEl.style.width = `${this.dashCharge * 100}%`
                if (this.dashCharge >= this.maxDashCharge) {
                    this.dashBarEl.style.filter = 'brightness(1.5) drop-shadow(0 0 10px #ff0000)'
                    this.dashBarEl.style.backgroundColor = '#ff0000'
                } else {
                    this.dashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8c00)'
                    this.dashBarEl.style.backgroundColor = '#ff8c00'
                }
            } else {
                const timeSince = now - this.lastDashTime
                const progress = Math.min(1.0, timeSince / this.dashCooldown)
                this.dashBarEl.style.width = `${progress * 100}%`
                this.dashBarEl.style.backgroundColor = '#ff8c00'
                if (progress >= 1.0) {
                   this.dashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8c00)'
                } else {
                   this.dashBarEl.style.filter = 'brightness(0.7)'
                }
            }
        }

        if (!this.levelComplete && this.levelStartTime) {
            const time = ((now - this.levelStartTime) / 1000).toFixed(2)
            if (this.timerEl) this.timerEl.textContent = `Time: ${time}s`
        }

        if (this.magnetBarEl) {
            this.magnetBarEl.style.width = `${this.magnetPower * 100}%`
            if (this.magnetActive) {
                const color = this.magnetMode === 'attract' ? '#00ffff' : '#ff00ff'
                this.magnetBarEl.style.background = color
                this.magnetBarEl.style.boxShadow = `0 0 10px ${color}`
            } else {
                this.magnetBarEl.style.background = 'linear-gradient(90deg, #00ffff 0%, #ff00ff 100%)'
                this.magnetBarEl.style.boxShadow = 'none'
            }
        }

        const yawDeg = Math.round(this.aimYaw * 180 / Math.PI)
        const pitchDeg = Math.round(this.pitchAngle * 180 / Math.PI)
        if (this.aimEl) this.aimEl.textContent = `Yaw: ${yawDeg}° Pitch: ${pitchDeg}°`
        if (this.powerbarEl) this.powerbarEl.style.width = `${this.chargePower * 100}%`

        if (this.activeEffectsEl) {
            let effectsHtml = ''
            for (const [type, endTime] of Object.entries(this.activeEffects)) {
                if (now < endTime) {
                    const remaining = Math.ceil((endTime - now) / 1000)
                    effectsHtml += `<div>${type.toUpperCase()}: ${remaining}s</div>`
                }
            }
            this.activeEffectsEl.innerHTML = effectsHtml
        }

        if (this.sizebarContainerEl && this.sizebarEl) {
            const timeSinceSizeShift = now - this.lastSizeShiftTime
            if (timeSinceSizeShift < this.sizeShiftCooldown) {
                const progress = timeSinceSizeShift / this.sizeShiftCooldown
                this.sizebarEl.style.width = `${progress * 100}%`
                this.sizebarEl.style.filter = 'brightness(0.5)'
            } else {
                this.sizebarEl.style.width = '100%'
                this.sizebarEl.style.filter = 'brightness(1.0)'
            }
        }

        if (this.holobarContainerEl && this.holobarEl) {
            const timeSinceHolo = now - this.lastHoloTime
            if (timeSinceHolo < this.holoCooldown) {
                const progress = timeSinceHolo / this.holoCooldown
                this.holobarEl.style.width = `${progress * 100}%`
                this.holobarEl.style.filter = 'brightness(0.5)'
            } else {
                this.holobarEl.style.width = '100%'
                this.holobarEl.style.filter = 'brightness(1.0)'
            }
        }

        if (this.chameleonBarContainerEl && this.chameleonBarEl) {
            const timeSinceChameleon = now - this.lastChameleonTime
            if (timeSinceChameleon < this.chameleonCooldown) {
                const progress = timeSinceChameleon / this.chameleonCooldown
                this.chameleonBarEl.style.width = `${progress * 100}%`
                this.chameleonBarEl.style.filter = 'brightness(0.5)'
            } else {
                this.chameleonBarEl.style.width = '100%'
                this.chameleonBarEl.style.filter = 'brightness(1.0)'
            }
        }

        if (this.blinkBarEl) {
            const timeSince = now - this.lastBlinkTime
            const progress = Math.min(1.0, timeSince / this.blinkCooldown)
            this.blinkBarEl.style.width = `${progress * 100}%`
            if (progress >= 1.0) {
                this.blinkBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #0ff)'
            } else {
                this.blinkBarEl.style.filter = 'brightness(0.7)'
            }
            if (this.blinkBarContainerEl) {
                this.blinkBarContainerEl.style.display = 'block'
            }
        }

        if (this.teleportBarEl) {
            const timeSince = now - this.lastTeleportTime
            const progress = Math.min(1.0, timeSince / this.teleportCooldown)
            this.teleportBarEl.style.width = `${progress * 100}%`
            if (progress >= 1.0) {
                this.teleportBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #a200ff)'
            } else {
                this.teleportBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (this.gravityPulseBarContainerEl && this.gravityPulseBarEl) {
            const timeSincePulse = now - this.lastGravityPulseTime
            if (timeSincePulse < this.gravityPulseCooldown) {
                const progress = timeSincePulse / this.gravityPulseCooldown
                this.gravityPulseBarEl.style.width = `${progress * 100}%`
                this.gravityPulseBarEl.style.filter = 'brightness(0.5)'
            } else {
                this.gravityPulseBarEl.style.width = '100%'
                this.gravityPulseBarEl.style.filter = 'brightness(1.0) drop-shadow(0 0 5px #a200ff)'
            }
        }

        if (this.blackHoleBarEl && this.blackHoleBarContainerEl) {
            const timeSince = now - this.lastBlackHoleTime
            const progress = Math.min(1.0, timeSince / this.blackHoleCooldown)
            this.blackHoleBarEl.style.width = `${progress * 100}%`
            if (progress >= 1.0) {
                this.blackHoleBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #000)'
            } else {
                this.blackHoleBarEl.style.filter = 'brightness(0.7)'
            }

            if (this.activeBlackHoles && this.activeBlackHoles.length > 0) {
                this.blackHoleBarEl.style.background = '#800080'
            } else {
                this.blackHoleBarEl.style.background = '#000000'
            }
        }

        if (this.bombBarEl) {
            const timeSince = now - this.lastBombTime
            const progress = Math.min(1.0, timeSince / this.bombCooldown)
            this.bombBarEl.style.width = `${progress * 100}%`
            if (progress >= 1.0) {
                this.bombBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #f00)'
            } else {
                this.bombBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (this.missileBarEl) {
            const timeSince = now - this.lastMissileTime
            const progress = Math.min(1.0, timeSince / this.missileCooldown)
            this.missileBarEl.style.width = `${progress * 100}%`
            if (progress >= 1.0) {
                this.missileBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8c00)'
            } else {
                this.missileBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (this.empBarEl) {
            const timeSince = now - this.lastEmpTime
            const progress = Math.min(1.0, timeSince / this.empCooldown)
            this.empBarEl.style.width = `${progress * 100}%`
            if (progress >= 1.0) {
                this.empBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #0ff)'
            } else {
                this.empBarEl.style.filter = 'brightness(0.7)'
            }
            if (this.empBarContainerEl) {
                this.empBarContainerEl.style.display = 'block'
            }
        }
    }
}

export function applyGameLoopHUD(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopHUD.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopHUD.prototype[name];
        }
    }
}
