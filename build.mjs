import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Chrome MV3 only accepts background.service_worker.
// Firefox MV3 has service workers disabled by default and expects background.scripts.
// We keep one canonical manifest.json (Chrome-flavoured) and rewrite it for Firefox at build time.

function buildFor(target) {
  const dir = `dist-${target}`;
  const zip = `copy-content-${target}.zip`;

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  cpSync('icons', `${dir}/icons`, { recursive: true });
  cpSync('_locales', `${dir}/_locales`, { recursive: true });
  cpSync('popup.html', `${dir}/popup.html`);
  cpSync('popup.js', `${dir}/popup.js`);
  cpSync('colors.js', `${dir}/colors.js`);
  cpSync('extractors.js', `${dir}/extractors.js`);
  cpSync('background.js', `${dir}/background.js`);
  cpSync('LICENSE', `${dir}/LICENSE`);

  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  if (target === 'firefox') {
    manifest.background = { scripts: ['colors.js', 'extractors.js', 'background.js'] };
  }
  writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));

  rmSync(zip, { force: true });
  execSync(`cd ${dir} && zip -r ../${zip} .`, { stdio: 'inherit' });
}

buildFor('chrome');
buildFor('firefox');
