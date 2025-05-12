const ExcelJS = require("exceljs");
const prisma = require("../config/db");
const aclService = require("../services/aclService");

/**
 * GET /transactionreports
 * Export transaction data to an Excel file (filtered by user's chapter)
 */
const exportTransactions = async (req, res, next) => {
  try {
    // Permission check for export permission
    if (!aclService.hasPermission(req.user, "transactions.export")) {
      return res.status(403).json({
        errors: { message: "You do not have permission to export transactions" },
      });
    }

    // Extract filter parameters from query
    const { fromDate, toDate, accountType, transactionType, hasInvoice } = req.query;
    
    // Build where clause for filtering
    const whereClause = {};
    
    // Date filtering
    if (fromDate || toDate) {
      whereClause.date = {};
      
      if (fromDate) {
        whereClause.date.gte = new Date(fromDate);
      }
      
      if (toDate) {
        // Set time to end of day for toDate
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        whereClause.date.lte = endDate;
      }
    }
    
    // Account type filtering (cash or bank)
    if (accountType) {
      whereClause.accountType = accountType;
    }
    
    // Transaction type filtering (credit or debit)
    if (transactionType) {
      whereClause.transactionType = transactionType;
    }
    
    // Invoice filtering
    if (hasInvoice === "true" || hasInvoice === "false") {
      whereClause.hasInvoice = hasInvoice === "true";
    }
    
    // For non-super-admin users, filter by chapter
    // Super-admin can see all transactions
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

    // Fetch transactions with required fields
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      select: {
        id: true,
        date: true,
        accountType: true,
        transactionType: true,
        amount: true,
        transactionHead: true,
        narration: true,
        reference: true,
        hasInvoice: true,
        partyName: true,
        partyGSTNo: true,
        partyAddress: true,
        gstRate: true,
        gstAmount: true,
        invoiceNumber: true,
        chapter: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { date: "desc" },
        { id: "desc" }
      ],
    });

    // Create workbook & worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transactions");

    // Determine if we need invoice columns based on if any transaction has an invoice
    const hasAnyInvoice = transactions.some(t => t.hasInvoice);
    
    // Define base columns (always shown)
    const baseColumns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Chapter", key: "chapterName", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Account Type", key: "accountType", width: 15 },
      { header: "Type", key: "transactionType", width: 10 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Head", key: "transactionHead", width: 20 },
      { header: "Narration", key: "narration", width: 30 },
      { header: "Reference", key: "reference", width: 20 },
      { header: "Has Invoice", key: "hasInvoice", width: 10 },
    ];
    
    // Invoice-related columns (only shown if at least one transaction has an invoice)
    const invoiceColumns = [
      { header: "Invoice Number", key: "invoiceNumber", width: 20 },
      { header: "Party Name", key: "partyName", width: 30 },
      { header: "Party GST", key: "partyGSTNo", width: 20 },
      { header: "Party Address", key: "partyAddress", width: 30 },
      { header: "GST Rate %", key: "gstRate", width: 15 },
      { header: "GST Amount", key: "gstAmount", width: 15 },
    ];
    
    // Use all columns if any transaction has an invoice, otherwise just the base columns
    worksheet.columns = hasAnyInvoice 
      ? [...baseColumns, ...invoiceColumns]
      : baseColumns;

    // Helper function to format date as dd/mm/yyyy
    const formatDate = (date) => {
      if (!date) return "N/A";
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    transactions.forEach((t) => {
      // Base row data (always included)
      const rowData = {
        id: t.id,
        chapterName: t.chapter?.name || "N/A",
        date: formatDate(t.date),
        accountType: t.accountType,
        transactionType: t.transactionType === "credit" ? "Credit" : "Debit",
        amount: t.amount.toString(),
        transactionHead: t.transactionHead || "N/A",
        narration: t.narration || "N/A",
        reference: t.reference || "N/A",
        hasInvoice: t.hasInvoice ? "Yes" : "No",
      };
      
      // Only add invoice data if any transaction has an invoice
      if (hasAnyInvoice) {
        // For transactions with invoices, add invoice details
        if (t.hasInvoice) {
          rowData.invoiceNumber = t.invoiceNumber || "N/A";
          rowData.partyName = t.partyName || "N/A";
          rowData.partyGSTNo = t.partyGSTNo || "N/A";
          rowData.partyAddress = t.partyAddress || "N/A";
          rowData.gstRate = t.gstRate ? `${t.gstRate}%` : "N/A";
          rowData.gstAmount = t.gstAmount ? t.gstAmount.toString() : "N/A";
        } else {
          // For transactions without invoices, leave these cells blank
          rowData.invoiceNumber = "";
          rowData.partyName = "";
          rowData.partyGSTNo = "";
          rowData.partyAddress = "";
          rowData.gstRate = "";
          rowData.gstAmount = "";
        }
      }
      
      worksheet.addRow(rowData);
    });

    // Add styles for header row - bold text
    worksheet.getRow(1).font = { bold: true };
    
    // Format amount column as currency
    worksheet.getColumn('amount').numFmt = '₹#,##0.00';
    
    // Format GST amount column as currency if it exists
    if (hasAnyInvoice) {
      worksheet.getColumn('gstAmount').numFmt = '₹#,##0.00';
    }

    // Set headers & send workbook
    // Add date range to filename if provided
    let filename = "transactions";
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

module.exports = { exportTransactions };
