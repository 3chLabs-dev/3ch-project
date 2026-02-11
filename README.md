
---

## 🌐 Web (Frontend)

- Framework: React 19 + TypeScript + Vite 7
- Routing: React Router 7 (SPA)
- UI: MUI (Material UI) 7 + 모바일 앱 느낌 레이아웃 (모바일 폭 고정, 하단 탭, 카드 UI)
- State: Redux Toolkit (RTK) + RTK Query
- HTTP Client: Axios
- PWA: 홈 화면 추가, 아이콘/스플래시 지원
- 역할별 화면 구조: 게스트 / 사용자(참가자) / 관리자
- 배포: 빌드 결과물(dist)을 서버에서 정적 서빙 (Nginx)

📁 위치: `/3ch-web`

---

## 🔌 API (Backend)

- Runtime: Node.js
- Framework: Express 5
- DB: PostgreSQL + Prisma 7 ORM
- Authentication: Passport.js (Google, Kakao, Naver OAuth)
- Validation: Zod
- API Documentation: Swagger UI (`/swagger`)
- Process Manager: PM2
- Nginx `/api` 경로로 리버스 프록시 연결

📁 위치: `/3ch-api`

---

## 🗄️ Database Schema

### Models
- **User**: 사용자 정보 (이메일, 소셜 로그인)
- **League**: 리그 정보 (이름, 종목, 날짜, 규칙, 상태)
- **Team**: 팀 정보 (리그 소속)
- **Player**: 선수 정보 (팀 소속)
- **Match**: 경기 정보 (홈팀, 원정팀, 점수)

자세한 스키마: `3ch-api/prisma/schema.prisma`

---

## 🚀 Deployment Overview

- Frontend
  - 로컬에서 build
  - build 결과물만 서버에 업로드

- Backend
  - PM2로 실행
  - 서버에서 상시 구동

> ⚠️ 소스 코드는 서버에 직접 배포하지 않음  
> 서버에는 **빌드 산출물만 존재**

---

## 🌱 Branch Strategy (Simple)

- `dev` : 기본 작업 브랜치
- `main` : 배포 기준 브랜치
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