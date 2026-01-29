# Quick Release Guide

## 🚀 Release Process - Quick Steps

### Option 1: Automated Release (Recommended)

```bash
# 1. Validate extension
npm run validate

# 2. Bump version
npm run bump:patch  # or bump:minor, bump:major

# 3. Commit and tag
git add manifest.json
git commit -m "Release version X.Y.Z"
git tag vX.Y.Z
git push && git push --tags

# ✅ GitHub Actions will automatically deploy to Chrome Web Store
```

### Option 2: Manual Release

```bash
# 1. Validate and pack
npm run validate
npm run pack

# 2. Upload manually
# - Go to Chrome Web Store Developer Dashboard
# - Upload dist/Clean-Autofill.zip
# - Submit for review
```

## 📝 Pre-Release Checklist

- [ ] All features tested locally
- [ ] No console.log statements in production code
- [ ] Icons look good at all sizes
- [ ] manifest.json version updated
- [ ] Options page works correctly
- [ ] Extension fills emails correctly

## 🔑 First-Time Setup

1. **Set GitHub Secrets** (Settings → Secrets → Actions):
   - `CHROME_CLIENT_ID`
   - `CHROME_CLIENT_SECRET`
   - `CHROME_REFRESH_TOKEN`
   - `CHROME_EXTENSION_ID`

2. **Test the workflow**:
   ```bash
   git tag v1.0.0
   git push --tags
   ```

## 📊 Version Guidelines

- **Patch** (1.0.X): Bug fixes only
- **Minor** (1.X.0): New features
- **Major** (X.0.0): Breaking changes

## 🚨 Emergency Rollback

If something goes wrong:

1. **In Chrome Web Store**:
   - Dashboard → Your extension → Rollback to previous version

2. **In GitHub**:
   ```bash
   git revert HEAD
   git push
   ```

## 📧 Need Help?

- Check workflow logs in GitHub Actions tab
- Review docs/GITHUB_ACTIONS_SETUP.md for detailed instructions
- Chrome Web Store typically reviews within 1-3 days
