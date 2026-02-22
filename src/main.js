    constructor() {
        this.canvas = document.getElementById('canvas');
        this.marbles = [];
        this.staticBodies = [];
        this.staticEntities = [];
        this.Filament = null;
        this.material = null;
        this.cubeMesh = null;

        // Camera State
        this.camAngle = 0;
        this.camHeight = 10;
        this.camRadius = 25;

        // Input State
        this.keys = {};

        // Camera Control Mode
        this.cameraMode = 'orbit';

        // Game State
        this.score = 0;
        this.scoreEl = document.getElementById('score');
        this.levelNameEl = document.getElementById('level-name');
        this.selectedEl = document.getElementById('selected');
        this.aimEl = document.getElementById('aim');
        this.powerbarEl = document.getElementById('powerbar');
        this.jumpBarEl = document.getElementById('jumpbar');
        this.boostBarEl = document.getElementById('boostbar');
        this.effectEl = document.getElementById('effects'); // From main
        this.currentMarbleIndex = 0;
        this.aimYaw = 0;
        this.jumpCharge = 0;
        this.lastBoostTime = 0;
        this.boostCooldown = 3000;
        this.isChargingJump = false;
        this.pitchAngle = 0;
        this.chargePower = 0;
        this.charging = false;
        this.isAiming = false;
        this.playerMarble = null;
        this.cueInst = null;

        // Level State
        this.currentLevel = null;
        this.levelStartTime = 0;
        this.levelComplete = false;
        this.goalDefinitions = [];

        // Main branch additions
        this.powerUps = [];
        this.activeEffects = { speed: 0, jump: 0 };
        this.movingPlatforms = [];
    }

    // ... keep all other methods ...
    createMarbles(spawnPos) {
        const baseSpawn = spawnPos || { x: 0, y: 8, z: -12 };

        const marblesInfo = [
            { color: [1.0, 0.0, 0.0], offset: { x: -1.0, y: 0, z: 0 } },
            { color: [0.0, 0.0, 1.0], offset: { x: 1.0, y: 0, z: 0 } },
            { color: [0.2, 1.0, 0.2], offset: { x: -2.5, y: 4, z: 0 }, radius: 0.4, friction: 0.1, restitution: 0.8, roughness: 0.2 },
            { color: [0.6, 0.1, 0.8], offset: { x: 0.0, y: 2, z: 2 }, radius: 0.75, restitution: 1.2 },
            { color: [1.0, 0.84, 0.0], offset: { x: 2.5, y: 2, z: 2 }, radius: 0.6, restitution: 0.2, density: 3.0, roughness: 0.3 },
            { color: [0.0, 0.8, 1.0], offset: { x: -2.0, y: 2, z: 2 }, radius: 0.5, friction: 0.05, restitution: 0.5, roughness: 0.1 },
            // --- NEW MARBLES ---
            // 1. Volcanic Magma Marble - Glowing hot red-orange with extreme bounce
            { name: "Volcanic Magma", color: [1.0, 0.25, 0.0], offset: { x: 3.5, y: 3, z: 0 }, radius: 0.55, friction: 0.15, restitution: 1.5, density: 0.8, roughness: 0.6 },
            // 2. Shadow Ninja Marble - Dark purple, ultra-smooth, sneaky low friction
            { name: "Shadow Ninja", color: [0.15, 0.05, 0.25], offset: { x: -3.5, y: 3, z: 0 }, radius: 0.45, friction: 0.02, restitution: 0.3, density: 1.2, roughness: 0.05 },
            // 3. Cosmic Nebula Marble - Deep space teal with silver shimmer, balanced all-rounder
            { name: "Cosmic Nebula", color: [0.3, 0.9, 0.7], offset: { x: 0.0, y: 5, z: -2 }, radius: 0.65, friction: 0.08, restitution: 0.7, density: 1.5, roughness: 0.15 },
            // 4. Void Marble - Very dense and heavy, doesn't bounce much
            { name: "Void Heavy", color: [0.1, 0.05, 0.2], offset: { x: 2.0, y: 5, z: -2 }, radius: 0.7, friction: 1.0, restitution: 0.1, density: 4.0, roughness: 0.9 },
            // 5. Ice Marble - Slippery and smooth
            { name: "Ice Slick", color: [0.8, 0.9, 1.0], offset: { x: -5.0, y: 3, z: 0 }, radius: 0.48, friction: 0.005, restitution: 0.8, density: 0.9, roughness: 0.1 },
            // 6. Super Bouncy Marble - Maximum bounce
            { name: "Super Bouncy", color: [1.0, 0.0, 0.8], offset: { x: 5.0, y: 3, z: 0 }, radius: 0.52, friction: 0.5, restitution: 1.8, density: 0.5, roughness: 0.3 },
            // 7. Mud Marble - Sticky, heavy, no bounce
            { name: "Mud Sticky", color: [0.35, 0.25, 0.2], offset: { x: 0.0, y: 3, z: 4 }, radius: 0.5, friction: 2.0, restitution: 0.0, density: 3.0, roughness: 0.9 },
            // 8. Tiny Dense Marble - Small, heavy, and fast
            { name: "Tiny Dense", color: [1.0, 1.0, 1.0], offset: { x: 3.5, y: 3, z: 4 }, radius: 0.3, density: 10.0, friction: 0.1, restitution: 0.5 },
            // 9. Nano Marble - Tiny and dense
            { name: "Nano", color: [1.0, 0.4, 0.7], offset: { x: 1.5, y: 4, z: 4 }, radius: 0.25, density: 2.0, roughness: 0.2 },
            // 10. Giant Marble - Huge, hollow-ish, slow rolling
            { name: "Giant", color: [0.2, 0.8, 0.2], offset: { x: -3.0, y: 4, z: 4 }, radius: 1.2, density: 0.5, friction: 0.5, roughness: 0.8 },
            // 11. Mercury Marble - Heavy liquid metal, low friction
            { name: "Mercury", color: [0.7, 0.7, 0.7], offset: { x: -5.0, y: 3, z: 4 }, radius: 0.55, density: 5.0, friction: 0.05, restitution: 0.2, roughness: 0.1 }
        ];

        for (const info of marblesInfo) {
            const radius = info.radius || 0.5;
            const scale = radius / 0.5;
            const pos = {
                x: baseSpawn.x + info.offset.x,
                y: baseSpawn.y + info.offset.y,
                z: baseSpawn.z + info.offset.z
            };

            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(pos.x, pos.y, pos.z)
                .setCanSleep(false);
            const rigidBody = this.world.createRigidBody(bodyDesc);

            const colliderDesc = RAPIER.ColliderDesc.ball(radius)
                .setRestitution(info.restitution !== undefined ? info.restitution : 0.5);

            if (info.density) colliderDesc.setDensity(info.density);
            if (info.friction !== undefined) colliderDesc.setFriction(info.friction);

            this.world.createCollider(colliderDesc, rigidBody);

            const entity = this.Filament.EntityManager.get().create();
            const matInstance = this.material.createInstance();
            matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, info.color);
            matInstance.setFloatParameter('roughness', info.roughness !== undefined ? info.roughness : 0.4);

            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
                .material(0, matInstance)
                .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.sphereVb, this.sphereIb)
                .build(this.engine, entity);

            this.scene.addEntity(entity);

            this.marbles.push({
                rigidBody,
                entity,
                scale,
                initialPos: pos,
                scoredGoals: new Set()
            });
        }

        this.currentMarbleIndex = 0;
        this.playerMarble = this.marbles[0];
        this.selectedEl.textContent = 'Selected: 1';
    }
    loop() {
        // Debug: Log first few frames
        if (!this.frameCount) this.frameCount = 0;
        this.frameCount++;
        if (this.frameCount <= 3) {
            console.log(`[RENDER] Frame ${this.frameCount}, Level: ${this.currentLevel || 'menu'}, Marbles: ${this.marbles.length}`);
        }

        // Update debug overlay (every 10 frames)
        if (this.frameCount % 10 === 0) {
            const debugOverlay = document.getElementById('debug-overlay');
            if (debugOverlay && this.currentLevel) {
                debugOverlay.style.display = 'block';
                document.getElementById('debug-level').textContent = this.currentLevel;
                document.getElementById('debug-marbles').textContent = this.marbles.length;
                document.getElementById('debug-camera').textContent = this.cameraMode;
            }
        }

        const rotSpeed = 0.02;
        const zoomSpeed = 0.5;

        // Handle input
        if (this.keys['KeyR']) {
            this.resetMarbles();
        }
        if (this.keys['KeyM'] && this.currentLevel) {
            this.returnToMenu();
        }

        // Audio controls
        if (this.keys['BracketLeft']) {
            const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4;
            audio.setVolume(currentVol - 0.1);
            this.keys['BracketLeft'] = false;
        }
        if (this.keys['BracketRight']) {
            const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4;
            audio.setVolume(currentVol + 0.1);
            this.keys['BracketRight'] = false;
        }
        if (this.keys['KeyN']) {
            audio.init();
            const muted = audio.toggleMute();
            if (this.muteBtn) {
                this.muteBtn.textContent = muted ? '🔇' : '🔊';
                this.muteBtn.classList.toggle('muted', muted);
            }
            this.keys['KeyN'] = false;
        }

        // Camera and movement controls
        if (this.cameraMode === 'orbit') {
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.camAngle -= rotSpeed;
            if (this.keys['ArrowRight'] || this.keys['KeyD']) this.camAngle += rotSpeed;
            if (this.keys['ArrowUp'] || this.keys['KeyW']) this.camRadius = Math.max(5, this.camRadius - zoomSpeed);
            if (this.keys['ArrowDown'] || this.keys['KeyS']) this.camRadius = Math.min(100, this.camRadius + zoomSpeed);
        } else {
            const impulseStrength = 0.5;
            if (this.playerMarble) {
                const rigidBody = this.playerMarble.rigidBody;
                if (this.keys['ArrowUp'] || this.keys['KeyW']) rigidBody.applyImpulse({ x: 0, y: 0, z: impulseStrength }, true);
                if (this.keys['ArrowDown'] || this.keys['KeyS']) rigidBody.applyImpulse({ x: 0, y: 0, z: -impulseStrength }, true);
                if (this.keys['ArrowLeft'] || this.keys['KeyA']) rigidBody.applyImpulse({ x: -impulseStrength, y: 0, z: 0 }, true);
                if (this.keys['ArrowRight'] || this.keys['KeyD']) rigidBody.applyImpulse({ x: impulseStrength, y: 0, z: 0 }, true);
            }
        }

        // Handle Boost (consolidated from feature branch)
        const now = Date.now();
        if ((this.keys['ShiftLeft'] || this.keys['ShiftRight']) && now - this.lastBoostTime > this.boostCooldown) {
            if (this.playerMarble) {
                this.lastBoostTime = now;
                audio.playBoost();

                let dirX = 0, dirZ = 0;
                if (this.cameraMode === 'follow') {
                    dirX = Math.sin(this.aimYaw);
                    dirZ = Math.cos(this.aimYaw);
                } else {
                    const vel = this.playerMarble.rigidBody.linvel();
                    const speed = Math.hypot(vel.x, vel.z);
                    if (speed > 0.1) {
                        dirX = vel.x / speed;
                        dirZ = vel.z / speed;
                    } else {
                        dirX = 0;
                        dirZ = 1;
                    }
                }

                const boostForce = 80.0;
                this.playerMarble.rigidBody.applyImpulse({ x: dirX * boostForce, y: 0, z: dirZ * boostForce }, true);
            }
        }

        // Update Jump Charge
        if (this.isChargingJump) {
            this.jumpCharge = Math.min(1.0, this.jumpCharge + 0.03);
            if (this.jumpBarEl) this.jumpBarEl.style.width = `${this.jumpCharge * 100}%`;
        }

        // Update Shot Charge
        if (this.charging) {
            this.chargePower = Math.min(1.0, this.chargePower + 0.015);
        }

        // Update Boost Bar (consolidated)
        const boostProgress = Math.min(1.0, (now - this.lastBoostTime) / this.boostCooldown);
        if (this.boostBarEl) {
            this.boostBarEl.style.width = `${boostProgress * 100}%`;
            this.boostBarEl.style.backgroundColor = boostProgress >= 1.0 ? '#0ff' : '#555';
            this.boostBarEl.style.filter = boostProgress >= 1.0 ? 'brightness(1.2) drop-shadow(0 0 5px #f0f)' : 'brightness(0.7)';
        }

        // Update UI
        const yawDeg = Math.round(this.aimYaw * 180 / Math.PI);
        const pitchDeg = Math.round(this.pitchAngle * 180 / Math.PI);
        this.aimEl.textContent = `Yaw: ${yawDeg}° Pitch: ${pitchDeg}°`;
        this.powerbarEl.style.width = `${this.chargePower * 100}%`;

        // Update Camera
        if (this.cameraMode === 'follow' && this.currentLevel) {
            const level = LEVELS[this.currentLevel];
            const target = this.playerMarble || this.getLeader();
            if (target) {
                const t = target.rigidBody.translation();
                const height = level?.camera?.height || 10;
                const dist = 20;
                const eyeX = t.x - Math.sin(this.aimYaw) * dist;
                const eyeZ = t.z - Math.cos(this.aimYaw) * dist;
                this.camera.lookAt([eyeX, t.y + height, eyeZ], [t.x, t.y, t.z], [0, 1, 0]);
            }
        } else {
            const eyeX = this.camRadius * Math.sin(this.camAngle);
            const eyeZ = this.camRadius * Math.cos(this.camAngle);
            this.camera.lookAt([eyeX, this.camHeight, eyeZ], [0, 0, 0], [0, 1, 0]);
        }

        // Step Physics with event handling
        this.world.step();

        // Process collision events for audio
        this.processCollisionEvents();

        this.checkGameLogic();

        // Sync Visuals
        const tcm = this.engine.getTransformManager();
        for (const m of this.marbles) {
            const t = m.rigidBody.translation();
            const r = m.rigidBody.rotation();
            const mat = quaternionToMat4(t, r);

            if (m.scale && m.scale !== 1.0) {
                mat[0] *= m.scale; mat[1] *= m.scale; mat[2] *= m.scale;
                mat[4] *= m.scale; mat[5] *= m.scale; mat[6] *= m.scale;
                mat[8] *= m.scale; mat[9] *= m.scale; mat[10] *= m.scale;
            }

            const inst = tcm.getInstance(m.entity);
            tcm.setTransform(inst, mat);
        }

        // Update PowerUps (from main)
        for (const p of this.powerUps) {
            p.rotation += 0.05;
            const q = quatFromEuler(p.rotation, 0, 0);
            const mat = quaternionToMat4(p.pos, q);
            const s = 0.6;
            mat[0] *= s; mat[1] *= s; mat[2] *= s;
            mat[4] *= s; mat[5] *= s; mat[6] *= s;
            mat[8] *= s; mat[9] *= s; mat[10] *= s;

            const inst = tcm.getInstance(p.entity);
            tcm.setTransform(inst, mat);
        }

        // Update active effects UI (from main)
        let effectsText = '';
        if (this.activeEffects.speed && this.activeEffects.speed > now) {
            effectsText += '<div style="color: #ffcc00">SPEED BOOST!</div>';
        }
        if (this.activeEffects.jump && this.activeEffects.jump > now) {
            effectsText += '<div style="color: #00ff00">JUMP BOOST!</div>';
        }
        if (this.effectEl) this.effectEl.innerHTML = effectsText;

        // Update Moving Platforms (Physics) (from main)
        for (const platform of this.movingPlatforms) {
            platform.time += 0.016;
            const t = (Math.sin(platform.time * platform.speed) + 1) / 2;
            const x = platform.start.x + (platform.end.x - platform.start.x) * t;
            const y = platform.start.y + (platform.end.y - platform.start.y) * t;
            const z = platform.start.z + (platform.end.z - platform.start.z) * t;
            platform.rigidBody.setNextKinematicTranslation({ x, y, z });
        }
    }