import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainJsPath = path.join(__dirname, 'src', 'marbles_data.js');

try {
    const content = fs.readFileSync(mainJsPath, 'utf8');
    const lines = content.split('\n');

    let success = true;

    function checkMarble(name, requiredProps) {
        let marbleLine = null;
        for (const line of lines) {
            if (line.includes(`name: "${name}"`)) {
                marbleLine = line;
                break;
            }
        }

        if (marbleLine) {
            console.log(`SUCCESS: ${name} marble found in marblesInfo.`);

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
            console.error(`FAILURE: ${name} marble NOT found in marblesInfo.`);
            success = false;
        }
    }

    checkMarble("Obsidian", ['color', 'radius', 'density', 'friction', 'restitution']);
    checkMarble("Digital Cube", ['geometry: \'cube\'', 'color', 'radius', 'density']);
    checkMarble("Sun", ['color', 'radius', 'density', 'emissive: true', 'lightIntensity']);

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
