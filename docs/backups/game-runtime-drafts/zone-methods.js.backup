import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from './audio.js';
import { quatFromEuler, quaternionToMat4 } from './math.js';
import { materialPresets } from './material-system.js';

export class ZoneMethods {
    createCheckpointZone(offset, size) {
        const sz = size || { x: 10, y: 5, z: 2 };
        const center = { x: offset.x, y: offset.y + sz.y / 2, z: offset.z };
        const q = { x: 0, y: 0, z: 0, w: 1 };
        
        // Create checkpoint visual entity
        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0]);
        matInstance.setFloatParameter('roughness', 0.1);
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [sz.x / 2, sz.y / 2, sz.z / 2] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity);
        
        // Create point light for checkpoint glow
        const lightEntity = this.Filament.EntityManager.get().create();
        this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
            .color([0.0, 0.8, 1.0]) // Cyan/blue color
            .intensity(10000.0) // Base intensity (will increase on activation)
            .position([center.x, center.y, center.z])
            .falloff(10.0) // Light radius
            .build(this.engine, lightEntity);
        this.scene.addEntity(lightEntity);
        
        const tcm = this.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        const mat = quaternionToMat4(center, q);
        mat[0] *= sz.x; mat[1] *= sz.x; mat[2] *= sz.x;
        mat[4] *= sz.y; mat[5] *= sz.y; mat[6] *= sz.y;
        mat[8] *= sz.z; mat[9] *= sz.z; mat[10] *= sz.z;
        tcm.setTransform(inst, mat);
        this.scene.addEntity(entity);
        
        this.checkpoints.push({
            pos: center,
            halfExtents: { x: sz.x / 2, y: sz.y / 2, z: sz.z / 2 },
            entity: entity,
            matInstance: matInstance,
            lightEntity: lightEntity,
            activated: false
        });
    }

    createMovingZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 4, y: 0.5, z: 4 },
            [0.3, 0.3, 0.35],
            'concrete'
        );

        this.createKinematicBox(
            { x: offset.x, y: offset.y, z: offset.z + 10 },
            { x: 2, y: 0.5, z: 2 },
            [0.2, 0.6, 0.8],
            'horizontal',
            offset.x,
            5.0
        );

        this.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: offset.z + 18 },
            { x: 2, y: 0.5, z: 2 },
            [0.8, 0.6, 0.2],
            'vertical',
            offset.y + 1,
            3.0
        );

        this.createKinematicBox(
            { x: offset.x, y: offset.y + 2, z: offset.z + 28 },
            { x: 2, y: 0.5, z: 2 },
            [0.8, 0.2, 0.6],
            'depth',
            offset.z + 28,
            4.0
        );

        this.createStaticBox(
            { x: offset.x, y: offset.y + 2, z: offset.z + 40 },
            floorQ,
            { x: 4, y: 0.5, z: 4 },
            [0.3, 0.3, 0.35],
            'concrete'
        );
    }

    createKinematicBox(pos, halfExtents, color, type, center, amplitude) {
        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(pos.x, pos.y, pos.z);
        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
            .setFriction(1.0);
        this.world.createCollider(colliderDesc, body);

        audio.registerBodyMaterial(body, 'metal');

        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.3);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity);

        this.scene.addEntity(entity);

        this.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: halfExtents,
            type: type,
            center: center,
            amplitude: amplitude,
            initialPos: { ...pos },
            speed: 1.5 + Math.random()
        });
    }

    createPowerUpZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 10, y: 0.5, z: 40 },
            [0.3, 0.3, 0.35],
            'concrete'
        );

        this.createPowerUp({ x: offset.x - 3, y: offset.y + 1, z: offset.z }, 'speed');
        this.createPowerUp({ x: offset.x + 3, y: offset.y + 1, z: offset.z }, 'speed');
        this.createPowerUp({ x: offset.x, y: offset.y + 1, z: offset.z + 10 }, 'jump');
        this.createPowerUp({ x: offset.x, y: offset.y + 1, z: offset.z + 15 }, 'gravity');

        this.createStaticBox(
            { x: offset.x, y: offset.y + 1, z: offset.z + 20 },
            floorQ,
            { x: 4, y: 1, z: 0.5 },
            [0.8, 0.2, 0.2],
            'metal'
        );
    }

    createPowerUp(pos, type) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z);
        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.ball(0.5)
            .setSensor(true);
        this.world.createCollider(colliderDesc, body);

        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();

        let color = [1, 1, 1];
        if (type === 'speed') color = [0, 1, 1];
        if (type === 'jump') color = [0, 1, 0];
        if (type === 'gravity') color = [1, 1, 0];

        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.2);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.4, 0.4, 0.4] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity);

        this.scene.addEntity(entity);

        this.powerUps.push({
            rigidBody: body,
            entity: entity,
            type: type,
            baseY: pos.y,
            rotation: 0,
            pos: pos
        });
    }

    createPyramidZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 15, y: 0.5, z: 15 },
            [0.6, 0.5, 0.3],
            'concrete'
        );

        const steps = 6;
        const stepHeight = 0.8;
        const sizeStep = 2.0;

        for (let i = 0; i < steps; i++) {
            const currentSize = 12 - i * sizeStep;
            const y = offset.y + 0.5 + i * stepHeight + stepHeight/2;

            this.createStaticBox(
                { x: offset.x, y: y, z: offset.z },
                floorQ,
                { x: currentSize/2, y: stepHeight/2, z: currentSize/2 },
                [0.7 - i*0.05, 0.6 - i*0.05, 0.4 - i*0.05],
                'concrete'
            );
        }

        const topY = offset.y + 0.5 + steps * stepHeight;
        this.createStaticBox(
            { x: offset.x, y: topY, z: offset.z },
            floorQ,
            { x: 2, y: 0.2, z: 2 },
            [1.0, 0.8, 0.0],
            'metal'
        );
    }

    createDominoZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 10, y: 0.5, z: 40 },
            [0.5, 0.5, 0.5],
            'concrete'
        );

        const rampAngle = -0.3;
        const sinA = Math.sin(rampAngle / 2);
        const cosA = Math.cos(rampAngle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

        this.createStaticBox(
            { x: offset.x, y: offset.y + 2, z: offset.z - 15 },
            rampQ,
            { x: 2, y: 0.2, z: 8 },
            [0.6, 0.6, 0.8],
            'wood'
        );

        const startZ = offset.z - 5;
        const numDominos = 20;
        const spacing = 1.5;

        for (let i = 0; i < numDominos; i++) {
            const angle = i * 0.1;
            const z = startZ + i * spacing * Math.cos(angle * 0.5);
            const x = offset.x + Math.sin(angle) * 3;

            const q = quatFromEuler(angle * 0.5, 0, 0);

            this.createDynamicBox(
                { x: x, y: offset.y + 1.0, z: z },
                q,
                { x: 0.8, y: 1.0, z: 0.1 },
                [1.0, 1.0 - (i/numDominos), i/numDominos],
                0.5,
                'wood'
            );
        }

        this.createDynamicBox(
            { x: offset.x + Math.sin(numDominos * 0.1) * 3, y: offset.y + 2, z: startZ + numDominos * spacing * Math.cos(numDominos * 0.05) + 2 },
            floorQ,
            { x: 1, y: 2, z: 1 },
            [0.2, 0.8, 0.2],
            0.2,
            'wood'
        );
    }

    createFloorZone(offset, size) {
        const sz = size || { x: 50, y: 0.5, z: 50 };
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            { x: 0, y: 0, z: 0, w: 1 },
            { x: sz.x / 2, y: sz.y / 2, z: sz.z / 2 },
            [0.3, 0.3, 0.3],
            'concrete'
        );
    }

    createTrackZone(offset) {
        const angle = 0.2;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const q = { x: sinA, y: 0, z: 0, w: cosA };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            q,
            { x: 4, y: 0.2, z: 15 },
            [0.6, 0.6, 0.6],
            'wood'
        );

        this.createStaticBox(
            { x: offset.x - 3.5, y: offset.y + 1, z: offset.z },
            q,
            { x: 0.5, y: 1.5, z: 15 },
            [0.5, 0.3, 0.3],
            'wood'
        );
        this.createStaticBox(
            { x: offset.x + 3.5, y: offset.y + 1, z: offset.z },
            q,
            { x: 0.5, y: 1.5, z: 15 },
            [0.5, 0.3, 0.3],
            'wood'
        );
    }

    createSpiralZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 4, y: 0.5, z: 4 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        const numSteps = 60;
        const radius = 10;
        const heightGain = 0.3;
        const angleStep = 0.2;

        for (let i = 0; i < numSteps; i++) {
            const angle = i * angleStep;
            const x = offset.x + Math.cos(angle) * radius;
            const z = offset.z + 10 + Math.sin(angle) * radius;
            const y = offset.y + i * heightGain;

            const rotY = -angle;
            const pitch = -0.2;

            const q = quatFromEuler(rotY, pitch, 0);

            this.createStaticBox(
                { x: x, y: y, z: z },
                q,
                { x: 1.5, y: 0.2, z: 1 },
                [0.3 + (i / numSteps) * 0.5, 0.3, 0.6],
                'wood'
            );
        }

        const lastAngle = (numSteps - 1) * angleStep;
        const lastX = offset.x + Math.cos(lastAngle) * radius;
        const lastZ = offset.z + 10 + Math.sin(lastAngle) * radius;
        const lastY = offset.y + (numSteps - 1) * heightGain;

        this.createStaticBox(
             { x: lastX, y: lastY, z: lastZ },
             floorQ,
             { x: 3, y: 0.5, z: 3 },
             [0.8, 0.8, 0.2],
             'metal'
        );
    }

    createBlockZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 10, y: 0.5, z: 20 },
            [0.5, 0.5, 0.5],
            'concrete'
        );

        for (let i = 0; i < 30; i++) {
            const x = offset.x + (Math.sin(i * 12.9898) * 8);
            const z = offset.z + (Math.cos(i * 78.233) * 18);
            const h = 1.0 + (i % 3) * 0.5;

            this.createStaticBox(
                { x: x, y: offset.y + h/2, z: z },
                floorQ,
                { x: 0.5, y: h/2, z: 0.5 },
                [0.7, 0.3, 0.3],
                'concrete'
            );
        }
    }

    createLoopZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 3, y: 0.5, z: 5 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        const radius = 15;
        const segments = 32;
        const centerX = offset.x;
        const centerY = offset.y + radius;
        const centerZ = offset.z + 5 + radius;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const theta = angle - Math.PI / 2;

            const xShift = (i / segments) * 4;
            const x = centerX + xShift;

            const y = centerY + Math.sin(theta) * radius;
            const z = centerZ + Math.cos(theta) * radius;

            const alpha = -(theta + Math.PI/2);
            const sinA = Math.sin(alpha / 2);
            const cosA = Math.cos(alpha / 2);
            const q = { x: sinA, y: 0, z: 0, w: cosA };

            const segmentLength = (2 * Math.PI * radius / segments);

            this.createStaticBox(
                { x: x, y: y, z: z },
                q,
                { x: 2, y: 0.2, z: segmentLength / 2 + 0.1 },
                [0.8, 0.2 + (i/segments)*0.8, 0.2],
                'metal'
            );

             this.createStaticBox(
                { x: x - 2.2, y: y, z: z },
                q,
                { x: 0.2, y: 1.0, z: segmentLength / 2 + 0.1 },
                [0.6, 0.6, 0.6],
                'metal'
             );
             this.createStaticBox(
                { x: x + 2.2, y: y, z: z },
                q,
                { x: 0.2, y: 1.0, z: segmentLength / 2 + 0.1 },
                [0.6, 0.6, 0.6],
                'metal'
             );
        }

        this.createStaticBox(
            { x: offset.x + 4, y: offset.y, z: offset.z + 5 + radius * 2 + 5 },
            floorQ,
            { x: 3, y: 0.5, z: 5 },
            [0.4, 0.4, 0.4],
            'concrete'
        );
    }

    createZigZagZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 3, y: 0.5, z: 3 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z + 8 },
            floorQ,
            { x: 1, y: 0.5, z: 5 },
            [0.7, 0.3, 0.3],
            'wood'
        );

        this.createStaticBox(
            { x: offset.x + 4, y: offset.y, z: offset.z + 13 },
            { x: 0, y: 0.3826834, z: 0, w: 0.9238795 },
            { x: 1, y: 0.5, z: 5 },
            [0.3, 0.7, 0.3],
            'wood'
        );

         this.createStaticBox(
            { x: offset.x + 4, y: offset.y, z: offset.z + 21 },
             { x: 0, y: -0.3826834, z: 0, w: 0.9238795 },
            { x: 1, y: 0.5, z: 5 },
            [0.3, 0.3, 0.7],
            'wood'
        );

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z + 30 },
            floorQ,
            { x: 1, y: 0.5, z: 5 },
            [0.7, 0.7, 0.3],
            'wood'
        );

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z + 38 },
            floorQ,
            { x: 3, y: 0.5, z: 3 },
            [0.4, 0.4, 0.4],
            'concrete'
        );
    }

    createNeonCityZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };
        const buildingColors = [
            [0.0, 1.0, 1.0],
            [1.0, 0.0, 1.0],
            [0.7, 1.0, 0.0],
            [1.0, 0.5, 0.0]
        ];

        // Cyber platform with shiny metallic/clear coat finish
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 4, y: 0.5, z: 5 },
            [0.1, 0.1, 0.2],
            { ...materialPresets.shinyMetal, roughness: 0.3, clearCoat: 0.5, clearCoatRoughness: 0.2 }
        );

        for (let i = 0; i < 15; i++) {
            const z = offset.z + 8 + i * 4;
            const side = (i % 2 === 0) ? 1 : -1;
            const x = offset.x + side * 3.5;

            const h = 1.5 + Math.abs(Math.sin(i * 12.9898)) * 2.5;
            const color = buildingColors[i % buildingColors.length];

            // Neon buildings with metallic finish and clear coat
            this.createStaticBox(
                { x: x, y: offset.y + h/2, z: z },
                floorQ,
                { x: 1.5, y: h/2, z: 1.5 },
                color,
                { ...materialPresets.shinyMetal, roughness: 0.2, clearCoat: 0.8, clearCoatRoughness: 0.1 }
            );

            // Walkway with polished look
            this.createStaticBox(
                { x: offset.x, y: offset.y, z: z },
                floorQ,
                { x: 2, y: 0.5, z: 2 },
                [0.1, 0.1, 0.2],
                { ...materialPresets.polishedMarble, roughness: 0.2, clearCoat: 0.6, clearCoatRoughness: 0.15 }
            );
        }

        const rampZ = offset.z + 72;
        const angle = -0.35;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

        // Neon ramp with cyber aesthetic
        this.createStaticBox(
            { x: offset.x, y: offset.y + 1.5, z: rampZ },
            rampQ,
            { x: 2, y: 0.2, z: 5 },
            [1.0, 0.0, 0.5],
            { ...materialPresets.shinyMetal, roughness: 0.15, clearCoat: 0.9, clearCoatRoughness: 0.05 }
        );

        // Final platform with polished finish
        this.createStaticBox(
            { x: offset.x, y: offset.y + 2, z: rampZ + 12 },
            floorQ,
            { x: 3, y: 0.5, z: 5 },
            [0.2, 0.2, 0.4],
            { ...materialPresets.polishedMarble, roughness: 0.25, clearCoat: 0.4, clearCoatRoughness: 0.2 }
        );
    }

    createLandingZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 5, y: 0.25, z: 10 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        this.createStaticBox(
            { x: offset.x - 3, y: offset.y + 1.5, z: offset.z - 5 },
            floorQ,
            { x: 0.5, y: 1.5, z: 0.5 },
            [0.8, 0.2, 0.2],
            'metal'
        );
        this.createStaticBox(
            { x: offset.x + 3, y: offset.y + 1.5, z: offset.z },
            floorQ,
            { x: 0.5, y: 1.5, z: 0.5 },
            [0.2, 0.2, 0.8],
            'metal'
        );
        this.createStaticBox(
            { x: offset.x, y: offset.y + 0.75, z: offset.z + 5 },
            floorQ,
            { x: 2, y: 0.5, z: 0.5 },
            [0.2, 0.8, 0.2],
            'metal'
        );
    }

    createBowlingZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        const laneWidth = 4;
        const laneLength = 25;
        const laneThickness = 0.5;

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: laneWidth / 2, y: laneThickness / 2, z: laneLength / 2 },
            [0.8, 0.6, 0.4],
            'wood'
        );

        const gutterWidth = 1.0;
        this.createStaticBox(
            { x: offset.x - (laneWidth/2 + gutterWidth/2), y: offset.y - 0.2, z: offset.z },
            floorQ,
            { x: gutterWidth / 2, y: laneThickness / 2, z: laneLength / 2 },
            [0.3, 0.3, 0.3],
            'concrete'
        );
        this.createStaticBox(
            { x: offset.x + (laneWidth/2 + gutterWidth/2), y: offset.y - 0.2, z: offset.z },
            floorQ,
            { x: gutterWidth / 2, y: laneThickness / 2, z: laneLength / 2 },
            [0.3, 0.3, 0.3],
            'concrete'
        );

        this.createStaticBox(
            { x: offset.x - (laneWidth/2 + gutterWidth + 0.2), y: offset.y + 0.5, z: offset.z },
            floorQ,
            { x: 0.2, y: 1.0, z: laneLength / 2 },
            [0.5, 0.5, 0.5],
            'metal'
        );
        this.createStaticBox(
            { x: offset.x + (laneWidth/2 + gutterWidth + 0.2), y: offset.y + 0.5, z: offset.z },
            floorQ,
            { x: 0.2, y: 1.0, z: laneLength / 2 },
            [0.5, 0.5, 0.5],
            'metal'
        );

        const pinSize = { x: 0.15, y: 0.5, z: 0.15 };
        const pinSpacing = 0.6;
        const startZ = offset.z + laneLength / 2 - 2;

        this.createDynamicBox(
            { x: offset.x, y: offset.y + pinSize.y + 0.1, z: startZ },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );

        this.createDynamicBox(
            { x: offset.x - pinSpacing/2, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x + pinSpacing/2, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );

        this.createDynamicBox(
            { x: offset.x - pinSpacing, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 2 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 2 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x + pinSpacing, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 2 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );

        this.createDynamicBox(
            { x: offset.x - pinSpacing * 1.5, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 3 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x - pinSpacing * 0.5, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 3 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x + pinSpacing * 0.5, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 3 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x + pinSpacing * 1.5, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 3 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );

        this.createStaticBox(
             { x: offset.x, y: offset.y + 1, z: offset.z + laneLength/2 + 2 },
             floorQ,
             { x: laneWidth/2 + gutterWidth + 0.5, y: 2, z: 0.5 },
             [0.2, 0.2, 0.2],
             'metal'
        );
    }

    createCastleZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 15, y: 0.5, z: 25 },
            [0.4, 0.4, 0.35],
            'concrete'
        );

        const wallHeight = 3;
        const wallThick = 0.5;
        const wallColor = [0.5, 0.5, 0.55];

        this.createStaticBox(
            { x: offset.x - 10, y: offset.y + wallHeight/2, z: offset.z },
            floorQ,
            { x: wallThick, y: wallHeight/2, z: 25 },
            wallColor,
            'concrete'
        );
        this.createStaticBox(
            { x: offset.x + 10, y: offset.y + wallHeight/2, z: offset.z },
            floorQ,
            { x: wallThick, y: wallHeight/2, z: 25 },
            wallColor,
            'concrete'
        );

        const gateZ = offset.z + 15;
        this.createStaticBox(
            { x: offset.x - 4, y: offset.y + 3, z: gateZ },
            floorQ,
            { x: 2, y: 3, z: 2 },
            wallColor,
            'concrete'
        );
        this.createStaticBox(
            { x: offset.x + 4, y: offset.y + 3, z: gateZ },
            floorQ,
            { x: 2, y: 3, z: 2 },
            wallColor,
            'concrete'
        );
        this.createStaticBox(
            { x: offset.x, y: offset.y + 5, z: gateZ },
            floorQ,
            { x: 2, y: 1, z: 1 },
            wallColor,
            'concrete'
        );

        const rampAngle = -0.2;
        const sinA = Math.sin(rampAngle / 2);
        const cosA = Math.cos(rampAngle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

        this.createStaticBox(
             { x: offset.x, y: offset.y + 1, z: gateZ - 6 },
             rampQ,
             { x: 2, y: 0.2, z: 4 },
             [0.4, 0.25, 0.1],
             'wood'
        );

        for (let i = 0; i < 10; i++) {
            const cx = offset.x + (Math.random() * 8 - 4);
            const cz = offset.z + (Math.random() * 10 - 5);
            this.createDynamicBox(
                { x: cx, y: offset.y + 1.5, z: cz },
                floorQ,
                { x: 0.5, y: 0.5, z: 0.5 },
                [0.6, 0.4, 0.2],
                0.5,
                'wood'
            );
        }
    }

    createJumpZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 5, y: 0.25, z: 2.5 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        const angle = -0.4;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };
        this.createStaticBox(
            { x: offset.x, y: offset.y + 1.0, z: offset.z + 5 },
            rampQ,
            { x: 5, y: 0.25, z: 3 },
            [0.7, 0.3, 0.3],
            'wood'
        );

        this.createStaticBox(
            { x: offset.x, y: offset.y - 2, z: offset.z + 22.5 },
            floorQ,
            { x: 8, y: 0.5, z: 5 },
            [0.3, 0.7, 0.3],
            'wood'
        );

        this.createStaticBox(
            { x: offset.x, y: offset.y - 1, z: offset.z + 25.5 },
            floorQ,
            { x: 1, y: 0.5, z: 1 },
            [0.8, 0.8, 0.2],
            'metal'
        );
    }

    createSlalomZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 6, y: 0.5, z: 20 },
            [0.3, 0.3, 0.5],
            'concrete'
        );

        for (let z = -15; z <= 15; z += 5) {
            if (z === 15) continue;
            const pillarX = ((z + 15) / 5) % 2 === 0 ? 3 : -3;
            this.createStaticBox(
                { x: offset.x + pillarX, y: offset.y + 2, z: offset.z + z },
                floorQ,
                { x: 0.5, y: 1.5, z: 0.5 },
                [0.9, 0.1, 0.1],
                'metal'
            );
        }
    }

    createStaircaseZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 4, y: 0.5, z: 4 },
            [0.4, 0.4, 0.6],
            'concrete'
        );

        let currentY = offset.y;
        let currentZ = offset.z;
        for (let i = 0; i < 10; i++) {
            currentY += 1.0;
            currentZ += 4.0;
            this.createStaticBox(
                { x: offset.x, y: currentY, z: currentZ },
                floorQ,
                { x: 2, y: 0.5, z: 1.5 },
                [0.2 + (i * 0.05), 0.5, 0.8 - (i * 0.05)],
                'concrete'
            );
        }
    }

    createSplitZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 4, y: 0.5, z: 4 },
            [0.4, 0.4, 0.4]
        );

        this.createStaticBox(
            { x: offset.x - 2, y: offset.y, z: offset.z + 14 },
            floorQ,
            { x: 1, y: 0.5, z: 10 },
            [0.6, 0.3, 0.3]
        );

        const angle = -0.3;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

        this.createStaticBox(
            { x: offset.x + 2, y: offset.y + 1, z: offset.z + 8 },
            rampQ,
            { x: 1, y: 0.5, z: 4 },
            [0.3, 0.3, 0.6]
        );

        this.createStaticBox(
            { x: offset.x + 2, y: offset.y, z: offset.z + 20 },
            floorQ,
            { x: 1.5, y: 0.5, z: 4 },
            [0.3, 0.3, 0.6]
        );

        this.createStaticBox(
            { x: offset.x, y: offset.y - 1, z: offset.z + 30 },
            floorQ,
            { x: 4, y: 0.5, z: 4 },
            [0.4, 0.4, 0.4]
        );
    }

    createForestZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 10, y: 0.5, z: 20 },
            [0.2, 0.5, 0.2]
        );

        for (let i = 0; i < 20; i++) {
            const rx = (Math.sin(i * 12.9898) * 9);
            const rz = (Math.cos(i * 78.233) * 19);

            this.createStaticBox(
                { x: offset.x + rx, y: offset.y + 2, z: offset.z + rz },
                floorQ,
                { x: 0.5 + Math.sin(i) * 0.2, y: 2 + Math.cos(i), z: 0.5 + Math.sin(i) * 0.2 },
                [0.55, 0.27, 0.07]
            );
        }
    }

    createGoalZone(offset, color) {
        const q = { x: 0, y: 0, z: 0, w: 1 };
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            q,
            { x: 2, y: 0.25, z: 2 },
            color || [1.0, 0.84, 0.0],
            'glass'
        );
        
        // Create enhanced goal visual effects
        this.createGoalEffects(offset, color || [1.0, 0.84, 0.0]);
    }

    createGoalEffects(goalPos, baseColor) {
        if (!this.goalEffects) this.goalEffects = [];
        
        const F = this.Filament;
        const goldColor = [1.0, 0.84, 0.0];
        const amberColor = [1.0, 0.6, 0.0];
        
        // Create 3 concentric glowing rings floating above goal
        const rings = [];
        const ringConfigs = [
            { radius: 1.2, height: 1.5, speed: 0.5, phase: 0 },
            { radius: 0.9, height: 2.0, speed: 0.7, phase: Math.PI * 0.67 },
            { radius: 0.6, height: 2.5, speed: 0.9, phase: Math.PI * 1.33 }
        ];
        
        for (let i = 0; i < ringConfigs.length; i++) {
            const config = ringConfigs[i];
            const ringEntity = F.EntityManager.get().create();
            const ringMat = this.material.createInstance();
            
            // Golden emissive color with slight variation per ring
            const ringColor = i === 0 ? goldColor : (i === 1 ? [1.0, 0.75, 0.2] : [1.0, 0.9, 0.4]);
            ringMat.setColor3Parameter('baseColor', F.RgbType.sRGB, ringColor);
            ringMat.setFloatParameter('roughness', 0.1);
            
            // Create thin ring geometry using flattened box
            F.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [config.radius, 0.02, config.radius] })
                .material(0, ringMat)
                .geometry(0, F.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
                .receiveShadows(false)
                .castShadows(false)
                .build(this.engine, ringEntity);
            
            this.scene.addEntity(ringEntity);
            
            rings.push({
                entity: ringEntity,
                matInstance: ringMat,
                baseY: goalPos.y + config.height,
                radius: config.radius,
                rotationSpeed: config.speed,
                bobPhase: config.phase,
                bobSpeed: 1.5 + i * 0.3,
                bobHeight: 0.15,
                index: i
            });
        }
        
        // Create pulsing point light at goal center
        const lightEntity = F.EntityManager.get().create();
        F.LightManager.Builder(F['LightManager$Type'].POINT)
            .color(amberColor)
            .intensity(50000.0)
            .position([goalPos.x, goalPos.y + 2, goalPos.z])
            .falloffRadius(15.0)
            .build(this.engine, lightEntity);
        this.scene.addEntity(lightEntity);
        
        // Create particle fountain spawners
        const particleSpawner = {
            nextSpawnTime: 0,
            spawnInterval: 50, // ms between spawns
            particles: []
        };
        
        const goalEffect = {
            pos: { ...goalPos },
            rings: rings,
            light: lightEntity,
            baseColor: baseColor,
            particleSpawner: particleSpawner,
            state: 'idle', // 'idle', 'near', 'completed'
            baseIntensity: 50000.0,
            nearIntensity: 150000.0,
            time: 0,
            id: this.goalEffects.length
        };
        
        this.goalEffects.push(goalEffect);
        return goalEffect;
    }

    updateGoalEffects(deltaTime, playerPos) {
        if (!this.goalEffects || this.goalEffects.length === 0) return;
        
        const now = Date.now();
        const F = this.Filament;
        const tcm = this.engine.getTransformManager();
        
        for (const effect of this.goalEffects) {
            effect.time += deltaTime;
            
            // Calculate distance to player for intensity changes
            let playerDist = Infinity;
            if (playerPos) {
                const dx = playerPos.x - effect.pos.x;
                const dy = playerPos.y - effect.pos.y;
                const dz = playerPos.z - effect.pos.z;
                playerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
            
            // Determine state based on distance
            const wasNear = effect.state === 'near';
            if (playerDist < 10) {
                effect.state = 'near';
            } else {
                effect.state = 'idle';
            }
            
            // Update pulsing light intensity
            const pulseSpeed = effect.state === 'near' ? 8 : 4;
            const baseInt = effect.state === 'near' ? effect.nearIntensity : effect.baseIntensity;
            const pulseIntensity = baseInt * (0.8 + 0.2 * Math.sin(effect.time * pulseSpeed));
            
            // Update light - rebuild with new intensity
            if (effect.light) {
                F.LightManager.Builder(F['LightManager$Type'].POINT)
                    .color([1.0, 0.6, 0.0])
                    .intensity(pulseIntensity)
                    .position([effect.pos.x, effect.pos.y + 2, effect.pos.z])
                    .falloffRadius(effect.state === 'near' ? 20 : 15)
                    .build(this.engine, effect.light);
            }
            
            // Update rings - rotation and bobbing
            for (const ring of effect.rings) {
                // Rotation
                ring.rotation += ring.rotationSpeed * deltaTime * (effect.state === 'near' ? 2 : 1);
                
                // Vertical bobbing (sine wave)
                const bobOffset = Math.sin(effect.time * ring.bobSpeed + ring.bobPhase) * ring.bobHeight;
                const y = ring.baseY + bobOffset;
                
                // Create transform matrix with rotation around Y axis
                const cosR = Math.cos(ring.rotation);
                const sinR = Math.sin(ring.rotation);
                
                // Build rotation matrix for Y-axis rotation
                const mat = new Float32Array([
                    cosR * ring.radius, 0, sinR * ring.radius, 0,
                    0, 0.02, 0, 0,
                    -sinR * ring.radius, 0, cosR * ring.radius, 0,
                    effect.pos.x, y, effect.pos.z, 1
                ]);
                
                const inst = tcm.getInstance(ring.entity);
                tcm.setTransform(inst, mat);
                
                // Fade rings in sequence
                if (effect.state === 'near') {
                    // All rings bright when near
                    ring.matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, [1.0, 0.95, 0.5]);
                } else {
                    // Sequential fade based on time
                    const fadePhase = (effect.time * 0.5 + ring.index * 0.3) % 3;
                    const brightness = fadePhase < 1 ? fadePhase : (fadePhase < 2 ? 1 : 3 - fadePhase);
                    const r = 1.0;
                    const g = 0.84 * brightness;
                    const b = 0.0;
                    ring.matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, [r, g, b]);
                }
            }
            
            // Spawn particle fountain particles
            if (now > effect.particleSpawner.nextSpawnTime) {
                effect.particleSpawner.nextSpawnTime = now + effect.particleSpawner.spawnInterval;
                this.spawnGoalParticle(effect);
            }
        }
    }

    spawnGoalParticle(effect) {
        const F = this.Filament;
        const particleEntity = F.EntityManager.get().create();
        const particleMat = this.material.createInstance();
        
        // Golden sparkle color with slight variation
        const hue = Math.random() * 0.1; // Slight gold variation
        const brightness = 0.8 + Math.random() * 0.2;
        particleMat.setColor3Parameter('baseColor', F.RgbType.sRGB, 
            [brightness, brightness * 0.9, brightness * 0.3]);
        particleMat.setFloatParameter('roughness', 0.0);
        
        F.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.05, 0.05, 0.05] })
            .material(0, particleMat)
            .geometry(0, F.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, particleEntity);
        
        this.scene.addEntity(particleEntity);
        
        // Random position in center area with outward velocity
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.3;
        const x = effect.pos.x + Math.cos(angle) * radius;
        const z = effect.pos.z + Math.sin(angle) * radius;
        const y = effect.pos.y + 0.5;
        
        // Upward velocity with slight spread
        const spread = 0.5;
        const vel = {
            x: (Math.random() - 0.5) * spread,
            y: 1.5 + Math.random() * 1.0, // Upward
            z: (Math.random() - 0.5) * spread
        };
        
        this.visualParticles.push({
            entity: particleEntity,
            matInstance: particleMat,
            pos: { x, y, z },
            vel: vel,
            spawnTime: Date.now(),
            duration: 1500 + Math.random() * 500,
            scale: 1.0,
            isGoalParticle: true
        });
    }

    triggerGoalCompletionEffect(goalId) {
        if (!this.goalEffects) return;
        
        const effect = this.goalEffects[goalId];
        if (!effect) return;
        
        effect.state = 'completed';
        
        // Burst effect - spawn many particles
        for (let i = 0; i < 30; i++) {
            setTimeout(() => this.spawnGoalParticle(effect), i * 20);
        }
        
        // Flash all rings bright
        for (const ring of effect.rings) {
            ring.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 1.0, 0.8]);
        }
        
        // Temporarily boost light
        if (effect.light) {
            this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
                .color([1.0, 1.0, 0.5])
                .intensity(300000.0)
                .position([effect.pos.x, effect.pos.y + 2, effect.pos.z])
                .falloffRadius(30.0)
                .build(this.engine, effect.light);
        }
        
        // Return to normal after 1 second
        setTimeout(() => {
            effect.state = 'idle';
        }, 1000);
    }

    setNightMode(enabled, bgColor) {
        const F = this.Filament
        if (enabled) {
            this.currentClearColor = bgColor || [0.02, 0.02, 0.08, 1.0];
            this.renderer.setClearOptions({ clearColor: this.currentClearColor, clear: true });

            const shadowOpts = F.shadowOptions ? F.shadowOptions({
                mapSize: 2048,
                shadowCascades: 2,
                constantBias: 0.0005,
                normalBias: 1.5,
                stable: true,
                screenSpaceContactShadows: true,
                stepCount: 16
            }) : undefined

            F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
                .color([0.4, 0.5, 0.7])
                .intensity(20000.0)
                .direction([0.3, -1.0, -0.5])
                .castShadows(true)
                .build(this.engine, this.light);

            F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
                .color([0.3, 0.2, 0.5])
                .intensity(5000.0)
                .direction([-0.3, -0.3, 0.8])
                .castShadows(false)
                .build(this.engine, this.fillLight);

            F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
                .color([0.2, 0.2, 0.3])
                .intensity(3000.0)
                .direction([0.0, 1.0, 0.0])
                .castShadows(false)
                .build(this.engine, this.backLight);
        } else {
            this.currentClearColor = [0.1, 0.1, 0.1, 1.0];
            this.renderer.setClearOptions({ clearColor: this.currentClearColor, clear: true });
            this.createLight();
        }
    }

    createOrchardZone(center, radius) {
        const cx = center.x, cy = center.y, cz = center.z, r = radius || 60;
        const ringRadius = r * 0.4, ringWidth = 8, segments = 24;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = cx + Math.cos(angle) * ringRadius;
            const z = cz + Math.sin(angle) * ringRadius;
            this.createStaticBox(
                { x, y: cy, z },
                { x: 0, y: 0, z: 0, w: 1 },
                { x: ringWidth / 2, y: 0.3, z: (2 * Math.PI * ringRadius / segments) / 2 + 1 },
                [0.4, 0.25, 0.15]
            );
        }

        this.createStaticBox({ x: cx, y: cy - 0.2, z: cz }, { x: 0, y: 0, z: 0, w: 1 }, { x: ringRadius - 2, y: 0.5, z: ringRadius - 2 }, [0.1, 0.25, 0.1]);

        [[cx + r, cz, r * 0.4, r], [cx - r, cz, r * 0.4, r], [cx, cz + r, r, r * 0.4], [cx, cz - r, r, r * 0.4]].forEach(([x, z, sx, sz]) => {
            this.createStaticBox({ x, y: cy - 0.2, z }, { x: 0, y: 0, z: 0, w: 1 }, { x: sx, y: 0.5, z: sz }, [0.08, 0.2, 0.08]);
        });

        const fruitColors = [[1.0, 0.2, 0.5], [0.2, 0.8, 1.0], [0.8, 0.3, 1.0], [1.0, 0.8, 0.2], [0.2, 1.0, 0.5]];
        const treeSpacing = 15, rowCount = 3, treeDistance = 25;

        for (let row = -rowCount; row <= rowCount; row++) {
            for (let col = -2; col <= 2; col++) {
                const tx = cx + col * treeSpacing, tz = cz + row * treeDistance + (col % 2) * 7;
                const dist = Math.sqrt(tx * tx + tz * tz);
                if (dist < ringRadius + 5 || dist > r - 5) continue;
                this.createTree(tx, cy, tz, fruitColors[Math.abs((row + rowCount) * 3 + col) % fruitColors.length]);
            }
        }

        this.createStaticBox({ x: cx, y: cy + 0.5, z: cz + ringRadius }, { x: 0, y: 0, z: 0, w: 1 }, { x: 4, y: 0.5, z: 4 }, [0.9, 0.9, 1.0]);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            this.createStaticBox({ x: cx + Math.cos(angle) * 3, y: cy + 2, z: cz + ringRadius + Math.sin(angle) * 3 }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0.3, y: 0.3, z: 0.3 }, [1.0, 0.9, 0.5]);
        }
    }

    createTree(x, y, z, fruitColor) {
        for (let i = 0; i < 4; i++) {
            const w = 0.8 - i * 0.1;
            this.createStaticBox({ x, y: y + 1 + i * 1.5, z }, { x: 0, y: 0, z: 0, w: 1 }, { x: w, y: 0.8, z: w }, [0.25, 0.15, 0.08]);
        }

        const canopyY = y + 6;
        [[0, 0, 0, 2], [1.5, 0.5, 0, 1.2], [-1.5, 0.5, 0, 1.2], [0, 0.5, 1.5, 1.2], [0, 0.5, -1.5, 1.2], [0, 1.5, 0, 1.5]].forEach(([px, py, pz, s]) => {
            this.createStaticBox({ x: x + px, y: canopyY + py, z: z + pz }, { x: 0, y: 0, z: 0, w: 1 }, { x: s, y: s * 0.8, z: s }, [0.15, 0.35, 0.15]);
        });

        [[1.2, 0.5, 1.2], [-1.2, 0.5, -1.2], [1.2, -0.5, -1.2], [-1.2, -0.5, 1.2], [0, 2, 0], [0.8, 1, 0], [-0.8, 1, 0], [0, 1, 0.8]].forEach(([px, py, pz]) => {
            this.createStaticBox({ x: x + px, y: canopyY + py, z: z + pz }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0.25, y: 0.35, z: 0.25 }, fruitColor);
        });
    }

}

export function applyZoneMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(ZoneMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = ZoneMethods.prototype[name];
        }
    }
}
