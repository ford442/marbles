import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const marblesDataPath = path.join(__dirname, '..', 'src', 'marbles_data.js');

function checkMarble(lines, name, requiredProps) {
    let marbleLine = null;
    for (const line of lines) {
        if (line.includes(`name: "${name}"`)) {
            marbleLine = line;
            break;
        }
    }

    if (marbleLine) {
        console.log(`SUCCESS: ${name} marble found.`);

        const missing = [];
        for (const p of requiredProps) {
            if (!marbleLine.includes(p)) {
                missing.push(p);
            }
        }

        if (missing.length > 0) {
            console.error(`FAILURE: ${name} marble missing properties: ${missing.join(', ')}`);
            return false;
        }
        console.log(`SUCCESS: ${name} marble has all required properties.`);
        return true;
    }

    console.error(`FAILURE: ${name} marble NOT found.`);
    return false;
}

try {
    const dataContent = fs.readFileSync(marblesDataPath, 'utf8');
    const lines = [...dataContent.split('\n')];

    let success = true;
    const run = (name, props) => {
        if (!checkMarble(lines, name, props)) success = false;
    };

    run('Obsidian', ['color', 'radius', 'density', 'friction', 'restitution']);
    run('Digital Cube', ['geometry: \'cube\'', 'color', 'radius', 'density']);
    run('Sun', ['color', 'radius', 'density', 'emissive: true', 'lightIntensity']);
    run('Chameleon', ['rainbow: true']);
    run('Crystal', ['color', 'radius', 'density', 'friction', 'restitution', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Ghost', ['color', 'radius', 'density', 'gravityScale', 'friction', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Quasar', ['color', 'radius', 'density', 'restitution', 'friction', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Aether', ['color', 'radius', 'density', 'gravityScale', 'friction', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Radiant Spark', ['color', 'radius', 'density', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Supernova', ['color', 'radius', 'density', 'friction', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Galactic Core', ['color', 'radius', 'density', 'friction', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Thunderbolt', ['color', 'radius', 'density', 'gravityScale', 'restitution', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Echo Prism', ['color', 'radius', 'density', 'emissive: true', 'lightIntensity']);
    run('Sapphire Bullet', ['color', 'radius', 'density', 'friction', 'restitution', 'materialType: "glass"', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Celestial Pearl', ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Abyssal Eye', ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Void Walker', ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Ethereal Juggernaut', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Hyper-Bouncing Prism', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Astral Jumper', ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Phantom Glass', ['color', 'radius', 'density', 'friction', 'restitution', 'roughness', 'gravityScale', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Aegis Diamond', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Omega Titan', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Infinity Glass', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Quantum Phoenix', ['color', 'radius', 'density', 'friction', 'restitution', 'gravityScale', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Nebula Smasher', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Cosmic Prism', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Hypernova Glass', ['color', 'radius', 'density', 'restitution', 'friction', 'clearCoat', 'clearCoatRoughness', 'materialType: "glass"', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Chronos Jewel', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Starlight Ruby', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Celestial Juggernaut', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Galactic Titan', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Quantum Leviathan', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Quantum Obliterator', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Celestial Singularity', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Astral Behemoth', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Aetherium Catalyst', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);


    if (!success) {
        console.error('Some marble checks failed.');
        process.exit(1);
    }
    console.log('All marble checks passed!');
} catch (err) {
    console.error('Error reading file:', err);
    process.exit(1);
}
