#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Packing MailFiller Chrome Extension...\n');

// First run build to validate
console.log('🔨 Running build validation...');
try {
    execSync('node scripts/build.js', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Build validation failed. Cannot proceed with packing.');
    process.exit(1);
}

console.log('\n📁 Creating extension package...');

const distPath = path.join(__dirname, '..', 'dist');
const rootPath = path.join(__dirname, '..');

// Clean dist directory
if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true });
}
fs.mkdirSync(distPath);

// Files to include in the package
const filesToCopy = [
    'manifest.json',
    'background.js',
    'content.js',
    'options.html',
    'options.js'
];

// Copy files
filesToCopy.forEach(file => {
    const src = path.join(rootPath, file);
    const dest = path.join(distPath, file);
    fs.copyFileSync(src, dest);
    console.log(`  ✅ Copied ${file}`);
});

// Copy icons directory
const iconsSource = path.join(rootPath, 'icons');
const iconsDest = path.join(distPath, 'icons');
fs.mkdirSync(iconsDest);

const iconFiles = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];
iconFiles.forEach(icon => {
    const src = path.join(iconsSource, icon);
    const dest = path.join(iconsDest, icon);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`  ✅ Copied icons/${icon}`);
    }
});

// Create ZIP file
console.log('\n🗜️  Creating ZIP archive...');

const zipFileName = 'mailfiller-extension.zip';
const zipPath = path.join(rootPath, zipFileName);

// Remove old zip if exists
if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
}

try {
    // Use native zip command
    process.chdir(distPath);
    execSync(`zip -r ../${zipFileName} . -x "*.DS_Store" "*__MACOSX*"`, { stdio: 'pipe' });
    process.chdir(rootPath);
    
    // Get file size
    const stats = fs.statSync(zipPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    
    console.log(`\n✅ Extension package created successfully!`);
    console.log(`   📦 File: ${zipFileName}`);
    console.log(`   📏 Size: ${fileSizeInKB} KB`);
    
    // Read manifest for version info
    const manifest = JSON.parse(fs.readFileSync(path.join(rootPath, 'manifest.json'), 'utf8'));
    console.log(`   🏷️  Version: ${manifest.version}`);
    console.log(`   📝 Name: ${manifest.name}`);
    
    console.log('\n📤 Next steps:');
    console.log('   1. Test locally: Load dist/ folder in Chrome extensions page');
    console.log('   2. Upload to Chrome Web Store: Use mailfiller-extension.zip');
    console.log('   3. Or use GitHub Actions: git tag v' + manifest.version + ' && git push --tags');
    
} catch (error) {
    console.error('❌ Failed to create ZIP file:', error.message);
    process.exit(1);
}
