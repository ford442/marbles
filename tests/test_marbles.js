import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainJsPath = path.join(__dirname, '..', 'src', 'marbles_data.js');
const marbleDraftPath = path.join(__dirname, '..', 'src', 'marble_draft.js');

try {
    const dataContent = fs.readFileSync(mainJsPath, 'utf8');
    const draftContent = fs.readFileSync(marbleDraftPath, 'utf8');

    const lines = [...dataContent.split('\n')];

    let success = true;

    function checkMarble(name, requiredProps, isDraft=false) {
        if (isDraft) {
            console.log(`Checking draft marble: ${name}`);
            if (draftContent.includes(`name: "${name}"`)) {
                console.log(`SUCCESS: ${name} marble found.`);
                const missing = [];
                for (const p of requiredProps) {
                    if (!draftContent.includes(p)) {
                        missing.push(p);
                    }
                }
                if (missing.length > 0) {
                    console.error(`FAILURE: ${name} marble missing properties: ${missing.join(', ')}`);
                    success = false;
                } else {
                    console.log(`SUCCESS: ${name} marble has all required properties.`);
                }
            } else {
                console.error(`FAILURE: ${name} marble NOT found.`);
                success = false;
            }
            return;
        }

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
                success = false;
            } else {
                console.log(`SUCCESS: ${name} marble has all required properties.`);
            }
        } else {
            console.error(`FAILURE: ${name} marble NOT found.`);
            success = false;
        }
    }

    checkMarble("Obsidian", ['color', 'radius', 'density', 'friction', 'restitution']);
    checkMarble("Digital Cube", ['geometry: \'cube\'', 'color', 'radius', 'density']);
    checkMarble("Sun", ['color', 'radius', 'density', 'emissive: true', 'lightIntensity']);
    checkMarble("Chameleon", ['rainbow: true']);
    checkMarble("Crystal", ['color', 'radius', 'density', 'friction', 'restitution', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    checkMarble("Ghost", ['color', 'radius', 'density', 'gravityScale', 'friction', 'emissive: true', 'lightIntensity', 'lightColor']);
    checkMarble("Quasar", ['color', 'radius', 'density', 'restitution', 'friction', 'emissive: true', 'lightIntensity', 'lightColor']);
    checkMarble("Aether", ['color', 'radius', 'density', 'gravityScale', 'friction', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    checkMarble("Radiant Spark", ['color', 'radius', 'density', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    checkMarble("Supernova", ['color', 'radius', 'density', 'friction', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    checkMarble("Galactic Core", ['color', 'radius', 'density', 'friction', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    checkMarble("Thunderbolt", ['color', 'radius', 'density', 'gravityScale', 'restitution', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    checkMarble("Echo Prism", ['color', 'radius', 'density', 'emissive: true', 'lightIntensity']);
    checkMarble("Sapphire Bullet", ['color', 'radius', 'density', 'friction', 'restitution', 'materialType: "glass"', 'emissive: true', 'lightIntensity', 'lightColor']);
    checkMarble("Celestial Pearl", ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor'], true);
    checkMarble("Abyssal Eye", ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor'], true);
    checkMarble("Void Walker", ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor'], true);
    checkMarble("Ethereal Juggernaut", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Astral Jumper", ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor'], true);
    checkMarble("Phantom Glass", ['color', 'radius', 'density', 'friction', 'restitution', 'roughness', 'gravityScale', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Aegis Diamond", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Omega Titan", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Infinity Glass", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Quantum Phoenix", ['color', 'radius', 'density', 'friction', 'restitution', 'gravityScale', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Nebula Smasher", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Cosmic Prism", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Hypernova Glass", ['color', 'radius', 'density', 'restitution', 'friction', 'clearCoat', 'clearCoatRoughness', 'materialType: "glass"', 'emissive: true', 'lightIntensity', 'lightColor'], true);
    checkMarble("Chronos Jewel", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Starlight Ruby", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Celestial Juggernaut", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    checkMarble("Galactic Titan", ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);

    if (!success) {
        console.error("Some marble checks failed.");
        process.exit(1);
    } else {
        console.log("All marble checks passed!");
    }

} catch (err) {
    console.error("Error reading file:", err);
    process.exit(1);
}
