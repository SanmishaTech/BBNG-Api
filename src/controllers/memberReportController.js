const ExcelJS = require("exceljs");
const prisma = require("../config/db");
const aclService = require("../services/aclService");

/**
 * GET /memberreports
 * Export member data to an Excel file (Super Admin only)
 * Selected fields: memberName, category, gender, dateOfBirth, createdAt
 */
const exportMembers = async (req, res, next) => {
  try {
    // Permission check for export permission
    if (!aclService.hasPermission(req.user, "members.export")) {
      return res.status(403).json({
        errors: { message: "You do not have permission to export members" },
      });
    }

    // Extract date range from query parameters
    const { fromDate, toDate } = req.query;
    
    // Build where clause for date filtering
    const whereClause = {};
    
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      
      if (fromDate) {
        whereClause.createdAt.gte = new Date(fromDate);
      }
      
      if (toDate) {
        // Set time to end of day for toDate
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = endDate;
      }
    }

    // Fetch members with required fields and date filtering
    const members = await prisma.member.findMany({
      where: whereClause,
      select: {
        id: true,
        memberName: true,
        category: true,
        gender: true,
        dateOfBirth: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    });

    // Create workbook & worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Members");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Name", key: "memberName", width: 30 },
      { header: "Category", key: "category", width: 20 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Date of Birth", key: "dateOfBirth", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    // Helper function to format date as dd/mm/yyyy
    const formatDate = (date) => {
      if (!date) return "N/A";
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    members.forEach((m) => {
      worksheet.addRow({
        id: m.id,
        memberName: m.memberName,
        category: m.category,
        gender: m.gender,
        dateOfBirth: m.dateOfBirth ? formatDate(m.dateOfBirth) : "N/A",
        createdAt: formatDate(m.createdAt),
      });
    });

    // Set headers & send workbook
    // Add date range to filename if provided
    let filename = "members";
    if (fromDate && toDate) {
      filename += `_${fromDate}_to_${toDate}`;
    } else if (fromDate) {
      filename += `_from_${fromDate}`;
    } else if (toDate) {
      filename += `_to_${toDate}`;
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
