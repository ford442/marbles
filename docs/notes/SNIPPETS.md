# Code Snippet for the Juggernaut Prism Marble

Here is the exact code snippet containing the definition for the new marble, which should be added to the `premiumMarbles` array in `src/marbles_data.js`:

```javascript
    {
        name: "Juggernaut Prism",
        color: [0.1, 0.9, 0.4],
        offset: { x: 0.0, y: 5, z: 0 },
        radius: 1.2,
        density: 100.0,
        friction: 0.0,
        restitution: 1.8,
        clearCoat: 1.0,
        clearCoatRoughness: 0.0,
        materialType: "glass",
        emissive: true,
        lightIntensity: 120000.0,
        lightColor: [0.1, 1.0, 0.5]
    },
```

## How it works within the Game Loop

The definition automatically ties into the existing system located in `src/game/systems/marble-registry.js`. When `createMarbles(spawnPos)` is called, the game will load, render, and apply physics without any extra required code:

### Physics (Rapier)
The physics properties (`radius`, `density`, `friction`, `restitution`) will be read dynamically to create the Rapier `RigidBody` and `Collider`:

```javascript
// From src/game/systems/marble-registry.js
const colliderDesc = RAPIER.ColliderDesc.ball(radius)
    .setRestitution(info.restitution !== undefined ? info.restitution : 0.5);

if (info.density) colliderDesc.setDensity(info.density);
if (info.friction !== undefined) colliderDesc.setFriction(info.friction);
```

### Rendering (Filament)
The visual properties, including `materialType: "glass"`, `clearCoat`, and `color` will be instantiated dynamically through Filament via `createMarbleMaterialInstance`:

```javascript
// From src/game/systems/marble-registry.js
const { instance: matInstance, preset } = createMarbleMaterialInstance(
    g,
    presetName, // Evaluates to "glass"
    info.color,
    spawnTier,
);

// Overrides are applied automatically for clear-coat, etc.
if (info.clearCoat !== undefined) mat.setFloatParameter('clearCoat', info.clearCoat);
```

### Emissive Lights (Filament)
Because `emissive: true` and `lightIntensity` are specified, the system will automatically create an emissive point light entity and attach it to the marble:

```javascript
// From src/game/systems/marble-registry.js
if (info.emissive) {
    marbleObj.emissive = true;
    marbleObj.lightColor = info.lightColor || info.color;
    marbleObj.lightIntensity = info.lightIntensity || 10000.0;
}
```
