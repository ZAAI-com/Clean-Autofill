#!/usr/bin/env python3
"""
Generate Chrome Web Store listing images for Clean Autofill.

Extracts the real Chrome browser frame from screenshot-1.png and composites
Playwright-rendered extension content inside it.

Usage: python3 docs/store-listing/images/generate.py
"""

import base64
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.parent.parent.parent
OUT = Path(__file__).parent

# App icon as base64 data URI (green shield with @)
with open(ROOT / "src" / "icons" / "icon128.png", "rb") as f:
    APP_ICON = f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"

# App icon SVG (for inline use in promo images)
APP_ICON_SVG = (ROOT / "src" / "icons" / "icon.svg").read_text()

# Real CSS with sidebar patched for embedding
OPTIONS_CSS = (ROOT / "src" / "ui" / "options.css").read_text()
OPTIONS_CSS = OPTIONS_CSS.replace("position: fixed;", "position: relative;")
OPTIONS_CSS = OPTIONS_CSS.replace("min-height: 100vh;", "min-height: 100%;")
OPTIONS_CSS += "\n.content { max-width: none; flex: 1; }\n"
# Override sidebar icon to show real app icon instead of plain green square
OPTIONS_CSS += """
.sidebar-header .icon {
  background: url('""" + APP_ICON + """') center/contain no-repeat !important;
  border-radius: 6px !important;
}
"""

GMAIL_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18'%3E%3Crect width='18' height='18' rx='3' fill='%23EA4335'/%3E%3Ctext x='9' y='13' text-anchor='middle' fill='white' font-size='11' font-weight='700' font-family='sans-serif'%3EG%3C/text%3E%3C/svg%3E"


# ─────────────────────────────────────────────
# Chrome frame extraction from screenshot-1.png
# ─────────────────────────────────────────────
# screenshot-1 has a real macOS Chrome window:
#   Window interior: x=285..994 (710px wide)
#   Shadow extends: ~8px each side
#   Chrome header: y=82..169 (88px, includes shadow + tab strip + toolbar)
#   Content: y=170+
#   Bottom edge: y=695..713 (19px, rounded corners + shadow)
#   Background: #e4f2fd (228, 242, 253)

BG_COLOR = (228, 242, 253)

# Slice coordinates from screenshot-1
CHROME_Y_TOP = 82
CHROME_Y_BOTTOM = 170   # content starts here
BOTTOM_Y_TOP = 695
BOTTOM_Y_BOTTOM = 714
LEFT_X = 270
RIGHT_X = 1010
# Split point for left/right slices (capture enough for corners + icons)
SPLIT_LEFT = 470   # 200px from left edge
SPLIT_RIGHT = 810  # 200px from right edge


