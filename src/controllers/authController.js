const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { z } = require("zod");
const prisma = require("../config/db");
const emailService = require("../services/emailService");
const validateRequest = require("../utils/validateRequest");
const config = require("../config/config");
const jwtConfig = require("../config/jwt"); // Corrected: Get secret and expiresIn from here
const createError = require("http-errors");

const POLICY_TEXT_KEY = "policy"; // Changed to 'policy' for consistency

// Helper function to get user's chapter roles
const getUserChapterRoles = async (userId) => {
  try {
    const member = await prisma.member.findUnique({
      where: { userId },
      include: {
        chapterRoles: {
          select: {
            roleType: true,
            chapterId: true,
          },
        },
      },
    });

    if (member && member.chapterRoles) {
      return member.chapterRoles.map(role => ({ 
        role: role.roleType, 
        chapterId: role.chapterId 
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching user chapter roles:", error);
    // Depending on how you want to handle errors, you might throw it or return an empty array
    return []; 
  }
};

/**
 * Get chapters accessible by user based on their roles
 * Groups chapters by role categories:
 * - OB: Office Bearers (chapterHead, secretary, treasurer)
 * - RD: Regional Directors (connected to zones)
 * - DC: Development Coordinators (districtCoordinator, guardian)
 * 
 * @param {string} userId - User ID to check roles for
 * @returns {Promise<Array>} Array containing role categories and accessible chapter IDs
 */
const getUserAccessibleChapters = async (userId) => {
  try {
    console.log(`Getting accessible chapters for user: ${userId}`);
    
    // Initialize result structure
    const result = [
      { role: 'OB', chapters: [] },
      { role: 'RD', chapters: [] },
      { role: 'DC', chapters: [] }
    ];
    
    // Get the member associated with this user
    const member = await prisma.member.findUnique({
      where: { userId },
      include: {
        chapterRoles: {
          select: {
            roleType: true,
            chapterId: true,
          },
        },
        // Include the chapter to get zone information
        chapter: {
          select: {
            id: true,
            zoneId: true
          }
        }
      },
    });

    if (!member) {
      console.log(`No member found for user: ${userId}`);
      return result;
    }
    
    console.log(`Found member with ${member.chapterRoles.length} chapter roles`);

    // Process OB roles (office bearers)
    const obRoles = ['chapterHead', 'secretary', 'treasurer'];
    const obChapters = member.chapterRoles
      .filter(role => obRoles.includes(role.roleType))
      .map(role => role.chapterId);
    
    // Remove duplicates
    result[0].chapters = [...new Set(obChapters)];
    console.log(`OB chapters: ${result[0].chapters.join(', ')}`);

    // Process DC roles (development coordinators)
    // Checking for 'districtCoordinator' and 'guardian' as well as the possible 'developmentCoordinator' role
    const dcRoles = ['districtCoordinator', 'guardian', 'developmentCoordinator'];
    const dcChapters = member.chapterRoles
      .filter(role => dcRoles.includes(role.roleType))
      .map(role => role.chapterId);
    
    // Remove duplicates
    result[2].chapters = [...new Set(dcChapters)];
    console.log(`DC chapters: ${result[2].chapters.join(', ')}`);

    // Now handle RD roles by checking for zone roles in a separate query
    // This avoids issues if the zoneRoles relation is not properly defined
    try {
      console.log(`[RD DEBUG] Processing RD roles for userId: ${userId}`);
      const zoneRoles = await prisma.zoneRole.findMany({
        where: {
          member: {
            userId: userId
          }
        },
        select: {
          roleType: true,
          zoneId: true
        }
      });
      
      if (zoneRoles && zoneRoles.length > 0) {
        console.log(`Found ${zoneRoles.length} zone roles`);
        const rdRoles = ['Regional Director', 'Joint Secretary']; // Match database casing
        const zoneIds = zoneRoles
          .filter(role => rdRoles.includes(role.roleType))
          .map(role => role.zoneId);
        
        // If user has zone roles, get all chapters in those zones
        if (zoneIds.length > 0) {
          const chaptersInZones = await prisma.chapter.findMany({
            where: {
              zoneId: {
                in: zoneIds
              }
            },
            select: {
              id: true
            }
          });
          
          result[1].chapters = chaptersInZones.map(chapter => chapter.id);
          console.log(`RD chapters: ${result[1].chapters.join(', ')}`);
        }
      } else {
        console.log('No zone roles found');
      }
    } catch (zoneError) {
      console.error('Error fetching zone roles:', zoneError);
      // We'll continue without zone roles if there was an error
    }

    console.log('[DEBUG getUserAccessibleChapters] Returning result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error getting user accessible chapters:', error);
    return [
      { role: 'OB', chapters: [] },
      { role: 'RD', chapters: [] },
      { role: 'DC', chapters: [] }
    ];
  }
};

// Register a new user
const register = async (req, res, next) => {
  if (process.env.ALLOW_REGISTRATION !== "true") {
    return res
      .status(403)
      .json({ errors: { message: "Registration is disabled" } });
  }

  // Define Zod schema for registration validation
  const schema = z
    .object({
      name: z.string().nonempty("Name is required."),
      email: z
        .string()
        .email("Email must be a valid email address.")
        .nonempty("Email is required."),
      password: z
        .string()
        .min(6, "Password must be at least 6 characters long.")
        .nonempty("Password is required."),
      agreedToPolicy: z.boolean().optional(), // Add agreedToPolicy to schema
    })
    .superRefine(async (data, ctx) => {
      // Check if a user with the same email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        ctx.addIssue({
          path: ["email"],
          message: `User with email ${data.email} already exists.`,
        });
      }
    });

  try {
    // Use the reusable validation function
    const validationErrors = await validateRequest(schema, req.body, res);
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: config.defaultUserRole,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  console.log("[LOGIN_TRACE] Attempting login...");
  const schema = z.object({
    email: z.string().email("Invalid Email format"),
    password: z.string().nonempty("Password is required"),
  });

  try {
    console.log("[LOGIN_TRACE] Validating request body...");
    const validationResult = await validateRequest(schema, req.body, res);

    let actualErrors = null;
    if (typeof validationResult === 'object' && validationResult !== null) {
      for (const key in validationResult) {
        if (Object.prototype.hasOwnProperty.call(validationResult, key) &&
            typeof validationResult[key] === 'object' &&
            validationResult[key] !== null &&
            validationResult[key].type === 'validation') {
          actualErrors = validationResult; // It's the error object
          break;
        }
      }
    }

    if (actualErrors) {
      console.log("[LOGIN_TRACE] Validation failed. Sending 400 response.", actualErrors);
      return res.status(400).json({ errors: actualErrors });
    }
    console.log("[LOGIN_TRACE] Validation successful.");

    const validatedData = validationResult;
    const { email, password } = validatedData;

    console.log(`[LOGIN_TRACE] Attempting to fetch user: ${email}`);
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        member: {
          include: {
            memberships: {
              orderBy: { packageEndDate: "desc" },
              take: 1,
            },
            chapter: true,
          },
        },
      },
    });
    console.log(`[LOGIN_TRACE] User fetched: ${user ? user.id : 'null'}`);

    if (!user) {
      console.log("[LOGIN_TRACE] User not found.");
      return next(createError(401, "Invalid credentials"));
    }

    console.log("[LOGIN_TRACE] Comparing password...");
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`[LOGIN_TRACE] Password valid: ${isPasswordValid}`);
    if (!isPasswordValid) {
      console.log("[LOGIN_TRACE] Invalid password.");
      return next(createError(401, "Invalid credentials"));
    }

    console.log(`[LOGIN_TRACE] Checking if user active: ${user.active}`);
    if (!user.active) {
      console.log("[LOGIN_TRACE] User inactive.");
      return next(createError(403, "Account is inactive. Please contact support."));
    }

    // Policy Acceptance Logic
    console.log("[LOGIN_TRACE] Starting policy acceptance logic...");
    let requiresPolicyAcceptance = false;
    console.log("[LOGIN_TRACE] Fetching site policy setting...");
    const sitePolicySetting = await prisma.siteSetting.findUnique({
      where: { key: POLICY_TEXT_KEY },
    });
    console.log(`[LOGIN_TRACE] Site policy setting fetched: ${sitePolicySetting ? 'found' : 'not found'}, version: ${sitePolicySetting?.version}`);
    const activePolicyVersion = sitePolicySetting?.version;

    if (user.role !== "admin") {
      console.log("[LOGIN_TRACE] User is not admin, evaluating policy acceptance.");
      if (sitePolicySetting && activePolicyVersion != null) {
        requiresPolicyAcceptance = user.policyAcceptedVersion == null || user.policyAcceptedVersion < activePolicyVersion;
        console.log(`[LOGIN_TRACE] Policy set. User accepted version: ${user.policyAcceptedVersion}, Current policy version: ${activePolicyVersion}, Requires acceptance: ${requiresPolicyAcceptance}`);
      } else {
        requiresPolicyAcceptance = user.policyAcceptedVersion == null;
        console.log(`[LOGIN_TRACE] No policy set or no version. User accepted version: ${user.policyAcceptedVersion}, Requires acceptance: ${requiresPolicyAcceptance}`);
      }
    } else {
      console.log("[LOGIN_TRACE] User is admin, skipping policy acceptance check.");
    }
    console.log("[LOGIN_TRACE] Policy acceptance logic complete.");

    console.log("[LOGIN_TRACE] Updating lastLogin...");
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });
    console.log("[LOGIN_TRACE] lastLogin updated.");

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    console.log("[LOGIN_TRACE] Base token payload created.");

    if (user.member) {
      console.log("[LOGIN_TRACE] User is a member. Processing member details...");
      tokenPayload.memberId = user.member.id;
      tokenPayload.chapterId = user.member.chapterId;
      tokenPayload.isMember = true;

      console.log(`[LOGIN_TRACE] Checking member active status: ${user.member.active}`);
      if (!user.member.active) {
        console.log("[LOGIN_TRACE] Member account inactive.");
        return next(createError(403, "Your membership account is inactive. Please contact support."));
      }

      const latestMembership = user.member.memberships?.[0];
      console.log(`[LOGIN_TRACE] Latest membership: ${latestMembership ? 'found' : 'not found'}`);
      if (latestMembership && new Date(latestMembership.packageEndDate) < new Date()) {
        console.log("[LOGIN_TRACE] Membership package expired.");
        return next(createError(403, "Your membership package has expired. Please renew your membership."));
      }
      if (!latestMembership) {
        console.log("[LOGIN_TRACE] No active membership package found for member.");
      }
      console.log("[LOGIN_TRACE] Member details processing complete.");
    } else {
      tokenPayload.isMember = false;
      console.log("[LOGIN_TRACE] User is not a member.");
    }

    console.log("[LOGIN_TRACE] Signing JWT token...");
    const token = jwt.sign(tokenPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });
    console.log("[LOGIN_TRACE] JWT token signed.");

    const { password: _, resetToken: __, resetTokenExpires: ___, ...userWithoutSensitiveData } = user;

    console.log("[LOGIN_TRACE] Preparing to send response...");
    res.json({
      message: "Login successful",
      token,
      user: userWithoutSensitiveData,
      requiresPolicyAcceptance,
      memberDetails: user.member,
    });
    console.log("[LOGIN_TRACE] Response should have been sent.");
  } catch (error) {
    console.error("[LOGIN_ERROR] Error during login:", error);
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  const schema = z.object({
    email: z
      .string()
      .email("Invalid Email format")
      .nonempty("Email is required"),
  });
  console.log("Forgot password request:", req.body);

  try {
    const validationErrors = await validateRequest(schema, req.body, res);
    const { email, resetUrl } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return setTimeout(() => {
        res.status(404).json({ errors: { message: "User not found" } });
      }, 3000);
    }

    const resetToken = uuidv4();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires: new Date(Date.now() + 3600000), // Token expires in 1 hour
      },
    });
    const resetLink = `${resetUrl}/${resetToken}`; // Replace with your actual domain
    const templateData = {
      name: user.name,
      resetLink,
      appName: config.appName,
    };
    await emailService.sendEmail(
      email,
      "Password Reset Request",
      "passwordReset",
      templateData
    );

    res.json({ message: "Password reset link sent" });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  console.log("Reset password request:", req.body);
  const schema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters long"),
  });

  try {
    // Use the reusable validation function
    const validationErrors = await validateRequest(schema, req.body, res);
    const { password } = req.body;
    const { token } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() }, // Check if the token is not expired
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ errors: { message: "Invalid or expired token" } });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null, // Clear the token after use
        resetTokenExpires: null,
      },
    });
    res.json({ message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
};

// Controller to get the site policy text
const getPolicyText = async (req, res, next) => {
  try {
    const policySetting = await prisma.siteSetting.findUnique({
      where: { key: POLICY_TEXT_KEY }, // Use the defined constant
    });

    if (!policySetting || typeof policySetting.value !== 'string') {
      return next(createError(404, "Policy text not found or is not in the correct format."));
    }

    res.json({ policyText: policySetting.value });
  } catch (error) {
    console.error("Error fetching policy text:", error);
    next(createError(500, "Failed to retrieve policy text."));
  }
};

const acceptPolicy = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming isAuthenticated middleware adds user to req

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in token.' });
    }

    // Get the current policy version from SiteSetting
    const sitePolicySetting = await prisma.siteSetting.findUnique({
      where: { key: POLICY_TEXT_KEY },
    });

    if (!sitePolicySetting || sitePolicySetting.version == null) {
      // This case means policy isn't configured properly in settings, or version is missing.
      // It's an internal issue if acceptPolicy is called when no policy/version exists.
      console.error(`Attempted to accept policy, but no policy/version found in SiteSetting for key: ${POLICY_TEXT_KEY}`);
      return next(createError(500, "Could not accept policy: Policy configuration error."));
    }

    const currentPolicyVersion = sitePolicySetting.version;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        policyAccepted: true,
        policyAcceptedAt: new Date(),
        policyAcceptedVersion: currentPolicyVersion, // Store the version of the policy they accepted
      },
      select: { // Select only the fields safe to return
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLogin: true,
        policyAccepted: true,
        policyAcceptedAt: true,
        policyAcceptedVersion: true,
      },
    });

    res.status(200).json({
      message: 'Policy accepted successfully.',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error accepting policy:', error);
    next(error); // Pass to global error handler
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getUserAccessibleChapters,
  getUserChapterRoles,
  getPolicyText,
  acceptPolicy,
};
