#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const MAX_VERSION_COMPONENT = 65535;

function parseChromeVersion(version) {
    if (typeof version !== 'string') return null;

    const components = version.split('.');
    if (
        components.length !== 3 ||
        components.some(component => !/^(0|[1-9]\d*)$/.test(component))
    ) {
        return null;
    }

    const parts = components.map(Number);
    if (
        parts.some(part => part > MAX_VERSION_COMPONENT) ||
        parts.every(part => part === 0)
    ) {
        return null;
    }

    return parts;
}

// Parse command line arguments
const args = process.argv.slice(2);
const bumpType = args[0] || 'patch'; // patch, minor, or major

// Validate bump type
if (!['patch', 'minor', 'major'].includes(bumpType)) {
    console.error('❌ Invalid bump type. Use: patch, minor, or major');
    process.exit(1);
}

const manifestPath = path.join(__dirname, '../..', 'src', 'manifest.json');
const packagePath = path.join(__dirname, '../..', 'package.json');
let manifestContent;
let packageContent;
let manifest;
let pkg;

// Preflight both version files before changing either one.
try {
    manifestContent = fs.readFileSync(manifestPath, 'utf8');
    packageContent = fs.readFileSync(packagePath, 'utf8');
    manifest = JSON.parse(manifestContent);
    pkg = JSON.parse(packageContent);
} catch (error) {
    console.error('❌ Failed to read version files:', error.message);
    process.exit(1);
}

// Parse current version
const currentVersion = manifest.version;
const versionParts = parseChromeVersion(currentVersion);

if (!versionParts) {
    console.error(
        '❌ Invalid Chrome version. Expected three components from 0 to 65535 without leading zeros, and not all zero.'
    );
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

if (!parseChromeVersion(newVersion)) {
    console.error(`❌ Version bump would produce an invalid Chrome version: ${newVersion}`);
    process.exit(1);
}

manifest.version = newVersion;
pkg.version = newVersion;

const manifestOutput = JSON.stringify(manifest, null, 2) + '\n';
const packageOutput = JSON.stringify(pkg, null, 2) + '\n';
const manifestTempPath = `${manifestPath}.${process.pid}.tmp`;
const packageTempPath = `${packagePath}.${process.pid}.tmp`;
const manifestRollbackPath = `${manifestPath}.${process.pid}.rollback`;
const manifestMode = fs.statSync(manifestPath).mode & 0o777;
const packageMode = fs.statSync(packagePath).mode & 0o777;

function removeIfPresent(filePath) {
    try {
        fs.unlinkSync(filePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn(`⚠️  Could not remove temporary file ${filePath}:`, error.message);
        }
    }
}

// Stage both updates before replacing either target.
try {
    fs.writeFileSync(manifestTempPath, manifestOutput, { mode: manifestMode });
    fs.writeFileSync(packageTempPath, packageOutput, { mode: packageMode });
} catch (error) {
    removeIfPresent(manifestTempPath);
    removeIfPresent(packageTempPath);
    console.error('❌ Failed to stage version files:', error.message);
    process.exit(1);
}

let manifestCommitted = false;
try {
    fs.renameSync(manifestTempPath, manifestPath);
    manifestCommitted = true;
    fs.renameSync(packageTempPath, packagePath);
} catch (error) {
    let rollbackError = null;

    if (manifestCommitted) {
        try {
            fs.writeFileSync(manifestRollbackPath, manifestContent, { mode: manifestMode });
            fs.renameSync(manifestRollbackPath, manifestPath);
        } catch (caughtRollbackError) {
            rollbackError = caughtRollbackError;
        }
    }

    removeIfPresent(manifestTempPath);
    removeIfPresent(packageTempPath);
    removeIfPresent(manifestRollbackPath);
    console.error('❌ Failed to commit version files:', error.message);
    if (rollbackError) {
        console.error('❌ Failed to restore manifest.json:', rollbackError.message);
    }
    process.exit(1);
}

console.log(`✅ Version bumped from ${currentVersion} to ${newVersion}`);
console.log(`   Type: ${bumpType}`);
console.log(`   File: src/manifest.json`);
console.log(`   File: package.json`);

// Output new version for use in scripts
console.log(`\n📦 New version: ${newVersion}`);
console.log(`\nNext steps:`);
console.log(`  1. Commit: git add src/manifest.json package.json && git commit -m "Bump version to ${newVersion}"`);
console.log(`  2. Tag: git tag v${newVersion}`);
console.log(`  3. Push: git push && git push --tags`);
