import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { 
  PlayCircle, 
  Calendar, 
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  CreditCard,
  Calendar as CalendarIcon,
  History,
  Settings,
  DollarSign,
  X,
  Zap
} from 'lucide-react'
import { trialAPI } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'
import { format, differenceInDays, isPast } from 'date-fns'

const OrganizationTrialManagement = () => {
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const queryClient = useQueryClient()

  // Fetch trial status
  const { data: trialData, isLoading, error } = useQuery({
    queryKey: ['organization-trial-status'],
    queryFn: () => trialAPI.getTrialStatus(),
  })

  // Fetch trial eligibility
  const { data: eligibilityData } = useQuery({
    queryKey: ['trial-eligibility'],
    queryFn: () => trialAPI.checkEligibility(),
  })

  // Start trial mutation
  const startTrialMutation = useMutation({
    mutationFn: (trialDays) => trialAPI.startTrial(trialDays),
    onSuccess: () => {
      queryClient.invalidateQueries(['organization-trial-status'])
      queryClient.invalidateQueries(['trial-eligibility'])
      toast.success('Trial started successfully!')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to start trial')
    }
  })

  // Extend trial mutation
  const extendTrialMutation = useMutation({
    mutationFn: (additionalDays) => trialAPI.extendTrial(additionalDays),
    onSuccess: () => {
      queryClient.invalidateQueries(['organization-trial-status'])
      toast.success('Trial extended successfully!')
      setShowExtendModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to extend trial')
    }
  })

  // Convert trial mutation
  const convertTrialMutation = useMutation({
    mutationFn: (paymentData) => trialAPI.convertTrial(paymentData),
    onSuccess: () => {
      queryClient.invalidateQueries(['organization-trial-status'])
      toast.success('Trial converted to paid subscription!')
      setShowConvertModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to convert trial')
    }
  })

  // Cancel trial mutation
  const cancelTrialMutation = useMutation({
    mutationFn: (reason) => trialAPI.cancelTrial(reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['organization-trial-status'])
      toast.success('Trial cancelled successfully')
      setShowCancelModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to cancel trial')
    }
  })

  const trial = trialData?.trial
  const canStartTrial = eligibilityData?.eligible

  const getTrialStatusInfo = () => {
    if (!trial) return { type: 'no-trial', color: 'gray', icon: PlayCircle }
    
    switch (trial.trial_status) {
      case 'active':
        if (trial.days_remaining <= 0) {
          return { type: 'expired', color: 'red', icon: XCircle }
        } else if (trial.days_remaining <= 3) {
          return { type: 'critical', color: 'red', icon: AlertTriangle }
        } else if (trial.days_remaining <= 7) {
          return { type: 'warning', color: 'yellow', icon: Clock }
        } else {
          return { type: 'active', color: 'green', icon: CheckCircle }
        }
      case 'expired':
        return { type: 'expired', color: 'red', icon: XCircle }
      case 'converted':
        return { type: 'converted', color: 'blue', icon: CreditCard }
      case 'cancelled':
        return { type: 'cancelled', color: 'gray', icon: XCircle }
      default:
        return { type: 'no-trial', color: 'gray', icon: PlayCircle }
    }
  }

  const getTimeRemaining = () => {
    if (!trial || !trial.trial_ends_at) return null
    
    const now = new Date()
    const endDate = new Date(trial.trial_ends_at)
    const hoursRemaining = Math.floor((endDate - now) / (1000 * 60 * 60))
    const daysRemaining = Math.floor(hoursRemaining / 24)
    
    if (hoursRemaining <= 0) {
      return { expired: true, message: 'Trial expired' }
    } else if (hoursRemaining < 24) {
      return { expired: false, message: `${hoursRemaining} hours remaining` }
    } else {
      return { expired: false, message: `${daysRemaining} days remaining` }
    }
  }

  const statusInfo = getTrialStatusInfo()
  const timeRemaining = getTimeRemaining()
  const StatusIcon = statusInfo.icon

  if (isLoading) {
    return <LoadingSpinner className="py-8" />
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Trial Status</h3>
        <p className="text-gray-600">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Organization Trial</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="btn btn-secondary btn-sm"
          >
            <History size={16} className="mr-2" />
            History
          </button>
        </div>
      </div>

      {/* Main Trial Status Card */}
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center">
            <div className={`w-16 h-16 bg-${statusInfo.color}-600 rounded-xl flex items-center justify-center mr-4`}>
              <StatusIcon className="text-white" size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {trial?.trial_status === 'never_started' ? 'No Trial Started' :
                 trial?.trial_status === 'active' ? 'Trial Active' :
                 trial?.trial_status === 'expired' ? 'Trial Expired' :
                 trial?.trial_status === 'converted' ? 'Subscription Active' :
                 trial?.trial_status === 'cancelled' ? 'Trial Cancelled' :
                 'Trial Status'}
              </h3>
              <p className="text-gray-600">
                {trial?.name || 'Your organization'}
              </p>
            </div>
          </div>
          
          {trial?.trial_status && (
            <div className="text-right">
              <span className={`badge badge-${statusInfo.color} badge-lg mb-2`}>
                {trial.trial_status.charAt(0).toUpperCase() + trial.trial_status.slice(1).replace('_', ' ')}
              </span>
              {timeRemaining && (
                <div className={`text-${timeRemaining.expired ? 'red' : statusInfo.color}-600 font-medium`}>
                  {timeRemaining.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trial Progress */}
        {trial?.is_trial_active && trial.trial_progress_percentage !== undefined && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Trial Progress</span>
              <span>{Math.round(trial.trial_progress_percentage)}% complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  trial.days_remaining <= 3 ? 'bg-red-600' :
                  trial.days_remaining <= 7 ? 'bg-yellow-500' : 'bg-green-600'
                }`}
                style={{ width: `${trial.trial_progress_percentage}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Trial Details */}
        {trial && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {trial.trial_started_at && (
              <div>
                <div className="text-sm text-gray-600 mb-1">Started</div>
                <div className="font-semibold text-gray-900">
                  {format(new Date(trial.trial_started_at), 'MMM d, yyyy')}
                </div>
              </div>
            )}
            
            {trial.trial_ends_at && (
              <div>
                <div className="text-sm text-gray-600 mb-1">Expires</div>
                <div className={`font-semibold ${
                  trial.days_remaining <= 3 ? 'text-red-600' :
                  trial.days_remaining <= 7 ? 'text-yellow-600' : 'text-gray-900'
                }`}>
                  {format(new Date(trial.trial_ends_at), 'MMM d, yyyy')}
                </div>
              </div>
            )}
            
            <div>
              <div className="text-sm text-gray-600 mb-1">Duration</div>
              <div className="font-semibold text-gray-900">
                {trial.trial_days || 0} days
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Trials</div>
              <div className="font-semibold text-gray-900">
                {trial.total_trial_count || 0}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {trial?.is_trial_active ? (
              trial.can_extend_trial ? 'Trial can be extended' : 'Trial is active'
            ) : trial?.trial_status === 'expired' ? (
              'Trial has expired'
            ) : trial?.trial_status === 'converted' ? (
              'Subscription is active'
            ) : trial?.trial_status === 'cancelled' ? (
              'Trial was cancelled'
            ) : canStartTrial ? (
              'Ready to start trial'
            ) : (
              'Not eligible for trial'
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Start Trial */}
            {canStartTrial && !trial?.is_trial_active && (
              <button
                onClick={() => startTrialMutation.mutate(30)}
                disabled={startTrialMutation.isPending}
                className="btn btn-primary btn-md"
              >
                {startTrialMutation.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <PlayCircle size={16} className="mr-2" />
                    Start 30-Day Trial
                  </>
                )}
              </button>
            )}

            {/* Active Trial Actions */}
            {trial?.is_trial_active && (
              <>
                {trial.can_extend_trial && (
                  <button
                    onClick={() => setShowExtendModal(true)}
                    className="btn btn-secondary btn-md"
                  >
                    <Clock size={16} className="mr-2" />
                    Extend Trial
                  </button>
                )}
                
                <button
                  onClick={() => setShowConvertModal(true)}
                  className="btn btn-success btn-md"
                >
                  <CreditCard size={16} className="mr-2" />
                  Convert to Paid
                </button>
                
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="btn btn-outline btn-md"
                >
                  <XCircle size={16} className="mr-2" />
                  Cancel Trial
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Status */}
      {trial?.payment_status === 'active' && (
        <div className="card">
          <div className="flex items-center mb-4">
            <CreditCard className="text-blue-600 mr-3" size={24} />
            <h3 className="text-lg font-semibold text-gray-900">Subscription Status</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600 mb-1">Status</div>
              <div className="font-semibold text-green-600">Active</div>
            </div>
            
            {trial.subscription_ends_at && (
              <div>
                <div className="text-gray-600 mb-1">Renewal Date</div>
                <div className="font-semibold text-gray-900">
                  {format(new Date(trial.subscription_ends_at), 'MMM d, yyyy')}
                </div>
              </div>
            )}
            
            <div>
              <div className="text-gray-600 mb-1">Plan</div>
              <div className="font-semibold text-gray-900">Professional</div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showExtendModal && (
        <ExtendTrialModal
          onClose={() => setShowExtendModal(false)}
          onSubmit={(additionalDays) => extendTrialMutation.mutate(additionalDays)}
          isLoading={extendTrialMutation.isPending}
        />
      )}

      {showConvertModal && (
        <ConvertTrialModal
          onClose={() => setShowConvertModal(false)}
          onSubmit={(paymentData) => convertTrialMutation.mutate(paymentData)}
          isLoading={convertTrialMutation.isPending}
        />
      )}

      {showCancelModal && (
        <CancelTrialModal
          onClose={() => setShowCancelModal(false)}
          onSubmit={(reason) => cancelTrialMutation.mutate(reason)}
          isLoading={cancelTrialMutation.isPending}
        />
      )}

      {showHistoryModal && (
        <TrialHistoryModal
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  )
}

// Extend Trial Modal
const ExtendTrialModal = ({ onClose, onSubmit, isLoading }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { additional_days: 7 }
  })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-md px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Extend Trial</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit((data) => onSubmit(parseInt(data.additional_days)))}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Days
              </label>
              <input
                {...register('additional_days', { 
                  required: 'Additional days is required',
                  min: { value: 1, message: 'Must be at least 1 day' },
                  max: { value: 30, message: 'Cannot exceed 30 days' }
                })}
                type="number"
                min="1"
                max="30"
                className={`input ${errors.additional_days ? 'border-red-500' : ''}`}
              />
              {errors.additional_days && (
                <p className="mt-1 text-sm text-red-600">{errors.additional_days.message}</p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn btn-secondary btn-md">
                Cancel
              </button>
              <button type="submit" disabled={isLoading} className="btn btn-primary btn-md">
                {isLoading ? <LoadingSpinner size="sm" /> : 'Extend Trial'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Convert Trial Modal
const ConvertTrialModal = ({ onClose, onSubmit, isLoading }) => {
  const { register, handleSubmit, formState: { errors } } = useForm()

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-md px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Convert to Paid</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method ID
              </label>
              <input
                {...register('payment_method_id', { required: 'Payment method ID is required' })}
                type="text"
                placeholder="pm_1234567890abcdef"
                className={`input ${errors.payment_method_id ? 'border-red-500' : ''}`}
              />
              {errors.payment_method_id && (
                <p className="mt-1 text-sm text-red-600">{errors.payment_method_id.message}</p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Processor
              </label>
              <select {...register('payment_processor')} className="select">
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
                <option value="square">Square</option>
              </select>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn btn-secondary btn-md">
                Cancel
              </button>
              <button type="submit" disabled={isLoading} className="btn btn-success btn-md">
                {isLoading ? <LoadingSpinner size="sm" /> : 'Convert Trial'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Cancel Trial Modal
const CancelTrialModal = ({ onClose, onSubmit, isLoading }) => {
  const { register, handleSubmit } = useForm()

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-md px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Cancel Trial</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit((data) => onSubmit(data.reason))}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cancellation Reason (Optional)
              </label>
              <textarea
                {...register('reason')}
                rows={4}
                placeholder="Please let us know why you're cancelling..."
                className="input resize-none"
              />
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <div className="flex items-start">
                <AlertTriangle className="text-red-600 mt-0.5 mr-2" size={16} />
                <div className="text-sm text-red-800">
                  <p className="font-medium">This action cannot be undone</p>
                  <p>Your trial will be cancelled immediately and access will be revoked.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn btn-secondary btn-md">
                Keep Trial
              </button>
              <button type="submit" disabled={isLoading} className="btn btn-danger btn-md">
                {isLoading ? <LoadingSpinner size="sm" /> : 'Cancel Trial'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Trial History Modal
const TrialHistoryModal = ({ onClose }) => {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['trial-history'],
    queryFn: () => trialAPI.getTrialHistory(),
  })

  const history = historyData?.history || []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-3xl px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Trial History</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          {isLoading ? (
            <LoadingSpinner className="py-8" />
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No trial history found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((trial) => (
                <div key={trial.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {trial.plan_name || 'Professional'} Plan Trial
                      </h4>
                      <p className="text-sm text-gray-600">
                        {trial.trial_duration_days} days
                      </p>
                    </div>
                    <span className={`badge ${
                      trial.trial_outcome === 'converted' ? 'badge-blue' :
                      trial.trial_outcome === 'expired' ? 'badge-red' :
                      trial.trial_outcome === 'cancelled' ? 'badge-gray' :
                      'badge-green'
                    }`}>
                      {trial.trial_outcome || 'Active'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Started:</span>
                      <div className="font-medium">
                        {format(new Date(trial.trial_start_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Ended:</span>
                      <div className="font-medium">
                        {format(new Date(trial.trial_end_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    {trial.converted_at && (
                      <div>
                        <span className="text-gray-600">Converted:</span>
                        <div className="font-medium">
                          {format(new Date(trial.converted_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button onClick={onClose} className="btn btn-primary btn-md">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrganizationTrialManagement