/**
 * The few Node built-ins scripts/level-lab.mjs uses, typed by hand: the repo
 * type-checks browser code and has no @types/node. Ambient *module*
 * declarations only (no globals), so nothing leaks into src/. Pulled in by
 * the `/// <reference path>` in level-lab.mjs.
 */
declare module 'node:fs' {
    export function readFileSync(path: string, encoding: 'utf8'): string;
    const fs: { readFileSync: typeof readFileSync };
    export default fs;
}

declare module 'node:path' {
    export function relative(from: string, to: string): string;
    const path: { relative: typeof relative };
    export default path;
}

declare module 'node:process' {
    const process: {
        argv: string[];
        cwd(): string;
        exit(code?: number): never;
    };
    export default process;
}
