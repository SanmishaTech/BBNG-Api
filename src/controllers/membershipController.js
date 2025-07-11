const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const createError = require("http-errors");
const { addMonths, subDays, getMonth, getYear, setMonth, setDate, setYear } = require("date-fns");
const { generateInvoicePdf } = require('../utils/invoiceGenerator');
const { numberToWords } = require('../utils/numberToWords');
const path = require('path');
const fs = require('fs');

/**
 * Wrap async route handlers and funnel errors through Express error middleware.
 * Converts Prisma validation errors and known request errors into structured 400 responses.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    // Zod or manual user errors forwarded by validateRequest
    if (err.status === 400 && err.expose) {
      return res
        .status(400)
        .json({ errors: err.errors || { message: err.message } });
    }
    // Prisma validation errors
    if (err.name === "PrismaClientValidationError") {
      return res.status(400).json({ errors: { message: err.message } });
    }
    // Prisma known request errors (e.g., unique constraint)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002" && err.meta?.target) {
        const field = Array.isArray(err.meta.target)
          ? err.meta.target[0]
          : err.meta.target;
        const message = `A record with that ${field} already exists.`;
        return res
          .status(400)
          .json({ errors: { [field]: { type: "unique", message } } });
      }
    }
    // Fallback for unexpected errors
    console.error(err);
    return res
      .status(500)
      .json({ errors: { message: "Internal Server Error" } });
  });
};

/**
 * Generate a financial year code based on a date
 * Returns string like "FY23-24" for dates in financial year 2023-2024
 */
// Helper to format date as DD/MM/YYYY (already in invoiceGenerator.js, but might be useful here too)
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getFinancialYearCode = (date = new Date()) => {
  const currentMonth = date.getMonth(); // 0-11
  const currentYear = date.getFullYear();
  
  // In India, financial year runs from April 1 to March 31
  // If current month is January to March, financial year started in previous calendar year
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const fyEndYear = fyStartYear + 1;
  
  // Return FY format like "2324" (last two digits of start year + last two digits of end year)
  return `${fyStartYear.toString().slice(-2)}${fyEndYear.toString().slice(-2)}`;
};

/**
 * Calculate the financial year end date based on a given date
 * Financial year in India ends on March 31st
 * If the given date is past March, return next year's March 30th
 * If the given date is before or in March, return current year's March 30th
 */
const getFinancialYearEndDate = (date = new Date()) => {
  const currentMonth = date.getMonth(); // 0-11 (0 = January, 2 = March)
  const currentYear = date.getFullYear();
  
  let expiryYear;
  
  // If we're past March (month 2), set expiry to next year's March
  if (currentMonth > 2) {
    expiryYear = currentYear + 1;
  } else {
    // Otherwise set it to current year's March
    expiryYear = currentYear;
  }
  
  // Create a new date set to March 30th of the target year
  const expiryDate = new Date(date);
  expiryDate.setFullYear(expiryYear);
  expiryDate.setMonth(2); // March (0-indexed)
  expiryDate.setDate(30); // 30th day
  
  return expiryDate;
};

/**
 * Generate a unique invoice number based on financial year.
 * Format: YYYY-NNN (e.g., 2324-001)
 */
const generateInvoiceNumber = async (invoiceDate) => {
  const financialYear = getFinancialYearCode(invoiceDate); // e.g., "2324"

  // Find all memberships in the current financial year to get their invoice numbers
  const membershipsThisFY = await prisma.membership.findMany({
    where: {
      invoiceNumber: {
        startsWith: financialYear + "-", // Match "YYYY-" to be precise
      },
    },
    select: {
      invoiceNumber: true,
    },
  });

  let maxSeq = 0;
  if (membershipsThisFY.length > 0) {
    membershipsThisFY.forEach(membership => {
      // Expected format: YYYY-NNN
      const parts = membership.invoiceNumber.split('-');
      if (parts.length === 2) {
        const seqPart = parseInt(parts[1], 10);
        if (!isNaN(seqPart) && seqPart > maxSeq) {
          maxSeq = seqPart;
        }
      }
    });
  }

  const nextSeq = maxSeq + 1;
  // Create sequential number padded with leading zeros (001, 002, etc.)
  const sequentialNumber = nextSeq.toString().padStart(5, '0'); // Pad to 3 digits

  // Final invoice number format: e.g., 2324-001
  return `${financialYear}-${sequentialNumber}`;
};

