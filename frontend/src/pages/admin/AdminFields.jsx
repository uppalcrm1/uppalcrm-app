import React, { useState, useEffect } from 'react'
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  Search,
  Settings,
  CheckCircle,
  AlertCircle,
  Move
} from 'lucide-react'
import api from '../../services/api'

const ENTITY_TYPES = [
  { id: 'leads', label: 'Leads', icon: '👤' },
  { id: 'contacts', label: 'Contacts', icon: '✉️' },
  { id: 'accounts', label: 'Accounts', icon: '💼' },
  { id: 'transactions', label: 'Transactions', icon: '💰' }
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text', description: 'Single line text input' },
  { value: 'textarea', label: 'Text Area', description: 'Multi-line text input' },
  { value: 'number', label: 'Number', description: 'Numeric input' },
  { value: 'email', label: 'Email', description: 'Email address' },
  { value: 'phone', label: 'Phone', description: 'Phone number' },
  { value: 'url', label: 'URL', description: 'Web address' },
  { value: 'date', label: 'Date', description: 'Date picker' },
  { value: 'datetime', label: 'Date & Time', description: 'Date and time picker' },
  { value: 'select', label: 'Select', description: 'Dropdown selection' },
  { value: 'multiselect', label: 'Multi-Select', description: 'Multiple selection' },
  { value: 'checkbox', label: 'Checkbox', description: 'True/false toggle' },
  { value: 'radio', label: 'Radio Buttons', description: 'Single choice from options' }
]

