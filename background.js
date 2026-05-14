// Chrome service worker imports shared modules; Firefox loads them via manifest.scripts.
if (typeof importScripts === 'function') {
  if (typeof COLORS === 'undefined') {
    try { importScripts('colors.js'); } catch { }
  }
  if (typeof extractPageContent === 'undefined') {
    try { importScripts('extractors.js'); } catch { }
  }
}

const MENU_ITEMS = [
  { id: 'copy-text',    msg: 'menuCopyText'   },
  { id: 'copy-md',      msg: 'menuCopyMd'     },
  { id: 'pick-text',    msg: 'menuPickText'   },
  { id: 'pick-md',      msg: 'menuPickMd'     },
];

function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU_ITEMS) {
      chrome.contextMenus.create({
        id: item.id,
        title: chrome.i18n.getMessage(item.msg) || item.id,
        contexts: ['page', 'selection', 'frame'],
      });
    }
  });
}

chrome.runtime.onInstalled.addListener(setupMenus);
chrome.runtime.onStartup.addListener(setupMenus);

function copyTextInPage(text) {
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

function showToastInPage(text, kind, colors) {
  const TOAST_ID = '__copy_content_picker_toast__';
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
    el.style.boxShadow = `0 8px 24px ${colors.toastShadow}`;
    el.style.color = colors.toastText;
    el.style.font = '13px system-ui, -apple-system, sans-serif';
    el.style.fontWeight = '600';
    el.style.letterSpacing = '0.2px';
    el.style.pointerEvents = 'none';
    document.documentElement.appendChild(el);
  }
  el.style.background = kind === 'error' ? colors.error : colors.success;
  el.textContent = text;
  setTimeout(() => { try { el.remove(); } catch { } }, 2000);
}

async function runCopyWholePage(tab, format) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: extractPageContent,
    args: [format],
  });
  const text = results
    .map(r => (typeof r.result === 'string' ? r.result : ''))
    .map(s => s.trim())
    .sort((a, b) => b.length - a.length)[0] || '';

  if (!text) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showToastInPage,
      args: [chrome.i18n.getMessage('noContent') || 'No content', 'error', COLORS],
    });
    return;
  }

  const [{ result: copied }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: copyTextInPage,
    args: [text],
  });

  const charLabel = text.length >= 1000
    ? (chrome.i18n.getMessage('charsK', [(text.length / 1000).toFixed(1)]) || `${(text.length / 1000).toFixed(1)}k chars`)
    : (chrome.i18n.getMessage('chars', [String(text.length)]) || `${text.length} chars`);

  const okMsg = format === 'text'
    ? (chrome.i18n.getMessage('statusTextCopied', [charLabel]) || `Text copied · ${charLabel}`)
    : (chrome.i18n.getMessage('statusMdCopied', [charLabel]) || `Markdown copied · ${charLabel}`);
  const failMsg = chrome.i18n.getMessage('toastCopyFailed') || 'Copy failed';

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: showToastInPage,
    args: [copied ? okMsg : failMsg, copied ? 'ok' : 'error', COLORS],
  });
}

async function runPick(tab, format) {
  const pickerI18n = {
    copied: chrome.i18n.getMessage('statusCopied', ['__CHARS__']) || 'Copied · __CHARS__',
    copyFailed: chrome.i18n.getMessage('toastCopyFailed') || 'Copy failed',
    chars: chrome.i18n.getMessage('chars', ['__N__']) || '__N__ chars',
    charsK: chrome.i18n.getMessage('charsK', ['__N__']) || '__N__k chars',
  };

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: pickElementContent,
    args: [format, pickerI18n, COLORS],
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  try {
    switch (info.menuItemId) {
      case 'copy-text': await runCopyWholePage(tab, 'text'); break;
      case 'copy-md':   await runCopyWholePage(tab, 'markdown'); break;
      case 'pick-text': await runPick(tab, 'text'); break;
      case 'pick-md':   await runPick(tab, 'markdown'); break;
    }
  } catch (e) {
    console.error('[copy-content] context menu action failed:', e);
  }
});
