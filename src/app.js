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
const membershipReportRoutes = require("./routes/membershipReports");
const transactionReportRoutes = require("./routes/transactionReports");
 
const referenceRoutes = require("./routes/referenceRoutes");

 const swaggerRouter = require("./swagger");

const path = require("path");
const config = require("./config/config");
const app = express();
app.use(morgan("dev"));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource loading
  })
);
app.use(
  cors({
    origin: config.frontendUrl || "http://localhost:5173", // Allow requests from this origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Allowed HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For application/x-www-form-urlencoded (optional, but common)
const uploadsPath = path.join(__dirname, "..", "uploads");
console.log(`Serving static files from: ${uploadsPath}`); // Verify this path on startup!
app.use("/uploads", express.static(uploadsPath));
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/sites", siteRoutes); 
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
app.use("/api/membershipreports", membershipReportRoutes); // Add route for membership export reports

app.use("/api/transactionreports", transactionReportRoutes); // Add route for transaction export reports
 app.use("/api/references", referenceRoutes);
 app.use(swaggerRouter); // Add this line to include Swagger documentation

app.use((req, res, next) => {
  next(createError(404));
});

module.exports = app;
