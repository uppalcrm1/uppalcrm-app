import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  MessageSquare,
  Phone,
  Video,
  FileText,
  HeadphonesIcon,
  ChevronDown,
  Edit,
  Trash2,
  Clock,
  ArrowUp,
  ArrowDown,
  User,
  Calendar
} from 'lucide-react'
import { contactsAPI } from '../services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import LoadingSpinner from './LoadingSpinner'
import InteractionForm from './InteractionForm'

const INTERACTION_TYPES = [
  { value: 'email', label: 'Email', icon: MessageSquare, color: 'blue' },
  { value: 'call', label: 'Call', icon: Phone, color: 'green' },
  { value: 'meeting', label: 'Meeting', icon: Video, color: 'purple' },
  { value: 'note', label: 'Note', icon: FileText, color: 'gray' },
  { value: 'support_ticket', label: 'Support Ticket', icon: HeadphonesIcon, color: 'orange' }
]

const DIRECTION_TYPES = [
  { value: 'inbound', label: 'Inbound', icon: ArrowDown, color: 'green' },
  { value: 'outbound', label: 'Outbound', icon: ArrowUp, color: 'blue' }
]

const ContactInteractions = ({ contactId }) => {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedInteraction, setSelectedInteraction] = useState(null)
  const [filters, setFilters] = useState({
    interaction_type: '',
    direction: '',
    page: 1,
    limit: 20
  })

  // Fetch interactions
  const { data: interactionsData, isLoading, error } = useQuery({
    queryKey: ['contactInteractions', contactId, filters],
    queryFn: () => contactsAPI.getInteractions(contactId, filters),
    enabled: !!contactId
  })

  // Fetch interaction stats
  const { data: statsData } = useQuery({
    queryKey: ['contactInteractionStats', contactId],
    queryFn: () => contactsAPI.getInteractionStats(contactId),
    enabled: !!contactId
  })

  // Create interaction mutation
  const createMutation = useMutation({
    mutationFn: (data) => contactsAPI.createInteraction(contactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contactInteractions', contactId])
      queryClient.invalidateQueries(['contactInteractionStats', contactId])
      toast.success('Interaction created successfully')
      setShowCreateModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create interaction')
    }
  })

  // Update interaction mutation
  const updateMutation = useMutation({
    mutationFn: ({ interactionId, data }) =>
      contactsAPI.updateInteraction(contactId, interactionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contactInteractions', contactId])
      queryClient.invalidateQueries(['contactInteractionStats', contactId])
      toast.success('Interaction updated successfully')
      setShowEditModal(false)
      setSelectedInteraction(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update interaction')
    }
  })

  // Delete interaction mutation
  const deleteMutation = useMutation({
    mutationFn: (interactionId) =>
      contactsAPI.deleteInteraction(contactId, interactionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['contactInteractions', contactId])
      queryClient.invalidateQueries(['contactInteractionStats', contactId])
      toast.success('Interaction deleted successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete interaction')
    }
  })

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  const getInteractionIcon = (type) => {
    const config = INTERACTION_TYPES.find(t => t.value === type)
    return config ? config.icon : FileText
  }

  const getInteractionColor = (type) => {
    const config = INTERACTION_TYPES.find(t => t.value === type)
    return config ? config.color : 'gray'
  }

  const getDirectionIcon = (direction) => {
    const config = DIRECTION_TYPES.find(d => d.value === direction)
    return config ? config.icon : ArrowUp
  }

  const getDirectionColor = (direction) => {
    const config = DIRECTION_TYPES.find(d => d.value === direction)
    return config ? config.color : 'gray'
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">Error loading interactions</div>
        <button
          onClick={() => queryClient.invalidateQueries(['contactInteractions', contactId])}
          className="btn btn-secondary btn-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  const interactions = interactionsData?.interactions || []
  const pagination = interactionsData?.pagination || {}
  const stats = statsData?.stats || {}

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total_interactions || 0}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-900">{stats.emails || 0}</div>
          <div className="text-sm text-blue-600">Emails</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-900">{stats.calls || 0}</div>
          <div className="text-sm text-green-600">Calls</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-900">{stats.meetings || 0}</div>
          <div className="text-sm text-purple-600">Meetings</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-900">{stats.support_tickets || 0}</div>
          <div className="text-sm text-orange-600">Support</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.notes || 0}</div>
          <div className="text-sm text-gray-600">Notes</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-3">
          {/* Type Filter */}
          <select
            value={filters.interaction_type}
            onChange={(e) => handleFilterChange('interaction_type', e.target.value)}
            className="select select-sm"
          >
            <option value="">All Types</option>
            {INTERACTION_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {/* Direction Filter */}
          <select
            value={filters.direction}
            onChange={(e) => handleFilterChange('direction', e.target.value)}
            className="select select-sm"
          >
            <option value="">All Directions</option>
            {DIRECTION_TYPES.map(direction => (
              <option key={direction.value} value={direction.value}>{direction.label}</option>
            ))}
          </select>

          {/* Clear Filters */}
          {(filters.interaction_type || filters.direction) && (
            <button
              onClick={() => setFilters({ ...filters, interaction_type: '', direction: '', page: 1 })}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear filters
            </button>
          )}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-sm"
        >
          <Plus size={16} className="mr-2" />
          Add Interaction
        </button>
      </div>

      {/* Interactions List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <LoadingSpinner size="lg" text="Loading interactions..." />
          </div>
        ) : interactions.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No interactions found</h3>
            <p className="text-gray-600 mb-6">
              {filters.interaction_type || filters.direction
                ? "Try adjusting your filters"
                : "Start tracking communication with this contact"
              }
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-md"
            >
              <Plus size={16} className="mr-2" />
              Add First Interaction
            </button>
          </div>
        ) : (
          interactions.map((interaction) => {
            const TypeIcon = getInteractionIcon(interaction.interaction_type)
            const DirectionIcon = getDirectionIcon(interaction.direction)

            return (
              <div key={interaction.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    {/* Type & Direction Icons */}
                    <div className="flex items-center space-x-2">
                      <div className={`p-2 bg-${getInteractionColor(interaction.interaction_type)}-100 rounded-lg`}>
                        <TypeIcon className={`h-5 w-5 text-${getInteractionColor(interaction.interaction_type)}-600`} />
                      </div>
                      <div className={`p-1 bg-${getDirectionColor(interaction.direction)}-100 rounded`}>
                        <DirectionIcon className={`h-3 w-3 text-${getDirectionColor(interaction.direction)}-600`} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900">
                          {interaction.subject || `${interaction.interaction_type.charAt(0).toUpperCase() + interaction.interaction_type.slice(1)} ${interaction.direction}`}
                        </h4>
                        <span className={`badge badge-sm badge-${getInteractionColor(interaction.interaction_type)}`}>
                          {interaction.interaction_type}
                        </span>
                        <span className={`badge badge-sm badge-${getDirectionColor(interaction.direction)}`}>
                          {interaction.direction}
                        </span>
                      </div>

                      {interaction.content && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                          {interaction.content}
                        </p>
                      )}

                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center">
                          <Calendar size={12} className="mr-1" />
                          {format(new Date(interaction.created_at), 'MMM d, yyyy h:mm a')}
                        </div>
                        {interaction.duration_minutes && (
                          <div className="flex items-center">
                            <Clock size={12} className="mr-1" />
                            {interaction.duration_minutes} min
                          </div>
                        )}
                        {interaction.created_by_user && (
                          <div className="flex items-center">
                            <User size={12} className="mr-1" />
                            {interaction.created_by_user.full_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedInteraction(interaction)
                        setShowEditModal(true)
                      }}
                      className="p-1 text-gray-600 hover:text-primary-600"
                      title="Edit interaction"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this interaction?')) {
                          deleteMutation.mutate(interaction.id)
                        }
                      }}
                      className="p-1 text-gray-600 hover:text-red-600"
                      title="Delete interaction"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} interactions
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
              className="btn btn-secondary btn-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-gray-600">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className="btn btn-secondary btn-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create Interaction Modal */}
      {showCreateModal && (
        <InteractionForm
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Interaction Modal */}
      {showEditModal && selectedInteraction && (
        <InteractionForm
          interaction={selectedInteraction}
          onClose={() => {
            setShowEditModal(false)
            setSelectedInteraction(null)
          }}
          onSubmit={(data) => updateMutation.mutate({
            interactionId: selectedInteraction.id,
            data
          })}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  )
}

export default ContactInteractions