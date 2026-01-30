# GitHub Actions Setup for Chrome Extension Deployment

This guide explains how to set up automated deployment of the Clean-Autofill Chrome Extension to the Chrome Web Store using GitHub Actions.

## 📋 Prerequisites

1. **Chrome Web Store Developer Account**
   - Register at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
   - Pay the one-time $5 developer fee
   - Create your extension listing

2. **GitHub Repository**
   - Your extension code must be in a GitHub repository
   - You need admin access to configure secrets

## 🔧 Setup Instructions

### Step 1: Obtain Chrome Web Store API Credentials

1. **Enable Chrome Web Store API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable the Chrome Web Store API
   
2. **Create OAuth 2.0 Credentials**
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Desktop app"
   - Download the credentials JSON

3. **Get Refresh Token**
   ```bash
   # Install Google's OAuth tool
   npm install -g @chrome-web-store/cli
   
   # Generate refresh token
   chrome-web-store-cli auth \
     --client-id YOUR_CLIENT_ID \
     --client-secret YOUR_CLIENT_SECRET
   ```
   
   Follow the prompts and save the refresh token.

4. **Get Extension ID**
   - If new extension: Upload manually once to get the ID
   - Find it in Chrome Web Store Developer Dashboard

### Step 2: Configure GitHub Secrets

In your GitHub repository, go to Settings → Secrets and variables → Actions

Add these secrets:
- `CHROME_CLIENT_ID`: Your OAuth client ID
- `CHROME_CLIENT_SECRET`: Your OAuth client secret
- `CHROME_REFRESH_TOKEN`: The refresh token obtained above
- `CHROME_EXTENSION_ID`: Your extension's ID in Chrome Web Store

### Step 3: Workflows Overview

#### 1. **Build and Test Workflow** (`build-and-test.yml`)
- **Triggers**: Push to main/develop, pull requests
- **Actions**:
  - Validates manifest.json
  - Checks all required files exist
  - Creates extension ZIP package
  - Uploads artifact for testing

#### 2. **Release Workflow** (`release-chrome-store.yml`)
- **Triggers**: 
  - Push tags starting with 'v' (e.g., v1.0.0)
  - Manual trigger with version bump option
- **Actions**:
  - Bumps version if triggered manually
  - Creates extension package
  - Uploads to Chrome Web Store
  - Publishes extension (may require review)
  - Creates GitHub release

## 📦 Usage Guide

### Automatic Releases (Recommended)

1. **Bump version locally**:
   ```bash
   node toolkit/scripts/bump-version.js patch  # or minor/major
   ```

2. **Commit and tag**:
   ```bash
   git add manifest.json
   git commit -m "Bump version to 1.0.1"
   git tag v1.0.1
   git push && git push --tags
   ```

3. **Automatic deployment**:
   - GitHub Actions will automatically:
     - Build the extension
     - Upload to Chrome Web Store
     - Create GitHub release

### Manual Release

1. Go to Actions tab in GitHub
2. Select "Release to Chrome Web Store"
3. Click "Run workflow"
4. Select release type (patch/minor/major)
5. Click "Run workflow"

### Testing Builds

For any push or PR:
1. Go to Actions tab
2. Click on the workflow run
3. Download the artifact to test locally

## 🔍 Monitoring Deployments

### Check Workflow Status
- Go to Actions tab in GitHub
- Green ✅ = Success
- Red ❌ = Failed (check logs)
- Yellow 🟡 = In progress

### Chrome Web Store Status
- Check [Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
- New versions may be "Pending Review"
- Review typically takes 1-3 days

## 🚨 Troubleshooting

### Common Issues

1. **"Missing Chrome credentials"**
   - Ensure all 4 secrets are set in GitHub
   - Check secret names match exactly

2. **"Upload failed"**
   - Verify extension ID is correct
   - Check API quotas in Google Cloud Console
   - Ensure refresh token is valid

3. **"Publish pending review"**
   - Normal for significant changes
   - Check email for Chrome Web Store notifications

4. **"Invalid manifest"**
   - Run build workflow first to validate
   - Check version format (major.minor.patch)

### Manual Testing

Test the package locally:
```bash
# Create package
bun run pack

# Load in Chrome
1. Open chrome://extensions/
2. Enable Developer Mode
3. Load unpacked → select dist/ folder
```

## 📊 Version Management

### Semantic Versioning
- **Patch** (1.0.X): Bug fixes
- **Minor** (1.X.0): New features (backward compatible)
- **Major** (X.0.0): Breaking changes

### Version Bump Script
```bash
# Bump patch version (1.0.0 → 1.0.1)
bun run bump:patch

# Bump minor version (1.0.0 → 1.1.0)
bun run bump:minor

# Bump major version (1.0.0 → 2.0.0)
bun run bump:major
```

## 🔐 Security Best Practices

1. **Never commit credentials**
   - Use GitHub Secrets only
   - Add credentials to .gitignore

2. **Rotate tokens periodically**
   - Regenerate refresh token every 6 months
   - Update GitHub secrets

3. **Limit permissions**
   - Only grant necessary API scopes
   - Use separate credentials for CI/CD

4. **Monitor access**
   - Check Google Cloud Console logs
   - Review GitHub Actions history

## 📝 Checklist for First Release

- [ ] Chrome Web Store developer account created
- [ ] Extension uploaded manually once (to get ID)
- [ ] OAuth credentials created in Google Cloud
- [ ] Refresh token generated
- [ ] All 4 GitHub secrets configured
- [ ] Test build workflow runs successfully
- [ ] Version in manifest.json is correct
- [ ] Ready to tag and release

## 🔗 Useful Links

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/api/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Google Cloud Console](https://console.cloud.google.com/)

## 📧 Support

For issues with:
- **GitHub Actions**: Check workflow logs in Actions tab
- **Chrome Web Store**: Contact Chrome Web Store support
- **Extension bugs**: Create issue in GitHub repository

---

Last updated: January 2026
Clean-Autofill Chrome Extension
