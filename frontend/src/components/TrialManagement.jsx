import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { 
  Plus, 
  PlayCircle, 
  Calendar, 
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  Filter,
  X,
  Eye,
  EyeOff
} from 'lucide-react'
import { contactsAPI } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'
import { format, differenceInDays, isPast } from 'date-fns'

const TRIAL_STATUSES = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'expired', label: 'Expired', color: 'red' },
  { value: 'converted', label: 'Converted', color: 'blue' },
  { value: 'cancelled', label: 'Cancelled', color: 'gray' }
]

const TrialManagement = ({ contactId }) => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTrial, setSelectedTrial] = useState(null)
  const [filters, setFilters] = useState({
    status: '',
    active_only: false
  })
  const [showTrialKeys, setShowTrialKeys] = useState({})
  const queryClient = useQueryClient()

  // Fetch trials
  const { data: trialsData, isLoading } = useQuery({
    queryKey: ['trials', contactId, filters],
    queryFn: () => contactsAPI.getTrials(contactId, filters),
  })

  // Fetch software editions
  const { data: editionsData } = useQuery({
    queryKey: ['software-editions'],
    queryFn: () => contactsAPI.getEditions(),
  })

  // Create trial mutation
  const createMutation = useMutation({
    mutationFn: (trialData) => contactsAPI.createTrial(contactId, trialData),
    onSuccess: () => {
      queryClient.invalidateQueries(['trials', contactId])
      toast.success('Trial created successfully')
      setShowCreateModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create trial')
    }
  })

  const trials = trialsData?.trials || []
  const editions = editionsData?.editions || []

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy')
    })
  }

  const toggleTrialKeyVisibility = (trialId) => {
    setShowTrialKeys(prev => ({
      ...prev,
      [trialId]: !prev[trialId]
    }))
  }

  const getTrialStatus = (trial) => {
    if (trial.status === 'active' && isPast(new Date(trial.expires_at))) {
      return { status: 'expired', color: 'red', label: 'Expired' }
    }
    const statusConfig = TRIAL_STATUSES.find(s => s.value === trial.status)
    return statusConfig || { status: trial.status, color: 'gray', label: trial.status }
  }

  const getExpirationInfo = (expiresAt) => {
    const daysUntilExpiry = differenceInDays(new Date(expiresAt), new Date())
    
    if (daysUntilExpiry < 0) {
      return { 
        type: 'expired', 
        message: `Expired ${Math.abs(daysUntilExpiry)} days ago`, 
        color: 'red',
        icon: XCircle
      }
    } else if (daysUntilExpiry === 0) {
      return { 
        type: 'expires-today', 
        message: 'Expires today', 
        color: 'red',
        icon: AlertTriangle
      }
    } else if (daysUntilExpiry <= 3) {
      return { 
        type: 'critical', 
        message: `${daysUntilExpiry} days left`, 
        color: 'red',
        icon: AlertTriangle
      }
    } else if (daysUntilExpiry <= 7) {
      return { 
        type: 'warning', 
        message: `${daysUntilExpiry} days left`, 
        color: 'yellow',
        icon: Clock
      }
    } else {
      return { 
        type: 'active', 
        message: `${daysUntilExpiry} days left`, 
        color: 'green',
        icon: CheckCircle
      }
    }
  }

  if (isLoading) {
    return <LoadingSpinner className="py-8" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Trial Management</h3>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary btn-sm"
          >
            <Filter size={16} className="mr-2" />
            Filter
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={16} className="mr-2" />
            Create Trial
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="select"
              >
                <option value="">All Statuses</option>
                {TRIAL_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.active_only}
                  onChange={(e) => setFilters(prev => ({ ...prev, active_only: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                />
                <span className="text-sm text-gray-700">Active only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Trials List */}
      {trials.length === 0 ? (
        <div className="text-center py-8">
          <PlayCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No trials found</h3>
          <p className="text-gray-600 mb-6">Create trial licenses to allow customers to test your software</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} className="mr-2" />
            Create Trial
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {trials.map((trial) => {
            const statusInfo = getTrialStatus(trial)
            const expirationInfo = getExpirationInfo(trial.expires_at)
            const isKeyVisible = showTrialKeys[trial.id]
            const ExpirationIcon = expirationInfo.icon
            
            return (
              <div key={trial.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center mr-3">
                      <PlayCircle className="text-white" size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{trial.edition_name} Trial</h4>
                      <p className="text-sm text-gray-600">Free trial access</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`badge badge-${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <div className={`flex items-center text-${expirationInfo.color}-600 text-sm`}>
                      <ExpirationIcon size={16} className="mr-1" />
                      {expirationInfo.message}
                    </div>
                  </div>
                </div>

                {/* Trial Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-3 text-sm">
                    {/* Trial Key */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-600">Trial Key:</span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleTrialKeyVisibility(trial.id)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title={isKeyVisible ? 'Hide key' : 'Show key'}
                          >
                            {isKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(trial.trial_key)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Copy to clipboard"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="text-gray-900 font-mono text-xs bg-gray-50 p-2 rounded">
                        {isKeyVisible ? trial.trial_key : '••••••••••••••••••••••••'}
                      </div>
                    </div>

                    {/* Owner */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Owner:</span>
                      <span className="text-gray-900">{trial.first_name} {trial.last_name}</span>
                    </div>

                    {/* Contact Email */}
                    {trial.email && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="text-gray-900">{trial.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-3 text-sm">
                    {/* Start Date */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Started:</span>
                      <span className="text-gray-900">{format(new Date(trial.created_at), 'MMM d, yyyy')}</span>
                    </div>

                    {/* Expiration Date */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expires:</span>
                      <span className={`text-${expirationInfo.color}-600 font-medium`}>
                        {format(new Date(trial.expires_at), 'MMM d, yyyy')}
                      </span>
                    </div>

                    {/* Duration */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="text-gray-900">
                        {differenceInDays(new Date(trial.expires_at), new Date(trial.created_at))} days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Features Enabled */}
                {trial.features_enabled && Object.keys(trial.features_enabled).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Enabled Features</h5>
                    <div className="text-xs bg-gray-50 p-3 rounded">
                      <pre className="text-gray-700">{JSON.stringify(trial.features_enabled, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
                  <div className="text-sm text-gray-600">
                    {expirationInfo.type === 'expired' ? (
                      'Trial has expired'
                    ) : expirationInfo.type === 'expires-today' ? (
                      'Trial expires today'
                    ) : expirationInfo.type === 'critical' ? (
                      'Trial expiring soon'
                    ) : (
                      `Trial active for ${expirationInfo.message}`
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(trial.trial_key)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Copy size={14} className="mr-1" />
                      Copy Key
                    </button>
                    <button
                      onClick={() => setSelectedTrial(trial)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Eye size={14} className="mr-1" />
                      Details
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Trial Modal */}
      {showCreateModal && (
        <CreateTrialModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          editions={editions}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Trial Details Modal */}
      {selectedTrial && (
        <TrialDetailsModal
          trial={selectedTrial}
          onClose={() => setSelectedTrial(null)}
        />
      )}
    </div>
  )
}

// Create Trial Modal
const CreateTrialModal = ({ onClose, onSubmit, editions, isLoading }) => {
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      trial_days: 30
    }
  })

  const watchedFeatures = watch('features_json')

  const handleFormSubmit = (data) => {
    let features_enabled = {}
    
    if (data.features_json) {
      try {
        features_enabled = JSON.parse(data.features_json)
      } catch (error) {
        toast.error('Invalid JSON format for features')
        return
      }
    }

    const cleanData = {
      edition_id: data.edition_id,
      trial_days: parseInt(data.trial_days),
      features_enabled
    }

    onSubmit(cleanData)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-lg px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Create Trial</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Software Edition */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Software Edition *</label>
              <select
                {...register('edition_id', { required: 'Please select a software edition' })}
                className={`select ${errors.edition_id ? 'border-red-500' : ''}`}
              >
                <option value="">Select edition...</option>
                {editions.map(edition => (
                  <option key={edition.id} value={edition.id}>
                    {edition.name} - {edition.version}
                  </option>
                ))}
              </select>
              {errors.edition_id && (
                <p className="mt-1 text-sm text-red-600">{errors.edition_id.message}</p>
              )}
            </div>

            {/* Trial Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trial Duration (Days)</label>
              <input
                {...register('trial_days', { 
                  required: 'Trial duration is required',
                  min: { value: 1, message: 'Trial must be at least 1 day' },
                  max: { value: 365, message: 'Trial cannot exceed 365 days' }
                })}
                type="number"
                min="1"
                max="365"
                className={`input ${errors.trial_days ? 'border-red-500' : ''}`}
              />
              {errors.trial_days && (
                <p className="mt-1 text-sm text-red-600">{errors.trial_days.message}</p>
              )}
            </div>

            {/* Features Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enabled Features (JSON)
                <span className="text-gray-500 font-normal ml-2">(Optional)</span>
              </label>
              <textarea
                {...register('features_json')}
                rows={6}
                className="input resize-none font-mono text-sm"
                placeholder={`{
  "feature1": true,
  "feature2": false,
  "max_projects": 3,
  "storage_limit": "1GB"
}`}
              />
              <p className="mt-1 text-xs text-gray-500">
                Configure which features are enabled during the trial period
              </p>
            </div>

            {/* Trial Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <PlayCircle className="text-blue-600 mt-0.5 mr-2" size={16} />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Trial Information:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Trial key will be automatically generated</li>
                    <li>• Customer can use the software for the specified duration</li>
                    <li>• Features can be configured to limit trial functionality</li>
                    <li>• Trial can be converted to a full license later</li>
                  </ul>
                </div>
              </div>
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
                {isLoading ? <LoadingSpinner size="sm" /> : 'Create Trial'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Trial Details Modal
const TrialDetailsModal = ({ trial, onClose }) => {
  const statusInfo = getTrialStatus(trial)
  const expirationInfo = getExpirationInfo(trial.expires_at)
  const ExpirationIcon = expirationInfo.icon

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy')
    })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-lg px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Trial Details</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Trial Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center mr-4">
                  <PlayCircle className="text-white" size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">{trial.edition_name}</h4>
                  <p className="text-gray-600">Trial License</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`badge badge-${statusInfo.color} mb-2`}>
                  {statusInfo.label}
                </span>
                <div className={`flex items-center text-${expirationInfo.color}-600 text-sm`}>
                  <ExpirationIcon size={16} className="mr-1" />
                  {expirationInfo.message}
                </div>
              </div>
            </div>

            {/* Trial Information */}
            <div className="space-y-4">
              {/* Trial Key */}
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Trial Key</h5>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 text-sm bg-gray-50 p-3 rounded font-mono">
                    {trial.trial_key}
                  </div>
                  <button
                    onClick={() => copyToClipboard(trial.trial_key)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Dates */}
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Timeline</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Started:</span>
                    <span className="text-gray-900">{format(new Date(trial.created_at), 'MMMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expires:</span>
                    <span className={`text-${expirationInfo.color}-600`}>
                      {format(new Date(trial.expires_at), 'MMMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="text-gray-900">
                      {differenceInDays(new Date(trial.expires_at), new Date(trial.created_at))} days
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Customer</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="text-gray-900">{trial.first_name} {trial.last_name}</span>
                  </div>
                  {trial.email && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="text-gray-900">{trial.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Features */}
              {trial.features_enabled && Object.keys(trial.features_enabled).length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Enabled Features</h5>
                  <div className="text-xs bg-gray-50 p-3 rounded">
                    <pre className="text-gray-700">{JSON.stringify(trial.features_enabled, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t">
              <button
                onClick={() => copyToClipboard(trial.trial_key)}
                className="btn btn-secondary btn-md"
              >
                <Copy size={16} className="mr-2" />
                Copy Trial Key
              </button>
              <button onClick={onClose} className="btn btn-primary btn-md">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
const getTrialStatus = (trial) => {
  if (trial.status === 'active' && isPast(new Date(trial.expires_at))) {
    return { status: 'expired', color: 'red', label: 'Expired' }
  }
  const statusConfig = TRIAL_STATUSES.find(s => s.value === trial.status)
  return statusConfig || { status: trial.status, color: 'gray', label: trial.status }
}

const getExpirationInfo = (expiresAt) => {
  const daysUntilExpiry = differenceInDays(new Date(expiresAt), new Date())
  
  if (daysUntilExpiry < 0) {
    return { 
      type: 'expired', 
      message: `Expired ${Math.abs(daysUntilExpiry)} days ago`, 
      color: 'red',
      icon: XCircle
    }
  } else if (daysUntilExpiry === 0) {
    return { 
      type: 'expires-today', 
      message: 'Expires today', 
      color: 'red',
      icon: AlertTriangle
    }
  } else if (daysUntilExpiry <= 3) {
    return { 
      type: 'critical', 
      message: `${daysUntilExpiry} days left`, 
      color: 'red',
      icon: AlertTriangle
    }
  } else if (daysUntilExpiry <= 7) {
    return { 
      type: 'warning', 
      message: `${daysUntilExpiry} days left`, 
      color: 'yellow',
      icon: Clock
    }
  } else {
    return { 
      type: 'active', 
      message: `${daysUntilExpiry} days left`, 
      color: 'green',
      icon: CheckCircle
    }
  }
}

export default TrialManagement