const { Prisma } = require("@prisma/client");
const prisma = require("../config/db"); // Ensure this path is correct and prisma is initialized
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest"); // Assuming this utility validates and returns parsed data or handles response
const createError = require("http-errors");
const bcrypt = require("bcryptjs");
const fs = require("fs").promises; // For file operations
const path = require("path"); // For path manipulation

/**
 * Wrap async route handlers and funnel errors through Express error middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    // Zod validation errors
    if (err.status === 400 && err.expose && err.errors) {
      return res.status(400).json({ errors: err.errors });
    }
    // General exposed 400 errors from createError
    if (err.status === 400 && err.expose) {
      return res.status(400).json({ errors: { message: err.message } });
    }
    // Prisma validation errors
    if (err.name === "PrismaClientValidationError") {
      console.error("PrismaClientValidationError:", err.message);
      return res
        .status(400)
        .json({ errors: { message: "Invalid data provided." } });
    }
    // Prisma known request errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002" && err.meta?.target) {
        const field = Array.isArray(err.meta.target)
          ? err.meta.target.join(", ")
          : String(err.meta.target); // Ensure field is a string
        return res.status(400).json({
          errors: {
            [field]: {
              type: "unique",
              message: `A record with this ${field} already exists.`,
            },
          },
        });
      }
      console.error(`Prisma Error Code: ${err.code}`, err.message);
    }
    // Log any other errors
    console.error(err); // Full error for server logs
    return res
      .status(err.status || 500)
      .json({ errors: { message: err.message || "Internal Server Error" } });
  });
};

// Zod schema for member data (assuming this is the same as provided)
const memberSchema = z.object({
  memberName: z.string().min(1, "Member name is required"),
  chapterId: z
    .number()
    .int()
    .positive("Chapter ID must be a positive integer")
    .optional(),
  stateId: z
    .number()
    .int()
    .positive("State ID must be a positive integer")
    .optional(),
  category: z.string().min(1, "Category is required"),
  businessCategory: z.string().optional(),
  gender: z.enum(["male", "female", "other"], {
    errorMap: () => ({ message: "Gender must be male, female, or other" }),
  }),
  dateOfBirth: z
    .string()
    .refine(
      (val) => !isNaN(new Date(val).getTime()),
      "Invalid date format for Date of Birth",
    ),
  mobile1: z
    .string()
    .min(10, "Primary mobile number must be at least 10 digits")
    .max(15, "Primary mobile number must be at most 15 digits"),
  mobile2: z
    .string()
    .max(15, "Secondary mobile number must be at most 15 digits")
    .optional(),
  gstNo: z.string().optional(),
  organizationName: z.string().optional(),
  businessTagline: z.string().optional(),
  organizationMobileNo: z
    .string()
    .min(10, "Organization mobile number must be at least 10 digits")
    .max(15, "Organization mobile number must be at most 15 digits")
    .optional(),
  organizationLandlineNo: z.string().optional(),
  organizationEmail: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email().optional(),
  ),

  orgAddressLine1: z.string().optional(),
  orgAddressLine2: z.string().optional(),
  orgLocation: z.string().optional(),
  orgPincode: z
    .string()
    .min(6, "Organization pincode must be 6 digits")
    .max(6, "Organization pincode must be 6 digits")
    .optional(),
  organizationWebsite: z.preprocess(
    (val) =>
      val && typeof val === "string" && val.trim() !== "" ? val : undefined,
    z.string().url("Invalid organization website URL").optional(),
  ),

  organizationDescription: z.string().optional(),
  addressLine1: z.string().optional(),
  location: z.string().optional(),
  addressLine2: z.string().optional(),
  pincode: z
    .string()
    .min(6, "Pincode must be 6 digits")
    .max(6, "Pincode must be 6 digits")
    .optional(),
  specificAsk: z.string().optional(),
  specificGive: z.string().optional(),
  clients: z.string().optional(),
  profilePicture: z.string().optional(),
  coverPhoto: z.string().optional(),
  logo: z.string().optional(),
  email: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email().optional(),
  ),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),
  // verifyPassword is not in the schema but was in the original destructuring.
  // If it's part of the form for confirmation, it should be in the schema or handled before validation.
});

/**
 * POST /api/members
 * Create a new Member and associated User account
 */
