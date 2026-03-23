# Assets

This directory contains all game assets: maps, marbles, sounds, and materials.

## Quick Links

- [Contributing Guide](../CONTRIBUTING.md) - How to create and submit assets
- [Map Template](maps/TEMPLATE.json) - Start creating a map
- [Marble Template](marbles/TEMPLATE.json) - Start creating a marble
- [Sound Template](sounds/TEMPLATE.json) - Start creating a sound

## Directory Structure

```
assets/
├── maps/           # Level definitions
│   ├── TEMPLATE.json
│   ├── tutorial.json
│   └── ...
├── marbles/        # Marble definitions
│   ├── TEMPLATE.json
│   ├── classic_red.json
│   └── ...
├── sounds/         # Sound definitions
│   ├── TEMPLATE.json
│   └── ...
├── materials/      # Material definitions
├── schemas/        # JSON schemas for validation
└── manifest.json   # Asset registry
```

## Creating Assets

1. Choose the type of asset you want to create
2. Copy the appropriate TEMPLATE.json file
3. Modify it with your content
4. Save with a unique ID name
5. Update `manifest.json`
6. Test in-game

## Validation

All assets are validated against JSON schemas in `schemas/`:

- `map-schema.json` - Map validation rules
- `marble-schema.json` - Marble validation rules
- `sound-schema.json` - Sound validation rules

Use an online JSON Schema validator to check your files before submitting.

## Asset IDs

Asset IDs must be:
- Unique across all assets
- Lowercase letters, numbers, and underscores only
- Descriptive and concise

Examples:
- ✅ `crystal_cave`, `speed_demon`, `volcanic_magma`
- ❌ `My Map`, `super-marble!`, `123abc`

## Manifest

The `manifest.json` file registers all available assets. When adding a new asset, add an entry:

```json
{
  "maps": {
    "your_map_id": {
      "file": "maps/your_map_id.json",
      "name": "Your Map Name",
      "difficulty": "medium"
    }
  },
  "marbles": {
    "your_marble_id": {
      "file": "marbles/your_marble_id.json",
      "rarity": "rare"
    }
  }
}
```

## Questions?

See the [Contributing Guide](../CONTRIBUTING.md) for detailed instructions.
