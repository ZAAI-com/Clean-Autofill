#!/usr/bin/env python3
"""
Generate Chrome Web Store listing images for Clean Autofill.

The pipeline has two layers:
1. Render real extension UI from the source templates in src/ui/.
2. Compose those renders into polished store assets with a shared visual system.

The browser scenes use deterministic, site-inspired signup mocks so the final
store assets stay clean and stable over time.
"""

from __future__ import annotations

import base64
import html
import io
import re
import shutil
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.parent.parent.parent
OUT = Path(__file__).parent
SRC_UI = ROOT / "src" / "ui"
SRC_ICONS = ROOT / "src" / "icons"

OPTIONS_HTML = (SRC_UI / "options.html").read_text()
OPTIONS_CSS = (SRC_UI / "options.css").read_text()
POPUP_HTML = (SRC_UI / "popup.html").read_text()

APP_ICON_URI = ""
GMAIL_ICON_URI = ""

SCRIPT_TAG_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)

# --- Dark theme card styling ---
CARD_SHADOW = "0 32px 72px rgba(0, 0, 0, 0.45), 0 12px 28px rgba(0, 0, 0, 0.30)"
CARD_BORDER = "1px solid rgba(255, 255, 255, 0.10)"
CARD_RADIUS = 20

OPTIONS_BASE_OVERRIDES = """
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.sidebar-header .icon {
  background: url('__APP_ICON__') center / contain no-repeat !important;
  background-color: transparent !important;
  border-radius: 7px !important;
}

.messages-area {
  display: none !important;
}

#saveStateIndicator {
  display: none !important;
}

.history-table tr.is-spotlight td {
  background: #f4fbf5;
}

.history-table tr.is-spotlight:hover td {
  background: #eef8ef;
}
""".replace("__APP_ICON__", "__APP_ICON__")

POPUP_BASE_OVERRIDES = """
body {
  min-width: 380px;
  border-radius: 18px;
  overflow: hidden;
}

#statusMessage {
  color: #2f7a35;
  font-weight: 500;
}
"""

SETTINGS_SHOT_CSS = """
body {
  background: #f4f7fa;
  display: block;
  min-height: auto;
}

.sidebar {
  display: none;
}

.content {
  margin-left: 0;
  width: 100%;
  max-width: none;
  padding: 24px 28px 20px;
}

.page-subtitle {
  display: none;
}

.settings-section {
  margin-bottom: 12px;
}

.help-text {
  display: none;
}

.mode-table {
  gap: 12px;
}

#settingsForm {
  display: grid;
  grid-template-columns: 0.92fr 1.08fr;
  gap: 14px 18px;
  align-items: start;
}

#settingsForm > .settings-section:nth-of-type(1) {
  grid-column: 1;
  grid-row: 1;
}

#settingsForm > .settings-section:nth-of-type(2) {
  grid-column: 2;
  grid-row: 1 / span 2;
}

#settingsForm > .settings-section:nth-of-type(3) {
  grid-column: 1;
  grid-row: 2;
}

.page-title {
  font-size: 26px;
  margin-bottom: 4px;
}

.settings-section h2 {
  font-size: 18px;
  margin-bottom: 8px;
}

.example-row {
  padding-top: 9px;
  padding-bottom: 9px;
}

.examples-list .example-row:nth-of-type(n + 3) {
  display: none;
}

.form-group {
  margin-bottom: 6px;
}

.page-header {
  margin-bottom: 12px;
}

.detection-box {
  margin-bottom: 8px;
  padding: 6px 10px;
}

input[type="text"] {
  padding: 9px 12px;
}

.mode-header {
  font-size: 15px;
  padding: 10px;
}

.mode-row {
  padding: 6px 10px;
}

.row-label {
  font-size: 10px;
  margin-bottom: 2px;
}

.row-value code {
  font-size: 11px;
}

.req-checks {
  gap: 2px;
}

.req-label,
.req-value {
  font-size: 11px;
}

#colCatchAll {
  display: none;
}

.mode-column {
  opacity: 1;
}
"""

