# explanation (private) — Pages 배포 + QR 자동 생성 템플릿

이 레포는 **프라이빗 단일 리포**에서 바로 GitHub Pages로 배포하면서,
해설은 **AES-GCM으로 암호화**하고, 각 문항별 **QR 코드**를 자동 생성합니다.
문항 파일명 규칙은 **YYYYMMDD.md** 입니다. (예: `20240621.md`)

## 빠른 시작

1. **Secrets 등록**
   - 레포 Settings → Secrets and variables → Actions → New repository secret
   - `SECRET_KEY` 값: `openssl rand -hex 32` 로 생성한 긴 랜덤 문자열

2. **최초 실행 (GitHub Actions)**
   - `main` 푸시 또는 Actions 탭에서 `Build (Private Repo) & Deploy Pages + QR` 수동 실행
   - 첫 실행 시 `scripts/seed_src.mjs`가 기본 범위(2022~2026, 03~11, 01~30)로 `src/*.md`를 만들어 줍니다.
     - 이미 존재하는 파일은 건너뜁니다.
     - 범위를 커스터마이즈하려면 로컬에서:  
       `node scripts/seed_src.mjs --yStart 2022 --yEnd 2026 --mStart 3 --mEnd 11 --dStart 1 --dEnd 30`

### 3. 문항 시드 파일 생성 (최초 1회)
기본 범위: 2022~2026년, 3~11월, 1~30일  
```bash
npm run seed
```
- 기존에 있는 파일은 덮어쓰지 않습니다.
- 범위를 바꾸려면 예:  
  ```bash
  node scripts/seed_src.mjs --yStart 2024 --yEnd 2024 --mStart 6 --mEnd 6 --dStart 1 --dEnd 15
  ```

---

### 4. 빌드 & QR 생성
```bash
SECRET_KEY="내랜덤키" BASE_URL="https://keyhoney.github.io/explanation/" npm run build
npm run qr
```

- `dist/` : 암호화된 사이트 산출물 (GitHub Pages로 배포)
- `qr_out/` : QR PNG + URL 목록 (웹에는 안 올라감, Actions 아티팩트로 제공)

---

### 5. GitHub Actions 자동 배포
`main` 브랜치에 푸시하면 Actions가 자동 실행됩니다.

- **사이트**: `https://keyhoney.github.io/explanation`
- **QR 아티팩트**: Actions 실행 → `qr-codes` 다운로드  

파일:
- `qr_out/qr-urls.csv` → [q, sig, k, url, source]
- `qr_out/qr-*.png` → 각 문항별 QR 코드 이미지

---

## 파일 구조
```
src/            # Markdown 해설 원본 (YYYYMMDD.md)
scripts/        # 빌드/QR/시드 스크립트
dist/           # 암호화된 사이트(자동 생성, gitignore)
qr_out/         # QR 코드 산출물(자동 생성, gitignore)
.github/workflows/deploy.yml  # Pages + QR 아티팩트 워크플로
package.json
dist.index.template.html       # index.html 템플릿 (MathJax 포함)
dist/js/app.js                 # 클라이언트 복호화 스크립트
```

---


3. **결과물**
   - **사이트**: `https://keyhoney.github.io/explanation` (Actions가 `dist/`만 배포)
   - **QR 아티팩트**: Actions 실행 상세 → `qr-codes` 다운로드
     - `qr_out/qr-urls.csv`: [q, sig, k, url, source]
     - `qr_out/qr-*.png`: 각 문항별 QR 이미지

## 개발자 노트

- `scripts/build.mjs`
  - `src/*.md` → Markdown을 HTML 변환 후 **AES-GCM 암호화**
  - `manifest.json`에는 `q`(문항코드), `sig`(HMAC 서명), `path`(blob 경로)만 포함
  - `k`(복호화 키)는 QR URL fragment에만 포함되어 서버/로그에 남지 않습니다.

- `scripts/gen_qr.mjs`
  - `qr_out/qr-urls.csv`를 읽어 QR PNG를 만듭니다.

- `dist/js/app.js`
  - URL의 `#q`,`#sig`,`#k`를 읽고, 매니페스트 검증 후 blob 복호화/렌더링
  - MathJax가 `$...$`, `$$...$$` 수식을 렌더링합니다.

- 배포 도메인(BASE_URL)
  - 기본값: `https://keyhoney.github.io/explanation/`
  - 다른 도메인으로 바꾸려면 Actions에서 `BASE_URL` 환경변수 지정

## 보안 설계
1. **비가시 탐색 차단**  
   - manifest.json에는 `q`, `sig`, `path`만 노출  
   - 무작위 blob 경로 + HMAC 서명 검증  

2. **추측/조작 방지**  
   - URL 파라미터(q,sig) 조작 시 매니페스트 검증 실패 → 접근 차단

3. **내용 노출 방지**  
   - 해설 본문은 AES-GCM 암호화 후 배포  
   - 복호화 키는 QR 코드 URL fragment에만 포함 → 서버/로그 노출 없음

---

## 문항 수정 / 폐기
- 문항 수정 시 새 `(sig, k)`가 발급됩니다.
- QR 코드 폐기: manifest.json 생성 로직에서 해당 항목 제거 후 재배포

---

## 로컬 개발 팁
- 수식은 `$...$`, `$$...$$` 로 Markdown에 직접 작성
- MathJax는 index.html에 이미 포함되어 있음
- QR PNG에 문항 코드 캡션 추가 가능(원하면 `gen_qr.mjs` 수정)

---


## 주의

- 이 레포는 **Private** 이어야 합니다. Pages는 Actions 아티팩트의 `dist/`만 공개합니다.
- 원본 Markdown은 절대 다른 Public 레포로 커밋하지 마세요.
- 특정 문항을 만료시키고 싶으면 `dist/data/manifest.json` 생성 로직에서 해당 `q`를 제거하고 재배포하세요.