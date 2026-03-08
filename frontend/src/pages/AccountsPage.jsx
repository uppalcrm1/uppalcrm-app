import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CreditCard,
  Plus,
  Search,
  DollarSign,
  Calendar,
  Edit2,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  ClipboardList,
  Download,
  Trash2
} from 'lucide-react'
import DataTable from '../components/shared/DataTable'
import InlineEditCell from '../components/InlineEditCell'
import CreateTransactionModal from '../components/CreateTransactionModal'
import AccountSelectorModal from '../components/AccountSelectorModal'
import { AccountActions } from '../components/accounts/AccountActions'
import CreateAccountModal from '../components/CreateAccountModal'
import EditAccountModal from '../components/EditAccountModal'
import AddTaskModal from '../components/AddTaskModal'
import { accountsAPI, taskAPI } from '../services/api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import toast from 'react-hot-toast'
import { formatDateOnly } from '../utils/dateUtils'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

// Define available columns with metadata — actions handled by renderRowActions
const COLUMN_DEFINITIONS = [
  { key: 'account_name', label: 'Account Name', description: 'Custom account name', required: true, sortKey: 'account_name' },
  { key: 'mac_address', label: 'MAC Address', description: 'Device MAC address', required: false, sortable: false },
  { key: 'device', label: 'Device', description: 'Device name/type', required: false, sortable: false },
  { key: 'product', label: 'Product', description: 'Product type (Gold, Jio, Smart)', required: false, sortable: false },
  { key: 'contact', label: 'Contact', description: 'Customer name', required: false, sortable: false },
  { key: 'accounts_count', label: 'Accounts', description: 'Total accounts for contact', required: false, sortable: false },
  { key: 'transactions_count', label: 'Transactions', description: 'Transactions for this account', required: false, sortable: false },
  { key: 'created_date', label: 'Created Date', description: 'Account creation date', required: false, sortKey: 'created_date' },
  { key: 'next_renewal', label: 'Next Renewal', description: 'Renewal date', required: false, sortKey: 'next_renewal' },
]

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = {
  account_name: true,
  mac_address: true,
  device: true,
  product: true,
  contact: true,
  accounts_count: true,
  transactions_count: true,
  created_date: true,
  next_renewal: true,
}

// Product options (internal variable name can stay as SOFTWARE_EDITION_OPTIONS for database compatibility)
const SOFTWARE_EDITION_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'smart', label: 'Smart' },
  { value: 'jio', label: 'Jio' }
]

// Account Status filter options (stored field)
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'paused', label: 'Paused' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'grace_period', label: 'Grace Period' },
  { value: 'trial', label: 'Trial' },
  { value: 'churned', label: 'Churned' }
]

// Expiring filter options (calculated from next_renewal_date using calendar month boundaries)
const EXPIRING_OPTIONS = [
  { value: '', label: 'All Renewals' },
  { value: 'this_month', label: 'Expiring This Month' },
  { value: 'next_month', label: 'Expiring Next Month' },
  { value: 'past_due', label: 'Past Due' }
]

