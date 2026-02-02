# Chrome Web Store Release via GitHub Actions

## Current State

Your project already has a fully configured release workflow at `.github/workflows/release-chrome-store.yml`. It supports:

- **Tag-based releases**: Push a version tag to trigger automatic release (currently uses `v*`, will change to `[0-9]*`)
- **Manual dispatch**: Run from GitHub Actions UI with version bump selection (patch/minor/major)
- **Automatic version bumping**: Updates `manifest.json` and commits the change
- **Chrome Web Store upload & publish**: Uses Chrome Web Store API v1.1
- **GitHub Release creation**: Attaches the `.zip` artifact with release notes

The workflow gracefully skips Chrome Web Store upload if credentials aren't configured.

---

## Setup Steps

### Step 1: Register as a Chrome Web Store Developer

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay the one-time $5 registration fee
3. Accept the developer agreement

### Step 2: Create Your Extension Entry (First Time Only)

1. In the Developer Dashboard, click **New Item**
2. Upload your `dist/Clean-Autofill.zip` manually
3. Complete the store listing:
   - Description, screenshots, category
   - Privacy policy (required)
   - Justify permissions if prompted
4. Save as draft (don't publish yet)
5. **Copy the Extension ID** from the URL: `https://chrome.google.com/webstore/devconsole/.../items/EXTENSION_ID`

### Step 3: Create Google Cloud OAuth Credentials (Detailed)

#### 3.1 Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top-left, next to "Google Cloud")
3. Click **New Project**
   - Project name: `Clean-Autofill-Publisher`
   - Organization: Leave as default or select yours
   - Click **Create**
4. Wait for project creation, then select it from the dropdown

#### 3.2 Enable Chrome Web Store API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for `Chrome Web Store API`
3. Click on it, then click **Enable**
4. Wait for the API to be enabled

#### 3.3 Configure OAuth Consent Screen (Required First)

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select User Type:
   - **External** (for personal Google accounts)
   - **Internal** (only if using Google Workspace)
3. Click **Create**
4. Fill in the App Information:
   - App name: `Clean-Autofill Publisher`
   - User support email: Your email
   - Developer contact: Your email
5. Click **Save and Continue**
6. **Scopes**: Click **Add or Remove Scopes**
   - Search for `chromewebstore`
   - Check `https://www.googleapis.com/auth/chromewebstore`
   - Click **Update**, then **Save and Continue**
7. **Test Users**: Click **Add Users**
   - Add your Google account email (the one that owns the Chrome Web Store developer account)
   - Click **Save and Continue**
8. Review and click **Back to Dashboard**

#### 3.4 Create OAuth Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Desktop app**
4. Name: `Clean-Autofill GitHub Actions`
5. Click **Create**
6. **Important**: Copy and save both values:
   - **Client ID**: `xxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxx`
7. Click **OK**

### Step 4: Generate Refresh Token (Detailed)

#### 4.1 Get Authorization Code

1. Construct this URL (replace `YOUR_CLIENT_ID` with your actual client ID):

```
https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost
```

2. Open the URL in your browser
3. Sign in with the Google account that owns the Chrome Web Store developer account
4. Click **Continue** on the consent screen
5. You'll be redirected to `http://localhost/?code=AUTHORIZATION_CODE&scope=...`
6. **Copy the `code` value** from the URL (everything between `code=` and `&scope`)
   - Example: `4/0AQlEd8xxxxxxxxxxx`
   - Note: URL decode if needed (`%2F` → `/`)

#### 4.2 Exchange Code for Refresh Token

Run this curl command (replace all placeholders):

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost"
```

#### 4.3 Save the Refresh Token

The response will look like:
```json
{
  "access_token": "ya29.xxxx",
  "expires_in": 3599,
  "refresh_token": "1//0xxxx-SAVE-THIS-VALUE-xxxx",
  "scope": "https://www.googleapis.com/auth/chromewebstore",
  "token_type": "Bearer"
}
```

**Copy the `refresh_token` value** - this is what you'll add to GitHub Secrets.

#### Troubleshooting Common Issues

| Error | Solution |
|-------|----------|
| `invalid_client` | Double-check client ID and secret are correct |
| `invalid_grant` | Authorization code expired (valid ~10 min). Get a new one |
| `access_denied` | Make sure you added yourself as a test user in OAuth consent screen |
| `redirect_uri_mismatch` | Use exactly `http://localhost` (not `https`, no trailing slash) |

### Step 5: Configure GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret

Add these 4 secrets:

| Secret Name | Value |
|-------------|-------|
| `CHROME_CLIENT_ID` | OAuth client ID from Step 3 |
| `CHROME_CLIENT_SECRET` | OAuth client secret from Step 3 |
| `CHROME_REFRESH_TOKEN` | Refresh token from Step 4 |
| `CHROME_EXTENSION_ID` | Extension ID from Step 2 |

---

## Usage

### Option A: Tag-based Release
```bash
git tag 1.0.0
git push origin 1.0.0
```

### Option B: Manual Dispatch
1. Go to Actions → "Release to Chrome Web Store"
2. Click "Run workflow"
3. Select release type (patch/minor/major)
4. Click "Run workflow"

---

## Required Workflow Modification

The current workflow uses `v*` tags. To use the preferred `1.2.3` format, update `.github/workflows/release-chrome-store.yml`:

**Change line 6 from:**
```yaml
tags:
  - 'v*'
```

**To:**
```yaml
tags:
  - '[0-9]*'
```

**Also update line 213 from:**
```yaml
git tag "v${{ steps.bump_version.outputs.NEW_VERSION }}"
```

**To:**
```yaml
git tag "${{ steps.bump_version.outputs.NEW_VERSION }}"
```

---

## Alternative: Use Existing GitHub Actions

Instead of the custom curl-based approach, you could use community actions:

- [mnao305/chrome-extension-upload](https://github.com/marketplace/actions/chrome-extension-upload-action) - Popular, well-maintained
- [browser-actions/release-chrome-extension](https://github.com/browser-actions/release-chrome-extension) - Feature-rich

Example with `mnao305/chrome-extension-upload`:
```yaml
- uses: mnao305/chrome-extension-upload@v5.0.0
  with:
    file-path: dist/Clean-Autofill.zip
    extension-id: ${{ secrets.CHROME_EXTENSION_ID }}
    client-id: ${{ secrets.CHROME_CLIENT_ID }}
    client-secret: ${{ secrets.CHROME_CLIENT_SECRET }}
    refresh-token: ${{ secrets.CHROME_REFRESH_TOKEN }}
```

---

## Important Notes

1. **Review time**: Chrome Web Store reviews typically take 1-3 business days
2. **Token expiry**: Refresh tokens may expire after 6 months of inactivity. Consider scheduling a keep-alive workflow
3. **First upload**: Must be done manually via Developer Dashboard before automation works
4. **Permissions**: Store may require justification for `<all_urls>` permission in content scripts

---

## Files Involved

- `.github/workflows/release-chrome-store.yml` - The release workflow (already configured)
- `manifest.json` - Version is auto-bumped during release
- `toolkit/scripts/pack.js` - Creates the `.zip` for upload

---

## Verification

After setup, test by running the workflow manually with a patch version bump. Check:
1. GitHub Actions log shows successful upload
2. Developer Dashboard shows new version pending review
3. GitHub Release is created with artifact
