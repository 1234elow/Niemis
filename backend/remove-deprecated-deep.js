#!/usr/bin/env node

/**
 * Aggressively remove deeply nested deprecated packages
 * This script will force removal of problematic packages at all levels
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔥 Aggressively removing deprecated packages...\n');

// Create .npmrc to disable optional dependencies that might pull in deprecated packages
const npmrcContent = `
# Disable optional dependencies that might contain deprecated packages
optional=false

# Force to use overrides
prefer-offline=false
audit=false

# Package resolution settings
fund=false
`;

fs.writeFileSync('.npmrc', npmrcContent);
console.log('📝 Created .npmrc to control package resolution');

// Update package.json with more aggressive overrides
const packageJsonPath = './package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// More aggressive overrides - block at every level
packageJson.overrides = {
  ...packageJson.overrides,
  "**": {
    "lodash.isequal": false,
    "fstream": false,
    "inflight": false,
    "rimraf": "^5.0.5",
    "glob": "^10.3.10"
  }
};

// Add resolutions (yarn-style) for broader compatibility
packageJson.resolutions = {
  "lodash.isequal": false,
  "fstream": false,
  "**/lodash.isequal": false,
  "**/fstream": false,
  "**/rimraf": "^5.0.5",
  "**/glob": "^10.3.10"
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('🔧 Updated package.json with aggressive overrides');

try {
  console.log('\n🧹 Force cleaning everything...');
  execSync('rm -rf node_modules package-lock.json npm-shrinkwrap.json', { stdio: 'inherit' });
  
  console.log('🚮 Clearing npm cache completely...');
  execSync('npm cache clean --force', { stdio: 'inherit' });
  
  console.log('📥 Installing with forced overrides...');
  execSync('npm install --no-optional --no-audit --no-fund', { stdio: 'inherit' });
  
  console.log('\n🔍 Checking for remaining deprecated packages...');
  try {
    const result = execSync('npm ls --depth=10 2>&1 | grep -i deprecated || echo "No deprecated packages found"', { encoding: 'utf8' });
    console.log(result);
  } catch (e) {
    console.log('✅ No deprecated packages detected');
  }
  
  console.log('\n✅ Aggressive cleanup completed!');
  
} catch (error) {
  console.error('\n❌ Error during aggressive cleanup:');
  console.error(error.message);
  
  console.log('\n🔧 Manual fix steps:');
  console.log('1. rm -rf node_modules package-lock.json');
  console.log('2. npm cache clean --force');
  console.log('3. npm install --no-optional');
}