HISTORY_SHOT_CSS = """
body {
  background: #f4f7fa;
  display: block;
  min-height: auto;
}

.sidebar {
  display: none;
}

.content {
  margin-left: 0;
  width: 100%;
  max-width: none;
  padding: 24px 28px;
}

.page-subtitle {
  font-size: 14px;
  margin-bottom: 14px;
}

.history-table td,
.history-table th {
  padding-top: 13px;
  padding-bottom: 13px;
}

.page-title {
  font-size: 26px;
  margin-bottom: 4px;
}

.history-controls {
  margin-bottom: 18px;
}

.history-table td.col-email {
  color: #357c3c;
}

#historySearch {
  font-size: 15px;
}
"""

HOME_SHOT_CSS = """
body {
  background: #f4f7fa;
  display: block;
  min-height: auto;
}

.sidebar {
  display: none;
}

.content {
  margin-left: 0;
  width: 100%;
  max-width: none;
  padding: 24px 28px;
}

.page-subtitle {
  font-size: 14px;
  margin-bottom: 12px;
}

.how-it-works {
  gap: 14px;
  margin-bottom: 18px;
}

.settings-section {
  margin-bottom: 0;
}

.examples-list {
  background: rgba(255, 255, 255, 0.82);
}

.page-title {
  font-size: 26px;
  margin-bottom: 4px;
}

#page-home {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 14px 26px;
  align-items: start;
}

#page-home .page-title,
#page-home .page-subtitle {
  grid-column: 1 / -1;
}

#page-home > h2 {
  grid-column: 1;
  margin-bottom: 0 !important;
}

#page-home .how-it-works {
  grid-column: 1;
  margin-bottom: 0;
}

#page-home .settings-section {
  grid-column: 2;
  grid-row: 3 / span 2;
  align-self: stretch;
}

#page-home .settings-section h2 {
  margin-bottom: 14px;
}

.step {
  gap: 12px;
}

.step-number {
  width: 30px;
  height: 30px;
  font-size: 14px;
}

.step-text strong {
  font-size: 15px;
}

.step-text span {
  font-size: 13px;
}

.settings-section h2 {
  font-size: 18px;
  margin-bottom: 10px;
}

.example-row {
  padding-top: 10px;
  padding-bottom: 10px;
}

.example-site {
  font-size: 15px;
}

.example-email {
  font-size: 13px;
}

.examples-list .example-row:nth-of-type(n + 5) {
  display: none;
}
"""


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


def strip_scripts(markup: str) -> str:
    return SCRIPT_TAG_RE.sub("", markup)


def inline_options_html(extra_css: str = "") -> str:
    style = OPTIONS_CSS + "\n" + OPTIONS_BASE_OVERRIDES.replace("__APP_ICON__", APP_ICON_URI) + "\n" + extra_css
    html_doc = strip_scripts(OPTIONS_HTML)
    return html_doc.replace(
        '<link rel="stylesheet" href="options.css">',
        f"<style>{style}</style>",
    )


def inline_popup_html(extra_css: str = "") -> str:
    html_doc = strip_scripts(POPUP_HTML).replace("../icons/icon32.png", APP_ICON_URI)
    return html_doc.replace("</style>", f"\n{POPUP_BASE_OVERRIDES}\n{extra_css}\n</style>", 1)


def render_markup(page, markup: str, width: int, height: int) -> bytes:
    page.set_viewport_size({"width": width, "height": height})
    page.set_content(markup, wait_until="load")
    page.wait_for_timeout(80)
    return page.screenshot(type="png")


def capture_live_signup(page, url: str, email_text: str, script: str, clip: dict[str, int]) -> bytes:
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(url, wait_until="domcontentloaded", timeout=20000)
    page.wait_for_timeout(2800)
    page.evaluate(script, {"email": email_text})
    page.wait_for_timeout(160)
    return page.screenshot(type="png", clip=clip)


def render_options_capture(page, page_id: str, width: int, height: int) -> bytes:
    extra_css = {
        "settings": SETTINGS_SHOT_CSS,
        "history": HISTORY_SHOT_CSS,
        "home": HOME_SHOT_CSS,
    }[page_id]

    page.set_viewport_size({"width": width, "height": height})
    page.set_content(inline_options_html(extra_css), wait_until="load")
    page.wait_for_timeout(80)

    if page_id == "settings":
        populate_settings(page)
    elif page_id == "history":
        populate_history(page)
    elif page_id == "home":
        populate_home(page)

    page.wait_for_timeout(80)
    return page.screenshot(type="png")


