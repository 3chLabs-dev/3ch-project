# 3ch Web (Fronted)

3ch는 탁구, 배드민턴, 테니스 등 다양한 스포츠를 기반으로 한  
스포츠 플랫폼 서비스를 목표로 하는 프로젝트입니다.

현재는 창업 준비 단계로, 서비스 기획과 기술 검증을 함께 진행하고 있습니다.

---

## 📌 프로젝트 목표
- 모임이나 리그 관리자가 생활체육리그를 효율적으로 운영할 수 있는 환경 마련
- 스포츠와 디지털 기술의 접목으로 생활체육 저변 확대
- 여러 종목의 스포츠를 하나의 플랫폼에서 다루는 구조
- 종목별이 아닌 **공통 기능 + 스포츠 타입 확장** 방식
- 초기에는 소규모, 이후 확장 가능한 아키텍처 지향

---

## 🧱 프로젝트 구조(미정)
```
3ch-web/
├─ public/
│ ├─ index.html
│ ├─ pwa-192.png
│ ├─ pwa-512.png
│ └─ pwa-512-maskable.png (Exam...)
│
├─ src/
│ ├─ app/            # Redux store / 공통 hooks
│ ├─ features/       # 도메인별 상태 / API (RTK Query)
│ ├─ components/     # 공통 UI 컴포넌트 (Layout, Tab 등)
│ ├─ pages/          # 라우트 단위 페이지
│ ├─ routes/         # 라우터 설정
│ ├─ theme/          # MUI Theme 설정
│ ├─ main.tsx        # 엔트리 포인트
│ └─ vite-env.d.ts
│
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
└─ README.md
```
---

## 🛠 사용 기술 스택

### Frontend
- React + TypeScript
- Vite (빠른 개발 환경 및 경량 빌드)
- React Router (SPA 라우팅)
- Redux Toolkit (RTK)
- RTK Query (서버 상태 관리)
- MUI(Material UI) – 빠른 MVP UI 구성
- PWA (아이콘, 스플래시, 홈 화면 추가 지원)
---

## 📂 브랜치 / 협업 규칙 (초기)

- 기본 작업 브랜치는 dev
- 배포 시에만 dev → main 머지
- build 결과물은 Git에 포함하지 않음

---

## ⚠️ 기타
- 본 저장소는 현재 Private 상태
- 외부 공개는 서비스 안정화 이후 검토 예정