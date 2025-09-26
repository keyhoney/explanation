// Node 18+
// Usage: node scripts/seed_src.mjs [--csv src/mun_num.csv]
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.replace(/^--/, ''), arr[i+1] && !arr[i+1].startsWith('--') ? arr[i+1] : true]);
  return acc;
}, []));

const csvFile = args.csv || 'src/mun_num.csv';

await fs.mkdir('src', { recursive: true });

// CSV 파일 읽기
let csvContent;
try {
  csvContent = await fs.readFile(csvFile, 'utf8');
} catch (error) {
  console.error(`CSV 파일을 읽을 수 없습니다: ${csvFile}`);
  console.error(error.message);
  process.exit(1);
}

// CSV 파싱
const lines = csvContent.trim().split('\n');
const header = lines[0].split('\t'); // 탭으로 구분된 것으로 보임
const dataLines = lines.slice(1);

console.log(`CSV 파일에서 ${dataLines.length}개의 문항을 찾았습니다.`);

let count = 0;
for (const line of dataLines) {
  const columns = line.split('\t');
  if (columns.length >= 3) {
    const year = columns[0].trim();
    const month = columns[1].trim();
    const day = columns[2].trim();
    
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const code = `${year}${mm}${dd}`;
    const file = path.join('src', `${code}.md`);
    
    try {
      await fs.access(file);
      // exists -> skip
    } catch {
      const content =`# 해설 ${code}

작성 중
`;
      await fs.writeFile(file, content, 'utf8');
      count++;
      console.log(`생성됨: ${code}.md`);
    }
  }
}

console.log(`총 ${count}개의 새 파일을 생성했습니다. (기존 파일은 유지됨)`);