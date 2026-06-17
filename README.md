# 3CH - 우리리그

탁구, 배드민턴, 테니스 등 생활체육 클럽의 리그·대회 운영을 돕는 서비스입니다.

하나의 저장소 안에 백엔드 API, 웹 프론트엔드, 모바일 앱이 함께 있습니다. 서버는 `3ch-api`가 담당하고, 웹(`3ch-web`)과 모바일(`3ch-mobile`)은 같은 API를 사용합니다.

---

## 프로젝트 구성

```text
3CH/
├─ 3ch-api/      # Express + PostgreSQL 백엔드
├─ 3ch-web/      # React + Vite 웹/PWA
├─ 3ch-mobile/   # Expo React Native 모바일 앱
├─ docs/         # 문서 자료
└─ .github/      # GitHub Actions 배포 워크플로우
```

---

## 서비스 범위

- 이메일 로그인/회원가입, Google/Kakao/Naver 소셜 로그인
- 클럽 생성, 검색, 가입, 탈퇴, 회원 관리
- 클럽별 순위와 종목별 통합 개인 순위
- 리그·대회 생성, 참가자 관리, 경기 진행, 점수 입력
- 조편성/대진표/토너먼트 운영
- OMR 이미지 스캔 기반 점수 입력 지원
- 리그별 추첨 생성, 실행, 결과 확인
- 요금제, 결제, 구독 조회
- 공지사항, FAQ, 이용방법, 문의, 약관, 개인정보 처리방침
- 채팅 상담과 관리자 상담 화면
- 관리자 페이지: 회원, 클럽, 리그, 추첨, 순위, 게시판 관리

---

## 기술 스택 요약

### Backend: `3ch-api`

- Node.js, Express 5
- PostgreSQL, Prisma migration, raw `pg` query
- Passport OAuth, JWT, bcrypt
- Swagger UI
- Multer file upload
- Web Push
- WebSocket 상담 채팅
- Python OMR scanner
- PM2 배포 실행

### Web: `3ch-web`

- React 19, TypeScript, Vite 7
- React Router 7
- Redux Toolkit, RTK Query
- MUI 7
- Tiptap rich text editor
- Payments SDK
- vite-plugin-pwa
- Recharts, QR code, drag and drop

### Mobile: `3ch-mobile`

- Expo SDK 56, React Native 0.85
- React Navigation 7
- Redux Toolkit, RTK Query
- expo-secure-store
- expo-location
- expo-clipboard
- EAS Build

---

## 빠른 실행

각 프로젝트 폴더에서 의존성을 설치하고 실행합니다.

```powershell
cd 3ch-api
npm install
npm run dev
```

```powershell
cd 3ch-web
npm install
npm run dev
```

```powershell
cd 3ch-mobile
npm install
npm start
```

---

## 환경 변수

각 프로젝트는 별도 `.env`를 사용합니다.

- API: `3ch-api/.env`
- Web: `3ch-web/.env`, `3ch-web/.env.production`
- Mobile: `3ch-mobile/.env`

값은 실제 환경에 맞게 로컬에서만 설정하고, README나 Git에 노출하지 않습니다.

```dotenv
# Web
VITE_API_BASE_URL=<API_BASE_URL>
VITE_APP_URL=<WEB_APP_URL>

# Mobile
EXPO_PUBLIC_API_BASE_URL=<API_BASE_URL>
```

실제 모바일 기기에서 로컬 API를 테스트할 때는 `localhost` 대신 개발 PC의 LAN IP를 사용합니다.

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://<LOCAL_LAN_IP>:<API_PORT>/api
```

---

## 배포

### API 자동 배포

`.github/workflows/deploy-api.yml`

`main` 브랜치에 `3ch-api/**` 변경이 push되면:

1. 원격 서버에 SSH 접속
2. 원격 프로젝트 디렉터리에서 `git pull origin main`
3. `3ch-api`에서 `npm ci --omit=dev`
4. `npx prisma migrate deploy`
5. OMR Python venv 및 requirements 설치
6. `pm2 restart 3ch-api --update-env`
7. Discord 웹훅으로 결과 알림

### Web 자동 배포

`.github/workflows/deploy-web.yml`

`main` 브랜치에 `3ch-web/**` 변경이 push되면:

1. GitHub Actions에서 `npm ci`
2. `npm run build`
3. `dist/`를 원격 웹 루트로 SCP 업로드
4. 권한 설정 후 Nginx reload
5. Discord 웹훅으로 결과 알림

### Mobile 배포

모바일은 EAS Build를 사용합니다.

```powershell
cd 3ch-mobile
npm run build:android:apk # 내부 테스트 APK
npm run build:android:aab # Play Store 제출용 AAB
```

---

## Git 운영

- 기본 작업 브랜치: `dev`
- 배포 기준 브랜치: `main`
- `main` push 시 API/Web GitHub Actions가 경로별로 자동 실행됩니다.
- 빌드 산출물과 환경 변수 파일은 Git에 포함하지 않습니다.

커밋 제외 권장 산출물:

- `node_modules/`
- `dist/`
- `.expo/`
- `android/`, `ios/`
- `*.apk`, `*.aab`
- `.env`

---

## 문서

세부 실행 방법은 각 프로젝트 README를 참고합니다.

- [API README](./3ch-api/README.md)
- [Web README](./3ch-web/README.md)
- [Mobile README](./3ch-mobile/README.md)
