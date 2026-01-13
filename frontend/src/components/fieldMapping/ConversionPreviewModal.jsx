import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, ArrowRightLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { leadsAPI } from '../../services/api'

const ConversionPreviewModal = ({ leadId, onClose, onConfirm }) => {
  // Fetch conversion preview
  const { data, isLoading, error } = useQuery({
    queryKey: ['conversion-preview', leadId],
    queryFn: () => leadsAPI.getConversionPreview(leadId),
    enabled: !!leadId
  })

  const preview = data?.preview

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Preview Lead Conversion
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
              <p className="text-gray-600">Loading conversion preview...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-gray-900 font-medium mb-2">Failed to load preview</p>
              <p className="text-gray-600 text-sm">{error.message}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Banner */}
              {preview?.usedFieldMappings ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-green-900 font-medium">Field Mappings Active</p>
                      <p className="text-green-700 text-sm mt-1">
                        {preview.mappings?.length || 0} field mapping(s) will be applied during conversion
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-900 font-medium">No Field Mappings Configured</p>
                      <p className="text-yellow-700 text-sm mt-1">
                        Direct field mapping will be used (standard fields only)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Field Mappings */}
              {preview?.mappings && preview.mappings.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-medium text-gray-900">Fields to be Mapped</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {preview.mappings.map((mapping, index) => (
                      <div key={index} className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 mb-1">
                              Source (Lead)
                            </p>
                            <div className="bg-gray-50 rounded px-3 py-2 border border-gray-200">
                              <p className="font-mono text-sm text-gray-900">
                                {mapping.source_field_name}
                              </p>
                              {mapping.source_value !== undefined && (
                                <p className="text-sm text-gray-600 mt-1">
                                  Value: <span className="font-medium">{mapping.source_value || '(empty)'}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex-shrink-0 pt-8">
                            <ArrowRightLeft className="w-5 h-5 text-gray-400" />
                          </div>

                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 mb-1">
                              Target ({mapping.target_entity_type})
                            </p>
                            <div className="bg-indigo-50 rounded px-3 py-2 border border-indigo-200">
                              <p className="font-mono text-sm text-indigo-900">
                                {mapping.target_field_name}
                              </p>
                              {mapping.transformed_value !== undefined && (
                                <p className="text-sm text-indigo-700 mt-1">
                                  Will be: <span className="font-medium">{mapping.transformed_value || '(empty)'}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {mapping.transformation_rule && (
                          <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                            <span className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200">
                              Transformation: {mapping.transformation_rule}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lead Info */}
              {preview?.lead && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Lead Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>{' '}
                      <span className="font-medium text-gray-900">
                        {preview.lead.first_name} {preview.lead.last_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>{' '}
                      <span className="font-medium text-gray-900">{preview.lead.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>{' '}
                      <span className="font-medium text-gray-900">{preview.lead.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>{' '}
                      <span className="font-medium text-gray-900">{preview.lead.status || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isLoading && !error && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Confirm & Convert
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConversionPreviewModal
