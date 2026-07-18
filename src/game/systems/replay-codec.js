/** Compatibility shim — implementation lives in `replay-codec.ts`. */
export {
    REPLAY_HZ,
    REPLAY_MAGIC,
    REPLAY_VERSION,
    REPLAY_PREFIX,
    encodeReplayBinary,
    decodeReplayBinary,
    encodeReplayString,
    decodeReplayString,
    interpolateFrames,
    sampleReplayAtTime,
} from './replay-codec.ts';
