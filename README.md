<div align="center">

<img src="icons/icon128.png" alt="Copy Content" width="96" height="96" />

# Copy Content

**Copy the main content of any web page as plain text or Markdown — in one click, fully offline.**

[![Version](https://img.shields.io/badge/version-1.2.8-blue.svg)](manifest.json)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/pakjdpbidgcahcchgnggfmjegbfnemoj)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox-Add--ons-FF7139?logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/copy-content/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange.svg)](manifest.json)

</div>

---

## ✨ Why Copy Content

Copying an article from a modern page usually drags along navigation, sidebars, ads, cookie banners and other clutter. **Copy Content** finds the actual article block, strips the noise, and gives you exactly what you wanted — as clean text or formatted Markdown — without ever sending the page anywhere.

<div align="center">

<!-- Replace these with real screenshots/GIFs once captured. -->
<img src="docs/popup.png" alt="Popup with four actions: Copy Text, Copy Markdown, Pick Text, Pick Markdown" width="360" />

<sub><i>Popup with four actions. Right-click context menu offers the same.</i></sub>

</div>

## 🚀 Features

- **Four actions** — `Copy Text`, `Copy Markdown`, `Pick Text`, `Pick Markdown`. The first two grab the whole article; the picker variants let you click any element on the page and copy just that part.
- **Right-click context menu** — every action is also available on `page`, `selection` and `frame` contexts, no popup needed.
- **Smart content extraction** — looks for `main`, `article`, `[role="main"]`, common content IDs/classes (`#content`, `.entry-content`, `.post`, …) and only falls back to `<body>` when nothing matches. Removes `nav`, `header`, `footer`, `aside`, ads, cookie banners and `aria-hidden` nodes before extracting.
- **Real Markdown** — preserves headings (`#`/`##`/`###`), bold, italic, links, ordered/unordered lists, tables and fenced code blocks.
- **Works inside iframes** — runs in all frames and picks the longest non-empty result, so embedded readers and frame-based article hosts still work.
- **Multilingual UI** — English, Spanish, Hindi, Russian (auto-detected from browser locale).
- **100% offline** — no network requests, no analytics, no telemetry. The only permissions used are `activeTab`, `scripting`, `clipboardWrite` and `contextMenus`.
- **Chrome + Firefox** — single codebase, MV3 service worker on Chrome and MV3 background scripts on Firefox.

## 📦 Install

### From the stores

| Browser | Link |
|---------|------|
| Chrome / Edge / Brave / Opera | [Chrome Web Store](https://chromewebstore.google.com/detail/pakjdpbidgcahcchgnggfmjegbfnemoj) |
| Firefox | [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/copy-content/) |

### Load unpacked (development)

```bash
git clone <this-repo> copy-content
cd copy-content
git config core.hooksPath .githooks   # enables the version-bump hook (optional)
```

**Chrome / Edge / Brave**

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and pick the project folder.

**Firefox**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `manifest.json`.

> Firefox unloads temporary add-ons on restart. For a persistent install, run `node build.mjs` and load `copy-content-firefox.zip` via `about:addons` → ⚙ → **Install Add-on From File…**.

## 🎯 Usage

Click the toolbar icon to open the popup, or right-click anywhere on a page to get the same four actions from the context menu:

| Action | What it does |
|--------|--------------|
| **Copy Text** | Extracts the main article and copies it as plain text. |
| **Copy Markdown** | Same article, but with headings, links, lists, tables and code preserved. |
| **Pick Text** | Highlights elements as you hover; click to copy that element as plain text. |
| **Pick Markdown** | Picker mode, but copies the chosen element as Markdown. |

A small toast confirms the result and shows the character count (e.g. `Markdown copied · 5.4k chars`).

## 🔒 Privacy

The extension does **not** make network requests, does **not** load remote scripts, does **not** track usage and does **not** read pages in the background. Extraction runs in the active tab on click and writes the result to the clipboard — that is the entire data flow.

| Permission | Why |
|------------|-----|
| `activeTab` | Read the DOM of the currently active tab when the user triggers an action. |
| `scripting` | Inject the extractor into the page so it can run in the page context. |
| `clipboardWrite` | Write the extracted text/Markdown to the clipboard. |
| `contextMenus` | Add the four actions to the right-click menu. |

## 🛠 Development

```
copy-content/
├── manifest.json        # MV3 manifest (Chrome-flavoured; build.mjs rewrites for Firefox)
├── background.js        # Service worker / background script — context menus, picker
├── popup.html / popup.js # Toolbar popup with the four buttons
├── extractors.js        # Page-context functions: extractPageContent, pickElementContent
├── _locales/{en,es,hi,ru}/messages.json
├── icons/               # 16/48/128 px PNGs
├── .githooks/pre-commit # Auto-bumps manifest patch version
└── build.mjs            # Packs dist-chrome/ + dist-firefox/ ZIPs
```

**Build store-ready ZIPs**

```bash
node build.mjs
# → copy-content-chrome.zip
# → copy-content-firefox.zip
```

The build script keeps a single `manifest.json` for Chrome (MV3 service worker) and rewrites `background` to `scripts: [...]` for Firefox, since Firefox MV3 disables service workers by default.

**Auto version-bump hook**

After `git config core.hooksPath .githooks`, every commit increments the patch segment of `manifest.json` `version` (e.g. `1.2.8` → `1.2.9`). To set a major/minor manually, edit `manifest.json` and stage it — the hook detects manual version changes and skips the bump.

## 🌍 Localization

Locale files live in `_locales/<code>/messages.json`. Currently shipped:

- English (`en`)
- Spanish (`es`)
- Hindi (`hi`)
- Russian (`ru`)

To add a new locale, copy `_locales/en/` to `_locales/<code>/` and translate the `message` fields.

## 📄 License

Released under the [Apache License 2.0](LICENSE) © Timur Bondarenko.
