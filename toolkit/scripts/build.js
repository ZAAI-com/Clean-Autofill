#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');

console.log('🔨 Building Clean-Autofill Chrome Extension...\n');

// Check TypeScript source files first
const requiredSourceFiles = [
    'src/background.ts',
    'src/content.ts',
    'src/history.ts',
    'src/ui/options.ts',
    'src/ui/popup.ts',
    'src/provider-domains.ts',
    'src/providers.ts',
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
    execSync('npx tsc -p toolkit/typescript/tsconfig.json', { cwd: ROOT, stdio: 'inherit' });
    console.log('  ✅ TypeScript compilation successful');
} catch (error) {
    console.error('  ❌ TypeScript compilation failed');
    process.exit(1);
}

// Bundle utils.js with dependencies using esbuild
// Create two versions: ESM for background.js, IIFE for content scripts
console.log('\n📦 Bundling utils.js with dependencies...');
try {
    // ESM bundle for background.js (service worker)
    execSync('npx esbuild dist/utils.js --bundle --outfile=dist/utils.esm.js --format=esm --platform=browser --minify', { cwd: ROOT, stdio: 'inherit' });
    // IIFE bundle for content scripts (sets globalThis.CleanAutofillUtils)
    execSync('npx esbuild dist/utils.js --bundle --outfile=dist/utils-content.js --format=iife --global-name=CleanAutofillUtils --platform=browser --minify', { cwd: ROOT, stdio: 'inherit' });
    // Replace utils.js with ESM version for background.js imports
    fs.renameSync(path.join(DIST, 'utils.esm.js'), path.join(DIST, 'utils.js'));
    console.log('  ✅ utils.js (ESM for background.js)');
    console.log('  ✅ utils-content.js (IIFE for content scripts)');
} catch (error) {
    console.error('  ❌ Bundling failed:', error.message);
    process.exit(1);
}

// Check if service worker uses ES modules
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const usesESModules = manifest.background?.type === 'module';

if (usesESModules) {
    console.log('\n🔧 ES modules enabled - processing scripts...');

    // Strip exports from content script files (they use globalThis pattern)
    const contentScriptFiles = ['content.js', 'ui/options.js', 'ui/popup.js'];
    for (const file of contentScriptFiles) {
        const filePath = path.join(DIST, file);
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            // Remove "export {};" (empty exports from files with only type imports)
            // Handles both spaced "export {};" and minified "export{}"
            content = content.replace(/(^|[;\n])\s*export\s*\{\s*\};?/g, '$1');
            // Remove inline export declarations (e.g., "export function" → "function")
            content = content.replace(/\bexport\s+(function|const|let|var|class)\b/g, '$1');
            fs.writeFileSync(filePath, content.trim() + '\n');
            console.log(`  ✅ ${file} (stripped exports)`);
        }
    }
    console.log(`  ✅ background.js (ES module preserved)`);
} else {
    // Strip ES module exports for classic script compatibility
    console.log('\n🔧 Stripping ES module exports for Chrome compatibility...');
    const jsFiles = ['background.js', 'content.js', 'utils.js', 'ui/options.js'];
    for (const file of jsFiles) {
        const filePath = path.join(DIST, file);
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            // Remove "export {};" (empty exports from files with only type imports)
            // Handles both spaced "export {};" and minified "export{}"
            content = content.replace(/(^|[;\n])\s*export\s*\{\s*\};?/g, '$1');
            // Remove named exports (from utils.js)
            content = content.replace(/(^|[;\n])\s*export\s*\{[^}]*\};?/g, '$1');
            fs.writeFileSync(filePath, content.trim() + '\n');
            console.log(`  ✅ ${file}`);
        }
    }
}

// Copy static assets to dist
console.log('\n📁 Copying static assets...');

// Copy manifest.json
fs.copyFileSync(path.join(ROOT, 'manifest.json'), path.join(DIST, 'manifest.json'));
console.log('  ✅ manifest.json');

// Copy UI HTML files
const uiDir = path.join(DIST, 'ui');
fs.mkdirSync(uiDir, { recursive: true });
fs.copyFileSync(path.join(SRC, 'ui', 'options.html'), path.join(uiDir, 'options.html'));
console.log('  ✅ ui/options.html');
fs.copyFileSync(path.join(SRC, 'ui', 'popup.html'), path.join(uiDir, 'popup.html'));
console.log('  ✅ ui/popup.html');

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
    'history.js',
    'provider-domains.js',
    'providers.js',
    'utils.js',
    'utils-content.js',
    'manifest.json',
    'ui/options.js',
    'ui/options.html',
    'ui/popup.js',
    'ui/popup.html',
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
    console.log('   • Run "bun run pack" to create zip for distribution');
} else {
    console.error('\n❌ Build failed. Please fix the errors above.');
    process.exit(1);
}
