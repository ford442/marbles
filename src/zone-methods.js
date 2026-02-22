import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from './audio.js';
import { quatFromEuler, quaternionToMat4 } from './math.js';

export class ZoneMethods {
    createCheckpointZone(offset, size) {
        const sz = size || { x: 10, y: 5, z: 2 };
        const center = { x: offset.x, y: offset.y + sz.y / 2, z: offset.z };
        const q = { x: 0, y: 0, z: 0, w: 1 };
        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0]);
        matInstance.setFloatParameter('roughness', 0.1);
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [sz.x / 2, sz.y / 2, sz.z / 2] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, entity);
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

        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.2);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.4, 0.4, 0.4] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
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

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 4, y: 0.5, z: 5 },
            [0.1, 0.1, 0.2],
            'concrete'
        );

        for (let i = 0; i < 15; i++) {
            const z = offset.z + 8 + i * 4;
            const side = (i % 2 === 0) ? 1 : -1;
            const x = offset.x + side * 3.5;

            const h = 1.5 + Math.abs(Math.sin(i * 12.9898)) * 2.5;
            const color = buildingColors[i % buildingColors.length];

            this.createStaticBox(
                { x: x, y: offset.y + h/2, z: z },
                floorQ,
                { x: 1.5, y: h/2, z: 1.5 },
                color,
                'metal'
            );

            this.createStaticBox(
                { x: offset.x, y: offset.y, z: z },
                floorQ,
                { x: 2, y: 0.5, z: 2 },
                [0.1, 0.1, 0.2],
                'concrete'
            );
        }

        const rampZ = offset.z + 72;
        const angle = -0.35;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

        this.createStaticBox(
            { x: offset.x, y: offset.y + 1.5, z: rampZ },
            rampQ,
            { x: 2, y: 0.2, z: 5 },
            [1.0, 0.0, 0.5],
            'wood'
        );

        this.createStaticBox(
            { x: offset.x, y: offset.y + 2, z: rampZ + 12 },
            floorQ,
            { x: 3, y: 0.5, z: 5 },
            [0.2, 0.2, 0.4],
            'concrete'
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
    }

    setNightMode(enabled, bgColor) {
        if (enabled) {
            this.currentClearColor = bgColor || [0.02, 0.02, 0.08, 1.0];
            this.renderer.setClearOptions({ clearColor: this.currentClearColor, clear: true });

            this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].DIRECTIONAL)
                .color([0.4, 0.5, 0.7])
                .intensity(20000.0)
                .direction([0.3, -1.0, -0.5])
                .castShadows(true)
                .build(this.engine, this.light);

            this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].DIRECTIONAL)
                .color([0.3, 0.2, 0.5])
                .intensity(5000.0)
                .direction([-0.3, -0.3, 0.8])
                .castShadows(false)
                .build(this.engine, this.fillLight);

            this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].DIRECTIONAL)
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
