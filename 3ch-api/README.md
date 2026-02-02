# 3ch API (Backend)

3ch는 탁구, 배드민턴, 테니스 등 다양한 스포츠를 기반으로 한  
스포츠 플랫폼 서비스를 목표로 하는 프로젝트입니다.

## 🛠 사용 기술 스택 (Tech Stack)

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Database ORM**: Prisma
- **Authentication**: JWT (JSON Web Tokens)
- **API Documentation**: Swagger
- **Validation**: Zod
- **Others**: `bcrypt` (for hashing), `cors`, `helmet`, `morgan`, `dotenv`

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

4.  **데이터베이스 동기화 (Database Sync)**
    -   Prisma 스키마를 실제 데이터베이스에 적용하여 테이블을 생성합니다.
    ```bash
    npx prisma db push
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
-   **URL**: `http://localhost:3000/swagger`
