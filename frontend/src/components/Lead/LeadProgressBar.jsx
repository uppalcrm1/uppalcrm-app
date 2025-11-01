import React, { useState, useEffect } from 'react'
import { Check, Clock, ChevronRight } from 'lucide-react'
import { customFieldsAPI } from '../../services/api'

const LeadProgressBar = ({ currentStatus, onStatusChange, timeInCurrentStage }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch stages dynamically from Field Configuration
  useEffect(() => {
    fetchStagesFromConfig()
  }, [])

  const fetchStagesFromConfig = async () => {
    try {
      // Fetch fields for leads entity type
      const response = await customFieldsAPI.getFields('leads')
      const leadFields = response.customFields || []
      const systemFields = response.systemFields || []

      // Find the status field (could be in either custom or system fields)
      const statusField = [...systemFields, ...leadFields].find(
        field => field.field_name === 'status' || field.field_name === 'stage'
      )

      if (statusField && statusField.field_options) {
        // Convert field options to stages format
        const colors = ['gray', 'blue', 'purple', 'orange', 'pink', 'indigo', 'teal', 'cyan']

        // Filter out negative statuses that shouldn't be in the progress bar
        const negativeKeywords = ['lost', 'not qualified', 'cold', 'rejected', 'dead']

        const allStages = statusField.field_options.map((option, index) => {
          // Handle both string and {label, value} formats
          const value = typeof option === 'string' ? option.toLowerCase().replace(/\s+/g, '_') : option.value
          const label = typeof option === 'string' ? option : option.label

          // Special handling for specific statuses
          let color = colors[index % colors.length]
          const labelLower = label.toLowerCase()

          if (value === 'converted' || labelLower.includes('converted')) {
            color = 'green'
          } else if (negativeKeywords.some(keyword => labelLower.includes(keyword))) {
            color = 'red'
          } else if (labelLower.includes('new')) {
            color = 'gray'
          }

          // Check if this is a negative status
          const isNegative = negativeKeywords.some(keyword => labelLower.includes(keyword))

          return {
            key: value,
            label: label,
            color: color,
            description: label,
            isNegative: isNegative
          }
        })

        // Separate progressive stages from negative ones
        const progressiveStages = allStages.filter(stage => !stage.isNegative)

        setStages(progressiveStages)
      } else {
        // Fallback to default stages if config not found
        setStages(getDefaultStages())
      }
    } catch (error) {
      console.error('Error fetching field configuration:', error)
      // Use default stages on error
      setStages(getDefaultStages())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultStages = () => [
    { key: 'new', label: 'New', color: 'gray', description: 'Just created' },
    { key: 'contacted', label: 'Contacted', color: 'blue', description: 'Initial contact made' },
    { key: 'qualified', label: 'Qualified', color: 'purple', description: 'Meets criteria' },
    { key: 'proposal', label: 'Proposal', color: 'orange', description: 'Proposal sent' },
    { key: 'negotiation', label: 'Negotiation', color: 'pink', description: 'In negotiation' },
    { key: 'converted', label: 'Converted', color: 'green', description: 'Successfully converted' }
  ]

  // Add lost as a separate status (can be reached from any stage)
  const lostStatus = {
    key: 'lost',
    label: 'Lost',
    color: 'red',
    description: 'Opportunity lost'
  }

  if (loading) {
    return (
      <div className="w-full py-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const getCurrentStageIndex = () => {
    return stages.findIndex(stage => stage.key === currentStatus)
  }

  const getStageStatus = (stageIndex) => {
    const currentIndex = getCurrentStageIndex()

    if (currentStatus === 'lost') {
      return 'lost'
    }

    if (currentStatus === 'converted') {
      return stageIndex <= stages.length - 1 ? 'completed' : 'future'
    }

    if (stageIndex < currentIndex) {
      return 'completed'
    } else if (stageIndex === currentIndex) {
      return 'current'
    } else {
      return 'future'
    }
  }

  const getStageColorClasses = (status, color) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white border-green-500'
      case 'current':
        return `bg-${color}-500 text-white border-${color}-500`
      case 'lost':
        return 'bg-red-500 text-white border-red-500'
      case 'future':
      default:
        return 'bg-gray-200 text-gray-500 border-gray-300'
    }
  }

  const getConnectorClasses = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'current':
        return 'bg-gray-300'
      case 'future':
      default:
        return 'bg-gray-300'
    }
  }

  const handleStageClick = (stage, stageIndex) => {
    const currentIndex = getCurrentStageIndex()

    // Allow clicking on current stage or next stage only
    if (stageIndex === currentIndex + 1 || stageIndex === currentIndex || currentStatus === 'new') {
      setSelectedStatus(stage.key)
      setShowConfirmModal(true)
    }
  }

  const handleConfirmStatusChange = () => {
    if (selectedStatus && onStatusChange) {
      // Special handling for 'converted' status - this should trigger actual lead conversion
      if (selectedStatus === 'converted') {
        onStatusChange('converted', 'Converting lead to contact...', true) // Pass true to indicate conversion
      } else {
        onStatusChange(selectedStatus, `Status changed to ${selectedStatus}`)
      }
    }
    setShowConfirmModal(false)
    setSelectedStatus(null)
  }

  const formatTimeInStage = (timeString) => {
    if (!timeString) return ''

    // Parse PostgreSQL interval format
    const match = timeString.match(/(\d+)\s*days?\s*(\d+):(\d+):(\d+)/)
    if (match) {
      const [, days, hours, minutes] = match
      if (parseInt(days) > 0) {
        return `${days} days`
      } else if (parseInt(hours) > 0) {
        return `${hours} hours`
      } else {
        return `${minutes} minutes`
      }
    }
    return timeString
  }

  return (
    <div className="w-full">
      {/* Progress Bar */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => {
            const status = getStageStatus(index)
            const isClickable = index === getCurrentStageIndex() + 1 || index === getCurrentStageIndex() || currentStatus === 'new'

            return (
              <div key={stage.key} className="flex items-center flex-1">
                {/* Stage Circle */}
                <div className="relative flex items-center">
                  <button
                    onClick={() => handleStageClick(stage, index)}
                    disabled={!isClickable}
                    className={`
                      w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium
                      transition-all duration-200 relative z-10
                      ${getStageColorClasses(status, stage.color)}
                      ${isClickable ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'cursor-default'}
                      ${status === 'current' ? 'ring-4 ring-opacity-20 ring-' + stage.color + '-500' : ''}
                    `}
                    title={stage.description}
                  >
                    {status === 'completed' ? (
                      <Check size={16} />
                    ) : status === 'current' ? (
                      <Clock size={16} />
                    ) : (
                      index + 1
                    )}
                  </button>

                  {/* Stage Label */}
                  <div className="absolute top-12 left-1/2 transform -translate-x-1/2 text-center">
                    <div className={`text-xs font-medium ${
                      status === 'current' ? `text-${stage.color}-600` :
                      status === 'completed' ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {stage.label}
                    </div>
                    {status === 'current' && timeInCurrentStage && (
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimeInStage(timeInCurrentStage)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector Line */}
                {index < stages.length - 1 && (
                  <div className={`
                    flex-1 h-1 mx-2 rounded
                    ${getConnectorClasses(getStageStatus(index))}
                  `} />
                )}
              </div>
            )
          })}
        </div>

        {/* Lost Status */}
        {currentStatus === 'lost' && (
          <div className="mt-4 flex justify-center">
            <div className="flex items-center">
              <div className={`
                w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium
                ${getStageColorClasses('lost', 'red')}
              `}>
                ✕
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-red-600">{lostStatus.label}</div>
                <div className="text-xs text-gray-500">{lostStatus.description}</div>
              </div>
            </div>
          </div>
        )}

        {/* Converted Status Indicator */}
        {currentStatus === 'converted' && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <Check size={16} className="mr-2" />
              Lead Successfully Converted
            </div>
          </div>
        )}
      </div>

      {/* Status Change Actions */}
      <div className="mt-6 flex justify-center space-x-2">
        {currentStatus !== 'converted' && currentStatus !== 'lost' && (
          <>
            <button
              onClick={() => {
                setSelectedStatus('lost')
                setShowConfirmModal(true)
              }}
              className="btn btn-outline btn-sm text-red-600 border-red-300 hover:bg-red-50"
            >
              Mark as Lost
            </button>

            {currentStatus !== stages[stages.length - 1].key && (
              <button
                onClick={() => {
                  setSelectedStatus('converted')
                  setShowConfirmModal(true)
                }}
                className="btn btn-primary btn-sm"
              >
                Mark as Converted
              </button>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Confirm Status Change
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to change the lead status to{' '}
                        <span className="font-medium capitalize">{selectedStatus}</span>?
                        {selectedStatus === 'lost' && ' This action will mark the lead as lost.'}
                        {selectedStatus === 'converted' && ' This will convert the lead to a customer.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleConfirmStatusChange}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false)
                    setSelectedStatus(null)
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadProgressBar