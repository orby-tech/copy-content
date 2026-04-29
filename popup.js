// Runs inside the page context — no access to extension scope
function extractPageContent(format) {
  const CONTENT_SELECTORS = [
    'main', 'article', '[role="main"]',
    '#main', '#content', '#article',
    '.main', '.content', '.post', '.article',
    '.entry-content', '.post-content', '.page-content',
  ];

  const REMOVE_SELECTORS = [
    'script', 'style', 'noscript',
    'nav', 'header', 'footer', 'aside',
    '.nav', '.menu', '.sidebar', '.advertisement',
    '.ads', '.cookie-banner', '.popup',
    '[aria-hidden="true"]',
    '[aria-label="Timeline: Trending now"]',
    '[aria-label="Relevant people"]',
  ];

  // Find best content root
  let root = null;
  for (const sel of CONTENT_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim().length > 100) { root = el; break; }
  }
  if (!root) root = document.body;

  return extractElementContent(root, format);

  function extractElementContent(element, format) {
    const clone = element.cloneNode(true);
    for (const sel of REMOVE_SELECTORS) {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    }

    if (format === 'text') {
      return (clone.innerText || clone.textContent)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    return toMarkdown(clone);
  }

  // ── Markdown converter ──────────────────────────────────────────────────

  function toMarkdown(root) {
    return convertNode(root).replace(/\n{3,}/g, '\n\n').trim();
  }

  function convertNode(node) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      return node.textContent.replace(/[\r\n]+/g, ' ');
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return '';

    const tag = node.tagName.toLowerCase();
    const inner = () => Array.from(node.childNodes).map(convertNode).join('');

    // Skip invisible elements
    if (node.style && (node.style.display === 'none' || node.style.visibility === 'hidden')) return '';

    switch (tag) {
      case 'head': case 'script': case 'style':
      case 'nav': case 'footer': case 'aside': return '';

      case 'h1': return `\n# ${inner().trim()}\n\n`;
      case 'h2': return `\n## ${inner().trim()}\n\n`;
      case 'h3': return `\n### ${inner().trim()}\n\n`;
      case 'h4': return `\n#### ${inner().trim()}\n\n`;
      case 'h5': return `\n##### ${inner().trim()}\n\n`;
      case 'h6': return `\n###### ${inner().trim()}\n\n`;

      case 'p': return `\n${inner().trim()}\n\n`;
      case 'br': return '\n';
      case 'hr': return '\n---\n\n';

      case 'strong': case 'b': {
        const t = inner().trim();
        return t ? `**${t}**` : '';
      }
      case 'em': case 'i': {
        const t = inner().trim();
        return t ? `_${t}_` : '';
      }
      case 'del': case 's': {
        const t = inner().trim();
        return t ? `~~${t}~~` : '';
      }
      case 'mark': {
        const t = inner().trim();
        return t ? `==${t}==` : '';
      }

      case 'code': {
        if (node.closest('pre')) return node.textContent;
        return `\n\`${node.textContent}\`\n`;
      }
      case 'pre': {
        const code = node.querySelector('code');
        const langMatch = (code?.className || node.className || '').match(/language-(\w+)/);
        const lang = langMatch ? langMatch[1] : '';
        const text = node.getAttribute('aria-label') || (code || node).textContent;
        return `\n\n\`\`\`${lang}\n${text.trimEnd()}\n\`\`\`\n\n`;
      }

      case 'a': {
        const href = node.getAttribute('href') || '';
        const text = inner().trim();
        if (!text && !href) return '';
        if (!text) return href;
        if (!href || href === text || href.startsWith('javascript')) return text;
        // Make absolute if relative
        const abs = href.startsWith('http') ? href : (new URL(href, location.href)).href;
        return ` [${text}](${abs}) `;
      }

      case 'img': {
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || '';
        if (!src) return '';
        const abs = src.startsWith('http') ? src : (new URL(src, location.href)).href;
        return `\n![${alt}](${abs})\n`;
      }

      case 'ul': return convertList(node, false);
      case 'ol': return convertList(node, true);
      case 'li': return inner();

      case 'blockquote': {
        const lines = inner().trim().split('\n');
        return '\n' + lines.map(l => `> ${l}`).join('\n') + '\n\n';
      }

      case 'table': return convertTable(node);

      case 'thead': case 'tbody': case 'tfoot':
      case 'tr': case 'td': case 'th': return inner();

      default: {
        const result = inner();
        if (!result.trim()) return '';
        const BLOCK = new Set(['div', 'section', 'article', 'figure', 'figcaption', 'details', 'summary', 'dl', 'dt', 'dd', 'address', 'form', 'fieldset', 'main', 'header', 'label']);
        return BLOCK.has(tag) ? `\n${result}\n` : result;
      }
    }
  }

  function convertList(node, ordered, depth) {
    depth = depth || 0;
    const indent = '  '.repeat(depth);
    const items = Array.from(node.children).filter(c => c.tagName === 'LI');
    const lines = items.map((li, i) => {
      const prefix = ordered ? `${i + 1}. ` : '- ';
      // Convert li children, handling nested lists with indentation
      const parts = [];
      let text = '';
      for (const child of li.childNodes) {
        const ctag = child.tagName && child.tagName.toLowerCase();
        if (ctag === 'ul' || ctag === 'ol') {
          if (text.trim()) parts.push(text.trim());
          text = '';
          parts.push('\n' + convertList(child, ctag === 'ol', depth + 1).trimEnd());
        } else {
          text += convertNode(child);
        }
      }
      if (text.trim()) parts.push(text.trim());
      const content = parts.join('').trim();
      return `${indent}${prefix}${content}`;
    });
    return '\n' + lines.join('\n') + '\n\n';
  }

  function convertTable(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (!rows.length) return '';

    const cellText = (cell) =>
      cell.textContent.trim().replace(/\|/g, '\\|').replace(/\n+/g, ' ');

    const formatRow = (row) => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      return '| ' + cells.map(cellText).join(' | ') + ' |';
    };

    const header = formatRow(rows[0]);
    const colCount = rows[0].querySelectorAll('td, th').length;
    const separator = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    const body = rows.slice(1).map(formatRow).join('\n');

    return '\n' + header + '\n' + separator + (body ? '\n' + body : '') + '\n\n';
  }
}