/** GET /api/memberships
 * List memberships (pagination, filters, sort)
 */
const getMemberships = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  const { search = "", memberId, packageId, active } = req.query;
  const sortBy = req.query.sortBy || "invoiceDate";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
  const parsedActive = active != null ? active === "true" : undefined;

  const filters = [];
  if (search) {
    filters.push({
      OR: [
        { invoiceNumber: { contains: search } },
        { member: { memberName: { contains: search } } },
      ],
    });
  }
  if (memberId) {
    filters.push({ memberId: parseInt(memberId) });
  }
  if (packageId) {
    filters.push({ packageId: parseInt(packageId) });
  }
  if (parsedActive !== undefined) {
    filters.push({ active: parsedActive });
  }
  
  // Role-based access control: if user is not admin, show only their memberships
  if (!req.user.role.includes('admin')) {
    // Get the member ID associated with the user
    const member = await prisma.member.findFirst({
      where: { 
        users: {
          id: req.user.id
        }
      }
    });
    
    if (member) {
      filters.push({ memberId: member.id });
    } else {
      // If user is not a member and not an admin, return empty results
      return res.json({
        memberships: [],
        page,
        totalPages: 0,
        totalMemberships: 0,
      });
    }
  }
  
  const where = filters.length ? { AND: filters } : {};

  const [memberships, total] = await Promise.all([
    prisma.membership.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { 
        member: true, 
        package: { include: { chapter: true } }
      },
    }),
    prisma.membership.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    memberships,
    page,
    totalPages,
    totalMemberships: total,
  });
});

/** POST /api/memberships
 * Create a new membership
 */
