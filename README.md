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
- PWA: 홈 화면 추가, 아이콘/스플래시 지원
- 역할별 화면 구조: 게스트 / 사용자(참가자) / 관리자
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
- Security: Helmet
- File Upload: Multer (`/uploads`)
- Password: bcrypt
- Logging: Morgan
- API Documentation: Swagger UI (`/swagger`)
- Process Manager: PM2
- Nginx `/api` 경로로 리버스 프록시 연결
- 배포: GitHub Actions (main 브랜치 push 시 자동 git pull + npm ci + prisma migrate + pm2 restart)

📁 위치: `/3ch-api`

---

## 🗄️ Database Schema

### Models
- **User**: 사용자 정보 (이메일, 소셜 로그인, 관리자 여부, 멤버 코드)
- **Group**: 그룹 정보 (이름, 종목, 지역, 위치 좌표)
- **GroupMember**: 그룹 멤버 (역할: owner / admin / member, 부수)
- **League**: 리그 정보 (이름, 종목, 날짜, 형식, 규칙, 상태)
- **LeagueParticipant**: 리그 참가자 (부수, 납부 여부, 도착 여부)
- **LeagueMatch**: 리그 경기 (참가자 A/B, 점수, 코트, 상태)
- **Team**: 팀 정보 (리그 소속)
- **Player**: 선수 정보 (팀 소속)
- **Match**: 팀 경기 정보 (홈팀, 원정팀, 점수)
- **Draw**: 추첨 정보 (리그 소속)
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
  - EC2 서버에서 git pull → npm ci → prisma migrate deploy → pm2 restart

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

### Backend
- **데이터베이스 연결 실패**: `.env`의 DB 정보 확인
- **마이그레이션 오류**: `npm run db:dev` 실행
- **PM2 프로세스 종료**: `pm2 restart 3ch-api`
- **포트 충돌**: 3000번 포트 사용 여부 확인

### Nginx
- **502 Bad Gateway**: Express 서버 실행 여부 확인 (`pm2 list`)
- **404 Not Found**: nginx 설정 파일 확인 및 재시작 (`sudo systemctl restart nginx`)
- **타임아웃**: 방화벽 (ufw) 및 AWS 보안 그룹에서 80번 포트 확인

---

## 📌 Notes

- 본 프로젝트는 현재 창업 준비 단계
- 구조 안정화 및 MVP 개발이 1차 목표
