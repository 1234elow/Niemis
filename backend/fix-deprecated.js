#!/usr/bin/env node

/**
 * Fix deprecated npm packages script
 * Updates packages to their latest secure versions and resolves deprecation warnings
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 Fixing deprecated npm packages...\n');

// Read current package.json
const packageJsonPath = './package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('📦 Current package versions that had deprecation warnings:');

// Packages to update based on deprecation warnings
const packageUpdates = {
  // Security vulnerabilities fixed
  'multer': '^2.0.1',         // Was 1.4.5-lts.2, now secure v2.x
  'supertest': '^7.1.3',      // Was 6.3.4, now latest
  
  // These are usually indirect dependencies, but we can add overrides
  'rimraf': '^5.0.5',         // Latest v5 (was v2.7.1 and v3.0.2)
  'glob': '^10.3.10',         // Latest v10 (was v7.2.3)
};

// Apply updates
Object.entries(packageUpdates).forEach(([pkg, version]) => {
  if (packageJson.dependencies?.[pkg]) {
    console.log(`  ✅ ${pkg}: ${packageJson.dependencies[pkg]} → ${version}`);
    packageJson.dependencies[pkg] = version;
  } else if (packageJson.devDependencies?.[pkg]) {
    console.log(`  ✅ ${pkg}: ${packageJson.devDependencies[pkg]} → ${version}`);
    packageJson.devDependencies[pkg] = version;
  } else {
    console.log(`  ➕ Adding ${pkg}: ${version} (was indirect dependency)`);
    packageJson.dependencies[pkg] = version;
  }
});

// Add overrides for indirect dependencies that cause warnings
packageJson.overrides = {
  ...packageJson.overrides,
  // Force newer versions of problematic indirect dependencies
  'rimraf': '^5.0.5',
  'glob': '^10.3.10',
  'superagent': '^10.2.2',
  // Replace deprecated packages
  'are-we-there-yet': false,   // No longer supported
  'npmlog': false,             // No longer supported  
  'gauge': false,              // No longer supported
  'fstream': false,            // No longer supported
  'inflight': false,           // Memory leak, use lru-cache instead
  '@npmcli/move-file': false,  // Moved to @npmcli/fs
  'lodash.isequal': false,     // Use node:util.isDeepStrictEqual
};

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log('\n📝 Updated package.json with secure versions');
console.log('🗑️  Added overrides to block deprecated packages');

try {
  console.log('\n🧹 Cleaning npm cache and node_modules...');
  execSync('rm -rf node_modules package-lock.json', { stdio: 'inherit' });
  
  console.log('📥 Installing updated packages...');
  execSync('npm install', { stdio: 'inherit' });
  
  console.log('\n🔍 Running security audit...');
  try {
    execSync('npm audit --audit-level=moderate', { stdio: 'inherit' });
  } catch (e) {
    console.log('⚠️  Some audit issues remain - run "npm audit fix" if needed');
  }
  
  console.log('\n✅ Package updates completed successfully!');
  console.log('\n📋 Summary of changes:');
  console.log('   • Updated multer to v2.x (security fix)');
  console.log('   • Updated supertest to v7.x (latest)'); 
  console.log('   • Added overrides to block deprecated packages');
  console.log('   • Cleaned and reinstalled all dependencies');
  
} catch (error) {
  console.error('\n❌ Error during package installation:');
  console.error(error.message);
  console.log('\n🔧 To fix manually:');
  console.log('   1. rm -rf node_modules package-lock.json');
  console.log('   2. npm install');
  console.log('   3. npm audit fix');
}