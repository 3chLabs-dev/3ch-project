require("dotenv").config();
const { Pool, types } = require("pg");

// TIMESTAMP WITHOUT TIME ZONE (OID 1114)을 항상 UTC로 파싱
// 기본값은 Node.js 프로세스의 로컬 시간대(KST 환경이면 -9시간 오차 발생)
types.setTypeParser(1114, (val) => new Date(val.replace(" ", "T") + "Z"));

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: String(process.env.DB_PASSWORD ?? ""),
});

module.exports = pool;
