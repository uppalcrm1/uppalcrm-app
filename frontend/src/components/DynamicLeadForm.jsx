import React, { useState, useEffect } from 'react';
import { Save, User, Building, Mail, Phone, Calendar, DollarSign, X } from 'lucide-react';
import { customFieldsAPI, leadsAPI, usersAPI } from '../services/api';

const DynamicLeadForm = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'create',
  leadData = {},
  onSubmit,
  initialData = {}
}) => {
  // Use leadData if provided, otherwise fallback to initialData
  const actualInitialData = leadData && Object.keys(leadData).length > 0 ? leadData : initialData;
  const [formConfig, setFormConfig] = useState({ customFields: [], defaultFields: [] });
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [availableUsers, setAvailableUsers] = useState([]);

  useEffect(() => {
    loadFormConfig();
  }, []);

  useEffect(() => {
    if (actualInitialData && Object.keys(actualInitialData).length > 0 && !loading) {
      // Only set the data if form config is loaded (loading is false)

      // Map API field names to form field names
      const mappedData = {
        ...actualInitialData,
        // Map snake_case to camelCase for form fields
        firstName: actualInitialData.first_name || actualInitialData.firstName || '',
        lastName: actualInitialData.last_name || actualInitialData.lastName || '',
        potentialValue: actualInitialData.potential_value || actualInitialData.potentialValue || 0,
        assignedTo: actualInitialData.assigned_to || actualInitialData.assignedTo || '',
        nextFollowUp: actualInitialData.next_follow_up || actualInitialData.nextFollowUp || '',
      };

      setFormData(prev => ({
        ...prev,
        ...mappedData,
        customFields: { ...prev.customFields, ...(actualInitialData.custom_fields || {}) }
      }));
    }
  }, [actualInitialData, loading]);

  const loadFormConfig = async () => {
    try {
      const data = await customFieldsAPI.getFormConfig();
      setFormConfig(data);

      // Load available users for assignment
      try {
        const usersData = await usersAPI.getUsersForAssignment();
        setAvailableUsers(usersData.users || []);
      } catch (usersError) {
        console.error('Error loading users for assignment:', usersError);
        setAvailableUsers([]);
      }

      // Initialize form data dynamically based on enabled system fields
      // But only if we don't have existing data to preserve
      const shouldInitializeWithDefaults = !actualInitialData || Object.keys(actualInitialData).length === 0;

      if (shouldInitializeWithDefaults) {
        const initialFormData = { customFields: {} };

        // Initialize system fields based on what's enabled in the config
        if (data.systemFields && Array.isArray(data.systemFields)) {
          data.systemFields.forEach(field => {
            let defaultValue = '';
            if (field.field_type === 'select') {
              // Set default values for select fields
              if (field.field_name === 'status') defaultValue = 'new';
              else if (field.field_name === 'priority') defaultValue = 'medium';
            }
            initialFormData[field.field_name] = defaultValue;
          });
        }

        // Initialize custom fields
        if (data.customFields && Array.isArray(data.customFields)) {
          data.customFields.forEach(field => {
            initialFormData.customFields[field.field_name] = '';
          });
        }

        setFormData(initialFormData);
      } else {
        // We have existing data, just ensure customFields exists
        setFormData(prev => ({
          ...prev,
          customFields: prev.customFields || {}
        }));
      }

    } catch (error) {
      console.error('Error loading form config:', error);
      // Set empty form data on error to prevent infinite loops
      setFormData({ customFields: {} });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (fieldName, value, isCustom = false) => {
    if (isCustom) {
      setFormData(prev => ({
        ...prev,
        customFields: {
          ...prev.customFields,
          [fieldName]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [fieldName]: value
      }));
    }

    // Clear errors when user starts typing
    const errorKey = isCustom ? `custom_${fieldName}` : fieldName;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate system fields based on configuration
    formConfig.systemFields?.forEach(field => {
      if (field.is_required && !formData[field.field_name]?.trim()) {
        newErrors[field.field_name] = `${field.field_label} is required`;
      }
    });

    // Validate custom fields
    formConfig.customFields?.forEach(field => {
      if (field.is_required && !formData.customFields[field.field_name]?.toString().trim()) {
        newErrors[`custom_${field.field_name}`] = `${field.field_label} is required`;
      }

      const value = formData.customFields[field.field_name];
      if (value) {
        switch (field.field_type) {
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              newErrors[`custom_${field.field_name}`] = `${field.field_label} must be a valid email`;
            }
            break;
          case 'number':
            if (isNaN(value)) {
              newErrors[`custom_${field.field_name}`] = `${field.field_label} must be a number`;
            }
            break;
          case 'select':
            if (field.field_options && !field.field_options.includes(value)) {
              newErrors[`custom_${field.field_name}`] = `${field.field_label} must be a valid option`;
            }
            break;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      // Map form field names back to API field names
      const submitData = {
        ...formData,
        // Map camelCase back to snake_case for API
        first_name: formData.firstName || formData.first_name,
        last_name: formData.lastName || formData.last_name,
        potential_value: formData.potentialValue || formData.potential_value || 0,
        assigned_to: formData.assignedTo || formData.assigned_to,
        next_follow_up: formData.nextFollowUp || formData.next_follow_up,
        customFields: formData.customFields
      };

      // Remove the camelCase versions to avoid sending both
      delete submitData.firstName;
      delete submitData.lastName;
      delete submitData.potentialValue;
      delete submitData.assignedTo;
      delete submitData.nextFollowUp;

      let response;
      if (mode === 'edit' && actualInitialData?.id) {
        // Update existing lead
        response = await leadsAPI.updateLead(actualInitialData.id, submitData);
      } else {
        // Create new lead
        response = await leadsAPI.createLead(submitData);
      }

      // Call onSuccess if provided, otherwise onSubmit for backward compatibility
      if (onSuccess) {
        onSuccess(response);
      } else if (onSubmit) {
        onSubmit(response);
      }

      // Reset form
      setFormData(prev => {
        const resetData = { ...prev };
        Object.keys(resetData).forEach(key => {
          if (key !== 'customFields') {
            resetData[key] = '';
          }
        });
        Object.keys(resetData.customFields).forEach(key => {
          resetData.customFields[key] = '';
        });
        return resetData;
      });

      alert('Lead created successfully!');
    } catch (error) {
      console.error('Error creating lead:', error);
      alert('Failed to create lead. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field, isCustom = false) => {
    // Backend sends all fields (system and custom) with same structure
    const fieldName = field.field_name;
    const fieldLabel = field.field_label;
    const fieldType = field.field_type;
    const fieldValue = isCustom
      ? (formData.customFields && formData.customFields[fieldName]) || ''
      : formData[fieldName] || '';
    const isRequired = field.is_required;
    const errorKey = isCustom ? `custom_${fieldName}` : fieldName;


    const getFieldIcon = (type) => {
      switch(type) {
        case 'firstName':
        case 'lastName':
          return <User className="w-4 h-4 text-gray-400" />;
        case 'company':
          return <Building className="w-4 h-4 text-gray-400" />;
        case 'email':
          return <Mail className="w-4 h-4 text-gray-400" />;
        case 'phone':
        case 'tel':
          return <Phone className="w-4 h-4 text-gray-400" />;
        case 'potentialValue':
          return <DollarSign className="w-4 h-4 text-gray-400" />;
        case 'nextFollowUp':
        case 'date':
          return <Calendar className="w-4 h-4 text-gray-400" />;
        default:
          return null;
      }
    };

    const baseClasses = `w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      errors[errorKey] ? 'border-red-300' : 'border-gray-300'
    }`;

    switch (fieldType) {
      case 'select':
        const options = field.field_options;
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldLabel}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={fieldValue}
              onChange={(e) => handleInputChange(fieldName, e.target.value, isCustom)}
              className={baseClasses}
            >
              <option value="">Select {fieldLabel}</option>
              {options && options.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors[errorKey] && (
              <p className="text-red-600 text-sm mt-1">{errors[errorKey]}</p>
            )}
          </div>
        );

      case 'user_select':
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldLabel}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <select
                value={fieldValue}
                onChange={(e) => handleInputChange(fieldName, e.target.value, isCustom)}
                className={`${baseClasses} pl-10`}
              >
                <option value="">Select Team Member</option>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.label} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            {errors[errorKey] && (
              <p className="text-red-600 text-sm mt-1">{errors[errorKey]}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={fieldName} className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldLabel}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={fieldValue}
              onChange={(e) => handleInputChange(fieldName, e.target.value, isCustom)}
              placeholder={`Enter ${fieldLabel}`}
              rows={4}
              className={baseClasses}
            />
            {errors[errorKey] && (
              <p className="text-red-600 text-sm mt-1">{errors[errorKey]}</p>
            )}
          </div>
        );

      default:
        const icon = getFieldIcon(fieldName);
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldLabel}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              {icon && (
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {icon}
                </div>
              )}
              <input
                type={fieldType}
                value={fieldValue}
                onChange={(e) => handleInputChange(fieldName, e.target.value, isCustom)}
                placeholder={`Enter ${fieldLabel}`}
                className={`${baseClasses} ${icon ? 'pl-10' : ''}`}
              />
            </div>
            {errors[errorKey] && (
              <p className="text-red-600 text-sm mt-1">{errors[errorKey]}</p>
            )}
          </div>
        );
    }
  };

  const getSystemFieldOptions = (fieldName) => {
    // First check if we have custom options from the system field configuration
    const systemField = formConfig.systemFields?.find(f => f.field_name === fieldName);
    if (systemField && systemField.field_options) {
      return systemField.field_options;
    }

    // Fallback to defaults
    switch (fieldName) {
      case 'source':
        return ['Website', 'Referral', 'Social', 'Cold-call', 'Email', 'Advertisement', 'Trade-show', 'Other'];
      case 'status':
        return ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost'];
      case 'priority':
        return ['low', 'medium', 'high'];
      default:
        return [];
    }
  };

  const getEnabledSystemFields = () => {
    // Use the system fields from the API response, but only return enabled ones
    return (formConfig.systemFields || []).filter(f => f.is_enabled !== false);
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading form...</div>;
  }

  // Safety check: don't render if form data is not properly initialized
  if (!formData || typeof formData !== 'object' || !formData.hasOwnProperty('customFields')) {
    return <div className="flex justify-center p-8">Initializing form...</div>;
  }

  const enabledSystemFields = getEnabledSystemFields();
  const enabledCustomFields = (formConfig.customFields || []).filter(f => f.is_enabled);

  // Determine if this should be rendered as a modal
  const isModalMode = isOpen !== undefined;

  const formContent = (
    <div className={isModalMode ? "" : "max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen"}>
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${isModalMode ? "" : ""}`}>
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {mode === 'edit' ? 'Edit Lead' : 'Add New Lead'}
              </h1>
              <p className="mt-1 text-gray-600">
                {mode === 'edit' ? 'Update lead information' : 'Create a new lead in your CRM system'}
              </p>
            </div>
            {isModalMode && onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Fields */}
            {enabledSystemFields.map(field => renderField(field, false))}

            {/* Custom Fields */}
            {enabledCustomFields.map(field => renderField(field, true))}
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Saving...' : (mode === 'edit' ? 'Update Lead' : 'Save Lead')}
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Preview */}
      {(enabledSystemFields.length > 0 || enabledCustomFields.length > 0) && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Active Form Fields</h2>
          <div className="text-sm text-gray-600">
            <div className="flex flex-wrap gap-2">
              {enabledSystemFields.map(field => (
                <span
                  key={field.name}
                  className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                >
                  {field.label} {field.required && '*'}
                </span>
              ))}
              {enabledCustomFields.map(field => (
                <span
                  key={field.field_name}
                  className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-800"
                >
                  {field.field_label} ({field.field_type}) {field.is_required && '*'}
                </span>
              ))}
            </div>
            <p className="mt-4 text-gray-500">
              Blue badges are system fields, green badges are custom fields.
              Fields marked with * are required.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // Return with modal wrapper if in modal mode
  if (isModalMode && isOpen) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
          </div>
          <div className="inline-block w-full max-w-4xl px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
            {formContent}
          </div>
        </div>
      </div>
    );
  }

  // Return regular form if not in modal mode or modal is closed
  return formContent;
};

export default DynamicLeadForm;