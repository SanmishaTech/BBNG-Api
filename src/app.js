//Vipul
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const createError = require("http-errors");
const path = require("path");
require("dotenv").config();
const authMiddleware = require("./middleware/auth");
const { roleGuard, allowRoles } = require("./middleware/authorize");
const roleRoutes = require("./routes/roles");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const zoneRoutes = require("./routes/zones");
const locationRoutes = require("./routes/location");
const categoryRoutes = require("./routes/category");
const trainingRoutes = require("./routes/training");
const stateRoutes = require("./routes/state");
const siteRoutes = require("./routes/site");
const messageRoutes = require("./routes/messages");
const chapterRoutes = require("./routes/chapters");
const chapterMeetingRoutes = require("./routes/chapterMeetings");
const memberRoutes = require("./routes/members");
const packageRoutes = require("./routes/packages");
const membershipRoutes = require("./routes/memberships");
const visitorRoutes = require("./routes/visitorRoutes");
const meetingAttendanceRoutes = require("./routes/meetingAttendanceRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const requirementRoutes = require("./routes/requirements");
const memberReportRoutes = require("./routes/memberReports");
const membershipReportRoutes = require("./routes/membershipReports");
const transactionReportRoutes = require("./routes/transactionReports");
const oneToOneRoutes = require("./routes/oneToOneRoutes");
const chapterRoleRoutes = require("./routes/chapterRoles");
const subCategoryRoutes = require("./routes/subCategory");
const statisticsRoutes = require("./routes/statistics");
const powerTeamRoutes = require("./routes/powerTeamRoutes");

const fs = require("fs");

const http = require("http");

const https = require("https");
const responseWrapper = require("./middleware/responseWrapper");
const swaggerRouter = require("./swagger");
const referenceRoutes = require("./routes/referenceRoutes");
const thankYouSlipRoutes = require("./routes/thankYouSlipRoutes");

const app = express();

app.use(morgan("dev"));

// Apply response wrapper middleware globally to normalise all responses
app.use(responseWrapper);


app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })

);
app.use((req, res, next) => {

  res.removeHeader("Origin-Agent-Cluster");

  next();

});



// CORS

app.use(
  cors({
    origin: true, // Allow all origins
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// const frontendDistPath =
//   process.env.NODE_ENV === "production"
//     ? process.env.FRONTEND_PATH ||
//       path.resolve(__dirname, "..", "..", "BBNG-FrontEnd", "dist")
//     : path.resolve(__dirname, "..", "..", "BBNG-FrontEnd", "dist");

// Use environment variable for the frontend distribution path
const frontendDistPath =
  process.env.FRONTEND_DIST_PATH || path.resolve(__dirname, "..", "dist");

console.log(`Frontend distribution path from env: ${frontendDistPath}`);

console.log(`Serving frontend static files from: ${frontendDistPath}`);
app.use(express.static(frontendDistPath));

const uploadsPath =
  process.env.NODE_ENV === "production"
    ? process.env.UPLOADS_PATH || path.resolve(__dirname, "..", "uploads")
    : path.resolve(__dirname, "..", "uploads");

console.log(`Serving uploads from: ${uploadsPath}`);
app.use("/uploads", express.static(uploadsPath));

app.use("/api/auth", authRoutes);
app.use("/api/roles", authMiddleware, roleRoutes);
app.use("/api/users", authMiddleware,  userRoutes);
app.use("/api/zones", authMiddleware,  zoneRoutes);
app.use("/api/locations", authMiddleware,  locationRoutes);
app.use("/api/trainings", authMiddleware,  trainingRoutes);
app.use("/api/states", authMiddleware, stateRoutes);
app.use(
  "/api/categories",
  authMiddleware,
  categoryRoutes
);
app.use("/api/sites", authMiddleware,  siteRoutes);
app.use("/api/messages", authMiddleware,  messageRoutes);
app.use(
  "/api/chapters",
  authMiddleware,
  chapterRoutes
);
app.use(
  "/api/chapter-meetings",
  authMiddleware,
  chapterMeetingRoutes
);
app.use(
  "/api/members",
  authMiddleware,
  memberRoutes
);
app.use("/api/packages", authMiddleware,  packageRoutes);
app.use(
  "/api/memberships",
  authMiddleware,
  
  membershipRoutes
);
app.use(
  "/api/visitors",
  authMiddleware,
  visitorRoutes
);
app.use(
  "/api/meeting-attendance",
  authMiddleware,
  meetingAttendanceRoutes
);
app.use(
  "/api/transactionRoutes",
  authMiddleware,
  transactionRoutes
);
app.use(
  "/api/requirements",
  authMiddleware,
  requirementRoutes
);
app.use("/api/statistics", authMiddleware, statisticsRoutes);

app.use(
  "/api/memberreports",
  authMiddleware,
  
  memberReportRoutes
);
app.use(
  "/api/membershipreports",
  authMiddleware,
  
  membershipReportRoutes
);
app.use(
  "/api/transactionreports",
  authMiddleware,
  
  transactionReportRoutes
);
app.use(
  "/api/references",
  authMiddleware,
  referenceRoutes
);
app.use(
  "/api/one-to-ones",
  authMiddleware,
  oneToOneRoutes
);
app.use(
  "/api/thankyou-slips",
  authMiddleware,
  thankYouSlipRoutes
);
app.use(
  "/api/subcategories",
  authMiddleware,
  subCategoryRoutes
);
app.use(
  "/api/chapter-roles",
  authMiddleware,
  chapterRoleRoutes
);
app.use(
  "/api/powerteams",
  authMiddleware,
  powerTeamRoutes
);
app.use(swaggerRouter);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.includes(".")) {
    return next();
  }

  const indexPath = path.join(frontendDistPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      if (err.code === "ENOENT") {
        res
          .status(404)
          .send(
            "Frontend entry point (index.html) not found. Ensure the frontend is built and paths are correctly configured."
          );
      } else {
        res
          .status(500)
          .send(
            "An error occurred while trying to serve the frontend application."
          );
      }
    }
  });
});

app.use((req, res, next) => {
  if (res.headersSent) {
    return next();
  }
  next(createError(404, "The requested resource was not found."));
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error(
    "[ERROR HANDLER]:",
    err.status,
    err.message,
    process.env.NODE_ENV === "development" ? err.stack : ""
  );
  res.status(err.status || 500);
  res.json({
    error: {
      message: err.message || "An unexpected error occurred.",
      status: err.status || 500,
    },
  });
});

module.exports = app;



// =============================================================================

// HTTPS + HTTP→HTTPS redirector

// =============================================================================

const sslOptions = {

  key:  fs.readFileSync(process.env.SSL_KEY_PATH),

  cert: fs.readFileSync(process.env.SSL_CERT_PATH),

};



https

  .createServer(sslOptions, app)

  .listen(443, () => console.log("✅ HTTPS listening on 443"));



http

  .createServer((req, res) => {

    res.writeHead(301, {

      Location: "https://" + req.headers.host + req.url,

    });

    res.end();

  })

  .listen(80, () => console.log("🔄 HTTP→HTTPS redirector on 80"));