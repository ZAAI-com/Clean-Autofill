#!/usr/bin/env python3
"""
Generate Chrome Web Store listing images for Clean Autofill.

The pipeline:
1. Load real screenshots from docs/store-listing/screenshots/.
2. Crop off macOS window shadow and Chrome chrome to get page content.
3. Compose those crops into polished store assets with a shared dark-background visual system.

The marquee banner still uses a deterministic mock for stability.
"""

from __future__ import annotations

import base64
import html
import io
import shutil
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.parent.parent.parent
OUT = Path(__file__).parent
SCREENSHOTS = ROOT / "docs" / "Screenshots"
SRC_ICONS = ROOT / "src" / "icons"

APP_ICON_URI = ""

# --- Dark theme card styling ---
CARD_SHADOW = "0 32px 72px rgba(0, 0, 0, 0.45), 0 12px 28px rgba(0, 0, 0, 0.30)"
CARD_BORDER = "1px solid rgba(255, 255, 255, 0.10)"
CARD_RADIUS = 20

# Chrome chrome height (from window top to page content) in the real screenshots.
# Measured from alpha-channel analysis: window starts at y=76, content at y=250.
CHROME_HEIGHT = 174  # pixels within the window (tab bar + address bar)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def data_uri(path: Path, mime: str | None = None) -> str:
    suffix = path.suffix.lower()
    if mime is None:
        if suffix == ".svg":
            mime = "image/svg+xml"
        elif suffix == ".png":
            mime = "image/png"
        else:
            mime = "application/octet-stream"
    payload = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{payload}"


def png_uri(png_bytes: bytes) -> str:
    return f"data:image/png;base64,{base64.b64encode(png_bytes).decode()}"


def load_and_crop(path: Path, target_aspect: float, crop_mode: str = "content") -> bytes:
    """Load a macOS screenshot, strip shadow, crop to target aspect ratio.

    crop_mode:
      "content"      — strip Chrome chrome, keep page content from top (default)
      "with_chrome"   — keep Chrome chrome (tab bar + address bar) in the crop
      "center_content" — strip Chrome chrome, then center-crop vertically
    """
    img = Image.open(path)

    # Find opaque window bounds (skip macOS shadow which has alpha < 255)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.getchannel("A")
    bbox = alpha.point(lambda p: 255 if p > 200 else 0).getbbox()
    if not bbox:
        raise ValueError(f"Could not find opaque region in {path}")
    win_left, win_top, win_right, win_bottom = bbox

    if crop_mode == "with_chrome":
        # Include Chrome chrome — start from window top
        content_top = win_top
    else:
        # Strip Chrome chrome — start from page content
        content_top = win_top + CHROME_HEIGHT

    content_left = win_left
    content_right = win_right
    content_bottom = win_bottom

    content_width = content_right - content_left
    content_height = content_bottom - content_top

    # Crop height to match target aspect ratio
    target_height = int(content_width / target_aspect)
    if target_height < content_height:
        if crop_mode == "center_content":
            # Center the crop vertically to capture mid-page content
            excess = content_height - target_height
            content_top += excess // 2
            content_bottom = content_top + target_height
        else:
            # Top-aligned crop
            content_bottom = content_top + target_height

    cropped = img.crop((content_left, content_top, content_right, content_bottom))

    # Convert RGBA to RGB (white background) for the data URI
    rgb = Image.new("RGB", cropped.size, (255, 255, 255))
    rgb.paste(cropped, mask=cropped.split()[3])

    buf = io.BytesIO()
    rgb.save(buf, format="PNG")
    return buf.getvalue()


