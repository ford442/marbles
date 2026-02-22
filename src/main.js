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

        const now = Date.now();

        // Update PowerUps
        // Rotate visuals
        for (const p of this.powerUps) {
            p.rotation += 0.05;
            const q = quatFromEuler(p.rotation, 0, 0);
            const mat = quaternionToMat4(p.pos, q);
            // Scale
            const s = 0.6;
            mat[0] *= s; mat[1] *= s; mat[2] *= s;
            mat[4] *= s; mat[5] *= s; mat[6] *= s;
            mat[8] *= s; mat[9] *= s; mat[10] *= s;

            const inst = tcm.getInstance(p.entity);
            tcm.setTransform(inst, mat);
        }

        // Update active effects UI
        let effectsText = '';
        if (this.activeEffects.speed && this.activeEffects.speed > now) {
            effectsText += '<div style="color: #ffcc00">SPEED BOOST!</div>';
        }
        if (this.activeEffects.jump && this.activeEffects.jump > now) {
            effectsText += '<div style="color: #00ff00">JUMP BOOST!</div>';
        }
        if (this.effectEl) this.effectEl.innerHTML = effectsText;

        // Update Moving Platforms (Physics)
        for (const platform of this.movingPlatforms) {
            platform.time += 0.016;
            const t = (Math.sin(platform.time * platform.speed) + 1) / 2;
            const x = platform.start.x + (platform.end.x - platform.start.x) * t;
            const y = platform.start.y + (platform.end.y - platform.start.y) * t;
            const z = platform.start.z + (platform.end.z - platform.start.z) * t;
            platform.rigidBody.setNextKinematicTranslation({ x, y, z });
        }