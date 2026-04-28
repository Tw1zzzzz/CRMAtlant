const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist-overwolf');
const manifestPath = path.join(root, 'overwolf', 'manifest.json');
const desktopConfigPath = path.join(distDir, 'desktop-config.js');
const apiBaseUrl = process.env.OVERWOLF_API_BASE_URL || 'http://localhost:5001';

if (!fs.existsSync(distDir)) {
  throw new Error(`Overwolf build directory not found: ${distDir}`);
}

fs.copyFileSync(manifestPath, path.join(distDir, 'manifest.json'));
fs.writeFileSync(
  desktopConfigPath,
  `window.CRMATLANT_DESKTOP_CONFIG = window.CRMATLANT_DESKTOP_CONFIG || {\n  apiBaseUrl: ${JSON.stringify(apiBaseUrl)}\n};\n`
);

console.log(`Prepared Overwolf package in ${distDir}`);
console.log(`Overwolf API base URL: ${apiBaseUrl}`);
