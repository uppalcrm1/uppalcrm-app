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

        // Keywords for color assignment (but don't filter them out)
        const negativeKeywords = ['lost', 'not qualified', 'cold', 'rejected', 'dead']

        const allStages = statusField.field_options.map((option, index) => {
          // Handle both string and {label, value} formats
          const value = typeof option === 'string' ? option.toLowerCase().replace(/\s+/g, '_') : option.value
          const label = typeof option === 'string' ? option : option.label

          // Special handling for specific statuses - assign appropriate colors
          let color = colors[index % colors.length]
          const labelLower = label.toLowerCase()

          if (value === 'converted' || labelLower.includes('converted')) {
            color = 'green'
          } else if (negativeKeywords.some(keyword => labelLower.includes(keyword))) {
            color = 'red'
          } else if (labelLower.includes('new')) {
            color = 'gray'
          }

          return {
            key: value,
            label: label,
            color: color,
            description: label
          }
        })

        // Show ALL stages from field configuration (no filtering)
        setStages(allStages)
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

  const handleStageClick = (stage, stageIndex) => {
    const currentIndex = getCurrentStageIndex()

    // Allow clicking on any stage (forward or backward movement)
    // Skip if trying to click on 'lost' or 'converted' as they have dedicated buttons
    if (stage.key !== 'lost' && stage.key !== 'converted') {
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

  // Get Salesforce-style pill button classes based on stage status
  const getSalesforcePillClasses = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white border-green-600 hover:bg-green-600'
      case 'current':
        return 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-md'
      case 'lost':
        return 'bg-red-500 text-white border-red-600'
      case 'future':
      default:
        return 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'
    }
  }

  return (
    <div className="w-full">
      {/* Compact Chevron Progress Bar */}
      <div className="relative">
        {/* Chevron Steps */}
        <div className="flex items-center -space-x-2">
          {stages.map((stage, index) => {
            const status = getStageStatus(index)
            const isClickable = stage.key !== 'lost' && stage.key !== 'converted'

            // Determine background color
            let bgColor = 'bg-gray-300 text-gray-700'
            if (status === 'completed') {
              bgColor = 'bg-gray-400 text-white'
            } else if (status === 'current') {
              bgColor = 'bg-green-500 text-white'
            }

            return (
              <button
                key={stage.key}
                onClick={() => handleStageClick(stage, index)}
                disabled={!isClickable}
                className={`
                  relative flex-1 h-10 px-3 flex items-center justify-center
                  font-medium text-xs transition-all duration-200
                  ${bgColor}
                  ${isClickable ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                  ${index === 0 ? 'rounded-l' : ''}
                  ${index === stages.length - 1 ? 'rounded-r' : ''}
                `}
                style={{
                  clipPath: index === stages.length - 1
                    ? 'polygon(10% 0%, 100% 0%, 100% 100%, 10% 100%, 0% 50%)'
                    : index === 0
                    ? 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%)'
                    : 'polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)',
                  minWidth: '100px'
                }}
                title={`${stage.label}${status === 'current' && timeInCurrentStage ? ` - ${formatTimeInStage(timeInCurrentStage)}` : ''}`}
              >
                <span className="truncate px-2">
                  {status === 'completed' && <Check size={12} className="inline mr-1" />}
                  {stage.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Quick Action Buttons (Compact) */}
        {currentStatus !== 'converted' && currentStatus !== 'lost' && (
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                setSelectedStatus('lost')
                setShowConfirmModal(true)
              }}
              className="text-xs px-3 py-1 text-red-600 hover:bg-red-50 rounded border border-red-300"
            >
              Mark Lost
            </button>
            <button
              onClick={() => {
                setSelectedStatus('converted')
                setShowConfirmModal(true)
              }}
              className="text-xs px-3 py-1 bg-green-600 text-white hover:bg-green-700 rounded"
            >
              Convert
            </button>
          </div>
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