import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const LOGO_SRC = path.resolve('C:/Users/codyj/Downloads/AULT (2).png');

// Dot config
const DOT_RADIUS = 6;    // base radius, scaled per image
const DOT_GAP = 14;      // base gap between dot centers, scaled per image
const DOT_COLOR = '#cbd5e1'; // slate-300

async function generateSplash(width, height, logoWidthPct, outputPath) {
  // Logo width as percentage of image width
  const logoTargetWidth = Math.round(width * logoWidthPct);

  // Resize the logo
  const logoBuffer = await sharp(LOGO_SRC)
    .resize({ width: logoTargetWidth, fit: 'inside' })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuffer).metadata();
  const logoW = logoMeta.width;
  const logoH = logoMeta.height;

  // Center the logo
  const logoX = Math.round((width - logoW) / 2);
  const logoY = Math.round((height - logoH) / 2) - Math.round(height * 0.03); // slightly above center

  // Dots position - 80% down the image
  const scale = width / 390; // scale relative to iPhone width
  const dotR = Math.round(DOT_RADIUS * scale);
  const dotGap = Math.round(DOT_GAP * scale);
  const dotsY = Math.round(height * 0.82);
  const dotCenterX = Math.round(width / 2);

  // Create SVG overlay for dots
  const dotsSvg = `<svg width="${width}" height="${height}">
    <circle cx="${dotCenterX - dotGap}" cy="${dotsY}" r="${dotR}" fill="${DOT_COLOR}" />
    <circle cx="${dotCenterX}" cy="${dotsY}" r="${dotR}" fill="${DOT_COLOR}" />
    <circle cx="${dotCenterX + dotGap}" cy="${dotsY}" r="${dotR}" fill="${DOT_COLOR}" />
  </svg>`;

  // Compose: white background + logo + dots
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([
      { input: logoBuffer, left: logoX, top: logoY },
      { input: Buffer.from(dotsSvg), left: 0, top: 0 },
    ])
    .png()
    .toFile(outputPath);

  console.log(`  ✓ ${path.basename(outputPath)} (${width}x${height})`);
}

async function main() {
  console.log('Generating Vaulte splash screens...\n');

  // ── iOS ──
  console.log('iOS:');
  const iosDir = 'ios/App/App/Assets.xcassets/Splash.imageset';
  await generateSplash(2732, 2732, 0.30, path.join(iosDir, 'splash-2732x2732.png'));
  await generateSplash(2732, 2732, 0.30, path.join(iosDir, 'splash-2732x2732-1.png'));
  await generateSplash(2732, 2732, 0.30, path.join(iosDir, 'splash-2732x2732-2.png'));

  // ── Android Portrait ──
  console.log('\nAndroid Portrait:');
  const portSizes = [
    { name: 'mdpi',    w: 320,  h: 480 },
    { name: 'hdpi',    w: 480,  h: 800 },
    { name: 'xhdpi',   w: 720,  h: 1280 },
    { name: 'xxhdpi',  w: 1080, h: 1920 },
    { name: 'xxxhdpi', w: 1440, h: 2560 },
  ];
  for (const s of portSizes) {
    const dir = `android/app/src/main/res/drawable-port-${s.name}`;
    fs.mkdirSync(dir, { recursive: true });
    await generateSplash(s.w, s.h, 0.55, path.join(dir, 'splash.png'));
  }

  // ── Android Landscape ──
  console.log('\nAndroid Landscape:');
  const landSizes = [
    { name: 'mdpi',    w: 480,  h: 320 },
    { name: 'hdpi',    w: 800,  h: 480 },
    { name: 'xhdpi',   w: 1280, h: 720 },
    { name: 'xxhdpi',  w: 1920, h: 1080 },
    { name: 'xxxhdpi', w: 2560, h: 1440 },
  ];
  for (const s of landSizes) {
    const dir = `android/app/src/main/res/drawable-land-${s.name}`;
    fs.mkdirSync(dir, { recursive: true });
    await generateSplash(s.w, s.h, 0.30, path.join(dir, 'splash.png'));
  }

  // ── Android default drawable ──
  console.log('\nAndroid Default:');
  const defaultDir = 'android/app/src/main/res/drawable';
  fs.mkdirSync(defaultDir, { recursive: true });
  await generateSplash(480, 800, 0.55, path.join(defaultDir, 'splash.png'));

  console.log('\n✅ All splash screens generated!');
}

main().catch(err => { console.error(err); process.exit(1); });
