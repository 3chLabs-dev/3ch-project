const express = require("express");
const { swaggerUi, swaggerSpec } = require("./config/swagger");
require("dotenv").config();
const cors = require("cors");

const testRoutes = require("./routes/test");
const authRouter = require("./routes/auth");

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

// Routes
app.use("/", testRoutes);
app.use("/auth", authRouter);

module.exports = app;