def populate_settings(page) -> None:
    data = {
        "baseEmail": "name@gmail.com",
        "providerName": "Gmail",
        "providerLogo": GMAIL_ICON_URI,
        "plusFormat": "name+site@gmail.com",
        "catchAllFormat": "site@yourdomain.com",
        "examples": [
            {"site": "amazon.com", "email": "name+amazon.com@gmail.com"},
            {"site": "wikipedia.org", "email": "name+wikipedia.org@gmail.com"},
        ],
    }
    page.evaluate(
        """
        (data) => {
          const pageId = 'settings';
          document.querySelectorAll('.nav-item[data-page]').forEach((nav) => {
            nav.classList.toggle('active', nav.dataset.page === pageId);
          });
          document.querySelectorAll('.page').forEach((section) => {
            section.classList.toggle('active', section.id === `page-${pageId}`);
          });

          const setText = (selector, value) => {
            const node = document.querySelector(selector);
            if (node) node.textContent = value;
          };

          const input = document.getElementById('emailInput');
          if (input) {
            input.value = data.baseEmail;
            input.style.borderColor = '#4CAF50';
            input.style.boxShadow = '0 0 0 4px rgba(76, 175, 80, 0.12)';
          }

          const chromeProfile = document.getElementById('detectionChromeProfile');
          const detectionProvider = document.getElementById('detectionProvider');
          chromeProfile?.classList.add('detected');
          detectionProvider?.classList.add('detected');

          setText('#chromeProfileEmail', data.baseEmail);
          setText('#providerText', data.providerName);
          setText('#plusFormat', data.plusFormat);
          setText('#catchAllFormat', data.catchAllFormat);
          setText('#plusProviderValue', data.providerName);
          setText('#plusSupportValue', 'Supported');
          setText('#catchAllDomainValue', 'Setup needed');
          setText('#catchAllEnabledValue', '--');

          const providerLogo = document.getElementById('providerLogo');
          const providerDetected = document.getElementById('providerDetected');
          const providerPlaceholder = document.getElementById('providerPlaceholder');
          if (providerLogo) {
            providerLogo.style.display = 'inline-flex';
            providerLogo.innerHTML = `<img src="${data.providerLogo}" width="18" height="18" alt="">`;
          }
          if (providerDetected) providerDetected.style.display = 'flex';
          if (providerPlaceholder) providerPlaceholder.style.display = 'none';

          const supported = (selector) => {
            const node = document.querySelector(selector);
            if (node) node.className = 'req-indicator req-supported';
          };
          const possible = (selector) => {
            const node = document.querySelector(selector);
            if (node) node.className = 'req-indicator req-possible';
          };
          supported('#plusProviderIndicator');
          supported('#plusSupportIndicator');
          possible('#catchAllDomainIndicator');

          const catchAllIndicator = document.getElementById('catchAllEnabledIndicator');
          if (catchAllIndicator) catchAllIndicator.className = 'req-indicator';

          const plusColumn = document.getElementById('colPlusAddressing');
          const catchAllColumn = document.getElementById('colCatchAll');
          plusColumn?.classList.add('selected');
          catchAllColumn?.classList.remove('selected');

          const plusRadio = document.getElementById('modePlusAddressing');
          const catchAllRadio = document.getElementById('modeCatchAll');
          if (plusRadio) plusRadio.checked = true;
          if (catchAllRadio) catchAllRadio.checked = false;

          const rows = [...document.querySelectorAll('#page-settings .examples-list .example-row')];
          rows.forEach((row, index) => {
            const item = data.examples[index];
            if (!item) {
              row.remove();
              return;
            }
            const site = row.querySelector('.example-site');
            const email = row.querySelector('.example-email');
            if (site) site.textContent = item.site;
            if (email) email.textContent = item.email;
          });
        }
        """,
        data,
    )


