#!/usr/bin/env node
/**
 * Type-check coverage ratchet for src/.
 *
 * A file counts as *typed* when it is part of the `tsconfig.json` program and
 * is either `.ts` or a `.js` file carrying `// @ts-check` (and no
 * `@ts-nocheck`). `checkJs` is off, so plain JS in the program is parsed but
 * never checked.
 *
 * Ratcheted against scripts/ts-coverage-baseline.json, failing when:
 *   - the typed-file count goes down,
 *   - the typed share of src/ LOC goes down, or
 *   - the number of type-check suppressions (`@ts-ignore`,
 *     `@ts-expect-error`, `@ts-nocheck`) in src/ goes up.
 *
 * Usage:
 *   node scripts/ts-coverage.mjs            # check against the baseline (CI)
 *   node scripts/ts-coverage.mjs --update   # write the current numbers as the new baseline
 *   node scripts/ts-coverage.mjs --list     # also print every untyped file, largest first
 *   node scripts/ts-coverage.mjs --json     # machine-readable report
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'ts-coverage-baseline.json');
const SOURCE_EXT = /\.(?:js|ts)$/;
const SUPPRESSION = /@ts-(?:ignore|expect-error|nocheck)\b/g;

const args = new Set(process.argv.slice(2));

/** Every .js/.ts file under src/, repo-relative with forward slashes. */
function listSourceFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listSourceFiles(full));
        else if (SOURCE_EXT.test(entry.name)) out.push(full);
    }
    return out;
}

/** Absolute paths of the files the tsconfig program contains (roots + imports). */
function programFiles() {
    const configPath = path.join(ROOT, 'tsconfig.json');
    const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
    if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, ROOT, undefined, configPath);
    const program = ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true } });
    return new Set(program.getSourceFiles().map((sf) => path.resolve(sf.fileName)));
}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const lineCount = (text) => text.split('\n').length;

function measure() {
    const inProgram = programFiles();
    const files = [];
    for (const file of listSourceFiles(SRC)) {
        const text = fs.readFileSync(file, 'utf8');
        const isTs = file.endsWith('.ts');
        const checked = isTs
            ? !/@ts-nocheck\b/.test(text)
            : /@ts-check\b/.test(text) && !/@ts-nocheck\b/.test(text);
        files.push({
            file: rel(file),
            loc: lineCount(text),
            typed: inProgram.has(path.resolve(file)) && checked,
            suppressions: (text.match(SUPPRESSION) ?? []).length,
        });
    }
    const totalLoc = files.reduce((n, f) => n + f.loc, 0);
    const typed = files.filter((f) => f.typed);
    const typedLoc = typed.reduce((n, f) => n + f.loc, 0);
    return {
        files,
        summary: {
            totalFiles: files.length,
            typedFiles: typed.length,
            totalLoc,
            typedLoc,
            typedLocPct: Math.round((10000 * typedLoc) / totalLoc) / 100,
            suppressions: files.reduce((n, f) => n + f.suppressions, 0),
        },
    };
}

const { files, summary } = measure();

if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify({ summary, files }, null, 2)}\n`);
    process.exit(0);
}

console.log(
    `ts-coverage: ${summary.typedFiles}/${summary.totalFiles} files typed, `
    + `${summary.typedLoc}/${summary.totalLoc} LOC (${summary.typedLocPct}%), `
    + `${summary.suppressions} suppression(s)`,
);

if (args.has('--list')) {
    const untyped = files.filter((f) => !f.typed).sort((a, b) => b.loc - a.loc);
    for (const f of untyped) console.log(`  untyped ${String(f.loc).padStart(5)}  ${f.file}`);
}

if (args.has('--update')) {
    const { typedFiles, typedLocPct, suppressions } = summary;
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify({ typedFiles, typedLocPct, suppressions }, null, 4)}\n`);
    console.log(`ts-coverage: baseline written to ${rel(BASELINE_PATH)}`);
    process.exit(0);
}

if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`ts-coverage: no baseline at ${rel(BASELINE_PATH)}; run with --update`);
    process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
const failures = [];
if (summary.typedFiles < baseline.typedFiles) {
    failures.push(`typed files went down: ${summary.typedFiles} < baseline ${baseline.typedFiles}`);
}
if (summary.typedLocPct < baseline.typedLocPct) {
    failures.push(`typed LOC share went down: ${summary.typedLocPct}% < baseline ${baseline.typedLocPct}%`);
}
if (summary.suppressions > baseline.suppressions) {
    failures.push(`type-check suppressions went up: ${summary.suppressions} > baseline ${baseline.suppressions}`);
}

if (failures.length) {
    for (const f of failures) console.error(`ts-coverage: FAIL ${f}`);
    console.error('ts-coverage: type new/changed code (`.ts`, or `// @ts-check` + JSDoc and add it to tsconfig.json `include`).');
    console.error('ts-coverage: run `node scripts/ts-coverage.mjs --list` to see untyped files.');
    process.exit(1);
}

const improved = summary.typedFiles > baseline.typedFiles
    || summary.typedLocPct > baseline.typedLocPct
    || summary.suppressions < baseline.suppressions;
if (improved) {
    console.log('ts-coverage: coverage improved; lock it in with `node scripts/ts-coverage.mjs --update`.');
}
