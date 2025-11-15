const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const productFieldController = require('../controllers/productFieldCustomizationController')

// ============================================================================
// PRODUCT FIELD CUSTOMIZATION ROUTES
// ============================================================================
// This module provides API endpoints for managing custom fields for Products.
// It uses the existing custom_field_definitions and custom_field_values tables
// with entity_type set to 'product'.
//
// Business logic is handled by the productFieldCustomizationController
//
// Special Requirements:
// 1. "Product Name" field is ALWAYS required and cannot be deleted
// 2. All other product fields can be made required or optional
// 3. Prevent duplicate field names
// 4. Only organization admins can modify product fields
// ============================================================================

// Apply authentication middleware to all routes
// All routes require a valid authentication token
router.use(authenticateToken)

// ============================================================================
// MIDDLEWARE: Check if user is an admin
// ============================================================================
/**
 * Middleware to verify that the user has admin privileges
 * Only admins can create, update, or delete product field definitions
 */
const requireAdmin = (req, res, next) => {
  console.log('🔐 Checking admin privileges for user:', req.user?.id)
  console.log('   User role:', req.user?.role)

  // Check if user has admin role
  if (!req.user || req.user.role !== 'admin') {
    console.log('❌ Access denied - user is not an admin')
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only organization administrators can modify product fields'
    })
  }

  console.log('✅ Admin check passed')
  next()
}

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * GET /api/organizations/:organizationId/field-customization/product
 * Get all product field definitions for an organization
 *
 * Authentication: Required (any authenticated user)
 * Authorization: User must belong to the organization
 *
 * Query Parameters:
 * - activeOnly (boolean, default: true): Only return active (non-deleted) fields
 *
 * Response:
 * {
 *   success: true,
 *   count: 5,
 *   fields: [...]
 * }
 */
router.get('/', productFieldController.getProductFields)

/**
 * POST /api/organizations/:organizationId/field-customization/product
 * Create a new product field definition
 *
 * Authentication: Required
 * Authorization: Admin only
 *
 * Request Body:
 * {
 *   fieldName: "warranty_period",
 *   fieldLabel: "Warranty Period",
 *   fieldType: "select",
 *   isRequired: false,
 *   fieldOptions: [{label: "30 Days", value: "30"}, ...],
 *   ...
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Product field created successfully",
 *   field: {...}
 * }
 */
router.post('/', requireAdmin, productFieldController.createProductField)

/**
 * PATCH /api/organizations/:organizationId/field-customization/product/:fieldId
 * Update an existing product field definition
 *
 * Authentication: Required
 * Authorization: Admin only
 *
 * Path Parameters:
 * - fieldId: UUID of the field to update
 *
 * Request Body (all optional):
 * {
 *   fieldLabel: "Updated Label",
 *   isRequired: true,
 *   displayOrder: 5,
 *   fieldOptions: [...],
 *   ...
 * }
 *
 * Special Rules:
 * - "Product Name" field cannot be made optional
 * - fieldName and entityType cannot be changed
 *
 * Response:
 * {
 *   success: true,
 *   message: "Product field updated successfully",
 *   field: {...}
 * }
 */
router.patch('/:fieldId', requireAdmin, productFieldController.updateProductField)

/**
 * DELETE /api/organizations/:organizationId/field-customization/product/:fieldId
 * Delete a product field definition
 *
 * Authentication: Required
 * Authorization: Admin only
 *
 * Path Parameters:
 * - fieldId: UUID of the field to delete
 *
 * Query Parameters:
 * - permanent (boolean, default: false): If true, permanently deletes field and values
 *
 * Special Rules:
 * - "Product Name" field cannot be deleted
 *
 * Response:
 * {
 *   success: true,
 *   message: "Product field deactivated (can be reactivated later)"
 * }
 */
router.delete('/:fieldId', requireAdmin, productFieldController.deleteProductField)

// ============================================================================
// EXPORT ROUTER
// ============================================================================

module.exports = router
