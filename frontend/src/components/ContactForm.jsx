import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import { customFieldsAPI } from '../services/api'

const ContactForm = ({ contact = null, onClose, onSubmit, users = [], isLoading = false }) => {
  const isEditing = !!contact
  const [fieldConfig, setFieldConfig] = useState(null)
  const [loadingConfig, setLoadingConfig] = useState(true)

  // Load field configuration from API
  useEffect(() => {
    const loadFieldConfig = async () => {
      try {
        const response = await customFieldsAPI.getFields('contacts')
        // Combine system and custom fields, filter enabled ones
        const systemFields = (response.systemFields || []).filter(f => f.is_enabled !== false)
        const customFields = (response.customFields || []).filter(f => f.is_enabled !== false)
        
        setFieldConfig({
          systemFields,
          customFields
        })
      } catch (error) {
        console.error('Failed to load field configuration:', error)
      } finally {
        setLoadingConfig(false)
      }
    }
    loadFieldConfig()
  }, [])

  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: contact ? {
      ...contact,
      next_follow_up: contact.next_follow_up ? new Date(contact.next_follow_up).toISOString().slice(0, 16) : ''
    } : {
      status: 'active',
      type: 'customer',
      priority: 'medium'
    }
  })

  const handleFormSubmit = (data) => {
    // Convert empty strings to null for optional fields
    const cleanData = Object.keys(data).reduce((acc, key) => {
      acc[key] = data[key] || null
      return acc
    }, {})
    onSubmit(cleanData)
  }

  // Helper function to render field based on configuration
  const renderField = (field) => {
    const { field_name, field_label, field_type, field_options, is_required } = field
    const fieldKey = field_name

    // Map database field types to HTML input types
    const inputTypeMap = {
      text: 'text',
      email: 'email',
      tel: 'tel',
      url: 'url',
      number: 'number',
      date: 'date',
      datetime: 'datetime-local'
    }

    // Textarea fields
    if (field_type === 'textarea') {
      return (
        <div key={fieldKey} className={field_name === 'notes' ? 'md:col-span-2' : ''}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field_label}
            {is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            {...register(fieldKey, { required: is_required ? `${field_label} is required` : false })}
            rows={4}
            className={`input resize-none ${errors[fieldKey] ? 'border-red-500' : ''}`}
            placeholder={`Enter ${field_label.toLowerCase()}...`}
          />
          {errors[fieldKey] && (
            <p className="mt-1 text-sm text-red-600">{errors[fieldKey].message}</p>
          )}
        </div>
      )
    }

    // Select fields
    if (field_type === 'select') {
      const options = Array.isArray(field_options) ? field_options : []
      // Handle both array formats: ['option1', 'option2'] and [{value, label}]
      const formattedOptions = options.map(opt => 
        typeof opt === 'string' ? { value: opt, label: opt.charAt(0).toUpperCase() + opt.slice(1) } : opt
      )

      return (
        <div key={fieldKey}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field_label}
            {is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select 
            {...register(fieldKey, { required: is_required ? `${field_label} is required` : false })}
            className={`select ${errors[fieldKey] ? 'border-red-500' : ''}`}
          >
            <option value="">Select {field_label.toLowerCase()}</option>
            {formattedOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors[fieldKey] && (
            <p className="mt-1 text-sm text-red-600">{errors[fieldKey].message}</p>
          )}
        </div>
      )
    }

    // User select field
    if (field_type === 'user_select') {
      return (
        <div key={fieldKey}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field_label}
            {is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select 
            {...register(fieldKey, { required: is_required ? `${field_label} is required` : false })}
            className={`select ${errors[fieldKey] ? 'border-red-500' : ''}`}
          >
            <option value="">Unassigned</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.full_name}</option>
            ))}
          </select>
          {errors[fieldKey] && (
            <p className="mt-1 text-sm text-red-600">{errors[fieldKey].message}</p>
          )}
        </div>
      )
    }

    // Standard input fields
    const inputType = inputTypeMap[field_type] || 'text'
    const validationRules = { required: is_required ? `${field_label} is required` : false }
    
    // Add specific validation for email
    if (field_type === 'email') {
      validationRules.pattern = {
        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Please enter a valid email'
      }
    }
    
    // Add validation for numbers
    if (field_type === 'number') {
      validationRules.min = { value: 0, message: 'Value must be positive' }
    }

    return (
      <div key={fieldKey}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field_label}
          {is_required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          {...register(fieldKey, validationRules)}
          type={inputType}
          className={`input ${errors[fieldKey] ? 'border-red-500' : ''}`}
          placeholder={field_type === 'number' ? '0' : `Enter ${field_label.toLowerCase()}`}
          step={field_type === 'number' ? '0.01' : undefined}
          min={field_type === 'number' ? '0' : undefined}
        />
        {errors[fieldKey] && (
          <p className="mt-1 text-sm text-red-600">{errors[fieldKey].message}</p>
        )}
      </div>
    )
  }

  if (loadingConfig) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="inline-block w-full max-w-2xl px-6 py-6 my-8 text-center bg-white shadow-xl rounded-lg">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600">Loading form...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-2xl px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Contact' : 'Add New Contact'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fieldConfig?.systemFields?.map(field => renderField(field))}
              {fieldConfig?.customFields?.map(field => renderField(field))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-md"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  isEditing ? 'Update Contact' : 'Create Contact'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ContactForm