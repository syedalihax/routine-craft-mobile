const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const faviconSource = path.join(root, 'assets', 'favicon.png');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const entry of fs.readdirSync(publicDir)) {
  // README is not needed in deployed output
  if (entry.toLowerCase() === 'readme.md') continue;
  copyRecursive(path.join(publicDir, entry), path.join(distDir, entry));
}

if (fs.existsSync(faviconSource)) {
  fs.copyFileSync(faviconSource, path.join(distDir, 'favicon.png'));
}

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('Landing page build failed: dist/index.html was not created.');
}

console.log('Landing page build complete: dist/');