def build_chrome_frame(target_width, content_height):
    """
    Build a Chrome browser frame at the given width by stretching the middle
    section of the real Chrome header from screenshot-1.

    Returns (frame_image, content_paste_x, content_paste_y, content_width, content_height)
    """
    src = Image.open(OUT / "screenshot-1.png")

    # Margins: window is centered with ~270px on each side in the original
    # For our wider windows, use less margin
    margin_x = 60
    margin_top = 35
    margin_bottom = 35

    win_width = target_width - 2 * margin_x
    frame_height = margin_top + 88 + content_height + 19 + margin_bottom

    # We need to scale if win_width != original 740px
    # Extract slices
    left_chrome = src.crop((LEFT_X, CHROME_Y_TOP, SPLIT_LEFT, CHROME_Y_BOTTOM))    # 200x88
    right_chrome = src.crop((SPLIT_RIGHT, CHROME_Y_TOP, RIGHT_X, CHROME_Y_BOTTOM))  # 200x88
    mid_chrome = src.crop((639, CHROME_Y_TOP, 641, CHROME_Y_BOTTOM))                # 2x88

    left_bottom = src.crop((LEFT_X, BOTTOM_Y_TOP, SPLIT_LEFT, BOTTOM_Y_BOTTOM))     # 200x19
    right_bottom = src.crop((SPLIT_RIGHT, BOTTOM_Y_TOP, RIGHT_X, BOTTOM_Y_BOTTOM))  # 200x19
    mid_bottom = src.crop((639, BOTTOM_Y_TOP, 641, BOTTOM_Y_BOTTOM))                # 2x19

    left_shadow = src.crop((LEFT_X, 400, 285, 401))     # left shadow strip
    right_shadow = src.crop((994, 400, RIGHT_X, 401))    # right shadow strip

    # Total window pixel width including shadow
    total_w = win_width + (285 - LEFT_X) + (RIGHT_X - 994)  # + shadow on each side
    # Actually let's think of it as: left_slice (200px) + stretched_middle + right_slice (200px)
    mid_width = total_w - 200 - 200
    if mid_width < 10:
        mid_width = 10

    # Stretch middle
    stretched_mid_chrome = mid_chrome.resize((mid_width, 88), Image.LANCZOS)
    stretched_mid_bottom = mid_bottom.resize((mid_width, 19), Image.LANCZOS)
    stretched_mid_shadow = left_shadow.crop((0, 0, 1, 1))  # just white pixel

    # Create the output image
    out_w = target_width
    out_h = margin_top + 88 + content_height + 19 + margin_bottom
    result = Image.new("RGB", (out_w, out_h), BG_COLOR)

    # Center the window horizontally
    win_start_x = margin_x

    # Paste chrome header: left + stretched middle + right
    y_off = margin_top
    result.paste(left_chrome, (win_start_x, y_off))
    result.paste(stretched_mid_chrome, (win_start_x + 200, y_off))
    result.paste(right_chrome, (win_start_x + 200 + mid_width, y_off))

    # Paste bottom: left + stretched middle + right
    y_bot = margin_top + 88 + content_height
    result.paste(left_bottom, (win_start_x, y_bot))
    result.paste(stretched_mid_bottom, (win_start_x + 200, y_bot))
    result.paste(right_bottom, (win_start_x + 200 + mid_width, y_bot))

    # Fill left/right shadow strips along the content area
    shadow_l = left_shadow.resize((left_shadow.width, content_height), Image.LANCZOS)
    shadow_r = right_shadow.resize((right_shadow.width, content_height), Image.LANCZOS)
    result.paste(shadow_l, (win_start_x, margin_top + 88))
    result.paste(shadow_r, (win_start_x + 200 + mid_width + 200 - right_shadow.width, margin_top + 88))

    # Content paste coordinates (inside the window, after chrome)
    # The actual content area starts after the left shadow (15px in from window edge)
    content_x = win_start_x + (285 - LEFT_X)  # skip shadow
    content_y = margin_top + 88
    content_w = total_w - (285 - LEFT_X) - (RIGHT_X - 994)

    return result, content_x, content_y, content_w, content_height


def render_content(page, html, width, height):
    """Render HTML content and return as PIL Image."""
    page.set_viewport_size({"width": width, "height": height})
    page.set_content(html, wait_until="networkidle")
    buf = page.screenshot(type="png")
    from io import BytesIO
    return Image.open(BytesIO(buf))


# ─────────────────────────────────
# Content HTML for each screenshot
# ─────────────────────────────────

