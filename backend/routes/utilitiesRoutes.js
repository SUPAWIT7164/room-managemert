const express = require('express');
const router = express.Router();
const utilitiesController = require('../controllers/utilitiesController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/utilities/expenses
router.get('/expenses', utilitiesController.getExpenses);

module.exports = router;

