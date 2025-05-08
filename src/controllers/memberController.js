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
  category: z.string().min(1, "Category is required"),
  businessCategory: z.string(),
  gender: z.enum(["male", "female", "other"], {
    errorMap: () => ({ message: "Gender must be male, female, or other" }),
  }),
  dob: z
    .string()
    .refine(
      (val) => !isNaN(new Date(val).getTime()),
      "Invalid date format for Date of Birth"
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
  organizationName: z.string().min(1, "Organization name is required"),
  businessTagline: z.string().optional(),
  organizationMobileNo: z
    .string()
    .min(10, "Organization mobile number must be at least 10 digits")
    .max(15, "Organization mobile number must be at most 15 digits"),
  organizationLandlineNo: z.string().optional(),
  organizationEmail: z
    .string()
    .email("Invalid organization email format")
    .optional(),
  orgAddressLine1: z.string().min(1, "Organization address is required"),
  orgAddressLine2: z.string().optional(),
  orgLocation: z.string().min(1, "Organization location is required"),
  orgPincode: z
    .string()
    .min(6, "Organization pincode must be 6 digits")
    .max(6, "Organization pincode must be 6 digits"),
  organizationWebsite: z
    .string()
    .url("Invalid organization website URL")
    .optional(),
  organizationDescription: z.string().optional(),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  location: z.string().min(1, "Location is required"),
  addressLine2: z.string().optional(),
  pincode: z
    .string()
    .min(6, "Pincode must be 6 digits")
    .max(6, "Pincode must be 6 digits"),
  specificAsk: z.string().optional(),
  specificGive: z.string().optional(),
  clients: z.string().optional(),
  profilePicture1: z.string().optional(),
  profilePicture2: z.string().optional(),
  profilePicture3: z.string().optional(),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
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

  // Validate request data (including files if any are part of memberSchema)
  // Assuming validateRequest handles req.files appropriately if they are defined in schema
  const parsedData = await validateRequest(memberSchema, body, req.files);
  if (!parsedData) return; // validateRequest should handle the response on error

  const {
    // verifyPassword, // Removed if not in schema, handle password confirmation if needed
    password,
    dob,
    email,
    chapterId, // chapterId is now correctly parsed as number if it was string
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
                    file.filename
                  )
                );
                console.log(`Cleaned up file: ${file.filename}`);
              } catch (error) {
                console.error(
                  `Error deleting file ${file.filename} during cleanup:`,
                  error
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
          role: "user", // Default role for new members
          active: true, // Default to active
        },
      });

      // Convert dob string to Date object
      const dateOfBirth = new Date(dob);
      if (isNaN(dateOfBirth.getTime())) {
        // This should ideally be caught by Zod, but double-check
        throw createError(
          400,
          "Invalid date format for date of birth. Please use YYYY-MM-DD or a valid date string."
        );
      }

      // 2. Create the Member record and link it to the User and Chapter
      const memberData = {
        ...otherValidatedData,
        email: email, // Member's email (unique, same as User's)
        password: hashedPassword, // Store hashed password in Member as per schema
        dateOfBirth: dateOfBirth,
        // Establish the relationship to the User using proper Prisma relation syntax
        users: {
          connect: { id: user.id },
        },
      };

      // Conditionally connect to chapter
      if (chapterId) {
        memberData.chapter = {
          connect: { id: chapterId },
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
                select: { id: true, location: true },
              },
              zones: {
                select: { id: true, name: true },
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
                    file.filename
                  )
                );
                console.log(
                  `Cleaned up file on transaction error: ${file.filename}`
                );
              } catch (cleanupError) {
                console.error(
                  `Error deleting file ${file.filename} during transaction error cleanup:`,
                  cleanupError
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
        { expose: true }
      );
    }
    if (!error.status) {
      // If it's not already an HttpError
      console.error("Transaction failed:", error); // Log the original error
      throw createError(
        500,
        error.message ||
          "Failed to create member and user account due to a server error."
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

  // Build where clause for filtering
  const where = {};
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

    // Remove sensitive data before sending response
    const sanitizedMembers = members.map((member) => {
      const { password, ...sanitizedMember } = member;
      return sanitizedMember;
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

    if (!member) {
      throw createError(404, "Member not found");
    }

    // Remove sensitive data before sending response
    const { password, ...sanitizedMember } = member;

    res.json(sanitizedMember);
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
  /* ... existing code ... */
});
const deleteMember = asyncHandler(async (req, res) => {
  /* ... existing code ... */
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

module.exports = {
  getMembers, // Make sure this is defined or imported
  createMember,
  getMemberById, // Make sure this is defined or imported
  updateMember, // Make sure this is defined or imported
  deleteMember, // Make sure this is defined or imported
  updateProfilePictures, // Make sure this is defined or imported
  deleteProfilePicture, // Make sure this is defined or imported
  getProfilePicture, // Make sure this is defined or imported
};
