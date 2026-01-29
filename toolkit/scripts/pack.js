#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Packing Clean-Autofill Chrome Extension...\n');

// First run build
console.log('🔨 Running build...');
try {
    execSync('node toolkit/scripts/build.js', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Build failed. Cannot proceed with packing.');
    process.exit(1);
}

console.log('\n🗜️  Creating ZIP archive...');

const rootPath = path.join(__dirname, '../..');
const distPath = path.join(rootPath, 'dist');
const zipFileName = 'Clean-Autofill.zip';
const zipPath = path.join(distPath, zipFileName);

try {
    // Remove existing zip if present
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }

    // Use native zip command from dist directory
    process.chdir(distPath);
    execSync(`zip -r ${zipFileName} . -x "*.DS_Store" "*__MACOSX*" "types/*"`, { stdio: 'pipe' });
    process.chdir(rootPath);

    // Get file size
    const stats = fs.statSync(zipPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);

    console.log(`\n✅ Extension package created successfully!`);
    console.log(`   📦 File: dist/${zipFileName}`);
    console.log(`   📏 Size: ${fileSizeInKB} KB`);

    // Read manifest for version info
    const manifest = JSON.parse(fs.readFileSync(path.join(distPath, 'manifest.json'), 'utf8'));
    console.log(`   🏷️  Version: ${manifest.version}`);
    console.log(`   📝 Name: ${manifest.name}`);

    console.log('\n📤 Next steps:');
    console.log('   1. Test locally: Load dist/ folder in Chrome extensions page');
    console.log('   2. Upload to Chrome Web Store: Use dist/Clean-Autofill.zip');
    console.log('   3. Or use GitHub Actions: git tag v' + manifest.version + ' && git push --tags');

} catch (error) {
    console.error('❌ Failed to create ZIP file:', error.message);
    process.exit(1);
}
