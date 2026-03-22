export function createBouncyCastleZone(game, startZ) {
    // Entrance platform
    game.createStaticBox(/* parameters for entrance platform */);

    // Bouncy obstacles (kinematic and dynamic)
    game.createKinematicBox(/* parameters for moving obstacle */);
    game.createDynamicBox(/* parameters for bouncy box */);

    // Power-up
    game.createPowerUp(/* parameters for speed/jump boost */);

    // Exit platform
    game.createStaticBox(/* parameters for exit platform */);

    // Goal
    game.createGoalZone(/* parameters for goal */);

    return 40; // placeholder length
}
