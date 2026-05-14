// Chrome service worker imports shared modules; Firefox loads them via manifest.scripts.
if (typeof importScripts === 'function') {
  if (typeof COLORS === 'undefined') {
    try { importScripts('colors.js'); } catch { }
  }
  if (typeof createCopyContentToast === 'undefined') {
    try { importScripts('toast.js'); } catch { }
  }
  if (typeof extractPageContent === 'undefined') {
    try { importScripts('extractors.js'); } catch { }
  }
}

const SETTINGS_KEY = 'includeTitleUrl';

async function shouldIncludeTitleUrl() {
  try {
    const data = await chrome.storage.sync.get(SETTINGS_KEY);
    return Boolean(data[SETTINGS_KEY]);
  } catch {
    return false;
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

async function showToast(tabId, text, kind) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['toast.js'],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (t, k) => createCopyContentToast(t, k),
    args: [text, kind],
  });
}

async function runCopyWholePage(tab, format) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: extractPageContent,
    args: [format],
  });
  let text = results
    .map(r => (typeof r.result === 'string' ? r.result : ''))
    .map(s => s.trim())
    .sort((a, b) => b.length - a.length)[0] || '';

  if (text && await shouldIncludeTitleUrl()) {
    text = prependTitleUrl(text, tab.title, tab.url, format);
  }

  if (!text) {
    await showToast(tab.id, chrome.i18n.getMessage('noContent') || 'No content', 'error');
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

  await showToast(tab.id, copied ? okMsg : failMsg, copied ? 'ok' : 'error');
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
    files: ['toast.js'],
  });

  let picked = '';
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pickElementContent,
      args: [format, pickerI18n, COLORS],
    });
    picked = results[0]?.result ?? '';
  } catch {
    return;
  }

  if (!picked || !(await shouldIncludeTitleUrl())) return;

  const out = prependTitleUrl(picked, tab.title, tab.url, format);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: copyTextInPage,
    args: [out],
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
