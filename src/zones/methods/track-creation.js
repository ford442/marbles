import { quatFromEuler } from '../../math.ts';
import { decorateSpiralTrack } from './decorations.js';

/**
 * Creation methods for tracks, ramps, loops, platforms, and obstacle courses.
 */
export const trackCreationMethods = {
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
    },

    createFloorZone(offset, size, rotY, color) {
        const sz = size || { x: 50, y: 0.5, z: 50 };
        const q = rotY ? quatFromEuler(rotY, 0, 0) : { x: 0, y: 0, z: 0, w: 1 };
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            q,
            { x: sz.x / 2, y: sz.y / 2, z: sz.z / 2 },
            color || [0.3, 0.3, 0.3],
            'concrete'
        );
    },

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
    },

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

        decorateSpiralTrack(this, offset);
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

    createSplitZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 4, y: 0.5, z: 4 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        this.createStaticBox(
            { x: offset.x - 2, y: offset.y, z: offset.z + 14 },
            floorQ,
            { x: 1, y: 0.5, z: 10 },
            [0.6, 0.3, 0.3],
            'concrete'
        );

        const angle = -0.3;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

        this.createStaticBox(
            { x: offset.x + 2, y: offset.y + 1, z: offset.z + 8 },
            rampQ,
            { x: 1, y: 0.5, z: 4 },
            [0.3, 0.3, 0.6],
            'metal'
        );

        this.createStaticBox(
            { x: offset.x + 2, y: offset.y, z: offset.z + 20 },
            floorQ,
            { x: 1.5, y: 0.5, z: 4 },
            [0.3, 0.3, 0.6],
            'metal'
        );

        this.createStaticBox(
            { x: offset.x, y: offset.y - 1, z: offset.z + 30 },
            floorQ,
            { x: 4, y: 0.5, z: 4 },
            [0.4, 0.4, 0.4],
            'concrete'
        );
    },
};
