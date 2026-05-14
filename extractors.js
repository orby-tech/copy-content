// Shared by popup.js and background.js. Functions are passed to chrome.scripting.executeScript
// (so they must remain self-contained) and called inside the page context.

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

  function toMarkdown(root) {
    return convertNode(root).replace(/\n{3,}/g, '\n\n').trim();
  }

  function convertNode(node) {
    if (node.nodeType === 3) {
      return node.textContent.replace(/[\r\n]+/g, ' ');
    }
    if (node.nodeType !== 1) return '';

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

function pickElementContent(format, i18n) {
  const HIGHLIGHT_ID = '__copy_content_picker_highlight__';
  const TOAST_ID = '__copy_content_picker_toast__';

  const L = {
    copied: (i18n && i18n.copied) || 'Copied · __CHARS__',
    copyFailed: (i18n && i18n.copyFailed) || 'Copy failed',
    chars: (i18n && i18n.chars) || '__N__ chars',
    charsK: (i18n && i18n.charsK) || '__N__k chars',
  };

  function formatChars(n) {
    if (n >= 1000) return L.charsK.replace('__N__', (n / 1000).toFixed(1));
    return L.chars.replace('__N__', String(n));
  }

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
      const charLabel = formatChars(content.length);
      const text = copied ? L.copied.replace('__CHARS__', charLabel) : L.copyFailed;
      showToast(text, copied ? 'ok' : 'error');
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
    createCopyContentToast(text, kind);
  }

  function tryCopy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
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
      if (node.nodeType === 3) {
        return node.textContent.replace(/[\r\n]+/g, ' ');
      }
      if (node.nodeType !== 1) return '';

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