def load_full_window(path: Path) -> bytes:
    """Load a macOS screenshot, strip only the shadow, keep the full window."""
    img = Image.open(path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.getchannel("A")
    bbox = alpha.point(lambda p: 255 if p > 200 else 0).getbbox()
    if not bbox:
        raise ValueError(f"Could not find opaque region in {path}")
    cropped = img.crop(bbox)
    rgb = Image.new("RGB", cropped.size, (255, 255, 255))
    rgb.paste(cropped, mask=cropped.split()[3])
    buf = io.BytesIO()
    rgb.save(buf, format="PNG")
    return buf.getvalue()


def render_markup(page, markup: str, width: int, height: int) -> bytes:
    page.set_viewport_size({"width": width, "height": height})
    page.set_content(markup, wait_until="load")
    page.wait_for_timeout(80)
    return page.screenshot(type="png")


# ---------------------------------------------------------------------------
# Marquee mock — Netflix signup (deterministic, no live capture needed)
# ---------------------------------------------------------------------------

def netflix_site_html(width: int, height: int) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * {{ box-sizing: border-box; }}
        body {{
          margin: 0;
          width: {width}px;
          height: {height}px;
          background: #141414;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 24px;
          position: relative;
        }}
        .nav {{
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 68px;
          padding: 0 42px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%);
          z-index: 2;
        }}
        .logo {{
          font-size: 32px;
          font-weight: 900;
          color: #E50914;
          letter-spacing: -0.04em;
        }}
        .sign-in {{
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          background: #E50914;
          border: none;
          border-radius: 6px;
          padding: 8px 18px;
        }}
        .hero {{
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          background:
            radial-gradient(ellipse 80% 60% at 50% 40%, rgba(20, 20, 20, 0.3), #141414),
            linear-gradient(180deg, #1a0a0a 0%, #141414 60%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 68px 42px 32px;
          text-align: center;
        }}
        h1 {{
          margin: 0 0 16px;
          font-size: 48px;
          line-height: 1.05;
          color: #ffffff;
          font-weight: 800;
          letter-spacing: -0.02em;
          max-width: 700px;
        }}
        .sub {{
          margin: 0 0 22px;
          color: #ffffffb3;
          font-size: 20px;
          font-weight: 400;
        }}
        .cta-text {{
          margin: 0 0 14px;
          color: #ffffffcc;
          font-size: 17px;
        }}
        .email-row {{
          display: flex;
          gap: 0;
          max-width: 600px;
          width: 100%;
        }}
        input {{
          flex: 1;
          border: 2px solid #4CAF50;
          background: rgba(76, 175, 80, 0.08);
          border-radius: 6px 0 0 6px;
          padding: 18px 20px;
          font-size: 16px;
          color: #4CAF50;
          font-weight: 600;
          box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.14);
        }}
        .cta-btn {{
          border: none;
          background: #E50914;
          color: #fff;
          border-radius: 0 6px 6px 0;
          padding: 18px 28px;
          font-size: 22px;
          font-weight: 600;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(229, 9, 20, 0.35);
        }}
        .arrow {{
          font-size: 24px;
        }}
      </style>
    </head>
    <body>
      <div class="nav">
        <div class="logo">NETFLIX</div>
        <div class="sign-in">Sign In</div>
      </div>
      <div class="hero">
        <h1>Unlimited movies, TV shows, and more</h1>
        <p class="sub">Starts at $7.99. Cancel anytime.</p>
        <p class="cta-text">Ready to watch? Enter your email to create or restart your membership.</p>
        <div class="email-row">
          <input value="netflix.com@yourdomain.com">
          <div class="cta-btn">Get Started <span class="arrow">&rsaquo;</span></div>
        </div>
      </div>
    </body>
    </html>
    """


# Popup mock for marquee only
POPUP_HTML_TEMPLATE = """<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-width: 380px; background: #fff; color: #333; padding: 16px;
  border-radius: 18px; overflow: hidden;
}
.header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.header img { width: 20px; height: 20px; }
.header h1 { font-size: 14px; font-weight: 600; color: #333; }
.email-row {
  display: flex; align-items: center; gap: 8px;
  background: #f5f5f5; border: 1px solid #e0e0e0;
  border-radius: 6px; padding: 8px 12px;
}
#emailDisplay { flex: 1; font-family: monospace; font-size: 13px; color: #333; word-break: break-all; }
#copyButton {
  background: #4CAF50; color: #fff; border: none; border-radius: 4px;
  padding: 6px 12px; font-size: 12px; font-weight: 500; white-space: nowrap;
}
#statusMessage { font-size: 12px; color: #2f7a35; font-weight: 500; margin-top: 8px; }
</style></head>
<body>
  <div class="header">
    <img src="__ICON__" alt=""><h1>Clean Autofill</h1>
  </div>
  <div class="email-row">
    <span id="emailDisplay">__EMAIL__</span>
    <button id="copyButton">Copy</button>
  </div>
  <div id="statusMessage">Filled into email field</div>
