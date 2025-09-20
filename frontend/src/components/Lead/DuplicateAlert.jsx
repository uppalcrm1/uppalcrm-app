import React, { useState } from 'react'
import {
  AlertTriangle,
  X,
  Eye,
  Users,
  Mail,
  Phone,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const DuplicateAlert = ({ duplicates, leadId }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const navigate = useNavigate()

  if (isDismissed || !duplicates || duplicates.length === 0) {
    return null
  }

  const highestSimilarity = Math.max(...duplicates.map(d => d.similarity_score))
  const totalDuplicates = duplicates.length

  const getSimilarityColor = (score) => {
    if (score >= 0.9) return 'text-red-600 bg-red-100'
    if (score >= 0.7) return 'text-orange-600 bg-orange-100'
    return 'text-yellow-600 bg-yellow-100'
  }

  const getSimilarityLabel = (score) => {
    if (score >= 0.9) return 'Very High'
    if (score >= 0.7) return 'High'
    return 'Medium'
  }

  const formatDuplicateFields = (fields) => {
    if (!fields || fields.length === 0) return []
    try {
      // Handle both array and string formats
      const fieldArray = Array.isArray(fields) ? fields : JSON.parse(fields)
      return fieldArray.filter(field => field && field !== null)
    } catch {
      return []
    }
  }

  const getFieldIcon = (field) => {
    switch (field) {
      case 'email':
        return <Mail size={12} />
      case 'phone':
        return <Phone size={12} />
      case 'company':
        return <Building2 size={12} />
      case 'first_name':
      case 'last_name':
        return <Users size={12} />
      default:
        return null
    }
  }

  const handleViewDuplicate = (duplicate) => {
    navigate(`/leads/${duplicate.duplicate_lead_id}`)
  }

  return (
    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle size={20} className="text-orange-600" />
        </div>

        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-orange-800">
                Potential Duplicate{totalDuplicates > 1 ? 's' : ''} Detected
              </h3>
              <p className="mt-1 text-sm text-orange-700">
                Found {totalDuplicates} potential duplicate{totalDuplicates > 1 ? 's' : ''} with{' '}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSimilarityColor(highestSimilarity)}`}>
                  {getSimilarityLabel(highestSimilarity)} similarity
                </span>
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-orange-600 hover:text-orange-800"
              >
                {isExpanded ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>

              <button
                onClick={() => setIsDismissed(true)}
                className="text-orange-600 hover:text-orange-800"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Expanded Duplicate List */}
          {isExpanded && (
            <div className="mt-4 space-y-3">
              {duplicates.map((duplicate) => {
                const duplicateFields = formatDuplicateFields(duplicate.duplicate_fields)

                return (
                  <div
                    key={duplicate.id}
                    className="bg-white rounded-lg border border-orange-200 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {duplicate.first_name} {duplicate.last_name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {duplicate.company && `${duplicate.company} • `}
                            {duplicate.email}
                          </p>
                        </div>

                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSimilarityColor(duplicate.similarity_score)}`}>
                          {Math.round(duplicate.similarity_score * 100)}% match
                        </div>
                      </div>

                      <button
                        onClick={() => handleViewDuplicate(duplicate)}
                        className="inline-flex items-center text-xs text-primary-600 hover:text-primary-800"
                      >
                        <Eye size={12} className="mr-1" />
                        View Lead
                        <ExternalLink size={10} className="ml-1" />
                      </button>
                    </div>

                    {/* Matching Fields */}
                    {duplicateFields.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 mb-2">Matching fields:</p>
                        <div className="flex flex-wrap gap-1">
                          {duplicateFields.map((field, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800"
                            >
                              {getFieldIcon(field)}
                              <span className="ml-1 capitalize">{field.replace('_', ' ')}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lead Details */}
                    <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Email:</span> {duplicate.email}
                      </div>
                      {duplicate.phone && (
                        <div>
                          <span className="font-medium">Phone:</span> {duplicate.phone}
                        </div>
                      )}
                      {duplicate.company && (
                        <div>
                          <span className="font-medium">Company:</span> {duplicate.company}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Status:</span>{' '}
                        <span className="capitalize">{duplicate.status}</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-orange-200">
                <p className="text-xs text-orange-700">
                  Review these potential duplicates to ensure data quality.
                </p>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsDismissed(true)}
                    className="text-xs text-orange-600 hover:text-orange-800 underline"
                  >
                    Dismiss for now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Preview (when collapsed) */}
          {!isExpanded && totalDuplicates > 0 && (
            <div className="mt-2">
              <div className="flex items-center space-x-2 text-xs text-orange-700">
                <span>Similar leads:</span>
                <div className="flex space-x-1">
                  {duplicates.slice(0, 3).map((duplicate, index) => (
                    <span key={index} className="font-medium">
                      {duplicate.first_name} {duplicate.last_name}
                      {index < Math.min(duplicates.length - 1, 2) && ','}
                    </span>
                  ))}
                  {totalDuplicates > 3 && (
                    <span>and {totalDuplicates - 3} more</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DuplicateAlert