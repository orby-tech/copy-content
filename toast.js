// Toast overlay shared by background.js (whole-page copy result) and the picker
// flow inside extractors.js. Loaded into the background context via importScripts
// (Chrome SW) / manifest.scripts (Firefox), and injected into the page's isolated
// world via chrome.scripting.executeScript({ files: ['toast.js'] }) before any
// page-context call site uses it. The top-level guard makes re-injection safe:
// chrome.scripting evaluates the file each time it's targeted, and re-declaring
// the constants would throw in the isolated world.

if (typeof createCopyContentToast === 'undefined') {
  var COPY_CONTENT_TOAST_ID = '__copy_content_picker_toast__';

  var COPY_CONTENT_TOAST_BACKGROUNDS = {
    ok: 'rgba(22, 163, 74, 0.92)',
    error: 'rgba(220, 38, 38, 0.92)',
  };

  var COPY_CONTENT_TOAST_BASE_STYLES = {
    position: 'fixed',
    zIndex: '2147483647',
    left: '50%',
    top: '16px',
    transform: 'translateX(-50%)',
    padding: '10px 12px',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
    color: '#fff',
    font: '13px system-ui, -apple-system, sans-serif',
    fontWeight: '600',
    letterSpacing: '0.2px',
    pointerEvents: 'none',
  };

  var createCopyContentToast = function (text, kind) {
    let el = document.getElementById(COPY_CONTENT_TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = COPY_CONTENT_TOAST_ID;
      for (const [prop, value] of Object.entries(COPY_CONTENT_TOAST_BASE_STYLES)) {
        el.style[prop] = value;
      }
      document.documentElement.appendChild(el);
    }
    el.style.background = kind === 'error'
      ? COPY_CONTENT_TOAST_BACKGROUNDS.error
      : COPY_CONTENT_TOAST_BACKGROUNDS.ok;
    el.textContent = text;
    setTimeout(() => { try { el.remove(); } catch { } }, 2000);
    return el;
  };
}
