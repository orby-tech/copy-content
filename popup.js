// extractPageContent, pickElementContent and prependTitleUrl are defined in
// extractors.js (loaded before this script via popup.html). The first two run
// inside the page context when injected via chrome.scripting.executeScript;
// prependTitleUrl runs in the popup context only.

const SETTINGS_KEY = 'includeTitleUrl';

async function loadIncludeTitleUrl() {
  try {
    const data = await chrome.storage.sync.get(SETTINGS_KEY);
    return Boolean(data[SETTINGS_KEY]);
  } catch {
    return false;
  }
}

async function saveIncludeTitleUrl(value) {
  try {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: Boolean(value) });
  } catch { }
}

// ── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(md) {
  const INLINE_PATTERNS = [
    { re: /`([^`\n]+)`/, tag: 'code' },
    { re: /\*\*([^*\n]+)\*\*/, tag: 'strong' },
    { re: /__([^_\n]+)__/, tag: 'strong' },
    { re: /\*([^*\n]+)\*/, tag: 'em' },
    { re: /_([^_\n]+)_/, tag: 'em' },
    { re: /~~([^~\n]+)~~/, tag: 'del' },
    { re: /!\[([^\]]*)\]\((https?:[^)]+)\)/, kind: 'img' },
    { re: /\[([^\]]+)\]\((https?:[^)]+)\)/, kind: 'link' },
  ];

  function appendInline(parent, s) {
    while (s.length > 0) {
      let earliest = null;
      for (const p of INLINE_PATTERNS) {
        const m = p.re.exec(s);
        if (m && (earliest === null || m.index < earliest.match.index)) {
          earliest = { match: m, pattern: p };
        }
      }
      if (!earliest) {
        parent.appendChild(document.createTextNode(s));
        return;
      }
      const { match, pattern } = earliest;
      if (match.index > 0) parent.appendChild(document.createTextNode(s.slice(0, match.index)));

      if (pattern.kind === 'img') {
        const img = document.createElement('img');
        img.src = match[2];
        img.alt = match[1];
        parent.appendChild(img);
      } else if (pattern.kind === 'link') {
        const a = document.createElement('a');
        a.href = match[2];
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = match[1];
        parent.appendChild(a);
      } else {
        const el = document.createElement(pattern.tag);
        el.textContent = match[1];
        parent.appendChild(el);
      }
      s = s.slice(match.index + match[0].length);
    }
  }

  const frag = document.createDocumentFragment();
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      const pre = document.createElement('pre');
      const codeEl = document.createElement('code');
      codeEl.textContent = code.join('\n');
      pre.appendChild(codeEl);
      frag.appendChild(pre);
      i++;
      continue;
    }

    const hm = line.match(/^(#{1,6}) (.+)/);
    if (hm) {
      const h = document.createElement(`h${hm[1].length}`);
      appendInline(h, hm[2].trim());
      frag.appendChild(h);
      i++; continue;
    }

    if (/^---+\s*$/.test(line)) {
      frag.appendChild(document.createElement('hr'));
      i++; continue;
    }

    if (line.startsWith('>')) {
      const bq = [];
      while (i < lines.length && lines[i].startsWith('>')) bq.push(lines[i++].replace(/^> ?/, ''));
      const el = document.createElement('blockquote');
      appendInline(el, bq.join(' '));
      frag.appendChild(el);
      continue;
    }

    if (/^[ \t]*[-*] /.test(line)) {
      const ul = document.createElement('ul');
      while (i < lines.length && /^[ \t]*[-*] /.test(lines[i])) {
        const m = lines[i++].match(/^[ \t]*[-*] (.*)/);
        const li = document.createElement('li');
        appendInline(li, m[1]);
        ul.appendChild(li);
      }
      frag.appendChild(ul);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const ol = document.createElement('ol');
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const m = lines[i++].match(/^\d+\. (.*)/);
        const li = document.createElement('li');
        appendInline(li, m[1]);
        ol.appendChild(li);
      }
      frag.appendChild(ol);
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const p = document.createElement('p');
    appendInline(p, line);
    frag.appendChild(p);
    i++;
  }

  return frag;
}

// ── Popup logic ───────────────────────────────────────────────────────────────

let currentContent = { text: null, markdown: null };

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function runExtract(tab, format) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: extractPageContent,
    args: [format],
  });

  // Some sites render content inside iframes. Pick the "best" frame output.
  const best = results
    .map(r => (typeof r.result === 'string' ? r.result : ''))
    .map(s => s.trim())
    .sort((a, b) => b.length - a.length)[0];

  return best ?? '';
}

function showStatus(msg, error) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = error ? '#d32f2f' : '#1a73e8';
  if (msg) setTimeout(() => { el.textContent = ''; }, 2200);
}

function t(key, ...subs) {
  return chrome.i18n.getMessage(key, subs.length ? subs : undefined) || key;
}

function formatCharCount(str) {
  const chars = str ? str.length : 0;
  return chars >= 1000
    ? t('charsK', (chars / 1000).toFixed(1))
    : t('chars', String(chars));
}

function applyI18n(root) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
    if (msg) el.dataset.placeholder = msg;
  });
}

function updateCharCount(str) {
  const el = document.getElementById('char-count');
  el.textContent = str ? formatCharCount(str) : '';
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

document.addEventListener('DOMContentLoaded', async () => {
  applyI18n(document);

  const btnText = document.getElementById('btn-text');
  const btnMd = document.getElementById('btn-md');
  const btnPickText = document.getElementById('btn-pick-text');
  const btnPickMd = document.getElementById('btn-pick-md');
  const optIncludeTitleUrl = document.getElementById('opt-include-title-url');
  const preview = document.getElementById('preview');
  const title = document.getElementById('page-title');

  let includeTitleUrl = await loadIncludeTitleUrl();
  optIncludeTitleUrl.checked = includeTitleUrl;

  function withMeta(content, format) {
    if (!includeTitleUrl || !tab) return content;
    return prependTitleUrl(content, tab.title, tab.url, format);
  }

  const pickerI18n = {
    copied: chrome.i18n.getMessage('statusCopied', ['__CHARS__']),
    copyFailed: chrome.i18n.getMessage('toastCopyFailed'),
    chars: chrome.i18n.getMessage('chars', ['__N__']),
    charsK: chrome.i18n.getMessage('charsK', ['__N__']),
  };

  function setPreview(text, isMarkdown = true) {
    if (!text) { preview.replaceChildren(); return; }
    if (isMarkdown) {
      preview.replaceChildren(renderMarkdown(text));
    } else {
      preview.textContent = text;
    }
  }

  let tab;
  try {
    tab = await getTab();
    title.textContent = tab.title || tab.url || t('unknownPage');
  } catch {
    title.textContent = t('cannotAccessPage');
    preview.dataset.placeholder = t('cannotAccessPageDesc');
    return;
  }

  function refreshPreview() {
    const md = currentContent.markdown;
    if (md == null) return;
    const display = withMeta(md, 'markdown');
    setPreview(display, true);
    updateCharCount(display);
  }

  optIncludeTitleUrl.addEventListener('change', async () => {
    includeTitleUrl = optIncludeTitleUrl.checked;
    await saveIncludeTitleUrl(includeTitleUrl);
    refreshPreview();
  });

  // Load markdown preview on open
  try {
    const md = await runExtract(tab, 'markdown');
    currentContent.markdown = md;
    refreshPreview();
  } catch (e) {
    preview.replaceChildren();
  }

  btnText.addEventListener('click', async () => {
    btnText.disabled = true;
    try {
      if (!currentContent.text) {
        currentContent.text = await runExtract(tab, 'text');
      }
      const out = withMeta(currentContent.text, 'text');
      await copyToClipboard(out);
      setPreview(out, false);
      updateCharCount(out);
      showStatus(t('statusTextCopied', formatCharCount(out)));
    } catch (e) {
      showStatus(t('statusError', e.message), true);
    } finally {
      btnText.disabled = false;
    }
  });

  btnMd.addEventListener('click', async () => {
    btnMd.disabled = true;
    try {
      if (!currentContent.markdown) {
        currentContent.markdown = await runExtract(tab, 'markdown');
      }
      const out = withMeta(currentContent.markdown, 'markdown');
      await copyToClipboard(out);
      setPreview(out, true);
      updateCharCount(out);
      showStatus(t('statusMdCopied', formatCharCount(out)));
    } catch (e) {
      showStatus(t('statusError', e.message), true);
    } finally {
      btnMd.disabled = false;
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'pick-preview') {
      const text = msg.text || '';
      const isMarkdown = msg.format === 'markdown';
      if (text) {
        setPreview(text.length > 500 ? text.slice(0, 500) + '…' : text, isMarkdown);
        updateCharCount(text);
      } else {
        preview.replaceChildren();
        updateCharCount('');
      }
    }
  });

  async function startPick(format, btn) {
    btn.disabled = true;

    const onPopupEsc = (e) => {
      if (e.key !== 'Escape') return;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__copyContentPickerCancel?.(),
      }).catch(() => { });
    };
    document.addEventListener('keydown', onPopupEsc, true);

    try {
      showStatus(t('statusClickElement'));
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['toast.js'],
      });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: pickElementContent,
        args: [format, pickerI18n, COLORS],
      });
      const picked = results[0]?.result ?? '';
      if (!picked) {
        showStatus(t('noContent'), true);
      } else {
        const out = withMeta(picked, format);
        await copyToClipboard(out);
        setPreview(out, format === 'markdown');
        updateCharCount(out);
        showStatus(t('statusCopied', formatCharCount(out)));
      }
    } catch (e) {
      if (e.message?.includes('cancelled')) {
        showStatus('');
      } else {
        showStatus(t('statusError', e.message), true);
      }
    } finally {
      document.removeEventListener('keydown', onPopupEsc, true);
      btn.disabled = false;
    }
  }

  btnPickText.addEventListener('click', () => startPick('text', btnPickText));
  btnPickMd.addEventListener('click', () => startPick('markdown', btnPickMd));
});
