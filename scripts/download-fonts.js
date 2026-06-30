const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS = [
  { name: 'Cairo-Regular.ttf', url: 'https://github.com/google/fonts/raw/main/ofl/cairo/Cairo%5Bwght%5D.ttf?raw=true' },
  { name: 'Cairo-Medium.ttf', url: 'https://github.com/google/fonts/raw/main/ofl/cairo/Cairo%5Bwght%5D.ttf?raw=true' },
  { name: 'Cairo-Bold.ttf', url: 'https://github.com/google/fonts/raw/main/ofl/cairo/Cairo%5Bwght%5D.ttf?raw=true' },
];

const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');

async function downloadFont(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res) => {
          const stream = fs.createWriteStream(filepath);
          res.pipe(stream);
          stream.on('finish', resolve);
          stream.on('error', reject);
        });
        return;
      }
      const stream = fs.createWriteStream(filepath);
      response.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  const variableUrl = 'https://github.com/google/fonts/raw/main/ofl/cairo/Cairo%5Bwght%5D.ttf';
  
  console.log('Downloading Cairo variable font...');
  const tempFile = path.join(fontsDir, 'Cairo-Variable.ttf');
  await downloadFont(variableUrl, tempFile);
  
  // Copy as separate weights (same variable font file works for all)
  fs.copyFileSync(tempFile, path.join(fontsDir, 'Cairo-Regular.ttf'));
  fs.copyFileSync(tempFile, path.join(fontsDir, 'Cairo-Medium.ttf'));
  fs.copyFileSync(tempFile, path.join(fontsDir, 'Cairo-Bold.ttf'));
  
  console.log('Fonts downloaded successfully!');
}

main().catch(console.error);
