const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const createError = require("http-errors");
require("dotenv").config();
const roleRoutes = require("./routes/roles");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const zoneRoutes = require("./routes/zones");
const locationRoutes = require("./routes/location");
const categoryRoutes = require("./routes/category");
const trainingRoutes = require("./routes/training");
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
const transactionReportRoutes = require("./routes/transactionReports");
const oneToOneRoutes = require("./routes/oneToOneRoutes");
const membershipReportRoutes = require("./routes/membershipReports");

const swaggerRouter = require("./swagger");
 const referenceRoutes = require("./routes/referenceRoutes");
  
   
const path = require("path");
const config = require("./config/config");
const app = express();
app.use(morgan("dev"));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource loading
    crossOriginOpenerPolicy: false, // Disable COOP header since we're on HTTP
    contentSecurityPolicy: false, // Disable CSP for HTTP deployment
  })
);
app.use(
  cors({
    origin: config.frontendUrl || "http://15.207.30.113", // Allow requests from this origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Allowed HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For application/x-www-form-urlencoded (optional, but common)

// Determine the correct frontend path based on environment
const frontendPath =
  process.env.NODE_ENV === "production"
    ? path.join(
        process.env.FRONTEND_PATH ||
          "/opt/bitnami/apache/htdocs/BBNG/BBNG-FrontEnd/dist"
      )
    : path.join(__dirname, "../../BBNG-FrontEnd/dist");

console.log(`Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// Define a route to serve backend/dist files directly if needed
const backendDistPath =
  process.env.NODE_ENV === "production"
    ? path.join(
        process.env.BACKEND_DIST_PATH ||
          "/opt/bitnami/apache/htdocs/BBNG-Api/dist"
      )
    : path.join(__dirname, "../BBNG-Api/dist");

app.use("/backend", express.static(backendDistPath));

// Determine the correct uploads path based on environment
const uploadsPath =
  process.env.NODE_ENV === "production"
    ? process.env.UPLOADS_PATH || "/opt/bitnami/apache/htdocs/BBNG-Api/uploads"
    : path.join(__dirname, "..", "uploads");

console.log(`Serving static files from: ${uploadsPath}`); // Verify this path on startup!
app.use("/uploads", express.static(uploadsPath));

app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/sites", siteRoutes); // Ensure this line is included to handle site routes
app.use("/api/messages", messageRoutes); // Add this line to include message routes
app.use("/api/chapters", chapterRoutes);
app.use("/api/chapter-meetings", chapterMeetingRoutes); // Add routes for chapter meetings
app.use("/api/members", memberRoutes);
app.use("/api/packages", packageRoutes); // Add routes for packages
app.use("/api/memberships", membershipRoutes); // Add routes for memberships
app.use("/api/visitors", visitorRoutes); // Add routes for visitors
app.use("/api/meeting-attendance", meetingAttendanceRoutes); // Add routes for meeting attendance
app.use("/api/transactionRoutes", transactionRoutes); // Add routes for transactions
 app.use("/api/requirements", requirementRoutes); // Add routes for requirements
app.use("/api/memberreports", memberReportRoutes); // Add route for member export reports
app.use("/api/transactionreports", transactionReportRoutes); // Add route for transaction export reports
 app.use("/api/one-to-ones", oneToOneRoutes); // Add route for member search

app.use(swaggerRouter); // Add this line to include Swagger documentation
  
  app.use("/api/membershipreports", membershipReportRoutes); // Add route for membership export reports

 app.use(swaggerRouter); // Add this line to include Swagger documentation
 
// Catch-all route to serve index.html for client-side routing (must be after all API routes)
app.get("*", (req, res) => {
  const indexPath =
    process.env.NODE_ENV === "production"
      ? path.join(
          process.env.FRONTEND_PATH ||
            "/opt/bitnami/apache/htdocs/BBNG/BBNG-FrontEnd/dist",
          "index.html"
        )
      : path.resolve(__dirname, "../../BBNG-FrontEnd/dist/index.html");

  console.log(`Serving index.html from: ${indexPath}`);
  res.sendFile(indexPath);
});

// 404 handler for any remaining routes
app.use((req, res, next) => {
  next(createError(404));
});

module.exports = app;
