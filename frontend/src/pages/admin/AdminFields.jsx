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
  const [isCreating, setIsCreating] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
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

  // Mock data for demonstration
  const mockFields = {
    leads: [
      {
        id: '1',
        field_name: 'industry',
        field_label: 'Industry',
        field_type: 'select',
        is_required: false,
        show_in_list_view: true,
        field_options: [
          { value: 'tech', label: 'Technology' },
          { value: 'finance', label: 'Finance' },
          { value: 'healthcare', label: 'Healthcare' }
        ],
        display_order: 1
      },
      {
        id: '2',
        field_name: 'annual_revenue',
        field_label: 'Annual Revenue',
        field_type: 'number',
        is_required: false,
        show_in_list_view: false,
        display_order: 2
      }
    ],
    contacts: [
      {
        id: '3',
        field_name: 'department',
        field_label: 'Department',
        field_type: 'text',
        is_required: false,
        show_in_list_view: true,
        display_order: 1
      }
    ],
    accounts: [],
    transactions: []
  }

  useEffect(() => {
    // Load fields for active tab
    setFields(mockFields[activeTab] || [])
  }, [activeTab])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveField = () => {
    if (editingField) {
      // Update existing field
      setFields(prev => prev.map(f => f.id === editingField.id ? { ...formData, id: f.id } : f))
      setEditingField(null)
    } else {
      // Create new field
      const newField = {
        ...formData,
        id: Date.now().toString(),
        entity_type: activeTab,
        display_order: fields.length + 1
      }
      setFields(prev => [...prev, newField])
      setIsCreating(false)
    }
    resetForm()
  }

  const handleEditField = (field) => {
    setFormData(field)
    setEditingField(field)
    setIsCreating(true)
  }

  const handleDeleteField = (fieldId) => {
    if (confirm('Are you sure you want to delete this field? This action cannot be undone.')) {
      setFields(prev => prev.filter(f => f.id !== fieldId))
    }
  }

  const handleToggleVisibility = (fieldId, property) => {
    setFields(prev => prev.map(f =>
      f.id === fieldId ? { ...f, [property]: !f[property] } : f
    ))
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

  const filteredFields = fields.filter(field =>
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
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Field Label</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Field Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Required</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">List View</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFields.map((field) => (
                    <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <span className="font-medium text-gray-900">{field.field_label}</span>
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {field.field_name}
                        </code>
                      </td>
                      <td className="py-4 px-4">
                        <span className="badge badge-gray">
                          {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {field.is_required ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleToggleVisibility(field.id, 'show_in_list_view')}
                          className={`p-1 rounded ${field.show_in_list_view ? 'text-green-600' : 'text-gray-400'}`}
                        >
                          {field.show_in_list_view ? <Eye size={16} /> : <EyeOff size={16} />}
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
