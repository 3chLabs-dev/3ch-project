# 3ch Web

우리리그 웹 프론트엔드입니다. 모바일 화면 폭을 기준으로 한 SPA/PWA이며, `3ch-api`의 `/api` 엔드포인트를 사용합니다.

---

## 보안 원칙

- README에는 실제 도메인, 서버 IP, 키, 토큰, 원격 경로를 남기지 않습니다.
- 실제 값은 `.env`, `.env.production`, GitHub Secrets, 서버 환경 변수에서 관리합니다.
- `.env*` 파일은 Git에 커밋하지 않습니다.

---

## 기술 스택

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Routing**: React Router 7
- **State**: Redux Toolkit + RTK Query
- **UI**: MUI 7
- **Editor**: Tiptap 3
- **Payment**: Payments SDK
- **PWA**: vite-plugin-pwa
- **Charts**: Recharts
- **Drag and Drop**: dnd-kit
- **QR**: react-qr-code
- **Capture/Effects**: html2canvas, canvas-confetti

---

## 폴더 구조

```text
3ch-web/
├─ public/              # PWA 아이콘, 정적 파일
├─ src/
│  ├─ app/              # Redux store/hooks
│  ├─ assets/           # 이미지, 로고
│  ├─ components/       # AppShell, BottomTab, 공통 UI
│  ├─ features/         # RTK Query API와 slice
│  ├─ hooks/            # push, support chat socket 등
│  ├─ pages/            # 라우트 단위 페이지
│  ├─ routes/           # React Router 설정
│  ├─ theme/            # MUI theme
│  ├─ utils/            # 권한, sanitizing 등
│  ├─ main.tsx
│  └─ sw.ts             # PWA service worker
├─ deploy-web.ps1
├─ vite.config.ts
├─ package.json
└─ README.md
```

---

## 환경 변수

`.env` 또는 `.env.production`에 설정합니다. 값은 로컬/배포 환경에서만 채웁니다.

```dotenv
VITE_API_BASE_URL=<API_BASE_URL>
VITE_APP_URL=<WEB_APP_URL>

VITE_GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
VITE_KAKAO_JS_KEY=<KAKAO_JS_KEY>
VITE_TOSS_CLIENT_KEY=<PAYMENT_CLIENT_KEY>
VITE_VAPID_PUBLIC_KEY=<VAPID_PUBLIC_KEY>
```

---

## 설치 및 실행

```powershell
npm install
npm run dev
```

기본 개발 서버는 Vite이며 `--host` 옵션으로 실행됩니다.

---

## 주요 명령어

```powershell
npm run dev        # 개발 서버
npm run build      # 기본 빌드
npm run build:test # test mode 빌드
npm run build:prod # production mode 빌드
npm run lint       # ESLint
npm run preview    # Vite preview
```

---

## 주요 화면

### 사용자

- 홈: 나의 조편성, 경기, 당첨 내역 요약
- 로그인/회원가입: 이메일, Google, Kakao, Naver
- 소셜 추가 가입: OAuth ticket 기반 추가 정보 입력
- 클럽: 생성, 검색, 추천, 상세, 관리, 회원 관리
- 클럽 순위: 클럽별 랭킹, 랭킹 상세, 회원별 랭킹/리그 이력
- 리그·대회: 생성 wizard, 상세, 참가자 관리, 경기 진행
- 조편성/대진표: bracket, tournament, match order
- OMR: 리그 점수 입력지/스캔 화면
- 추첨: 리그별 추첨 생성, 실행, 결과 확인
- 마이페이지: 정보수정, 설정, 공지, FAQ, 이용방법, 문의, 약관, 개인정보 처리방침
- 요금제/결제: 결제 checkout, 성공/실패 페이지
- 채팅 문의: 사용자 플로팅 채팅

### 관리자

- 관리자 로그인
- 대시보드
- 회원 관리
- 클럽 관리
- 리그 관리
- 대회 관리
- 추첨 관리
- 순위 관리
- 채팅 상담
- 공지사항, FAQ, 1:1 문의, 이용방법, 약관, 개인정보 처리방침 관리

---

## 라우트 개요

주요 라우트는 `src/routes/index.tsx`에 정의되어 있습니다.

- `/`
- `/login`, `/signup`, `/social-signup`
- `/league`, `/league/:id`, `/league/:id/bracket`, `/league/:id/omr`
- `/league/:id/tournament/*`
- `/club`, `/club/create`, `/club/:id`, `/club/:id/manage`
- `/club/:id/ranking/*`
- `/draw`, `/draw/:leagueId`, `/draw/:leagueId/:drawId`
- `/ranking`, `/ranking/sport/:sport`
- `/mypage/*`
- `/payment/checkout`, `/payment/success`, `/payment/fail`
- `/admin/*`

---

## API 연동

RTK Query base API는 `src/features/api/baseApi.ts`에 있습니다.

- 기본 URL: `VITE_API_BASE_URL ?? "/api"`
- 로그인 토큰은 Redux auth state에서 읽어 `Authorization` 헤더로 자동 주입합니다.
- admin 화면 일부는 `localStorage.admin_token`을 직접 사용합니다.

---

## PWA

`vite.config.ts`에서 `VitePWA`를 사용합니다.

- `injectManifest` 전략
- service worker: `src/sw.ts`
- `/api`, `/swagger`, `robots.txt`, `sitemap.xml`은 PWA cache 대상에서 제외
- 앱 이름: 우리리그
- standalone 표시 모드

---

## 배포

### 자동 배포

`.github/workflows/deploy-web.yml`

`main` 브랜치에 `3ch-web/**` 변경이 push되면:

1. GitHub Actions에서 `npm ci`
2. `npm run build`
3. `dist/`를 원격 웹 루트로 업로드
4. 파일 권한 설정
5. Nginx reload
6. Discord 웹훅 결과 알림

### 수동 배포

```powershell
.\deploy-web.ps1
```

스크립트는 로컬에서 빌드한 뒤 원격 웹 루트로 업로드하고 Nginx를 reload합니다. 실제 PEM 경로, 서버 주소, 원격 경로는 스크립트나 환경별 비공개 설정에서만 관리합니다.

---

## 문제 해결

### CORS 오류

- `VITE_API_BASE_URL` 확인
- API 서버의 CORS origin 목록 확인

### 소셜 로그인 실패

- OAuth provider callback URL 확인
- `VITE_APP_URL` 확인
- OAuth client key 환경 변수 확인

### 결제 실패

- 결제 client key 환경 변수 확인
- API 서버의 결제 secret 환경 변수 확인
- checkout URL의 plan/amount/name query 확인

### 푸시 알림 실패

- `VITE_VAPID_PUBLIC_KEY` 확인
- 브라우저 알림 권한 확인
- API 서버 VAPID 설정 및 `/api/user/me/push-subscription` 동작 확인

### 운영 라우트 404

Nginx SPA fallback 설정이 필요합니다. 실제 웹 루트 경로는 환경별로 관리합니다.

```nginx
location / {
    root <WEB_ROOT>;
    try_files $uri $uri/ /index.html;
}
```
