# 3ch API (Backend)

3ch는 탁구, 배드민턴, 테니스 등 다양한 스포츠를 기반으로 한
스포츠 플랫폼 서비스를 목표로 하는 프로젝트입니다.

---

## 🛠 사용 기술 스택

- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: PostgreSQL
- **DB Migration**: Prisma 7 (마이그레이션 CLI 전용, 런타임은 raw `pg` 사용)
- **Authentication**: Passport.js (Google, Kakao, Naver OAuth) + JWT (jsonwebtoken)
- **Validation**: Zod (한글 에러 메시지)
- **Security**: bcrypt, cors
- **File Upload**: Multer (`/uploads`)
- **API Documentation**: Swagger UI (`/swagger`)
- **Push Notification**: web-push
- **OMR Scanner**: Python 스크립트 연동
- **Process Manager**: PM2

---

## 🧱 프로젝트 구조

```
3ch-api/
├─ prisma/
│  ├─ schema.prisma      # DB 스키마
│  └─ migrations/
│
├─ src/
│  ├─ config/            # Passport, Swagger 설정
│  ├─ db/                # DB 연결
│  ├─ middlewares/       # auth, permissions
│  ├─ routes/            # API 라우트
│  │  ├─ auth.js
│  │  ├─ group.js
│  │  ├─ league.js
│  │  ├─ draw.js
│  │  ├─ admin.js
│  │  ├─ board.js
│  │  ├─ notice.js
│  │  ├─ inquiry.js
│  │  ├─ payment.js
│  │  ├─ user.js
│  │  ├─ policy.js
│  │  └─ index.js
│  ├─ services/          # ranking, OMR
│  ├─ utils/
│  └─ server.js          # 엔트리 포인트
│
├─ scripts/              # OMR Python 스크립트 및 requirements
├─ uploads/              # 업로드된 파일 저장소
├─ prisma.config.ts
└─ package.json
```

---

## ⚙️ 프로젝트 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다.

```dotenv

# Server Port
PORT=3000

# DB
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=

# JWT Secret
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN=7d

# OAuth Callback URLs
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_CALLBACK_URL=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_CALLBACK_URL=

FRONTEND_URL=http://localhost:5173

# External integrations
KAKAO_REST_API_KEY=
TOSS_SECRET_KEY=

# Push notification
VAPID_MAILTO=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# OMR scanner
OMR_PYTHON_BIN=
OMR_PYTHON_SCRIPT=
OMR_SCANNER_TIMEOUT_MS=30000
```

### 3. 데이터베이스 마이그레이션

```bash
# 개발 환경
npm run db:dev

# 프로덕션 환경
npm run db:migrate

# Prisma Studio (데이터 확인)
npm run db:studio
```

---

## 🚀 실행

```bash
# 개발 (nodemon - 파일 변경 시 자동 재시작)
npm run dev

# 프로덕션
npm start
```

기본 포트는 `3000`입니다.

---

## 🚀 배포 (Deployment)

### 자동 배포 (GitHub Actions)

`main` 브랜치의 `3ch-api/**` 변경 시 자동 실행:

1. AWS EC2 서버에 SSH 접속
2. `git pull origin main`
3. `npm ci --omit=dev`
4. `npx prisma migrate deploy`
5. `python3 -m venv .venv-omr`
6. `.venv-omr/bin/python -m pip install -r scripts/requirements-omr.txt`
7. `OMR_PYTHON_BIN=$PWD/.venv-omr/bin/python pm2 restart 3ch-api --update-env`

OMR Python scanner environment variables:

```dotenv
OMR_PYTHON_BIN=/opt/3ch-api/3ch-project/3ch-api/.venv-omr/bin/python
OMR_PYTHON_SCRIPT=/opt/3ch-api/3ch-project/3ch-api/scripts/omr_scan.py
OMR_SCANNER_TIMEOUT_MS=30000
```

> API 소스 코드는 서버에 직접 존재 (git pull 방식)

### 인프라

- 서버: AWS EC2 (Ubuntu)
- 웹 서버: Nginx (`/api` 경로 → Express 포트 3000 리버스 프록시)
- 프로세스: PM2 (`3ch-api`)

---

## 📚 API 문서

Swagger UI로 확인:

- **개발**: `http://localhost:3000/swagger`
- **프로덕션**: `https://your-domain/swagger`

주요 라우트 영역:

- `/api/auth/*`: 로그인, 회원가입, 소셜 로그인, 내 정보, 회원 수정/탈퇴
- `/api/league*`: 리그/참가자/매치/OMR
- `/api/group*`: 클럽/멤버/랭킹
- `/api/draw/*`: 추첨
- `/api/payment/*`: 결제/구독
- `/api/user/me/*`: 사용자 환경설정, 홈 요약, 푸시 구독, 종목 랭킹
- `/api/notices`, `/api/faqs`, `/api/guides`, `/api/inquiries*`, `/api/policies/*`
- `/api/admin/*`, `/api/admin/board/*`: 관리자/게시판 관리

---

## 🔧 문제 해결 (Troubleshooting)

### 데이터베이스 연결 실패
- `.env` 파일의 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` 확인
- PostgreSQL 서버 실행 상태 확인

### 마이그레이션 오류
```bash
npm run db:dev

# Prisma 클라이언트 재생성
npx prisma generate
```

### PM2 프로세스 문제
```bash
pm2 list
pm2 logs 3ch-api --lines 100
pm2 restart 3ch-api
```

### 포트 충돌
```bash
# 3000번 포트 사용 프로세스 확인
lsof -i :3000
```

### OAuth 콜백 오류
- 각 OAuth 제공자 콘솔에서 Callback URL 설정 확인
- `.env` 파일의 Client ID/Secret 및 `FRONTEND_URL` 값 확인

### OMR 스캔 실패
- `OMR_PYTHON_BIN`, `OMR_PYTHON_SCRIPT` 경로 확인
- `scripts/requirements-omr.txt` 설치 여부 확인
- Python 실행 권한 및 timeout 설정 확인

---

## 📌 참고사항

- 모든 API 엔드포인트는 `/api` prefix 사용
- 인증이 필요한 API는 `Authorization: Bearer <token>` 헤더 필요
- Zod 검증 에러는 한글로 반환
- 프로덕션 환경에서는 반드시 `.env`의 시크릿 값 변경 필요
- 앱 시작 시 공지/FAQ/가이드/랭킹 관련 테이블과 컬럼 보정 SQL이 추가 실행됨
- 런타임 쿼리는 Prisma Client가 아니라 `pg` 기반으로 작성되어 있음