const createMembership = asyncHandler(async (req, res) => {
  const schema = z
    .object({
      memberId: z.number().int().positive("Member ID is required"),
      invoiceDate: z.preprocess(
        (v) => new Date(v),
        z.date({ required_error: "Invoice date is required" })
      ),
      packageStartDate: z.preprocess(
        (v) => (v ? new Date(v) : null),
        z.date({ required_error: "Package start date is required" })
      ),
      packageId: z.number().int().positive("Package ID is required"),
      basicFees: z.number().positive("Basic fees must be positive"),
      cgstRate: z.number().min(0, "CGST rate cannot be negative").optional().nullable(),
      sgstRate: z.number().min(0, "SGST rate cannot be negative").optional().nullable(),
      igstRate: z.number().min(0, "IGST rate cannot be negative").optional().nullable(),
      paymentDate: z.preprocess(
        (v) => (v ? new Date(v) : null),
        z.date().optional().nullable()
      ),
      paymentMode: z.string().optional().nullable(),
      chequeNumber: z.string().optional().nullable(),
      chequeDate: z.preprocess(
        (v) => (v ? new Date(v) : null),
        z.date().optional().nullable()
      ),
      bankName: z.string().optional().nullable(),
      neftNumber: z.string().optional().nullable(),
      utrNumber: z.string().optional().nullable(),
    })
    .superRefine(async (data, ctx) => {
      // Check if member exists
      const member = await prisma.member.findUnique({
        where: { id: data.memberId },
      });
      if (!member) {
        ctx.addIssue({
          path: ["memberId"],
          message: "Member not found",
          code: z.ZodIssueCode.custom,
        });
        return;
      }

      // Check if package exists
      const packageData = await prisma.package.findUnique({
        where: { id: data.packageId },
      });
      if (!packageData) {
        ctx.addIssue({
          path: ["packageId"],
          message: "Package not found",
          code: z.ZodIssueCode.custom,
        });
        return;
      }
    });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Get package details to calculate dates
  const packageData = await prisma.package.findUnique({
    where: { id: req.body.packageId },
  });

  // Get member details to check expiry dates
  const member = await prisma.member.findUnique({
    where: { id: req.body.memberId },
  });

  // Generate unique invoice number based on financial year
  const invoiceNumber = await generateInvoiceNumber(new Date(req.body.invoiceDate));

  // Use the packageStartDate from the request if provided, otherwise fall back to calculated date
  let packageStartDate;
  let packageEndDate;

  if (req.body.packageStartDate) {
    // Use the explicitly provided start date from frontend
    packageStartDate = new Date(req.body.packageStartDate);
  } else {
    // Fall back to the original logic if no start date is provided
    packageStartDate = new Date();
    
    if (packageData.isVenueFee) {
      // For venue fee packages, use venueExpiryDate
      if (member.venueExpiryDate && new Date(member.venueExpiryDate) > new Date()) {
        packageStartDate = new Date(member.venueExpiryDate);
      }
    } else {
      // For non-venue fee packages, use hoExpiryDate
      if (member.hoExpiryDate && new Date(member.hoExpiryDate) > new Date()) {
        packageStartDate = new Date(member.hoExpiryDate);
      }
    }
  }

  // Calculate the package end date using financial year logic
  // Regardless of package duration, we set expiry to March 30th of appropriate financial year
  packageEndDate = getFinancialYearEndDate(packageStartDate);

  // Calculate GST amounts and total fees
  const basicFees = parseFloat(req.body.basicFees);
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  
  if (req.body.cgstRate) {
    cgstAmount = (basicFees * parseFloat(req.body.cgstRate)) / 100;
  }
  
  if (req.body.sgstRate) {
    sgstAmount = (basicFees * parseFloat(req.body.sgstRate)) / 100;
  }
  
  if (req.body.igstRate) {
    igstAmount = (basicFees * parseFloat(req.body.igstRate)) / 100;
  }
  
  const totalFees = basicFees + cgstAmount + sgstAmount + igstAmount;

  // Prepare data for creating membership
  const membershipData = {
    ...req.body,
    invoiceNumber,
    packageStartDate,
    packageEndDate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalFees,
  };

  // Create membership record
  const membership = await prisma.membership.create({
    data: membershipData,
  });
  
  // Update member expiry dates based on package type
  const updateData = {};
  
  if (packageData.isVenueFee) {
    updateData.venueExpiryDate = packageEndDate;
  } else {
    updateData.hoExpiryDate = packageEndDate;
  }
  
  await prisma.member.update({
    where: { id: req.body.memberId },
    data: updateData,
  });

  // Update the user's active status
  await updateUserActiveStatus(req.body.memberId);

  // --- Begin Invoice Generation ---
  try {
    const fullMember = await prisma.member.findUnique({
      where: { id: membership.memberId }, // Use memberId from the created membership
      include: { chapter: true } // Chapter is needed for HSN/SAC fallback; address details are direct on Member
    });

    const packageDetails = await prisma.package.findUnique({
      where: { id: membership.packageId }
    });

    if (!fullMember || !packageDetails) {
      console.error(`Invoice Generation: Member or Package details not found for membership ID ${membership.id}`);
    } else {
      const invoiceData = {
        invoiceNumber: membership.invoiceNumber,
        invoiceDate: membership.invoiceDate, 
        member: {
          memberName: fullMember.memberName,
          addressLines: [
            fullMember.orgAddressLine1,
            fullMember.orgAddressLine2
          ].filter(Boolean).map(line => line.trim()).filter(line => line.length > 0), // Ensure lines are not just whitespace
          city: fullMember.orgLocation,
          pincode: fullMember.orgPincode,
          gstin: fullMember.gstNo,
        },
        items: [
          {
            srNo: 1,
            description: `${packageDetails.packageName} - ${packageDetails.periodMonths} Months (Expiry: ${formatDate(membership.packageEndDate)})`,
            hsnSac: packageDetails.hsnSac || fullMember.chapter?.hsnSac, // Prioritize package HSN, fallback to chapter
            amount: Number(membership.basicFees),
          },
          // Example for additional item from image:
          // This needs a source, e.g. if 'Chapter Venue Fees (Monthly)' is a separate product/service tied to membership or chapter
          // If (membership.venueFeeAmount && membership.venueFeeAmount > 0) {
          //   items.push({
          //      srNo: items.length + 1, 
          //      description: 'Chapter Venue Fees (Monthly)', 
          //      amount: membership.venueFeeAmount 
          //   });
          //   totals.amountBeforeTax += membership.venueFeeAmount; 
          // }
        ],
        totals: {
          amountBeforeTax: Number(membership.basicFees), // Initial value, will be summed up below
          cgstRate: Number(membership.cgstRate) || 0,
          cgstAmount: Number(membership.cgstAmount) || 0,
          sgstRate: Number(membership.sgstRate) || 0,
          sgstAmount: Number(membership.sgstAmount) || 0,
          igstRate: Number(membership.igstRate) || 0,
          igstAmount: Number(membership.igstAmount) || 0,
          totalAmount: Number(membership.totalAmount) || 0,
          amountInWords: numberToWords(Number(membership.totalAmount) || 0),
        },
      };
      
      // Correct calculation for amountBeforeTax if multiple items are present
      // Ensure item.amount is a number for the sum
      invoiceData.totals.amountBeforeTax = invoiceData.items.reduce((sum, item) => sum + Number(item.amount), 0);
      // Ensure totalAmount reflects the sum of all items + taxes. If venue fees were added, totalAmount in 'membership' might need re-evaluation or be stored inclusive.
      // For simplicity, assuming membership.totalAmount from DB is the final correct figure after all considerations.

      const invoicesDir = path.join(__dirname,"..", '..', 'invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }
      const invoiceFilePath = path.join(invoicesDir, `${membership.invoiceNumber}.pdf`);

      await generateInvoicePdf(invoiceData, invoiceFilePath);
      console.log(`Invoice ${membership.invoiceNumber}.pdf generated successfully at ${invoiceFilePath}`);

      // Optional: Save invoicePath to the membership record
      // await prisma.membership.update({
      //   where: { id: membership.id },
      //   data: { invoicePath: path.relative(path.join(__dirname, '..', '..'), invoiceFilePath) }, // Store relative path from backend root
      // });
    }
  } catch (invoiceError) {
    console.error(`Failed to generate invoice ${membership.invoiceNumber}:`, invoiceError);
  }
  // --- End Invoice Generation ---

  res.status(201).json(membership);
});

/** GET /api/memberships/:id
 * Retrieve a membership
 */
const getMembershipById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid membership ID");

  const membership = await prisma.membership.findUnique({
    where: { id },
    include: { 
      member: true, 
      package: { include: { chapter: true } }
    },
  });
  
  if (!membership) throw createError(404, "Membership not found");

  // Role-based access control: regular users can only view their own memberships
  if (!req.user.role.includes('admin')) {
    // Get the member ID associated with the logged-in user
    const userMember = await prisma.member.findFirst({
      where: { 
        users: {
          id: req.user.id
        }
      }
    });
    
    // If trying to access another member's data, deny access
    if (!userMember || userMember.id !== membership.memberId) {
      throw createError(403, "You are not authorized to view this membership");
    }
  }

  res.json(membership);
});

