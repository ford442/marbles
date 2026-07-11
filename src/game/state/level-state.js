/** Level progress, goals, checkpoints, ghost replay. */
export function createLevelState() {
    return {
        currentLevel: null,
        levelStartTime: 0,
        levelComplete: false,
        goalDefinitions: [],
        checkpointDefinitions: [],
        goalEffects: [],
        ghostRecording: [],
        bestGhosts: {},
        ghostPlaybackIndex: 0,
        ghostEntity: null,
        ghostMaterialInstance: null,
        ghostLightEntity: null,
    };
}