const createMember = asyncHandler(async (req, res) => {
  // Parse the request body to handle string numbers if necessary
  const body = { ...req.body };
  if (typeof body.businessCategory === "number") {
    body.businessCategory = body.businessCategory.toString();
  }
  if (body.chapterId && typeof body.chapterId === "string") {
    body.chapterId = parseInt(body.chapterId, 10);
    if (isNaN(body.chapterId)) {
      throw createError(400, "Invalid Chapter ID format.");
    }
  }

  // Parse stateId if it's provided as string
  if (body.stateId && typeof body.stateId === "string") {
    body.stateId = parseInt(body.stateId, 10);
    if (isNaN(body.stateId)) {
      throw createError(400, "Invalid State ID format.");
    }
  }

  // Validate request data (including files if any are part of memberSchema)
  // Assuming validateRequest handles req.files appropriately if they are defined in schema
  const parsedData = await validateRequest(memberSchema, body, req.files);

  // If validateRequest returns validation errors (an object of field errors), return them
  const fieldErrors = Object.entries(parsedData).filter(
    ([, v]) => v && typeof v === "object" && v.type === "validation",
  );
  if (fieldErrors.length > 0) {
    const errors = Object.fromEntries(fieldErrors);
    return res.status(400).json({ errors });
  }

  const {
    // verifyPassword, // Removed if not in schema, handle password confirmation if needed
    password,
    dateOfBirth,
    email,
    chapterId, // chapterId is now correctly parsed as number if it was string
    stateId, // stateId is also correctly parsed as number if it was string
    ...otherValidatedData
  } = parsedData;

  // Check if user already exists with this email
  const existingUser = await prisma.user.findUnique({
    where: { email: email },
  });

  if (existingUser) {
    // Clean up uploaded files if member creation fails due to existing user
    if (req.files) {
      for (const fieldKey of Object.keys(req.files)) {
        const fileArray = req.files[fieldKey];
        if (Array.isArray(fileArray)) {
          for (const file of fileArray) {
            if (file && file.filename) {
              try {
                // Corrected path for uploads, assuming 'uploads' is at project root
                await fs.unlink(
                  path.join(
                    __dirname,
                    "../../../uploads/members",
                    file.filename,
                  ),
                );
                console.log(`Cleaned up file: ${file.filename}`);
              } catch (error) {
                console.error(
                  `Error deleting file ${file.filename} during cleanup:`,
                  error,
                );
              }
            }
          }
        }
      }
    }
    // Throw a specific error for unique email constraint
    throw createError(400, "Validation failed", {
      expose: true, // Ensure this error is exposed to the client
      errors: {
        email: {
          type: "unique",
          message: "A user with this email already exists.",
        },
      },
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Start a transaction to ensure both member and user are created, or neither.
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the User account
      const user = await tx.user.create({
        data: {
          name: otherValidatedData.memberName, // Use memberName for User's name
          email: email,
          password: hashedPassword,
          role: "member", // Default role for new members
          active: true, // Default to active
        },
      });

      // Convert dateOfBirth string to Date object
      const dateOfBirthObj = new Date(dateOfBirth);
      if (isNaN(dateOfBirthObj.getTime())) {
        // This should ideally be caught by Zod, but double-check
        throw createError(
          400,
          "Invalid date format for date of birth. Please use YYYY-MM-DD or a valid date string.",
        );
      }

      // 2. Create the Member record and link it to the User and Chapter
      const memberData = {
        ...otherValidatedData,
        email: email, // Member's email (unique, same as User's)
        password: hashedPassword, // Store hashed password in Member as per schema
        dateOfBirth: dateOfBirthObj,
        active: true, // Explicitly set active to true (despite schema default)
        // Establish the relationship to the User using proper Prisma relation syntax
        users: {
          connect: { id: user.id },
        },
      };

      // Handle file uploads if present
      if (req.files) {
        Object.entries(req.files).forEach(([key, files]) => {
          if (Array.isArray(files) && files.length > 0) {
            const file = files[0];
            // Build the complete path using the UUID from the request
            const uuid = req.fileUUID[key];
            const fullPath = path.join(
              "uploads",
              "members",
              key,
              uuid,
              file.originalname,
            );
            memberData[key] = fullPath; // Store the complete path
          }
        });
      }

      // Conditionally connect to chapter
      if (chapterId) {
        memberData.chapter = {
          connect: { id: chapterId },
        };
      }

      // Conditionally connect to state
      if (stateId) {
        memberData.state = {
          connect: { id: stateId },
        };
      }

      const member = await tx.Member.create({
        data: memberData,
        include: {
          // Include related data in the response
          users: true,
          chapter: {
            select: {
              id: true,
              name: true,
              location: {
                select: {
                  id: true,
                  location: true,
                },
              },
              zones: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          // Include the 'users' relation which points to the User model
          // This will nest the created User object under 'member.users'
          users: {
            select: {
              // Select specific user fields to avoid exposing password from here too
              id: true,
              name: true,
              email: true,
              role: true,
              active: true,
              lastLogin: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      // 3. Optionally, update the User record with the memberId.
      // This is useful if User.memberId is intended to store this link.
      // Your User schema has `memberId Int?`.
      await tx.user.update({
        where: { id: user.id },
        data: { memberId: member.id },
      });

      // The 'user' object returned here is the one initially created.
      // The 'member' object will contain the nested 'users' (User data).
      return { member, user }; // user is the initial user object
    });

    // Sanitize password from the top-level member object before sending the response.
    // The nested 'users' object is already selected without its password.
    const { password: _memberPassword, ...sanitizedMember } = result.member;

    res.status(201).json({
      ...sanitizedMember, // This now contains member data (password removed) and nested user data (password not selected)
      message: "Member and user account created successfully.",
    });
  } catch (error) {
    // The asyncHandler will catch and process this error.
    // If it's a Prisma unique constraint error not caught by the initial check (e.g., on Member.email if different logic)
    // or other transaction failure.

    // Clean up uploaded files if transaction fails
    if (req.files) {
      for (const fieldKey of Object.keys(req.files)) {
        const fileArray = req.files[fieldKey];
        if (Array.isArray(fileArray)) {
          for (const file of fileArray) {
            if (file && file.filename) {
              try {
                await fs.unlink(
                  path.join(
                    __dirname,
                    "../../../uploads/members",
                    file.filename,
                  ),
                );
                console.log(
                  `Cleaned up file on transaction error: ${file.filename}`,
                );
              } catch (cleanupError) {
                console.error(
                  `Error deleting file ${file.filename} during transaction error cleanup:`,
                  cleanupError,
                );
              }
            }
          }
        }
      }
    }
    // Re-throw the error to be handled by asyncHandler
    // Ensure the error is an HttpError for proper client response
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const field = Array.isArray(error.meta?.target)
        ? error.meta.target.join(", ")
        : String(error.meta?.target);
      throw createError(
        400,
        `A record with this ${field} already exists. Transaction rolled back.`,
        { expose: true },
      );
    }
    if (!error.status) {
      // If it's not already an HttpError
      console.error("Transaction failed:", error); // Log the original error
      throw createError(
        500,
        error.message ||
          "Failed to create member and user account due to a server error.",
      );
    }
    throw error; // rethrow if already an HttpError or for asyncHandler to process
  }
});

const getMembers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search || "";
  const sortBy = req.query.sortBy || "memberName";
  const sortOrder =
    req.query.sortOrder?.toLowerCase() === "desc" ? "desc" : "asc";
  const active = req.query.active;
  const chapterId = req.query.chapterId ? parseInt(req.query.chapterId) : null;

  // Build where clause for filtering
  const where = {};

  // Exclude current user from results when loading members for one-to-one meetings
  if (req.query.excludeCurrentUser === "true" && req.user) {
    // Get the current user's member ID
    const currentMember = await prisma.member.findFirst({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (currentMember) {
      where.NOT = {
        id: currentMember.id,
      };
    }
  }

  if (search) {
    where.OR = [
      { memberName: { contains: search } },
      { email: { contains: search } },
      { organizationName: { contains: search } },
    ];
  }

  // Handle active filter
  if (active === "true") {
    where.active = true;
  } else if (active === "false") {
    where.active = false;
  }

  // Filter by chapter if chapterId is provided
  if (chapterId) {
    where.chapterId = chapterId;
  }

  try {
    // Get total count for pagination
    const total = await prisma.member.count({ where });

    // Get members with pagination, sorting, and relations
    const members = await prisma.member.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
            location: {
              select: {
                id: true,
                location: true,
              },
            },
            zones: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            lastLogin: true,
          },
        },
      },
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Process members to calculate expiry status and format data
    const now = new Date();
    const sanitizedMembers = members.map((member) => {
      const { password, ...sanitizedMember } = member;

      // Check if either HO or venue has expired
      const hoExpired = member.hoExpiryDate ? member.hoExpiryDate < now : true;
      const venueExpired = member.venueExpiryDate
        ? member.venueExpiryDate < now
        : true;

      // Determine the earlier expiry date
      let expiryDate = null;
      let expiryType = null;

      if (member.hoExpiryDate && member.venueExpiryDate) {
        if (member.hoExpiryDate < member.venueExpiryDate) {
          expiryDate = member.hoExpiryDate;
          expiryType = "HO";
        } else {
          expiryDate = member.venueExpiryDate;
          expiryType = "Venue";
        }
      } else if (member.hoExpiryDate) {
        expiryDate = member.hoExpiryDate;
        expiryType = "HO";
      } else if (member.venueExpiryDate) {
        expiryDate = member.venueExpiryDate;
        expiryType = "Venue";
      }

      // Determine if member is active based on expiry dates
      const isActive = !(hoExpired || venueExpired);

      // If the member status is active but expiry dates indicate they should be inactive,
      // update the user's active status in the database (async, don't wait for completion)
      if (!isActive && member.userId) {
        prisma.user
          .update({
            where: { id: member.userId },
            data: { active: false },
          })
          .catch((err) =>
            console.error(
              `Failed to update user status for member ${member.id}:`,
              err,
            ),
          );
      }

      return {
        ...sanitizedMember,
        isActive,
        // Only include expiry information if the member is active
        ...(isActive
          ? {
              expiryDate,
              expiryType,
              daysUntilExpiry: expiryDate
                ? Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
                : null,
            }
          : {
              // For expired members, just show that they're expired
              isExpired: true,
            }),
      };
    });

    res.json({
      members: sanitizedMembers,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    throw createError(500, "Failed to fetch members");
  }
});

const getMemberById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(parseInt(id))) {
    throw createError(400, "Invalid member ID provided");
  }

  try {
    const member = await prisma.member.findUnique({
      where: {
        id: parseInt(id),
      },
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
            location: {
              select: {
                id: true,
                location: true,
                zone: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            zones: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        state: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            lastLogin: true,
          },
        },
      },
    });

    if (!member) {
      throw createError(404, "Member not found");
    }

    // Transform state data to match the desired format
    const { password, state, ...restMember } = member;

    // Create sanitized member with transformed state data
    const sanitizedMember = {
      ...restMember,
      stateId: state?.id || null,
      stateName: state?.name || null,
    };

    // Calculate expiry status
    const now = new Date();
    const hoExpired = member.hoExpiryDate ? member.hoExpiryDate < now : true;
    const venueExpired = member.venueExpiryDate
      ? member.venueExpiryDate < now
      : true;

    // Determine the earlier expiry date
    let expiryDate = null;
    let expiryType = null;

    if (member.hoExpiryDate && member.venueExpiryDate) {
      if (member.hoExpiryDate < member.venueExpiryDate) {
        expiryDate = member.hoExpiryDate;
        expiryType = "HO";
      } else {
        expiryDate = member.venueExpiryDate;
        expiryType = "Venue";
      }
    } else if (member.hoExpiryDate) {
      expiryDate = member.hoExpiryDate;
      expiryType = "HO";
    } else if (member.venueExpiryDate) {
      expiryDate = member.venueExpiryDate;
      expiryType = "Venue";
    }

    // Determine if member is active based on expiry dates
    const isActive = !(hoExpired || venueExpired);

    // If not active due to expiry, update user record
    if (!isActive && member.userId) {
      prisma.user
        .update({
          where: { id: member.userId },
          data: { active: false },
        })
        .catch((err) =>
          console.error(
            `Failed to update user status for member ${member.id}:`,
            err,
          ),
        );
    }

    // Add expiry information to the response
    const memberWithExpiry = {
      ...sanitizedMember,
      isActive,
      // Only include expiry information if the member is active
      ...(isActive
        ? {
            expiryDate,
            expiryType,
            daysUntilExpiry: expiryDate
              ? Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
              : null,
          }
        : {
            // For expired members, just show that they're expired
            isExpired: true,
          }),
    };

    res.json(memberWithExpiry);
  } catch (error) {
    console.error("Error fetching member:", error);
    if (error.status === 404) {
      throw error;
    }
    throw createError(500, "Failed to fetch member details");
  }
});

// Placeholder for other controller functions (getMembers, getMemberById, etc.)
// Ensure they are defined or imported if this file is meant to be complete.
const updateMember = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(parseInt(id))) {
    throw createError(400, "Invalid member ID provided");
  }

  try {
    // Find the member first to check if they exist
    const existingMember = await prisma.member.findUnique({
      where: { id: parseInt(id) },
      include: { users: true },
    });

    if (!existingMember) {
      throw createError(404, "Member not found");
    }

    // Handle request body
    const body = { ...req.body };

    // Convert dateOfBirth to dateOfBirth if it exists
    if (body.dateOfBirth) {
      const dateOfBirth = new Date(body.dateOfBirth);
      if (isNaN(dateOfBirth.getTime())) {
        throw createError(400, "Invalid date format for date of birth");
      }
      body.dateOfBirth = dateOfBirth;
      delete body.dateOfBirth; // Remove dateOfBirth as we're using dateOfBirth
    }

    if (typeof body.businessCategory === "number") {
      body.businessCategory = body.businessCategory.toString();
    }

    if (body.chapterId && typeof body.chapterId === "string") {
      body.chapterId = parseInt(body.chapterId, 10);
      if (isNaN(body.chapterId)) {
        throw createError(400, "Invalid Chapter ID format");
      }
    }

    // Parse stateId if provided
    if (body.stateId) {
      if (typeof body.stateId === "string") {
        body.stateId = parseInt(body.stateId, 10);
        if (isNaN(body.stateId)) {
          throw createError(400, "Invalid State ID format");
        }
      }
    }

    // Start transaction to update both member and user
    const result = await prisma.$transaction(async (tx) => {
      // Prepare member update data
      const memberUpdateData = { ...body };

      // Handle file uploads if present
      if (req.files) {
        Object.entries(req.files).forEach(([key, files]) => {
          if (Array.isArray(files) && files.length > 0) {
            const file = files[0];
            // Build the complete path using the UUID from the request
            const uuid = req.fileUUID[key];
            const fullPath = path.join(
              "uploads",
              "members",
              key,
              uuid,
              file.originalname,
            );
            memberUpdateData[key] = fullPath; // Store the complete path
          }
        });
      }

      // If password is being updated, hash it
      if (memberUpdateData.password) {
        memberUpdateData.password = await bcrypt.hash(
          memberUpdateData.password,
          10,
        );
      }

      // Update chapter connection if chapterId is provided
      if (body.chapterId) {
        memberUpdateData.chapter = {
          connect: { id: body.chapterId },
        };
        delete memberUpdateData.chapterId;
      }

      // Update state connection if stateId is provided
      if (body.stateId) {
        memberUpdateData.state = {
          connect: { id: body.stateId },
        };
        delete memberUpdateData.stateId;
      }

      // Update the member record
      const updatedMember = await tx.member.update({
        where: { id: parseInt(id) },
        data: memberUpdateData,
        include: {
          chapter: {
            select: {
              id: true,
              name: true,
              location: {
                select: {
                  id: true,
                  location: true,
                },
              },
              zones: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              active: true,
              lastLogin: true,
            },
          },
        },
      });

      // Update the associated user if email or password changed
      if (existingMember.users && (body.email || body.password)) {
        const userUpdateData = {};
        if (body.email) userUpdateData.email = body.email;
        if (body.password) {
          userUpdateData.password = await bcrypt.hash(body.password, 10);
        }

        await tx.user.update({
          where: { id: existingMember.users.id },
          data: userUpdateData,
        });
      }

      return updatedMember;
    });

    // Remove sensitive data before sending response
    const { password: _, ...sanitizedMember } = result;
    res.json(sanitizedMember);
  } catch (error) {
    // Handle cleanup of uploaded files if the transaction failed
    if (req.files) {
      for (const fieldKey of Object.keys(req.files)) {
        const fileArray = req.files[fieldKey];
        if (Array.isArray(fileArray)) {
          for (const file of fileArray) {
            if (file && file.filename) {
              try {
                await fs.unlink(
                  path.join(
                    __dirname,
                    "../../../uploads/members",
                    file.filename,
                  ),
                );
              } catch (cleanupError) {
                console.error(
                  `Error deleting file ${file.filename} during cleanup:`,
                  cleanupError,
                );
              }
            }
          }
        }
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        // Handle unique constraint violations
        const field = Array.isArray(error.meta?.target)
          ? error.meta.target.join(", ")
          : String(error.meta?.target);
        throw createError(400, `A record with this ${field} already exists`);
      }
    }
    throw error;
  }
});

