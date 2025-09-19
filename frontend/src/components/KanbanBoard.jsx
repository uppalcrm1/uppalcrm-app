import React, { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
  SortableContext as SortableContextProvider
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  MoreVertical,
  Edit,
  Trash2,
  User,
  DollarSign,
  Calendar,
  Building,
  Mail,
  Phone,
  Plus
} from 'lucide-react'
import { format } from 'date-fns'

// Sortable Lead Card Component
const SortableLeadCard = ({ lead, users, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: 'lead',
      lead,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg border shadow-sm p-4 cursor-grab hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50 rotate-5 shadow-lg' : ''
      }`}
    >
      <LeadCard lead={lead} users={users} onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

// Individual Lead Card Component
const LeadCard = ({ lead, users, onEdit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false)

  const assignedUser = users.find(user => user.id === lead.assigned_to)
  const value = parseFloat(lead.value) || 0

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
          {lead.first_name} {lead.last_name}
        </h3>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(lead)
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(lead)
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Company */}
      {lead.company && (
        <div className="flex items-center gap-2 mb-2">
          <Building className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-600 truncate">{lead.company}</span>
        </div>
      )}

      {/* Contact Info */}
      <div className="space-y-1 mb-3">
        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-600 truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-600">{lead.phone}</span>
          </div>
        )}
      </div>

      {/* Value */}
      {value > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-3 h-3 text-green-600" />
          <span className="text-sm font-semibold text-green-600">
            ${value.toLocaleString()}
          </span>
        </div>
      )}

      {/* Assigned User */}
      {assignedUser && (
        <div className="flex items-center gap-2 mb-3">
          <User className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-600">
            {assignedUser.first_name} {assignedUser.last_name}
          </span>
        </div>
      )}

      {/* Created Date */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Calendar className="w-3 h-3" />
        <span>
          {format(new Date(lead.created_at), 'MMM d, yyyy')}
        </span>
      </div>
    </div>
  )
}

// Kanban Column Component
const KanbanColumn = ({ status, leads, users, onEdit, onDelete, totalValue, onAddLead }) => {
  const statusColors = {
    new: 'bg-blue-100 text-blue-800 border-blue-200',
    contacted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    qualified: 'bg-purple-100 text-purple-800 border-purple-200',
    proposal: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    negotiation: 'bg-pink-100 text-pink-800 border-pink-200',
    converted: 'bg-green-100 text-green-800 border-green-200',
    lost: 'bg-red-100 text-red-800 border-red-200',
  }

  return (
    <div className="flex flex-col h-full min-h-[500px] bg-gray-50 rounded-lg">
      {/* Column Header */}
      <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full border ${
                statusColors[status.value] || 'bg-gray-100 text-gray-800 border-gray-200'
              }`}
            >
              {status.label}
            </span>
            <span className="text-sm text-gray-600">
              {leads.length}
            </span>
          </div>

          <button
            onClick={() => onAddLead(status.value)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title={`Add lead to ${status.label}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {totalValue > 0 && (
          <div className="text-sm font-semibold text-green-600">
            ${totalValue.toLocaleString()}
          </div>
        )}
      </div>

      {/* Column Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        <SortableContext
          items={leads.map(lead => lead.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {leads.map((lead) => (
              <SortableLeadCard
                key={lead.id}
                lead={lead}
                users={users}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}

            {leads.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="mb-2">No leads yet</div>
                <button
                  onClick={() => onAddLead(status.value)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Add first lead
                </button>
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}

// Main Kanban Board Component
const KanbanBoard = ({
  leads,
  statuses,
  users,
  onStatusUpdate,
  onEditLead,
  onDeleteLead,
  loading
}) => {
  const [activeId, setActiveId] = useState(null)
  const [draggedLead, setDraggedLead] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event) => {
    const { active } = event
    setActiveId(active.id)

    // Find the dragged lead
    const lead = Object.values(leads).flat().find(l => l.id === active.id)
    setDraggedLead(lead)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event

    setActiveId(null)
    setDraggedLead(null)

    if (!over) return

    const leadId = active.id
    const overId = over.id

    // Find which status column the lead was dropped on
    let newStatus = null
    for (const status of statuses) {
      const statusLeads = leads[status.value] || []
      if (statusLeads.some(lead => lead.id === overId) || overId.includes(status.value)) {
        newStatus = status.value
        break
      }
    }

    // If dropped on a status column header or empty area
    if (!newStatus && over.data?.current?.type === 'column') {
      newStatus = over.data.current.status
    }

    // Extract status from overId if it contains status info
    if (!newStatus) {
      const statusMatch = statuses.find(s => overId.includes(s.value))
      if (statusMatch) {
        newStatus = statusMatch.value
      }
    }

    if (newStatus && onStatusUpdate) {
      await onStatusUpdate(leadId, newStatus)
    }
  }

  const handleAddLead = (status) => {
    // This would typically open a modal to add a new lead with the specified status
    console.log('Add lead with status:', status)
    // You can implement this based on your existing add lead functionality
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading kanban board...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 min-h-[600px]">
          {statuses.map((status) => {
            const statusLeads = leads[status.value] || []
            const totalValue = statusLeads.reduce((sum, lead) => sum + (parseFloat(lead.value) || 0), 0)

            return (
              <KanbanColumn
                key={status.value}
                status={status}
                leads={statusLeads}
                users={users}
                onEdit={onEditLead}
                onDelete={onDeleteLead}
                totalValue={totalValue}
                onAddLead={handleAddLead}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeId && draggedLead ? (
            <div className="bg-white rounded-lg border shadow-lg p-4 rotate-5 opacity-90">
              <LeadCard
                lead={draggedLead}
                users={users}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export default KanbanBoard