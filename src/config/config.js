module.exports = {
  appName: process.env.APP_NAME || "Voyage Central",
  defaultUserRole: process.env.DEFAULT_USER_ROLE || "user",
  allowRegistration: process.env.ALLOW_REGISTRATION || true,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};
