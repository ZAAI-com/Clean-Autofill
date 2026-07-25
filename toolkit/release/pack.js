#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

console.log('📦 Packing Clean-Autofill Chrome Extension...\n');

const rootPath = path.join(__dirname, '../..');
const chromiumPath = path.join(rootPath, 'dist', 'chromium');
const unpackedPath = path.join(chromiumPath, 'unpacked');

// First run build
console.log('🔨 Running build...');
try {
    execSync('node toolkit/build/build.js', { cwd: rootPath, stdio: 'inherit' });
} catch (error) {
    console.error('❌ Build failed. Cannot proceed with packing.');
    process.exit(1);
}

console.log('\n🗜️  Creating ZIP archive...');

try {
    const manifest = JSON.parse(fs.readFileSync(path.join(unpackedPath, 'manifest.json'), 'utf8'));
    const zipFileName = `Clean-Autofill-${manifest.version}.zip`;
    const zipPath = path.join(chromiumPath, zipFileName);

    // Remove existing zip if present
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }

    // Zip the unpacked contents so manifest.json stays at the archive root.
    execFileSync('zip', ['-r', zipPath, '.', '-x', '*.DS_Store', '*__MACOSX*'], {
        cwd: unpackedPath,
        stdio: 'pipe',
    });

    // Get file size
    const stats = fs.statSync(zipPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);

    console.log(`\n✅ Extension package created successfully!`);
    console.log(`   📦 File: dist/chromium/${zipFileName}`);
    console.log(`   📏 Size: ${fileSizeInKB} KB`);

    console.log(`   🏷️  Version: ${manifest.version}`);
    console.log(`   📝 Name: ${manifest.name}`);

    console.log('\n📤 Next steps:');
    console.log('   1. Test locally: Load dist/chromium/unpacked/ in Chrome extensions page');
    console.log(`   2. Upload to Chrome Web Store: Use dist/chromium/${zipFileName}`);
    console.log('   3. Or use GitHub Actions: git tag v' + manifest.version + ' && git push --tags');

} catch (error) {
    console.error('❌ Failed to create ZIP file:', error.message);
    process.exit(1);
}