const AdminFields = () => {
  const [activeTab, setActiveTab] = useState('leads')
  const [fields, setFields] = useState([])
  const [systemFields, setSystemFields] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [formData, setFormData] = useState({
    field_name: '',
    field_label: '',
    field_description: '',
    field_type: 'text',
    is_required: false,
    is_searchable: true,
    is_filterable: true,
    show_in_list_view: false,
    show_in_detail_view: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    field_group: '',
    placeholder: '',
    default_value: '',
    field_options: [],
    validation_rules: {}
  })

  // Load fields from API
  const loadFields = async (entityType) => {
    try {
      setLoading(true)
      setError(null)
      console.log('🔍 Loading fields for entity type:', entityType)
      const response = await api.get(`/custom-fields?entity_type=${entityType}`)
      console.log('📦 API Response:', response.data)
      console.log('📝 Custom fields received:', response.data.customFields)
      console.log('🔧 System fields received:', response.data.systemFields)
      console.log('📊 Number of custom fields:', response.data.customFields?.length || 0)
      console.log('📊 Number of system fields:', response.data.systemFields?.length || 0)
      if (response.data.customFields && response.data.customFields.length > 0) {
        console.log('📋 Custom field names:', response.data.customFields.map(f => f.field_name).join(', '))
      }
      if (response.data.systemFields && response.data.systemFields.length > 0) {
        console.log('📋 System field names:', response.data.systemFields.map(f => f.field_name).join(', '))
      }
      setFields(response.data.customFields || [])
      setSystemFields(response.data.systemFields || [])
    } catch (err) {
      console.error('❌ Error loading fields:', err)
      console.error('❌ Error response:', err.response?.data)
      setError(err.response?.data?.message || 'Failed to load fields')
      setFields([])
      setSystemFields([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFields(activeTab)
  }, [activeTab])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveField = async () => {
    try {
      setLoading(true)
      setError(null)

      if (editingField) {
        // Update existing field - only send fields the backend expects
        const updateData = {
          field_label: formData.field_label,
          field_type: formData.field_type,
          field_options: formData.field_options,
          is_required: formData.is_required
        }
        console.log('📤 Updating field:', editingField.id, updateData)
        const response = await api.put(`/custom-fields/${editingField.id}`, updateData)
        console.log('✅ Field updated:', response.data)
        setFields(prev => prev.map(f => f.id === editingField.id ? response.data.field : f))
        setEditingField(null)
      } else {
        // Create new field - only send fields the backend expects
        const fieldData = {
          entity_type: activeTab,
          field_name: formData.field_name,
          field_label: formData.field_label,
          field_type: formData.field_type,
          field_options: formData.field_options,
          is_required: formData.is_required
        }
        console.log('📤 Sending field data:', fieldData)
        const response = await api.post('/custom-fields', fieldData)
        console.log('✅ Field created:', response.data)
        setFields(prev => [...prev, response.data.field])
        setIsCreating(false)
      }
      resetForm()
    } catch (err) {
      console.error('Error saving field:', err)
      setError(err.response?.data?.error || 'Failed to save field')
    } finally {
      setLoading(false)
    }
  }

  const handleEditField = (field) => {
    setFormData(field)
    setEditingField(field)
    setIsCreating(true)
  }

  const handleDeleteField = async (fieldId) => {
    if (confirm('Are you sure you want to delete this field? This action cannot be undone.')) {
      try {
        setLoading(true)
        setError(null)
        await api.delete(`/custom-fields/${fieldId}`)
        setFields(prev => prev.filter(f => f.id !== fieldId))
      } catch (err) {
        console.error('Error deleting field:', err)
        setError(err.response?.data?.error || 'Failed to delete field')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleToggleVisibility = async (field) => {
    try {
      const newIsEnabled = !field.is_enabled
      setError(null)
      setSuccessMessage(null)

      if (field.isSystemField) {
        // For system fields, update via the system field configuration API
        const response = await api.put(`/custom-fields/default/${field.field_name}`, {
          is_enabled: newIsEnabled,
          entity_type: activeTab  // Pass the current entity type
        })
        setSystemFields(prev => prev.map(f =>
          f.field_name === field.field_name ? { ...f, is_enabled: newIsEnabled } : f
        ))
        const message = newIsEnabled
          ? `${field.field_label} is now visible in forms`
          : `${field.field_label} is now hidden from forms`
        setSuccessMessage(message)
        console.log(`✅ System field ${field.field_name} ${newIsEnabled ? 'enabled' : 'disabled'} for ${activeTab}`)
      } else {
        // For custom fields, update via the API
        const response = await api.put(`/custom-fields/${field.id}`, {
          is_enabled: newIsEnabled
        })
        setFields(prev => prev.map(f =>
          f.id === field.id ? { ...f, is_enabled: newIsEnabled } : f
        ))
        const message = newIsEnabled
          ? `${field.field_label} is now visible in forms`
          : `${field.field_label} is now hidden from forms`
        setSuccessMessage(message)
        console.log(`✅ Custom field ${field.field_name} ${newIsEnabled ? 'enabled' : 'disabled'}`)
      }

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error toggling field visibility:', err)
      setError(err.response?.data?.error || 'Failed to update field visibility')
    }
  }

  const resetForm = () => {
    setFormData({
      field_name: '',
      field_label: '',
      field_description: '',
      field_type: 'text',
      is_required: false,
      is_searchable: true,
      is_filterable: true,
      show_in_list_view: false,
      show_in_detail_view: true,
      show_in_create_form: true,
      show_in_edit_form: true,
      field_group: '',
      placeholder: '',
      default_value: '',
      field_options: [],
      validation_rules: {}
    })
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingField(null)
    resetForm()
  }

  // Combine system fields and custom fields
  const allFields = [
    ...systemFields.map(f => ({ ...f, isSystemField: true })),
    ...fields.map(f => ({ ...f, isSystemField: false }))
  ]

  const filteredFields = allFields.filter(field =>
    field.field_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.field_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const needsOptions = ['select', 'multiselect', 'radio'].includes(formData.field_type)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Configuration</h1>
          <p className="text-gray-600 mt-1">Customize fields for leads, contacts, accounts, and transactions</p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} className="mr-2" />
            Add Custom Field
          </button>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3 animate-fade-in">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">Success</p>
            <p className="text-sm text-green-700 mt-1">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-400 hover:text-green-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Entity Type Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px space-x-8">
            {ENTITY_TYPES.map(entity => (
              <button
                key={entity.id}
                onClick={() => {
                  setActiveTab(entity.id)
                  setIsCreating(false)
                  setEditingField(null)
                }}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === entity.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="mr-2">{entity.icon}</span>
                {entity.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingField ? 'Edit Custom Field' : 'Create Custom Field'}
            </h2>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.field_label}
                  onChange={(e) => handleInputChange('field_label', e.target.value)}
                  placeholder="e.g., Industry"
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">User-facing name shown in forms</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.field_name}
                  onChange={(e) => handleInputChange('field_name', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g., industry"
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">Internal identifier (lowercase, no spaces)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.field_description}
                onChange={(e) => handleInputChange('field_description', e.target.value)}
                placeholder="Help text for users"
                rows={2}
                className="input"
              />
            </div>

            {/* Field Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.field_type}
                onChange={(e) => handleInputChange('field_type', e.target.value)}
                className="input"
              >
                {FIELD_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Field Options (for select/multiselect/radio) */}
            {needsOptions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Options <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {formData.field_options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => {
                          const newOptions = [...formData.field_options]
                          newOptions[index] = { value: e.target.value.toLowerCase().replace(/\s+/g, '_'), label: e.target.value }
                          handleInputChange('field_options', newOptions)
                        }}
                        placeholder="Option label"
                        className="input flex-1"
                      />
                      <button
                        onClick={() => {
                          const newOptions = formData.field_options.filter((_, i) => i !== index)
                          handleInputChange('field_options', newOptions)
                        }}
                        className="btn btn-sm btn-outline text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      handleInputChange('field_options', [...formData.field_options, { value: '', label: '' }])
                    }}
                    className="btn btn-sm btn-outline"
                  >
                    <Plus size={14} className="mr-1" />
                    Add Option
                  </button>
                </div>
              </div>
            )}

            {/* Additional Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placeholder Text
                </label>
                <input
                  type="text"
                  value={formData.placeholder}
                  onChange={(e) => handleInputChange('placeholder', e.target.value)}
                  placeholder="e.g., Enter industry"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Value
                </label>
                <input
                  type="text"
                  value={formData.default_value}
                  onChange={(e) => handleInputChange('default_value', e.target.value)}
                  placeholder="Default value"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Group
              </label>
              <input
                type="text"
                value={formData.field_group}
                onChange={(e) => handleInputChange('field_group', e.target.value)}
                placeholder="e.g., Company Information"
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">Group related fields together</p>
            </div>

            {/* Field Settings Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Field Settings
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => handleInputChange('is_required', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Required field</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_searchable}
                    onChange={(e) => handleInputChange('is_searchable', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Searchable</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_filterable}
                    onChange={(e) => handleInputChange('is_filterable', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Filterable</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.show_in_list_view}
                    onChange={(e) => handleInputChange('show_in_list_view', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show in list view</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.show_in_detail_view}
                    onChange={(e) => handleInputChange('show_in_detail_view', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show in detail view</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.show_in_create_form}
                    onChange={(e) => handleInputChange('show_in_create_form', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show in create form</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.show_in_edit_form}
                    onChange={(e) => handleInputChange('show_in_edit_form', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show in edit form</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button onClick={handleCancel} className="btn btn-outline">
                Cancel
              </button>
              <button
                onClick={handleSaveField}
                disabled={!formData.field_name || !formData.field_label}
                className="btn btn-primary"
              >
                <Save size={16} className="mr-2" />
                {editingField ? 'Update Field' : 'Create Field'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fields List */}
      {!isCreating && (
        <div className="card">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Fields Table */}
          {filteredFields.length === 0 ? (
            <div className="text-center py-12">
              <Sliders className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? 'No fields found' : 'No custom fields yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : `Create custom fields to capture additional information for ${ENTITY_TYPES.find(e => e.id === activeTab)?.label.toLowerCase()}`
                }
              </p>
              {!searchQuery && (
                <button onClick={() => setIsCreating(true)} className="btn btn-primary">
                  <Plus size={16} className="mr-2" />
                  Add First Field
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Field Label</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Field Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Required</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <Eye size={16} className="text-gray-600" />
                        <span>Show in Forms</span>
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFields.map((field) => (
                    <tr
                      key={field.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-all ${
                        !field.is_enabled ? 'bg-gray-50 opacity-60' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${field.is_enabled ? 'text-gray-900' : 'text-gray-500 line-through'}`}>
                            {field.field_label}
                          </span>
                          {!field.is_enabled && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Hidden</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <code className={`text-sm px-2 py-1 rounded ${
                          field.is_enabled ? 'text-gray-600 bg-gray-100' : 'text-gray-400 bg-gray-50'
                        }`}>
                          {field.field_name}
                        </code>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`badge ${field.is_enabled ? 'badge-gray' : 'badge-gray opacity-60'}`}>
                          {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {field.is_required ? (
                          <CheckCircle size={16} className={field.is_enabled ? 'text-green-600' : 'text-gray-400'} />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleToggleVisibility(field)}
                          className={`relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-all font-medium ${
                            field.is_enabled
                              ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                          }`}
                          title={field.is_enabled ? 'Click to hide this field from forms' : 'Click to show this field in forms'}
                        >
                          {field.is_enabled ? (
                            <>
                              <Eye size={18} />
                              <span className="text-sm">Visible</span>
                            </>
                          ) : (
                            <>
                              <EyeOff size={18} />
                              <span className="text-sm">Hidden</span>
                            </>
                          )}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            {field.is_enabled ? 'Click to hide from forms' : 'Click to show in forms'}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditField(field)}
                            className="btn btn-sm btn-outline"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteField(field.id)}
                            className="btn btn-sm btn-outline text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminFields
