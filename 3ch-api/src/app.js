// const express = require("express");
// require("dotenv").config();

// const testRoutes = require("./routes/test");

// const app = express();

// app.use(express.json());

// // routes
// app.use("/", testRoutes);

// module.exports = app;

const express = require("express");
const { swaggerUi, swaggerSpec } = require("./config/swagger");

const testRoutes = require("./routes/test"); // 네가 만든 /test, /db-test 라우터

const app = express();

app.use(express.json());

// ✅ Swagger
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ✅ Routes
app.use("/", testRoutes);

module.exports = app;
