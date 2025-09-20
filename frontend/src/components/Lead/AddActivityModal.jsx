import React, { useState } from 'react'
import {
  X,
  Mail,
  Phone,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  Users,
  AlertCircle,
  Plus,
  Minus
} from 'lucide-react'
import api from '../../services/api'

const AddActivityModal = ({ leadId, onClose, onActivityAdded }) => {
  const [formData, setFormData] = useState({
    interaction_type: 'call',
    subject: '',
    description: '',
    outcome: '',
    duration: '',
    scheduled_at: '',
    participants: [''],
    priority: 'medium',
    activity_metadata: {}
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activityTypes = [
    { value: 'email', label: 'Email', icon: Mail, description: 'Email communication' },
    { value: 'call', label: 'Call', icon: Phone, description: 'Phone call' },
    { value: 'meeting', label: 'Meeting', icon: Calendar, description: 'In-person or virtual meeting' },
    { value: 'note', label: 'Note', icon: FileText, description: 'General note or observation' },
    { value: 'task', label: 'Task', icon: CheckCircle, description: 'Task or action item' }
  ]

  const priorities = [
    { value: 'low', label: 'Low', color: 'text-green-600' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
    { value: 'high', label: 'High', color: 'text-red-600' }
  ]

  const outcomes = {
    call: ['Connected', 'Voicemail', 'No Answer', 'Busy', 'Interested', 'Not Interested', 'Follow-up Required'],
    email: ['Sent', 'Replied', 'Bounced', 'Opened', 'Clicked'],
    meeting: ['Completed', 'Cancelled', 'Rescheduled', 'No Show', 'Productive', 'Follow-up Required'],
    note: ['Information', 'Observation', 'Reminder', 'Research'],
    task: ['Completed', 'In Progress', 'Pending', 'Cancelled']
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleParticipantChange = (index, value) => {
    const newParticipants = [...formData.participants]
    newParticipants[index] = value
    setFormData(prev => ({
      ...prev,
      participants: newParticipants
    }))
  }

  const addParticipant = () => {
    setFormData(prev => ({
      ...prev,
      participants: [...prev.participants, '']
    }))
  }

  const removeParticipant = (index) => {
    const newParticipants = formData.participants.filter((_, i) => i !== index)
    setFormData(prev => ({
      ...prev,
      participants: newParticipants.length > 0 ? newParticipants : ['']
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Prepare the data
      const submitData = {
        ...formData,
        participants: formData.participants.filter(p => p.trim() !== ''),
        duration: formData.duration ? parseInt(formData.duration) : undefined,
        scheduled_at: formData.scheduled_at || undefined
      }

      // Remove empty fields
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '' || submitData[key] === undefined) {
          delete submitData[key]
        }
      })

      await api.post(`/leads/${leadId}/activities`, submitData)
      onActivityAdded()
    } catch (err) {
      console.error('Error adding activity:', err)
      setError(err.response?.data?.message || 'Failed to add activity')
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type) => {
    const activityType = activityTypes.find(t => t.value === type)
    const Icon = activityType?.icon || FileText
    return <Icon size={20} />
  }

  const selectedType = activityTypes.find(t => t.value === formData.interaction_type)
  const availableOutcomes = outcomes[formData.interaction_type] || []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {getActivityIcon(formData.interaction_type)}
                </div>
                <div className="ml-3">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Add New Activity
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedType?.description}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white px-6 py-4">
            <div className="space-y-6">
              {/* Activity Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Activity Type
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {activityTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleInputChange('interaction_type', type.value)}
                        className={`p-3 border rounded-lg text-center transition-colors ${
                          formData.interaction_type === type.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <Icon size={20} className="mx-auto mb-1" />
                        <div className="text-xs font-medium">{type.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  placeholder={`Enter ${formData.interaction_type} subject...`}
                  className="input w-full"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder={`Add details about this ${formData.interaction_type}...`}
                  className="textarea w-full"
                />
              </div>

              {/* Row 1: Priority and Outcome */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="select w-full"
                  >
                    {priorities.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Outcome
                  </label>
                  <select
                    value={formData.outcome}
                    onChange={(e) => handleInputChange('outcome', e.target.value)}
                    className="select w-full"
                  >
                    <option value="">Select outcome...</option>
                    {availableOutcomes.map((outcome) => (
                      <option key={outcome} value={outcome}>
                        {outcome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Duration and Scheduled Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(formData.interaction_type === 'call' || formData.interaction_type === 'meeting') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.duration}
                      onChange={(e) => handleInputChange('duration', e.target.value)}
                      placeholder="e.g., 30"
                      className="input w-full"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.interaction_type === 'meeting' ? 'Meeting Time' : 'Scheduled At'}
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => handleInputChange('scheduled_at', e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Participants (for meetings) */}
              {formData.interaction_type === 'meeting' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Participants
                  </label>
                  <div className="space-y-2">
                    {formData.participants.map((participant, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={participant}
                          onChange={(e) => handleParticipantChange(index, e.target.value)}
                          placeholder="Participant name or email"
                          className="input flex-1"
                        />
                        {formData.participants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParticipant(index)}
                            className="p-2 text-red-600 hover:text-red-800"
                          >
                            <Minus size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addParticipant}
                      className="inline-flex items-center text-sm text-primary-600 hover:text-primary-800"
                    >
                      <Plus size={16} className="mr-1" />
                      Add Participant
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex">
                  <AlertCircle size={16} className="text-red-400 mr-2 mt-0.5" />
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.subject}
                className="btn btn-primary"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} className="mr-2" />
                    Add Activity
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AddActivityModal