import type { AbilitySlicesHost } from '../abilities/index.ts';
import type { GameLogicSlicesHost } from '../game-logic/index.ts';
import type { GameLoopSlicesHost } from '../game-loop/index.ts';
import type { InitCore } from '../init/core.ts';
import type { InitSlicesHost } from '../init/index.ts';
import type { ZoneSetupSlicesHost } from '../zone-setup/index.ts';
import type { ZoneMethodSlicesHost } from '../zones/methods/index.ts';
import type { GameHost } from './game-host.ts';

/**
 * The whole game object as `main.js` builds it: the composed systems'
 * contract (`GameHost`, which `create-runtime.ts` takes) plus every feature
 * slice's host (`*_SLICES`, composed by `composeSlices`). Kept separate from
 * `GameHost` because the frame slices are typed against `FrameHost`, which
 * itself includes `GameHost`.
 *
 * No index signature; `create-runtime.types-test.ts` checks that no member
 * collapses to `never`, i.e. that no two hosts disagree about a field.
 */
export type MarblesGameHost =
    & GameHost
    & ZoneMethodSlicesHost
    & InitSlicesHost
    & ZoneSetupSlicesHost
    & GameLogicSlicesHost
    & AbilitySlicesHost
    & GameLoopSlicesHost
    // Called by main.js itself (boot), not by any slice.
    & Pick<InitCore, 'init'>;