def populate_history(page) -> None:
    rows = [
        {"domain": "github.com", "email": "github.com@yourdomain.com", "date": "Apr 8, 10:23", "spotlight": True},
        {"domain": "netflix.com", "email": "netflix.com@yourdomain.com", "date": "Apr 7, 15:45", "spotlight": False},
        {"domain": "wikipedia.org", "email": "wikipedia.org@yourdomain.com", "date": "Apr 7, 11:02", "spotlight": False},
        {"domain": "stripe.com", "email": "stripe.com@yourdomain.com", "date": "Apr 6, 09:18", "spotlight": False},
        {"domain": "claude.ai", "email": "claude.ai@yourdomain.com", "date": "Apr 5, 16:12", "spotlight": False},
    ]
    page.evaluate(
        """
        (rows) => {
          const pageId = 'history';
          document.querySelectorAll('.nav-item[data-page]').forEach((nav) => {
            nav.classList.toggle('active', nav.dataset.page === pageId);
          });
          document.querySelectorAll('.page').forEach((section) => {
            section.classList.toggle('active', section.id === `page-${pageId}`);
          });

          const body = document.getElementById('historyBody');
          if (!body) return;

          body.innerHTML = rows.map((row) => `
            <tr class="${row.spotlight ? 'is-spotlight' : ''}">
              <td class="col-domain">${row.domain}</td>
              <td class="col-email">${row.email}</td>
              <td class="col-date">${row.date}</td>
              <td class="col-actions">
                <button>Copy</button>
              </td>
            </tr>
          `).join('');

          const search = document.getElementById('historySearch');
          if (search) search.value = '';
        }
        """,
        rows,
    )


def populate_home(page) -> None:
    examples = [
        {"site": "netflix.com", "email": "netflix.com@yourdomain.com"},
        {"site": "amazon.com", "email": "amazon.com@yourdomain.com"},
        {"site": "github.com", "email": "github.com@yourdomain.com"},
        {"site": "wikipedia.org", "email": "wikipedia.org@yourdomain.com"},
    ]
    page.evaluate(
        """
        (examples) => {
          const pageId = 'home';
          document.querySelectorAll('.nav-item[data-page]').forEach((nav) => {
            nav.classList.toggle('active', nav.dataset.page === pageId);
          });
          document.querySelectorAll('.page').forEach((section) => {
            section.classList.toggle('active', section.id === `page-${pageId}`);
          });

          const rows = [...document.querySelectorAll('#page-home .examples-list .example-row')];
          rows.forEach((row, index) => {
            const item = examples[index];
            if (!item) {
              row.remove();
              return;
            }
            const site = row.querySelector('.example-site');
            const email = row.querySelector('.example-email');
            if (site) site.textContent = item.site;
            if (email) email.textContent = item.email;
          });
        }
        """,
        examples,
    )


def render_popup_capture(page, email_text: str, status_text: str) -> bytes:
    page.set_viewport_size({"width": 360, "height": 156})
    page.set_content(inline_popup_html(), wait_until="load")
    page.evaluate(
        """
        (data) => {
          const loading = document.getElementById('loading');
          const result = document.getElementById('result');
          const emailDisplay = document.getElementById('emailDisplay');
          const status = document.getElementById('statusMessage');
          if (loading) loading.style.display = 'none';
          if (result) result.style.display = 'block';
          if (emailDisplay) emailDisplay.textContent = data.email;
          if (status) status.textContent = data.status;
        }
        """,
        {"email": email_text, "status": status_text},
    )
    page.wait_for_timeout(60)
    return page.locator("body").screenshot(type="png")


NETFLIX_SIGNUP_SCRIPT = """
(data) => {
  document.querySelectorAll(
    '[data-testid*=cookie], [id*=cookie], [class*=cookie], [class*=intercom], [class*=chat], iframe'
  ).forEach((node) => node.remove());

  const input = document.querySelector('input[type="email"]');
  if (input) {
    input.value = data.email;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.style.borderColor = '#4CAF50';
    input.style.boxShadow = '0 0 0 4px rgba(76, 175, 80, 0.16)';
    input.style.background = 'rgba(76, 175, 80, 0.08)';
  }
}
"""


WIKIPEDIA_SIGNUP_SCRIPT = """
(data) => {
  document.querySelectorAll('[id*=cookie], [class*=cookie], [aria-label*=cookie], iframe').forEach((node) => node.remove());

  const input = document.querySelector('#wpEmail') || document.querySelector('input[name="wpEmail"]') || document.querySelector('input[type="email"]');
  if (input) {
    input.value = data.email;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.style.borderColor = '#4CAF50';
    input.style.boxShadow = '0 0 0 4px rgba(76, 175, 80, 0.16)';
    input.style.background = '#f4fbf5';
  }
}
"""


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