function pickElementContent(format) {
  const HIGHLIGHT_ID = '__copy_content_picker_highlight__';
  const TOAST_ID = '__copy_content_picker_toast__';

  const cleanup = () => {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKeyDown, true);
    const el = document.getElementById(HIGHLIGHT_ID);
    if (el) el.remove();
    const toast = document.getElementById(TOAST_ID);
    if (toast) toast.remove();
    document.documentElement.style.cursor = '';
  };

  const highlight = (() => {
    let el = document.getElementById(HIGHLIGHT_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = HIGHLIGHT_ID;
      el.style.position = 'fixed';
      el.style.zIndex = '2147483647';
      el.style.pointerEvents = 'none';
      el.style.border = '2px solid #1a73e8';
      el.style.background = 'rgba(26, 115, 232, 0.08)';
      el.style.borderRadius = '4px';
      document.documentElement.appendChild(el);
    }
    return el;
  })();

  let currentEl = null;
  let previewTimer = null;

  function onMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === highlight || el === document.documentElement || el === document.body) return;
    currentEl = el;
    const r = el.getBoundingClientRect();
    highlight.style.left = `${Math.max(0, r.left)}px`;
    highlight.style.top = `${Math.max(0, r.top)}px`;
    highlight.style.width = `${Math.max(0, r.width)}px`;
    highlight.style.height = `${Math.max(0, r.height)}px`;

    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      try {
        chrome.runtime.sendMessage({ type: 'pick-preview', text: extractElementContent(el, format), format });
      } catch { }
    }, 40);
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (!currentEl) return;
    const picked = currentEl;
    try {
      const content = extractElementContent(picked, format);
      const copied = tryCopy(content);
      cleanup();
      const chars = content.length;
      const charLabel = chars >= 1000 ? `${(chars / 1000).toFixed(1)}k chars` : `${chars} chars`;
      showToast(copied ? `Copied · ${charLabel}` : 'Copy failed', copied ? 'ok' : 'error');
      resolvePromise(content);
    } catch (err) {
      cleanup();
      rejectPromise(err);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
      rejectPromise(new Error('Selection cancelled'));
    }
  }

  function showToast(text, kind) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      el.style.position = 'fixed';
      el.style.zIndex = '2147483647';
      el.style.left = '50%';
      el.style.top = '16px';
      el.style.transform = 'translateX(-50%)';
      el.style.padding = '10px 12px';
      el.style.borderRadius = '10px';
      el.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.25)';
      el.style.color = '#fff';
      el.style.font = '13px system-ui, -apple-system, sans-serif';
      el.style.fontWeight = '600';
      el.style.letterSpacing = '0.2px';
      el.style.pointerEvents = 'none';
      document.documentElement.appendChild(el);
    }
    const isOk = kind !== 'error';
    el.style.background = isOk ? 'rgba(22, 163, 74, 0.92)' : 'rgba(220, 38, 38, 0.92)';
    el.textContent = text;
    setTimeout(() => { try { el.remove(); } catch { } }, 2000);
  }

  function tryCopy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Fire-and-forget: should be allowed because this runs on a user click.
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch { }

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.documentElement.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  // Reuse the same logic as full-page extraction, but for a specific element.
  function extractElementContent(element, format) {
    const REMOVE_SELECTORS = [
      'script', 'style', 'noscript',
      'nav', 'header', 'footer', 'aside',
      '.nav', '.menu', '.sidebar', '.advertisement',
      '.ads', '.cookie-banner', '.popup',
      '[aria-hidden="true"]',
    ];

    const clone = element.cloneNode(true);
    for (const sel of REMOVE_SELECTORS) {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    }

    if (format === 'text') {
      return (clone.innerText || clone.textContent)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    return toMarkdown(clone);

    function toMarkdown(root) {
      return convertNode(root).replace(/\n{3,}/g, '\n\n').trim();
    }

    function convertNode(node) {
      if (node.nodeType === 3 /* TEXT_NODE */) {
        return node.textContent.replace(/[\r\n]+/g, ' ');
      }
      if (node.nodeType !== 1 /* ELEMENT_NODE */) return '';

      const tag = node.tagName.toLowerCase();
      const inner = () => Array.from(node.childNodes).map(convertNode).join('');

      if (node.style && (node.style.display === 'none' || node.style.visibility === 'hidden')) return '';

      switch (tag) {
        case 'head': case 'script': case 'style':
        case 'nav': case 'footer': case 'aside': return '';

        case 'h1': return `\n# ${inner().trim()}\n\n`;
        case 'h2': return `\n## ${inner().trim()}\n\n`;
        case 'h3': return `\n### ${inner().trim()}\n\n`;
        case 'h4': return `\n#### ${inner().trim()}\n\n`;
        case 'h5': return `\n##### ${inner().trim()}\n\n`;
        case 'h6': return `\n###### ${inner().trim()}\n\n`;

        case 'p': return `\n${inner().trim()}\n\n`;
        case 'br': return '\n';
        case 'hr': return '\n---\n\n';

        case 'strong': case 'b': {
          const t = inner().trim();
          return t ? `**${t}**` : '';
        }
        case 'em': case 'i': {
          const t = inner().trim();
          return t ? `_${t}_` : '';
        }
        case 'del': case 's': {
          const t = inner().trim();
          return t ? `~~${t}~~` : '';
        }
        case 'mark': {
          const t = inner().trim();
          return t ? `==${t}==` : '';
        }

        case 'code': {
          if (node.closest('pre')) return node.textContent;
          return `\`${node.textContent}\``;
        }
        case 'pre': {
          const code = node.querySelector('code');
          const langMatch = (code?.className || node.className || '').match(/language-(\w+)/);
          const lang = langMatch ? langMatch[1] : '';
          const text = node.getAttribute('aria-label') || (code || node).textContent;
          return `\n\n\`\`\`${lang}\n${text.trimEnd()}\n\`\`\`\n\n`;
        }

        case 'a': {
          const href = node.getAttribute('href') || '';
          const text = inner().trim();
          if (!text && !href) return '';
          if (!text) return href;
          if (!href || href === text || href.startsWith('javascript')) return text;
          const abs = href.startsWith('http') ? href : (new URL(href, location.href)).href;
          return `[${text}](${abs})`;
        }

        case 'img': {
          const src = node.getAttribute('src') || '';
          const alt = node.getAttribute('alt') || '';
          if (!src) return '';
          const abs = src.startsWith('http') ? src : (new URL(src, location.href)).href;
          return `![${alt}](${abs})`;
        }

        case 'ul': return convertList(node, false);
        case 'ol': return convertList(node, true);
        case 'li': return inner();

        case 'blockquote': {
          const lines = inner().trim().split('\n');
          return '\n' + lines.map(l => `> ${l}`).join('\n') + '\n\n';
        }

        case 'table': return convertTable(node);

        case 'thead': case 'tbody': case 'tfoot':
        case 'tr': case 'td': case 'th': return inner();

        default: {
          const result = inner();
          if (!result.trim()) return '';
          const BLOCK = new Set(['div', 'section', 'article', 'figure', 'figcaption', 'details', 'summary', 'dl', 'dt', 'dd', 'address', 'form', 'fieldset', 'main', 'header', 'label']);
          return BLOCK.has(tag) ? `\n${result}\n` : result;
        }
      }
    }

    function convertList(node, ordered, depth) {
      depth = depth || 0;
      const indent = '  '.repeat(depth);
      const items = Array.from(node.children).filter(c => c.tagName === 'LI');
      const lines = items.map((li, i) => {
        const prefix = ordered ? `${i + 1}. ` : '- ';
        const parts = [];
        let text = '';
        for (const child of li.childNodes) {
          const ctag = child.tagName && child.tagName.toLowerCase();
          if (ctag === 'ul' || ctag === 'ol') {
            if (text.trim()) parts.push(text.trim());
            text = '';
            parts.push('\n' + convertList(child, ctag === 'ol', depth + 1).trimEnd());
          } else {
            text += convertNode(child);
          }
        }
        if (text.trim()) parts.push(text.trim());
        const content = parts.join('').trim();
        return `${indent}${prefix}${content}`;
      });
      return '\n' + lines.join('\n') + '\n\n';
    }

    function convertTable(table) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (!rows.length) return '';

      const cellText = (cell) =>
        cell.textContent.trim().replace(/\|/g, '\\|').replace(/\n+/g, ' ');

      const formatRow = (row) => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        return '| ' + cells.map(cellText).join(' | ') + ' |';
      };

      const header = formatRow(rows[0]);
      const colCount = rows[0].querySelectorAll('td, th').length;
      const separator = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
      const body = rows.slice(1).map(formatRow).join('\n');

      return '\n' + header + '\n' + separator + (body ? '\n' + body : '') + '\n\n';
    }
  }

  let resolvePromise;
  let rejectPromise;

  window.__copyContentPickerCancel = () => {
    delete window.__copyContentPickerCancel;
    cleanup();
    rejectPromise(new Error('Selection cancelled'));
  };

  document.documentElement.style.cursor = 'crosshair';
  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('keydown', onKeyDown, true);

  return new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
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

