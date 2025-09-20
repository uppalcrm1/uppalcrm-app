const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Device Management Routes

// GET /api/devices - Get all devices with filtering and pagination
router.get('/', deviceController.getDevices);

// GET /api/devices/stats - Get device statistics
router.get('/stats', deviceController.getDeviceStats);

// GET /api/devices/:id - Get single device details
router.get('/:id', deviceController.getDevice);

// POST /api/devices/register - Register new device
router.post('/register', deviceController.registerDevice);

// PUT /api/devices/:id - Update device information
router.put('/:id', deviceController.updateDevice);

// DELETE /api/devices/:id - Deactivate device
router.delete('/:id', deviceController.deactivateDevice);

// GET /api/devices/:macAddress/licenses - Get licenses for specific MAC address
router.get('/:macAddress/licenses', deviceController.getDeviceLicenses);

// GET /api/contacts/:contactId/devices - Get all devices for a contact
router.get('/contacts/:contactId', deviceController.getContactDevices);

module.exports = router;