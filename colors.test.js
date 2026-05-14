// Smoke test for colors.js. No test framework is wired up in this repo;
// run with `node colors.test.js` — exits non-zero if any assertion fails.

const assert = require('assert');
const { COLORS } = require('./colors.js');

assert.strictEqual(COLORS.success, 'rgba(22, 163, 74, 0.92)', 'success color');
assert.strictEqual(COLORS.error, 'rgba(220, 38, 38, 0.92)', 'error color');
assert.strictEqual(COLORS.highlightBorder, '#1a73e8', 'highlight border');
assert.strictEqual(COLORS.highlightFill, 'rgba(26, 115, 232, 0.08)', 'highlight fill');
assert.strictEqual(COLORS.toastText, '#fff', 'toast text');
assert.strictEqual(COLORS.toastShadow, 'rgba(0, 0, 0, 0.25)', 'toast shadow');

assert.ok(Object.isFrozen(COLORS), 'COLORS must be frozen');

try { COLORS.success = 'changed'; } catch { /* sloppy mode is silent */ }
assert.strictEqual(COLORS.success, 'rgba(22, 163, 74, 0.92)', 'frozen value must not change');

// CSS variables in popup.html must mirror the same values.
const fs = require('fs');
const html = fs.readFileSync(`${__dirname}/popup.html`, 'utf8');
const cssChecks = [
  ['--color-success', COLORS.success],
  ['--color-error', COLORS.error],
  ['--color-highlight-border', COLORS.highlightBorder],
  ['--color-highlight-fill', COLORS.highlightFill],
  ['--color-toast-text', COLORS.toastText],
  ['--color-toast-shadow', COLORS.toastShadow],
];
for (const [name, value] of cssChecks) {
  assert.ok(html.includes(`${name}: ${value}`), `popup.html :root must declare ${name}: ${value}`);
}

console.log('colors.test.js: ok');
