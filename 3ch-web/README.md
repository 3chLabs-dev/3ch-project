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
│ ├─ manifest.json
│ └─ assets/
│
├─ src/
│ ├─ components/ # 공통 UI 컴포넌트
│ ├─ pages/ # 탭/페이지 단위 화면
│ │ ├─ Tab1.tsx
│ │ ├─ Tab2.tsx
│ │ ├─ Tab3.tsx
│ │ ├─ Tab4.tsx
│ │ └─ Tab5.tsx
│ │
│ ├─ theme/ # Ionic 테마 설정
│ ├─ App.tsx # 탭/라우팅 중심 파일
│ ├─ index.tsx # 엔트리 포인트
│ └─ react-app-env.d.ts
│
├─ .eslintrc.js
├─ ionic.config.json
├─ package.json
├─ tsconfig.json
└─ README.md
```
---

## 🛠 사용 기술 스택

### Frontend
- Ionic React
- React + Vite (빠른 개발 환경과 경량 빌드)
- SPA 구조
- 하단 탭 기반 네비게이션
- 역할별 화면 구성 예정 (게스트 / 참가자 / 관리자)
---

## 📂 브랜치 / 협업 규칙 (초기)

- 기본 작업 브랜치는 dev
- 배포 시에만 dev → main 머지
- build 결과물은 Git에 포함하지 않음

---

## ⚠️ 기타
- 본 저장소는 현재 Private 상태
- 외부 공개는 서비스 안정화 이후 검토 예정