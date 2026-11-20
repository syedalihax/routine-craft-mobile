const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const assetsDir = path.join(__dirname, '..', 'assets');
const publicDir = path.join(__dirname, '..', 'public');
const source = PNG.sync.read(fs.readFileSync(path.join(assetsDir, 'routinecraft-logo-removed.png')));
const sourceSquare = PNG.sync.read(fs.readFileSync(path.join(assetsDir, 'routinecraft-logo-app-icon.png')));

function alphaBounds(image, threshold = 12) {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] > threshold) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

const bounds = alphaBounds(source);
const dark = [13, 16, 21, 255];

function sample(image, x, y) {
  const clampedX = Math.max(0, Math.min(image.width - 1, x));
  const clampedY = Math.max(0, Math.min(image.height - 1, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const dx = clampedX - x0;
  const dy = clampedY - y0;
  const output = [0, 0, 0, 0];

  for (let channel = 0; channel < 4; channel += 1) {
    const top = image.data[(y0 * image.width + x0) * 4 + channel] * (1 - dx)
      + image.data[(y0 * image.width + x1) * 4 + channel] * dx;
    const bottom = image.data[(y1 * image.width + x0) * 4 + channel] * (1 - dx)
      + image.data[(y1 * image.width + x1) * 4 + channel] * dx;
    output[channel] = Math.round(top * (1 - dy) + bottom * dy);
  }

  return output;
}

function draw(target, image, destination, crop = null, opacity = 1) {
  const sourceRect = crop || { left: 0, top: 0, width: image.width, height: image.height };
  const startX = Math.max(0, Math.floor(destination.x));
  const startY = Math.max(0, Math.floor(destination.y));
  const endX = Math.min(target.width, Math.ceil(destination.x + destination.width));
  const endY = Math.min(target.height, Math.ceil(destination.y + destination.height));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const u = (x - destination.x + 0.5) / destination.width;
      const v = (y - destination.y + 0.5) / destination.height;
      const color = sample(
        image,
        sourceRect.left + u * sourceRect.width - 0.5,
        sourceRect.top + v * sourceRect.height - 0.5,
      );
      const sourceAlpha = color[3] / 255 * opacity;
      if (!sourceAlpha) continue;

      const index = (y * target.width + x) * 4;
      const targetAlpha = target.data[index + 3] / 255;
      const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
      for (let channel = 0; channel < 3; channel += 1) {
        target.data[index + channel] = Math.round(
          (color[channel] * sourceAlpha + target.data[index + channel] * targetAlpha * (1 - sourceAlpha)) / outputAlpha,
        );
      }
      target.data[index + 3] = Math.round(outputAlpha * 255);
    }
  }
}

function canvas(width, height, background = null) {
  const image = new PNG({ width, height });
  if (background) {
    for (let index = 0; index < image.data.length; index += 4) {
      image.data[index] = background[0];
      image.data[index + 1] = background[1];
      image.data[index + 2] = background[2];
      image.data[index + 3] = background[3];
    }
  }
  return image;
}

function write(name, image) {
  fs.writeFileSync(path.join(assetsDir, name), PNG.sync.write(image));
}

const mainIcon = PNG.sync.read(fs.readFileSync(path.join(assetsDir, 'routinecraft-logo-app-icon.png')));
write('icon.png', mainIcon);
write('splash-icon.png', mainIcon);

const favicon = canvas(96, 96, dark);
draw(favicon, source, { x: 8, y: 11, width: 80, height: 74 }, bounds);
write('favicon.png', favicon);

const adaptiveBackground = canvas(512, 512, dark);
write('android-icon-background.png', adaptiveBackground);
const adaptiveForeground = canvas(512, 512);
draw(adaptiveForeground, source, { x: 86, y: 95, width: 340, height: 314 }, bounds);
write('android-icon-foreground.png', adaptiveForeground);

const monochrome = canvas(432, 432);
const monoBounds = { x: 72, y: 76, width: 288, height: 280 };
for (let y = 0; y < monoBounds.height; y += 1) {
  for (let x = 0; x < monoBounds.width; x += 1) {
    const color = sample(source, bounds.left + (x / monoBounds.width) * bounds.width, bounds.top + (y / monoBounds.height) * bounds.height);
    const index = ((y + monoBounds.y) * monochrome.width + x + monoBounds.x) * 4;
    monochrome.data[index] = 255;
    monochrome.data[index + 1] = 255;
    monochrome.data[index + 2] = 255;
    monochrome.data[index + 3] = color[3];
  }
}
write('android-icon-monochrome.png', monochrome);

const social = canvas(1200, 630, dark);
draw(social, source, { x: 370, y: 103, width: 460, height: 424 }, bounds);
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'og-routinecraft.png'), PNG.sync.write(social));

console.log('Generated app icon, Android adaptive assets, favicon, splash icon, and social preview.');
