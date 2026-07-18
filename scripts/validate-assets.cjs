#!/usr/bin/env node

/**
 * Asset Validation Script
 * 
 * Usage: node scripts/validate-assets.js
 * 
 * This script validates all assets in the assets/ directory
 * against their respective JSON schemas.
 */

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ROOT = path.join(__dirname, '..');

function loadZoneHandlers() {
  const handlersPath = path.join(ASSETS_DIR, 'schemas', 'zone-handlers.json');
  if (!fs.existsSync(handlersPath)) {
    require('./sync-zone-handlers.cjs');
  }
  const data = JSON.parse(fs.readFileSync(handlersPath, 'utf8'));
  return new Set(data.handlers || []);
}

function getManifestMapIds() {
  const manifest = loadJSON(path.join(ASSETS_DIR, 'manifest.json'));
  if (manifest.error) return new Set();
  return new Set(Object.keys(manifest.maps || {}));
}

function resolveSchemaRef(schema, ref) {
  if (!ref || !ref.startsWith('#/definitions/')) return null;
  const name = ref.replace('#/definitions/', '');
  return schema.definitions?.[name] || null;
}

// Simple JSON schema validator
function validateAgainstSchema(data, schema, assetPath, rootSchema = schema) {
  const errors = [];
  const activeSchema = rootSchema || schema;

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check properties types
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        const value = data[key];

        // Type checking
        if (propSchema.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (propSchema.type === 'integer') {
            if (actualType !== 'number' || !Number.isInteger(value)) {
              errors.push(`Field '${key}' should be integer, got ${value}`);
            }
          } else if (actualType !== propSchema.type) {
            errors.push(`Field '${key}' should be ${propSchema.type}, got ${actualType}`);
          }
        }

        // Enum checking
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push(`Field '${key}' should be one of: ${propSchema.enum.join(', ')}`);
        }

        // Pattern checking
        if (propSchema.pattern && typeof value === 'string') {
          const regex = new RegExp(propSchema.pattern);
          if (!regex.test(value)) {
            errors.push(`Field '${key}' does not match pattern: ${propSchema.pattern}`);
          }
        }

        // Range checking for numbers
        if (typeof value === 'number') {
          if (propSchema.minimum !== undefined && value < propSchema.minimum) {
            errors.push(`Field '${key}' should be >= ${propSchema.minimum}`);
          }
          if (propSchema.maximum !== undefined && value > propSchema.maximum) {
            errors.push(`Field '${key}' should be <= ${propSchema.maximum}`);
          }
        }

        // Array items checking
        if (propSchema.type === 'array' && Array.isArray(value)) {
          if (propSchema.minItems && value.length < propSchema.minItems) {
            errors.push(`Field '${key}' should have at least ${propSchema.minItems} items`);
          }
          if (propSchema.maxItems && value.length > propSchema.maxItems) {
            errors.push(`Field '${key}' should have at most ${propSchema.maxItems} items`);
          }
          let itemSchema = propSchema.items;
          if (itemSchema?.$ref) {
            itemSchema = resolveSchemaRef(activeSchema, itemSchema.$ref);
          }
          if (itemSchema) {
            value.forEach((item, index) => {
              if (typeof item === 'object' && item !== null) {
                const nested = validateAgainstSchema(
                  item,
                  itemSchema,
                  `${assetPath}.${key}[${index}]`,
                  activeSchema
                );
                errors.push(...nested);
              }
            });
          }
        }

        // Nested object validation
        if (propSchema.type === 'object' && propSchema.properties && typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const nestedErrors = validateAgainstSchema(value, propSchema, `${assetPath}.${key}`, activeSchema);
          errors.push(...nestedErrors);
        }
      }
    }
  }

  return errors;
}

function validateMapZoneHandlers(data, file, zoneHandlers, manifestIds, results) {
  const errors = [];
  const warnings = [];
  const inManifest = data.id && manifestIds.has(data.id);
  const zones = data.zones || [];

  for (let i = 0; i < zones.length; i++) {
    const zoneType = zones[i]?.type;
    if (!zoneType) continue;
    if (!zoneHandlers.has(zoneType)) {
      const msg = `zones[${i}] unknown type "${zoneType}" (not in ZONE_HANDLERS)`;
      if (inManifest) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  if (inManifest && !data.chapter && !data.difficulty) {
    errors.push('manifest map should set chapter and/or difficulty for campaign assignment');
  }

  for (const w of warnings) {
    console.log(`      ⚠️  ${w}`);
  }

  return errors;
}

function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { error: e.message };
  }
}