// Helper function to format dates (using timezone-safe utility)
const formatDate = (dateString) => {
  return formatDateOnly(dateString, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper function to get renewal date color based on days until renewal
const getRenewalColor = (daysUntil) => {
  if (daysUntil == null) return 'text-gray-400';
  if (daysUntil <= 7) return 'text-red-600 font-semibold';
  if (daysUntil <= 30) return 'text-yellow-600 font-medium';
  return 'text-green-600';
}

const AccountsPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAccountSelector, setShowAccountSelector] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false)
  const [selectedAccountForTransaction, setSelectedAccountForTransaction] = useState(null)
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedAccountForEdit, setSelectedAccountForEdit] = useState(null)
  const [loadingEditAccount, setLoadingEditAccount] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedAccountForTask, setSelectedAccountForTask] = useState(null)
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // --- URL-driven filter/sort/pagination state ---
  const filterStatus = searchParams.get('status') || ''
  const filterExpiring = searchParams.get('expiring') || ''
  const showDeleted = searchParams.get('deleted') === 'true'
  const sortConfig = {
    key: searchParams.get('sort') || 'created_date',
    direction: searchParams.get('order') || 'desc'
  }
  const currentPage = parseInt(searchParams.get('page')) || 1
  const pageSize = parseInt(searchParams.get('limit')) || 50

  // Search: local state for instant input, debounced for API & URL
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const debouncedSearch = useDebouncedValue(searchTerm, 300)

  // Helper to update URL params (merges with existing)
  const updateUrlParams = useCallback((updates) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, value]) => {
        // Remove param if it's the default value
        const defaults = { search: '', status: '', expiring: '', deleted: 'false', sort: 'created_date', order: 'desc', page: '1', limit: '50' }
        if (String(value) === '' || String(value) === defaults[key]) {
          newParams.delete(key)
        } else {
          newParams.set(key, String(value))
        }
      })
      return newParams
    })
  }, [setSearchParams])

  // Sync debounced search → URL (with page reset)
  useEffect(() => {
    const currentUrlSearch = searchParams.get('search') || ''
    if (currentUrlSearch === debouncedSearch) return
    updateUrlParams({ search: debouncedSearch, page: '1' })
  }, [debouncedSearch])

  // Sync URL → searchTerm on external navigation (back button)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    if (urlSearch !== searchTerm) {
      setSearchTerm(urlSearch)
    }
  }, [searchParams.get('search')])

  // Fetch accounts list via React Query
  // Query key includes ALL variables from the old fetchAccounts dependency array:
  // debouncedSearch, pageSize, sortConfig, showDeleted — plus currentPage for pagination
  const {
    data: accountsData,
    isLoading,
  } = useQuery({
    queryKey: ['accounts', { search: debouncedSearch, status: filterStatus, expiring: filterExpiring, sortConfig, showDeleted, page: currentPage, pageSize }],
    queryFn: async () => {
      const offset = (currentPage - 1) * pageSize
      const params = {
        limit: pageSize,
        offset,
        orderBy: sortConfig.key,
        orderDirection: sortConfig.direction
      }
      if (debouncedSearch.trim()) params.search = debouncedSearch
      if (filterStatus) params.status = filterStatus
      if (filterExpiring) params.expiring = filterExpiring
      if (showDeleted) params.includeDeleted = 'true'
      return accountsAPI.getAccounts(params)
    },
    keepPreviousData: true,
    staleTime: 30000,
  })

  const accounts = accountsData?.accounts || accountsData?.subscriptions || []
  const totalCount = accountsData?.total || 0
  const totalPages = accountsData?.totalPages || 0

  // Fetch organization-wide stats via React Query
  const { data: statsData } = useQuery({
    queryKey: ['accounts', 'stats'],
    queryFn: () => accountsAPI.getStats(),
    staleTime: 30000,
  })

  const stats = {
    totalAccounts: parseInt(statsData?.stats?.total_accounts ?? 0) || 0,
    activeAccounts: parseInt(statsData?.stats?.active_accounts ?? 0) || 0,
    expiringThisMonth: parseInt(statsData?.stats?.expiring_this_month ?? 0) || 0,
    pastDueAccounts: parseInt(statsData?.stats?.past_due_accounts ?? 0) || 0,
  }

  // Load column visibility from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('accounts_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  })

  // Column visibility handlers
  const handleColumnToggle = (columnKey) => {
    const newVisibleColumns = {
      ...visibleColumns,
      [columnKey]: !visibleColumns[columnKey]
    }
    setVisibleColumns(newVisibleColumns)
    localStorage.setItem('accounts_visible_columns', JSON.stringify(newVisibleColumns))
  }

  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    localStorage.setItem('accounts_visible_columns', JSON.stringify(DEFAULT_VISIBLE_COLUMNS))
  }

  // Sort handler — toggles direction, updates URL
  const handleSort = useCallback((key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    updateUrlParams({ sort: key, order: direction, page: '1' })
  }, [sortConfig, updateUrlParams])

  // Pagination change handler for DataTable
  const handlePaginationChange = useCallback((newPagination) => {
    updateUrlParams({ page: String(newPagination.page), limit: String(newPagination.limit) })
  }, [updateUrlParams])

  // Inline edit handler
  const handleFieldUpdate = async (recordId, fieldName, newValue) => {
    try {
      await accountsAPI.updateAccount(recordId, { [fieldName]: newValue })
      queryClient.invalidateQueries(['accounts'])
    } catch (error) {
      console.error('Failed to update account:', error)
      throw error
    }
  }

  // Soft delete handler
  const handleDeleteAccount = async (accountId, reason) => {
    try {
      await accountsAPI.softDeleteAccount(accountId, reason)
      queryClient.invalidateQueries(['accounts'])
    } catch (error) {
      throw error // Let component handle error
    }
  }

  // Restore account handler
  const handleRestoreAccount = async (accountId) => {
    try {
      await accountsAPI.restoreAccount(accountId)
      queryClient.invalidateQueries(['accounts'])
    } catch (error) {
      throw error // Let component handle error
    }
  }

  // All filtering is now server-side (status + renewal params sent to API)
  const filteredAccounts = accounts

  // Clear selection when filters, search, pagination, or sort changes
  useEffect(() => {
    setSelectedAccounts([])
  }, [debouncedSearch, sortConfig.key, sortConfig.direction, currentPage, filterStatus, filterExpiring, showDeleted])

  // Bulk export selected accounts as CSV (client-side)
  const handleBulkExport = useCallback(() => {
    if (selectedAccounts.length === 0) return
    const selected = filteredAccounts.filter(a => selectedAccounts.includes(a.id))
    const headers = ['Account Name', 'MAC Address', 'Device', 'Product', 'Edition', 'Contact Name', 'Status', 'Created Date', 'Next Renewal', 'Renewal State']
    const rows = selected.map(a => {
      let renewalState = ''
      if (a.next_renewal_date) {
        const renewalDate = new Date(a.next_renewal_date)
        const today = new Date()
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1)
        const twoMonthsStart = new Date(today.getFullYear(), today.getMonth() + 2, 1)
        if (renewalDate < today) renewalState = 'Past Due'
        else if (renewalDate >= monthStart && renewalDate < nextMonthStart) renewalState = 'Expiring This Month'
        else if (renewalDate >= nextMonthStart && renewalDate < twoMonthsStart) renewalState = 'Expiring Next Month'
        else renewalState = 'Current'
      }
      return [
        a.account_name || '', a.mac_address || '', a.device || '',
        a.product_name || '', a.edition_name || '', a.contact_name || '',
        a.account_status || '', a.created_at || '', a.next_renewal_date || '',
        renewalState
      ]
    })
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accounts_selected_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success(`Exported ${selected.length} accounts`)
  }, [selectedAccounts, filteredAccounts])

  // Export all accounts matching current filters (server-side)
  const handleExportAll = useCallback(async () => {
    try {
      const params = {}
      if (debouncedSearch.trim()) params.search = debouncedSearch
      if (filterStatus) params.status = filterStatus
      if (filterExpiring) params.expiring = filterExpiring
      if (showDeleted) params.includeDeleted = 'true'
      const exportData = await accountsAPI.exportAccounts(params)
      const blob = new Blob([exportData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `accounts_export_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Accounts exported successfully')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export accounts')
    }
  }, [debouncedSearch, filterStatus, filterExpiring, showDeleted])

  // Bulk delete selected accounts (soft delete)
  const handleBulkDelete = useCallback(async () => {
    if (selectedAccounts.length === 0) return
    setBulkDeleting(true)
    try {
      await Promise.all(selectedAccounts.map(id => accountsAPI.softDeleteAccount(id, 'Bulk deleted')))
      queryClient.invalidateQueries(['accounts'])
      toast.success(`Successfully deleted ${selectedAccounts.length} accounts`)
      setSelectedAccounts([])
      setShowBulkDeleteModal(false)
    } catch (error) {
      console.error('Bulk delete failed:', error)
      toast.error('Failed to delete some accounts')
    } finally {
      setBulkDeleting(false)
    }
  }, [selectedAccounts, queryClient])

  const getStatusBadge = (status, daysUntilExpiry) => {
    if (status === 'active' && daysUntilExpiry > 7) {
      return {
        class: 'badge badge-success',
        icon: <CheckCircle size={12} className="mr-1" />,
        text: 'Active'
      }
    } else if (status === 'active' || status === 'expiring_soon') {
      return {
        class: 'badge badge-warning',
        icon: <Clock size={12} className="mr-1" />,
        text: `Expires in ${daysUntilExpiry}d`
      }
    } else {
      return {
        class: 'badge badge-danger',
        icon: <AlertCircle size={12} className="mr-1" />,
        text: 'Expired'
      }
    }
  }

  const getDaysUntilRenewal = (account) => {
    // Use days_until_renewal if present, fall back to days_until_expiry
    const days = account.days_until_renewal ?? account.days_until_expiry
    if (days != null) return Math.round(days)
    // Fallback: compute from next_renewal_date
    if (account.next_renewal_date) {
      const diff = new Date(account.next_renewal_date) - new Date()
      return Math.round(diff / (1000 * 60 * 60 * 24))
    }
    return null
  }

  const handleRecordPayment = (account) => {
    setSelectedAccount(account)
    setShowPaymentModal(true)
  }

  const handleCreateTransaction = (account) => {
    // Validate account has contact
    if (!account.contact_id) {
      toast.error('Cannot create transaction: Account has no associated contact')
      return
    }
    setSelectedAccountForTransaction(account)
    setShowCreateTransactionModal(true)
  }

  const handleTransactionCreated = () => {
    setShowCreateTransactionModal(false)
    setSelectedAccountForTransaction(null)
    queryClient.invalidateQueries(['accounts'])
    toast.success('Transaction created successfully')
  }

  const handleAccountCreated = () => {
    setShowCreateAccountModal(false)
    queryClient.invalidateQueries(['accounts'])
    toast.success('Account created successfully')
  }

  const handleEditAccount = async (account) => {
    setLoadingEditAccount(true)
    try {
      const response = await accountsAPI.getAccount(account.id)
      setSelectedAccountForEdit(response.account)
      setShowEditModal(true)
    } catch (error) {
      console.error('Error loading account for edit:', error)
      toast.error('Failed to load account details')
    } finally {
      setLoadingEditAccount(false)
    }
  }

  const handleAccountUpdated = () => {
    setShowEditModal(false)
    setSelectedAccountForEdit(null)
    queryClient.invalidateQueries(['accounts'])
  }

  const handleCreateTask = (account) => {
    const contactFirstName = account.first_name || ''
    const contactLastName = account.last_name || ''
    const accountName = account.account_name || 'Unnamed Account'

    // Priority calculation
    const days = getDaysUntilRenewal(account)
    let priority = 'low'
    if (days != null) {
      if (days <= 14) priority = 'high'
      else if (days <= 30) priority = 'medium'
    }

    // Scheduled date: 7 days before renewal, or today if renewal is ≤ 7 days away
    let scheduledAt = ''
    if (account.next_renewal_date) {
      const renewal = new Date(account.next_renewal_date)
      const scheduled = new Date(renewal)
      scheduled.setDate(scheduled.getDate() - 7)
      const today = new Date()
      const target = scheduled < today ? today : scheduled
      // Format for datetime-local input (YYYY-MM-DDTHH:mm)
      target.setMinutes(target.getMinutes() - target.getTimezoneOffset())
      scheduledAt = target.toISOString().slice(0, 16)
    }

    // Format renewal date for description
    const renewalDisplay = account.next_renewal_date
      ? formatDate(account.next_renewal_date)
      : 'unknown date'

    setSelectedAccountForTask({
      account,
      defaultValues: {
        subject: `Renewal: ${contactFirstName} ${contactLastName} - ${accountName}`.trim(),
        description: `Account renewal due on ${renewalDisplay}.`,
        priority,
        scheduled_at: scheduledAt
      }
    })
    setShowTaskModal(true)
  }

  // Render cell content for DataTable
  const renderCell = useCallback((account, column) => {
    switch (column.key) {
      case 'account_name':
        return (
          <button
            onClick={() => navigate(`/accounts/${account.id}`)}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
          >
            {account.account_name || 'Unnamed Account'}
          </button>
        )
      case 'mac_address':
        return (
          <InlineEditCell
            value={account.mac_address}
            fieldName="mac_address"
            fieldType="text"
            recordId={account.id}
            entityType="accounts"
            onSave={handleFieldUpdate}
            placeholder="Add MAC address..."
            className="font-mono text-sm"
          />
        )
      case 'device':
        return (
          <InlineEditCell
            value={account.device_name}
            fieldName="device_name"
            fieldType="text"
            recordId={account.id}
            entityType="accounts"
            onSave={handleFieldUpdate}
            placeholder="Add device..."
            className="text-sm"
          />
        )
      case 'product':
        return (
          <span className="font-medium text-blue-600">
            {account.edition_name || account.edition || 'N/A'}
          </span>
        )
      case 'contact':
        return (
          <a
            href={`/contacts/${account.contact_id}`}
            className="text-blue-600 hover:underline font-medium"
          >
            {account.contact_name || `${account.first_name || ''} ${account.last_name || ''}`.trim() || 'Unknown Contact'}
          </a>
        )
      case 'accounts_count':
        return (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
            {account.total_accounts_for_contact || 0}
          </span>
        )
      case 'transactions_count':
        return (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
            {account.transaction_count || 0}
          </span>
        )
      case 'created_date':
        return (
          <span className="text-gray-600 text-sm">
            {formatDate(account.created_at)}
          </span>
        )
      case 'next_renewal': {
        const renewalColor = getRenewalColor(account.days_until_renewal)
        return (
          <div className="flex items-center gap-1">
            <Calendar size={14} className={renewalColor} />
            <span className={`text-sm ${renewalColor}`}>
              {account.next_renewal_date ? formatDate(account.next_renewal_date) : 'N/A'}
            </span>
            {account.days_until_renewal != null && (
              <span className="text-xs text-gray-500 ml-1">
                ({Math.round(account.days_until_renewal)}d)
              </span>
            )}
          </div>
        )
      }
      default:
        return <span className="text-gray-500">—</span>
    }
  }, [navigate, handleFieldUpdate])

  // Render row actions for DataTable
  const renderRowActions = useCallback((account) => (
    <div className="flex items-center gap-2">
      {/* Create Task button with optional active-task badge */}
      <div className="relative inline-flex">
        <button
          onClick={() => handleCreateTask(account)}
          className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg"
          title="Create Renewal Task"
        >
          <ClipboardList size={16} />
        </button>
        {account.active_task_count > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-orange-500 rounded-full">
            {account.active_task_count}
          </span>
        )}
      </div>
      <button
        onClick={() => handleCreateTransaction(account)}
        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
        title="Create Transaction"
      >
        <Plus size={16} />
      </button>
      <button
        onClick={() => handleRecordPayment(account)}
        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
        title="Record Payment"
      >
        <DollarSign size={16} />
      </button>
      <button
        onClick={() => navigate(`/accounts/${account.id}`)}
        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
        title="View Details"
      >
        <Eye size={16} />
      </button>
      <button
        onClick={() => handleEditAccount(account)}
        disabled={loadingEditAccount}
        className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
        title="Edit Account"
      >
        <Edit2 size={16} />
      </button>
      <AccountActions
        account={account}
        onDelete={handleDeleteAccount}
        onRestore={handleRestoreAccount}
        onRefresh={() => queryClient.invalidateQueries(['accounts'])}
      />
    </div>
  ), [loadingEditAccount, navigate, queryClient])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Management</h1>
          <p className="text-gray-600 mt-1">Track software licenses, device registrations, and billing for customer accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportAll}
            className="btn btn-secondary btn-md"
            title="Export all accounts matching current filters"
          >
            <Download size={16} className="mr-2" />
            Export
          </button>
          <button
            onClick={() => setShowCreateAccountModal(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} className="mr-2" />
            Create Account
          </button>
          <button
            onClick={() => {
              if (!accounts || accounts.length === 0) {
                toast.error('No accounts available. Please create an account first.')
                return
              }
              setShowAccountSelector(true)
            }}
            className="btn btn-secondary btn-md"
          >
            <DollarSign size={16} className="mr-2" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Stats Cards — Account Health Funnel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Accounts</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalAccounts}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Accounts</p>
              <p className="text-3xl font-bold text-green-600">{stats.activeAccounts}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Expiring This Month</p>
              <p className="text-3xl font-bold text-amber-600">{stats.expiringThisMonth}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="text-amber-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Past Due</p>
              <p className="text-3xl font-bold text-red-600">{stats.pastDueAccounts}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts by contact, device, or MAC address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => updateUrlParams({ status: e.target.value, page: '1' })}
            className="input w-full sm:w-44"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={filterExpiring}
            onChange={(e) => updateUrlParams({ expiring: e.target.value, page: '1' })}
            className="input w-full sm:w-48"
          >
            {EXPIRING_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => updateUrlParams({ deleted: e.target.checked ? 'true' : 'false', page: '1' })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Show deleted</span>
          </label>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card p-0 overflow-hidden">
        <DataTable
          data={filteredAccounts}
          loading={isLoading}
          entityName="Account"
          entityType="accounts"
          rowKey="id"
          columns={COLUMN_DEFINITIONS}
          visibleColumns={visibleColumns}
          onColumnToggle={handleColumnToggle}
          onColumnsReset={handleResetColumns}
          sortConfig={sortConfig}
          onSort={handleSort}
          pagination={{ page: currentPage, limit: pageSize, total: totalCount }}
          onPaginationChange={handlePaginationChange}
          pageSizeOptions={[25, 50, 100, 200]}
          selectable
          selectedIds={selectedAccounts}
          onSelectionChange={setSelectedAccounts}
          bulkActions={[
            { label: 'Export', icon: Download, onClick: handleBulkExport },
            { label: 'Delete', icon: Trash2, onClick: () => setShowBulkDeleteModal(true), variant: 'danger' },
          ]}
          renderCell={renderCell}
          renderRowActions={renderRowActions}
          onInlineEdit={handleFieldUpdate}
          getRowClassName={(row) => row.deleted_at ? 'opacity-50 bg-gray-50' : ''}
          emptyIcon={CreditCard}
          emptyMessage="No accounts found"
          emptySubMessage="Start by creating your first account"
        />
        {/* Empty state action buttons — shown below DataTable's empty state */}
        {filteredAccounts.length === 0 && !isLoading && (
          <div className="flex items-center justify-center space-x-3 pb-8 -mt-4">
            <button
              onClick={() => setShowCreateAccountModal(true)}
              className="btn btn-primary btn-md"
            >
              <Plus size={16} className="mr-2" />
              Create Account
            </button>
            <button
              onClick={() => {
                if (!accounts || accounts.length === 0) {
                  toast.error('No accounts available. Please create an account first.')
                  return
                }
                setShowAccountSelector(true)
              }}
              className="btn btn-secondary btn-md"
            >
              <DollarSign size={16} className="mr-2" />
              Record Payment
            </button>
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Accounts"
        message={`Are you sure you want to delete ${selectedAccounts.length} account${selectedAccounts.length !== 1 ? 's' : ''}? Accounts will be soft-deleted and can be restored later.`}
        confirmButtonText={`Delete ${selectedAccounts.length} Account${selectedAccounts.length !== 1 ? 's' : ''}`}
        isDestructive
        loading={bulkDeleting}
      />

      {/* Account Selector Modal - Select account before creating transaction */}
      <AccountSelectorModal
        accounts={accounts}
        isOpen={showAccountSelector}
        onSelect={(account) => {
          setSelectedAccountForTransaction(account)
          setShowAccountSelector(false)
          setShowCreateTransactionModal(true)
        }}
        onClose={() => setShowAccountSelector(false)}
      />

      {/* Create Transaction Modal */}
      {showCreateTransactionModal && selectedAccountForTransaction && (
        <CreateTransactionModal
          account={selectedAccountForTransaction}
          onClose={() => {
            setShowCreateTransactionModal(false)
            setSelectedAccountForTransaction(null)
          }}
          onSuccess={handleTransactionCreated}
          isOpen={showCreateTransactionModal}
        />
      )}

      {/* Create Account Modal */}
      <CreateAccountModal
        isOpen={showCreateAccountModal}
        onClose={() => setShowCreateAccountModal(false)}
        onSuccess={handleAccountCreated}
      />

      {/* Edit Account Modal */}
      <EditAccountModal
        isOpen={showEditModal}
        account={selectedAccountForEdit}
        onClose={() => { setShowEditModal(false); setSelectedAccountForEdit(null) }}
        onSuccess={handleAccountUpdated}
      />

      {/* Create Task Modal */}
      {showTaskModal && selectedAccountForTask && (
        <AddTaskModal
          contactId={selectedAccountForTask.account.contact_id}
          accountId={selectedAccountForTask.account.id}
          onClose={() => {
            setShowTaskModal(false)
            setSelectedAccountForTask(null)
            queryClient.invalidateQueries(['accounts']) // refresh active_task_count badges
          }}
          api={taskAPI}
          defaultValues={selectedAccountForTask.defaultValues}
        />
      )}
    </div>
  )
}

export default AccountsPage
