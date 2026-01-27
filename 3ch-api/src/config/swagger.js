const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "3CH API", version: "0.1.0" },
    servers: [
      { url: "/", description: "Local (direct)" },
      { url: "/api", description: "Server (Nginx /api proxy)" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: ["./src/routes/*.js"],
});

module.exports = { swaggerUi, swaggerSpec };