function validateManifest(results) {
  const manifestPath = path.join(ASSETS_DIR, 'manifest.json');
  const manifest = loadJSON(manifestPath);

  console.log('📋 Manifest:');
  if (manifest.error) {
    console.log(`  ❌ manifest.json - JSON Parse Error: ${manifest.error}`);
    results.invalid++;
    results.errors.push({ file: 'manifest.json', error: manifest.error });
    console.log('');
    return;
  }

  const sections = [
    ['maps', 'map'],
    ['marbles', 'marble'],
    ['sounds', 'sound'],
  ];

  for (const [sectionName] of sections) {
    const section = manifest[sectionName];
    if (!section || typeof section !== 'object') continue;

    for (const [entryId, entry] of Object.entries(section)) {
      const filePath = entry?.file;
      if (!filePath) {
        console.log(`  ❌ ${sectionName}.${entryId} - missing file path`);
        results.invalid++;
        results.errors.push({ file: `manifest.${sectionName}.${entryId}`, errors: ['missing file path'] });
        continue;
      }

      const resolved = path.join(ASSETS_DIR, filePath.replace(/^assets\//, ''));
      if (!fs.existsSync(resolved)) {
        console.log(`  ❌ ${sectionName}.${entryId} - file not found: ${filePath}`);
        results.invalid++;
        results.errors.push({ file: `manifest.${sectionName}.${entryId}`, errors: [`file not found: ${filePath}`] });
        continue;
      }

      const data = loadJSON(resolved);
      if (data.error) {
        console.log(`  ❌ ${sectionName}.${entryId} - ${filePath} parse error: ${data.error}`);
        results.invalid++;
        results.errors.push({ file: filePath, error: data.error });
        continue;
      }

      if (data.id && data.id !== entryId) {
        console.log(`  ⚠️  ${sectionName}.${entryId} - asset id "${data.id}" differs from manifest key`);
      }

      console.log(`  ✅ ${sectionName}.${entryId} → ${filePath}`);
      results.valid++;
    }
  }

  console.log('');
}

function validateAssets() {
  console.log('🔍 Validating Assets...\n');

  const schemas = {
    map: loadJSON(path.join(ASSETS_DIR, 'schemas', 'map-schema.json')),
    marble: loadJSON(path.join(ASSETS_DIR, 'schemas', 'marble-schema.json')),
    sound: loadJSON(path.join(ASSETS_DIR, 'schemas', 'sound-schema.json'))
  };

  const zoneHandlers = loadZoneHandlers();
  const manifestMapIds = getManifestMapIds();
  console.log(`📦 Zone handlers: ${zoneHandlers.size} registered\n`);

  const results = {
    valid: 0,
    invalid: 0,
    errors: []
  };

  validateManifest(results);

  const mapsDir = path.join(ASSETS_DIR, 'maps');
  const mapFiles = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json') && f !== 'TEMPLATE.json');
  console.log('📍 Maps:');
  for (const file of mapFiles) {
    const filePath = path.join(mapsDir, file);
    const data = loadJSON(filePath);
    
    if (data.error) {
      console.log(`  ❌ ${file} - JSON Parse Error: ${data.error}`);
      results.invalid++;
      results.errors.push({ file, error: data.error });
      continue;
    }

    const errors = validateAgainstSchema(data, schemas.map, file, schemas.map);
    errors.push(...validateMapZoneHandlers(data, file, zoneHandlers, manifestMapIds, results));
    if (errors.length === 0) {
      console.log(`  ✅ ${file} - ${data.name || 'Unnamed'}`);
      results.valid++;
    } else {
      console.log(`  ❌ ${file}:`);
      errors.forEach(e => console.log(`      - ${e}`));
      results.invalid++;
      results.errors.push({ file, errors });
    }
  }

  // Validate marbles
  const marblesDir = path.join(ASSETS_DIR, 'marbles');
  const marbleFiles = fs.readdirSync(marblesDir).filter(f => f.endsWith('.json') && f !== 'TEMPLATE.json');
  
  console.log('\n🔮 Marbles:');
  for (const file of marbleFiles) {
    const filePath = path.join(marblesDir, file);
    const data = loadJSON(filePath);
    
    if (data.error) {
      console.log(`  ❌ ${file} - JSON Parse Error: ${data.error}`);
      results.invalid++;
      results.errors.push({ file, error: data.error });
      continue;
    }

    const errors = validateAgainstSchema(data, schemas.marble, file);
    if (errors.length === 0) {
      console.log(`  ✅ ${file} - ${data.name || 'Unnamed'} (${data.rarity || 'common'})`);
      results.valid++;
    } else {
      console.log(`  ❌ ${file}:`);
      errors.forEach(e => console.log(`      - ${e}`));
      results.invalid++;
      results.errors.push({ file, errors });
    }
  }

  // Validate sounds
  const soundsDir = path.join(ASSETS_DIR, 'sounds');
  const soundFiles = fs.readdirSync(soundsDir).filter(f => f.endsWith('.json') && f !== 'TEMPLATE.json');
  
  console.log('\n🔊 Sounds:');
  for (const file of soundFiles) {
    const filePath = path.join(soundsDir, file);
    const data = loadJSON(filePath);
    
    if (data.error) {
      console.log(`  ❌ ${file} - JSON Parse Error: ${data.error}`);
      results.invalid++;
      results.errors.push({ file, error: data.error });
      continue;
    }

    const errors = validateAgainstSchema(data, schemas.sound, file);
    if (errors.length === 0) {
      console.log(`  ✅ ${file} - ${data.name || 'Unnamed'}`);
      results.valid++;
    } else {
      console.log(`  ❌ ${file}:`);
      errors.forEach(e => console.log(`      - ${e}`));
      results.invalid++;
      results.errors.push({ file, errors });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Valid: ${results.valid}`);
  console.log(`❌ Invalid: ${results.invalid}`);
  console.log(`📊 Total: ${results.valid + results.invalid}`);

  if (results.invalid > 0) {
    console.log('\n⚠️  Validation failed. Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All assets are valid!');
    process.exit(0);
  }
}

validateAssets();
