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

const swaggerRouter = require("./swagger");
const referenceRoutes = require("./routes/referenceRoutes");
const thankYouSlipRoutes = require("./routes/thankYouSlipRoutes");

const app = express();

app.use(morgan("dev"));

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource sharing
  })
);

const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(",")
  : ["http://localhost:5173", "http://15.207.30.113"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const frontendDistPath =
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_PATH ||
      path.resolve(__dirname, "..", "..", "BBNG-FrontEnd", "dist")
    : path.resolve(__dirname, "..", "..", "BBNG-FrontEnd", "dist");

console.log(`Frontend build path: ${frontendDistPath}`);

console.log(`Serving frontend static files from: ${frontendDistPath}`);
app.use(express.static(frontendDistPath));

const uploadsPath =
  process.env.NODE_ENV === "production"
    ? process.env.UPLOADS_PATH || path.resolve(__dirname, "..", "uploads")
    : path.resolve(__dirname, "..", "uploads");

console.log(`Serving uploads from: ${uploadsPath}`);
app.use("/uploads", express.static(uploadsPath));

app.use("/api/auth", authRoutes);
app.use("/api/roles", authMiddleware, roleGuard("admin"), roleRoutes);
app.use("/api/users", authMiddleware, roleGuard("admin"), userRoutes);
app.use("/api/zones", authMiddleware, roleGuard("admin"), zoneRoutes);
app.use("/api/locations", authMiddleware, roleGuard("admin"), locationRoutes);
app.use("/api/trainings", authMiddleware, roleGuard("admin"), trainingRoutes);
app.use("/api/states", authMiddleware, roleGuard("admin"), stateRoutes);
app.use("/api/categories", authMiddleware, roleGuard("admin"), categoryRoutes);
app.use("/api/sites", authMiddleware, roleGuard("admin"), siteRoutes);
app.use("/api/messages", authMiddleware, roleGuard("admin"), messageRoutes);
app.use("/api/chapters", authMiddleware, roleGuard("admin"), chapterRoutes);
app.use("/api/chapter-meetings", authMiddleware, roleGuard("admin", "user"), chapterMeetingRoutes);
app.use("/api/members", authMiddleware, roleGuard("admin"), memberRoutes);
app.use("/api/packages", authMiddleware, roleGuard("admin"), packageRoutes);
app.use("/api/memberships", authMiddleware, roleGuard("admin"), membershipRoutes);
app.use("/api/visitors", authMiddleware, roleGuard("admin"), visitorRoutes);
app.use("/api/meeting-attendance", authMiddleware, roleGuard("admin"), meetingAttendanceRoutes);
app.use("/api/transactionRoutes", authMiddleware, roleGuard("admin"), transactionRoutes);
app.use("/api/requirements", authMiddleware, roleGuard("admin", "user"), requirementRoutes);
app.use("/api/statistics", authMiddleware, roleGuard("admin", "user"), statisticsRoutes);

app.use("/api/memberreports", authMiddleware, roleGuard("admin"), memberReportRoutes);
app.use("/api/membershipreports", authMiddleware, roleGuard("admin"), membershipReportRoutes);
app.use("/api/transactionreports", authMiddleware, roleGuard("admin"), transactionReportRoutes);
app.use("/api/references", authMiddleware, roleGuard("admin", "user"), referenceRoutes);
app.use("/api/one-to-ones", authMiddleware, roleGuard("admin", "user"), oneToOneRoutes);
app.use("/api/thankyou-slips", authMiddleware, roleGuard("admin", "user"), thankYouSlipRoutes);
app.use("/api/subcategories", authMiddleware, roleGuard("admin", "user"), subCategoryRoutes);
app.use("/api/chapter-roles", authMiddleware, roleGuard("admin", "user"), chapterRoleRoutes);
app.use("/api/powerteams", authMiddleware, roleGuard("admin", "user"), powerTeamRoutes);
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