/** PUT /api/memberships/:id
 * Update a membership
 */
const updateMembership = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid membership ID");

  const schema = z
    .object({
      invoiceNumber: z.string().min(1).max(255).optional(),
      invoiceDate: z.preprocess(
        (v) => (v ? new Date(v) : undefined),
        z.date().optional()
      ),
      basicFees: z.number().positive().optional(),
      cgstRate: z.number().min(0).optional().nullable(),
      sgstRate: z.number().min(0).optional().nullable(),
      igstRate: z.number().min(0).optional().nullable(),
      paymentDate: z.preprocess(
        (v) => (v ? new Date(v) : null),
        z.date().optional().nullable()
      ),
      paymentMode: z.string().optional().nullable(),
      active: z.boolean().optional(),
      // Don't allow changing memberId or packageId as they affect expiry dates
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    })
    .superRefine(async (data, ctx) => {
      // If invoice number is changed, check if it's unique
      if (data.invoiceNumber) {
        const existingInvoice = await prisma.membership.findFirst({
          where: { 
            invoiceNumber: data.invoiceNumber,
            id: { not: id }
          },
        });
        
        if (existingInvoice) {
          ctx.addIssue({
            path: ["invoiceNumber"],
            message: "Invoice number already exists",
            code: z.ZodIssueCode.custom,
          });
        }
      }
    });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Get existing membership
  const existingMembership = await prisma.membership.findUnique({
    where: { id },
  });
  
  if (!existingMembership) {
    throw createError(404, "Membership not found");
  }

  // Calculate new GST amounts and total fees if needed
  let membershipData = { ...req.body };
  
  if (req.body.basicFees !== undefined || 
      req.body.cgstRate !== undefined || 
      req.body.sgstRate !== undefined || 
      req.body.igstRate !== undefined) {
    
    const basicFees = req.body.basicFees !== undefined 
      ? parseFloat(req.body.basicFees) 
      : parseFloat(existingMembership.basicFees);
      
    const cgstRate = req.body.cgstRate !== undefined 
      ? req.body.cgstRate === null ? 0 : parseFloat(req.body.cgstRate) 
      : existingMembership.cgstRate === null ? 0 : parseFloat(existingMembership.cgstRate);
      
    const sgstRate = req.body.sgstRate !== undefined 
      ? req.body.sgstRate === null ? 0 : parseFloat(req.body.sgstRate) 
      : existingMembership.sgstRate === null ? 0 : parseFloat(existingMembership.sgstRate);
      
    const igstRate = req.body.igstRate !== undefined 
      ? req.body.igstRate === null ? 0 : parseFloat(req.body.igstRate) 
      : existingMembership.igstRate === null ? 0 : parseFloat(existingMembership.igstRate);
    
    const cgstAmount = (basicFees * cgstRate) / 100;
    const sgstAmount = (basicFees * sgstRate) / 100;
    const igstAmount = (basicFees * igstRate) / 100;
    const totalFees = basicFees + cgstAmount + sgstAmount + igstAmount;
    
    membershipData = {
      ...membershipData,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalFees,
    };
  }

  // Get the updated membership with package details to update expiry dates
  const membership = await prisma.membership.findUnique({
    where: { id },
    include: { package: true },
  });

  // Update member expiry dates if active status has changed
  if (req.body.active !== undefined) {
    // Get member details
    const member = await prisma.member.findUnique({
      where: { id: existingMembership.memberId },
    });

    const updateData = {};
    
    // If membership was deactivated, update expiry dates
    if (req.body.active === false) {
      // Find the most recent active membership for this member and package type
      const mostRecentMembership = await prisma.membership.findFirst({
        where: {
          memberId: existingMembership.memberId,
          id: { not: id },
          package: { isVenueFee: membership.package.isVenueFee },
          active: true,
        },
        orderBy: { packageEndDate: 'desc' },
        include: { package: true },
      });

      // Update the appropriate expiry date field
      if (membership.package.isVenueFee) {
        // If the deactivated membership's end date matches the member's current venue expiry,
        // update it to the next most recent active membership's end date or null
        if (member.venueExpiryDate && 
            new Date(member.venueExpiryDate).getTime() === new Date(membership.packageEndDate).getTime()) {
          updateData.venueExpiryDate = mostRecentMembership ? mostRecentMembership.packageEndDate : null;
        }
      } else {
        // Same for HO expiry
        if (member.hoExpiryDate && 
            new Date(member.hoExpiryDate).getTime() === new Date(membership.packageEndDate).getTime()) {
          updateData.hoExpiryDate = mostRecentMembership ? mostRecentMembership.packageEndDate : null;
        }
      }
    } 
    // If membership was activated, update expiry dates
    else if (req.body.active === true) {
      // Get current expiry date
      const currentExpiryDate = membership.package.isVenueFee 
        ? member.venueExpiryDate 
        : member.hoExpiryDate;

      // Update expiry date if the newly activated membership ends later than current expiry
      if (!currentExpiryDate || new Date(membership.packageEndDate) > new Date(currentExpiryDate)) {
        if (membership.package.isVenueFee) {
          updateData.venueExpiryDate = membership.packageEndDate;
        } else {
          updateData.hoExpiryDate = membership.packageEndDate;
        }
      }
    }

    // Update member if there are changes to expiry dates
    if (Object.keys(updateData).length > 0) {
      await prisma.member.update({
        where: { id: existingMembership.memberId },
        data: updateData,
      });
    }
  }

  const updated = await prisma.membership.update({
    where: { id },
    data: membershipData,
  });

  // Update the user's active status
  await updateUserActiveStatus(existingMembership.memberId);

  res.json(updated);
});