function formatCharCount(str) {
  const chars = str ? str.length : 0;
  return chars >= 1000
    ? `${(chars / 1000).toFixed(1)}k chars`
    : `${chars} chars`;
}

function updateCharCount(str) {
  const el = document.getElementById('char-count');
  el.textContent = str ? formatCharCount(str) : '';
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

document.addEventListener('DOMContentLoaded', async () => {
  const btnText = document.getElementById('btn-text');
  const btnMd = document.getElementById('btn-md');
  const btnPickText = document.getElementById('btn-pick-text');
  const btnPickMd = document.getElementById('btn-pick-md');
  const preview = document.getElementById('preview');
  const title = document.getElementById('page-title');

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
    title.textContent = tab.title || tab.url || 'Unknown page';
  } catch {
    title.textContent = 'Cannot access page';
    preview.dataset.placeholder = 'Cannot access this page.';
    return;
  }

  // Load markdown preview on open
  try {
    const md = await runExtract(tab, 'markdown');
    currentContent.markdown = md;
    setPreview(md, true);
    updateCharCount(md);
  } catch (e) {
    preview.replaceChildren();
  }

  btnText.addEventListener('click', async () => {
    btnText.disabled = true;
    try {
      if (!currentContent.text) {
        currentContent.text = await runExtract(tab, 'text');
      }
      await copyToClipboard(currentContent.text);
      setPreview(currentContent.text, false);
      updateCharCount(currentContent.text);
      showStatus(`Text copied · ${formatCharCount(currentContent.text)}`);
    } catch (e) {
      showStatus('Error: ' + e.message, true);
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
      await copyToClipboard(currentContent.markdown);
      setPreview(currentContent.markdown, true);
      updateCharCount(currentContent.markdown);
      showStatus(`Markdown copied · ${formatCharCount(currentContent.markdown)}`);
    } catch (e) {
      showStatus('Error: ' + e.message, true);
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
      showStatus('Click an element on the page… (Esc to cancel)');
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: pickElementContent,
        args: [format],
      });
      const picked = results[0]?.result ?? '';
      if (!picked) {
        showStatus('No content', true);
      } else {
        await copyToClipboard(picked);
        setPreview(picked, format === 'markdown');
        updateCharCount(picked);
        showStatus(`Copied · ${formatCharCount(picked)}`);
      }
    } catch (e) {
      if (e.message?.includes('cancelled')) {
        showStatus('');
      } else {
        showStatus('Error: ' + e.message, true);
      }
    } finally {
      document.removeEventListener('keydown', onPopupEsc, true);
      btn.disabled = false;
    }
  }

  btnPickText.addEventListener('click', () => startPick('text', btnPickText));
  btnPickMd.addEventListener('click', () => startPick('markdown', btnPickMd));
});
