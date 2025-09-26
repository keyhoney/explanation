// Node 18+
// Usage: node scripts/seed_src.mjs [--yStart 2022 --yEnd 2026 --mStart 3 --mEnd 11 --dStart 1 --dEnd 30]
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.replace(/^--/, ''), arr[i+1] && !arr[i+1].startsWith('--') ? arr[i+1] : true]);
  return acc;
}, []));

const yStart = parseInt(args.yStart || 2022, 10);
const yEnd   = parseInt(args.yEnd   || 2026, 10);
const mStart = parseInt(args.mStart || 3, 10);
const mEnd   = parseInt(args.mEnd   || 11, 10);
const dStart = parseInt(args.dStart || 1, 10);
const dEnd   = parseInt(args.dEnd   || 30, 10);

await fs.mkdir('src', { recursive: true });

let count = 0;
for (let y = yStart; y <= yEnd; y++) {
  for (let m = mStart; m <= mEnd; m++) {
    for (let d = dStart; d <= dEnd; d++) {
      const mm = String(m).padStart(2,'0');
      const dd = String(d).padStart(2,'0');
      const code = `${y}${mm}${dd}`;
      const file = path.join('src', `${code}.md`);
      try {
        await fs.access(file);
        // exists -> skip
      } catch {
        const content = `# 해설 ${code}

문제 설명(요약)을 여기에 씁니다.

**정답 아이디어**
- 핵심 아이디어를 기술합니다.

**해설 본문**
수식 예시: $a^2 + b^2 = c^2$

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$
`;
        await fs.writeFile(file, content, 'utf8');
        count++;
      }
    }
  }
}
console.log(`Seeded ${count} files under src/ (existing files were kept).`);