/** DELETE /api/memberships/:id
 * Delete a membership
 */
const deleteMembership = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid membership ID");

  // Get membership details
  const membership = await prisma.membership.findUnique({
    where: { id },
    include: { package: true },
  });
  
  if (!membership) {
    throw createError(404, "Membership not found");
  }

  // Get member details
  const member = await prisma.member.findUnique({
    where: { id: membership.memberId },
  });

  // Check if we need to update expiry dates
  const updateMemberData = {};
  
  // If this membership's end date is the same as the member's current expiry date,
  // we need to reset it or find the next most recent active membership end date
  if (membership.package.isVenueFee && 
      member.venueExpiryDate && 
      new Date(member.venueExpiryDate).getTime() === new Date(membership.packageEndDate).getTime()) {
    
    // Find the most recent active membership for this member with the same package type
    const mostRecentMembership = await prisma.membership.findFirst({
      where: {
        memberId: membership.memberId,
        id: { not: id },
        package: { isVenueFee: true },
        active: true,
      },
      orderBy: { packageEndDate: 'desc' },
      include: { package: true },
    });
    
    updateMemberData.venueExpiryDate = mostRecentMembership 
      ? mostRecentMembership.packageEndDate 
      : null;
  } 
  else if (!membership.package.isVenueFee && 
           member.hoExpiryDate && 
           new Date(member.hoExpiryDate).getTime() === new Date(membership.packageEndDate).getTime()) {
    
    // Find the most recent active membership for this member with the same package type
    const mostRecentMembership = await prisma.membership.findFirst({
      where: {
        memberId: membership.memberId,
        id: { not: id },
        package: { isVenueFee: false },
        active: true,
      },
      orderBy: { packageEndDate: 'desc' },
      include: { package: true },
    });
    
    updateMemberData.hoExpiryDate = mostRecentMembership 
      ? mostRecentMembership.packageEndDate 
      : null;
  }

  // Begin a transaction to update member and delete membership
  await prisma.$transaction([
    prisma.member.update({
      where: { id: membership.memberId },
      data: updateMemberData,
    }),
    prisma.membership.delete({
      where: { id },
    }),
  ]);

  // Update the user's active status
  await updateUserActiveStatus(membership.memberId);

  res.json({ message: "Membership deleted successfully" });
});

