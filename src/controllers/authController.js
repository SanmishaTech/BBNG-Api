const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { z } = require("zod");
const prisma = require("../config/db");
const emailService = require("../services/emailService");
const validateRequest = require("../utils/validateRequest");
const config = require("../config/config");
const createError = require("http-errors");
const jwtConfig = require("../config/jwt");
const { SUPER_ADMIN } = require("../config/roles");

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
  const schema = z.object({
    email: z.string().email("Invalid Email format").min(1, "email is required"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
  });

  try {
    const validationErrors = await validateRequest(schema, req.body, res);
    const { email, password } = req.body;

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

      // Update lastLogin timestamp
      await prisma.user.update({
        where: { id: member.users.id },
        data: { lastLogin: new Date() },
      });

      // Remove sensitive data from response
      const { password: memberPass, ...memberWithoutPassword } = member;
      const { password: userPass, ...userWithoutPassword } = member.users;

      // Get accessible chapters grouped by role categories
      const accessibleChapters = await getUserAccessibleChapters(member.users.id);

      console.log('[DEBUG login] Sending accessibleChapters in response:', JSON.stringify(accessibleChapters, null, 2));
      return res.json({
        token,
        user: {
          ...userWithoutPassword,
          member: memberWithoutPassword,
          isMember: true,
          accessibleChapters, // Use the new structured chapter access data
        },
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
        memberId: true,
        active: true,
        lastLogin: true,
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

    // Update lastLogin timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Get other chapter roles if the user is linked to a member
    let otherChapterRoles = [];
    if (user.memberId) { // Check if the user is associated with a member record
      // We need the actual member record to fetch chapterRoles, so we query member by user.id
      // This assumes user.id is the foreign key in the Member table (as per schema: Member.userId)
      otherChapterRoles = await getUserChapterRoles(user.id);
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    // Get all chapters user has access to based on their roles
    const accessibleChapters = await getUserAccessibleChapters(user.id);
    
    // Logging to help with debugging
    console.log("Response sent with accessibleChapters:", JSON.stringify(accessibleChapters));
    
    // Format the response exactly as required
    return res.json({ 
      token, 
      user: { 
        ...userWithoutPassword, 
        otherChapterRoles
      },
      accessibleChapters  // This is an array with the required format
    });
  } catch (error) {
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

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getUserChapterRoles,
  getUserAccessibleChapters,
};