const deleteMember = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(parseInt(id))) {
    throw createError(400, "Invalid member ID provided");
  }

  try {
    // Find the member first to check if they exist and get their file paths
    const existingMember = await prisma.member.findUnique({
      where: { id: parseInt(id) },
      include: {
        users: true,
        chapter: true,
      },
    });

    if (!existingMember) {
      throw createError(404, "Member not found");
    }

    // Start transaction to delete member and all related records
    const result = await prisma.$transaction(async (tx) => {
      const memberId = parseInt(id);

      // Delete related records in correct order to avoid foreign key constraints
      
      // 1. Delete zone role history first (references zone roles)
      await tx.zoneRoleHistory.deleteMany({
        where: { memberId: memberId }
      });

      // 2. Delete zone roles
      await tx.zoneRole.deleteMany({
        where: { memberId: memberId }
      });

      // 3. Delete chapter role history first (references chapter roles)
      await tx.chapterRoleHistory.deleteMany({
        where: { memberId: memberId }
      });

      // 4. Delete chapter roles
      await tx.chapterRole.deleteMany({
        where: { memberId: memberId }
      });

      // 5. Delete thank you slips where member is the sender
      await tx.thankYouSlip.deleteMany({
        where: { fromMemberId: memberId }
      });

      // 6. Delete reference status history first (references references)
      const memberReferences = await tx.reference.findMany({
        where: {
          OR: [
            { giverId: memberId },
            { receiverId: memberId }
          ]
        },
        select: { id: true }
      });
      
      if (memberReferences.length > 0) {
        const referenceIds = memberReferences.map(ref => ref.id);
        await tx.referenceStatusHistory.deleteMany({
          where: { referenceId: { in: referenceIds } }
        });
        
        // Delete thank you slips related to these references
        await tx.thankYouSlip.deleteMany({
          where: { referenceId: { in: referenceIds } }
        });
      }

      // 7. Delete references (both given and received)
      await tx.reference.deleteMany({
        where: {
          OR: [
            { giverId: memberId },
            { receiverId: memberId }
          ]
        }
      });

      // 8. Delete one-to-ones (both requested and received)
      await tx.oneToOne.deleteMany({
        where: {
          OR: [
            { requesterId: memberId },
            { requestedId: memberId }
          ]
        }
      });

      // 9. Delete meeting attendances
      await tx.meetingAttendance.deleteMany({
        where: { memberId: memberId }
      });

      // 10. Update visitors to remove the invitation reference (set to null instead of delete)
      await tx.visitor.updateMany({
        where: { invitedById: memberId },
        data: { invitedById: null }
      });

      // 11. Delete requirements
      await tx.requirement.deleteMany({
        where: { memberId: memberId }
      });

      // 12. Delete memberships
      await tx.membership.deleteMany({
        where: { memberId: memberId }
      });

      // 13. Clear the memberId reference in the User table first
      if (existingMember.users) {
        await tx.user.update({
          where: { id: existingMember.users.id },
          data: { memberId: null }
        });
      }

      // 14. Finally delete the member record
      const deletedMember = await tx.member.delete({
        where: { id: memberId },
      });

      // 15. If there's an associated user account, delete it
      if (existingMember.users) {
        await tx.user.delete({
          where: { id: existingMember.users.id },
        });
      }

      return deletedMember;
    });

    // After successful database deletion, clean up any uploaded files
    const profilePictures = [
      existingMember.profilePicture,
      existingMember.coverPhoto,
      existingMember.logo,
    ].filter(Boolean); // Remove null/undefined values

    // Delete the profile pictures if they exist
    for (const picturePath of profilePictures) {
      try {
        await fs.unlink(path.join(__dirname, "../../../", picturePath));
        console.log(`Deleted file: ${picturePath}`);
      } catch (error) {
        // Log error but don't fail the request if file deletion fails
        console.error(`Error deleting file ${picturePath}:`, error);
      }
    }

    res.json({
      message: "Member deleted successfully",
      deletedMemberId: id,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle specific Prisma errors
      if (error.code === "P2025") {
        throw createError(404, "Member not found");
      }
      // Handle other potential Prisma errors
      console.error("Prisma error:", error);
      throw createError(500, "Database error while deleting member");
    }
    throw error;
  }
});

