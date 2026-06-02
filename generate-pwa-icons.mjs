import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logo = path.join('C:\\Users\\codyj\\Downloads', 'AULT (2).png');
const outDir = path.join(__dirname, 'public');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  for (const size of sizes) {
    const logoWidth = Math.round(size * 0.75);
    const logoHeight = Math.round(logoWidth * 0.45);

    const resizedLogo = await sharp(logo)
      .resize(logoWidth, logoHeight, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{
        input: resizedLogo,
        gravity: 'centre'
      }])
      .png()
      .toFile(path.join(outDir, `icon-${size}x${size}.png`));

    console.log(`Generated icon-${size}x${size}.png`);
  }
  console.log('Done!');
}

generate().catch(console.error);
