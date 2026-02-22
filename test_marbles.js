import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainJsPath = path.join(__dirname, 'src', 'main.js');

try {
    const content = fs.readFileSync(mainJsPath, 'utf8');
    const lines = content.split('\n');

    let obsidianLine = null;
    for (const line of lines) {
        if (line.includes('name: "Obsidian"')) {
            obsidianLine = line;
            break;
        }
    }

    if (obsidianLine) {
        console.log("SUCCESS: Obsidian marble found in marblesInfo.");
        console.log("Line:", obsidianLine.trim());

        const requiredProps = ['color', 'radius', 'density', 'friction', 'restitution'];
        const missing = [];
        for (const p of requiredProps) {
            if (!obsidianLine.includes(p)) {
                missing.push(p);
            }
        }

        if (missing.length > 0) {
            console.error(`FAILURE: Obsidian marble missing properties: ${missing.join(', ')}`);
            process.exit(1);
        }
        console.log("SUCCESS: Obsidian marble has all required properties.");
    } else {
        console.error("FAILURE: Obsidian marble NOT found in marblesInfo.");
        process.exit(1);
    }

} catch (err) {
    console.error("Error reading file:", err);
    process.exit(1);
}
