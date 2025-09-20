import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { contactsAPI } from '../services/api'
import toast from 'react-hot-toast'

const LeadConversionButton = ({
  lead,
  onSuccess = () => {},
  size = 'sm',
  variant = 'button', // 'button' or 'icon'
  disabled = false,
  className = ''
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const queryClient = useQueryClient()

  // Check if lead is already converted
  const isConverted = lead?.status === 'converted' || lead?.converted_to_contact_id

  // Convert lead mutation
  const convertMutation = useMutation({
    mutationFn: (leadId) => contactsAPI.convertFromLead(leadId, {
      type: 'customer',
      status: 'active'
    }),
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['leads'])
      queryClient.invalidateQueries(['contacts'])
      queryClient.invalidateQueries(['leadStats'])
      queryClient.invalidateQueries(['contactStats'])

      toast.success('Lead converted to contact successfully!')
      setShowConfirmModal(false)
      onSuccess(data)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to convert lead')
      console.error('Lead conversion error:', error)
    }
  })

  const handleConvert = () => {
    if (isConverted) return
    setShowConfirmModal(true)
  }

  const confirmConversion = () => {
    convertMutation.mutate(lead.id)
  }

  // If already converted, show status
  if (isConverted) {
    if (variant === 'icon') {
      return (
        <div className="flex items-center text-green-600" title="Already converted to contact">
          <CheckCircle size={16} />
        </div>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle size={12} className="mr-1" />
        Converted
      </span>
    )
  }

  // Render button or icon
  const buttonContent = (
    <>
      {convertMutation.isPending ? (
        <Loader2 size={variant === 'icon' ? 16 : 14} className="animate-spin" />
      ) : (
        <ArrowRightLeft size={variant === 'icon' ? 16 : 14} />
      )}
      {variant === 'button' && (
        <span className={convertMutation.isPending ? 'ml-2' : 'ml-1'}>
          {convertMutation.isPending ? 'Converting...' : 'Convert'}
        </span>
      )}
    </>
  )

  const buttonProps = {
    onClick: handleConvert,
    disabled: disabled || convertMutation.isPending,
    title: variant === 'icon' ? 'Convert to contact' : undefined,
    className: variant === 'icon'
      ? `p-1 text-gray-600 hover:text-primary-600 disabled:opacity-50 ${className}`
      : `btn ${size === 'sm' ? 'btn-sm' : 'btn-md'} bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 ${className}`
  }

  return (
    <>
      <button {...buttonProps}>
        {buttonContent}
      </button>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowConfirmModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block w-full max-w-md px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">
                    Convert Lead to Contact
                  </h3>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <p className="text-sm text-gray-600">
                  Are you sure you want to convert this lead to a contact?
                </p>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Lead Details:</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Name:</strong> {lead.first_name} {lead.last_name}</div>
                    {lead.email && <div><strong>Email:</strong> {lead.email}</div>}
                    {lead.company && <div><strong>Company:</strong> {lead.company}</div>}
                    {lead.phone && <div><strong>Phone:</strong> {lead.phone}</div>}
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">What will happen:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Lead will be marked as "converted"</li>
                    <li>• New contact will be created with all lead data</li>
                    <li>• Contact status will be set to "active"</li>
                    <li>• Contact type will be set to "customer"</li>
                  </ul>
                </div>

                {convertMutation.isError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          Conversion Failed
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                          {convertMutation.error?.response?.data?.message || 'An error occurred while converting the lead.'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={convertMutation.isPending}
                  className="btn btn-secondary btn-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmConversion}
                  disabled={convertMutation.isPending}
                  className="btn btn-primary btn-md"
                >
                  {convertMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft size={16} className="mr-2" />
                      Convert to Contact
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default LeadConversionButton