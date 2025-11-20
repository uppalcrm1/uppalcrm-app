import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff, AlertCircle, Database, Shield, CheckCircle, X, Edit } from 'lucide-react';
import { customFieldsAPI } from '../services/api';

const FieldManager = () => {
  const [fieldData, setFieldData] = useState({
    customFields: [],
    defaultFields: [],
    usage: { custom_fields_count: 0, contacts_count: 0 },
    limits: { maxCustomFields: 15, maxContacts: 5000, maxFieldOptions: 20 }
  });

  const [loading, setLoading] = useState(true);
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text',
    field_options: [],
    is_required: false
  });
  const [newOption, setNewOption] = useState('');
  const [errors, setErrors] = useState({});
  const [editingSystemField, setEditingSystemField] = useState(null);
  const [systemFieldOptions, setSystemFieldOptions] = useState([]);
  const [newSystemOption, setNewSystemOption] = useState('');

  useEffect(() => {
    loadFieldData();
  }, []);

  const loadFieldData = async () => {
    try {
      const data = await customFieldsAPI.getFields();
      console.log('API Response data:', data);
      console.log('data.systemFields:', data.systemFields);

      // Check if source field has updated options in API response
      const sourceFromAPI = data.systemFields?.find(f => f.field_name === 'source');
      if (sourceFromAPI) {
        console.log('Source field from API:', sourceFromAPI);
        console.log('Source options from API:', sourceFromAPI.field_options);
      }

      // Merge system field configurations with defaults
      const systemFieldDefaults = [
        {
          name: 'firstName',
          label: 'First Name',
          type: 'text',
          required: false,
          editable: true,
          deletable: false,
          options: null
        },
        {
          name: 'lastName',
          label: 'Last Name',
          type: 'text',
          required: false,
          editable: true,
          deletable: false,
          options: null
        },
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          required: false,
          editable: true,
          deletable: true,
          options: null
        },
        {
          name: 'phone',
          label: 'Phone',
          type: 'tel',
          required: false,
          editable: true,
          deletable: true,
          options: null
        },
        {
          name: 'company',
          label: 'Company',
          type: 'text',
          required: false,
          editable: true,
          deletable: true,
          options: null
        },
        {
          name: 'source',
          label: 'Source',
          type: 'select',
          required: false,
          editable: true,
          deletable: true,
          options: ['Website', 'Referral', 'Social', 'Cold-call', 'Email', 'Advertisement', 'Trade-show', 'Other']
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: false,
          editable: true,
          deletable: true,
          options: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost']
        },
        {
          name: 'priority',
          label: 'Priority',
          type: 'select',
          required: false,
          editable: true,
          deletable: true,
          options: ['low', 'medium', 'high']
        },
        {
          name: 'potentialValue',
          label: 'Potential Value ($)',
          type: 'number',
          required: false,
          editable: true,
          deletable: true,
          options: null
        },
        {
          name: 'assignedTo',
          label: 'Assign To',
          type: 'text',
          required: false,
          editable: true,
          deletable: true,
          options: null
        },
        {
          name: 'nextFollowUp',
          label: 'Next Follow Up',
          type: 'date',
          required: false,
          editable: true,
          deletable: true,
          options: null
        },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          required: false,
          editable: true,
          deletable: true,
          options: null
        }
      ];

      // Merge system field configurations with defaults
      const mergedSystemFields = systemFieldDefaults.map(defaultField => {
        const customConfig = data.systemFields?.find(f => f.field_name === defaultField.name);
        const legacyConfig = data.defaultFields?.find(f => f.field_name === defaultField.name);

        // Debug the source field specifically
        if (defaultField.name === 'source') {
          console.log('DEBUG Source field merge:');
          console.log('  defaultField.options:', defaultField.options);
          console.log('  customConfig:', customConfig);
          console.log('  customConfig?.field_options:', customConfig?.field_options);
          console.log('  Final options will be:', customConfig?.field_options || defaultField.options);
        }

        return {
          ...defaultField,
          label: customConfig?.field_label || defaultField.label,
          type: customConfig?.field_type || defaultField.type,
          options: customConfig?.field_options || defaultField.options,
          is_enabled: customConfig?.is_enabled !== undefined ? customConfig.is_enabled :
                     legacyConfig?.is_enabled !== undefined ? legacyConfig.is_enabled : true,
          is_required: customConfig?.is_required !== undefined ? customConfig.is_required :
                      legacyConfig?.is_required !== undefined ? legacyConfig.is_required : defaultField.required,
          is_deleted: customConfig?.is_deleted || false,
          editable: defaultField.editable,
          deletable: defaultField.deletable
        };
      }).filter(field => !field.is_deleted); // Filter out deleted fields

      console.log('Merged system fields:', mergedSystemFields);
      console.log('Source field after merge:', mergedSystemFields.find(f => f.name === 'source'));

      setFieldData({
        ...data,
        systemFields: mergedSystemFields,
        limits: data.limits || { maxCustomFields: 15, maxContacts: 5000, maxFieldOptions: 20 }
      });
    } catch (error) {
      console.error('Error loading field data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addOption = () => {
    if (newOption.trim() && !newField.field_options.includes(newOption.trim())) {
      if (newField.field_options.length >= (fieldData.limits?.maxFieldOptions || 20)) {
        setErrors(prev => ({...prev, options: [`Maximum ${fieldData.limits?.maxFieldOptions || 20} options allowed`]}));
        return;
      }
      setNewField(prev => ({
        ...prev,
        field_options: [...prev.field_options, newOption.trim()]
      }));
      setNewOption('');
      setErrors(prev => ({...prev, options: []}));
    }
  };

  const removeOption = (index) => {
    setNewField(prev => ({
      ...prev,
      field_options: prev.field_options.filter((_, i) => i !== index)
    }));
  };

  const createCustomField = async () => {
    try {
      setErrors({});

      if (!newField.field_label.trim()) {
        setErrors({field_label: ['Field label is required']});
        return;
      }

      if (!newField.field_name.trim()) {
        // Auto-generate field name from label
        const generatedName = newField.field_label
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);

        setNewField(prev => ({...prev, field_name: generatedName}));
      }

      if (newField.field_type === 'select' && newField.field_options.length < 2) {
        setErrors({options: ['Dropdown fields need at least 2 options']});
        return;
      }

      await customFieldsAPI.createField(newField);

      await loadFieldData();
      setNewField({
        field_name: '',
        field_label: '',
        field_type: 'text',
        field_options: [],
        is_required: false
      });
      setShowAddField(false);
    } catch (error) {
      setErrors({general: ['Failed to create field']});
    }
  };

  const deleteCustomField = async (fieldId) => {
    if (!confirm('Are you sure you want to delete this field? All data in this field will be lost.')) {
      return;
    }

    try {
      await customFieldsAPI.deleteField(fieldId);
      await loadFieldData();
    } catch (error) {
      console.error('Error deleting field:', error);
    }
  };

  const toggleCustomField = async (fieldId, currentEnabled) => {
    try {
      await customFieldsAPI.toggleField(fieldId, !currentEnabled);
      await loadFieldData();
    } catch (error) {
      console.error('Error toggling field:', error);
    }
  };

  const toggleDefaultField = async (fieldName, currentEnabled) => {
    try {
      await customFieldsAPI.updateSystemField(fieldName, { is_enabled: !currentEnabled });
      await loadFieldData();
    } catch (error) {
      console.error('Error toggling default field:', error);
    }
  };

  const deleteSystemField = async (fieldName) => {
    if (!confirm(`Are you sure you want to delete the ${fieldName} field? This will remove it from all lead forms.`)) {
      return;
    }

    try {
      console.log('Attempting to delete system field:', fieldName);
      await customFieldsAPI.updateSystemField(fieldName, {
        is_deleted: true,
        is_enabled: false
      });
      console.log('System field deletion request sent successfully');
      await loadFieldData();
      alert(`${fieldName} field has been deleted successfully.`);
    } catch (error) {
      console.error('Error deleting system field:', error);
      alert(`Failed to delete ${fieldName} field: ${error.message || 'Please try again.'}`);
    }
  };

  const updateSystemField = async () => {
    try {
      const updateData = {
        is_enabled: editingSystemField.is_enabled,
        is_required: editingSystemField.is_required,
        field_label: editingSystemField.label,
        field_type: editingSystemField.type,
        entity_type: 'leads'
      };

      // If it's a select field, include options
      if (editingSystemField.type === 'select') {
        updateData.field_options = systemFieldOptions;
      }

      console.log('Updating system field:', editingSystemField.name, updateData);
      const result = await customFieldsAPI.updateSystemField(editingSystemField.name, updateData);
      console.log('Update result:', result);

      console.log('Reloading field data...');
      await loadFieldData();
      console.log('Field data reloaded');

      setEditingSystemField(null);
      setSystemFieldOptions([]);
      setNewSystemOption('');

      alert(`${editingSystemField.label} field has been updated successfully!`);
    } catch (error) {
      console.error('Error updating system field:', error);
      alert(`Failed to update ${editingSystemField.label} field: ${error.message || 'Please try again.'}`);
    }
  };

  const addSystemOption = () => {
    if (newSystemOption.trim() && !systemFieldOptions.includes(newSystemOption.trim())) {
      if (systemFieldOptions.length >= (fieldData.limits?.maxFieldOptions || 20)) {
        return;
      }
      setSystemFieldOptions(prev => [...prev, newSystemOption.trim()]);
      setNewSystemOption('');
    }
  };

  const removeSystemOption = (index) => {
    setSystemFieldOptions(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  const { customFields, defaultFields, usage, limits } = fieldData || {};
  const remainingFields = (limits?.maxCustomFields || 10) - (usage?.custom_fields_count || 0);
  const atLimit = (usage?.custom_fields_count || 0) >= (limits?.maxCustomFields || 10);
  const nearLimit = (usage?.custom_fields_count || 0) >= (limits?.maxCustomFields || 10) * 0.8;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header with usage stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900">Field Configuration</h1>
          <p className="text-gray-600 mt-1">Customize your lead form fields</p>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Resource Usage</h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Custom Fields Usage */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Custom Fields</span>
                <Database className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {usage?.custom_fields_count || 0}
                <span className="text-sm font-normal text-gray-500">/{limits?.maxCustomFields || 10}</span>
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${nearLimit ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(((usage?.custom_fields_count || 0) / (limits?.maxCustomFields || 10)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 mt-1">{remainingFields} remaining</span>
              </div>
            </div>

            {/* Contacts Usage */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Contacts</span>
                <Shield className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {(usage?.contacts_count || 0).toLocaleString()}
                <span className="text-sm font-normal text-gray-500">/{(limits?.maxContacts || 1000).toLocaleString()}</span>
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-purple-500"
                    style={{ width: `${((usage?.contacts_count || 0) / (limits?.maxContacts || 1000)) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {((limits?.maxContacts || 1000) - (usage?.contacts_count || 0)).toLocaleString()} remaining
                </span>
              </div>
            </div>
          </div>

          {nearLimit && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-800">Approaching Field Limit</span>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                You're using {usage?.custom_fields_count || 0} of {limits?.maxCustomFields || 10} custom fields.
                Plan your remaining fields carefully.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Field Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Field Management</h2>
            <button
              onClick={() => setShowAddField(true)}
              disabled={atLimit}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                atLimit
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Custom Field
              {atLimit && ' (Limit Reached)'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* System Fields */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">System Fields</h3>
            <div className="space-y-3">
              {fieldData.systemFields?.map(systemField => {
                return (
                  <div key={systemField.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleDefaultField(systemField.name, systemField.is_enabled)}
                        disabled={!systemField.deletable}
                        className={`p-1 rounded ${
                          !systemField.deletable
                            ? 'text-gray-400 cursor-not-allowed'
                            : systemField.is_enabled
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={!systemField.deletable ? 'Required field cannot be hidden' : 'Toggle field visibility'}
                      >
                        {systemField.is_enabled ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </button>
                      <div>
                        <div className="font-medium text-gray-900">
                          {systemField.label}
                          {!systemField.deletable && <span className="text-red-500 ml-1">*</span>}
                          {systemField.is_required && systemField.deletable && <span className="text-orange-500 ml-1">*</span>}
                        </div>
                        <div className="text-sm text-gray-500">
                          {systemField.type}
                          {systemField.options && ` • ${systemField.options.length} options`}
                          • System Field
                          {!systemField.deletable && ' • Core Required'}
                          {systemField.is_required && systemField.deletable && ' • Required'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {systemField.is_enabled ? 'Visible' : 'Hidden'}
                      </span>
                      {systemField.editable && (
                        <button
                          onClick={() => {
                            setEditingSystemField({
                              ...systemField,
                              is_enabled: systemField.is_enabled,
                              is_required: systemField.is_required
                            });
                            if (systemField.type === 'select' && systemField.options) {
                              setSystemFieldOptions([...systemField.options]);
                            }
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit Field"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {systemField.deletable && (
                        <button
                          onClick={() => deleteSystemField(systemField.name)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete Field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Fields */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Custom Fields ({usage?.custom_fields_count || 0}/{limits?.maxCustomFields || 10})
            </h3>

            {(customFields || []).length > 0 ? (
              <div className="space-y-3">
                {(customFields || []).map(field => (
                  <div key={field.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleCustomField(field.id, field.is_enabled)}
                        className={`p-1 rounded ${
                          field.is_enabled
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {field.is_enabled ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </button>
                      <div>
                        <div className="font-medium text-gray-900">{field.field_label}</div>
                        <div className="text-sm text-gray-500">
                          {field.field_type}
                          {field.field_options && ` • ${field.field_options.length} options`}
                          • Custom Field
                          {field.is_required && ' • Required'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {field.is_enabled ? 'Visible' : 'Hidden'}
                      </span>
                      <button
                        onClick={() => deleteCustomField(field.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete Field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500 border border-gray-200 rounded-lg border-dashed">
                No custom fields created yet. Click "Add Custom Field" to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Field Modal */}
      {showAddField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Custom Field</h3>

            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {errors.general.map((error, i) => <div key={i}>{error}</div>)}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Label *</label>
                <input
                  type="text"
                  value={newField.field_label}
                  onChange={(e) => {
                    const label = e.target.value;
                    const generatedName = label
                      .toLowerCase()
                      .replace(/[^a-z0-9\s]/g, '')
                      .replace(/\s+/g, '_')
                      .substring(0, 50);

                    setNewField(prev => ({
                      ...prev,
                      field_label: label,
                      field_name: generatedName
                    }));
                  }}
                  className={`w-full p-2 border rounded-lg ${
                    errors.field_label ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Lead Quality Score"
                />
                {newField.field_name && (
                  <div className="text-xs text-gray-500 mt-1">
                    Field name: {newField.field_name}
                  </div>
                )}
                {errors.field_label && (
                  <div className="text-red-600 text-sm mt-1">
                    {errors.field_label.map((error, i) => <div key={i}>{error}</div>)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                <select
                  value={newField.field_type}
                  onChange={(e) => setNewField(prev => ({
                    ...prev,
                    field_type: e.target.value,
                    field_options: []
                  }))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="text">Text</option>
                  <option value="select">Dropdown</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="email">Email</option>
                  <option value="tel">Phone</option>
                  <option value="textarea">Large Text</option>
                </select>
              </div>

              {newField.field_type === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dropdown Options (max {limits.maxFieldOptions})
                  </label>
                  <div className="space-y-2">
                    {newField.field_options.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="flex-1 p-2 bg-gray-50 rounded border text-sm">{option}</span>
                        <button
                          onClick={() => removeOption(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        placeholder="Add option"
                        className="flex-1 p-2 border border-gray-300 rounded"
                        onKeyPress={(e) => e.key === 'Enter' && addOption()}
                      />
                      <button
                        onClick={addOption}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      {newField.field_options.length}/{limits.maxFieldOptions} options
                    </div>
                    {errors.options && (
                      <div className="text-red-600 text-sm">
                        {errors.options.map((error, i) => <div key={i}>{error}</div>)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={newField.is_required}
                  onChange={(e) => setNewField(prev => ({ ...prev, is_required: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="required" className="text-sm text-gray-700">
                  Make this field required
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={createCustomField}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Add Field
              </button>
              <button
                onClick={() => {
                  setShowAddField(false);
                  setNewField({
                    field_name: '',
                    field_label: '',
                    field_type: 'text',
                    field_options: [],
                    is_required: false
                  });
                  setErrors({});
                  setNewOption('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit System Field Modal */}
      {editingSystemField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit {editingSystemField.label} Field
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="systemRequired"
                  checked={editingSystemField.is_required || false}
                  onChange={(e) => setEditingSystemField(prev => ({
                    ...prev,
                    is_required: e.target.checked
                  }))}
                  disabled={!editingSystemField.deletable}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="systemRequired" className="text-sm text-gray-700">
                  Make this field required
                  {!editingSystemField.deletable && ' (Cannot change for core fields)'}
                </label>
              </div>

              {editingSystemField.type === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dropdown Options (max {fieldData.limits?.maxFieldOptions || 20})
                  </label>
                  <div className="space-y-2">
                    {systemFieldOptions.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="flex-1 p-2 bg-gray-50 rounded border text-sm">{option}</span>
                        <button
                          onClick={() => removeSystemOption(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSystemOption}
                        onChange={(e) => setNewSystemOption(e.target.value)}
                        placeholder="Add option"
                        className="flex-1 p-2 border border-gray-300 rounded"
                        onKeyPress={(e) => e.key === 'Enter' && addSystemOption()}
                      />
                      <button
                        onClick={addSystemOption}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      {systemFieldOptions.length}/{fieldData.limits?.maxFieldOptions || 20} options
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={updateSystemField}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditingSystemField(null);
                  setSystemFieldOptions([]);
                  setNewSystemOption('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MVP Benefits Card */}
      <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          <CheckCircle className="w-5 h-5 text-green-600 inline mr-2" />
          Simple $15/month - Everything Included
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>✅ 15 Custom Fields</div>
          <div>✅ Unlimited Users</div>
          <div>✅ 5,000 Contacts</div>
          <div>✅ All CRM Features</div>
        </div>
        <p className="text-gray-600 text-sm mt-3">
          No confusing tiers, no hidden limits. Perfect for small to mid-size businesses.
        </p>
      </div>
    </div>
  );
};

export default FieldManager;