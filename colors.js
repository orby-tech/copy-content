// Single source of truth for runtime UI colors used by the picker highlight,
// the in-page toast, and the popup chrome. CSS-side counterparts live in
// popup.html as `:root` custom properties — keep both in sync.

const COLORS = Object.freeze({
  success: 'rgba(22, 163, 74, 0.92)',
  error: 'rgba(220, 38, 38, 0.92)',
  highlightBorder: '#1a73e8',
  highlightFill: 'rgba(26, 115, 232, 0.08)',
  toastText: '#fff',
  toastShadow: 'rgba(0, 0, 0, 0.25)',
});

if (typeof globalThis !== 'undefined') {
  globalThis.COLORS = COLORS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COLORS };
}