/** GET /api/memberships/member/:memberId
 * Get all memberships for a specific member
 */
const getMembershipsByMemberId = asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.memberId);
  if (!memberId) throw createError(400, "Invalid member ID");

  // Check if member exists
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });
  
  if (!member) {
    throw createError(404, "Member not found");
  }

  // Role-based access control: regular users can only view their own memberships
  if (!req.user.role.includes('admin')) {
    // Get the member ID associated with the logged-in user
    const userMember = await prisma.member.findFirst({
      where: { 
        users: {
          id: req.user.id
        }
      }
    });
    
    // If trying to access another member's data, deny access
    if (!userMember || userMember.id !== memberId) {
      throw createError(403, "You are not authorized to view this member's memberships");
    }
  }

  const memberships = await prisma.membership.findMany({
    where: { memberId },
    include: { 
      package: { include: { chapter: true } }
    },
    orderBy: { invoiceDate: 'desc' },
  });

  res.json(memberships);
});

/**
 * Helper function to update a user's active status based on membership status
 * Sets user as active if either venue or HO membership is active (expiry date in the future)
 */
const updateUserActiveStatus = async (memberId) => {
  try {
    // Get the member with their user relationship
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { users: true }
    });

    if (!member || !member.users) {
      console.log(`No user found for member ID ${memberId}`);
      return;
    }

    const now = new Date();
    let hasActiveMembership = false;
    
    // A user is active ONLY if BOTH venue and HO memberships are set AND at least one is active
    // If any membership is null, user should be inactive
    
    // Check if both memberships exist (not null)
    if (member.venueExpiryDate && member.hoExpiryDate) {
      // Check if at least one membership is active
      if (new Date(member.venueExpiryDate) > now || new Date(member.hoExpiryDate) > now) {
        hasActiveMembership = true;
      }
    } else {
      // If any membership is null, user should be inactive
      hasActiveMembership = false;
    }

    // Update user's active status if it differs from current membership status
    if (member.users.active !== hasActiveMembership) {
      console.log(`Updating user ID ${member.users.id} active status to ${hasActiveMembership}`);
      await prisma.user.update({
        where: { id: member.users.id },
        data: { active: hasActiveMembership }
      });
    }
  } catch (error) {
    console.error('Error updating user active status:', error);
  }
};

