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
  // Zod schema for login validation
  const loginSchema = z.object({
    email: z.string().email("Invalid email format."),
    password: z.string().nonempty("Password is required."),
    // agreedToPolicy removed as it's handled post-login if needed
  });

  try {
    // Perform synchronous validation directly
    const validatedData = loginSchema.parse(req.body);
    // If parse succeeds, validatedData will contain the data.
    // If it fails, it will throw a ZodError.

    const { email, password } = validatedData; // Use validatedData, agreedToPolicy removed

    // Get the last update time of the active site policy
    const activePolicy = await prisma.sitePolicy.findFirst({
      where: { isActive: true },
      // No need for orderBy if we strictly maintain only one active policy
      // orderBy: { updatedAt: 'desc' }, 
    });

    // Critical: If no active policy is found, it's a configuration error.
    // For now, we log an error. Depending on requirements, this might need to block login
    // or default to requiring acceptance if user.policyAcceptedAt is null.
    if (!activePolicy) {
      console.error("CRITICAL: No active site policy found during login. Policy re-acceptance logic might not function as expected.");
    }

    // First try to find a member (since members are also users)
    const member = await prisma.member.findUnique({
      where: { email },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            role: true,
            active: true,
            lastLogin: true,
            policyAccepted: true,
            policyAcceptedAt: true, // Include policyAcceptedAt for members
          },
        },
        chapter: true,
        // Eager load chapterRoles for the member to be used by getUserChapterRoles if called through member path
        chapterRoles: {
          select: {
            roleType: true,
            chapterId: true,
          }
        }
      },
    });

    if (member) {
      if (!member.users) {
        return res.status(500).json({
          errors: {
            message: "Member account is not properly linked to a user account",
          },
        });
      }

      console.log("Member found:", password, member.users.password);
      // Compare password with the user's password (not member's password)
      const isValidPassword = await bcrypt.compare(password, member.users.password);
      console.log("Password match:", isValidPassword);
      if (!isValidPassword) {
        return res
          .status(401)
          .json({ errors: { message: "Invalid email or password" } });
      }

      // Check if memberships are expired (hoExpiryDate or venueExpiryDate)
      const now = new Date();
      let hasActiveMembership = false;
      let expiryStatusChanged = false;

      // A user is active ONLY if BOTH venue and HO memberships are set AND at least one is active
      // If any membership is null, user should be inactive

      // Check if both memberships exist (not null)
      if (member.venueExpiryDate && member.hoExpiryDate) {
        // Check if at least one membership is active
        if (
          new Date(member.venueExpiryDate) > now ||
          new Date(member.hoExpiryDate) > now
        ) {
          hasActiveMembership = true;
        }
      } else {
        // If any membership is null, user should be inactive
        hasActiveMembership = false;
      }

      // If membership status differs from user's active status, update it
      if (member.users.active !== hasActiveMembership) {
        console.log(
          `Updating user ID ${member.users.id} active status to ${hasActiveMembership} during login check`
        );
        // await prisma.user.update({
        //   where: { id: member.users.id },
        //   data: { active: hasActiveMembership }
        // });

        // If we're setting to inactive, we need to reject the login
        if (!hasActiveMembership) {
          return res.status(403).json({
            errors: {
              message: "Account is inactive due to expired membership",
            },
          });
        }
      }

      // Regular inactive check
      if (!member.active || !member.users.active) {
        return res
          .status(403)
          .json({ errors: { message: "Account is inactive" } });
      }

      const token = jwt.sign({ userId: member.users.id }, jwtConfig.secret, {
        expiresIn: jwtConfig.expiresIn,
      });

      // Update last login time
      const updatedUser = await prisma.user.update({
        where: { id: member.users.id },
        data: { lastLogin: new Date() },
      });

      // Prepare user response (excluding password)
      const userResponse = {
        id: updatedUser ? updatedUser.id : member.users.id,
        name: updatedUser ? updatedUser.name : member.users.name,
        email: updatedUser ? updatedUser.email : member.users.email,
        role: updatedUser ? updatedUser.role : member.users.role,
        active: updatedUser ? updatedUser.active : member.users.active,
        lastLogin: updatedUser ? updatedUser.lastLogin : member.users.lastLogin,
        policyAccepted: member.users.policyAccepted,
        policyAcceptedAt: member.users.policyAcceptedAt,
      };

      const isAdmin = userResponse.role === 'SUPER_ADMIN' || userResponse.role === 'admin';
      let requiresPolicyAcceptance = false;

      if (!isAdmin) {
        if (!userResponse.policyAcceptedAt) { // User has never accepted any policy
          requiresPolicyAcceptance = true;
        } else if (activePolicy && userResponse.policyAcceptedAt < activePolicy.updatedAt) { // User accepted a version older than the current active policy
          requiresPolicyAcceptance = true;
        }
        // If activePolicy is null (config error), users who previously accepted will not be asked again.
        // This maintains previous behavior: if they accepted once, they are good unless a newer policy exists.
      }

      // Get accessible chapters grouped by role categories
      const accessibleChapters = await getUserAccessibleChapters(member.users.id);

      console.log('[DEBUG login] Sending accessibleChapters in response:', JSON.stringify(accessibleChapters, null, 2));
      return res.json({
        accesstoken: token,
        user: userResponse,
        isMember: true,
        accessibleChapters: accessibleChapters,
        requiresPolicyAcceptance: requiresPolicyAcceptance,
      });
    }

    // If no member found, try to find a regular user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        active: true,
        lastLogin: true,
        policyAccepted: true,
        policyAcceptedAt: true,
      },
    });

    if (!user) {
      return res
        .status(401)
        .json({ errors: { message: "Invalid email or password" } });
    }

    // Handle regular user login
    if (!(await bcrypt.compare(password, user.password))) {
      return res
        .status(401)
        .json({ errors: { message: "Invalid email or password" } });
    }

    if (!user.active) {
      return res
        .status(403)
        .json({ errors: { message: "Account is inactive" } });
    }

    const token = jwt.sign({ userId: user.id }, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });

    // Update last login time and policy acceptance if needed
    let updatedUser = null;
    const dataToUpdate = { lastLogin: new Date() };

    updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: dataToUpdate,
    });

    // Prepare user response (excluding password)
    const userResponse = {
      id: updatedUser ? updatedUser.id : user.id,
      name: updatedUser ? updatedUser.name : user.name,
      email: updatedUser ? updatedUser.email : user.email,
      role: updatedUser ? updatedUser.role : user.role,
      active: updatedUser ? updatedUser.active : user.active,
      lastLogin: updatedUser ? updatedUser.lastLogin : user.lastLogin,
      policyAccepted: updatedUser ? updatedUser.policyAccepted : user.policyAccepted,
    };

    const isAdmin = userResponse.role === 'SUPER_ADMIN' || userResponse.role === 'admin';
    let requiresPolicyAcceptance = false;

    if (!isAdmin) {
      if (!user.policyAcceptedAt) { // User has never accepted any policy
        requiresPolicyAcceptance = true;
      } else if (activePolicy && user.policyAcceptedAt < activePolicy.updatedAt) { // User accepted a version older than the current active policy
        requiresPolicyAcceptance = true;
      }
    }

    // Get other chapter roles if the user is linked to a member
    let otherChapterRoles = [];
    if (user.memberId) {
      otherChapterRoles = await getUserChapterRoles(user.id);
    }

    // Get all chapters user has access to based on their roles
    const accessibleChapters = await getUserAccessibleChapters(user.id);
    
    // Logging to help with debugging
    console.log("Response sent with accessibleChapters:", JSON.stringify(accessibleChapters));
    
    // Format the response exactly as required
    return res.json({ 
      token, 
      user: { 
        ...userResponse, 
        otherChapterRoles
      },
      accessibleChapters  // This is an array with the required format
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Map Zod errors to your desired format
      const errors = {};
      error.errors.forEach((err) => {
        // Assuming path[0] is the field name, adjust if your error structure is different
        errors[err.path[0]] = err.message;
      });
      return res.status(400).json({ errors });
    }
    // For other errors, pass to the main error handler
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
    console.log("ASDsdasd")
    const policySetting = await prisma.siteSetting.findUnique({
      where: { key: "policy" },
    });
    console.log(policySetting)

    if (!policySetting || !policySetting.value) {
      return next(createError(404, "Policy text not found."));
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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        policyAccepted: true,
        policyAcceptedAt: new Date(),
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
        // Add other relevant fields from your user model that are safe to expose
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
