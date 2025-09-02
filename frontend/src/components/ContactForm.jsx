import React from 'react'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

const CONTACT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' }
]

const CONTACT_TYPES = [
  { value: 'customer', label: 'Customer' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'partner', label: 'Partner' },
  { value: 'vendor', label: 'Vendor' }
]

const CONTACT_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
]

const CONTACT_SOURCES = [
  'website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other'
]

const ContactForm = ({ contact = null, onClose, onSubmit, users = [], isLoading = false }) => {
  const isEditing = !!contact

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
    const cleanData = {
      ...data,
      assigned_to: data.assigned_to || null,
      next_follow_up: data.next_follow_up || null,
      value: parseFloat(data.value) || 0
    }
    onSubmit(cleanData)
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
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  {...register('first_name', { required: 'First name is required' })}
                  className={`input ${errors.first_name ? 'border-red-500' : ''}`}
                  placeholder="John"
                />
                {errors.first_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  {...register('last_name', { required: 'Last name is required' })}
                  className={`input ${errors.last_name ? 'border-red-500' : ''}`}
                  placeholder="Doe"
                />
                {errors.last_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  {...register('title')}
                  className="input"
                  placeholder="CEO, CTO, Manager, etc."
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <input
                  {...register('company')}
                  className="input"
                  placeholder="Acme Inc"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  {...register('email', {
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email'
                    }
                  })}
                  type="email"
                  className={`input ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="john@company.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  {...register('phone')}
                  type="tel"
                  className="input"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select {...register('status')} className="select">
                  {CONTACT_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select {...register('type')} className="select">
                  {CONTACT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                <select {...register('source')} className="select">
                  <option value="">Select source</option>
                  {CONTACT_SOURCES.map(source => (
                    <option key={source} value={source}>
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select {...register('priority')} className="select">
                  {CONTACT_PRIORITIES.map(priority => (
                    <option key={priority.value} value={priority.value}>{priority.label}</option>
                  ))}
                </select>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Value ($)</label>
                <input
                  {...register('value', {
                    min: { value: 0, message: 'Value must be positive' }
                  })}
                  type="number"
                  min="0"
                  step="0.01"
                  className={`input ${errors.value ? 'border-red-500' : ''}`}
                  placeholder="10000"
                />
                {errors.value && (
                  <p className="mt-1 text-sm text-red-600">{errors.value.message}</p>
                )}
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                <select {...register('assigned_to')} className="select">
                  <option value="">Unassigned</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Next Follow Up */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Next Follow Up</label>
                <input
                  {...register('next_follow_up')}
                  type="datetime-local"
                  className="input"
                />
              </div>

              {/* Last Contact Date - Only show when editing */}
              {isEditing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Contact Date</label>
                  <input
                    {...register('last_contact_date')}
                    type="datetime-local"
                    className="input"
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                {...register('notes')}
                rows={4}
                className="input resize-none"
                placeholder="Additional notes about this contact..."
              />
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