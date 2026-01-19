/**
 * Phase 1: Field Visibility Service
 * Implements master override logic for field visibility
 */

class FieldVisibilityService {
    /**
     * Apply master override logic to field configuration
     * When overall_visibility = 'hidden', all context flags are ignored
     */
    applyVisibilityLogic(field) {
        // Phase 1: Master override rule
        if (field.visibility_logic === 'master_override' && field.overall_visibility === 'hidden') {
            return {
                ...field,
                // Override all context flags when hidden
                show_in_create_form: false,
                show_in_edit_form: false,
                show_in_list_view: false,
                show_in_detail_view: false,
                // Mark as overridden for UI
                _visibility_overridden: true,
                _visibility_explanation: 'All contexts disabled due to "Hidden" setting'
            };
        }

        // If visible, respect individual context flags
        return {
            ...field,
            _visibility_overridden: false,
            _visibility_explanation: 'Context settings active'
        };
    }

    /**
     * Determine if field should be visible in specific context
     */
    isVisibleInContext(field, context) {
        // Apply master override first
        const processedField = this.applyVisibilityLogic(field);

        // Check context-specific flag
        switch (context) {
            case 'create_form':
                return processedField.show_in_create_form;
            case 'edit_form':
                return processedField.show_in_edit_form;
            case 'list_view':
                return processedField.show_in_list_view;
            case 'detail_view':
                return processedField.show_in_detail_view;
            default:
                return false;
        }
    }

    /**
     * Validate field configuration updates
     * Phase 1: When setting to hidden, recommend unchecking all contexts
     */
    validateUpdate(updates) {
        if (updates.overall_visibility === 'hidden') {
            return {
                ...updates,
                // Auto-uncheck context flags for clarity
                show_in_create_form: false,
                show_in_edit_form: false,
                show_in_list_view: false,
                show_in_detail_view: false,
                _auto_adjusted: true,
                _adjustment_reason: 'Context flags auto-unchecked when field set to hidden'
            };
        }
        return updates;
    }

    /**
     * Get visibility status for UI display
     */
    getVisibilityStatus(field) {
        const processed = this.applyVisibilityLogic(field);

        return {
            overall_visibility: field.overall_visibility,
            visibility_logic: field.visibility_logic,
            is_overridden: processed._visibility_overridden,
            explanation: processed._visibility_explanation,
            effective_contexts: {
                create_form: processed.show_in_create_form,
                edit_form: processed.show_in_edit_form,
                list_view: processed.show_in_list_view,
                detail_view: processed.show_in_detail_view
            }
        };
    }
}

module.exports = new FieldVisibilityService();
