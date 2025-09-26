#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
해설 프리뷰 서버
사용법: python preview_server.py
"""

import http.server
import socketserver
import json
import os
import re
from urllib.parse import urlparse, parse_qs
import markdown

# 설정
PORT = 3000
SRC_DIR = 'src'

class PreviewHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        try:
            if path == '/api/files':
                # 마크다운 파일 목록 반환
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                files = []
                if os.path.exists(SRC_DIR):
                    for file in os.listdir(SRC_DIR):
                        if file.endswith('.md'):
                            files.append(file)
                
                self.wfile.write(json.dumps(files).encode('utf-8'))
                
            elif path.startswith('/api/preview/'):
                # 특정 파일 프리뷰
                filename = path.replace('/api/preview/', '')
                filepath = os.path.join(SRC_DIR, filename)
                
                if os.path.exists(filepath):
                    with open(filepath, 'r', encoding='utf-8') as f:
                        markdown_content = f.read()
                    
                    # 이미지 경로 수정 (./img/로 변경)
                    markdown_content = re.sub(r'src="/src/img/', 'src="./img/', markdown_content)
                    markdown_content = re.sub(r'src="src/img/', 'src="./img/', markdown_content)
                    
                    # 마크다운을 HTML로 변환
                    html = markdown.markdown(
                        markdown_content,
                        extensions=['codehilite', 'fenced_code', 'tables', 'toc']
                    )
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html; charset=utf-8')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(html.encode('utf-8'))
                else:
                    self.send_error(404, f"File not found: {filename}")
                    
            elif path.startswith('/img/'):
                # 이미지 파일 서빙
                img_filename = path.replace('/img/', '')
                img_path = os.path.join(SRC_DIR, 'img', img_filename)
                
                if os.path.exists(img_path):
                    # 이미지 파일 확장자에 따른 MIME 타입 설정
                    ext = os.path.splitext(img_filename)[1].lower()
                    mime_types = {
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif',
                        '.svg': 'image/svg+xml'
                    }
                    content_type = mime_types.get(ext, 'application/octet-stream')
                    
                    with open(img_path, 'rb') as f:
                        img_data = f.read()
                    
                    self.send_response(200)
                    self.send_header('Content-type', content_type)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(img_data)
                else:
                    self.send_error(404, f"Image not found: {img_filename}")
                    
            elif path == '/' or path == '/preview.html':
                # 프리뷰 페이지 반환
                if os.path.exists('preview.html'):
                    with open('preview.html', 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(content.encode('utf-8'))
                else:
                    self.send_error(404, "preview.html not found")
            else:
                # 정적 파일 서빙
                super().do_GET()
                
        except Exception as e:
            print(f"Error handling {path}: {e}")
            self.send_error(500, f"Internal server error: {str(e)}")

def main():
    # src 디렉토리 확인
    if not os.path.exists(SRC_DIR):
        print(f"❌ {SRC_DIR} 디렉토리가 없습니다.")
        return
    
    # 서버 시작
    with socketserver.TCPServer(("", PORT), PreviewHandler) as httpd:
        print(f"🚀 프리뷰 서버가 시작되었습니다!")
        print(f"📖 브라우저에서 http://localhost:{PORT} 를 열어주세요")
        print(f"📁 {SRC_DIR} 디렉토리의 마크다운 파일들을 프리뷰할 수 있습니다")
        print(f"\n사용법:")
        print(f"1. 브라우저에서 http://localhost:{PORT} 접속")
        print(f"2. 드롭다운에서 해설 파일 선택")
        print(f"3. '프리뷰 로드' 버튼 클릭")
        print(f"\n서버를 중지하려면 Ctrl+C를 누르세요")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 프리뷰 서버를 종료합니다...")
            print("✅ 서버가 정상적으로 종료되었습니다.")

if __name__ == "__main__":
    main()
