const express = require("express");
const { swaggerUi, swaggerSpec } = require("./config/swagger");
require("dotenv").config();
const cors = require("cors");

const testRoutes = require("./routes/test");
const authRouter = require("./routes/auth");
const leagueRouter = require("./routes/league");

const app = express();

require("./config/passport");
const passport = require("passport");

app.use(express.json());
app.use(passport.initialize());

// CORS
const corsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
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

module.exports = app;
