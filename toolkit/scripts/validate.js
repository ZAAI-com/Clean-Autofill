#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Clean-Autofill Chrome Extension...\n');

let errors = 0;
let warnings = 0;

// Validate manifest.json
console.log('📋 Checking manifest.json:');
try {
    const manifestPath = path.join(__dirname, '..', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Required fields
    const required = {
        'manifest_version': 3,
        'name': 'string',
        'version': /^\d+\.\d+\.\d+$/,
        'description': 'string',
        'icons': 'object',
        'action': 'object',
        'permissions': 'array'
    };
    
    for (const [field, expected] of Object.entries(required)) {
        if (!(field in manifest)) {
            console.log(`  ❌ Missing required field: ${field}`);
            errors++;
        } else if (expected === 'string' && typeof manifest[field] !== 'string') {
            console.log(`  ❌ ${field} must be a string`);
            errors++;
        } else if (expected === 'object' && typeof manifest[field] !== 'object') {
            console.log(`  ❌ ${field} must be an object`);
            errors++;
        } else if (expected === 'array' && !Array.isArray(manifest[field])) {
            console.log(`  ❌ ${field} must be an array`);
            errors++;
        } else if (expected instanceof RegExp && !expected.test(manifest[field])) {
            console.log(`  ❌ ${field} has invalid format (expected: X.Y.Z)`);
            errors++;
        } else if (field === 'manifest_version' && manifest[field] !== expected) {
            console.log(`  ⚠️  ${field} is ${manifest[field]}, recommended: ${expected}`);
            warnings++;
        } else {
            console.log(`  ✅ ${field}`);
        }
    }
    
    // Check version format
    if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        console.log(`  ⚠️  Version format should be X.Y.Z (found: ${manifest.version})`);
        warnings++;
    }
    
    // Check permissions
    if (manifest.permissions) {
        const dangerousPerms = ['<all_urls>', 'tabs', 'webNavigation', 'webRequest'];
        const foundDangerous = manifest.permissions.filter(p => dangerousPerms.includes(p));
        if (foundDangerous.length > 0) {
            console.log(`  ⚠️  Using broad permissions: ${foundDangerous.join(', ')}`);
            warnings++;
        }
    }
    
} catch (error) {
    console.log(`  ❌ Failed to parse manifest.json: ${error.message}`);
    errors++;
}

// Check file sizes
console.log('\n📏 Checking file sizes:');
const files = [
    { path: 'src/background.js', maxSize: 1024 * 100 }, // 100KB
    { path: 'src/content.js', maxSize: 1024 * 100 },    // 100KB
    { path: 'src/options.js', maxSize: 1024 * 50 },     // 50KB
    { path: 'src/options.html', maxSize: 1024 * 50 },   // 50KB
];

files.forEach(({ path: filePath, maxSize }) => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        if (stats.size > maxSize) {
            console.log(`  ⚠️  ${filePath}: ${sizeKB}KB (max recommended: ${(maxSize/1024).toFixed(0)}KB)`);
            warnings++;
        } else {
            console.log(`  ✅ ${filePath}: ${sizeKB}KB`);
        }
    } else {
        console.log(`  ❌ ${filePath}: File not found`);
        errors++;
    }
});

// Check icons
console.log('\n🎨 Checking icons:');
const iconSizes = [16, 32, 48, 128];
iconSizes.forEach(size => {
    const iconPath = path.join(__dirname, '..', 'src', 'icons', `icon${size}.png`);
    if (fs.existsSync(iconPath)) {
        const stats = fs.statSync(iconPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`  ✅ icon${size}.png: ${sizeKB}KB`);
    } else {
        console.log(`  ❌ icon${size}.png: Missing`);
        errors++;
    }
});

// Check for common issues
console.log('\n🔎 Checking for common issues:');

// Check for console.log in production code
const jsFiles = ['src/background.js', 'src/content.js', 'src/options.js'];
jsFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const consoleLogs = (content.match(/console\.(log|debug|info)/g) || []).length;
        if (consoleLogs > 0) {
            console.log(`  ⚠️  ${file}: Contains ${consoleLogs} console statements`);
            warnings++;
        }
    }
});

// Check for TODO comments
jsFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const todos = (content.match(/TODO|FIXME|XXX/g) || []).length;
        if (todos > 0) {
            console.log(`  ⚠️  ${file}: Contains ${todos} TODO/FIXME comments`);
            warnings++;
        }
    }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Validation Summary:');
console.log('='.repeat(50));

if (errors === 0 && warnings === 0) {
    console.log('✅ All checks passed! Extension is ready for release.');
} else {
    if (errors > 0) {
        console.log(`❌ Errors: ${errors} (must be fixed)`);
    }
    if (warnings > 0) {
        console.log(`⚠️  Warnings: ${warnings} (should be reviewed)`);
    }
    
    if (errors > 0) {
        console.log('\n❌ Validation failed. Please fix errors before releasing.');
        process.exit(1);
    } else {
        console.log('\n⚠️  Validation passed with warnings. Consider addressing them.');
    }
}
