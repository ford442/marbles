/**
 * Composition for the game's feature slices (`init/`, `game-loop/`,
 * `game-logic/`, `abilities/`, `zone-setup/`, `zones/methods/`).
 *
 * Each slice is a class whose instance holds the game as `this.game` and is
 * installed on the game object under `key`. The game forwards the slice's
 * public `methods` to that instance, so `game.spawnBomb()` keeps working for
 * the many call sites (zone factories, HUD buttons, registry hooks) that
 * address the game, while the method body runs on the slice with a typed host.
 *
 * Nothing is copied onto the game prototype: the forwarders only look up
 * `this[key]` and call the method on it (replacing the old `installKnownMethods`
 * mixin copier, which ran slice bodies with the game as `this`).
 */

/** A slice class: constructed once per game with the game as its host. */
export type SliceSystem<H, T extends object = object> = new (game: H) => T;

export interface SliceSpec<H> {
    /** Field on the game object that holds the slice instance. */
    readonly key: string;
    readonly system: SliceSystem<H>;
    /** Public methods the game forwards to the instance. */
    readonly methods: readonly string[];
}

/** Method names of `T` (for checking a slice's forwarded list against its class). */
export type MethodNames<T> = {
    [K in keyof T]-?: T[K] extends (...args: never[]) => unknown ? K : never;
}[keyof T] & string;

/**
 * Declare a slice. `methods` must name methods of the class, so a rename or
 * typo in the forwarded list is a compile error in `.ts` callers.
 */
export function defineSlice<H, T extends object>(
    key: string,
    system: SliceSystem<H, T>,
    methods: readonly MethodNames<T>[],
): SliceSpec<H> {
    return { key, system, methods };
}

/**
 * Build every slice against `game` and install each instance under its key.
 * Throws if a key would overwrite an existing game member.
 */
export function composeSlices<H extends object>(game: H, specs: readonly SliceSpec<H>[]): void {
    const slots = game as Record<string, unknown>;
    for (const spec of specs) {
        if (spec.key in slots) {
            throw new Error(`Slice key "${spec.key}" collides with an existing game member`);
        }
        slots[spec.key] = new spec.system(game);
    }
}

/** Constructor whose prototype receives forwarders (`MarblesGame`, `HeadlessGame`). */
export interface ForwardTarget {
    readonly name: string;
    readonly prototype: object;
}

const forwarded = new WeakMap<object, Map<string, string>>();

/**
 * Define `target.prototype[name]` as `function (...args) { return this[key][name](...args) }`
 * for each name. A name may be forwarded only once per target, so two owners
 * can never silently shadow each other.
 */
export function forwardMethods(target: ForwardTarget, key: string, methodNames: readonly string[]): void {
    let owners = forwarded.get(target.prototype);
    if (!owners) forwarded.set(target.prototype, (owners = new Map()));
    const proto = target.prototype as Record<string, unknown>;
    for (const name of methodNames) {
        const owner = owners.get(name);
        if (owner !== undefined) {
            throw new Error(`${target.name}.${name} is already forwarded to "${owner}"; cannot also forward it to "${key}"`);
        }
        if (Object.prototype.hasOwnProperty.call(proto, name)) {
            throw new Error(`${target.name}.${name} is defined on the class; refusing to forward it to "${key}"`);
        }
        owners.set(name, key);
        proto[name] = function forwardToSlice(this: Record<string, Record<string, (...args: unknown[]) => unknown>>, ...args: unknown[]) {
            return this[key]![name]!(...args);
        };
    }
}

/** Forward every spec's methods, checking each name exists on its slice class. */
export function forwardSliceMethods<H>(target: ForwardTarget, specs: readonly SliceSpec<H>[]): void {
    for (const spec of specs) {
        const proto = spec.system.prototype as Record<string, unknown>;
        for (const name of spec.methods) {
            if (typeof proto[name] !== 'function') {
                throw new Error(`Cannot forward missing method ${spec.system.name}.${name}`);
            }
        }
        forwardMethods(target, spec.key, spec.methods);
    }
}
