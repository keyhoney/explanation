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
const b64urlToBytes = (b64url) => {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
};
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
// QR_OUT_DIR은 삭제하지 않고 기존 데이터 유지
await ensureDir(path.join(DIST_DIR,'data'));
await ensureDir(path.join(DIST_DIR,BLOB_DIR));
await ensureDir(QR_OUT_DIR);

// dist index/js 준비
await ensureDir(path.join(DIST_DIR,'js'));
try { await fs.copyFile('dist.index.template.html', path.join(DIST_DIR,'index.html')); } catch {}
await fs.copyFile('src/assets/js/app.js', path.join(DIST_DIR,'js/app.js'));

// 기존 qr-urls.csv 읽기 (있으면)
let oldQR = {};
try {
  const csv = await fs.readFile(path.join(QR_OUT_DIR,'qr-urls.csv'),'utf8');
  const lines = csv.trim().split('\n');
  const header = lines.shift().split(',');
  const idx = {q: header.indexOf('q'), sig: header.indexOf('sig'), k: header.indexOf('k'), url: header.indexOf('url')};
  for (const line of lines) {
    const cols = line.split(',');
    oldQR[cols[idx.q]] = { sig: cols[idx.sig], k: cols[idx.k], url: cols[idx.url] };
  }
  console.log(`Loaded ${Object.keys(oldQR).length} existing QR entries`);
} catch {
  console.log('No previous qr-urls.csv found; creating new one');
}

// manifest / qr csv
const manifest = [];
const qrRows = [['q','sig','k','url','source']];

const files = (await fs.readdir(SRC_DIR)).filter(f=>f.endsWith('.md'));
for (const f of files) {
  const md = await fs.readFile(path.join(SRC_DIR,f), 'utf8');
  const html = marked.parse(md);

  const q = f.replace(/\.md$/,''); // 파일명이 문항코드(YYYYMMDD)라고 가정
  
  let sig, k, url;
  if (oldQR[q]) {
    // 기존 값 재사용
    sig = oldQR[q].sig;
    k   = oldQR[q].k;
    url = oldQR[q].url;
    console.log(`Reusing QR for ${q}`);
  } else {
    // 새 문항 → 새 QR 생성
    sig = hmacTrunc(SECRET, q, 12);
    const aesKey = crypto.randomBytes(16);
    k = b64url(aesKey);
    url = `${BASE_URL}#q=${q}&sig=${sig}&k=${k}`;
    console.log(`New QR for ${q}`);
  }

  // 해설 암호화 (항상 최신 내용으로 갱신)
  const aesKeyBytes = b64urlToBytes(k); // 복호화용 키는 그대로 사용
  const { iv, ct } = aesGcmEncrypt(aesKeyBytes, Buffer.from(html,'utf8'));

  // blob 저장
  const sub = randomId(2).toLowerCase();
  const name = randomId(11);
  const dirPath = path.join(DIST_DIR, BLOB_DIR, sub);
  await ensureDir(dirPath);
  const blobPath = path.join(dirPath, `${name}.json`);
  await fs.writeFile(blobPath, JSON.stringify({ iv: b64url(iv), ct: b64url(ct) }, null, 2));

  const relPath = path.relative(DIST_DIR, blobPath).replace(/\\/g,'/');
  manifest.push({ q, sig, path: relPath });
  qrRows.push([q, sig, k, url, f]);
  console.log(`Built ${f} -> q=${q} sig=${sig} path=${relPath}`);
}

// manifest 및 QR 리스트 저장
await fs.writeFile(path.join(DIST_DIR, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
await fs.writeFile(path.join('qr_out','qr-urls.csv'), qrRows.map(r=>r.join(',')).join('\n'));
await fs.writeFile(path.join('qr_out','qr_urls.txt'), qrRows.slice(1).map(r=>r[3]).join('\n'));
console.log('Manifest & QR lists written.');