const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// License Management Routes

// GET /api/licenses - Get all licenses with filtering and pagination
router.get('/', licenseController.getLicenses);

// GET /api/licenses/:id - Get single license details
router.get('/:id', licenseController.getLicense);

// POST /api/licenses - Create new license
router.post('/', licenseController.createLicense);

// PUT /api/licenses/:id - Update license
router.put('/:id', licenseController.updateLicense);

// DELETE /api/licenses/:id - Deactivate license
router.delete('/:id', licenseController.deactivateLicense);

// POST /api/licenses/:id/transfer - Transfer license to different device
router.post('/:id/transfer', licenseController.transferLicense);

// POST /api/licenses/:id/generate-download - Generate download link
router.post('/:id/generate-download', licenseController.generateDownload);

// GET /api/contacts/:contactId/licenses - Get all licenses for a contact
router.get('/contacts/:contactId', licenseController.getContactLicenses);

module.exports = router;