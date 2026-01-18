const express = require('express');
const router = express.Router();
const quotaController = require('../controllers/quotaController');
const { authenticate, isAdmin } = require('../middleware/auth');

// All quota routes require authentication and admin role
router.use(authenticate);
router.use(isAdmin);

router.get('/', quotaController.getAll);
router.post('/', quotaController.create);
router.put('/:id', quotaController.update);
router.post('/update', quotaController.updateBySlug);
router.delete('/:id', quotaController.delete);

module.exports = router;




