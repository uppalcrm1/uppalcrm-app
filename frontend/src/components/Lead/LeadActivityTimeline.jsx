import React, { useState, useEffect } from 'react'
import {
  Mail,
  Phone,
  Calendar,
  FileText,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import api from '../../services/api'
import LoadingSpinner from '../LoadingSpinner'

const LeadActivityTimeline = ({ leadId }) => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedActivities, setExpandedActivities] = useState(new Set())
  const [filters, setFilters] = useState({
    type: '',
    search: ''
  })
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    fetchActivities(1, true)
  }, [leadId, filters])

  const fetchActivities = async (pageNum = 1, reset = false) => {
    try {
      setLoading(pageNum === 1)

      const params = {
        page: pageNum,
        limit: 20,
        ...(filters.type && { type: filters.type }),
        ...(filters.search && { search: filters.search })
      }

      const response = await api.get(`/leads/${leadId}/activities`, { params })
      const { activities: newActivities, pagination } = response.data

      if (reset) {
        setActivities(newActivities)
      } else {
        setActivities(prev => [...prev, ...newActivities])
      }

      setHasMore(pageNum < pagination.pages)
      setPage(pageNum)
      setError('')
    } catch (err) {
      console.error('Error fetching activities:', err)
      setError('Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchActivities(page + 1, false)
    }
  }

  const toggleExpanded = (activityId) => {
    const newExpanded = new Set(expandedActivities)
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId)
    } else {
      newExpanded.add(activityId)
    }
    setExpandedActivities(newExpanded)
  }

  const getActivityIcon = (type, eventType) => {
    const iconProps = { size: 16, className: "text-white" }

    // For events, use specific icons based on event type
    if (eventType) {
      switch (eventType) {
        case 'created':
          return <Info {...iconProps} />
        case 'completed':
          return <CheckCircle {...iconProps} />
        case 'reassigned':
          return <User {...iconProps} />
        case 'priority_changed':
        case 'date_changed':
          return <AlertCircle {...iconProps} />
        case 'cancelled':
          return <AlertCircle {...iconProps} />
        default:
          return <Info {...iconProps} />
      }
    }

    // Fallback to interaction type
    switch (type) {
      case 'email':
        return <Mail {...iconProps} />
      case 'call':
        return <Phone {...iconProps} />
      case 'meeting':
        return <Calendar {...iconProps} />
      case 'note':
        return <FileText {...iconProps} />
      case 'task':
        return <CheckCircle {...iconProps} />
      default:
        return <Info {...iconProps} />
    }
  }

  const getActivityColor = (type, eventType) => {
    // For events, use specific colors based on event type
    if (eventType) {
      switch (eventType) {
        case 'created':
          return 'bg-blue-500'
        case 'completed':
          return 'bg-green-500'
        case 'reassigned':
          return 'bg-purple-500'
        case 'priority_changed':
          return 'bg-yellow-500'
        case 'date_changed':
          return 'bg-indigo-500'
        case 'cancelled':
          return 'bg-red-500'
        default:
          return 'bg-gray-400'
      }
    }

    // Fallback to interaction type
    switch (type) {
      case 'email':
        return 'bg-blue-500'
      case 'call':
        return 'bg-green-500'
      case 'meeting':
        return 'bg-purple-500'
      case 'note':
        return 'bg-gray-500'
      case 'task':
        return 'bg-orange-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return <AlertCircle size={14} className="text-red-500" />
      case 'medium':
        return <Info size={14} className="text-yellow-500" />
      case 'low':
        return <CheckCircle size={14} className="text-green-500" />
      default:
        return null
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

  const formatDuration = (minutes) => {
    if (!minutes) return ''
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  if (loading && activities.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 input"
              />
            </div>
          </div>

          <div className="sm:w-48">
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="select w-full"
            >
              <option value="">All Types</option>
              <option value="email">Emails</option>
              <option value="call">Calls</option>
              <option value="meeting">Meetings</option>
              <option value="note">Notes</option>
              <option value="task">Tasks</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow">
        {activities.length === 0 ? (
          <div className="p-8 text-center">
            <Clock size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Yet</h3>
            <p className="text-gray-500">
              {filters.type || filters.search
                ? 'No activities match your current filters.'
                : 'Start by adding an email, call, or meeting to track interactions with this lead.'
              }
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="flow-root">
              <ul className="-mb-8">
                {activities.map((activity, index) => {
                  // Support both event and legacy interaction structure
                  const activityId = activity.event_id || activity.id
                  const isExpanded = expandedActivities.has(activityId)
                  const isLast = index === activities.length - 1

                  // Determine who performed the action
                  const actorFirstName = activity.event_user_first_name || activity.created_by_first_name || activity.user_first_name
                  const actorLastName = activity.event_user_last_name || activity.created_by_last_name || activity.user_last_name

                  return (
                    <li key={activityId}>
                      <div className="relative pb-8">
                        {!isLast && (
                          <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" />
                        )}

                        <div className="relative flex items-start space-x-3">
                          {/* Activity Icon */}
                          <div className={`relative px-1`}>
                            <div className={`h-10 w-10 rounded-full ${getActivityColor(activity.interaction_type, activity.event_type)} flex items-center justify-center ring-8 ring-white`}>
                              {getActivityIcon(activity.interaction_type, activity.event_type)}
                            </div>
                          </div>

                          {/* Activity Content */}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-gray-500 mb-1">
                              <span className="font-medium text-gray-900">
                                {actorFirstName} {actorLastName}
                              </span>
                              {' '}
                              {/* Show event description if available, otherwise interaction type */}
                              {activity.event_description ? (
                                <span>{activity.event_description}</span>
                              ) : (
                                <span className="capitalize">{activity.interaction_type}</span>
                              )}
                              {activity.interaction_type === 'task' && activity.priority && (
                                <span className="ml-1">
                                  {activity.priority === 'high' ? '🔴' :
                                   activity.priority === 'medium' ? '🟠' : '⚪'}
                                </span>
                              )}
                              {' • '}
                              <time dateTime={activity.created_at}>
                                {formatDate(activity.created_at)}
                              </time>
                            </div>

                            {/* Event-specific details */}
                            {activity.event_type && (
                              <div className="text-xs text-gray-500 mb-2 flex flex-wrap items-center gap-2">
                                <span className="capitalize font-medium text-gray-700">
                                  {activity.event_type.replace('_', ' ')}
                                </span>
                                {activity.field_changed && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      {activity.old_value && activity.new_value && (
                                        <>
                                          Changed from <span className="font-medium">{activity.old_value}</span> to <span className="font-medium">{activity.new_value}</span>
                                        </>
                                      )}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Task-specific metadata line (for legacy non-event data) */}
                            {activity.interaction_type === 'task' && !activity.event_type && (
                              <div className="text-xs text-gray-500 mb-2 flex flex-wrap items-center gap-2">
                                {activity.created_by_first_name && (
                                  <span>
                                    Created by {activity.created_by_first_name} {activity.created_by_last_name}
                                  </span>
                                )}
                                {activity.user_first_name && (
                                  <>
                                    <span>•</span>
                                    <span>Assigned to {activity.user_first_name} {activity.user_last_name}</span>
                                  </>
                                )}
                                {activity.completed_at && (
                                  <>
                                    <span>•</span>
                                    <span>Completed {formatDate(activity.completed_at)}</span>
                                  </>
                                )}
                                {activity.priority && (
                                  <>
                                    <span>•</span>
                                    <span className={`capitalize font-medium ${
                                      activity.priority === 'high' ? 'text-red-600' :
                                      activity.priority === 'medium' ? 'text-orange-600' :
                                      'text-gray-600'
                                    }`}>
                                      {activity.priority} priority
                                    </span>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Non-task creator info (for legacy non-event data) */}
                            {activity.interaction_type !== 'task' && !activity.event_type && activity.created_by_first_name && (
                              <div className="text-xs text-gray-500 mb-2">
                                by {activity.created_by_first_name} {activity.created_by_last_name}
                              </div>
                            )}

                            <div className="bg-gray-50 rounded-lg p-4">
                              {/* Activity Header */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                                    {activity.subject}
                                  </h4>

                                  {/* Activity Meta */}
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-2">
                                    {activity.duration && (
                                      <span className="inline-flex items-center">
                                        <Clock size={12} className="mr-1" />
                                        {formatDuration(activity.duration)}
                                      </span>
                                    )}

                                    {activity.outcome && (
                                      <span className="inline-flex items-center">
                                        <CheckCircle size={12} className="mr-1" />
                                        {activity.outcome}
                                      </span>
                                    )}

                                    {activity.scheduled_at && (
                                      <span className="inline-flex items-center">
                                        <Calendar size={12} className="mr-1" />
                                        Scheduled: {new Date(activity.scheduled_at).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Expand/Collapse Button */}
                                {activity.description && (
                                  <button
                                    onClick={() => toggleExpanded(activity.id)}
                                    className="ml-4 p-1 text-gray-400 hover:text-gray-600"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp size={16} />
                                    ) : (
                                      <ChevronDown size={16} />
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* Activity Description */}
                              {activity.description && (
                                <div className={`${isExpanded ? 'block' : 'hidden'} mt-3 pt-3 border-t border-gray-200`}>
                                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {activity.description}
                                  </div>
                                </div>
                              )}

                              {/* Participants */}
                              {activity.participants && activity.participants.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="text-xs text-gray-500 mb-1">Participants:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {activity.participants.map((participant, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                                      >
                                        <User size={10} className="mr-1" />
                                        {participant}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Activity Metadata */}
                              {activity.activity_metadata && Object.keys(activity.activity_metadata).length > 0 && isExpanded && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="text-xs text-gray-500 mb-1">Additional Details:</div>
                                  <div className="text-xs text-gray-600">
                                    {Object.entries(activity.activity_metadata).map(([key, value]) => (
                                      <div key={key} className="flex justify-between">
                                        <span className="capitalize">{key.replace('_', ' ')}:</span>
                                        <span>{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
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
                    'Load More Activities'
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

export default LeadActivityTimeline