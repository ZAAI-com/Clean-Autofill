# Chrome Web Store — Publishing Checklist

Use this checklist when updating the store listing or publishing a new version.

---

## Before Publishing

### Assets
- [ ] **Icon** — `images/icon-128.png` (128x128) uploaded
- [ ] **Screenshot 1** — `images/screenshot-1.png` (1280x800) uploaded
- [ ] **Screenshot 2** — `images/screenshot-2.png` (1280x800) uploaded
- [ ] **Screenshot 3** — `images/screenshot-3.png` (1280x800) captured and uploaded
- [ ] **Screenshot 4** — `images/screenshot-4.png` (1280x800) captured and uploaded
- [ ] **Screenshot 5** — `images/screenshot-5.png` (1280x800) captured and uploaded
- [ ] **Small Promo** — `images/small-promo-440x280.png` (440x280) designed and uploaded
- [ ] **Marquee** — `images/marquee-1400x560.png` (1400x560) designed and uploaded (optional)

### Store Listing Tab
- [ ] **Title** — Paste from `texts.md` → Title (max 75 chars)
- [ ] **Summary** — Paste from `texts.md` → Summary (max 132 chars)
- [ ] **Description** — Paste from `texts.md` → Description (plain text block)
- [ ] **Category** — Select "Productivity"
- [ ] **Language** — English

### Privacy Tab
- [ ] **Single purpose** — Paste from `privacy-justifications.md` → Single Purpose Description
- [ ] **Permission justifications** — Paste each from `privacy-justifications.md`
- [ ] **Privacy policy URL** — `https://github.com/ZAAI-com/Clean-Autofill/blob/main/docs/PRIVACY.md`
- [ ] **Data use disclosures** — Confirm "Does not collect user data"

### Package
- [ ] Version bumped in `manifest.json`
- [ ] `bun run build` succeeds
- [ ] `bun run test` passes
- [ ] `bun run check` passes
- [ ] `bun run pack` creates `dist/Clean-Autofill.zip`
- [ ] Upload `.zip` via dashboard or GitHub Actions

---

## Publishing

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Select "Clean Autofill" from your items
3. Update any changed fields (texts, images, package)
4. Click "Submit for review"
5. Review typically takes 1-3 business days

---

## After Publishing

- [ ] Verify listing appears correctly on the [store page](https://chromewebstore.google.com/detail/clean-autofill/klbbkndjohchnidkbnjijdbggfadpppf)
- [ ] Check all screenshots display properly
- [ ] Test install from store on a clean Chrome profile
- [ ] Update `docs/store-listing/` if any changes were made directly in the dashboard
