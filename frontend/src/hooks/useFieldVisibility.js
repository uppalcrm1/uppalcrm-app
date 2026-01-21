import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage field visibility based on configuration
 * Centralizes all field visibility logic in one place
 *
 * @param {string} entityType - Entity type (leads, contacts, accounts, etc.)
 * @returns {object} - Field configuration and helper functions
 */
export const useFieldVisibility = (entityType) => {
  const [fieldConfig, setFieldConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFieldConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/custom-fields?entity_type=${entityType}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        const data = await response.json();

        if (data.success) {
          // Combine system and custom fields into a single array
          const allFields = [
            ...(data.data?.systemFields || []),
            ...(data.data?.customFields || [])
          ];
          setFieldConfig(allFields);
          console.log(`📋 Field configuration loaded for ${entityType}:`, allFields);
        } else {
          setError(data.message || 'Failed to load field configuration');
          console.error(`❌ Error loading field config for ${entityType}:`, data.message);
        }
      } catch (err) {
        console.error(`❌ Error fetching field config for ${entityType}:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (entityType) {
      fetchFieldConfig();
    }
  }, [entityType]);

  /**
   * Check if a specific field should be visible in a given context
   * @param {string} fieldName - Field name to check (e.g., 'email', 'phone', 'source')
   * @param {string} context - Context: 'list', 'detail', 'create', 'edit'
   * @returns {boolean} - Whether field should be visible
   */
  const isFieldVisible = useCallback((fieldName, context = 'detail') => {
    // While loading, show all fields to avoid blank pages
    if (loading || !fieldConfig || fieldConfig.length === 0) {
      return true;
    }

    // Find field in configuration
    const field = fieldConfig.find(f => f.field_name === fieldName);

    // If field not in config, it's been disabled/deleted
    if (!field) {
      console.warn(`⚠️ Field '${fieldName}' not found in configuration - treating as hidden`);
      return false;
    }

    // Check master visibility - applies to all contexts
    if (field.overall_visibility === 'hidden') {
      console.log(`🚫 Field '${fieldName}' is hidden by overall_visibility`);
      return false;
    }

    if (field.is_enabled === false) {
      console.log(`🚫 Field '${fieldName}' is disabled (is_enabled=false)`);
      return false;
    }

    // Check context-specific visibility
    switch (context) {
      case 'list':
        if (field.show_in_list_view === false) {
          return false;
        }
        return true;

      case 'detail':
        if (field.show_in_detail_view === false) {
          return false;
        }
        return true;

      case 'create':
        if (field.show_in_create_form === false) {
          return false;
        }
        return true;

      case 'edit':
        if (field.show_in_edit_form === false) {
          return false;
        }
        return true;

      default:
        return true;
    }
  }, [fieldConfig, loading]);

  /**
   * Get all fields that should be visible in a specific context
   * Useful for rendering all fields dynamically
   *
   * @param {string} context - Context: 'list', 'detail', 'create', 'edit'
   * @returns {Array} - Array of visible field configurations
   */
  const getVisibleFields = useCallback((context = 'detail') => {
    // While loading, return empty array (caller should handle this)
    if (loading || !fieldConfig || fieldConfig.length === 0) {
      return [];
    }

    return fieldConfig.filter(field => {
      // Apply master visibility constraints first
      if (field.overall_visibility === 'hidden') return false;
      if (field.is_enabled === false) return false;

      // Apply context-specific visibility
      switch (context) {
        case 'list':
          return field.show_in_list_view !== false;

        case 'detail':
          return field.show_in_detail_view !== false;

        case 'create':
          return field.show_in_create_form !== false;

        case 'edit':
          return field.show_in_edit_form !== false;

        default:
          return true;
      }
    });
  }, [fieldConfig, loading]);

  /**
   * Get field label for a field name
   * @param {string} fieldName - Field name
   * @param {string} defaultLabel - Default label if not found
   * @returns {string} - Field label
   */
  const getFieldLabel = useCallback((fieldName, defaultLabel = '') => {
    const field = fieldConfig.find(f => f.field_name === fieldName);
    return field?.field_label || defaultLabel || fieldName;
  }, [fieldConfig]);

  return {
    fieldConfig,
    loading,
    error,
    isFieldVisible,
    getVisibleFields,
    getFieldLabel
  };
};

export default useFieldVisibility;
