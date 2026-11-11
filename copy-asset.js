const fs = require('fs');
const path = require('path');

const src = 'C:/Users/gpras/.gemini/antigravity/brain/6463d8b6-4812-48e7-aebd-f6a6ec0930e1/.user_uploaded/media_1794047820664_2f3fd9e7.jpg';
const destDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}
const dest = path.join(destDir, 'payment-qr.jpg');

try {
  fs.copyFileSync(src, dest);
  console.log('SUCCESS: Copied', dest, 'Size:', fs.statSync(dest).size);
} catch (err) {
  console.error('ERROR:', err);
}