/**
 * GET /api/invoices/:invoiceFilename
 * Download a specific invoice PDF.
 * Accessible by admins only (to be enforced by route middleware).
 */
const downloadInvoice = asyncHandler(async (req, res, next) => {
  const { invoiceFilename } = req.params;

  if (!invoiceFilename || !invoiceFilename.endsWith('.pdf')) {
    return next(createError(400, 'Invalid invoice filename format. Must end with .pdf'));
  }

  const safeFilename = path.basename(invoiceFilename);
  // Prevent directory traversal by ensuring the basename is the same as the input filename.
  // This is a basic check; ensure invoiceFilename comes from a trusted source (e.g., your database).
  if (safeFilename !== invoiceFilename) {
      return next(createError(400, 'Invalid characters in invoice filename.'));
  }

  const invoicesDir = path.join(__dirname, '..', '..', 'invoices');
  const filePath = path.join(invoicesDir, safeFilename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, safeFilename, (err) => {
      if (err) {
        console.error('Error downloading invoice:', err);
        if (!res.headersSent) {
          // If headers haven't been sent, we can send an error status.
          // Otherwise, the error will be logged, and the download might fail client-side.
          return next(createError(500, 'Could not download the invoice.'));
        }
      }
    });
  } else {
    return next(createError(404, 'Invoice not found.'));
  }
});

module.exports = {
  getMemberships,
  createMembership,
  getMembershipById,
  updateMembership,
  deleteMembership,
  getMembershipsByMemberId,
  updateUserActiveStatus,
  downloadInvoice,
};