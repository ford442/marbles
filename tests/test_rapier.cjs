const RAPIER = require('@dimforge/rapier3d-compat');

async function run() {
    await RAPIER.init();
    console.log(Object.keys(RAPIER.JointData));
}
run();
