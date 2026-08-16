import { quatFromEuler } from '../../math.ts';
import { materialPresets } from '../../material-system.ts';

/**
 * Creation methods for themed environments, setpieces, and physics playgrounds.
 */
export const themedCreationMethods = {
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
    },

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
    },

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
    },

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
    },

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
    },

    createForestZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 10, y: 0.5, z: 20 },
            [0.2, 0.5, 0.2],
            'sand'
        );

        for (let i = 0; i < 20; i++) {
            const rx = (Math.sin(i * 12.9898) * 9);
            const rz = (Math.cos(i * 78.233) * 19);

            this.createStaticBox(
                { x: offset.x + rx, y: offset.y + 2, z: offset.z + rz },
                floorQ,
                { x: 0.5 + Math.sin(i) * 0.2, y: 2 + Math.cos(i), z: 0.5 + Math.sin(i) * 0.2 },
                [0.55, 0.27, 0.07],
                'wood'
            );
        }
    },

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
    },

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
    },
};
