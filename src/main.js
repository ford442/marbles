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

            const tcm = this.engine.getTransformManager();
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