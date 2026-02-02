const express = require("express");
const { swaggerUi, swaggerSpec } = require("./config/swagger");
require("dotenv").config();

const testRoutes = require("./routes/test");
const authRouter = require("./routes/auth");

const app = express();

app.use(express.json());

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