def wikipedia_site_html(width: int, height: int) -> str:
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
          background: #f8f9fa;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 22px;
        }}
        .header {{
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 56px;
          padding: 0 28px;
          display: flex;
          align-items: center;
          gap: 14px;
          border-bottom: 1px solid #e0e0e0;
          background: #fff;
        }}
        .wiki-logo {{
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 700;
          color: #333;
          font-family: 'Linux Libertine', 'Georgia', serif;
        }}
        .wiki-wordmark {{
          font-size: 18px;
          font-weight: 700;
          color: #202122;
          font-family: 'Linux Libertine', 'Georgia', serif;
          letter-spacing: -0.02em;
        }}
        .card {{
          margin-top: 56px;
          padding: 32px 42px;
          width: 520px;
          background: #fff;
          border: 1px solid #c8ccd1;
          border-radius: 2px;
        }}
        h1 {{
          margin: 0 0 6px;
          font-size: 28px;
          line-height: 1.2;
          color: #202122;
          font-weight: 400;
          font-family: 'Linux Libertine', 'Georgia', serif;
        }}
        .subtitle {{
          margin: 0 0 22px;
          font-size: 13px;
          color: #72777d;
        }}
        .subtitle a {{
          color: #3366cc;
          text-decoration: none;
        }}
        .form-group {{
          margin-bottom: 16px;
        }}
        label {{
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #202122;
          margin-bottom: 6px;
        }}
        .label-optional {{
          font-weight: 400;
          color: #72777d;
        }}
        input {{
          width: 100%;
          border: 1px solid #a2a9b1;
          background: #fff;
          border-radius: 2px;
          padding: 10px 12px;
          font-size: 14px;
          color: #202122;
        }}
        input.filled {{
          border: 2px solid #4CAF50;
          background: #f4fbf5;
          color: #2a6a31;
          font-weight: 600;
          box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.14);
        }}
        .password-note {{
          font-size: 12px;
          color: #72777d;
          margin-top: 4px;
        }}
        button {{
          background: #3366cc;
          color: #fff;
          border: none;
          border-radius: 2px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
          margin-top: 8px;
          cursor: pointer;
        }}
        .captcha-note {{
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #eaecf0;
          font-size: 12px;
          color: #72777d;
        }}
      </style>
    </head>
    <body>
      <div class="header">
        <div class="wiki-logo">W</div>
        <div class="wiki-wordmark">Wikipedia</div>
      </div>
      <div class="card">
        <h1>Create account</h1>
        <p class="subtitle">Already have an account? <a href="#">Log in</a></p>
        <div class="form-group">
          <label>Username</label>
          <input value="">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" value="">
          <div class="password-note">Must be at least 8 characters</div>
        </div>
        <div class="form-group">
          <label>Confirm password</label>
          <input type="password" value="">
        </div>
        <div class="form-group">
          <label>Email address <span class="label-optional">(recommended)</span></label>
          <input class="filled" value="wikipedia.org@yourdomain.com">
        </div>
        <button>Create your account</button>
        <div class="captcha-note">To protect the wiki against automated account creation, please solve the CAPTCHA below.</div>
      </div>
    </body>
    </html>
    """


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
      font-size: 40px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.03em;
      line-height: 1.1;
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.20);
    }}

    .headline p {{
      margin: 0;
      font-size: 17px;
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

    .popup-float {{
      position: absolute;
      right: 18px;
      top: 80px;
      width: 340px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 24px 56px rgba(0, 0, 0, 0.28), 0 10px 24px rgba(0, 0, 0, 0.18);
      border: 1px solid rgba(217, 226, 235, 0.88);
      background: #fff;
    }}

    .extension-card {{
      background: #f4f7fa;
    }}

    .extension-image {{
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
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
    popup_image_uri: str | None = None,
) -> str:
    popup_markup = ""
    if popup_image_uri:
        popup_markup = f"""
        <div class="popup-float">
          <img class="frame-image" src="{popup_image_uri}" alt="">
        </div>
        """
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
        {popup_markup}
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
        <div class="address"><span></span><span>netflix.com</span></div>
      </div>
      <div class="hero-body">
        <img src="{site_image_uri}" alt="">
      </div>
      <div class="popup"><img src="{popup_image_uri}" alt=""></div>
    </div>
  </div>
</body>
</html>"""


