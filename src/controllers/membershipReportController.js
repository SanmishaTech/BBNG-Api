const ExcelJS = require("exceljs");
const prisma = require("../config/db");
const aclService = require("../services/aclService");

/**
 * GET /membersreports
 * Export member data to an Excel file (Super Admin only)
 * Selected fields: memberName, contact details, membership status, expiry dates
 */
const exportMembers = async (req, res, next) => {
  try {
    // Permission check for export permission
    if (!aclService.hasPermission(req.user, "members.export")) {
      return res.status(403).json({
        errors: { message: "You do not have permission to export member data" },
      });
    }

    // Extract parameters from query parameters
    const { fromDate, toDate, packageId, memberId, active, chapterId } = req.query;
    
    // Build where clause for filtering members
    let whereClause = {};
    
    // Add member filter if provided
    if (memberId) {
      whereClause.id = parseInt(memberId);
    }
    
    // Add chapter filter if provided
    if (chapterId) {
      whereClause.chapterId = parseInt(chapterId);
    }
    
    // Apply date filtering on member expiry dates if provided
    if (fromDate || toDate) {
      // Convert dates
      const fromDateObj = fromDate ? new Date(fromDate) : null;
      let toDateObj = null;
      
      if (toDate) {
        // Set time to end of day for toDate
        toDateObj = new Date(toDate);
        toDateObj.setHours(23, 59, 59, 999);
      }
      
      // Build complex date filter according to the requirements
      const dateConditions = [];
      
      // Condition 1: hoExpiryDate is between fromDate and toDate
      if (fromDate && toDate) {
        dateConditions.push({
          hoExpiryDate: {
            gte: fromDateObj,
            lte: toDateObj
          }
        });
      } else if (fromDate) {
        dateConditions.push({
          hoExpiryDate: {
            gte: fromDateObj
          }
        });
      } else if (toDate) {
        dateConditions.push({
          hoExpiryDate: {
            lte: toDateObj
          }
        });
      }
      
      // Condition 2: venueExpiryDate is between fromDate and toDate
      if (fromDate && toDate) {
        dateConditions.push({
          venueExpiryDate: {
            gte: fromDateObj,
            lte: toDateObj
          }
        });
      } else if (fromDate) {
        dateConditions.push({
          venueExpiryDate: {
            gte: fromDateObj
          }
        });
      } else if (toDate) {
        dateConditions.push({
          venueExpiryDate: {
            lte: toDateObj
          }
        });
      }
      
      // Condition 3: Either hoExpiryDate or venueExpiryDate is null
      dateConditions.push({ hoExpiryDate: null });
      dateConditions.push({ venueExpiryDate: null });
      
      // Add the OR conditions to the where clause
      whereClause = {
        ...whereClause,
        OR: dateConditions
      };
    }
    
    // Build membership filter for related memberships
    const membershipFilter = {};
    
    // Add package filter for memberships if provided
    if (packageId) {
      membershipFilter.packageId = parseInt(packageId);
    }
    
    // Add active status filter for memberships if provided
    if (active !== undefined) {
      membershipFilter.active = active === 'true';
    }
    
    // For non-super-admin users, filter by their chapter
    if (req.user.role !== "super_admin") {
      // First, find the user with its associated member to get the chapter
      const userWithMember = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { member: true }
      });
      
      // If user has an associated member with a chapter, filter by that chapter
      if (userWithMember?.member?.chapterId) {
        whereClause.chapterId = userWithMember.member.chapterId;
      } else {
        // If no associated chapter found, return empty result
        return res.status(400).json({
          errors: { message: "No associated chapter found for this user" },
        });
      }
    }

    // Log the constructed query for debugging (remove in production)
    console.log('Member filter query:', JSON.stringify(whereClause, null, 2));
    
    // Fetch members with required fields and filters
    const members = await prisma.member.findMany({
      where: whereClause,
      include: {
        chapter: true,
        memberships: {
          where: membershipFilter,
          include: {
            package: true
          },
          orderBy: { invoiceDate: "desc" },
        }
      },
      orderBy: { memberName: "asc" },
    });
    
    console.log(`Found ${members.length} members matching the criteria`);

    // Create workbook & worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Members");

    worksheet.columns = [
      { header: "Member ID", key: "memberId", width: 15 },
      { header: "Member Name", key: "memberName", width: 30 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Chapter", key: "chapterName", width: 20 },
      { header: "Address", key: "address", width: 40 },
      { header: "Venue Expiry Date", key: "venueExpiryDate", width: 20 },
      { header: "HO Expiry Date", key: "hoExpiryDate", width: 20 },
      { header: "Latest Invoice Number", key: "latestInvoiceNumber", width: 20 },
      { header: "Latest Package", key: "latestPackageName", width: 30 },
      { header: "Latest Invoice Date", key: "latestInvoiceDate", width: 15 },
      { header: "Latest Total Fees", key: "latestTotalFees", width: 15 },
      { header: "Latest Package Start", key: "latestPackageStartDate", width: 20 },
      { header: "Latest Package End", key: "latestPackageEndDate", width: 20 },
      { header: "Latest Status", key: "latestStatus", width: 10 },
    ];

    // Helper function to format date as dd/mm/yyyy
    const formatDate = (date) => {
      if (!date) return "N/A";
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    // Helper function to format currency
    const formatCurrency = (amount) => {
      return amount ? `₹${amount.toFixed(2)}` : "₹0.00";
    };
    
    members.forEach((member) => {
      // Get the latest membership if available
      const latestMembership = member.memberships && member.memberships.length > 0 ? member.memberships[0] : null;
      
      worksheet.addRow({
        memberId: member.id,
        memberName: member.memberName || "N/A",
        email: member.email || "N/A",
        phone: member.phone || "N/A",
        chapterName: member.chapter?.name || "N/A",
        address: member.address || "N/A",
        venueExpiryDate: formatDate(member.venueExpiryDate),
        hoExpiryDate: formatDate(member.hoExpiryDate),
        latestInvoiceNumber: latestMembership ? latestMembership.invoiceNumber : "N/A",
        latestPackageName: latestMembership?.package?.name || "N/A",
        latestInvoiceDate: latestMembership ? formatDate(latestMembership.invoiceDate) : "N/A",
        latestTotalFees: latestMembership ? formatCurrency(latestMembership.totalFees) : "N/A",
        latestPackageStartDate: latestMembership ? formatDate(latestMembership.packageStartDate) : "N/A",
        latestPackageEndDate: latestMembership ? formatDate(latestMembership.packageEndDate) : "N/A",
        latestStatus: latestMembership ? (latestMembership.active ? "Active" : "Inactive") : "N/A",
      });
    });

    // Set headers & send workbook
    // Add filters to filename if provided
    let filename = "members_report";
    if (fromDate && toDate) {
      filename += `_${fromDate}_to_${toDate}`;
    } else if (fromDate) {
      filename += `_from_${fromDate}`;
    } else if (toDate) {
      filename += `_to_${toDate}`;
    }
    if (chapterId) {
      filename += `_chapter_${chapterId}`;
    }
    filename += ".xlsx";
    
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = { exportMembers };