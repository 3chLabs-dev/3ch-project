# 3ch API

우리리그 서비스의 백엔드 API입니다. 웹 프론트엔드(`3ch-web`)와 모바일 앱(`3ch-mobile`)이 같은 API를 사용합니다.

---

## 보안 원칙

- 실제 `.env` 값, 키, 토큰, 서버 IP, 원격 경로는 문서와 Git에 남기지 않습니다.
- README의 값은 모두 예시 또는 플레이스홀더입니다.
- 운영 설정은 서버 환경 변수, GitHub Secrets, 배포 환경 설정에서 관리합니다.

---

## 기술 스택

- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: PostgreSQL
- **Migration**: Prisma 7 migration CLI
- **Query**: `pg` 기반 raw SQL
- **Authentication**: Passport.js OAuth + JWT
- **OAuth Providers**: Google, Kakao, Naver
- **Validation**: Zod
- **Security**: helmet, cors, express-rate-limit, bcrypt
- **Upload**: Multer, `/uploads` static serving
- **API Docs**: Swagger UI
- **Push**: web-push
- **Realtime**: `ws` WebSocket support chat
- **OMR**: Python scanner script
- **Process**: PM2

---

## 폴더 구조

```text
3ch-api/
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ scripts/
│  ├─ omr_scan.py
│  ├─ omr_benchmark.py
│  └─ requirements-omr.txt
├─ src/
│  ├─ app.js
│  ├─ server.js
│  ├─ config/        # passport, swagger
│  ├─ db/            # PostgreSQL pool
│  ├─ middlewares/   # auth, permission
│  ├─ routes/        # API routes
│  ├─ services/      # ranking, support chat socket
│  └─ utils/
├─ uploads/
├─ package.json
└─ prisma.config.ts
```

---

## 주요 모델

`prisma/schema.prisma` 기준:

- `User`
- `SupportChatRoom`, `SupportChatMessage`
- `Group`, `GroupMember`
- `GroupRankingSetting`, `GroupRanking`, `GroupRankingEvent`
- `SportRanking`, `SportRankingEvent`
- `League`, `LeagueParticipant`, `LeagueMatch`
- `Team`, `Player`, `Match`
- `Draw`, `DrawPrize`, `DrawWinner`

---

## 환경 변수

`3ch-api/.env` 파일을 생성합니다. 값은 실제 환경에서만 채우고 Git에 올리지 않습니다.

```dotenv
PORT=<API_PORT>

DB_HOST=<DB_HOST>
DB_PORT=<DB_PORT>
DB_NAME=<DB_NAME>
DB_USER=<DB_USER>
DB_PASSWORD=<DB_PASSWORD>

JWT_SECRET=<JWT_SECRET>
JWT_EXPIRES_IN=7d

FRONTEND_URL=<FRONTEND_URL>

GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<GOOGLE_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=<GOOGLE_CALLBACK_URL>

KAKAO_CLIENT_ID=<KAKAO_CLIENT_ID>
KAKAO_CLIENT_SECRET=<KAKAO_CLIENT_SECRET>
KAKAO_CALLBACK_URL=<KAKAO_CALLBACK_URL>

NAVER_CLIENT_ID=<NAVER_CLIENT_ID>
NAVER_CLIENT_SECRET=<NAVER_CLIENT_SECRET>
NAVER_CALLBACK_URL=<NAVER_CALLBACK_URL>

KAKAO_REST_API_KEY=<KAKAO_REST_API_KEY>

TOSS_SECRET_KEY=<TOSS_SECRET_KEY>

VAPID_MAILTO=<VAPID_MAILTO>
VAPID_PUBLIC_KEY=<VAPID_PUBLIC_KEY>
VAPID_PRIVATE_KEY=<VAPID_PRIVATE_KEY>

OMR_PYTHON_BIN=<OMR_PYTHON_BIN>
OMR_PYTHON_SCRIPT=<OMR_PYTHON_SCRIPT>
OMR_SCANNER_TIMEOUT_MS=30000
```

---

## 설치 및 실행

```powershell
npm install
npm run dev
```

프로덕션 실행:

```powershell
npm start
```

Swagger:

```text
http://<API_HOST>:<API_PORT>/swagger
```

---

## 데이터베이스

개발 마이그레이션:

```powershell
npm run db:dev
```

프로덕션 마이그레이션:

```powershell
npm run db:migrate
```

Prisma Studio:

```powershell
npm run db:studio
```

`src/app.js`는 일부 게시판/가이드/랭킹 관련 테이블 및 컬럼을 서버 시작 시 보정합니다. 정식 스키마 변경은 Prisma migration으로 관리합니다.

---

## API 라우트

모든 주요 API는 `/api` prefix를 사용합니다.