</body></html>"""


def render_popup(page, email_text: str, icon_uri: str) -> bytes:
    markup = POPUP_HTML_TEMPLATE.replace("__ICON__", icon_uri).replace("__EMAIL__", email_text)
    page.set_viewport_size({"width": 360, "height": 156})
    page.set_content(markup, wait_until="load")
    page.wait_for_timeout(60)
    return page.locator("body").screenshot(type="png")


# ---------------------------------------------------------------------------
# Scene composition — dark-background design system
# ---------------------------------------------------------------------------

def scene_shell(content: str, width: int, height: int, bg_from: str, bg_to: str) -> str:
    """Wrap scene content in a dark gradient background with subtle glow."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {{
      box-sizing: border-box;
    }}

    body {{
      margin: 0;
      width: {width}px;
      height: {height}px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background:
        radial-gradient(ellipse 70% 50% at 50% 60%, rgba(76, 175, 80, 0.10), transparent),
        radial-gradient(ellipse 50% 40% at 20% 30%, rgba(255, 255, 255, 0.04), transparent),
        linear-gradient(180deg, {bg_from} 0%, {bg_to} 100%);
      color: #ffffff;
    }}

    .stage {{
      position: relative;
      width: 100%;
      height: 100%;
    }}

    .headline {{
      position: absolute;
      top: 38px;
      left: 0;
      right: 0;
      text-align: center;
      z-index: 3;
    }}

    .headline h2 {{
      margin: 0 0 6px;
      font-size: 46px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.03em;
      line-height: 1.1;
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.20);
    }}

    .headline p {{
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.65);
      letter-spacing: 0.01em;
    }}

    .card-frame {{
      border-radius: {CARD_RADIUS}px;
      border: {CARD_BORDER};
      background: rgba(255, 255, 255, 0.97);
      box-shadow: {CARD_SHADOW};
      overflow: hidden;
      position: absolute;
      z-index: 2;
    }}

    .frame-image {{
      width: 100%;
      height: 100%;
      display: block;
    }}

    .browser-card {{
      display: flex;
      flex-direction: column;
    }}

    .browser-topbar {{
      height: 52px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(180deg, #fbfdff 0%, #f6f9fc 100%);
      border-bottom: 1px solid rgba(203, 214, 227, 0.8);
    }}

    .traffic {{
      display: flex;
      gap: 7px;
      flex-shrink: 0;
    }}

    .traffic span {{
      width: 11px;
      height: 11px;
      border-radius: 50%;
      display: block;
    }}

    .traffic .red {{ background: #ff5f57; }}
    .traffic .yellow {{ background: #febc2e; }}
    .traffic .green {{ background: #28c840; }}

    .address-pill {{
      height: 32px;
      flex: 1;
      border-radius: 999px;
      background: rgba(240, 245, 249, 0.96);
      border: 1px solid rgba(214, 223, 233, 0.92);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      color: #526981;
      font-size: 12px;
      font-weight: 500;
    }}

    .address-dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4CAF50;
      flex-shrink: 0;
    }}

    .browser-body {{
      position: relative;
      flex: 1;
      min-height: 0;
      background: #fff;
    }}

    .browser-body .frame-image {{
      object-fit: cover;
    }}

    .extension-card {{
      background: transparent;
    }}

    .extension-image {{
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }}
  </style>
</head>
<body>
  {content}
</body>
</html>"""


def browser_scene(
    headline: str,
    subtitle: str,
    url_text: str,
    site_image_uri: str,
    bg_from: str,
    bg_to: str,
) -> str:
    content = f"""
    <div class="stage">
      <div class="headline">
        <h2>{html.escape(headline)}</h2>
        <p>{html.escape(subtitle)}</p>
      </div>
      <div class="card-frame browser-card" style="left:52px;top:120px;right:52px;width:auto;height:680px;">
        <div class="browser-topbar">
          <div class="traffic">
            <span class="red"></span>
            <span class="yellow"></span>
            <span class="green"></span>
          </div>
          <div class="address-pill">
            <div class="address-dot"></div>
            <span>{html.escape(url_text)}</span>
          </div>
        </div>
        <div class="browser-body">
          <img class="frame-image" src="{site_image_uri}" alt="">
        </div>
      </div>
    </div>
    """
    return scene_shell(content, 1280, 800, bg_from, bg_to)


def extension_scene(
    headline: str,
    subtitle: str,
    screenshot_uri: str,
    bg_from: str,
    bg_to: str,
) -> str:
    content = f"""
    <div class="stage">
      <div class="headline">
        <h2>{html.escape(headline)}</h2>
        <p>{html.escape(subtitle)}</p>
      </div>
      <div class="card-frame extension-card" style="left:52px;top:120px;right:52px;width:auto;height:660px;border-radius:{CARD_RADIUS}px;">
        <img class="extension-image" src="{screenshot_uri}" alt="">
      </div>
    </div>
    """
    return scene_shell(content, 1280, 800, bg_from, bg_to)


def split_scene(
    headline: str,
    subtitle: str,
    bullets: list[str],
    screenshot_uri: str,
    bg_from: str,
    bg_to: str,
) -> str:
    """Text on left, full screenshot card on right."""
    bullet_html = "\n".join(f'<li>{html.escape(b)}</li>' for b in bullets)
    content = f"""
    <div class="stage" style="display:grid;grid-template-columns:1fr 740px;gap:28px;padding:48px 42px;align-items:end;">
      <div style="max-width:440px;padding-bottom:60px;">
        <h2 style="margin:0 0 10px;font-size:44px;font-weight:800;color:#fff;letter-spacing:-0.03em;line-height:1.08;text-shadow:0 2px 12px rgba(0,0,0,0.20);">{html.escape(headline)}</h2>
        <p style="margin:0 0 22px;font-size:18px;font-weight:500;color:rgba(255,255,255,0.60);">{html.escape(subtitle)}</p>
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;">
          {bullet_html}
        </ul>
      </div>
      <div style="position:relative;width:740px;height:780px;justify-self:end;align-self:end;">
        <img src="{screenshot_uri}" alt="" style="width:100%;height:100%;display:block;object-fit:contain;object-position:bottom right;">
      </div>
    </div>
    """
    # Override the .stage default positioning and add bullet styling
    shell = scene_shell(content, 1280, 800, bg_from, bg_to)
    bullet_css = """
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 17px;
      color: rgba(255, 255, 255, 0.78);
      line-height: 1.4;
    }
    li::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4CAF50;
      flex-shrink: 0;
    }
    """
    return shell.replace("</style>", f"{bullet_css}\n</style>", 1)


def small_promo_html() -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      width: 440px;
      height: 280px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background:
        radial-gradient(ellipse 60% 50% at 50% 50%, rgba(76, 175, 80, 0.12), transparent),
        linear-gradient(180deg, #1B3A2A 0%, #0F2A1C 100%);
      color: #ffffff;
    }}
    .stage {{
      position: relative;
      width: 100%;
      height: 100%;
      padding: 28px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 12px;
    }}
    .icon-tile {{
      width: 76px;
      height: 76px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .icon-tile img {{
      width: 52px;
      height: 52px;
    }}
    .brand {{
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.02em;
    }}
    .email-pill {{
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.85);
      font-size: 14px;
      font-weight: 600;
    }}
    .subtitle {{
      font-size: 13px;
      color: rgba(255, 255, 255, 0.55);
      font-weight: 500;
    }}
  </style>
</head>
<body>
  <div class="stage">
    <div class="icon-tile"><img src="{APP_ICON_URI}" alt=""></div>
    <div class="brand">Clean Autofill</div>
    <div class="email-pill">site@yourdomain.com</div>
    <div class="subtitle">One click. Unique emails.</div>
  </div>
</body>
</html>"""


def marquee_html(site_image_uri: str, popup_image_uri: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      width: 1400px;
      height: 560px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background:
        radial-gradient(ellipse 60% 50% at 65% 55%, rgba(76, 175, 80, 0.08), transparent),
        radial-gradient(ellipse 40% 40% at 20% 30%, rgba(255, 255, 255, 0.04), transparent),
        linear-gradient(180deg, #1B3A2A 0%, #0F2A1C 100%);
      color: #ffffff;
    }}
    .shell {{
      display: grid;
      grid-template-columns: 1fr 640px;
      gap: 28px;
      width: 100%;
      height: 100%;
      padding: 52px 60px;
      align-items: center;
    }}
    .copy {{
      max-width: 540px;
      position: relative;
      z-index: 2;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 20px;
    }}
    .brand-tile {{
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.10);
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.20);
    }}
    .brand-tile img {{
      width: 38px;
      height: 38px;
    }}
    .brand-name {{
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #ffffff;
    }}
    h1 {{
      margin: 0 0 16px;
      font-size: 52px;
      line-height: 1.02;
      letter-spacing: -0.04em;
      font-weight: 800;
      color: #ffffff;
    }}
    p {{
      margin: 0 0 22px;
      font-size: 20px;
      line-height: 1.45;
      color: rgba(255, 255, 255, 0.60);
      max-width: 470px;
    }}
    ul {{
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}
    li {{
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      color: rgba(255, 255, 255, 0.75);
    }}
    li::before {{
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4CAF50;
      flex-shrink: 0;
    }}
    .hero {{
      position: relative;
      width: 640px;
      height: 440px;
      border-radius: {CARD_RADIUS}px;
      border: 1px solid rgba(255, 255, 255, 0.10);
      background: rgba(255, 255, 255, 0.97);
      box-shadow: 0 36px 80px rgba(0, 0, 0, 0.40), 0 14px 32px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      justify-self: end;
      display: flex;
      flex-direction: column;
    }}
    .hero-topbar {{
      height: 48px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(180deg, #fbfdff 0%, #f6f9fc 100%);
      border-bottom: 1px solid rgba(203, 214, 227, 0.8);
    }}
    .traffic {{
      display: flex;
      gap: 7px;
    }}
    .traffic span {{
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: block;
    }}
    .traffic .red {{ background: #ff5f57; }}
    .traffic .yellow {{ background: #febc2e; }}
    .traffic .green {{ background: #28c840; }}
    .address {{
      height: 30px;
      flex: 1;
      border-radius: 999px;
      border: 1px solid rgba(214, 223, 233, 0.92);
      background: rgba(240, 245, 249, 0.96);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      color: #53687b;
      font-size: 12px;
      font-weight: 500;
    }}
    .address span:first-child {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4CAF50;
      flex-shrink: 0;
    }}
    .hero-body {{
      flex: 1;
      min-height: 0;
      position: relative;
      background: #fff;
    }}
    .hero-body img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }}
    .popup {{
      position: absolute;
      right: 14px;
      top: 70px;
      width: 280px;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(217, 226, 235, 0.88);
      box-shadow: 0 20px 44px rgba(0, 0, 0, 0.25), 0 10px 22px rgba(0, 0, 0, 0.16);
      background: #fff;
    }}
    .popup img {{
      width: 100%;
      display: block;
    }}
  </style>
</head>
<body>
  <div class="shell">
    <div class="copy">
      <div class="brand">
        <div class="brand-tile"><img src="{APP_ICON_URI}" alt=""></div>
        <div class="brand-name">Clean Autofill</div>
      </div>
      <h1>Unique email addresses in one click.</h1>
      <p>Generate the right address for each website, fill it instantly, and keep a clean record of every signup.</p>
      <ul>
        <li>Per-site addresses that stay easy to filter</li>
        <li>Provider detection for plus addressing</li>
        <li>Searchable history for every signup</li>
      </ul>
    </div>
    <div class="hero">
      <div class="hero-topbar">
        <div class="traffic">
          <span class="red"></span>
          <span class="yellow"></span>
          <span class="green"></span>
        </div>
        <div class="address"><span></span><span>https://netflix.com</span></div>
      </div>
      <div class="hero-body">
        <img src="{site_image_uri}" alt="">
      </div>
      <div class="popup"><img src="{popup_image_uri}" alt=""></div>
    </div>
  </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# Browser body aspect: (1280 - 52 - 52) / (680 - 52) = 1176 / 628
BROWSER_BODY_ASPECT = 1176 / 628

# Extension card aspect: (1280 - 52 - 52) / 660 = 1176 / 660
EXTENSION_CARD_ASPECT = 1176 / 660


def main() -> None:
    global APP_ICON_URI

    APP_ICON_URI = data_uri(SRC_ICONS / "icon128.png")

    print("Generating Chrome Web Store images...\n")

    # --- Load and crop real screenshots ---
    # Action shots (browser scenes)
    netflix_png = load_and_crop(SCREENSHOTS / "Signup-Netflix.com-Filled.png", BROWSER_BODY_ASPECT)
    ted_png = load_and_crop(SCREENSHOTS / "Signup-TED.com-Filled.png", BROWSER_BODY_ASPECT)
    ui_png = load_and_crop(SCREENSHOTS / "Signup-UI.com-Filled.png", BROWSER_BODY_ASPECT)

    # Extension pages (extension scenes)
    home_png = load_and_crop(SCREENSHOTS / "Options-1-Home.png", EXTENSION_CARD_ASPECT)
    settings_plus_png = load_and_crop(SCREENSHOTS / "Options-2a-Settings-PlusAddressing.png", EXTENSION_CARD_ASPECT)
    settings_catchall_png = load_and_crop(SCREENSHOTS / "Options-2b-Settings-CatchAll.png", EXTENSION_CARD_ASPECT)
    history_png = load_and_crop(SCREENSHOTS / "Options-3-History.png", EXTENSION_CARD_ASPECT)
    help_png = load_and_crop(SCREENSHOTS / "Options-4-Help.png", EXTENSION_CARD_ASPECT)

    # Full window screenshots for split layout (text left, screenshot right)
    settings_plus_full_png = load_full_window(SCREENSHOTS / "Options-2a-Settings-PlusAddressing.png")
    settings_catchall_full_png = load_full_window(SCREENSHOTS / "Options-2b-Settings-CatchAll.png")

    # --- Marquee assets (mock Netflix + popup, rendered with Playwright) ---
    with sync_playwright() as p:
        browser = p.chromium.launch()
        source_context = browser.new_context(device_scale_factor=2)
        scene_context = browser.new_context(device_scale_factor=2)

        source_page = source_context.new_page()
        scene_page = scene_context.new_page()

        netflix_marquee_png = render_markup(source_page, netflix_site_html(768, 470), 768, 470)
        popup_marquee_png = render_popup(source_page, "netflix.com@yourdomain.com", APP_ICON_URI)

        assets = {
            "netflix": png_uri(netflix_png),
            "ted": png_uri(ted_png),
            "ui": png_uri(ui_png),
            "home": png_uri(home_png),
            "settings_plus": png_uri(settings_plus_png),
            "settings_catchall": png_uri(settings_catchall_png),
            "history": png_uri(history_png),
            "help": png_uri(help_png),
            "settings_plus_full": png_uri(settings_plus_full_png),
            "settings_catchall_full": png_uri(settings_catchall_full_png),
            "netflix_marquee": png_uri(netflix_marquee_png),
            "popup_marquee": png_uri(popup_marquee_png),
        }

        shots = [
            # 1 — Netflix signup with popup
            (
                "screenshot-1.png",
                browser_scene(
                    headline="One Click. Auto-Filled.",
                    subtitle="A unique email address for every signup",
                    url_text="https://netflix.com",
                    site_image_uri=assets["netflix"],
                    bg_from="#1B3A2A",
                    bg_to="#0F2A1C",
                ),
                1280,
                800,
            ),
            # 2 — TED signup with popup
            (
                "screenshot-2.png",
                browser_scene(
                    headline="Instant Email Generation",
                    subtitle="Generate, fill, and copy in one click",
                    url_text="https://auth.ted.com/users/new",
                    site_image_uri=assets["ted"],
                    bg_from="#1A2D42",
                    bg_to="#132235",
                ),
                1280,
                800,
            ),
            # 3 — Ubiquiti signup with popup
            (
                "screenshot-3.png",
                browser_scene(
                    headline="Works on Every Website",
                    subtitle="Signup forms detected and filled automatically",
                    url_text="https://account.ui.com/register",
                    site_image_uri=assets["ui"],
                    bg_from="#1D2D3A",
                    bg_to="#14222D",
                ),
                1280,
                800,
            ),
            # 4 — Home page
            (
                "screenshot-4.png",
                extension_scene(
                    headline="Simple Setup. Powerful Results.",
                    subtitle="Configure once, generate emails everywhere",
                    screenshot_uri=assets["home"],
                    bg_from="#1B3A2A",
                    bg_to="#0F2A1C",
                ),
                1280,
                800,
            ),
            # 5 — Settings: Plus Addressing (split layout)
            (
                "screenshot-5.png",
                split_scene(
                    headline="Smart Provider Detection",
                    subtitle="Works with Gmail, Outlook, and 500+ providers",
                    bullets=[
                        "Auto-detects your email provider",
                        "Plus addressing for Gmail, Outlook, and more",
                        "Per-site emails like name+site@gmail.com",
                    ],
                    screenshot_uri=assets["settings_plus_full"],
                    bg_from="#2A1F3D",
                    bg_to="#1A1530",
                ),
                1280,
                800,
            ),
            # 6 — Settings: Catch-All (split layout)
            (
                "screenshot-6.png",
                split_scene(
                    headline="Catch-All Email Routing",
                    subtitle="Custom domain support with catch-all prefix mode",
                    bullets=[
                        "Use your own domain for unique addresses",
                        "Catch-all prefix like site@yourdomain.com",
                        "Step-by-step setup guides included",
                    ],
                    screenshot_uri=assets["settings_catchall_full"],
                    bg_from="#1F2D3D",
                    bg_to="#152535",
                ),
                1280,
                800,
            ),
            # 7 — History page
            (
                "screenshot-7.png",
                extension_scene(
                    headline="Every Signup. Tracked.",
                    subtitle="Search, copy, and manage your email history",
                    screenshot_uri=assets["history"],
                    bg_from="#2D2A1F",
                    bg_to="#201E15",
                ),
                1280,
                800,
            ),
            # 8 — Help / Catch-All setup guide
            (
                "screenshot-8.png",
                extension_scene(
                    headline="Step-by-Step Setup Guides",
                    subtitle="Catch-all instructions for every major provider",
                    screenshot_uri=assets["help"],
                    bg_from="#1A3540",
                    bg_to="#122830",
                ),
                1280,
                800,
            ),
            # Small promo tile
            ("small-promo-440x280.png", small_promo_html(), 440, 280),
            # Marquee banner
            ("marquee-1400x560.png", marquee_html(assets["netflix_marquee"], assets["popup_marquee"]), 1400, 560),
        ]

        for filename, markup, width, height in shots:
            scene_page.set_viewport_size({"width": width, "height": height})
            scene_page.set_content(markup, wait_until="load")
            scene_page.wait_for_timeout(80)
            raw = scene_page.screenshot(type="png")
            img = Image.open(io.BytesIO(raw))
            img = img.resize((width, height), Image.LANCZOS)
            img.save(str(OUT / filename), "PNG")
            print(f"  ✓ {filename} ({width}x{height})")

        source_context.close()
        scene_context.close()
        browser.close()

    shutil.copy2(SRC_ICONS / "icon128.png", OUT / "icon-128.png")
    print("  ✓ icon-128.png")
    print(f"\nDone. Assets written to {OUT}")


if __name__ == "__main__":
    main()
