/**
 * Test suite for glass refraction & caustics implementation
 */

import fs from 'fs';

console.log('=== Testing Glass Refraction System ===\n');

const checks = [
    {
        name: 'Material .mat has glass refraction parameters',
        check: () => {
            const content = fs.readFileSync('public/custom_material_procedural.mat', 'utf-8');
            return content.includes('name : refractionMode') &&
                   content.includes('name : thickness') &&
                   content.includes('name : causticIntensity') &&
                   content.includes('name : chromaticDispersion') &&
                   content.includes('name : fresnelStrength');
        }
    },
    {
        name: 'Fragment shader implements glass refraction logic',
        check: () => {
            const content = fs.readFileSync('public/custom_material_procedural.mat', 'utf-8');
            return content.includes('materialParams.refractionMode') &&
                   content.includes('materialParams.causticIntensity') &&
                   content.includes('materialParams.fresnelStrength') &&
                   content.includes('mix(0.04, 1.0, pow(1.0 - NdotV, 5.0))');
        }
    },
    {
        name: 'Compiled material file updated',
        check: () => {
            const stats = fs.statSync('public/baked_procedural.filament');
            return stats.size > 350000 && stats.size < 450000;
        }
    },
    {
        name: 'getGlassQualityConfig function exported',
        check: () => {
            const content = fs.readFileSync('src/rendering/post-fx-presets.js', 'utf-8');
            return content.includes('export function getGlassQualityConfig');
        }
    },
    {
        name: 'Glass quality configs define all quality tiers',
        check: () => {
            const content = fs.readFileSync('src/rendering/post-fx-presets.js', 'utf-8');
            return content.includes("case 'ultra':") && 
                   content.includes("case 'high':") &&
                   content.includes("case 'medium':") &&
                   content.includes("case 'low':");
        }
    },
    {
        name: 'Glass quality config has correct refraction modes',
        check: () => {
            const content = fs.readFileSync('src/rendering/post-fx-presets.js', 'utf-8');
            const hasModes = content.includes('refractionMode: 2.0') && // ultra/high
                             content.includes('refractionMode: 1.0') && // medium
                             content.includes('refractionMode: 0.0');   // low
            return hasModes;
        }
    },
    {
        name: 'Glass quality config exported from rendering-defaults',
        check: () => {
            const content = fs.readFileSync('src/rendering-defaults.js', 'utf-8');
            return content.includes('getGlassQualityConfig');
        }
    },
    {
        name: 'Material system handles glass parameters',
        check: () => {
            const content = fs.readFileSync('src/material-system.js', 'utf-8');
            return content.includes("setFloatParameter('refractionMode'") &&
                   content.includes("setFloatParameter('thickness'") &&
                   content.includes("setFloatParameter('causticIntensity'") &&
                   content.includes("setFloatParameter('chromaticDispersion'") &&
                   content.includes("setFloatParameter('fresnelStrength'");
        }
    },
    {
        name: 'Marble creation applies glass quality config',
        check: () => {
            const content = fs.readFileSync('src/marble-material-tier.js', 'utf-8');
            return content.includes('getGlassQualityConfig') &&
                   content.includes("presetName === 'classicGlass'") &&
                   content.includes('glass.refractionMode');
        }
    },
    {
        name: 'classicGlass preset includes refraction parameters',
        check: () => {
            const content = fs.readFileSync('src/material-presets.js', 'utf-8');
            const glassMatch = content.match(/classicGlass:\s*{[\s\S]*?refractionMode:\s*2\.0[\s\S]*?}/);
            if (!glassMatch) return false;
            const preset = glassMatch[0];
            return preset.includes('refractionMode:') &&
                   preset.includes('thickness:') &&
                   preset.includes('causticIntensity:') &&
                   preset.includes('chromaticDispersion:') &&
                   preset.includes('fresnelStrength:');
        }
    },
    {
        name: 'Ghost marble uses classicGlass material',
        check: () => {
            const content = fs.readFileSync('src/marbles_data.js', 'utf-8');
            return content.includes('Ghost') && content.includes('classicGlass');
        }
    },
    {
        name: 'Glass Bridge zone exists',
        check: () => {
            return fs.existsSync('src/zones/glass-bridge.js');
        }
    }
];

let passed = 0;
let failed = 0;

checks.forEach((check, i) => {
    try {
        if (check.check()) {
            console.log(`✓ ${check.name}`);
            passed++;
        } else {
            console.log(`✗ ${check.name}`);
            failed++;
        }
    } catch (e) {
        console.log(`✗ ${check.name} (error: ${e.message})`);
        failed++;
    }
});

console.log(`\n=== Summary ===`);
console.log(`✓ Passed: ${passed}/${checks.length}`);
console.log(`✗ Failed: ${failed}/${checks.length}`);

if (failed === 0) {
    console.log('\n✓✓✓ All glass refraction implementation checks passed! ✓✓✓');
    process.exit(0);
} else {
    console.log('\n✗ Some checks failed');
    process.exit(1);
}
