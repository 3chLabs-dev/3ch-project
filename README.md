# 3ch Project

3CH는 탁구, 테니스 등 다양한 스포츠를 기반으로 한  
스포츠 플랫폼 서비스를 목표로 하는 프로젝트입니다.

현재는 창업 준비 단계로, 서비스 기획과 기술 검증을 함께 진행하고 있습니다.

---

## 📌 프로젝트 목표
- 여러 종목의 스포츠를 하나의 플랫폼에서 다루는 구조
- 종목별이 아닌 **공통 기능 + 스포츠 타입 확장** 방식
- 초기에는 소규모, 이후 확장 가능한 아키텍처 지향

---

## 🧱 프로젝트 구조(미정)
```
3ch-project/
├─ frontend/ # React 프론트엔드
├─ backend/ # Node.js + Express API 서버
├─ infra/ # 인프라 설정 및 문서 (Nginx, 배포 관련)
├─ README.md
└─ .gitignore
```
---

## 🛠 사용 기술 스택

### Frontend
- React
- SPA 구조
- 빌드 결과를 Nginx에서 정적 서빙

### Backend
- Node.js
- Express
- PM2를 통한 프로세스 관리

### Database
- PostgreSQL

### Infrastructure
- AWS EC2 (Ubuntu)
- Nginx (Reverse Proxy)
- HTTPS

---

## 🚀 배포 방식

- 프론트엔드
  - 로컬에서 build 후
  - build 결과물만 서버 `/var/www`에 업로드

- 백엔드
  - PM2로 실행 및 자동 재시작
  - `/api` 경로로 Nginx 프록시 연결

---

## 📂 브랜치 / 협업 규칙 (초기)

- `main` : 배포 기준 브랜치
- 필요 시 기능별 브랜치 추가
- build 결과물은 Git에 포함하지 않음

---

## ⚠️ 기타
- 본 저장소는 현재 Private 상태
- 외부 공개는 서비스 안정화 이후 검토 예정
