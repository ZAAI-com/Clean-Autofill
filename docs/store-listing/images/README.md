# Chrome Web Store — Image Assets

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Green | `#4CAF50` | Buttons, accents, icon background |
| Dark Green | `#388E3C` | Icon shield gradient |
| White | `#FFFFFF` | Backgrounds, text on green |
| Dark Text | `#333333` | Body text |
| Light Gray | `#F5F5F5` | Section backgrounds |

---

## Store Icon

| Property | Value |
|----------|-------|
| File | `icon-128.png` |
| Dimensions | 128x128 px |
| Format | PNG |
| Status | Done |

Green shield with @ symbol. Already meets Chrome Web Store requirements (96px artwork + padding).

---

## Generation

Run:

```bash
python3 docs/store-listing/images/generate.py
```

The generator renders real extension UI from `src/ui/options.html`, `src/ui/options.css`, and `src/ui/popup.html`, then composes the final store assets on a shared dark gradient background. The two action shots try live captures of recognizable signup pages (Netflix, Wikipedia) and fall back to deterministic local mocks if those pages change.

---

## Screenshots (1280x800 px, PNG)

Chrome Web Store allows up to 5 screenshots. Minimum 1 required. 1280x800 is the preferred high-resolution size.

### Screenshot 1 — One-Click Fill

| Property | Value |
|----------|-------|
| File | `screenshot-1.png` |
| Dimensions | 1280x800 px |
| Status | Done |

Shows a browser-framed Netflix signup scene with a generated address already filled into the email field.

### Screenshot 2 — Instant Popup

| Property | Value |
|----------|-------|
| File | `screenshot-2.png` |
| Dimensions | 1280x800 px |
| Status | Done |

Shows a Wikipedia create-account form with the real extension popup open and the generated email visible.

### Screenshot 3 — Provider Match

| Property | Value |
|----------|-------|
| File | `screenshot-3.png` |
| Dimensions | 1280x800 px |
| Status | Done |

Shows the real Settings page with Gmail provider detection, plus-addressing selected, and two visible example rows.

### Screenshot 4 — Signup History

| Property | Value |
|----------|-------|
| File | `screenshot-4.png` |
| Dimensions | 1280x800 px |
| Status | Done |

Shows the real History page with five example entries and one highlighted row.

### Screenshot 5 — See Examples

| Property | Value |
|----------|-------|
| File | `screenshot-5.png` |
| Dimensions | 1280x800 px |
| Status | Done |

Shows the real Home page with the 3-step explanation and four example mappings.

---

## Small Promotional Image (440x280 px, PNG)

| Property | Value |
|----------|-------|
| File | `small-promo-440x280.png` |
| Dimensions | 440x280 px |
| Format | PNG |
| Status | Done |

**Required** — extensions without this image rank lower in store search results.

Uses the same visual system as the screenshots: soft background, floating icon tile, and a single email pill to communicate the feature quickly.

---

## Marquee Promotional Image (1400x560 px, PNG)

| Property | Value |
|----------|-------|
| File | `marquee-1400x560.png` |
| Dimensions | 1400x560 px |
| Format | PNG |
| Status | Done |

**Optional** — required only if seeking featured placement in the store.

Uses the same shared background and browser-card language as the screenshots, with value copy on the left and a Netflix autofill hero scene on the right.

---

## General Guidelines

- All images must be PNG format
- No alpha transparency on promotional images (use solid backgrounds)
- Avoid excessive text overlays on screenshots
- Use saturated colors and well-defined edges
- Ensure screenshots look clean — hide bookmarks bar, minimize open tabs
- Test that images look good at both full size and thumbnail
