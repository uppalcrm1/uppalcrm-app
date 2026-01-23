/**
 * Phase 1: Field Visibility Service Tests
 * Comprehensive test suite for master override visibility logic
 */

const fieldVisibilityService = require('../fieldVisibilityService');

describe('FieldVisibilityService', () => {

  // ============================================
  // TEST SUITE 1: applyVisibilityLogic()
  // ============================================

  describe('applyVisibilityLogic()', () => {

    test('should return field unchanged when overall_visibility is "visible"', () => {
      const field = {
        id: 1,
        field_name: 'test_field',
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: false,
        show_in_list_view: true,
        show_in_detail_view: false
      };

      const result = fieldVisibilityService.applyVisibilityLogic(field);

      expect(result.show_in_create_form).toBe(true);
      expect(result.show_in_edit_form).toBe(false);
      expect(result.show_in_list_view).toBe(true);
      expect(result.show_in_detail_view).toBe(false);
      expect(result._visibility_overridden).toBe(false);
      expect(result._visibility_explanation).toBe('Context settings active');
    });

    test('should override all context flags when overall_visibility is "hidden"', () => {
      const field = {
        id: 1,
        field_name: 'hidden_field',
        overall_visibility: 'hidden',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      const result = fieldVisibilityService.applyVisibilityLogic(field);

      expect(result.show_in_create_form).toBe(false);
      expect(result.show_in_edit_form).toBe(false);
      expect(result.show_in_list_view).toBe(false);
      expect(result.show_in_detail_view).toBe(false);
      expect(result._visibility_overridden).toBe(true);
      expect(result._visibility_explanation).toBe('All contexts disabled due to "Hidden" setting');
    });

    test('should handle missing visibility_logic field (default to master_override)', () => {
      const field = {
        id: 1,
        field_name: 'test_field',
        overall_visibility: 'hidden',
        // visibility_logic not provided
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      const result = fieldVisibilityService.applyVisibilityLogic(field);

      expect(result.show_in_create_form).toBe(false);
      expect(result._visibility_overridden).toBe(true);
    });

    test('should preserve additional field properties when applying logic', () => {
      const field = {
        id: 1,
        field_name: 'test_field',
        field_label: 'Test Field',
        field_type: 'text',
        is_required: true,
        overall_visibility: 'hidden',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      const result = fieldVisibilityService.applyVisibilityLogic(field);

      expect(result.id).toBe(1);
      expect(result.field_name).toBe('test_field');
      expect(result.field_label).toBe('Test Field');
      expect(result.field_type).toBe('text');
      expect(result.is_required).toBe(true);
      expect(result.show_in_create_form).toBe(false);
    });
  });

  // ============================================
  // TEST SUITE 2: isVisibleInContext()
  // ============================================

  describe('isVisibleInContext()', () => {

    test('should return true for create_form when field is visible and flag is true', () => {
      const field = {
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: false,
        show_in_list_view: false,
        show_in_detail_view: false
      };

      const result = fieldVisibilityService.isVisibleInContext(field, 'create_form');

      expect(result).toBe(true);
    });

    test('should return false for edit_form when field is visible but flag is false', () => {
      const field = {
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: false,
        show_in_list_view: false,
        show_in_detail_view: false
      };

      const result = fieldVisibilityService.isVisibleInContext(field, 'edit_form');

      expect(result).toBe(false);
    });

    test('should return false for all contexts when overall_visibility is hidden', () => {
      const field = {
        overall_visibility: 'hidden',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      expect(fieldVisibilityService.isVisibleInContext(field, 'create_form')).toBe(false);
      expect(fieldVisibilityService.isVisibleInContext(field, 'edit_form')).toBe(false);
      expect(fieldVisibilityService.isVisibleInContext(field, 'list_view')).toBe(false);
      expect(fieldVisibilityService.isVisibleInContext(field, 'detail_view')).toBe(false);
    });

    test('should return false for invalid context', () => {
      const field = {
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      const result = fieldVisibilityService.isVisibleInContext(field, 'invalid_context');

      expect(result).toBe(false);
    });

    test('should handle all valid contexts', () => {
      const field = {
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      const contexts = ['create_form', 'edit_form', 'list_view', 'detail_view'];

      contexts.forEach(context => {
        const result = fieldVisibilityService.isVisibleInContext(field, context);
        expect(result).toBe(true);
      });
    });
  });

  // ============================================
  // TEST SUITE 3: validateUpdate()
  // ============================================

  describe('validateUpdate()', () => {

    test('should not modify updates when overall_visibility is "visible"', () => {
      const updates = {
        field_label: 'Updated Label',
        overall_visibility: 'visible',
        show_in_create_form: true,
        show_in_edit_form: false
      };

      const result = fieldVisibilityService.validateUpdate(updates);

      expect(result.field_label).toBe('Updated Label');
      expect(result.show_in_create_form).toBe(true);
      expect(result.show_in_edit_form).toBe(false);
      expect(result._auto_adjusted).toBeUndefined();
    });

    test('should auto-uncheck all context flags when overall_visibility is "hidden"', () => {
      const updates = {
        field_label: 'Hidden Field',
        overall_visibility: 'hidden',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      const result = fieldVisibilityService.validateUpdate(updates);

      expect(result.show_in_create_form).toBe(false);
      expect(result.show_in_edit_form).toBe(false);
      expect(result.show_in_list_view).toBe(false);
      expect(result.show_in_detail_view).toBe(false);
      expect(result._auto_adjusted).toBe(true);
      expect(result._adjustment_reason).toBe('Context flags auto-unchecked when field set to hidden');
    });

    test('should preserve other update properties when adjusting', () => {
      const updates = {
        field_label: 'New Label',
        field_description: 'New Description',
        is_required: true,
        overall_visibility: 'hidden',
        show_in_create_form: true
      };

      const result = fieldVisibilityService.validateUpdate(updates);

      expect(result.field_label).toBe('New Label');
      expect(result.field_description).toBe('New Description');
      expect(result.is_required).toBe(true);
      expect(result.show_in_create_form).toBe(false);
    });

    test('should handle partial updates gracefully', () => {
      const updates = {
        overall_visibility: 'hidden'
        // No other properties
      };

      const result = fieldVisibilityService.validateUpdate(updates);

      expect(result.overall_visibility).toBe('hidden');
      expect(result.show_in_create_form).toBe(false);
      expect(result.show_in_edit_form).toBe(false);
      expect(result.show_in_list_view).toBe(false);
      expect(result.show_in_detail_view).toBe(false);
    });
  });

  // ============================================
  // TEST SUITE 4: getVisibilityStatus()
  // ============================================

  describe('getVisibilityStatus()', () => {

    test('should return correct status for visible field with all contexts enabled', () => {
      const field = {
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      const status = fieldVisibilityService.getVisibilityStatus(field);

      expect(status.overall_visibility).toBe('visible');
      expect(status.visibility_logic).toBe('master_override');
      expect(status.is_overridden).toBe(false);
      expect(status.explanation).toBe('Context settings active');
      expect(status.effective_contexts.create_form).toBe(true);
      expect(status.effective_contexts.edit_form).toBe(true);
      expect(status.effective_contexts.list_view).toBe(true);
      expect(status.effective_contexts.detail_view).toBe(true);
    });

    test('should return correct status for hidden field', () => {
      const field = {
        overall_visibility: 'hidden',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      const status = fieldVisibilityService.getVisibilityStatus(field);

      expect(status.overall_visibility).toBe('hidden');
      expect(status.visibility_logic).toBe('master_override');
      expect(status.is_overridden).toBe(true);
      expect(status.explanation).toBe('All contexts disabled due to "Hidden" setting');
      expect(status.effective_contexts.create_form).toBe(false);
      expect(status.effective_contexts.edit_form).toBe(false);
      expect(status.effective_contexts.list_view).toBe(false);
      expect(status.effective_contexts.detail_view).toBe(false);
    });

    test('should return status with partial contexts enabled', () => {
      const field = {
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: false,
        show_in_list_view: true,
        show_in_detail_view: false
      };

      const status = fieldVisibilityService.getVisibilityStatus(field);

      expect(status.effective_contexts.create_form).toBe(true);
      expect(status.effective_contexts.edit_form).toBe(false);
      expect(status.effective_contexts.list_view).toBe(true);
      expect(status.effective_contexts.detail_view).toBe(false);
    });

    test('should have all required properties in status object', () => {
      const field = {
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      const status = fieldVisibilityService.getVisibilityStatus(field);

      expect(status).toHaveProperty('overall_visibility');
      expect(status).toHaveProperty('visibility_logic');
      expect(status).toHaveProperty('is_overridden');
      expect(status).toHaveProperty('explanation');
      expect(status).toHaveProperty('effective_contexts');
      expect(status.effective_contexts).toHaveProperty('create_form');
      expect(status.effective_contexts).toHaveProperty('edit_form');
      expect(status.effective_contexts).toHaveProperty('list_view');
      expect(status.effective_contexts).toHaveProperty('detail_view');
    });
  });

  // ============================================
  // TEST SUITE 5: Integration Tests
  // ============================================

  describe('Integration: Full Workflow', () => {

    test('should handle complete create -> hidden -> verify workflow', () => {
      // Step 1: Create field with visible state
      let field = {
        id: 1,
        field_name: 'test_field',
        field_label: 'Test Field',
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: true,
        show_in_edit_form: true,
        show_in_list_view: true,
        show_in_detail_view: true
      };

      // Verify initial state
      expect(fieldVisibilityService.isVisibleInContext(field, 'create_form')).toBe(true);
      expect(fieldVisibilityService.isVisibleInContext(field, 'list_view')).toBe(true);

      // Step 2: Update to hide field
      const updates = {
        overall_visibility: 'hidden'
      };

      const validatedUpdates = fieldVisibilityService.validateUpdate(updates);

      expect(validatedUpdates.show_in_create_form).toBe(false);
      expect(validatedUpdates._auto_adjusted).toBe(true);

      // Step 3: Simulate backend response and apply visibility logic
      field = {
        ...field,
        overall_visibility: 'hidden',
        show_in_create_form: false,
        show_in_edit_form: false,
        show_in_list_view: false,
        show_in_detail_view: false
      };

      const processedField = fieldVisibilityService.applyVisibilityLogic(field);

      // Verify final state
      expect(fieldVisibilityService.isVisibleInContext(processedField, 'create_form')).toBe(false);
      expect(fieldVisibilityService.isVisibleInContext(processedField, 'list_view')).toBe(false);

      const status = fieldVisibilityService.getVisibilityStatus(processedField);
      expect(status.is_overridden).toBe(true);
    });

    test('should filter multiple fields by context correctly', () => {
      const fields = [
        {
          id: 1,
          field_name: 'field1',
          overall_visibility: 'visible',
          visibility_logic: 'master_override',
          show_in_create_form: true,
          show_in_edit_form: false,
          show_in_list_view: true,
          show_in_detail_view: false
        },
        {
          id: 2,
          field_name: 'field2',
          overall_visibility: 'hidden',
          visibility_logic: 'master_override',
          show_in_create_form: true,
          show_in_edit_form: true,
          show_in_list_view: true,
          show_in_detail_view: true
        },
        {
          id: 3,
          field_name: 'field3',
          overall_visibility: 'visible',
          visibility_logic: 'master_override',
          show_in_create_form: false,
          show_in_edit_form: true,
          show_in_list_view: false,
          show_in_detail_view: true
        }
      ];

      // Apply visibility logic to all fields
      const processedFields = fields.map(f => fieldVisibilityService.applyVisibilityLogic(f));

      // Filter for create_form context
      const createFormFields = processedFields.filter(f =>
        fieldVisibilityService.isVisibleInContext(f, 'create_form')
      );

      expect(createFormFields.length).toBe(1);
      expect(createFormFields[0].id).toBe(1);

      // Filter for edit_form context
      const editFormFields = processedFields.filter(f =>
        fieldVisibilityService.isVisibleInContext(f, 'edit_form')
      );

      expect(editFormFields.length).toBe(1);
      expect(editFormFields[0].id).toBe(3);

      // Filter for list_view context
      const listViewFields = processedFields.filter(f =>
        fieldVisibilityService.isVisibleInContext(f, 'list_view')
      );

      expect(listViewFields.length).toBe(1);
      expect(listViewFields[0].id).toBe(1);
    });
  });

  // ============================================
  // TEST SUITE 6: Edge Cases
  // ============================================

  describe('Edge Cases', () => {

    test('should handle field with null values gracefully', () => {
      const field = {
        id: 1,
        field_name: 'test',
        overall_visibility: 'visible',
        visibility_logic: 'master_override',
        show_in_create_form: null,
        show_in_edit_form: null,
        show_in_list_view: null,
        show_in_detail_view: null
      };

      const result = fieldVisibilityService.applyVisibilityLogic(field);
      expect(result._visibility_overridden).toBe(false);
    });

    test('should handle empty updates object', () => {
      const result = fieldVisibilityService.validateUpdate({});
      expect(result).toEqual({});
    });

    test('should handle field with missing visibility fields (use defaults)', () => {
      const field = {
        id: 1,
        field_name: 'test',
        // overall_visibility not provided - should default to undefined
        // visibility_logic not provided - should default to undefined
        show_in_create_form: true
      };

      const result = fieldVisibilityService.applyVisibilityLogic(field);
      expect(result._visibility_overridden).toBe(false);
    });
  });
});
