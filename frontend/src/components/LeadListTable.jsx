import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Edit,
  Trash2,
  Mail,
  Phone,
  Building,
  User,
  Calendar,
  DollarSign,
  Download,
  MessageSquare,
  X
} from 'lucide-react'
import LeadConversionButton from './LeadConversionButton'
import InlineEditCell from './InlineEditCell'
import TaskManager from './TaskManager'
import InteractionsTimeline from './InteractionsTimeline'
import DataTable from './shared/DataTable'
import api from '../services/api'
import { leadsAPI } from '../services/api'
import { formatDate } from '../utils/dateFormatter'

// Define system columns with metadata — ordered to match table rendering
const SYSTEM_COLUMN_DEFINITIONS = [
  { key: 'name', sortKey: 'first_name', label: 'Name', description: 'Contact name and title', required: true },
  { key: 'email', label: 'Email', description: 'Email address' },
  { key: 'company', label: 'Company', description: 'Company name' },
  { key: 'status', label: 'Status', description: 'Lead status' },
  { key: 'priority', label: 'Priority', description: 'Lead priority level' },
  { key: 'value', label: 'Value', description: 'Estimated value' },
  { key: 'assigned_to', label: 'Assigned To', description: 'Assigned team member' },
  { key: 'created_at', label: 'Created', description: 'Creation date' },
  { key: 'phone', label: 'Phone', description: 'Phone number' },
  { key: 'source', label: 'Source', description: 'Lead source' },
  { key: 'next_follow_up', label: 'Next Follow Up', description: 'Next follow up date' },
  { key: 'notes', label: 'Notes', description: 'Lead notes', sortable: false, cellClassName: 'px-3 py-1.5 max-w-xs' },
  { key: 'updated_at', label: 'Updated', description: 'Last update date' },
]

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = {
  name: true,
  email: true,
  company: true,
  status: true,
  priority: true,
  value: false,
  assigned_to: true,
  created_at: true
}