const updateProfilePictures = async (req, res) => {
  /* ... existing code ... */
};

const deleteProfilePicture = async (req, res) => {
  /* ... existing code ... */
};
const getProfilePicture = asyncHandler(async (req, res) => {
  /* ... existing code ... */
});

/**
 * PATCH /api/members/:id/user-status
 * Toggle only the user's active status without affecting membership expiry
 */
const toggleUserStatus = asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.id);

  try {
    // Find the member to get the associated user
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        userId: true,
        users: {
          select: {
            id: true,
            active: true,
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({
        errors: { message: "Member not found" },
      });
    }

    if (!member.userId || !member.users) {
      return res.status(400).json({
        errors: { message: "This member has no associated user account" },
      });
    }

    // Update only the user's active status
    const updatedUser = await prisma.user.update({
      where: { id: member.userId },
      data: { active: !member.users.active },
    });

    res.json({
      message: `User has been set to ${
        updatedUser.active ? "active" : "inactive"
      }`,
      active: updatedUser.active,
    });
  } catch (error) {
    console.error("Error toggling user status:", error);
    throw createError(500, "Error updating user status");
  }
});

/**
 * GET /api/members/:id/membership-status
 * Check the membership status of a member based on expiry dates
 */
const getMembershipStatus = asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.id);

  try {
    // Get the member with expiry dates
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        memberName: true,
        hoExpiryDate: true,
        venueExpiryDate: true,
        userId: true,
        users: {
          select: {
            id: true,
            active: true,
          },
        },
        memberships: {
          where: {
            active: true,
            packageEndDate: {
              gte: new Date(),
            },
          },
          select: {
            id: true,
            packageStartDate: true,
            packageEndDate: true,
            package: {
              select: {
                id: true,
                packageName: true,
                isVenueFee: true,
              },
            },
          },
          orderBy: {
            packageEndDate: "desc",
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({
        errors: { message: "Member not found" },
      });
    }

    const now = new Date();
    const hoExpired = member.hoExpiryDate ? member.hoExpiryDate < now : true;
    const venueExpired = member.venueExpiryDate
      ? member.venueExpiryDate < now
      : true;

    // Determine the earlier expiry date for display
    let earlierExpiryDate = null;
    let expiryType = null;

    if (member.hoExpiryDate && member.venueExpiryDate) {
      if (member.hoExpiryDate < member.venueExpiryDate) {
        earlierExpiryDate = member.hoExpiryDate;
        expiryType = "HO";
      } else {
        earlierExpiryDate = member.venueExpiryDate;
        expiryType = "Venue";
      }
    } else if (member.hoExpiryDate) {
      earlierExpiryDate = member.hoExpiryDate;
      expiryType = "HO";
    } else if (member.venueExpiryDate) {
      earlierExpiryDate = member.venueExpiryDate;
      expiryType = "Venue";
    }

    // Active if both HO expiry and venue expiry dates are in the future
    // If either expiry date doesn't exist, that part is considered expired
    const hoActive = member.hoExpiryDate && member.hoExpiryDate >= now;
    const venueActive = member.venueExpiryDate && member.venueExpiryDate >= now;
    const isActive = hoActive && venueActive;

    // If member is inactive due to expiry, update the user's active status
    if (!isActive && member.userId) {
      await prisma.user.update({
        where: { id: member.userId },
        data: { active: false },
      });
    }

    // Prepare response
    const response = {
      id: member.id,
      memberName: member.memberName,
      active: isActive,
      hasActiveMemberships: member.memberships.length > 0,
      hoExpiryDate: member.hoExpiryDate,
      venueExpiryDate: member.venueExpiryDate,
      hoExpired,
      venueExpired,
      earlierExpiryDate,
      expiryType,
      memberships: member.memberships,
    };

    res.json(response);
  } catch (error) {
    console.error("Error checking membership status:", error);
    throw createError(500, "Error checking membership status");
  }
});

