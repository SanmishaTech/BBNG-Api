const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const createError = require("http-errors");

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

/** GET /api/chapters/:chapterId/transactions
 * List transactions for a specific chapter (pagination, filters, sort)
 */
const getTransactions = asyncHandler(async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  if (!chapterId) throw createError(400, "Invalid chapter ID");

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  const { 
    search = "", 
    accountType = "", 
    transactionType = "",
    startDate = "",
    endDate = ""
  } = req.query;
  
  const sortBy = req.query.sortBy || "date";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const filters = [{ chapterId }];
  
  if (accountType) {
    filters.push({
      accountType
    });
  }
  
  if (transactionType) {
    filters.push({
      transactionType
    });
  }
  
  if (search) {
    filters.push({
      OR: [
        { description: { contains: search } },
        { reference: { contains: search } }
      ]
    });
  }
  
  if (startDate && endDate) {
    filters.push({
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    });
  } else if (startDate) {
    filters.push({
      date: {
        gte: new Date(startDate)
      }
    });
  } else if (endDate) {
    filters.push({
      date: {
        lte: new Date(endDate)
      }
    });
  }
  
  const where = { AND: filters };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { chapter: true }
    }),
    prisma.transaction.count({ where }),
  ]);

  // Get chapter details to include opening and closing balances
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      bankopeningbalance: true,
      bankclosingbalance: true,
      cashopeningbalance: true,
      cashclosingbalance: true
    }
  });

  const totalPages = Math.ceil(total / limit);

  res.json({
    transactions,
    chapter,
    page,
    totalPages,
    totalTransactions: total,
  });
});

/** POST /api/chapters/:chapterId/transactions
 * Create a new transaction
 */
const createTransaction = asyncHandler(async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  if (!chapterId) throw createError(400, "Invalid chapter ID");

  // Validate chapter exists
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId }
  });
  
  if (!chapter) throw createError(404, "Chapter not found");

  // Check for upload errors
  if (req.uploadErrors && Object.keys(req.uploadErrors).length > 0) {
    return res.status(400).json({ errors: req.uploadErrors });
  }

  // Process form data - handle type conversion from FormData
  const formData = req.body;
  const processedData = {
    ...formData,
    amount: formData.amount ? parseFloat(formData.amount) : undefined,
    gstRate: formData.gstRate ? parseFloat(formData.gstRate) : undefined,
    gstAmount: formData.gstAmount ? parseFloat(formData.gstAmount) : undefined,
    hasInvoice: formData.hasInvoice === 'true' || formData.hasInvoice === true,
  };

  const schema = z.object({
    date: z.preprocess(
      (v) => new Date(v),
      z.date({ required_error: "Date is required" })
    ),
    accountType: z.enum(["cash", "bank"], {
      required_error: "Account type is required (cash or bank)"
    }),
    transactionType: z.enum(["credit", "debit"], {
      required_error: "Transaction type is required (credit or debit)"
    }),
    amount: z
      .number({
        required_error: "Amount is required",
        invalid_type_error: "Amount must be a number",
      })
      .positive("Amount must be positive"),
    transactionHead: z.string().optional(),
    narration: z.string().optional(),
    transactionDetails: z.string().optional(),
    description: z.string().optional(),
    reference: z.string().optional(),
    hasInvoice: z.boolean().optional().default(false),
    gstRate: z.number().optional(),
    gstAmount: z.number().optional(),
    invoiceNumber: z.string().optional(),
    partyName: z.string().optional(),
    partyGSTNo: z.string().optional(),
    partyAddress: z.string().optional()
  });

  const valid = await validateRequest(schema, processedData, res);
  if (!valid) return;

  // Get invoice image path if file was uploaded
  let invoiceImage = null;
  if (req.files && req.files.invoiceImage && req.files.invoiceImage.length > 0) {
    const file = req.files.invoiceImage[0];
    // Store relative path from uploads directory
    invoiceImage = file.path.replace(/\\/g, '/'); // Normalize path for cross-platform compatibility
  }

  // Create transaction
  const transaction = await prisma.transaction.create({
    data: {
      chapterId,
      date: new Date(processedData.date),
      accountType: processedData.accountType,
      transactionType: processedData.transactionType,
      amount: processedData.amount,
      transactionHead: processedData.transactionHead,
      narration: processedData.narration,
      transactionDetails: processedData.transactionDetails,
      description: processedData.description,
      reference: processedData.reference,
      hasInvoice: processedData.hasInvoice || false,
      gstRate: processedData.gstRate,
      gstAmount: processedData.gstAmount,
      invoiceImage,
      invoiceNumber: processedData.invoiceNumber,
      partyName: processedData.partyName,
      partyGSTNo: processedData.partyGSTNo,
      partyAddress: processedData.partyAddress
    }
  });

  // Update chapter balances based on transaction
  const updateData = {};
  
  if (req.body.accountType === "bank") {
    if (req.body.transactionType === "credit") {
      updateData.bankclosingbalance = new Prisma.Decimal(chapter.bankclosingbalance || 0).add(new Prisma.Decimal(req.body.amount));
    } else {
      // Check if this debit would result in a negative balance
      const newBalance = new Prisma.Decimal(chapter.bankclosingbalance || 0).sub(new Prisma.Decimal(req.body.amount));
      if (newBalance.isNegative()) {
        throw createError(400, "Transaction would result in a negative bank balance");
      }
      updateData.bankclosingbalance = newBalance;
    }
  } else { // cash
    if (req.body.transactionType === "credit") {
      updateData.cashclosingbalance = new Prisma.Decimal(chapter.cashclosingbalance || 0).add(new Prisma.Decimal(req.body.amount));
    } else {
      // Check if this debit would result in a negative balance
      const newBalance = new Prisma.Decimal(chapter.cashclosingbalance || 0).sub(new Prisma.Decimal(req.body.amount));
      if (newBalance.isNegative()) {
        throw createError(400, "Transaction would result in a negative cash balance");
      }
      updateData.cashclosingbalance = newBalance;
    }
  }

  // Update chapter with new balances
  await prisma.chapter.update({
    where: { id: chapterId },
    data: updateData
  });
  

  res.status(201).json(transaction);
});

