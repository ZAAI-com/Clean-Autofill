#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Packing Clean-Autofill Chrome Extension...\n');

// First run build to validate
console.log('🔨 Running build validation...');
try {
    execSync('node tools/build.js', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Build validation failed. Cannot proceed with packing.');
    process.exit(1);
}

console.log('\n📁 Creating extension package...');

const rootPath = path.join(__dirname, '..');
const distPath = path.join(rootPath, 'dist');
const extensionPath = path.join(distPath, 'Clean-Autofill');

// Clean dist directory
if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true });
}
fs.mkdirSync(distPath);

// Create directory structure in dist/Clean-Autofill
fs.mkdirSync(path.join(extensionPath, 'src', 'icons'), { recursive: true });

// Files to include in the package (source -> dest relative to dist)
const filesToCopy = [
    { src: 'manifest.json', dest: 'manifest.json' },
    { src: 'src/background.js', dest: 'src/background.js' },
    { src: 'src/content.js', dest: 'src/content.js' },
    { src: 'src/options.html', dest: 'src/options.html' },
    { src: 'src/options.js', dest: 'src/options.js' }
];

// Copy files
filesToCopy.forEach(({ src, dest }) => {
    const srcPath = path.join(rootPath, src);
    const destPath = path.join(extensionPath, dest);
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✅ Copied ${src}`);
});

// Copy icons
const iconFiles = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];
iconFiles.forEach(icon => {
    const src = path.join(rootPath, 'src', 'icons', icon);
    const dest = path.join(extensionPath, 'src', 'icons', icon);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`  ✅ Copied src/icons/${icon}`);
    }
});

// Create ZIP file
console.log('\n🗜️  Creating ZIP archive...');

const zipFileName = 'Clean-Autofill.zip';
const zipPath = path.join(distPath, zipFileName);

try {
    // Use native zip command
    process.chdir(extensionPath);
    execSync(`zip -r ../Clean-Autofill.zip . -x "*.DS_Store" "*__MACOSX*"`, { stdio: 'pipe' });
    process.chdir(rootPath);

    // Get file size
    const stats = fs.statSync(zipPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);

    console.log(`\n✅ Extension package created successfully!`);
    console.log(`   📦 File: dist/${zipFileName}`);
    console.log(`   📏 Size: ${fileSizeInKB} KB`);

    // Read manifest for version info
    const manifest = JSON.parse(fs.readFileSync(path.join(rootPath, 'manifest.json'), 'utf8'));
    console.log(`   🏷️  Version: ${manifest.version}`);
    console.log(`   📝 Name: ${manifest.name}`);

    console.log('\n📤 Next steps:');
    console.log('   1. Test locally: Load dist/Clean-Autofill/ folder in Chrome extensions page');
    console.log('   2. Upload to Chrome Web Store: Use dist/Clean-Autofill.zip');
    console.log('   3. Or use GitHub Actions: git tag v' + manifest.version + ' && git push --tags');

} catch (error) {
    console.error('❌ Failed to create ZIP file:', error.message);
    process.exit(1);
}
