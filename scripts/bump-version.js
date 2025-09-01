#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const bumpType = args[0] || 'patch'; // patch, minor, or major

// Validate bump type
if (!['patch', 'minor', 'major'].includes(bumpType)) {
    console.error('❌ Invalid bump type. Use: patch, minor, or major');
    process.exit(1);
}

// Read manifest.json
const manifestPath = path.join(__dirname, '..', 'manifest.json');
let manifest;

try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(manifestContent);
} catch (error) {
    console.error('❌ Failed to read manifest.json:', error.message);
    process.exit(1);
}

// Parse current version
const currentVersion = manifest.version;
const versionParts = currentVersion.split('.').map(Number);

if (versionParts.length !== 3) {
    console.error('❌ Invalid version format. Expected: major.minor.patch');
    process.exit(1);
}

let [major, minor, patch] = versionParts;

// Bump version based on type
switch (bumpType) {
    case 'major':
        major++;
        minor = 0;
        patch = 0;
        break;
    case 'minor':
        minor++;
        patch = 0;
        break;
    case 'patch':
        patch++;
        break;
}

// Create new version string
const newVersion = `${major}.${minor}.${patch}`;

// Update manifest
manifest.version = newVersion;

// Write updated manifest
try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`✅ Version bumped from ${currentVersion} to ${newVersion}`);
    console.log(`   Type: ${bumpType}`);
    console.log(`   File: manifest.json`);
} catch (error) {
    console.error('❌ Failed to write manifest.json:', error.message);
    process.exit(1);
}

// Output new version for use in scripts
console.log(`\n📦 New version: ${newVersion}`);
console.log(`\nNext steps:`);
console.log(`  1. Commit: git add manifest.json && git commit -m "Bump version to ${newVersion}"`);
console.log(`  2. Tag: git tag v${newVersion}`);
console.log(`  3. Push: git push && git push --tags`);
