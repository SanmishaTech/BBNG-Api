module.exports = {
  appName: process.env.APP_NAME || "BBNG",
  defaultUserRole: process.env.DEFAULT_USER_ROLE || "member",
  allowRegistration: process.env.ALLOW_REGISTRATION || true,
  frontendUrl: process.env.FRONTEND_URL || "localhost:3000",
};
