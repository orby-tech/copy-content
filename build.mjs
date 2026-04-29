import { cpSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';

mkdirSync('dist', { recursive: true });
cpSync('icons', 'dist/icons', { recursive: true });
cpSync('_locales', 'dist/_locales', { recursive: true });
cpSync('manifest.json', 'dist/manifest.json');
cpSync('popup.html', 'dist/popup.html');
cpSync('popup.js', 'dist/popup.js');

rmSync('copy-content.zip', { force: true });
execSync('cd dist && zip -r ../copy-content.zip .', { stdio: 'inherit' });