/**
 * Compile-time fixture (never imported at runtime): `npm run typecheck` fails
 * if `createRuntime` stops rejecting a host that lacks a field one of the
 * composed systems requires, or if two `*Host` interfaces disagree so badly
 * that a `GameHost` member collapses to `never`.
 *
 * Each `@ts-expect-error` below is itself checked: if the line stops being an
 * error (the field became optional, or `createRuntime` accepts `any`), tsc
 * reports "Unused '@ts-expect-error' directive".
 */
import type { FrameHost } from '../types/frame-host.ts';
import type { GameHost } from '../types/game-host.ts';
import { createRuntime } from './create-runtime.ts';

declare const host: GameHost;
type Without<K extends keyof GameHost> = Omit<GameHost, K>;

createRuntime(host);

// One required field from each host interface that has any.
// @ts-expect-error `canvas`: InputSystemHost
createRuntime({} as Without<'canvas'>);
// @ts-expect-error `engine`: PhysicsWorldHost
createRuntime({} as Without<'engine'>);
// @ts-expect-error `physicsWorld`: PhysicsBackendHost
createRuntime({} as Without<'physicsWorld'>);
// @ts-expect-error `updateGoalEffects`: HudControllerHost
createRuntime({} as Without<'updateGoalEffects'>);
// @ts-expect-error `tickFrameInput`: RenderPipelineHost
createRuntime({} as Without<'tickFrameInput'>);
// @ts-expect-error `startGrapple`: InputSystemHost
createRuntime({} as Without<'startGrapple'>);

// No member of either intersection may be unsatisfiable.
type NeverKeys<T> = { [K in keyof T]-?: [T[K]] extends [never] ? K : never }[keyof T];
const noNeverMembers: [NeverKeys<GameHost>] extends [never] ? true : NeverKeys<GameHost> = true;
const noNeverFrameMembers: [NeverKeys<FrameHost>] extends [never] ? true : NeverKeys<FrameHost> = true;

// Neither may grow a string index signature (that is `GameMixinHost`'s job, for now).
type HasStringIndex<T> = string extends keyof T ? true : false;
const noIndexSignature: HasStringIndex<GameHost> extends false ? true : never = true;
const noFrameIndexSignature: HasStringIndex<FrameHost> extends false ? true : never = true;

export { noNeverMembers, noNeverFrameMembers, noIndexSignature, noFrameIndexSignature };
