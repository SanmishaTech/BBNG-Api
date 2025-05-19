const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middleware/auth');
const createUploadMiddleware = require('../middleware/uploadMiddleware');

// Configure upload middleware for transaction invoice images
const transactionUpload = createUploadMiddleware('transactions', [
  {
    name: 'invoiceImage',
    allowedTypes: ['image/jpeg', 'image/png'],
    maxSize: 5 * 1024 * 1024 // 5MB
  }
]);

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Chapter-specific transaction routes
router.get('/chapters/:chapterId/transactions', transactionController.getTransactions);

// Routes with file upload
router.post('/chapters/:chapterId/transactions/upload', transactionUpload, transactionController.createTransaction);
router.put('/transactions/:id/upload', transactionUpload, transactionController.updateTransaction);

// Regular routes without file upload (fallback)
router.post('/chapters/:chapterId/transactions', transactionController.createTransaction);
router.get('/transactions/:id', transactionController.getTransactionById);
router.put('/transactions/:id', transactionController.updateTransaction);
router.delete('/transactions/:id', transactionController.deleteTransaction);

module.exports = router;
