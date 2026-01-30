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
    execSync('npx tsc -p toolkit/typescript/tsconfig.json', { cwd: ROOT, stdio: 'inherit' });
    console.log('  ✅ TypeScript compilation successful');
} catch (error) {
    console.error('  ❌ TypeScript compilation failed');
    process.exit(1);
}

// Bundle utils.js with dependencies using esbuild
console.log('\n📦 Bundling utils.js with dependencies...');
try {
    execSync('npx esbuild dist/utils.js --bundle --outfile=dist/utils.bundled.js --format=iife --global-name=CleanAutofillUtils --platform=browser --minify', { cwd: ROOT, stdio: 'inherit' });
    // Replace utils.js with bundled version
    fs.renameSync(path.join(DIST, 'utils.bundled.js'), path.join(DIST, 'utils.js'));
    console.log('  ✅ utils.js bundled with PSL');
} catch (error) {
    console.error('  ❌ Bundling failed:', error.message);
    process.exit(1);
}

// Check if service worker uses ES modules
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const usesESModules = manifest.background?.type === 'module';

if (usesESModules) {
    console.log('\n🔧 ES modules enabled - processing scripts...');

    // utils.js is used by both:
    // - background.js (ES module) - needs exports
    // - content scripts (classic scripts) - can't have exports
    // Solution: Create utils-content.js (no exports) for content scripts
    const utilsPath = path.join(DIST, 'utils.js');
    const utilsContentPath = path.join(DIST, 'utils-content.js');
    if (fs.existsSync(utilsPath)) {
        let utilsContent = fs.readFileSync(utilsPath, 'utf8');
        // Strip exports for content script version
        utilsContent = utilsContent.replace(/^export \{\};?\s*$/gm, '');
        utilsContent = utilsContent.replace(/^export \{[^}]*\};?\s*$/gm, '');
        fs.writeFileSync(utilsContentPath, utilsContent.trim() + '\n');
        console.log(`  ✅ utils-content.js (created for content scripts)`);
        console.log(`  ✅ utils.js (ES module preserved for background.js)`);
    }

    // Strip exports from other content script files
    const contentScriptFiles = ['content.js', 'options.js'];
    for (const file of contentScriptFiles) {
        const filePath = path.join(DIST, file);
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            // Remove "export {};" (empty exports from files with only type imports)
            content = content.replace(/^export \{\};?\s*$/gm, '');
            fs.writeFileSync(filePath, content.trim() + '\n');
            console.log(`  ✅ ${file} (stripped empty exports)`);
        }
    }
    console.log(`  ✅ background.js (ES module preserved)`);
} else {
    // Strip ES module exports for classic script compatibility
    console.log('\n🔧 Stripping ES module exports for Chrome compatibility...');
    const jsFiles = ['background.js', 'content.js', 'utils.js', 'options.js'];
    for (const file of jsFiles) {
        const filePath = path.join(DIST, file);
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            // Remove "export {};" (empty exports from files with only type imports)
            content = content.replace(/^export \{\};?\s*$/gm, '');
            // Remove named exports (from utils.js)
            content = content.replace(/^export \{[^}]*\};?\s*$/gm, '');
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
    'utils-content.js',
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