/** GET /api/transactions/:id
 * Retrieve a transaction
 */
const getTransactionById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid transaction ID");

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { chapter: true }
  });
  
  if (!transaction) throw createError(404, "Transaction not found");

  res.json(transaction);
});

const updateBankClosingBalance  = asyncHandler(async (chapterId) => {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId }
  });

  if (!chapter) {
    throw createError(404, "Chapter not found");
  }
  
  // Get sum of credit transactions
  const creditSumResult = await prisma.transaction.aggregate({
    _sum: {
      amount: true
    },
    where: { 
      chapterId, 
      transactionType: "credit",
      accountType: "bank"
    }
  });
  
  // Get sum of debit transactions
  const debitSumResult = await prisma.transaction.aggregate({
    _sum: {
      amount: true
    },
    where: { 
      chapterId, 
      transactionType: "debit",
      accountType: "bank"
    }
  });
  
  const creditSum = creditSumResult._sum.amount || 0;
  const debitSum = debitSumResult._sum.amount || 0;
  
  // calculate the new bank closing balance
  const newBankClosingBalance = new Prisma.Decimal(chapter.bankopeningbalance || 0)
    .add(new Prisma.Decimal(creditSum))
    .sub(new Prisma.Decimal(debitSum));
    
  await prisma.chapter.update({
    where: { id: chapterId },
    data: { bankclosingbalance: newBankClosingBalance }
  });

  return true;
});

  

const updateCashClosingBalance  = asyncHandler(async (chapterId) => {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId }
  });

  if (!chapter) {
    throw createError(404, "Chapter not found");
  }
  
  // Get sum of credit transactions
  const creditSumResult = await prisma.transaction.aggregate({
    _sum: {
      amount: true
    },
    where: { 
      chapterId, 
      transactionType: "credit",
      accountType: "cash"
    }
  });
  
  // Get sum of debit transactions
  const debitSumResult = await prisma.transaction.aggregate({
    _sum: {
      amount: true
    },
    where: { 
      chapterId, 
      transactionType: "debit",
      accountType: "cash"
    }
  });
  
  const creditSum = creditSumResult._sum.amount || 0;
  const debitSum = debitSumResult._sum.amount || 0;
  
  // calculate the new bank closing balance
  const newCashClosingBalance = new Prisma.Decimal(chapter.cashopeningbalance || 0)
    .add(new Prisma.Decimal(creditSum))
    .sub(new Prisma.Decimal(debitSum));
    
  await prisma.chapter.update({
    where: { id: chapterId },
    data: { cashclosingbalance: newCashClosingBalance }
  });

  return true;
});

/** PUT /api/transactions/:id
 * Update a transaction
 */
