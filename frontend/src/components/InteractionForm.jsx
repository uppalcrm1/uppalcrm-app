import React from 'react'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

const INTERACTION_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'support_ticket', label: 'Support Ticket' }
]

const DIRECTION_TYPES = [
  { value: 'inbound', label: 'Inbound (They contacted us)' },
  { value: 'outbound', label: 'Outbound (We contacted them)' }
]

const InteractionForm = ({ interaction = null, onClose, onSubmit, isLoading = false }) => {
  const isEditing = !!interaction

  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: interaction || {
      interaction_type: 'note',
      direction: 'outbound'
    }
  })

  const watchedType = watch('interaction_type')

  const handleFormSubmit = (data) => {
    // Convert empty strings to null for optional fields
    const cleanData = {
      ...data,
      subject: data.subject || null,
      content: data.content || null,
      duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : null,
      email_message_id: data.email_message_id || null
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
              {isEditing ? 'Edit Interaction' : 'Add New Interaction'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Interaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                <select
                  {...register('interaction_type', { required: 'Interaction type is required' })}
                  className={`select ${errors.interaction_type ? 'border-red-500' : ''}`}
                >
                  {INTERACTION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {errors.interaction_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.interaction_type.message}</p>
                )}
              </div>

              {/* Direction */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Direction *</label>
                <select
                  {...register('direction', { required: 'Direction is required' })}
                  className={`select ${errors.direction ? 'border-red-500' : ''}`}
                >
                  {DIRECTION_TYPES.map(direction => (
                    <option key={direction.value} value={direction.value}>{direction.label}</option>
                  ))}
                </select>
                {errors.direction && (
                  <p className="mt-1 text-sm text-red-600">{errors.direction.message}</p>
                )}
              </div>

              {/* Subject */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  {...register('subject', {
                    maxLength: { value: 500, message: 'Subject must be less than 500 characters' }
                  })}
                  className={`input ${errors.subject ? 'border-red-500' : ''}`}
                  placeholder="Brief description of the interaction..."
                />
                {errors.subject && (
                  <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
                )}
              </div>

              {/* Duration (only for calls and meetings) */}
              {(watchedType === 'call' || watchedType === 'meeting') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    {...register('duration_minutes', {
                      min: { value: 0, message: 'Duration must be positive' },
                      pattern: {
                        value: /^\d+$/,
                        message: 'Duration must be a whole number'
                      }
                    })}
                    type="number"
                    min="0"
                    className={`input ${errors.duration_minutes ? 'border-red-500' : ''}`}
                    placeholder="30"
                  />
                  {errors.duration_minutes && (
                    <p className="mt-1 text-sm text-red-600">{errors.duration_minutes.message}</p>
                  )}
                </div>
              )}

              {/* Email Message ID (only for emails) */}
              {watchedType === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Message ID
                  </label>
                  <input
                    {...register('email_message_id', {
                      maxLength: { value: 500, message: 'Message ID must be less than 500 characters' }
                    })}
                    className={`input ${errors.email_message_id ? 'border-red-500' : ''}`}
                    placeholder="Optional message ID for tracking"
                  />
                  {errors.email_message_id && (
                    <p className="mt-1 text-sm text-red-600">{errors.email_message_id.message}</p>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
              <textarea
                {...register('content')}
                rows={6}
                className="input resize-none"
                placeholder="Details about this interaction, conversation notes, key points discussed, etc..."
              />
            </div>

            {/* Helper Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Interaction Types:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><strong>Email:</strong> Email correspondence with the contact</li>
                <li><strong>Call:</strong> Phone conversation (specify duration if known)</li>
                <li><strong>Meeting:</strong> In-person or video meeting (specify duration if known)</li>
                <li><strong>Note:</strong> General notes or observations about the contact</li>
                <li><strong>Support Ticket:</strong> Customer support interactions</li>
              </ul>
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
                  isEditing ? 'Update Interaction' : 'Create Interaction'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default InteractionForm