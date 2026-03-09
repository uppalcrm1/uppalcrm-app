import React, { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Table,
  Kanban,
  Search,
  Filter,
  ChevronDown,
  Plus,
  Download,
  RefreshCw,
  Users,
  UserPlus,
  UserCheck,
  UserX
} from 'lucide-react'
import { leadsAPI, usersAPI, customFieldsAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import KanbanBoard from '../components/KanbanBoard'
import LeadListTable from '../components/LeadListTable'
import ViewToggle from '../components/ViewToggle'
import LeadFilters from '../components/LeadFilters'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import toast from 'react-hot-toast'

const LeadViews = ({ onAddLead, onEditLead, onDeleteLead }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState(searchParams.get('view') || 'list')
  const [statuses, setStatuses] = useState([]) // Fetch from API instead of hardcoded
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    assigned_to: searchParams.get('assigned_to') || '',
    source: searchParams.get('source') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    valueMin: searchParams.get('valueMin') || '',
    valueMax: searchParams.get('valueMax') || ''
  })
  const [pagination, setPagination] = useState({
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 20
  })

  // Sort config: derived from URL params for list view
  const sortConfig = {
    key: searchParams.get('sort') || 'created_at',
    direction: searchParams.get('order') || 'desc'
  }

  // Debounce the search filter to prevent API calls on every keystroke
  // Other filters (status, priority, etc.) are not debounced
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  // Create debounced filters by merging debounced search with other filters
  const debouncedFilters = React.useMemo(
    () => ({
      ...filters,
      search: debouncedSearch
    }),
    [filters, debouncedSearch]
  )

  // Fetch leads with filters and pagination
  const {
    data: leadsData,
    isLoading: leadsLoading,
    error: leadsError,
    refetch: refetchLeads
  } = useQuery({
    queryKey: ['leads', debouncedFilters, pagination, view],  // ← Use debounced filters
    queryFn: async () => {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      }

      // Add debounced filters
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value) params[key] = value
      })

      if (view === 'kanban') {
        // For kanban view, get leads grouped by status
        return await leadsAPI.getLeadsByStatus(params)
      } else {
        // For list view, get paginated leads
        return await leadsAPI.getLeads(params)
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000 // 10 minutes
  })

  // Fetch statuses from form config (same as add/edit forms)
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const formConfig = await customFieldsAPI.getFormConfig()

        // Extract status field from system fields
        const statusField = formConfig.systemFields?.find(f => f.field_name === 'status')
        if (statusField && statusField.field_options) {
          // Convert field options to status format for dropdown
          const statusOptions = statusField.field_options.map(opt => ({
            value: typeof opt === 'string' ? opt : opt.value,
            label: typeof opt === 'string' ? opt : opt.label,
            color: 'blue' // Color will be handled by component
          }))
          setStatuses(statusOptions)
          console.log('✅ Loaded custom statuses:', statusOptions)
        }
      } catch (error) {
        console.error('❌ Failed to load statuses:', error)
        setStatuses([]) // Empty array if fetch fails
      }
    }

    loadStatuses()
  }, [])

  // Fetch users for assignment filter
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getUsers(),
    staleTime: 10 * 60 * 1000 // 10 minutes
  })

  // Fetch lead stats
  const { data: leadStatsData } = useQuery({
    queryKey: ['leadStats'],
    queryFn: () => leadsAPI.getStats(),
    staleTime: 30000
  })

  const leadStats = {
    total: leadStatsData?.stats?.total_leads || leadsData?.pagination?.total || 0,
    newLeads: leadStatsData?.stats?.new_leads || 0,
    converted: leadStatsData?.stats?.converted_leads || 0,
    unassigned: (leadStatsData?.stats?.total_leads || 0) - (leadStatsData?.stats?.assigned_leads || 0),
  }

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('view', view)

    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    // Sort params (only include non-defaults)
    if (sortConfig.key !== 'created_at') params.set('sort', sortConfig.key)
    if (sortConfig.direction !== 'desc') params.set('order', sortConfig.direction)

    if (pagination.page !== 1) params.set('page', pagination.page.toString())
    if (pagination.limit !== 20) params.set('limit', pagination.limit.toString())

    setSearchParams(params, { replace: true })
  }, [view, filters, pagination, sortConfig.key, sortConfig.direction, setSearchParams])

  const handleViewChange = useCallback((newView) => {
    setView(newView)
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page when changing views
  }, [])

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters)
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page when filters change
  }, [])

  const handlePaginationChange = useCallback((newPagination) => {
    setPagination(newPagination)
  }, [])

  // Sort handler for list view — updates URL params
  const handleSortChange = useCallback((key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    // Update URL directly — the useEffect will sync to searchParams
    const params = new URLSearchParams(searchParams)
    params.set('sort', key)
    params.set('order', direction)
    params.set('page', '1')
    setSearchParams(params, { replace: true })
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [sortConfig, searchParams, setSearchParams])

  const handleStatusUpdate = useCallback(async (leadId, newStatus) => {
    try {
      await leadsAPI.updateLeadStatus(leadId, newStatus)
      toast.success('Lead status updated successfully')
      refetchLeads()
    } catch (error) {
      console.error('Error updating lead status:', error)
      toast.error('Failed to update lead status')
    }
  }, [refetchLeads])

  const handleBulkAction = useCallback(async (leadIds, action, data) => {
    try {
      switch (action) {
        case 'update':
          await leadsAPI.bulkUpdateLeads(leadIds, data)
          toast.success(`${leadIds.length} leads updated successfully`)
          break
        case 'delete':
          await Promise.all(leadIds.map(id => leadsAPI.deleteLead(id)))
          toast.success(`${leadIds.length} leads deleted successfully`)
          break
        case 'export':
          const exportData = await leadsAPI.exportLeads({ ...filters, leadIds })
          // Handle export download
          const blob = new Blob([exportData], { type: 'text/csv' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
          toast.success('Leads exported successfully')
          break
        default:
          break
      }
      refetchLeads()
    } catch (error) {
      console.error(`Error performing bulk action ${action}:`, error)
      toast.error(`Failed to ${action} leads`)
    }
  }, [filters, refetchLeads])

  const handleExport = useCallback(async () => {
    try {
      const exportData = await leadsAPI.exportLeads(filters)
      const blob = new Blob([exportData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Leads exported successfully')
    } catch (error) {
      console.error('Error exporting leads:', error)
      toast.error('Failed to export leads')
    }
  }, [filters])

  if (leadsError) {
    return (
      <div className="p-6">
        <ErrorMessage
          error={leadsError}
          onRetry={refetchLeads}
          title="Failed to load leads"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm">
            {leadsData?.pagination?.total || 0} total leads
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="card !p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Total Leads</p>
              <p className="text-lg font-bold text-blue-600">{leadStats.total}</p>
            </div>
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600" size={18} />
            </div>
          </div>
        </div>

        <div className="card !p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">New Leads</p>
              <p className="text-lg font-bold text-green-600">{leadStats.newLeads}</p>
            </div>
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <UserPlus className="text-green-600" size={18} />
            </div>
          </div>
        </div>

        <div className="card !p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Converted</p>
              <p className="text-lg font-bold text-purple-600">{leadStats.converted}</p>
            </div>
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <UserCheck className="text-purple-600" size={18} />
            </div>
          </div>
        </div>

        <div className="card !p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Unassigned</p>
              <p className="text-lg font-bold text-orange-600">{leadStats.unassigned}</p>
            </div>
            <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
              <UserX className="text-orange-600" size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Search + Actions + Filters Row */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={filters.search}
            onChange={(e) => handleFiltersChange({ ...filters, search: e.target.value })}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Actions */}
        <ViewToggle
          currentView={view}
          onViewChange={handleViewChange}
        />
        <button
          onClick={handleExport}
          disabled={leadsLoading}
          className="btn btn-secondary btn-md"
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </button>
        <button
          onClick={refetchLeads}
          disabled={leadsLoading}
          className="btn btn-secondary btn-md"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${leadsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={onAddLead}
          className="btn btn-primary btn-md"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Lead
        </button>

        {/* Filters Toggle */}
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
            filtersExpanded
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Filters */}
      <LeadFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        statuses={statuses}
        users={usersData?.users || []}
        loading={leadsLoading}
        hideSearch
        isExpandedExternal={filtersExpanded}
        onToggleExpanded={setFiltersExpanded}
      />

      {/* Content */}
      <div className="card p-0 overflow-hidden">
        {leadsLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="large" text="Loading leads..." />
          </div>
        ) : view === 'kanban' ? (
          <KanbanBoard
            leads={leadsData?.leadsByStatus || {}}
            statuses={statuses}
            users={usersData?.users || []}
            onStatusUpdate={handleStatusUpdate}
            onEditLead={onEditLead}
            onDeleteLead={onDeleteLead}
            loading={leadsLoading}
          />
        ) : (
          <LeadListTable
            leads={leadsData?.leads || []}
            pagination={leadsData?.pagination || {}}
            onPaginationChange={handlePaginationChange}
            onEditLead={onEditLead}
            onDeleteLead={onDeleteLead}
            onBulkAction={handleBulkAction}
            users={usersData?.users || []}
            statuses={statuses}
            loading={leadsLoading}
            sortConfig={sortConfig}
            onSort={handleSortChange}
          />
        )}
      </div>
    </div>
  )
}

export default LeadViews