# 3CH - 스포츠 리그 관리 플랫폼

탁구, 배드민턴, 테니스 등 다양한 스포츠를 기반으로 한 스포츠 플랫폼 서비스입니다.
그룹 생성, 리그 운영, 참가자 관리, 경기 진행, 추첨 기능을 제공합니다. (현 시점은 탁구 중점)

---

## 🌐 Web (Frontend)

- Framework: React 19 + TypeScript + Vite 7
- Routing: React Router 7 (SPA)
- UI: MUI (Material UI) 7 + 모바일 앱 느낌 레이아웃 (모바일 폭 고정, 하단 탭, 카드 UI)
- State: Redux Toolkit (RTK) + RTK Query
- HTTP Client: Axios
- Rich Text Editor: Tiptap 3
- Drag & Drop: @dnd-kit
- Chart: Recharts
- QR Code: react-qr-code
- PWA: 홈 화면 추가, 아이콘/스플래시 지원 + 서비스워커/푸시 알림 연동
- 역할별 화면 구조: 게스트 / 사용자(참가자) / 관리자
- 주요 화면: 홈, 로그인/회원가입, 리그 생성 위자드, 리그 상세/대진표, 클럽 관리, 랭킹, 추첨, 마이페이지, 관리자 페이지
- API 연동: `VITE_API_BASE_URL` 기반 호출 + JWT 토큰 자동 헤더 주입
- 배포: GitHub Actions (main 브랜치 push 시 자동 빌드 + 서버 업로드)
- 수동 배포: `deploy-web.ps1` (로컬 빌드 후 SCP 업로드)

📁 위치: `/3ch-web`

---

## 🔌 API (Backend)

- Runtime: Node.js
- Framework: Express 5
- DB: PostgreSQL + Prisma 7 ORM
- Authentication: Passport.js (Google, Kakao, Naver OAuth) + JWT (jsonwebtoken)
- Validation: Zod
- Security: bcrypt, cors
- File Upload: Multer (`/uploads`)
- Password: bcrypt
- API Documentation: Swagger UI (`/swagger`)
- Push Notification: Web Push (`VAPID_*` 환경 변수 사용)
- OMR Scanner: Python 스크립트 연동 (`scripts/omr_scan.py`)
- 라우트 구성: auth / league / group / draw / admin / board / notice / inquiry / payment / user
- Nginx `/api` 경로로 리버스 프록시 연결
- 배포: GitHub Actions (main 브랜치 push 시 자동 git pull + npm ci + prisma migrate + pm2 restart)

📁 위치: `/3ch-api`

---

## 🗄️ Database Schema

### Models
- **User**: 사용자 정보 (이메일, 소셜 로그인, 관리자 여부, 멤버 코드, 환경설정)
- **Group**: 그룹 정보 (이름, 종목, 지역, 위치 좌표, 주소, 클럽 코드)
- **GroupMember**: 그룹 멤버 (역할: owner / admin / member, 부수)
- **GroupRanking / GroupRankingEvent**: 그룹 내 레이팅 랭킹 및 변동 이력
- **SportRanking / SportRankingEvent**: 종목별 통합 레이팅 랭킹 및 변동 이력
- **League**: 리그 정보 (이름, 종목, 날짜, 형식, 규칙, 상태, 참가 허용 범위, 리그 코드)
- **LeagueParticipant**: 리그 참가자 (부수, 납부 여부, 도착 여부, 정렬 순서)
- **LeagueMatch**: 리그 경기 (참가자 A/B, 점수, 코트, 상태)
- **Team**: 팀 정보 (리그 소속)
- **Player**: 선수 정보 (팀 소속)
- **Match**: 팀 경기 정보 (홈팀, 원정팀, 점수)
- **Draw**: 추첨 정보 (리그 소속, 추첨 코드)
- **DrawPrize**: 추첨 상품 (이름, 수량, 순서)
- **DrawWinner**: 추첨 당첨자 (참가자 이름, 부수)

자세한 스키마: `3ch-api/prisma/schema.prisma`

---