### 인증

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/member/verify-password`
- `PUT /api/auth/member`
- `DELETE /api/auth/member`
- `GET /api/auth/google`
- `GET /api/auth/kakao`
- `GET /api/auth/naver`
- `POST /api/auth/social/complete`

### 클럽

- `GET /api/group`
- `POST /api/group`
- `GET /api/group/search`
- `POST /api/group/recommend`
- `GET /api/group/:id`
- `PATCH /api/group/:id`
- `DELETE /api/group/:id`
- `POST /api/group/:id/join`
- `DELETE /api/group/:id/leave`
- `POST /api/group/:id/member`
- `PATCH /api/group/:id/member/:userId`
- `DELETE /api/group/:id/member/:userId`
- `GET /api/group/:id/ranking`
- `GET /api/group/:id/ranking/points`
- `POST /api/group/:id/ranking/rebuild`
- `GET /api/group/:id/member/:userId`
- `GET /api/group/:id/member/:userId/leagues`

### 리그·대회

- `GET /api/league`
- `POST /api/league`
- `GET /api/league/:id`
- `PUT /api/league/:id`
- `DELETE /api/league/:leagueId`
- `GET /api/league/:id/participants`
- `POST /api/league/:leagueId/participants`
- `PUT /api/league/:leagueId/participants/:participantId`
- `DELETE /api/league/:leagueId/participants/:participantId`
- `PATCH /api/league/:id/participants/reorder`
- `GET /api/league/:id/matches`
- `POST /api/league/:id/matches/init`
- `POST /api/league/:id/matches/init-tournament`
- `PATCH /api/league/:id/matches/:matchId`
- `PATCH /api/league/:id/matches/reorder`
- `POST /api/league/:id/omr/scan`
- `POST /api/league/:id/matches/:matchId/notify`

### 추첨

- `GET /api/draw/:leagueId`
- `POST /api/draw/:leagueId`
- `GET /api/draw/:leagueId/:drawId`
- `PATCH /api/draw/:leagueId/:drawId`
- `DELETE /api/draw/:leagueId/:drawId`
- `POST /api/draw/:leagueId/:drawId/run`
- `POST /api/draw/:leagueId/:drawId/prizes/:prizeId/winners`

### 사용자

- `GET /api/user/me/preferences`
- `PUT /api/user/me/preferences`
- `GET /api/user/me/home-summary`
- `POST /api/user/me/push-subscription`
- `DELETE /api/user/me/push-subscription`
- `GET /api/user/me/sport-rankings`
- `GET /api/user/me/sport-rankings/:sport`

### 게시판/정책/문의

- `GET /api/notices`
- `GET /api/notices/:id`
- `GET /api/faqs`
- `GET /api/guides`
- `GET /api/policies/:type/current`
- `GET /api/policies/:type/versions`
- `POST /api/inquiries`
- `GET /api/inquiries/my`
- `GET /api/inquiries/my/:id`

### 결제/구독

- `POST /api/payment/confirm`
- `GET /api/payment/subscriptions/me`

### 채팅 상담

- `GET /api/support-chat`
- `POST /api/support-chat/messages`
- `GET /api/admin/support-chat/rooms`
- `GET /api/admin/support-chat/rooms/:id`
- `POST /api/admin/support-chat/rooms/:id/messages`
- `PATCH /api/admin/support-chat/rooms/:id/status`
- WebSocket: `/ws/support-chat?token=<JWT>`

### 관리자

- `POST /api/admin/login`
- `GET /api/admin/stats`
- `GET /api/admin/members`
- `GET /api/admin/clubs`
- `GET /api/admin/leagues`
- `GET /api/admin/draws`
- `GET /api/admin/tournaments`
- `GET /api/admin/rankings/points`
- `GET /api/admin/rankings/ratings`
- `/api/admin/board/*` 게시판 관리

---

## OMR

OMR 스캔은 Python 스크립트를 사용합니다.

```powershell
python -m venv .venv-omr
<PYTHON_BIN> -m pip install -r scripts/requirements-omr.txt
```

운영 서버에서는 배포 환경에서 venv를 만들고 `OMR_PYTHON_BIN`을 프로세스 환경 변수로 주입합니다.

---

## 배포

`.github/workflows/deploy-api.yml`

`main` 브랜치에 `3ch-api/**` 변경이 push되면 원격 서버에서 다음 작업을 수행합니다.

```bash
cd <REMOTE_PROJECT_DIR>
git pull origin main
cd 3ch-api
npm ci --omit=dev
npx prisma migrate deploy
python3 -m venv .venv-omr
<PYTHON_BIN> -m pip install -r scripts/requirements-omr.txt
OMR_PYTHON_BIN=<OMR_PYTHON_BIN> pm2 restart <PM2_PROCESS_NAME> --update-env
```

배포 시작/결과는 Discord 웹훅으로 전송됩니다. 웹훅 URL은 GitHub Secrets에만 보관합니다.

---

## 문제 해결

### DB 연결 실패

`.env`의 DB 관련 값을 확인합니다. 실제 값은 문서나 Git에 남기지 않습니다.

### 인증 실패

- `JWT_SECRET`이 서버 환경에 설정되어 있는지 확인
- 클라이언트 요청에 `Authorization: Bearer <token>` 헤더가 있는지 확인
- OAuth callback URL이 공급자 콘솔과 환경 변수에 동일하게 설정되어 있는지 확인

### CORS 오류

`src/app.js`의 `corsOptions.origin`에 호출 도메인이 포함되어 있는지 확인합니다.

### OMR 스캔 실패

- `OMR_PYTHON_BIN`
- `OMR_PYTHON_SCRIPT`
- `scripts/requirements-omr.txt`
- 업로드 파일 크기와 timeout 설정

### WebSocket 연결 실패

- 경로가 `/ws/support-chat`인지 확인
- query string에 유효한 JWT token이 있는지 확인
- Nginx가 WebSocket upgrade를 허용하는지 확인
