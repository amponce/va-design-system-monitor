#!/usr/bin/env node

/**
 * Build script for VA Design System Monitor
 * 
 * This script handles the build process for the VA Design System Monitor package.
 * It copies necessary files and ensures proper structure for distribution.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '..');

console.log('🔨 Building VA Design System Monitor...\n');

// Check required files
const requiredFiles = [
  'package.json',
  'README.md',
  'lib/index.js',
  'bin/cli.js',
  'bin/mcp-server.js'
];

console.log('📋 Checking required files...');
let allFilesExist = true;

for (const file of requiredFiles) {
  const filePath = join(PACKAGE_ROOT, file);
  if (existsSync(filePath)) {
    const stats = statSync(filePath);
    console.log(`✅ ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.error('\n❌ Build failed: Missing required files');
  process.exit(1);
}

// Validate package.json
console.log('\n📦 Validating package.json...');
try {
  const packageJson = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  
  const requiredFields = ['name', 'version', 'description', 'main', 'bin', 'exports'];
  for (const field of requiredFields) {
    if (packageJson[field]) {
      console.log(`✅ ${field}: ${typeof packageJson[field] === 'object' ? 'configured' : packageJson[field]}`);
    } else {
      console.log(`❌ ${field}: missing`);
      allFilesExist = false;
    }
  }
  
  // Check bin executables
  if (packageJson.bin) {
    console.log('\n🔧 Checking executables...');
    for (const [name, path] of Object.entries(packageJson.bin)) {
      const binPath = join(PACKAGE_ROOT, path);
      if (existsSync(binPath)) {
        console.log(`✅ ${name}: ${path}`);
      } else {
        console.log(`❌ ${name}: ${path} - MISSING`);
        allFilesExist = false;
      }
    }
  }
  
} catch (error) {
  console.error('❌ Invalid package.json:', error.message);
  process.exit(1);
}

// Test imports
console.log('\n🧪 Testing imports...');
try {
  const { VAComponentMonitor, getOfficialExamples } = await import('../lib/index.js');
  console.log('✅ Main library imports successfully');
  
  // Quick functionality test
  const monitor = new VAComponentMonitor();
  console.log('✅ VAComponentMonitor instantiates successfully');
  
} catch (error) {
  console.error('❌ Import test failed:', error.message);
  process.exit(1);
}

if (!allFilesExist) {
  console.error('\n❌ Build failed: Validation errors found');
  process.exit(1);
}

console.log('\n🎉 Build successful! Package is ready for publishing.');
console.log('\nNext steps:');
console.log('  npm publish --dry-run  # Test publishing');
console.log('  npm publish            # Publish to npm'); 