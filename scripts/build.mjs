// Node 18+
// npm i marked
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { marked } from 'marked';

const SECRET = process.env.SECRET_KEY;
if (!SECRET) { console.error('ERROR: SECRET_KEY env 필요'); process.exit(1); }

// 최종 배포 URL (keyhoney 예시)
const BASE_URL = process.env.BASE_URL || 'https://keyhoney.github.io/explanation/';

const SRC_DIR = 'src';
const DIST_DIR = 'dist';
const BLOB_DIR = 'data/blobs';
const MANIFEST_FILE = 'data/manifest.json';
const QR_OUT_DIR = 'qr_out';

// ===== utils =====
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const randomId = (len) => {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const rnd = crypto.randomBytes(len); let s = '';
  for (let i=0;i<len;i++) s += alpha[rnd[i]%alpha.length];
  return s;
};
const hmacTrunc = (key, msg, outLen=12) => b64url(crypto.createHmac('sha256', key).update(msg).digest()).slice(0,outLen);
const ensureDir = (p) => fs.mkdir(p, { recursive: true });
const aesGcmEncrypt = (keyBytes, plainBytes) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(`aes-${keyBytes.length*8}-gcm`, keyBytes, iv);
  const ct = Buffer.concat([cipher.update(plainBytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, ct: Buffer.concat([ct, tag]) }; // ct||tag
};

// ===== prep =====
await fs.rm(DIST_DIR, { recursive: true, force: true });
await fs.rm(QR_OUT_DIR, { recursive: true, force: true });
await ensureDir(path.join(DIST_DIR,'data'));
await ensureDir(path.join(DIST_DIR,BLOB_DIR));
await ensureDir(QR_OUT_DIR);

// dist index/js 준비
await ensureDir(path.join(DIST_DIR,'js'));
try { await fs.copyFile('dist.index.template.html', path.join(DIST_DIR,'index.html')); } catch {}
await fs.copyFile('dist/js/app.js', path.join(DIST_DIR,'js/app.js'));

// manifest / qr csv
const manifest = [];
const qrRows = [['q','sig','k','url','source']];

const files = (await fs.readdir(SRC_DIR)).filter(f=>f.endsWith('.md'));
for (const f of files) {
  const md = await fs.readFile(path.join(SRC_DIR,f), 'utf8');
  const html = marked.parse(md);

  const q = f.replace(/\.md$/,''); // 파일명이 문항코드(YYYYMMDD)라고 가정
  // 무결성 서명은 q에 대해 생성
  const sig = hmacTrunc(SECRET, q, 12);
  const aesKey = crypto.randomBytes(16); // 128-bit

  const { iv, ct } = aesGcmEncrypt(aesKey, Buffer.from(html,'utf8'));
  const sub = randomId(2).toLowerCase();
  const name = randomId(11);
  const dirPath = path.join(DIST_DIR, BLOB_DIR, sub);
  await ensureDir(dirPath);
  const blobPath = path.join(dirPath, `${name}.json`);
  await fs.writeFile(blobPath, JSON.stringify({ iv: b64url(iv), ct: b64url(ct) }, null, 2));

  const relPath = path.relative(DIST_DIR, blobPath).replace(/\\/g,'/');
  manifest.push({ q, sig, path: relPath });

  const k = b64url(aesKey);
  const url = `${BASE_URL}#q=${q}&sig=${sig}&k=${k}`;
  qrRows.push([q, sig, k, url, f]);
  console.log(`Built ${f} -> q=${q} sig=${sig} path=${relPath}`);
}

// manifest 및 QR 리스트 저장
await fs.writeFile(path.join(DIST_DIR, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
await fs.writeFile(path.join('qr_out','qr-urls.csv'), qrRows.map(r=>r.join(',')).join('\n'));
await fs.writeFile(path.join('qr_out','qr_urls.txt'), qrRows.slice(1).map(r=>r[3]).join('\n'));
console.log('Manifest & QR lists written.');