const LeadListTable = ({
  leads,
  pagination,
  onPaginationChange,
  onEditLead,
  onDeleteLead,
  onBulkAction,
  users,
  statuses,
  loading,
  sortConfig: externalSortConfig,
  onSort: externalOnSort
}) => {
  console.log('🟢 LeadListTable RENDER - BUILD TIMESTAMP: 2026-01-25-095000', { leadsCount: leads?.length, firstLead: leads?.[0] })
  const navigate = useNavigate()
  const [internalSortConfig, setInternalSortConfig] = useState({ key: 'created_at', direction: 'desc' })
  // Use external sort props if provided, otherwise fall back to internal state
  const sortConfig = externalSortConfig || internalSortConfig
  const [selectedLeads, setSelectedLeads] = useState([])
  const [fieldLabels, setFieldLabels] = useState({})
  const [columnDefinitions, setColumnDefinitions] = useState(SYSTEM_COLUMN_DEFINITIONS)
  const [showInteractions, setShowInteractions] = useState(null)
  const [activeActivityTab, setActiveActivityTab] = useState('tasks')

  // Load column visibility from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('leads_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  })

  // Local state for leads to enable optimistic updates
  const [localLeads, setLocalLeads] = useState(leads)

  // Sync local leads with prop leads
  useEffect(() => {
    setLocalLeads(leads)
    if (leads && leads.length > 0) {
      console.log('🔴 LeadListTable: Leads data received', {
        totalLeads: leads.length,
        firstLead: leads[0],
        fieldNames: Object.keys(leads[0] || {})
      })
    }
  }, [leads])

  // Fetch field configuration to get dynamic column labels AND build column definitions
  useEffect(() => {
    const loadFieldConfiguration = async () => {
      try {
        const response = await api.get('/custom-fields?entity_type=leads')

        const allFields = [
          ...(response.data.systemFields || []),
          ...(response.data.customFields || [])
        ]

        const labelMap = {}
        allFields.forEach(field => {
          labelMap[field.field_name] = field.field_label
        })

        setFieldLabels(labelMap)
        console.log('📋 Field labels loaded for leads:', labelMap)

        // Update system column labels from field config
        const updatedSystemColumns = SYSTEM_COLUMN_DEFINITIONS.map(col => {
          const fieldKey = col.sortKey || col.key
          return {
            ...col,
            label: labelMap[fieldKey] || labelMap[col.key] || col.label
          }
        })

        // Build dynamic column definitions with custom fields
        const customFieldColumns = (response.data.customFields || [])
          .filter(f => f.is_enabled && (f.show_in_list_view !== false))
          .map(field => ({
            key: field.field_name,
            label: field.field_label,
            description: field.field_description || `Custom ${field.field_type} field`,
            required: false,
            isCustom: true,
            editable: true,
            fieldType: field.field_type,
            fieldOptions: field.field_options
          }))

        const allColumns = [...updatedSystemColumns, ...customFieldColumns]
        setColumnDefinitions(allColumns)
        console.log('📋 Column definitions updated:', allColumns.length, 'total columns')
        console.log('   - System columns:', SYSTEM_COLUMN_DEFINITIONS.length)
        console.log('   - Custom columns:', customFieldColumns.length)
      } catch (error) {
        console.error('❌ Error loading field configuration:', error)
        setFieldLabels({})
        setColumnDefinitions(SYSTEM_COLUMN_DEFINITIONS)
      }
    }

    loadFieldConfiguration()
  }, [])

  // Sort leads based on current sort configuration
  const sortedLeads = useMemo(() => {
    if (!localLeads) return []

    const sortableLeads = [...localLeads]
    sortableLeads.sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })

    return sortableLeads
  }, [localLeads, sortConfig])

  const handleSort = (key) => {
    if (externalOnSort) {
      // Delegate to parent (LeadViews) which manages URL params
      externalOnSort(key)
    } else {
      // Internal sort (fallback)
      let direction = 'asc'
      if (internalSortConfig.key === key && internalSortConfig.direction === 'asc') {
        direction = 'desc'
      }
      setInternalSortConfig({ key, direction })
    }
  }

  const handleBulkDelete = () => {
    if (selectedLeads.length > 0 && onBulkAction) {
      onBulkAction(selectedLeads, 'delete')
      setSelectedLeads([])
    }
  }

  const handleBulkExport = () => {
    if (selectedLeads.length > 0 && onBulkAction) {
      onBulkAction(selectedLeads, 'export')
    }
  }

  // Column visibility handlers
  const handleColumnToggle = (columnKey) => {
    const newVisibleColumns = {
      ...visibleColumns,
      [columnKey]: !visibleColumns[columnKey]
    }
    setVisibleColumns(newVisibleColumns)
    localStorage.setItem('leads_visible_columns', JSON.stringify(newVisibleColumns))
    console.log('📋 Column visibility updated:', newVisibleColumns)
  }

  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    localStorage.setItem('leads_visible_columns', JSON.stringify(DEFAULT_VISIBLE_COLUMNS))
    console.log('📋 Columns reset to defaults')
  }

  // Inline edit handler with optimistic updates
  const handleFieldUpdate = async (recordId, fieldName, newValue, isCustomField = false) => {
    console.log(`📝 Updating lead ${recordId}: ${fieldName} = ${newValue}${isCustomField ? ' (custom field)' : ''}`)

    // Check if this is a custom field by looking at columnDefinitions
    const isCustom = isCustomField || columnDefinitions.some(col => col.key === fieldName && col.isCustom)

    // Optimistic update: immediately update local state
    setLocalLeads(prevLeads =>
      prevLeads.map(lead => {
        if (lead.id !== recordId) return lead

        if (isCustom) {
          return {
            ...lead,
            custom_fields: {
              ...lead.custom_fields,
              [fieldName]: newValue
            }
          }
        } else {
          return { ...lead, [fieldName]: newValue }
        }
      })
    )

    // Save to server
    try {
      const invalidFields = ['address', 'city', 'state', 'postal_code'];

      if (invalidFields.includes(fieldName)) {
        console.warn(`⚠️ Field "${fieldName}" is not supported in leads table, skipping update`);
        return;
      }

      if (isCustom) {
        const currentLead = localLeads.find(l => l.id === recordId)
        await leadsAPI.updateLead(recordId, {
          custom_fields: {
            ...(currentLead?.custom_fields || {}),
            [fieldName]: newValue
          }
        })
      } else {
        await leadsAPI.updateLead(recordId, { [fieldName]: newValue })
      }
      console.log(`✅ Successfully updated lead ${recordId}`)
    } catch (error) {
      console.error(`❌ Failed to update lead ${recordId}:`, error)
      throw error
    }
  }

  const getStatusColor = (status) => {
    const statusColors = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      qualified: 'bg-purple-100 text-purple-800',
      proposal: 'bg-indigo-100 text-indigo-800',
      negotiation: 'bg-pink-100 text-pink-800',
      converted: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800',
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority) => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    }
    return priorityColors[priority] || 'bg-gray-100 text-gray-800'
  }

  // Render cell content based on column definition (leads-specific rendering)
  const renderCell = (row, column) => {
    switch (column.key) {
      case 'name':
        return (
          <div>
            <button
              onClick={() => navigate(`/leads/${row.id}`)}
              className="text-sm font-medium text-blue-600 hover:text-blue-900 hover:underline cursor-pointer text-left block"
            >
              {row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—'}
            </button>
            {row.title && (
              <div className="text-xs text-gray-500 mt-0.5">{row.title}</div>
            )}
          </div>
        )

      case 'email':
        return (
          <InlineEditCell
            value={row.email}
            fieldName="email"
            fieldType="email"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            placeholder="Add email..."
            icon={<Mail className="w-3 h-3" />}
            className="text-sm"
          />
        )

      case 'company':
        return (
          <InlineEditCell
            value={row.company}
            fieldName="company"
            fieldType="text"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            placeholder="Add company..."
            icon={<Building className="w-3 h-3 text-gray-400" />}
          />
        )

      case 'status':
        return (
          <InlineEditCell
            value={row.status}
            fieldName="status"
            fieldType="select"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            options={statuses}
            displayValue={
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                  row.status
                )}`}
              >
                {statuses.find(s => s.value === row.status)?.label || row.status}
              </span>
            }
          />
        )

      case 'priority':
        return (
          <InlineEditCell
            value={row.priority}
            fieldName="priority"
            fieldType="select"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }
            ]}
            displayValue={
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(
                  row.priority
                )}`}
              >
                {row.priority}
              </span>
            }
          />
        )

      case 'value':
        return (
          <InlineEditCell
            value={row.value}
            fieldName="value"
            fieldType="number"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            placeholder="Add value..."
            prefix="$"
            icon={<DollarSign className="w-3 h-3 text-green-600" />}
            className="text-sm font-semibold text-green-600"
          />
        )

      case 'assigned_to':
        return (
          <InlineEditCell
            value={row.assigned_to}
            fieldName="assigned_to"
            fieldType="user-select"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            users={users}
            icon={<User className="w-3 h-3" />}
            className="text-sm"
          />
        )

      case 'created_at':
        return (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Calendar className="w-3 h-3" />
            {formatDate(row.created_at)}
          </div>
        )

      case 'phone':
        return (
          <InlineEditCell
            value={row.phone}
            fieldName="phone"
            fieldType="text"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            placeholder="Add phone..."
            icon={<Phone className="w-3 h-3 text-gray-400" />}
            className="text-sm"
          />
        )

      case 'source':
        return (
          <InlineEditCell
            value={row.source}
            fieldName="source"
            fieldType="select"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            options={[
              { value: 'website', label: 'Website' },
              { value: 'referral', label: 'Referral' },
              { value: 'social', label: 'Social Media' },
              { value: 'cold-call', label: 'Cold Call' },
              { value: 'email', label: 'Email' },
              { value: 'advertisement', label: 'Advertisement' },
              { value: 'trade-show', label: 'Trade Show' },
              { value: 'other', label: 'Other' }
            ]}
            className="text-sm"
          />
        )

      case 'next_follow_up':
        return (
          <InlineEditCell
            value={row.next_follow_up}
            fieldName="next_follow_up"
            fieldType="date"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            placeholder="Set date..."
            icon={<Calendar className="w-3 h-3 text-blue-600" />}
            className="text-sm"
          />
        )

      case 'notes':
        return (
          <InlineEditCell
            value={row.notes}
            fieldName="notes"
            fieldType="textarea"
            recordId={row.id}
            entityType="leads"
            onSave={handleFieldUpdate}
            placeholder="Add notes..."
            className="text-sm text-gray-600 truncate"
          />
        )

      case 'updated_at':
        return (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Calendar className="w-3 h-3" />
            {formatDate(row.updated_at)}
          </div>
        )

      default:
        return <span className="text-sm text-gray-600">—</span>
    }
  }

  // Render row action buttons (leads-specific)
  const renderRowActions = (row) => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          setShowInteractions(row.id)
          setActiveActivityTab('tasks')
        }}
        className="text-purple-600 hover:text-purple-900"
        title="Tasks & Activities"
      >
        <MessageSquare className="w-4 h-4" />
      </button>
      <LeadConversionButton
        lead={row}
        variant="icon"
        onSuccess={() => {
          // Refresh data will be handled by the component's query invalidation
        }}
      />
      <button
        onClick={() => onEditLead(row)}
        className="text-blue-600 hover:text-blue-900"
        title="Edit lead"
      >
        <Edit className="w-4 h-4" />
      </button>
      <button
        onClick={() => onDeleteLead(row)}
        className="text-red-600 hover:text-red-900"
        title="Delete lead"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )

  return (
    <>
      <DataTable
        data={sortedLeads}
        loading={loading}
        entityName="Lead"
        entityType="leads"
        columns={columnDefinitions}
        visibleColumns={visibleColumns}
        onColumnToggle={handleColumnToggle}
        onColumnsReset={handleResetColumns}
        sortConfig={sortConfig}
        onSort={handleSort}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        pageSizeOptions={[10, 20, 50, 100]}
        selectable
        selectedIds={selectedLeads}
        onSelectionChange={setSelectedLeads}
        bulkActions={[
          { label: 'Export', icon: Download, onClick: handleBulkExport },
          { label: 'Delete', icon: Trash2, onClick: handleBulkDelete, variant: 'danger' },
        ]}
        renderCell={renderCell}
        renderRowActions={renderRowActions}
        onInlineEdit={handleFieldUpdate}
        emptyMessage="No leads found"
        emptySubMessage="Try adjusting your filters or add your first lead"
      />

      {/* Activities Modal (Tasks & Interactions) */}
      {showInteractions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">Lead Activities</h2>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                  v3.0 TASKS
                </span>
              </div>
              <button
                onClick={() => setShowInteractions(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
              <button
                onClick={() => setActiveActivityTab('tasks')}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeActivityTab === 'tasks'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Tasks & Follow-ups
              </button>
              <button
                onClick={() => setActiveActivityTab('interactions')}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeActivityTab === 'interactions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                All Interactions
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeActivityTab === 'tasks' && (
                <TaskManager leadId={showInteractions} />
              )}
              {activeActivityTab === 'interactions' && (
                <InteractionsTimeline leadId={showInteractions} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default LeadListTable