/**
 * GET /api/members/:id/reference-details
 * Get member info specifically formatted for reference autofill
 */
const getMemberDetailsForReference = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(parseInt(id, 10))) {
    throw createError(400, "Valid member ID is required");
  }

  const memberId = parseInt(id, 10);

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      memberName: true,
      email: true,
      mobile1: true,
      mobile2: true,
      addressLine1: true,
      addressLine2: true,
      location: true,
      pincode: true,
      organizationName: true,
      orgAddressLine1: true,
      orgAddressLine2: true,
      orgLocation: true,
      orgPincode: true,
    },
  });

  if (!member) {
    throw createError(404, "Member not found");
  }

  res.json({ member });
});

/**
 * Search members with more flexible search criteria
 * This is used by the frontend member search component
 */
const searchMembers = async (req, res, next) => {
  try {
    let {
      page = 1,
      limit = 20,
      search = "",
      category,
      businessCategory,
      chapterId, // Accept chapterId as a query parameter
      chapterName, // Accept chapterName as a query parameter
      sortBy = "memberName",
      sortOrder = "asc",
    } = req.query;

    // Parse pagination parameters
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const skip = (page - 1) * limit;

    // Build where conditions
    const where = { active: true };

    // Add chapterId filter if provided
    if (chapterId) {
      const parsedChapterId = parseInt(chapterId, 10);
      if (!isNaN(parsedChapterId)) {
        where.chapterId = parsedChapterId;
      }
    }

    // Add chapterName filter if provided
    if (chapterName) {
      where.chapter = {
        name: {
          contains: chapterName,
          mode: 'insensitive', // Optional: for case-insensitive search
        },
      };
    }

    // Add category filter if provided
    if (category) {
      where.category = category;
    }

    // Add business category filter if provided
    if (businessCategory) {
      where.businessCategory = businessCategory;
    }

    // Add search filter if provided
    if (search) {
      where.OR = [
        { memberName: { contains: search } },
         { organizationName: { contains: search } },
        { businessCategory: { contains: search } },
        { specificGive: { contains: search } },
        { specificAsk: { contains: search } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.member.count({ where });

    // Execute query with pagination and sorting
    const members = await prisma.member.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        memberName: true,
        email: true,
        mobile1: true,
        mobile2: true,
        profilePicture: true,
        coverPhoto: true,
        logo: true,
        category: true,
        chapterId: true,
        chapter: true,
        businessCategory: true,
        organizationName: true,
        businessTagline: true,
        organizationWebsite: true,
        organizationDescription: true,
        specificGive: true,
        specificAsk: true,
        createdAt: true,
        users: {
          select: {
            lastLogin: true,
            role: true // Select the 'role' field (String) directly from the User model
          },
        },
      },
    });

    // Return paginated results
    return res.json({
      members,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error in searchMembers:", error);
    return next(createError(500, "Server error during member search"));
  }
};

/**
 * Get the current user's member profile
 * @route GET /api/members/profile
 */
const getCurrentMemberProfile = async (req, res) => {
  try {
    // Ensure we have a user ID from authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({ errors: { message: "Not authenticated" } });
    }

    const userId = req.user.id;
    console.log(`Getting member profile for user ID: ${userId}`);

    // Find member profile for current user
    const member = await prisma.member.findFirst({
      where: { userId },
      select: {
        id: true,
        memberName: true,
        organizationName: true,
        chapterId: true,
        email: true,
        mobile1: true, // Changed from phoneNumber to mobile1 based on your schema
        profilePicture: true,
        chapter: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Log what we found for debugging
    if (member) {
      console.log(`Found member profile: ${member.id} - ${member.memberName}`);
    } else {
      console.log(`No member profile found for user ID: ${userId}`);
    }

    if (!member) {
      return res.status(404).json({
        errors: { message: "Member profile not found for current user" },
      });
    }

    // Return the member profile
    res.status(200).json({ member });
  } catch (error) {
    console.error("Error getting member profile:", error);
    res
      .status(500)
      .json({ errors: { message: "Failed to get member profile" } });
  }
};

const getMemberActivitySummary = asyncHandler(async (req, res, next) => {
  const { memberId } = req.params;
  const id = parseInt(memberId, 10);

  if (isNaN(id)) {
    return next(createError(400, "Invalid member ID supplied."));
  }

  try {
    const memberExists = await prisma.member.findUnique({
      where: { id },
    });

    if (!memberExists) {
      return next(createError(404, "Member not found."));
    }

    // 1. Testimonials RECEIVED BY the member
    // Count ThankYouSlips where this member is the recipient (toWhomId)
    // and there is a non-empty testimony.
    const testimonials = await prisma.thankYouSlip.count({
      where: {
        toWhomId: id, // Member for whom the testimony is written
        testimony: {
           not: "", // Ensure testimony is not an empty string
        },
      },
    });

    // 2. Business Given (sourced ONLY from ThankYouSlip)
    // Sum of 'amount' from ThankYouSlips GIVEN BY this member.
    const thankYouSlipsGiven = await prisma.thankYouSlip.findMany({
      where: { fromMemberId: id }, // Slips given by this member
      select: { amount: true },
    });
    const businessGiven = thankYouSlipsGiven.reduce(
      (sum, slip) => sum + (parseFloat(slip.amount) || 0),
      0,
    );

    // 3. Business Received (sourced ONLY from ThankYouSlip)
    // Sum of 'amount' from ThankYouSlips RECEIVED BY this member.
    const thankYouSlipsReceived = await prisma.thankYouSlip.findMany({
      where: { toWhomId: id }, // Slips received by this member
      select: { amount: true },
    });
    const businessReceived = thankYouSlipsReceived.reduce(
      (sum, slip) => sum + (parseFloat(slip.amount) || 0),
      0,
    );

    // 4. References Given
    // Count of references GIVEN BY this member.
    const referencesGiven = await prisma.reference.count({
      where: { giverId: id }, // Corrected field name
    });

    // 5. References Received
    // Count of references RECEIVED BY this member.
    const referencesReceived = await prisma.reference.count({
      where: { receiverId: id }, // Corrected field name
    });

    // 6. One-to-Ones
    // Count of OneToOne meetings involving this member.
    const oneToOnes = await prisma.oneToOne.count({
      where: {
        OR: [
          { requesterId: id }, // Corrected field name
          { requestedId: id }, // Corrected field name
        ],
      },
    });

    res.status(200).json({
      testimonials,
      businessGiven,
      businessReceived,
      referencesGiven,
      referencesReceived,
      oneToOnes,
    });
  } catch (error) {
    console.error("Error in getMemberActivitySummary:", error);
    // Check if it's a Prisma known error for specific handling if needed
    if (error.code && error.clientVersion) { // Basic check for Prisma error structure
        // Log more detailed Prisma error if available
        console.error(`Prisma Error Code: ${error.code}, Meta: ${JSON.stringify(error.meta)}`);
    }
    return next(createError(500, "Server error while fetching activity summary."));
  }
});

const getMemberTestimonials = asyncHandler(async (req, res, next) => {
  const { memberName } = req.params;

  if (!memberName) {
    return next(createError(400, "Member name is required."));
  }

  try {
    const thankYouSlips = await prisma.thankYouSlip.findMany({
      where: {
        toWhom: memberName,
        testimony: {
          not: null, // Ensure testimony exists
          notIn: [''], // Ensure testimony is not an empty string
        },
      },
      include: {
        fromMember: { // Include the member who gave the thank you slip
          select: {
            id: true,
            memberName: true, // Assuming the Member model has a 'memberName' field
            profilePicture: true, // Optional: if you want to include author's avatar
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Optional: order by creation date
      },
      take: 20, // Optional: limit the number of testimonials returned
    });

    if (!thankYouSlips || thankYouSlips.length === 0) {
      return res.status(200).json([]); // Return empty array if no testimonials found
    }

    const testimonials = thankYouSlips.map(slip => ({
      id: slip.id.toString(), // Ensure ID is a string for React keys
      text: slip.testimony,
      author: slip.fromMember ? slip.fromMember.memberName : 'Anonymous', // Handle if fromMember is not available
      // authorAvatar: slip.fromMember ? slip.fromMember.profilePicture : undefined, // Optional
      // date: slip.createdAt, // Optional: if you want to include the date of the testimonial
    }));

    res.status(200).json(testimonials);
  } catch (error) {
    console.error("Error fetching member testimonials:", error);
    next(createError(500, "Server error while fetching testimonials."));
  }
});

const getReceivedTestimonialsForMember = asyncHandler(async (req, res, next) => {
  const { memberId } = req.params;

  if (!memberId || isNaN(parseInt(memberId))) {
    return next(createError(400, "Valid Member ID is required."));
  }
  const numericMemberId = parseInt(memberId);

  try {
    const thankYouSlips = await prisma.thankYouSlip.findMany({
      where: {
        toWhomId: numericMemberId, // Testimonials received by this member
        testimony: {              // 'testimony' is non-nullable in the schema
          not: "",                 // Ensure it's not an empty string
        },
      },
      include: {
        fromMember: { // Details of the member who GAVE the testimonial
          select: {
            id: true,
            memberName: true,
            profilePicture: true, // Select profilePicture directly from Member
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedTestimonials = thankYouSlips.map(slip => ({
      id: slip.id.toString(), // Ensure ID is a string for React keys
      user: {
        name: slip.fromMember?.memberName || "Anonymous Giver",
        avatar: slip.fromMember?.profilePicture || "https://via.placeholder.com/100", // Use direct profilePicture and provide a default
      },
      content: slip.testimony,
      time: slip.createdAt.toISOString(), // Using ISO string for full date-time, frontend can format
    }));

    res.status(200).json(formattedTestimonials);
  } catch (error) {
    console.error("Error fetching received testimonials for member:", error);
    next(createError(500, "Server error while fetching received testimonials."));
  }
});

module.exports = {
  createMember,
  getMembers,
  getMemberById,
  updateMember,
  deleteMember,
  updateProfilePictures,
  deleteProfilePicture,
  getProfilePicture,
  getMemberDetailsForReference,
  searchMembers,
  getCurrentMemberProfile,
  getMemberActivitySummary,
  getMemberTestimonials,
  getReceivedTestimonialsForMember,
};
