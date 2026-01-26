
---

## 🌐 Web (Frontend)

- Framework: React + TypeScript + Vite
- Routing: React Router (SPA)
- UI: MUI(Material UI) + 모바일 앱 느낌 레이아웃(모바일 폭 고정, 하단 탭, 카드 UI)
- State: Redux Toolkit(RTK) + RTK Query
- PWA: 홈 화면 추가, 아이콘/스플래시 지원
- 역할별 화면 구조: 게스트 / 사용자(참가자) / 관리자
- 배포: 빌드 결과물(dist)을 서버에서 정적 서빙 (Nginx 등)

📁 위치: `/3ch-web`

---

## 🔌 API (Backend)

- Runtime: Node.js
- Framework: Express
- DB: PostgreSQL
- Nginx `/api` 경로로 리버스 프록시 연결

📁 위치: `/3ch-api`

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
- build / dist 결과물은 Git에 포함하지 않음

---

## 📌 Notes

- 본 프로젝트는 현재 창업 준비 단계
- 구조 안정화 및 MVP 개발이 1차 목표
