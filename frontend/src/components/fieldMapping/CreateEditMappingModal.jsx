import React, { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { X, Save, Loader2, ArrowRightLeft } from 'lucide-react'
import { fieldMappingAPI } from '../../services/api'
import toast from 'react-hot-toast'

const CreateEditMappingModal = ({ mapping, onClose, onSuccess }) => {
  const isEditing = !!mapping

  const [formData, setFormData] = useState({
    source_entity: mapping?.source_entity || mapping?.source_entity_type || 'leads',
    target_entity: mapping?.target_entity || mapping?.target_entity_type || 'contacts',
    source_field: mapping?.source_field || mapping?.source_field_name || '',
    target_field: mapping?.target_field || mapping?.target_field_name || '',
    transformation_type: mapping?.transformation_type || 'none',
    is_required_on_convert: mapping?.is_required_on_convert || mapping?.is_required || false,
    display_order: mapping?.display_order || mapping?.priority || 100
  })

  // Fetch available fields for source entity
  const { data: sourceFields, isLoading: loadingSourceFields } = useQuery({
    queryKey: ['entity-fields', formData.source_entity],
    queryFn: () => fieldMappingAPI.getEntityFields(formData.source_entity),
    enabled: !!formData.source_entity
  })

  // Fetch available fields for target entity
  const { data: targetFields, isLoading: loadingTargetFields } = useQuery({
    queryKey: ['entity-fields', formData.target_entity],
    queryFn: () => fieldMappingAPI.getEntityFields(formData.target_entity),
    enabled: !!formData.target_entity
  })

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: (data) => {
      // Map to API field names
      const apiData = {
        source_entity_type: data.source_entity,
        target_entity_type: data.target_entity,
        source_field_name: data.source_field,
        target_field_name: data.target_field,
        transformation_type: data.transformation_type,
        is_required_on_convert: data.is_required_on_convert,
        display_order: data.display_order
      }

      if (isEditing) {
        return fieldMappingAPI.update(mapping.id, apiData)
      }
      return fieldMappingAPI.create(apiData)
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Mapping updated successfully' : 'Mapping created successfully')
      onSuccess()
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to save mapping')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.source_field || !formData.target_field) {
      toast.error('Please select both source and target fields')
      return
    }

    saveMutation.mutate(formData)
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const transformationTypes = [
    { value: 'none', label: 'None (Direct Copy)' },
    { value: 'uppercase', label: 'Convert to Uppercase' },
    { value: 'lowercase', label: 'Convert to Lowercase' },
    { value: 'trim', label: 'Trim Whitespace' },
    { value: 'titlecase', label: 'Title Case' }
  ]

  const targetEntities = [
    { value: 'contacts', label: 'Contact' },
    { value: 'accounts', label: 'Account' },
    { value: 'transactions', label: 'Transaction' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Field Mapping' : 'Create Field Mapping'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Entity Types */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Entity
              </label>
              <select
                value={formData.source_entity}
                onChange={(e) => handleChange('source_entity', e.target.value)}
                disabled={isEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              >
                <option value="leads">Lead</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Entity
              </label>
              <select
                value={formData.target_entity}
                onChange={(e) => {
                  handleChange('target_entity', e.target.value)
                  handleChange('target_field', '') // Reset target field when entity changes
                }}
                disabled={isEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              >
                {targetEntities.map((entity) => (
                  <option key={entity.value} value={entity.value}>
                    {entity.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Field Mapping */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Field
                </label>
                {loadingSourceFields ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading fields...</span>
                  </div>
                ) : (
                  <select
                    value={formData.source_field}
                    onChange={(e) => handleChange('source_field', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a field...</option>
                    {sourceFields?.fields?.filter(f => !f.is_custom).length > 0 && (
                      <optgroup label="Standard Fields">
                        {sourceFields.fields.filter(f => !f.is_custom).map((field) => (
                          <option key={field.name} value={field.name}>
                            {field.label || field.name} ({field.type})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {sourceFields?.fields?.filter(f => f.is_custom).length > 0 && (
                      <optgroup label="Custom Fields">
                        {sourceFields.fields.filter(f => f.is_custom).map((field) => (
                          <option key={field.name} value={field.name}>
                            {field.label || field.name} ({field.type})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              <div className="flex-shrink-0 pt-6">
                <ArrowRightLeft className="w-5 h-5 text-gray-400" />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Field
                </label>
                {loadingTargetFields ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading fields...</span>
                  </div>
                ) : (
                  <select
                    value={formData.target_field}
                    onChange={(e) => handleChange('target_field', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a field...</option>
                    {targetFields?.fields?.filter(f => !f.is_custom).length > 0 && (
                      <optgroup label="Standard Fields">
                        {targetFields.fields.filter(f => !f.is_custom).map((field) => (
                          <option key={field.name} value={field.name}>
                            {field.label || field.name} ({field.type})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {targetFields?.fields?.filter(f => f.is_custom).length > 0 && (
                      <optgroup label="Custom Fields">
                        {targetFields.fields.filter(f => f.is_custom).map((field) => (
                          <option key={field.name} value={field.name}>
                            {field.label || field.name} ({field.type})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Transformation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transformation Rule (Optional)
            </label>
            <select
              value={formData.transformation_type}
              onChange={(e) => handleChange('transformation_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {transformationTypes.map((rule) => (
                <option key={rule.value} value={rule.value}>
                  {rule.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Apply a transformation to the value when mapping
            </p>
          </div>

          {/* Display Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => handleChange('display_order', parseInt(e.target.value))}
              min="1"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Lower numbers are displayed first (default: 100)
            </p>
          </div>

          {/* Is Required */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_required_on_convert"
              checked={formData.is_required_on_convert}
              onChange={(e) => handleChange('is_required_on_convert', e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="is_required_on_convert" className="text-sm font-medium text-gray-700">
              Required field (conversion will fail if source field is empty)
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEditing ? 'Update' : 'Create'} Mapping
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateEditMappingModal
