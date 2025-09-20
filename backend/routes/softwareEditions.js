const express = require('express');
const router = express.Router();
const softwareEditionController = require('../controllers/softwareEditionController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Software Edition Management Routes

// GET /api/software-editions - Get all software editions
router.get('/', softwareEditionController.getSoftwareEditions);

// GET /api/software-editions/stats - Get software edition statistics
router.get('/stats', softwareEditionController.getEditionStats);

// GET /api/software-editions/:id - Get single software edition
router.get('/:id', softwareEditionController.getSoftwareEdition);

// GET /api/software-editions/:id/pricing - Get pricing for specific billing cycle
router.get('/:id/pricing', softwareEditionController.getPricing);

// POST /api/software-editions - Create new software edition (admin only)
router.post('/', softwareEditionController.createSoftwareEdition);

// PUT /api/software-editions/:id - Update software edition (admin only)
router.put('/:id', softwareEditionController.updateSoftwareEdition);

// DELETE /api/software-editions/:id - Delete/deactivate software edition (admin only)
router.delete('/:id', softwareEditionController.deleteSoftwareEdition);

module.exports = router;