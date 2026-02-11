# 3ch API (Backend)

3ch는 탁구, 배드민턴, 테니스 등 다양한 스포츠를 기반으로 한
스포츠 플랫폼 서비스를 목표로 하는 프로젝트입니다.

## 🛠 사용 기술 스택 (Tech Stack)

- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: PostgreSQL
- **Database ORM**: Prisma 7
- **Authentication**: Passport.js (Google, Kakao, Naver OAuth) + JWT
- **API Documentation**: Swagger UI
- **Validation**: Zod (한글 에러 메시지)
- **Security**: bcrypt, helmet, cors
- **Process Manager**: PM2 (프로덕션 환경)

## ⚙️ 프로젝트 설정 (Project Setup)

1.  **저장소 복제 (Clone Repository)**
    ```bash
    git clone <repository-url>
    cd 3ch-api
    ```

2.  **의존성 설치 (Install Dependencies)**
    ```bash
    npm install
    ```

3.  **환경 변수 설정 (Environment Variables)**
    -   프로젝트 루트에 `.env` 파일을 생성합니다.
    -   아래 내용을 기반으로 자신의 환경에 맞게 수정합니다.

    ```dotenv
    # .env.example

    # PostgreSQL Database URL
    DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@DB_HOST:DB_PORT/DB_NAME?schema=public"

    # Server Port
    PORT=3000

    # JWT Secret
    JWT_SECRET="your-super-secret-key"
    JWT_EXPIRES_IN=7d
    ```

4.  **데이터베이스 마이그레이션 (Database Migration)**
    -   개발 환경에서 Prisma 마이그레이션을 실행하여 테이블을 생성합니다.
    ```bash
    npm run db:dev
    # 또는
    npx prisma migrate dev
    ```

    -   프로덕션 환경에서는 마이그레이션 배포:
    ```bash
    npm run db:migrate
    # 또는
    npx prisma migrate deploy
    ```

    -   Prisma Studio로 데이터 확인:
    ```bash
    npm run db:studio
    ```

## 🚀 애플리케이션 실행 (Running the App)

-   **개발 모드 (Development mode)**
    -   `nodemon`을 사용하여 파일 변경 시 서버가 자동으로 재시작됩니다.
    ```bash
    npm run dev
    ```

-   **프로덕션 모드 (Production mode)**
    ```bash
    npm start
    ```

## 📚 API 문서 (API Documentation)

-   서버 실행 후, 아래 주소에서 Swagger UI를 통해 API 문서를 확인하고 테스트할 수 있습니다.
-   **개발 환경**: `http://localhost:3000/swagger`
-   **프로덕션 환경**: `http://your-domain/api/swagger`

## 🔧 문제 해결 (Troubleshooting)

### 데이터베이스 연결 실패
- `.env` 파일의 `DATABASE_URL` 확인
- PostgreSQL 서버 실행 상태 확인
- 데이터베이스 접근 권한 확인

### 마이그레이션 오류
```bash
# 마이그레이션 재실행
npm run db:dev

# Prisma 클라이언트 재생성
npx prisma generate
```

### PM2 프로세스 문제
```bash
# 프로세스 상태 확인
pm2 list

# 로그 확인
pm2 logs 3ch-api --lines 100

# 재시작
pm2 restart 3ch-api
```

### 포트 충돌
```bash
# 3000번 포트 사용 프로세스 확인 (Linux/Mac)
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

### OAuth 콜백 오류
- 각 OAuth 제공자 콘솔에서 Callback URL 설정 확인
- `.env` 파일의 `*_CALLBACK_URL` 값 확인
- `FRONTEND_URL` 값이 실제 프론트엔드 주소와 일치하는지 확인

## 📌 참고사항

- 모든 API 엔드포인트는 `/api` prefix 사용
- 인증이 필요한 API는 `Authorization: Bearer <token>` 헤더 필요
- Zod 검증 에러는 한글로 반환
- 프로덕션 환경에서는 반드시 `.env`의 시크릿 값 변경 필요
