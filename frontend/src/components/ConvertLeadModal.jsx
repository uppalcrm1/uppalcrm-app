import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { X, Search, ArrowRightLeft, CheckCircle } from 'lucide-react'
import { leadsAPI, contactsAPI } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'

const ConvertLeadModal = ({ onClose, onSuccess }) => {
  const [selectedLead, setSelectedLead] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      type: 'customer',
      status: 'active'
    }
  })

  // Fetch leads
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', { search: searchTerm, status: 'qualified,new,contacted' }],
    queryFn: () => leadsAPI.getLeads({ 
      search: searchTerm, 
      limit: 50,
      status: searchTerm ? '' : 'qualified' // Show qualified leads by default, all if searching
    }),
  })

  // Convert lead mutation
  const convertMutation = useMutation({
    mutationFn: ({ leadId, additionalData }) => contactsAPI.convertFromLead(leadId, additionalData),
    onSuccess: (data) => {
      toast.success('Lead converted to contact successfully')
      onSuccess(data)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to convert lead')
    }
  })

  const handleConvert = (data) => {
    if (!selectedLead) {
      toast.error('Please select a lead to convert')
      return
    }

    convertMutation.mutate({
      leadId: selectedLead.id,
      additionalData: {
        type: data.type,
        status: data.status,
        additional_notes: data.additional_notes
      }
    })
  }

  const filteredLeads = leadsData?.leads || []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-4xl px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Convert Lead to Contact</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lead Selection */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Select Lead</h4>
              
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>

              {/* Lead List */}
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                {leadsLoading ? (
                  <div className="p-4 text-center">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {searchTerm ? 'No leads found matching your search' : 'No qualified leads available'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredLeads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 ${
                          selectedLead?.id === lead.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">{lead.full_name}</h5>
                            <p className="text-sm text-gray-600">{lead.company}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`badge badge-sm badge-${
                                lead.status === 'qualified' ? 'green' : 
                                lead.status === 'new' ? 'blue' : 'yellow'
                              }`}>
                                {lead.status}
                              </span>
                              {lead.value > 0 && (
                                <span className="text-xs text-gray-500">${lead.value.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                          {selectedLead?.id === lead.id && (
                            <CheckCircle className="text-primary-600" size={20} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Conversion Options */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Contact Details</h4>
              
              {selectedLead ? (
                <form onSubmit={handleSubmit(handleConvert)} className="space-y-4">
                  {/* Selected Lead Preview */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-medium text-gray-900 mb-2">Converting:</h5>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Name:</span> {selectedLead.full_name}</p>
                      {selectedLead.company && (
                        <p><span className="font-medium">Company:</span> {selectedLead.company}</p>
                      )}
                      {selectedLead.email && (
                        <p><span className="font-medium">Email:</span> {selectedLead.email}</p>
                      )}
                      {selectedLead.phone && (
                        <p><span className="font-medium">Phone:</span> {selectedLead.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Contact Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Type</label>
                    <select {...register('type')} className="select">
                      <option value="customer">Customer</option>
                      <option value="prospect">Prospect</option>
                      <option value="partner">Partner</option>
                      <option value="vendor">Vendor</option>
                    </select>
                  </div>

                  {/* Contact Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Status</label>
                    <select {...register('status')} className="select">
                      <option value="active">Active</option>
                      <option value="prospect">Prospect</option>
                      <option value="customer">Customer</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Additional Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                    <textarea
                      {...register('additional_notes')}
                      rows={3}
                      className="input resize-none"
                      placeholder="Any additional notes about this conversion..."
                    />
                  </div>

                  {/* Conversion Notice */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                      <ArrowRightLeft className="text-blue-600 mt-0.5 mr-2" size={16} />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Conversion Process:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• Lead will be marked as "converted"</li>
                          <li>• New contact will be created with lead data</li>
                          <li>• Lead notes and history will be preserved</li>
                          <li>• Assignment will be maintained</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn btn-secondary btn-md"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={convertMutation.isPending}
                      className="btn btn-primary btn-md"
                    >
                      {convertMutation.isPending ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <>
                          <ArrowRightLeft size={16} className="mr-2" />
                          Convert to Contact
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a lead from the list to configure conversion options</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConvertLeadModal