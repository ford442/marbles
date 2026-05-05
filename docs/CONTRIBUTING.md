# Contributing to Marbles 3D

Thank you for your interest in contributing! This guide will help you create new assets for the game.

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Maps](#creating-maps)
- [Creating Marbles](#creating-marbles)
- [Creating Sounds](#creating-sounds)
- [Asset Validation](#asset-validation)
- [Submission Guidelines](#submission-guidelines)

## Getting Started

1. Fork the repository
2. Create your assets in the appropriate `/assets/` subdirectory
3. Test your assets locally
4. Submit a pull request

## Asset Structure

```
assets/
├── maps/           # Level definitions (.json)
├── marbles/        # Marble definitions (.json)
├── sounds/         # Sound definitions (.json)
├── materials/      # Material definitions (.json)
└── schemas/        # JSON schemas for validation
```

## Creating Maps

Maps define the 3D environment where marbles roll.

### Quick Start

1. Copy `assets/maps/TEMPLATE.json` to a new file
2. Modify the values to create your map
3. Save as `assets/maps/your_map_id.json`

### Map Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (lowercase, underscores only) |
| `name` | string | Yes | Display name |
| `description` | string | Yes | Brief description |
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `author` | string | No | Your name |
| `difficulty` | string | No | easy/medium/hard/expert |
| `zones` | array | Yes | List of map zones |
| `spawn` | object | Yes | Spawn point {x, y, z} |
| `goals` | array | Yes | Goal detection zones |
| `camera` | object | No | Camera settings |

### Zone Types

- `floor` - Flat ground plane
- `track` - Sloped ramp for rolling
- `landing` - Flat platform for landing
- `jump` - Jump/ramp section
- `slalom` - Obstacle course section
- `staircase` - Step climbing section
- `goal` - Victory zone
- `custom` - Custom zone (advanced)

### Example Map

```json
{
  "id": "my_custom_map",
  "name": "My Custom Map",
  "description": "A fun custom map",
  "version": "1.0.0",
  "author": "Your Name",
  "difficulty": "medium",
  "zones": [
    {
      "type": "floor",
      "pos": { "x": 0, "y": -2, "z": 0 },
      "size": { "x": 50, "y": 0.5, "z": 50 },
      "color": [0.3, 0.3, 0.3]
    },
    {
      "type": "track",
      "pos": { "x": 0, "y": 3, "z": 0 }
    },
    {
      "type": "goal",
      "pos": { "x": 0, "y": 0.25, "z": 32.5 },
      "color": [1.0, 0.84, 0.0]
    }
  ],
  "spawn": { "x": 0, "y": 8, "z": -12 },
  "goals": [
    {
      "id": 1,
      "range": {
        "x": [-2, 2],
        "y": [0, 2],
        "z": [30.5, 34.5]
      }
    }
  ],
  "camera": {
    "mode": "orbit",
    "angle": 0,
    "height": 10,
    "radius": 25
  }
}
```

## Creating Marbles

Marbles are the playable spheres with unique physics and appearance.

### Quick Start

1. Copy `assets/marbles/TEMPLATE.json` to a new file
2. Modify the values to create your marble
3. Save as `assets/marbles/your_marble_id.json`

### Marble Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `description` | string | Yes | Brief description |
| `version` | string | Yes | Semantic version |
| `author` | string | No | Your name |
| `rarity` | string | No | common/uncommon/rare/epic/legendary |
| `appearance` | object | Yes | Visual properties |
| `physics` | object | Yes | Physical properties |

### Physics Properties

- `radius` (0.1-2.0) - Size of the marble
- `density` - Affects mass (higher = heavier)
- `friction` (0-1) - Surface grip (lower = more slippery)
- `restitution` (0-2) - Bounciness (>1 = super bouncy)
- `linearDamping` - Slows down linear movement
- `angularDamping` - Slows down spinning

### Example Marble

```json
{
  "id": "crystal_blue",
  "name": "Crystal Blue",
  "description": "A beautiful blue crystal marble",
  "version": "1.0.0",
  "author": "Your Name",
  "rarity": "rare",
  "appearance": {
    "color": { "r": 0.2, "g": 0.5, "b": 1.0 },
    "roughness": 0.1,
    "metallic": 0.0
  },
  "physics": {
    "radius": 0.5,
    "density": 1.0,
    "friction": 0.3,
    "restitution": 0.6
  }
}
```

## Creating Sounds

Sounds enhance the game experience.

### Quick Start

1. Copy `assets/sounds/TEMPLATE.json` to a new file
2. Add your audio files to the sounds directory
3. Update the sound definition
4. Save as `assets/sounds/your_sound_id.json`

### Sound Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `category` | string | Yes | sfx/music/ambient/ui |
| `files` | array | Yes | Audio file variants |
| `properties` | object | No | Playback settings |
| `trigger` | object | No | When to play (for SFX) |

### Supported Audio Formats

- MP3 (recommended for compatibility)
- OGG
- WAV

### Example Sound

```json
{
  "id": "bounce_rubber",
  "name": "Rubber Bounce",
  "description": "Bouncy rubber sound effect",
  "version": "1.0.0",
  "author": "Your Name",
  "category": "sfx",
  "files": [
    { "path": "sounds/bounce_01.mp3", "weight": 1 },
    { "path": "sounds/bounce_02.mp3", "weight": 1 }
  ],
  "properties": {
    "volume": 0.8,
    "pitchMin": 0.9,
    "pitchMax": 1.1,
    "spatial": true
  },
  "trigger": {
    "event": "collision",
    "threshold": 1.0,
    "cooldown": 0.1
  }
}
```

## Asset Validation

### JSON Schema Validation

All assets are validated against JSON schemas in `assets/schemas/`:

- `map-schema.json` - Map validation
- `marble-schema.json` - Marble validation
- `sound-schema.json` - Sound validation

### Online Validators

You can validate your JSON files using:
- [JSON Schema Validator](https://www.jsonschemavalidator.net/)
- VS Code with JSON Schema extension

### Testing Locally

1. Place your assets in the correct directories
2. Update `assets/manifest.json` with your new assets
3. Run the game and check the console for loading messages
4. Test in-game to ensure everything works

## Submission Guidelines

### Before Submitting

- [ ] Asset JSON is valid (use a JSON validator)
- [ ] Asset follows the appropriate schema
- [ ] Unique ID (not conflicting with existing assets)
- [ ] All required fields are filled
- [ ] Asset is tested in-game
- [ ] `manifest.json` is updated
- [ ] No copyrighted material without permission

### Pull Request Format

```
Title: Add [Asset Type]: [Asset Name]

Description:
- What: Brief description of the asset
- Why: Why you're adding it
- Testing: How you tested it

Files Added:
- assets/[type]/[id].json
- (any audio/texture files)
- assets/manifest.json (updated)
```

### Asset IDs

- Use lowercase letters, numbers, and underscores only
- Be descriptive but concise
- Examples: `crystal_cave`, `speed_demon`, `metal_clang`

### Naming Conventions

- **Maps**: Descriptive of theme/location (e.g., `crystal_cave`, `space_station`)
- **Marbles**: Descriptive of appearance/ability (e.g., `golden_snitch`, `ghost_phase`)
- **Sounds**: Descriptive of sound + material (e.g., `wood_thud`, `glass_shatter`)

## Questions?

- Open an issue for questions
- Join our community Discord (if available)
- Check existing assets for examples

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Happy creating! 🎮🎨
