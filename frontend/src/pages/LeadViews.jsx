import React, { useState, useEffect } from 'react'
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
  RefreshCw
} from 'lucide-react'
import { leadsAPI, usersAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import KanbanBoard from '../components/KanbanBoard'
import LeadListTable from '../components/LeadListTable'
import ViewToggle from '../components/ViewToggle'
import LeadFilters from '../components/LeadFilters'
import toast from 'react-hot-toast'

const LEAD_STATUSES = [
  { value: 'new', label: 'New', color: 'blue' },
  { value: 'contacted', label: 'Contacted', color: 'yellow' },
  { value: 'qualified', label: 'Qualified', color: 'purple' },
  { value: 'proposal', label: 'Proposal', color: 'indigo' },
  { value: 'negotiation', label: 'Negotiation', color: 'pink' },
  { value: 'converted', label: 'Converted', color: 'green' },
  { value: 'lost', label: 'Lost', color: 'red' }
]

const LeadViews = ({ onAddLead, onEditLead, onDeleteLead }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState(searchParams.get('view') || 'list')
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    assignedTo: searchParams.get('assignedTo') || '',
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

  // Fetch leads with filters and pagination
  const {
    data: leadsData,
    isLoading: leadsLoading,
    error: leadsError,
    refetch: refetchLeads
  } = useQuery({
    queryKey: ['leads', filters, pagination, view],
    queryFn: async () => {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      }

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
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

  // Fetch users for assignment filter
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getUsers(),
    staleTime: 10 * 60 * 1000 // 10 minutes
  })

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('view', view)

    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    if (pagination.page !== 1) params.set('page', pagination.page.toString())
    if (pagination.limit !== 20) params.set('limit', pagination.limit.toString())

    setSearchParams(params, { replace: true })
  }, [view, filters, pagination, setSearchParams])

  const handleViewChange = (newView) => {
    setView(newView)
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page when changing views
  }

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters)
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page when filters change
  }

  const handlePaginationChange = (newPagination) => {
    setPagination(newPagination)
  }

  const handleStatusUpdate = async (leadId, newStatus) => {
    try {
      await leadsAPI.updateLeadStatus(leadId, newStatus)
      toast.success('Lead status updated successfully')
      refetchLeads()
    } catch (error) {
      console.error('Error updating lead status:', error)
      toast.error('Failed to update lead status')
    }
  }

  const handleBulkAction = async (leadIds, action, data) => {
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
  }

  const handleExport = async () => {
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
  }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600 mt-1">
            {leadsData?.pagination?.total || 0} total leads
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <ViewToggle
            currentView={view}
            onViewChange={handleViewChange}
          />

          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={leadsLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            <button
              onClick={refetchLeads}
              disabled={leadsLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${leadsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={onAddLead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <LeadFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        statuses={LEAD_STATUSES}
        users={usersData?.users || []}
        loading={leadsLoading}
      />

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {leadsLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="large" text="Loading leads..." />
          </div>
        ) : view === 'kanban' ? (
          <KanbanBoard
            leads={leadsData?.leadsByStatus || {}}
            statuses={LEAD_STATUSES}
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
            statuses={LEAD_STATUSES}
            loading={leadsLoading}
          />
        )}
      </div>
    </div>
  )
}

export default LeadViews