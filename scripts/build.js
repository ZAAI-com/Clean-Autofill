#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔨 Building Clean-Autofill Chrome Extension...\n');

// Check required files
const requiredFiles = [
    'manifest.json',
    'background.js',
    'content.js',
    'options.html',
    'options.js',
    'icons/icon16.png',
    'icons/icon32.png',
    'icons/icon48.png',
    'icons/icon128.png'
];

let hasErrors = false;

console.log('📋 Checking required files:');
requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - MISSING`);
        hasErrors = true;
    }
});

if (hasErrors) {
    console.error('\n❌ Build failed: Missing required files');
    process.exit(1);
}

// Validate manifest.json
console.log('\n📄 Validating manifest.json:');
try {
    const manifestPath = path.join(__dirname, '..', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Check required fields
    const requiredFields = ['manifest_version', 'name', 'version', 'description'];
    requiredFields.forEach(field => {
        if (manifest[field]) {
            console.log(`  ✅ ${field}: ${manifest[field]}`);
        } else {
            console.log(`  ❌ ${field}: MISSING`);
            hasErrors = true;
        }
    });
    
    // Check manifest version
    if (manifest.manifest_version !== 3) {
        console.log(`  ⚠️  Warning: Using manifest version ${manifest.manifest_version}. Version 3 is recommended.`);
    }
    
} catch (error) {
    console.error(`  ❌ Failed to parse manifest.json: ${error.message}`);
    hasErrors = true;
}

// Create dist directory
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath);
    console.log('\n📁 Created dist directory');
}

if (!hasErrors) {
    console.log('\n✅ Build validation complete! Extension is ready to pack.');
    console.log('\n📦 Next step: Run "npm run pack" to create the extension package.');
} else {
    console.error('\n❌ Build validation failed. Please fix the errors above.');
    process.exit(1);
}
