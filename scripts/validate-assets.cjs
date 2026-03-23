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

// Simple JSON schema validator
function validateAgainstSchema(data, schema, assetPath) {
  const errors = [];

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
          if (actualType !== propSchema.type) {
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
        if (propSchema.type === 'array' && propSchema.items && Array.isArray(value)) {
          if (propSchema.minItems && value.length < propSchema.minItems) {
            errors.push(`Field '${key}' should have at least ${propSchema.minItems} items`);
          }
          if (propSchema.maxItems && value.length > propSchema.maxItems) {
            errors.push(`Field '${key}' should have at most ${propSchema.maxItems} items`);
          }
        }

        // Nested object validation
        if (propSchema.type === 'object' && propSchema.properties && typeof value === 'object') {
          const nestedErrors = validateAgainstSchema(value, propSchema, `${assetPath}.${key}`);
          errors.push(...nestedErrors);
        }
      }
    }
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

function validateAssets() {
  console.log('🔍 Validating Assets...\n');

  const schemas = {
    map: loadJSON(path.join(ASSETS_DIR, 'schemas', 'map-schema.json')),
    marble: loadJSON(path.join(ASSETS_DIR, 'schemas', 'marble-schema.json')),
    sound: loadJSON(path.join(ASSETS_DIR, 'schemas', 'sound-schema.json'))
  };

  const results = {
    valid: 0,
    invalid: 0,
    errors: []
  };

  // Validate maps
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

    const errors = validateAgainstSchema(data, schemas.map, file);
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
