const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'dist');
const htmlPath = path.join(outputDir, 'index.html');
const socialImageSource = path.join(__dirname, '..', 'public', 'og-routinecraft.png');
const socialImageOutput = path.join(outputDir, 'og-routinecraft.png');
const faviconSource = path.join(__dirname, '..', 'assets', 'favicon.png');
const apkSource = path.join(__dirname, '..', 'public', 'RoutineCraft.apk');
const socialImageUrl = 'https://routine-craft-eta.vercel.app/og-routinecraft.png';

if (!fs.existsSync(htmlPath)) {
  throw new Error('Expo web export did not create dist/index.html');
}

fs.copyFileSync(socialImageSource, socialImageOutput);
fs.copyFileSync(faviconSource, path.join(outputDir, 'favicon.png'));
if (fs.existsSync(apkSource)) {
  fs.copyFileSync(apkSource, path.join(outputDir, 'RoutineCraft.apk'));
}

const html = fs.readFileSync(htmlPath, 'utf8');
const metadata = [
  '<meta name="theme-color" content="#0D1015">',
  '<meta name="description" content="RoutineCraft helps you build consistent habits and track your progress.">',
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="RoutineCraft">',
  '<meta property="og:title" content="RoutineCraft">',
  '<meta property="og:description" content="Build consistent habits and track your progress with RoutineCraft.">',
  `<meta property="og:image" content="${socialImageUrl}">`,
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="RoutineCraft">',
  '<meta name="twitter:description" content="Build consistent habits and track your progress with RoutineCraft.">',
  `<meta name="twitter:image" content="${socialImageUrl}">`,
  '<link rel="icon" type="image/png" sizes="96x96" href="/favicon.png">',
  '<link rel="apple-touch-icon" href="/favicon.png">',
].join('\n    ');

if (!html.includes('property="og:image"')) {
  fs.writeFileSync(htmlPath, html.replace('</head>', `    ${metadata}\n  </head>`));
}
