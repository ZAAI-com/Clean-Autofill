# Chrome Web Store — Image Specifications

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

## Screenshots (1280x800 px, PNG)

Chrome Web Store allows up to 5 screenshots. Minimum 1 required. 1280x800 is the preferred high-resolution size.

### Screenshot 1 — Autofill in Action

| Property | Value |
|----------|-------|
| File | `screenshot-1.png` |
| Dimensions | 1280x800 px |
| Status | Done |

Shows the extension filling `linear.app@manuelgruber.net` into Linear's signup page. Blue arrow points to the filled field. Clean, minimal browser chrome visible.

### Screenshot 2 — Settings + Side-by-Side

| Property | Value |
|----------|-------|
| File | `screenshot-2.png` |
| Dimensions | 1280x800 px |
| Status | Done |

Shows the Clean Autofill Settings page open alongside an Apple Account signup page. Demonstrates the settings UI and real-world usage context.

### Screenshot 3 — Email History

| Property | Value |
|----------|-------|
| File | `screenshot-3.png` |
| Dimensions | 1280x800 px |
| Status | TODO |

**What to capture:**
- Options page with "History" tab active
- Table populated with 5-8 example entries showing different domains
- Search bar visible at top
- Shows: Domain column, Email column, Date column
- Browser chrome visible (consistent with other screenshots)

**How to capture:**
1. Open extension options page
2. Navigate to History tab
3. Generate emails on several sites first to populate history
4. Take screenshot at 1280x800 (or capture full window and resize)

### Screenshot 4 — Provider Detection

| Property | Value |
|----------|-------|
| File | `screenshot-4.png` |
| Dimensions | 1280x800 px |
| Status | TODO |

**What to capture:**
- Options page with "Settings" tab active
- Email domain entered (e.g., Gmail address)
- Provider icon detected and displayed (Gmail logo visible)
- Mode selection table showing Plus Addressing vs Catch-All
- Green checkmarks for supported features
- Live example preview at the bottom

**How to capture:**
1. Open extension options page → Settings
2. Enter a Gmail address to trigger provider detection
3. Ensure the mode comparison table and examples are visible
4. Take screenshot at 1280x800

### Screenshot 5 — Popup on Different Site

| Property | Value |
|----------|-------|
| File | `screenshot-5.png` |
| Dimensions | 1280x800 px |
| Status | TODO |

**What to capture:**
- A recognizable website's signup page (GitHub, Amazon, or Spotify)
- Extension popup open showing the generated email
- Copy button visible in popup
- Email filled into the form field below
- Browser address bar showing the site URL

**How to capture:**
1. Navigate to a recognizable signup page
2. Click the extension icon to generate and fill
3. Keep the popup open
4. Take screenshot at 1280x800 (may need browser dev tools to keep popup open)

---

## Small Promotional Image (440x280 px, PNG)

| Property | Value |
|----------|-------|
| File | `small-promo-440x280.png` |
| Dimensions | 440x280 px |
| Format | PNG |
| Status | TODO |

**Required** — extensions without this image rank lower in store search results.

**Design spec:**
- Background: Solid or subtle gradient using Primary Green (#4CAF50 → #388E3C)
- Center: Extension icon (white @ shield) at ~80px
- Below icon: "Clean Autofill" in white, semi-bold, ~20px
- Below name: "One click. Unique emails." in white, lighter weight, ~14px
- No busy backgrounds or excessive text
- Ensure well-defined edges, avoid text clipping near borders
- Leave ~20px padding on all sides

**Tools:** Figma, Canva, or any image editor. Export as PNG at exact 440x280.

---

## Marquee Promotional Image (1400x560 px, PNG)

| Property | Value |
|----------|-------|
| File | `marquee-1400x560.png` |
| Dimensions | 1400x560 px |
| Format | PNG |
| Status | TODO |

**Optional** — required only if seeking featured placement in the store.

**Design spec:**
- Background: Light gray (#F5F5F5) or white with subtle green accent
- Left side (~60%): Extension icon + "Clean Autofill" title + tagline "Stop typing email addresses. One click, done."
- Right side (~40%): Mockup of the extension popup or a browser window showing the autofill in action
- Keep text large and readable — this displays at various sizes
- Use the brand green (#4CAF50) for accent elements
- Leave generous padding (~40px minimum on all sides)

**Tools:** Figma, Canva, or any image editor. Export as PNG at exact 1400x560.

---

## General Guidelines

- All images must be PNG format
- No alpha transparency on promotional images (use solid backgrounds)
- Avoid excessive text overlays on screenshots
- Use saturated colors and well-defined edges
- Ensure screenshots look clean — hide bookmarks bar, minimize open tabs
- Test that images look good at both full size and thumbnail
