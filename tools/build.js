#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');

console.log('🔨 Building Clean-Autofill Chrome Extension...\n');

// Check TypeScript source files first
const requiredSourceFiles = [
    'src/background.ts',
    'src/content.ts',
    'src/options.ts',
    'src/utils.ts',
    'src/types/index.ts',
];

let hasErrors = false;
console.log('📋 Checking TypeScript source files:');
requiredSourceFiles.forEach(file => {
    const filePath = path.join(ROOT, file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - MISSING`);
        hasErrors = true;
    }
});

if (hasErrors) {
    console.error('\n❌ Build failed: Missing TypeScript source files');
    process.exit(1);
}

// Clean dist directory
console.log('\n🧹 Cleaning dist directory...');
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST, { recursive: true });
console.log('  ✅ dist directory cleaned');

// Compile TypeScript
console.log('\n📦 Compiling TypeScript...');
try {
    execSync('npx tsc -p config/tsconfig.json', { cwd: ROOT, stdio: 'inherit' });
    console.log('  ✅ TypeScript compilation successful');
} catch (error) {
    console.error('  ❌ TypeScript compilation failed');
    process.exit(1);
}

// Copy static assets to dist
console.log('\n📁 Copying static assets...');

// Copy manifest.json
fs.copyFileSync(path.join(ROOT, 'manifest.json'), path.join(DIST, 'manifest.json'));
console.log('  ✅ manifest.json');

// Copy options.html
fs.copyFileSync(path.join(SRC, 'options.html'), path.join(DIST, 'options.html'));
console.log('  ✅ options.html');

// Copy icons
const iconsDir = path.join(DIST, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });
const icons = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];
icons.forEach(icon => {
    fs.copyFileSync(path.join(SRC, 'icons', icon), path.join(iconsDir, icon));
    console.log(`  ✅ icons/${icon}`);
});

// Verify compiled output
console.log('\n📋 Verifying compiled files:');
const requiredCompiledFiles = [
    'background.js',
    'content.js',
    'options.js',
    'utils.js',
    'manifest.json',
    'options.html',
    'icons/icon16.png',
    'icons/icon32.png',
    'icons/icon48.png',
    'icons/icon128.png',
];

requiredCompiledFiles.forEach(file => {
    const filePath = path.join(DIST, file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ dist/${file}`);
    } else {
        console.log(`  ❌ dist/${file} - MISSING`);
        hasErrors = true;
    }
});

// Validate manifest.json
console.log('\n📄 Validating manifest.json:');
try {
    const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
    const requiredFields = ['manifest_version', 'name', 'version', 'description'];
    requiredFields.forEach(field => {
        if (manifest[field]) {
            console.log(`  ✅ ${field}: ${manifest[field]}`);
        } else {
            console.log(`  ❌ ${field}: MISSING`);
            hasErrors = true;
        }
    });
} catch (error) {
    console.error(`  ❌ Failed to parse manifest.json: ${error.message}`);
    hasErrors = true;
}

if (!hasErrors) {
    console.log('\n✅ Build complete! Extension ready at: dist/');
    console.log('\n📦 Next steps:');
    console.log('   • Load dist/ folder in Chrome (chrome://extensions)');
    console.log('   • Run "npm run pack" to create zip for distribution');
} else {
    console.error('\n❌ Build failed. Please fix the errors above.');
    process.exit(1);
}
