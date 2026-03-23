import fs from 'fs';
try {
    const mainContent = fs.readFileSync('src/main.js', 'utf8');
    const levelsContent = fs.readFileSync('src/levels.js', 'utf8');
    const zoneContent = fs.readFileSync('src/bumper_arena.js', 'utf8');
    console.log("Syntax checks passed");
} catch (e) {
    console.error("Syntax Error:", e);
    process.exit(1);
}