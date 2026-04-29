# Copy Content

Chrome/Edge extension: copy page content as plain text or Markdown.

## Store listing (description)

**Single purpose (EN):** Extract the main article/content of the current page and copy it to the clipboard as plain text or Markdown.

**Permission justifications (EN):**
- **activeTab:** Needed to access the currently open tab when the user clicks the extension icon, so we can read the page DOM and extract its main content.
- **scripting:** Used to inject a content extraction script into the active tab; the script runs in the page context to get the main text/Markdown from the DOM.
- **clipboardWrite:** Used to write the extracted plain text or Markdown to the user's clipboard when they click "Copy as text" or "Copy as Markdown."

**Short (EN):** Copy the main page content in one click — no menus, ads, or footers. Output: plain text or Markdown (headings, links, lists, tables, code).

**Detailed (EN):** The extension finds the main text block (main, article, content) and extracts only that, skipping navigation, sidebars, and banners. Two buttons: "Copy as text" — clean text for pasting anywhere; "Copy as Markdown" — formatted output with headings (# ## ###), bold and italic, links [text](url), lists, tables, and code blocks. Handy for notes, reposts, and exporting to editors or docs. No data is sent anywhere; everything runs in the tab on click.

---

**Кратко (RU):** Копирует основной контент страницы одним кликом — без меню, рекламы и подвала. Форматы: обычный текст или Markdown (заголовки, ссылки, списки, таблицы, код).

**Подробно (RU):** Расширение находит блок с текстом статьи (main, article, content) и извлекает только его, отбрасывая навигацию, сайдбары и баннеры. Две кнопки: «Copy as text» — чистый текст для вставки куда угодно; «Copy as Markdown» — разметка с заголовками (# ## ###), жирным и курсивом, ссылками [текст](url), списками, таблицами и блоками кода. Удобно для заметок, перепостов и экспорта в редакторы/документы. Данные не отправляются никуда, работа только во вкладке по клику.

---

## Publishing

**Chrome:** [Developer Dashboard](https://chrome.google.com/webstore/devconsole) — one-time $5, pack folder to ZIP, upload. Store listing needs description, 128px icon, optional 440×280 promo image.

**Firefox:** [addons.mozilla.org](https://addons.mozilla.org) — same code, upload ZIP or folder.

## Development

After cloning, enable the auto-version-bump hook:

```bash
git config core.hooksPath .githooks
```

On every commit, the patch segment of `manifest.json` `version` is incremented (e.g. `1.2` → `1.2.1` → `1.2.2`). To set a major/minor manually, edit `manifest.json` and stage it — the hook detects manual version changes and skips the bump.