## 🚀 Deployment Overview

### 자동 배포 (GitHub Actions)

- **Frontend** (`deploy-web.yml`)
  - `main` 브랜치의 `3ch-web/**` 변경 시 트리거
  - GitHub Actions에서 빌드 → AWS EC2 서버에 SCP 업로드 → Nginx 재로드

- **Backend** (`deploy-api.yml`)
  - `main` 브랜치의 `3ch-api/**` 변경 시 트리거
  - EC2 서버에서 git pull → npm ci → prisma migrate deploy → PM2 restart
  - OMR 스캐너 사용을 위해 Python venv 및 `requirements-omr.txt` 설치 포함

### 수동 배포 (Frontend)

```powershell
# 3ch-web/deploy-web.ps1
# 로컬 빌드 후 SCP로 서버 업로드 + Nginx 재로드
```

### 인프라

- 서버: AWS EC2 (Ubuntu)
- 웹 서버: Nginx
  - Frontend: `/var/www/3ch` 정적 서빙
  - Backend: `/api` 리버스 프록시 → Express (포트 3000)
- 프로세스: PM2 (`3ch-api`)

> ⚠️ API 소스 코드는 서버에 직접 존재 (git pull 방식)
> Frontend는 **빌드 산출물만** 서버에 업로드

---

## 🌱 Branch Strategy (Simple)

- `dev` : 기본 작업 브랜치
- `main` : 배포 기준 브랜치 (push 시 GitHub Actions 자동 배포 트리거)
- PR/MR 사용하지 않음 (소규모 팀 기준)

---

## 👥 Collaboration Rules

- 기본 브랜치는 `dev`
- 배포 시에만 `dev → main` 머지
- build / dist 결과물은 Git에 포함하지 않음 (`.gitignore` 설정)

---

## 🔧 Troubleshooting

### Frontend
- **CORS 에러**: `.env`에서 `VITE_API_BASE_URL` 확인
- **빌드 실패**: `node_modules` 삭제 후 `npm install` 재실행
- **환경 변수 미적용**: `.env.test` 또는 `.env.production` 파일 확인
- **GitHub Actions 빌드 실패**: Repository Secrets (`EC2_HOST`, `EC2_USER`, `EC2_PEM_KEY`) 확인
- **소셜 로그인 실패**: `VITE_KAKAO_JS_KEY`, OAuth 콜백 URL, `VITE_APP_URL` 설정 확인
- **푸시 알림 동작 안함**: `VITE_VAPID_PUBLIC_KEY` 설정 및 브라우저 권한 확인

### Backend
- **데이터베이스 연결 실패**: `.env`의 DB 정보 (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) 확인
- **마이그레이션 오류**: `npm run db:dev` 또는 `npm run db:migrate` 실행
- **PM2 프로세스 종료**: `pm2 restart 3ch-api`
- **포트 충돌**: 3000번 포트 사용 여부 확인
- **OAuth 콜백 오류**: `FRONTEND_URL`, 각 OAuth Client ID/Secret/Callback URL 확인
- **OMR 스캔 실패**: `OMR_PYTHON_BIN`, `OMR_PYTHON_SCRIPT`, Python 의존성 설치 여부 확인

### Nginx
- **502 Bad Gateway**: Express 서버 실행 여부 확인 (`pm2 list`)
- **404 Not Found**: nginx 설정 파일 확인 및 재시작 (`sudo systemctl restart nginx`)
- **타임아웃**: 방화벽 (ufw) 및 AWS 보안 그룹에서 80번 포트 확인

---

## 📌 Notes

- 본 프로젝트는 현재 창업 준비 단계
- 구조 안정화 및 MVP 개발이 1차 목표
- Web 라우트 기준 주요 도메인: 리그, 클럽, 랭킹, 추첨, 마이페이지, 관리자
- API는 `/api` prefix 기반이며 Swagger는 `/swagger`에서 확인 가능
- 일부 게시판/랭킹 관련 테이블과 컬럼은 앱 시작 시 보정 SQL로 추가 점검됨