def history_html(w, h):
    entries = [
        ("github.com", "github.com@manuelgruber.net", "Apr 8, 2026, 10:23 AM"),
        ("amazon.com", "amazon.com@manuelgruber.net", "Apr 7, 2026, 3:45 PM"),
        ("linear.app", "linear.app@manuelgruber.net", "Apr 7, 2026, 11:02 AM"),
        ("spotify.com", "spotify.com@manuelgruber.net", "Apr 6, 2026, 9:18 PM"),
        ("notion.so", "notion.so@manuelgruber.net", "Apr 6, 2026, 2:30 PM"),
        ("stripe.com", "stripe.com@manuelgruber.net", "Apr 5, 2026, 4:12 PM"),
        ("claude.ai", "claude.ai@manuelgruber.net", "Apr 5, 2026, 10:45 AM"),
        ("netflix.com", "netflix.com@manuelgruber.net", "Apr 4, 2026, 8:30 PM"),
    ]
    rows = "\n".join(f'<tr><td class="col-domain">{d}</td><td class="col-email">{e}</td>'
                     f'<td class="col-date">{dt}</td>'
                     f'<td class="col-actions"><button class="btn-copy">Copy</button>'
                     f'<button class="btn-delete">&times;</button></td></tr>'
                     for d, e, dt in entries)
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{OPTIONS_CSS}
html, body {{ width: {w}px; height: {h}px; overflow: hidden; }}
.ext-layout {{ display: flex; height: 100%; background: #f5f5f5; }}
.sidebar {{ height: 100%; top: auto; left: auto; bottom: auto; }}
.content {{ display: block; }}
.page-subtitle {{ margin-bottom: 24px; }}
</style></head><body>
<div class="ext-layout">
  <nav class="sidebar">
    <div class="sidebar-header"><div class="icon"></div><span>Clean-Autofill</span></div>
    <a class="nav-item">Home</a><a class="nav-item">Settings</a>
    <a class="nav-item active">History</a><a class="nav-item">Help</a>
  </nav>
  <main class="content">
    <h1 class="page-title">History</h1>
    <p class="page-subtitle">Emails generated by Clean-Autofill</p>
    <div class="history-toolbar">
      <input type="text" class="history-search" placeholder="Search by domain or email...">
      <button class="button-danger">Clear All</button>
    </div>
    <table class="history-table">
      <thead><tr><th>Domain</th><th>Email</th><th>Date</th><th></th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </main>
</div></body></html>"""


def settings_html(w, h):
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{OPTIONS_CSS}
html, body {{ width: {w}px; height: {h}px; overflow: hidden; }}
.ext-layout {{ display: flex; height: 100%; background: #f5f5f5; }}
.sidebar {{ height: 100%; top: auto; left: auto; bottom: auto; }}
.content {{ display: block; max-width: 700px; }}
</style></head><body>
<div class="ext-layout">
  <nav class="sidebar">
    <div class="sidebar-header"><div class="icon"></div><span>Clean-Autofill</span></div>
    <a class="nav-item">Home</a><a class="nav-item active">Settings</a>
    <a class="nav-item">History</a><a class="nav-item">Help</a>
  </nav>
  <main class="content">
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Configure your email for automatic email generation</p>
      </div>
      <button type="submit">Save Settings</button>
    </div>
    <section class="settings-section">
      <h2>1. Provide Email Address</h2>
      <div class="detection-box detected">
        <div class="detection-label">Chrome Profile</div>
        <div class="detection-content"><span class="detected-email">john.doe@gmail.com</span></div>
      </div>
      <div class="form-group">
        <input type="text" value="john.doe@gmail.com" style="border-color:#4CAF50;">
        <p class="help-text">Enter a full email for <strong>Plus Addressing</strong> Mode or just a domain for <strong>Catch-All Prefix</strong> Mode.</p>
      </div>
    </section>
    <section class="settings-section">
      <h2>2. Select Mode</h2>
      <div class="detection-box detected">
        <div class="detection-label">Email Provider Detection</div>
        <div class="detection-content">
          <span class="provider-logo" style="display:inline-flex;"><img src="{GMAIL_ICON}" width="18" height="18" style="border-radius:3px;"></span>
          <div class="provider-detected" style="display:flex;"><span class="provider-text">Gmail</span></div>
        </div>
      </div>
      <div class="mode-table">
        <div class="mode-column selected">
          <div class="mode-header">Plus Addressing</div>
          <div class="mode-row"><div class="row-label">Format</div><div class="row-value"><code>john.doe+site@gmail.com</code></div></div>
          <div class="mode-row"><div class="row-label">Requirements</div><div class="row-value req-checks">
            <div class="req-check"><span class="req-label">Email Provider</span><span class="req-value-group"><span class="req-value">Gmail</span><span class="req-indicator req-supported"></span></span></div>
            <div class="req-check"><span class="req-label">Plus Addressing</span><span class="req-value-group"><span class="req-value">Supported</span><span class="req-indicator req-supported"></span></span></div>
          </div></div>
        </div>
        <div class="mode-column">
          <div class="mode-header">Catch-All Prefix</div>
          <div class="mode-row"><div class="row-label">Format</div><div class="row-value"><code>site@yourdomain.com</code></div></div>
          <div class="mode-row"><div class="row-label">Requirements</div><div class="row-value req-checks">
            <div class="req-check"><span class="req-label">Custom Domain</span><span class="req-value-group"><span class="req-value">Not detected</span><span class="req-indicator req-incompatible"></span></span></div>
            <div class="req-check"><span class="req-label">Catch-All</span><span class="req-value-group"><span class="req-value">--</span></span></div>
          </div></div>
        </div>
      </div>
    </section>
    <section class="settings-section">
      <h2>3. Examples</h2>
      <div class="examples-list">
        <div class="example-row"><span class="example-site">wikipedia.org</span><span class="example-arrow">&rarr;</span><code class="example-email">john.doe+wikipedia.org@gmail.com</code></div>
        <div class="example-row"><span class="example-site">amazon.com</span><span class="example-arrow">&rarr;</span><code class="example-email">john.doe+amazon.com@gmail.com</code></div>
        <div class="example-row"><span class="example-site">zalando.de</span><span class="example-arrow">&rarr;</span><code class="example-email">john.doe+zalando.de@gmail.com</code></div>
        <div class="example-row"><span class="example-site">ui.com</span><span class="example-arrow">&rarr;</span><code class="example-email">john.doe+ui.com@gmail.com</code></div>
      </div>
    </section>
  </main>
</div></body></html>"""


def popup_html(w, h):
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:{w}px; height:{h}px; overflow:hidden; }}
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
.page {{ background: #f6f8fa; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; }}
.wrap {{ text-align: center; width: 340px; }}
.logo {{ margin-bottom: 24px; }}
.title {{ font-size: 24px; font-weight: 300; color: #24292f; margin-bottom: 24px; }}
.form {{ background: #fff; border: 1px solid #d0d7de; border-radius: 6px; padding: 24px; text-align: left; }}
.field {{ margin-bottom: 16px; }}
.label {{ display: block; font-size: 14px; font-weight: 600; color: #24292f; margin-bottom: 6px; }}
.input {{ width: 100%; padding: 8px 12px; font-size: 14px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; outline: none; font-family: inherit; }}
.input.filled {{ border-color: #4CAF50; background: #f0fff0; color: #2e7d32; font-family: monospace; font-size: 13px; }}
.btn {{ width: 100%; padding: 10px; font-size: 14px; font-weight: 600; background: #2da44e; color: #fff; border: none; border-radius: 6px; margin-top: 8px; }}
.popup-anchor {{ position: absolute; top: 10px; right: 50px; }}
.popup {{ background: #fff; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,0.18); padding: 16px; min-width: 340px; }}
.popup-hdr {{ display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }}
.popup-ico {{ width: 20px; height: 20px; border-radius: 5px; background: url('{APP_ICON}') center/contain no-repeat; }}
.popup-ttl {{ font-size: 14px; font-weight: 600; color: #333; }}
.popup-row {{ display: flex; align-items: center; gap: 8px; background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 12px; }}
.popup-email {{ flex: 1; font-family: monospace; font-size: 13px; color: #333; }}
.popup-copy {{ background: #4CAF50; color: #fff; border: none; border-radius: 4px; padding: 6px 14px; font-size: 12px; font-weight: 500; }}
.popup-status {{ font-size: 12px; color: #4CAF50; margin-top: 8px; }}
</style></head><body>
<div class="page">
  <div class="wrap">
    <div class="logo"><svg width="48" height="48" viewBox="0 0 16 16" fill="#24292f"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></div>
    <h1 class="title">Create your account</h1>
    <div class="form">
      <div class="field"><label class="label">Email address</label><input class="input filled" value="github.com@manuelgruber.net"></div>
      <div class="field"><label class="label">Password</label><input type="password" class="input"></div>
      <button class="btn">Create account</button>
    </div>
  </div>
  <div class="popup-anchor">
    <div class="popup">
      <div class="popup-hdr"><div class="popup-ico"></div><span class="popup-ttl">Clean Autofill</span></div>
      <div class="popup-row"><span class="popup-email">github.com@manuelgruber.net</span><button class="popup-copy">Copy</button></div>
      <div class="popup-status">&#10003; Filled into email field</div>
    </div>
  </div>
</div></body></html>"""


# ─────────────────────────
# Promo images (standalone)
# ─────────────────────────

SMALL_PROMO_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:440px;height:280px;background:linear-gradient(135deg,#4CAF50,#2E7D32);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden}}
.ic{{width:88px;height:88px;margin-bottom:20px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.15))}}
.t{{font-size:22px;font-weight:600;color:#fff;margin-bottom:8px}}
.s{{font-size:14px;color:rgba(255,255,255,.85)}}
</style></head><body><img class="ic" src="{APP_ICON}"><div class="t">Clean Autofill</div><div class="s">One click. Unique emails.</div></body></html>"""

MARQUEE_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1400px;height:560px;background:#f8f9fa;display:flex;align-items:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden}}
.l{{flex:1;padding:60px 0 60px 80px;display:flex;flex-direction:column;justify-content:center}}
.ir{{display:flex;align-items:center;gap:16px;margin-bottom:24px}}
.ib{{width:56px;height:56px;border-radius:14px;box-shadow:0 4px 12px rgba(76,175,80,.3)}}
.br{{font-size:28px;font-weight:700;color:#333;letter-spacing:-.5px}}
.tl{{font-size:22px;color:#555;line-height:1.5;max-width:440px;margin-bottom:32px}}
.fs{{display:flex;flex-direction:column;gap:10px}}
.f{{display:flex;align-items:center;gap:10px;font-size:15px;color:#555}}
.fd{{width:8px;height:8px;border-radius:50%;background:#4CAF50;flex-shrink:0}}
.r{{width:600px;display:flex;align-items:center;justify-content:center;padding:40px 60px 40px 20px}}
.mk{{width:480px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);overflow:hidden}}
.mb{{background:#e8e8e8;padding:8px 12px;display:flex;align-items:center;gap:6px}}
.md{{width:8px;height:8px;border-radius:50%}}.mr{{background:#ff5f57}}.my{{background:#febc2e}}.mg{{background:#28c840}}
.mu{{flex:1;background:#f1f3f4;border-radius:12px;padding:4px 10px;font-size:10px;color:#555;margin-left:8px}}
.mc{{padding:24px;display:flex;flex-direction:column;gap:12px}}
.ms{{text-align:center;font-size:14px;font-weight:600;color:#333;padding-bottom:12px;border-bottom:1px solid #eee}}
.mf{{border:1.5px solid #e0e0e0;border-radius:6px;padding:8px 10px;font-size:11px;color:#aaa}}
.mf.fl{{border-color:#4CAF50;background:#f0fff0;color:#2e7d32;font-family:monospace}}
.pw{{position:relative}}.pp{{background:#fff;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:10px 14px;margin:0 auto;width:280px}}
.ph{{display:flex;align-items:center;gap:6px;margin-bottom:8px}}
.pi{{width:14px;height:14px;border-radius:3px}}
.pt{{font-size:11px;font-weight:600;color:#333}}
.pe{{display:flex;align-items:center;gap:6px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;padding:5px 8px}}
.pet{{flex:1;font-family:monospace;font-size:10px;color:#333}}
.pec{{background:#4CAF50;color:#fff;border:none;border-radius:3px;padding:3px 8px;font-size:9px;font-weight:600}}
.pes{{font-size:9px;color:#4CAF50;margin-top:4px}}
</style></head><body>
<div class="l"><div class="ir"><img class="ib" src="{APP_ICON}"><span class="br">Clean Autofill</span></div>
<div class="tl">Stop typing email addresses.<br>One click, done.</div>
<div class="fs"><div class="f"><div class="fd"></div>Unique email for every website</div><div class="f"><div class="fd"></div>Track who sells your data</div><div class="f"><div class="fd"></div>Privacy-first — works offline</div><div class="f"><div class="fd"></div>Cross-device sync</div></div></div>
<div class="r"><div class="mk"><div class="mb"><div class="md mr"></div><div class="md my"></div><div class="md mg"></div><div class="mu">linear.app/signup</div></div>
<div class="mc"><div class="ms">Sign up for Linear</div><div class="mf fl">linear.app@yourdomain.com</div><div class="mf">Password</div></div>
<div class="pw"><div class="pp"><div class="ph"><img class="pi" src="{APP_ICON}"><span class="pt">Clean Autofill</span></div><div class="pe"><span class="pet">linear.app@yourdomain.com</span><button class="pec">Copy</button></div><div class="pes">✓ Filled into email field</div></div></div></div></div>
</body></html>"""


def main():
    print("Generating Chrome Web Store images...\n")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        for name, html_fn, out_w, out_h in [
            ("screenshot-3", history_html, 1280, 800),
            ("screenshot-4", settings_html, 1280, 800),
            ("screenshot-5", popup_html, 1280, 800),
        ]:
            # Build frame and get content dimensions
            frame, cx, cy, cw, ch = build_chrome_frame(out_w, out_h - 35 - 35 - 88 - 19 + 35 + 35)
            # Recalculate: we want final image = 1280x800
            # frame height = margin_top(35) + chrome(88) + content + bottom(19) + margin_bottom(35) = 800
            # So content_height = 800 - 35 - 88 - 19 - 35 = 623
            content_h = 623
            frame, cx, cy, cw, content_h = build_chrome_frame(out_w, content_h)

            # Render content
            content_img = render_content(page, html_fn(cw, content_h), cw, content_h)

            # Composite
            frame.paste(content_img, (cx, cy))

            # Ensure exact output size
            if frame.size != (out_w, out_h):
                final = Image.new("RGB", (out_w, out_h), BG_COLOR)
                final.paste(frame, (0, 0))
                frame = final

            frame.save(str(OUT / f"{name}.png"))
            print(f"  \u2713 {name}.png ({out_w}x{out_h})")

        # Promo images (no browser frame)
        for name, html, w, h in [
            ("small-promo-440x280", SMALL_PROMO_HTML, 440, 280),
            ("marquee-1400x560", MARQUEE_HTML, 1400, 560),
        ]:
            page.set_viewport_size({"width": w, "height": h})
            page.set_content(html, wait_until="networkidle")
            page.screenshot(path=str(OUT / f"{name}.png"), type="png")
            print(f"  \u2713 {name}.png ({w}x{h})")

        browser.close()

    # Replace the tab favicon and label in all screenshots.
    # The extracted chrome from screenshot-1 has "Linear" + blue favicon.
    # We need to replace that with the correct icon + label for each screenshot.
    from PIL import ImageDraw, ImageFont
    app_icon_img = Image.open(ROOT / "src" / "icons" / "icon128.png").convert("RGBA")

    # Try to load a good font for the tab label
    font = None
    for font_path in [
        "/System/Library/Fonts/SFNS.ttf",
        "/Library/Fonts/SF-Pro-Text-Regular.otf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        try:
            font = ImageFont.truetype(font_path, 12)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()

    tab_labels = {
        "screenshot-3.png": "Clean-Autofill",
        "screenshot-4.png": "Clean-Autofill",
        "screenshot-5.png": "Sign up · GitHub",
    }

    for name, label in tab_labels.items():
        img = Image.open(OUT / name).convert("RGBA")

        # Paint over the old tab content area (favicon + "Linear" text)
        # The tab interior (white area) is roughly x=162..253, y=48..67
        draw = ImageDraw.Draw(img)
        # Fill the old favicon + label area with white (tab background)
        draw.rectangle([162, 48, 260, 67], fill=(255, 255, 255, 255))

        # Draw new favicon (app icon for 3&4, GitHub icon for 5)
        if "5" not in name:
            favicon = app_icon_img.resize((14, 14), Image.LANCZOS)
            img.paste(favicon, (164, 50), favicon)
        else:
            # Draw a dark circle for GitHub favicon
            draw.rounded_rectangle([164, 50, 178, 64], radius=3, fill=(36, 41, 47, 255))

        # Draw tab label text
        text_x = 182
        text_y = 50
        draw.text((text_x, text_y), label, fill=(68, 68, 68, 255), font=font)

        # Also replace the URL text in the address bar
        # The old "linear" text is at approximately x=225-257, y=94-104
        # The lock icon is at x=200-220. URL text starts after it.
        url_labels = {
            "screenshot-3.png": "chrome-extension://klbbkndjohc.../options.html",
            "screenshot-4.png": "chrome-extension://klbbkndjohc.../options.html",
            "screenshot-5.png": "github.com/signup",
        }
        url_text = url_labels.get(name, "")
        # Paint over old URL text area with the url bar background color (~#f1f3f4)
        draw.rectangle([225, 91, 500, 107], fill=(241, 243, 244, 255))
        # Draw new URL
        draw.text((226, 93), url_text, fill=(68, 68, 68, 255), font=font)

        img.convert("RGB").save(str(OUT / name))
    print("  \u2713 Replaced tab favicon + label + URL in all screenshots")

    # Update store icon copy
    import shutil
    shutil.copy2(ROOT / "src" / "icons" / "icon128.png", OUT / "icon-128.png")
    print("  \u2713 Updated icon-128.png")

    # Cleanup temp slices
    for f in OUT.glob("_*.png"):
        f.unlink()

    print(f"\nDone! All images saved to: {OUT}")


if __name__ == "__main__":
    main()
