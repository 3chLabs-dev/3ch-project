# 3ch Web (Frontend)

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
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Routing**: React Router 7 (SPA)
- **State Management**: Redux Toolkit (RTK) + RTK Query
- **UI Library**: MUI (Material UI) 7
- **HTTP Client**: Axios
- **PWA**: 홈 화면 추가, 아이콘/스플래시 지원
- **UI Pattern**: 모바일 앱 느낌 레이아웃 (모바일 폭 고정, 하단 탭, 카드 UI)

---

### 인증
- 이메일/비밀번호 회원가입 및 로그인
- 소셜 로그인 (Google, Kakao, Naver)
- JWT 토큰 기반 인증

## 🚀 배포 (Deployment)

### 빌드 및 서버 업로드
1. 환경에 맞는 빌드 실행
   ```bash
   npm run build:prod
   ```

2. `dist/` 폴더의 내용을 서버에 업로드

3. Nginx에서 정적 파일 서빙 설정
   ```nginx
   location / {
       root /var/www/3ch-web;
       try_files $uri $uri/ /index.html;
   }
   ```

### 주의사항
- **소스 코드는 서버에 배포하지 않음**
- 서버에는 **빌드 산출물(dist)만 존재**
- 환경 변수는 빌드 시점에 포함되므로 배포 전 올바른 값 설정 필요

## 🔧 문제 해결 (Troubleshooting)

### CORS 에러
- `.env` 파일의 `VITE_API_BASE_URL` 확인
- API 서버의 CORS 설정 확인
- 브라우저 개발자 도구에서 네트워크 요청 확인

### 빌드 실패
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install

# 캐시 클리어 후 빌드
npm run build -- --force
```

### 소셜 로그인 실패
- Google Client ID가 올바르게 설정되었는지 확인
- OAuth 콜백 URL이 각 제공자 콘솔에 등록되었는지 확인
- 팝업 차단이 활성화되어 있는지 확인

### 라우팅 404 에러 (프로덕션)
- Nginx 설정에서 `try_files $uri $uri/ /index.html` 확인
- SPA는 모든 경로를 `index.html`로 리다이렉트해야 함

## 📌 참고사항

- 모든 API 요청은 `VITE_API_BASE_URL` 환경 변수 사용
- API 엔드포인트는 `/api` prefix 포함 (예: `/api/auth/login`)
- 토큰은 `localStorage`에 저장
- Redux store에서 전역 상태 관리 (user, token)
- MUI 테마는 `src/theme/` 폴더에서 커스터마이징

---

## 📂 브랜치 / 협업 규칙 (초기)

- 기본 작업 브랜치는 dev
- 배포 시에만 dev → main 머지
- build 결과물은 Git에 포함하지 않음

---

## ⚠️ 기타
- 본 저장소는 현재 Private 상태
- 외부 공개는 서비스 안정화 이후 검토 예정