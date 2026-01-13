import React, { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { X, Save, Loader2, ArrowRightLeft } from 'lucide-react'
import { fieldMappingAPI } from '../../services/api'
import toast from 'react-hot-toast'

const CreateEditMappingModal = ({ mapping, onClose, onSuccess }) => {
  const isEditing = !!mapping

  const [formData, setFormData] = useState({
    source_entity_type: mapping?.source_entity_type || 'lead',
    target_entity_type: mapping?.target_entity_type || 'contact',
    source_field_name: mapping?.source_field_name || '',
    target_field_name: mapping?.target_field_name || '',
    transformation_rule: mapping?.transformation_rule || '',
    is_required: mapping?.is_required || false,
    priority: mapping?.priority || 100
  })

  // Fetch available fields for source entity
  const { data: sourceFields, isLoading: loadingSourceFields } = useQuery({
    queryKey: ['entity-fields', formData.source_entity_type],
    queryFn: () => fieldMappingAPI.getEntityFields(formData.source_entity_type),
    enabled: !!formData.source_entity_type
  })

  // Fetch available fields for target entity
  const { data: targetFields, isLoading: loadingTargetFields } = useQuery({
    queryKey: ['entity-fields', formData.target_entity_type],
    queryFn: () => fieldMappingAPI.getEntityFields(formData.target_entity_type),
    enabled: !!formData.target_entity_type
  })

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (isEditing) {
        return fieldMappingAPI.update(mapping.id, data)
      }
      return fieldMappingAPI.create(data)
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
    if (!formData.source_field_name || !formData.target_field_name) {
      toast.error('Please select both source and target fields')
      return
    }

    saveMutation.mutate(formData)
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const transformationRules = [
    { value: '', label: 'None (Direct Copy)' },
    { value: 'uppercase', label: 'Convert to Uppercase' },
    { value: 'lowercase', label: 'Convert to Lowercase' },
    { value: 'trim', label: 'Trim Whitespace' },
    { value: 'capitalize', label: 'Capitalize First Letter' }
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
                value={formData.source_entity_type}
                onChange={(e) => handleChange('source_entity_type', e.target.value)}
                disabled={isEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="lead">Lead</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Entity
              </label>
              <select
                value={formData.target_entity_type}
                onChange={(e) => handleChange('target_entity_type', e.target.value)}
                disabled={isEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="contact">Contact</option>
                <option value="account">Account</option>
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
                    value={formData.source_field_name}
                    onChange={(e) => handleChange('source_field_name', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a field...</option>
                    {sourceFields?.fields?.map((field) => (
                      <option key={field.name} value={field.name}>
                        {field.label || field.name} ({field.type})
                      </option>
                    ))}
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
                    value={formData.target_field_name}
                    onChange={(e) => handleChange('target_field_name', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a field...</option>
                    {targetFields?.fields?.map((field) => (
                      <option key={field.name} value={field.name}>
                        {field.label || field.name} ({field.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Transformation Rule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transformation Rule (Optional)
            </label>
            <select
              value={formData.transformation_rule}
              onChange={(e) => handleChange('transformation_rule', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {transformationRules.map((rule) => (
                <option key={rule.value} value={rule.value}>
                  {rule.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Apply a transformation to the value when mapping
            </p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => handleChange('priority', parseInt(e.target.value))}
              min="1"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Lower numbers are processed first (default: 100)
            </p>
          </div>

          {/* Is Required */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_required"
              checked={formData.is_required}
              onChange={(e) => handleChange('is_required', e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="is_required" className="text-sm font-medium text-gray-700">
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