def main() -> None:
    global APP_ICON_URI, GMAIL_ICON_URI

    APP_ICON_URI = data_uri(SRC_ICONS / "icon128.png")
    GMAIL_ICON_URI = data_uri(SRC_ICONS / "providers" / "gmail.png")

    print("Generating refreshed Chrome Web Store images...\n")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        source_context = browser.new_context(device_scale_factor=2)
        scene_context = browser.new_context(device_scale_factor=2)

        options_page = source_context.new_page()
        popup_page = source_context.new_page()
        site_page = source_context.new_page()
        scene_page = scene_context.new_page()

        popup_png = render_popup_capture(popup_page, "wikipedia.org@yourdomain.com", "Filled into email field")
        settings_png = render_options_capture(options_page, "settings", 1176, 660)
        history_png = render_options_capture(options_page, "history", 1176, 660)
        home_png = render_options_capture(options_page, "home", 1176, 660)

        # Deterministic local mocks keep the store assets clean and stable.
        # Live captures are available as fallback but the mocks are preferred
        # because real pages have cookie banners and layout clutter.
        netflix_png = render_markup(site_page, netflix_site_html(1176, 628), 1176, 628)
        netflix_marquee_png = render_markup(site_page, netflix_site_html(640, 392), 640, 392)
        wikipedia_png = render_markup(site_page, wikipedia_site_html(1176, 628), 1176, 628)

        assets = {
            "popup": png_uri(popup_png),
            "settings": png_uri(settings_png),
            "history": png_uri(history_png),
            "home": png_uri(home_png),
            "netflix": png_uri(netflix_png),
            "netflix_marquee": png_uri(netflix_marquee_png),
            "wikipedia": png_uri(wikipedia_png),
        }

        shots = [
            # 1 — Netflix signup with highlighted email field
            (
                "screenshot-1.png",
                browser_scene(
                    headline="One Click. Auto-Filled.",
                    subtitle="A unique email address for every signup",
                    url_text="netflix.com",
                    site_image_uri=assets["netflix"],
                    bg_from="#1B3A2A",
                    bg_to="#0F2A1C",
                ),
                1280,
                800,
            ),
            # 2 — Wikipedia signup with popup overlay
            (
                "screenshot-2.png",
                browser_scene(
                    headline="Instant Email Generation",
                    subtitle="Generate, fill, and copy in one click",
                    url_text="wikipedia.org/createaccount",
                    site_image_uri=assets["wikipedia"],
                    bg_from="#1A2D42",
                    bg_to="#132235",
                    popup_image_uri=assets["popup"],
                ),
                1280,
                800,
            ),
            # 3 — Settings: provider detection
            (
                "screenshot-3.png",
                extension_scene(
                    headline="Smart Provider Detection",
                    subtitle="Works with Gmail, Outlook, and 500+ providers",
                    screenshot_uri=assets["settings"],
                    bg_from="#1A3540",
                    bg_to="#122830",
                ),
                1280,
                800,
            ),
            # 4 — History page
            (
                "screenshot-4.png",
                extension_scene(
                    headline="Every Signup. Tracked.",
                    subtitle="Search, copy, and manage your email history",
                    screenshot_uri=assets["history"],
                    bg_from="#243442",
                    bg_to="#1A2830",
                ),
                1280,
                800,
            ),
            # 5 — Home / examples page
            (
                "screenshot-5.png",
                extension_scene(
                    headline="Simple Setup. Powerful Results.",
                    subtitle="Configure once, generate emails everywhere",
                    screenshot_uri=assets["home"],
                    bg_from="#1D3D2D",
                    bg_to="#142A1E",
                ),
                1280,
                800,
            ),
            # Small promo tile
            ("small-promo-440x280.png", small_promo_html(), 440, 280),
            # Marquee banner
            ("marquee-1400x560.png", marquee_html(assets["netflix_marquee"], assets["popup"]), 1400, 560),
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