const updateTransaction = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid transaction ID");

  // Get the existing transaction
  const existingTransaction = await prisma.transaction.findUnique({
    where: { id },
    include: { chapter: true }
  });
  
  if (!existingTransaction) throw createError(404, "Transaction not found");

  // Check if transaction is older than a month
  const transactionDate = new Date(existingTransaction.date);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  if (transactionDate < oneMonthAgo) {
    throw createError(403, "Transactions older than a month cannot be edited");
  }

  // Check for upload errors
  if (req.uploadErrors && Object.keys(req.uploadErrors).length > 0) {
    return res.status(400).json({ errors: req.uploadErrors });
  }

  // Process form data - handle type conversion from FormData
  const formData = req.body;
  const processedData = {
    ...formData,
    amount: formData.amount ? parseFloat(formData.amount) : undefined,
    gstRate: formData.gstRate ? parseFloat(formData.gstRate) : undefined,
    gstAmount: formData.gstAmount ? parseFloat(formData.gstAmount) : undefined,
    hasInvoice: formData.hasInvoice === 'true' || formData.hasInvoice === true,
  };

  const schema = z.object({
    date: z.preprocess(
      (v) => (v ? new Date(v) : undefined),
      z.date().optional()
    ),
    accountType: z.enum(["cash", "bank"]).optional(),
    transactionType: z.enum(["credit", "debit"]).optional(),
    amount: z.number().positive("Amount must be positive").optional(),
    transactionHead: z.string().optional(),
    narration: z.string().optional(),
    transactionDetails: z.string().optional(),
    description: z.string().optional(),
    reference: z.string().optional(),
    hasInvoice: z.boolean().optional(),
    gstRate: z.number().optional(),
    gstAmount: z.number().optional(),
    invoiceNumber: z.string().optional(),
    partyName: z.string().optional(),
    partyGSTNo: z.string().optional(),
    partyAddress: z.string().optional(),
    removeInvoiceImage: z.string().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

  const valid = await validateRequest(schema, processedData, res);
  if (!valid) return;

  // Get invoice image path if file was uploaded
  let invoiceImage = undefined; // undefined means no change to existing value
  if (req.files && req.files.invoiceImage && req.files.invoiceImage.length > 0) {
    const file = req.files.invoiceImage[0];
    // Store relative path from uploads directory
    invoiceImage = file.path.replace(/\\/g, '/'); // Normalize path for cross-platform compatibility
  } else if (processedData.removeInvoiceImage === 'true') {
    // If user explicitly wants to remove the image
    invoiceImage = null;
  }

  // Add the invoice image to the data to be updated
  if (invoiceImage !== undefined) {
    processedData.invoiceImage = invoiceImage;
  }

  // Start a transaction to ensure data consistency
  const result = await prisma.$transaction(async (prisma) => {
    // First, revert the effect of the old transaction
    const chapter = await prisma.chapter.findUnique({
      where: { id: existingTransaction.chapterId }
    });
    
    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: processedData
    });
    
    // Recalculate balances using the dedicated functions
    await updateBankClosingBalance(existingTransaction.chapterId);
    await updateCashClosingBalance(existingTransaction.chapterId);
    
    return updatedTransaction;
  });

  res.json(result);
});

/** DELETE /api/transactions/:id
 * Delete a transaction
 */
const deleteTransaction = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid transaction ID");

  // Get the existing transaction
  const existingTransaction = await prisma.transaction.findUnique({
    where: { id }
  });
  
  if (!existingTransaction) throw createError(404, "Transaction not found");

  // Start a transaction to ensure data consistency
  await prisma.$transaction(async (prisma) => {
    // First, revert the effect of the transaction
    const chapter = await prisma.chapter.findUnique({
      where: { id: existingTransaction.chapterId }
    });
    
    let updateData = {};
    
    // Revert transaction effect
    if (existingTransaction.accountType === "bank") {
      if (existingTransaction.transactionType === "credit") {
        updateData.bankclosingbalance = new Prisma.Decimal(chapter.bankclosingbalance || 0).sub(new Prisma.Decimal(existingTransaction.amount));
      } else {
        updateData.bankclosingbalance = new Prisma.Decimal(chapter.bankclosingbalance || 0).add(new Prisma.Decimal(existingTransaction.amount));
      }
    } else { // cash
      if (existingTransaction.transactionType === "credit") {
        updateData.cashclosingbalance = new Prisma.Decimal(chapter.cashclosingbalance || 0).sub(new Prisma.Decimal(existingTransaction.amount));
      } else {
        updateData.cashclosingbalance = new Prisma.Decimal(chapter.cashclosingbalance || 0).add(new Prisma.Decimal(existingTransaction.amount));
      }
    }
    
    // Delete the transaction
    await prisma.transaction.delete({
      where: { id }
    });
    
    // Update chapter with new balances
    await updateBankClosingBalance(existingTransaction.chapterId);
    await updateCashClosingBalance(existingTransaction.chapterId);
  });

  res.json({ message: "Transaction deleted successfully" });
});

module.exports = {
  getTransactions,
  createTransaction,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  updateBankClosingBalance,
  updateCashClosingBalance,
};
