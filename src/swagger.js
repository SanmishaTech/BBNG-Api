const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const express = require("express");

const router = express.Router();
//yash & sanjeev
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "BBNG API",
      version: "1.0.0",
      description: "Business Builders Networking Group (BBNG) REST API for managing memberships, members, chapters, meetings, and more.",
      contact: {
        name: "BBNG Development Team",
        email: "support@bbng.com"
      }
    },
    servers: [
      {
        url: "http://localhost:3000/",
        description: "Development server"
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const specs = swaggerJsdoc(options);

const swaggerUiOptions = {
  swaggerOptions: {
    requestInterceptor: (req) => {
      // Ensure content-type is properly set for file uploads
      if (req.body instanceof FormData) {
        req.headers["Content-Type"] = "multipart/form-data";
      }
      return req;
    },
  },
};

router.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, swaggerUiOptions)
);

module.exports = router;
