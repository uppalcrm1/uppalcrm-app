import React, { useState, useEffect } from 'react'
import {
  Clock,
  User,
  Edit,
  ArrowRight,
  RotateCcw,
  UserCheck,
  DollarSign,
  Tag,
  Calendar,
  AlertCircle,
  Filter
} from 'lucide-react'
import api from '../../services/api'
import LoadingSpinner from '../LoadingSpinner'

const LeadHistoryPanel = ({ leadId }) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchHistory(1, true)
  }, [leadId, filter])

  const fetchHistory = async (pageNum = 1, reset = false) => {
    try {
      setLoading(pageNum === 1)

      const params = {
        page: pageNum,
        limit: 20,
        ...(filter !== 'all' && { type: filter })
      }

      const response = await api.get(`/leads/${leadId}/history`, { params })
      const { history: newHistory, pagination } = response.data

      if (reset) {
        setHistory(newHistory)
      } else {
        setHistory(prev => [...prev, ...newHistory])
      }

      setHasMore(pageNum < pagination.pages)
      setPage(pageNum)
      setError('')
    } catch (err) {
      console.error('Error fetching history:', err)
      setError('Failed to load change history')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchHistory(page + 1, false)
    }
  }

  const getChangeIcon = (changeType, fieldName) => {
    switch (changeType) {
      case 'creation':
        return <User size={16} className="text-green-600" />
      case 'status_change':
        return <RotateCcw size={16} className="text-blue-600" />
      case 'assignment':
        return <UserCheck size={16} className="text-purple-600" />
      default:
        switch (fieldName) {
          case 'lead_value':
            return <DollarSign size={16} className="text-yellow-600" />
          case 'priority':
            return <Tag size={16} className="text-orange-600" />
          default:
            return <Edit size={16} className="text-gray-600" />
        }
    }
  }

  const formatFieldName = (fieldName) => {
    const fieldLabels = {
      lead_value: 'Lead Value',
      first_name: 'First Name',
      last_name: 'Last Name',
      lead_source: 'Lead Source',
      assigned_to: 'Assigned To',
      created: 'Lead Created'
    }
    return fieldLabels[fieldName] || fieldName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatValue = (value, fieldName) => {
    if (!value) return 'None'

    switch (fieldName) {
      case 'lead_value':
        return isNaN(value) ? value : `$${parseFloat(value).toLocaleString()}`
      case 'assigned_to':
        // This would need user lookup in a real implementation
        return value
      default:
        return value
    }
  }

  const getChangeDescription = (change) => {
    const { change_type, field_name, old_value, new_value } = change

    switch (change_type) {
      case 'creation':
        return 'created this lead'
      case 'status_change':
        return `changed status from "${old_value || 'none'}" to "${new_value}"`
      case 'assignment':
        return `${old_value ? 'reassigned' : 'assigned'} this lead${old_value ? ` from ${old_value}` : ''} to ${new_value}`
      default:
        if (!old_value) {
          return `set ${formatFieldName(field_name)} to "${formatValue(new_value, field_name)}"`
        }
        return `changed ${formatFieldName(field_name)} from "${formatValue(old_value, field_name)}" to "${formatValue(new_value, field_name)}"`
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60))
      return `${diffInMinutes} minutes ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`
    } else if (diffInHours < 48) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString()
    }
  }

  const filterOptions = [
    { value: 'all', label: 'All Changes' },
    { value: 'status_change', label: 'Status Changes' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'field_update', label: 'Field Updates' },
    { value: 'creation', label: 'Creation' }
  ]

  if (loading && history.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <Filter size={16} className="text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="select flex-1 max-w-xs"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* History Timeline */}
      <div className="bg-white rounded-lg shadow">
        {history.length === 0 ? (
          <div className="p-8 text-center">
            <Clock size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No History Available</h3>
            <p className="text-gray-500">
              {filter !== 'all'
                ? 'No changes match your current filter.'
                : 'No changes have been made to this lead yet.'
              }
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="flow-root">
              <ul className="-mb-8">
                {history.map((change, index) => {
                  const isLast = index === history.length - 1

                  return (
                    <li key={change.id}>
                      <div className="relative pb-8">
                        {!isLast && (
                          <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" />
                        )}

                        <div className="relative flex items-start space-x-3">
                          {/* Change Icon */}
                          <div className="relative px-1">
                            <div className="h-10 w-10 bg-gray-50 rounded-full flex items-center justify-center ring-8 ring-white border border-gray-200">
                              {getChangeIcon(change.change_type, change.field_name)}
                            </div>
                          </div>

                          {/* Change Content */}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {change.changed_by_first_name} {change.changed_by_last_name}
                                <span className="font-normal text-gray-600 ml-1">
                                  {getChangeDescription(change)}
                                </span>
                              </div>
                            </div>

                            <div className="mt-1 text-sm text-gray-500">
                              <time dateTime={change.created_at}>
                                {formatDate(change.created_at)}
                              </time>
                              {change.change_reason && (
                                <span className="ml-2">
                                  • {change.change_reason}
                                </span>
                              )}
                            </div>

                            {/* Show old/new values for field updates */}
                            {change.change_type === 'field_update' && change.old_value && change.new_value && (
                              <div className="mt-2 text-xs bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center space-x-2">
                                  <span className="text-gray-500 line-through">
                                    {formatValue(change.old_value, change.field_name)}
                                  </span>
                                  <ArrowRight size={12} className="text-gray-400" />
                                  <span className="text-gray-900 font-medium">
                                    {formatValue(change.new_value, change.field_name)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Status change visualization */}
                            {change.change_type === 'status_change' && (
                              <div className="mt-2 flex items-center space-x-2 text-xs">
                                {change.old_value && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                                    {change.old_value}
                                  </span>
                                )}
                                <ArrowRight size={12} className="text-gray-400" />
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                  {change.new_value}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="btn btn-outline"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    'Load More History'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle size={16} className="text-red-400 mr-2 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadHistoryPanel