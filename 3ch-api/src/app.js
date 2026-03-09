const express = require("express");
const path = require("path");
const { swaggerUi, swaggerSpec } = require("./config/swagger");
require("dotenv").config();
const cors = require("cors");

const testRoutes = require("./routes/test");
const authRouter = require("./routes/auth");
const leagueRouter = require("./routes/league");
const groupRouter = require("./routes/group");
const drawRouter = require("./routes/draw");
const adminRouter = require("./routes/admin");
const policyRouter = require("./routes/policy");
const boardRouter  = require("./routes/board");
const noticeRouter = require("./routes/notice")
const inquiryRouter = require("./routes/inquiry")

const pool = require("./db/pool");

const app = express();

require("./config/passport");
const passport = require("passport");

// 시작 시 DB 마이그레이션 (테이블/컬럼 자동 생성)
(async () => {
  try {
    // notices 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id           SERIAL PRIMARY KEY,
        title        VARCHAR(200) NOT NULL,
        content      TEXT         NOT NULL,
        is_published BOOLEAN      NOT NULL DEFAULT true,
        created_at   TIMESTAMPTZ  DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE notices ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT '안내'`);

    // faqs 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id            SERIAL PRIMARY KEY,
        question      VARCHAR(300) NOT NULL,
        answer        TEXT         NOT NULL,
        display_order INT          NOT NULL DEFAULT 0,
        is_published  BOOLEAN      NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE faqs ADD COLUMN IF NOT EXISTS tab     VARCHAR(20)  NOT NULL DEFAULT 'member'`);
    await pool.query(`ALTER TABLE faqs ADD COLUMN IF NOT EXISTS section VARCHAR(100) NOT NULL DEFAULT ''`);
  } catch (e) {
    console.error("DB migration error:", e.message);
  }
})();

app.use(express.json());
app.use(passport.initialize());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// CORS
const corsOptions = {
  origin: ["http://localhost:5173", "http://192.168.45.237:5173", "https://woorileague.com", "https://www.woorileague.com"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));

// health check (nginx / 운영 필수)
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Swagger
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes - 모든 API를 /api 아래로 통일
app.use("/", testRoutes);
app.use("/api/auth", authRouter);
app.use("/api", leagueRouter);
app.use("/api", groupRouter);
app.use("/api", drawRouter);
app.use("/api/admin", adminRouter);
app.use("/api", policyRouter);
app.use("/api/admin/board", boardRouter);
app.use("/api", noticeRouter);
app.use("/api", inquiryRouter);

module.exports = app;
