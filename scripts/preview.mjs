// Node 18+
// 프리뷰 서버 실행: node scripts/preview.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { createServer } from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const SRC_DIR = path.join(projectRoot, 'src');
const PORT = 3000;

// 마크다운 파일 목록 가져오기
async function getMarkdownFiles() {
  try {
    const files = await fs.readdir(SRC_DIR);
    return files.filter(f => f.endsWith('.md'));
  } catch (error) {
    console.error('src 디렉토리를 읽을 수 없습니다:', error);
    return [];
  }
}

// 마크다운 파일을 HTML로 변환
async function convertMarkdownToHtml(filename) {
  try {
    const filePath = path.join(SRC_DIR, filename);
    const markdown = await fs.readFile(filePath, 'utf8');
    const html = marked.parse(markdown);
    return html;
  } catch (error) {
    console.error(`파일 ${filename} 읽기 실패:`, error);
    throw error;
  }
}

// HTTP 서버 생성
const server = createServer(async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === '/api/files') {
      // 파일 목록 반환
      const files = await getMarkdownFiles();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } else if (url.pathname.startsWith('/api/preview/')) {
      // 특정 파일 프리뷰
      const filename = url.pathname.replace('/api/preview/', '');
      const html = await convertMarkdownToHtml(filename);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (url.pathname === '/' || url.pathname === '/preview.html') {
      // 프리뷰 페이지 반환
      const previewPath = path.join(projectRoot, 'preview.html');
      const html = await fs.readFile(previewPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (error) {
    console.error('서버 에러:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`🚀 프리뷰 서버가 시작되었습니다!`);
  console.log(`📖 브라우저에서 http://localhost:${PORT} 를 열어주세요`);
  console.log(`📁 src 디렉토리의 마크다운 파일들을 프리뷰할 수 있습니다`);
  console.log(`\n사용법:`);
  console.log(`1. 브라우저에서 http://localhost:${PORT} 접속`);
  console.log(`2. 드롭다운에서 해설 파일 선택`);
  console.log(`3. "프리뷰 로드" 버튼 클릭`);
  console.log(`\n서버를 중지하려면 Ctrl+C를 누르세요`);
});

// 에러 처리
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ 포트 ${PORT}이 이미 사용 중입니다. 다른 포트를 사용하거나 기존 프로세스를 종료하세요.`);
  } else {
    console.error('서버 에러:', error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 프리뷰 서버를 종료합니다...');
  server.close(() => {
    console.log('✅ 서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});
