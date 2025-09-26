// Node 18+
// npm i qrcode
import fs from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';

const QR_OUT_DIR = 'qr_out';
const CSV = path.join(QR_OUT_DIR, 'qr-urls.csv');

const text = await fs.readFile(CSV, 'utf8');
const lines = text.trim().split('\n');
const header = lines.shift().split(',');
const idx = { q: header.indexOf('q'), url: header.indexOf('url'), source: header.indexOf('source') };

await fs.mkdir(QR_OUT_DIR, { recursive: true });

for (const line of lines) {
  const cols = line.split(',');
  const q = cols[idx.q];
  const url = cols[idx.url];
  const src = cols[idx.source].replace(/\.[^/.]+$/, '');
  const filename = path.join(QR_OUT_DIR, `qr-${q}-${src}.png`);

  await QRCode.toFile(filename, url, {
    margin: 1,
    width: 600,
    errorCorrectionLevel: 'M'
  });
  console.log('QR:', filename);
}
console.log('All QR codes generated.');