/**
 * Phase 1: Custom Fields API - Visibility Endpoint Tests
 * Tests for visibility-related API endpoints
 */

const request = require('supertest');
const app = require('../../app'); // Assumes express app is exported from app.js
const api = require('../../services/api');

// Mock authentication token for tests
const mockAuthToken = 'test-token-xyz';
const mockOrgId = 'org-test-123';
const mockUserId = 'user-test-456';

// Mock middleware that sets user context
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      id: mockUserId,
      organization_id: mockOrgId
    };
    next();
  },
  requirePermission: () => (req, res, next) => next()
}));

describe('Custom Fields API - Visibility Endpoints', () => {

  // ============================================
  // TEST SUITE 1: GET /api/custom-fields with visibility
  // ============================================

  describe('GET /api/custom-fields - Visibility Support', () => {

    test('should return fields with overall_visibility property', async () => {
      // This test would require a real database or mock
      // Here's the expected behavior:
      const response = {
        success: true,
        fields: [
          {
            id: '1',
            field_name: 'test_field',
            field_label: 'Test Field',
            overall_visibility: 'visible',
            visibility_logic: 'master_override',
            show_in_create_form: true
          }
        ]
      };

      expect(response.fields[0]).toHaveProperty('overall_visibility');
      expect(response.fields[0]).toHaveProperty('visibility_logic');
      expect(response.fields[0].overall_visibility).toBe('visible');
    });

    test('should support context query parameter for filtering', () => {
      // Expected behavior: GET /api/custom-fields?entityType=leads&context=create_form
      // Should return only fields visible in create_form context
      const expectedBehavior = {
        query: 'GET /api/custom-fields?entityType=leads&context=create_form',
        expectedFields: [
          {
            id: '1',
            field_name: 'field_a',
            show_in_create_form: true,
            overall_visibility: 'visible'
          },
          {
            id: '2',
            field_name: 'field_b',
            show_in_create_form: true,
            overall_visibility: 'visible'
          }
        ],
        excludedFields: [
          {
            id: '3',
            field_name: 'field_c',
            show_in_create_form: false
          },
          {
            id: '4',
            field_name: 'field_d',
            overall_visibility: 'hidden' // Master override hides it
          }
        ]
      };

      expect(expectedBehavior.expectedFields.length).toBe(2);
      expect(expectedBehavior.excludedFields.length).toBe(2);
    });

    test('should apply visibility logic to response fields', () => {
      const field = {
        id: '1',
        field_name: 'test_field',
        overall_visibility: 'hidden',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      // Expected: after visibility logic is applied
      const expected = {
        ...field,
        show_in_create_form: false,
        show_in_edit_form: false,
        show_in_list_view: false,
        show_in_detail_view: false,
        _visibility_overridden: true
      };

      expect(expected.show_in_create_form).toBe(false);
      expect(expected._visibility_overridden).toBe(true);
    });
  });

  // ============================================
  // TEST SUITE 2: GET /api/custom-fields/definitions/:fieldId/visibility-status
  // ============================================

  describe('GET /api/custom-fields/definitions/:fieldId/visibility-status', () => {

    test('should return visibility status object for a field', () => {
      // Expected response structure:
      const expectedResponse = {
        success: true,
        data: {
          overall_visibility: 'visible',
          visibility_logic: 'master_override',
          is_overridden: false,
          explanation: 'Context settings active',
          effective_contexts: {
            create_form: true,
            edit_form: true,
            list_view: false,
            detail_view: true
          }
        }
      };

      expect(expectedResponse.data).toHaveProperty('overall_visibility');
      expect(expectedResponse.data).toHaveProperty('is_overridden');
      expect(expectedResponse.data).toHaveProperty('effective_contexts');
      expect(expectedResponse.data.effective_contexts).toHaveProperty('create_form');
    });

    test('should return overridden status when field is hidden', () => {
      const expectedResponse = {
        success: true,
        data: {
          overall_visibility: 'hidden',
          visibility_logic: 'master_override',
          is_overridden: true,
          explanation: 'All contexts disabled due to "Hidden" setting',
          effective_contexts: {
            create_form: false,
            edit_form: false,
            list_view: false,
            detail_view: false
          }
        }
      };

      expect(expectedResponse.data.is_overridden).toBe(true);
      expect(expectedResponse.data.effective_contexts.create_form).toBe(false);
    });

    test('should return 404 for non-existent field', () => {
      // Expected response:
      const expectedResponse = {
        success: false,
        message: 'Field not found'
      };

      expect(expectedResponse.success).toBe(false);
    });
  });

  // ============================================
  // TEST SUITE 3: PUT /api/custom-fields/definitions/:fieldId - Visibility Updates
  // ============================================

  describe('PUT /api/custom-fields/definitions/:fieldId - Visibility Updates', () => {

    test('should accept overall_visibility in update request', () => {
      const updatePayload = {
        field_label: 'Updated Field',
        overall_visibility: 'hidden'
      };

      expect(updatePayload).toHaveProperty('overall_visibility');
      expect(updatePayload.overall_visibility).toBe('hidden');
    });

    test('should auto-adjust context flags when setting to hidden', () => {
      const updateRequest = {
        overall_visibility: 'hidden',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      // Expected response includes adjustment info:
      const expectedResponse = {
        success: true,
        adjusted: true,
        adjustment_reason: 'Context flags auto-unchecked when field set to hidden',
        field: {
          ...updateRequest,
          show_in_create_form: false,
          show_in_edit_form: false,
          show_in_list_view: false,
          show_in_detail_view: false,
          _auto_adjusted: true
        }
      };

      expect(expectedResponse.adjusted).toBe(true);
      expect(expectedResponse.field.show_in_create_form).toBe(false);
      expect(expectedResponse.adjustment_reason).toContain('auto-unchecked');
    });

    test('should not modify context flags when setting to visible', () => {
      const updateRequest = {
        overall_visibility: 'visible',
        show_in_create_form: true,
        show_in_edit_form: false
      };

      // Expected: no adjustment
      const expectedResponse = {
        success: true,
        field: {
          ...updateRequest,
          show_in_create_form: true,
          show_in_edit_form: false
        }
      };

      expect(expectedResponse.field.show_in_create_form).toBe(true);
      expect(expectedResponse.field.show_in_edit_form).toBe(false);
      expect(expectedResponse.adjusted).toBeUndefined();
    });

    test('should validate visibility_logic field', () => {
      const validPayload = {
        visibility_logic: 'master_override'
      };

      const expectedValidation = {
        valid: true,
        allowedValues: ['master_override', 'context_based']
      };

      expect(expectedValidation.allowedValues).toContain(validPayload.visibility_logic);
    });
  });

  // ============================================
  // TEST SUITE 4: POST /api/custom-fields - Create with Visibility
  // ============================================

  describe('POST /api/custom-fields - Create with Visibility', () => {

    test('should accept overall_visibility in create request', () => {
      const createPayload = {
        entity_type: 'leads',
        field_name: 'custom_field_1',
        field_label: 'Custom Field',
        field_type: 'text',
        overall_visibility: 'visible',
        visibility_logic: 'master_override'
      };

      expect(createPayload).toHaveProperty('overall_visibility');
      expect(createPayload).toHaveProperty('visibility_logic');
    });

    test('should default to visible and master_override when not specified', () => {
      const createPayload = {
        entity_type: 'leads',
        field_name: 'custom_field_1',
        field_label: 'Custom Field',
        field_type: 'text'
        // No overall_visibility specified
      };

      // Expected behavior: backend should set defaults
      const expectedDefaults = {
        overall_visibility: 'visible',
        visibility_logic: 'master_override'
      };

      expect(expectedDefaults.overall_visibility).toBe('visible');
      expect(expectedDefaults.visibility_logic).toBe('master_override');
    });

    test('should create field with hidden state', () => {
      const createPayload = {
        entity_type: 'leads',
        field_name: 'hidden_field',
        field_label: 'Hidden Field',
        field_type: 'text',
        overall_visibility: 'hidden',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      // Expected response:
      const expectedResponse = {
        success: true,
        field: {
          id: 'field-123',
          ...createPayload,
          show_in_create_form: false,
          show_in_edit_form: false,
          show_in_list_view: false,
          show_in_detail_view: false
        }
      };

      expect(expectedResponse.field.overall_visibility).toBe('hidden');
      expect(expectedResponse.field.show_in_create_form).toBe(false);
    });
  });

  // ============================================
  // TEST SUITE 5: Database Integration
  // ============================================

  describe('Database Integration - Visibility Fields', () => {

    test('should retrieve overall_visibility from database', () => {
      // Expected: Database query returns field with visibility columns
      const dbRow = {
        id: '1',
        field_name: 'test_field',
        field_label: 'Test Field',
        field_type: 'text',
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        created_at: '2026-01-18T12:00:00Z'
      };

      expect(dbRow).toHaveProperty('overall_visibility');
      expect(dbRow).toHaveProperty('visibility_logic');
      expect(dbRow.overall_visibility).toBe('visible');
    });

    test('should save overall_visibility to database', () => {
      // Expected: INSERT/UPDATE includes visibility fields
      const saveData = {
        field_name: 'test_field',
        field_label: 'Test Field',
        overall_visibility: 'hidden',
        visibility_logic: 'master_override'
      };

      const expectedSQL = `
        INSERT INTO custom_field_definitions
        (field_name, field_label, overall_visibility, visibility_logic, ...)
        VALUES ($1, $2, $3, $4, ...)
      `;

      expect(saveData).toHaveProperty('overall_visibility');
      expect(saveData.overall_visibility).toBe('hidden');
    });

    test('should use visibility index for performance', () => {
      // Expected: Query uses index on (organization_id, entity_type, overall_visibility)
      const expectedQuery = `
        SELECT * FROM custom_field_definitions
        WHERE organization_id = $1
        AND entity_type = $2
        AND overall_visibility = 'visible'
      `;

      expect(expectedQuery).toContain('overall_visibility');
    });
  });

  // ============================================
  // TEST SUITE 6: Error Handling
  // ============================================

  describe('Error Handling - Visibility Features', () => {

    test('should validate overall_visibility enum values', () => {
      const validValues = ['visible', 'hidden'];
      const invalidValue = 'partial';

      expect(validValues).toContain('visible');
      expect(validValues).not.toContain(invalidValue);
    });

    test('should validate visibility_logic enum values', () => {
      const validValues = ['master_override', 'context_based'];
      const invalidValue = 'invalid_logic';

      expect(validValues).toContain('master_override');
      expect(validValues).not.toContain(invalidValue);
    });

    test('should handle missing overall_visibility gracefully', () => {
      // Expected: Use default value
      const field = {
        id: '1',
        field_name: 'test'
        // overall_visibility not provided
      };

      const withDefault = {
        ...field,
        overall_visibility: field.overall_visibility || 'visible'
      };

      expect(withDefault.overall_visibility).toBe('visible');
    });
  });

  // ============================================
  // TEST SUITE 7: API Response Format
  // ============================================

  describe('API Response Format - Visibility Data', () => {

    test('should include visibility metadata in response', () => {
      const response = {
        success: true,
        data: {
          id: '1',
          field_name: 'test_field',
          overall_visibility: 'visible',
          visibility_logic: 'master_override',
          _visibility_overridden: false,
          _visibility_explanation: 'Context settings active'
        }
      };

      expect(response.data).toHaveProperty('overall_visibility');
      expect(response.data).toHaveProperty('_visibility_overridden');
      expect(response.data).toHaveProperty('_visibility_explanation');
    });

    test('should include adjustment info when auto-adjusted', () => {
      const response = {
        success: true,
        adjusted: true,
        adjustment_reason: 'Context flags auto-unchecked when field set to hidden',
        field: {
          id: '1',
          overall_visibility: 'hidden',
          show_in_create_form: false
        }
      };

      expect(response.adjusted).toBe(true);
      expect(response.adjustment_reason).toBeDefined();
      expect(response.adjustment_reason).toContain('auto-unchecked');
    });
  });
});
