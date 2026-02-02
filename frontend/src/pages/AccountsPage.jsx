import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard,
  Plus,
  Search,
  DollarSign,
  Users,
  Calendar,
  Edit2,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react'
import ColumnSelector from '../components/ColumnSelector'
import InlineEditCell from '../components/InlineEditCell'
import CreateTransactionModal from '../components/CreateTransactionModal'
import AccountSelectorModal from '../components/AccountSelectorModal'
import { AccountActions } from '../components/accounts/AccountActions'
import CreateAccountModal from '../components/CreateAccountModal'
import { accountsAPI } from '../services/api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import toast from 'react-hot-toast'
import { formatDateOnly } from '../utils/dateUtils'

// Define available columns with metadata (10 columns as per spec)
const COLUMN_DEFINITIONS = [
  { key: 'account_name', label: 'Account Name', description: 'Custom account name', required: true },
  { key: 'mac_address', label: 'MAC Address', description: 'Device MAC address', required: false },
  { key: 'device', label: 'Device', description: 'Device name/type', required: false },
  { key: 'product', label: 'Product', description: 'Product type (Gold, Jio, Smart)', required: false },
  { key: 'contact', label: 'Contact', description: 'Customer name', required: false },
  { key: 'accounts_count', label: 'Accounts', description: 'Total accounts for contact', required: false },
  { key: 'transactions_count', label: 'Transactions', description: 'Transactions for this account', required: false },
  { key: 'created_date', label: 'Created Date', description: 'Account creation date', required: false },
  { key: 'next_renewal', label: 'Next Renewal', description: 'Renewal date', required: false },
  { key: 'actions', label: 'Actions', description: 'Account actions', required: true }
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
  actions: true
}

// Product options (internal variable name can stay as SOFTWARE_EDITION_OPTIONS for database compatibility)
const SOFTWARE_EDITION_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'smart', label: 'Smart' },
  { value: 'jio', label: 'Jio' }
]

// Status options
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' }
]

// Billing cycle options
const BILLING_CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi-annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' }
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

// Helper function to render sort indicator
const SortIndicator = ({ column, currentSort, direction }) => {
  if (currentSort !== column) return null
  return (
    <span className="ml-1 text-xs">
      {direction === 'asc' ? '▲' : '▼'}
    </span>
  )
}

const AccountsPage = () => {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [localAccounts, setLocalAccounts] = useState([]) // For optimistic updates
  const [showAccountSelector, setShowAccountSelector] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false)
  const [selectedAccountForTransaction, setSelectedAccountForTransaction] = useState(null)
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sortColumn, setSortColumn] = useState('created_date') // Default sort by created date
  const [sortDirection, setSortDirection] = useState('desc') // 'asc' or 'desc' - default newest first

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Debounce search - separate immediate input from debounced API calls
  const debouncedSearch = useDebouncedValue(searchTerm, 300)

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

  // Sort handler - toggle sort direction when clicking a sortable column
  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      // Toggle direction if same column clicked
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column with ascending order
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  // Pagination handlers
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      fetchAccounts(currentPage - 1, pageSize)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      fetchAccounts(currentPage + 1, pageSize)
    }
  }

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize)
    fetchAccounts(1, newSize)
  }

  const handleGoToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      fetchAccounts(page, pageSize)
    }
  }

  // Inline edit handler with optimistic updates
  const handleFieldUpdate = async (recordId, fieldName, newValue) => {
    // Optimistic update: immediately update local state
    setLocalAccounts(prevAccounts =>
      prevAccounts.map(account =>
        account.id === recordId
          ? { ...account, [fieldName]: newValue }
          : account
      )
    )

    try {
      // Make API call to update the account
      await accountsAPI.updateAccount(recordId, { [fieldName]: newValue })

      // Also update the main accounts state for consistency
      setAccounts(prevAccounts =>
        prevAccounts.map(account =>
          account.id === recordId
            ? { ...account, [fieldName]: newValue }
            : account
        )
      )
    } catch (error) {
      // Error is thrown back to InlineEditCell for rollback
      console.error('Failed to update account:', error)
      throw error
    }
  }

  // Soft delete handler
  const handleDeleteAccount = async (accountId, reason) => {
    try {
      await accountsAPI.softDeleteAccount(accountId, reason)
      // Refresh accounts list
      await fetchAccounts()
    } catch (error) {
      throw error // Let component handle error
    }
  }

  // Restore account handler
  const handleRestoreAccount = async (accountId) => {
    try {
      await accountsAPI.restoreAccount(accountId)
      // Refresh accounts list
      await fetchAccounts()
    } catch (error) {
      throw error // Let component handle error
    }
  }

  // Use localAccounts for display (optimistic updates), fallback to accounts
  const displayAccounts = localAccounts.length > 0 ? localAccounts : accounts

  // Apply status filter and sorting
  const filteredAccounts = React.useMemo(() => {
    let filtered = displayAccounts

    // Apply status filter (client-side only)
    if (filterStatus !== 'all') {
      filtered = filtered.filter(account => account.status === filterStatus)
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue

      switch (sortColumn) {
        case 'next_renewal':
          // Sort by days_until_renewal (null values go to end)
          aValue = a.days_until_renewal ?? Infinity
          bValue = b.days_until_renewal ?? Infinity
          break
        case 'created_date':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        case 'account_name':
          aValue = (a.account_name || '').toLowerCase()
          bValue = (b.account_name || '').toLowerCase()
          break
        default:
          return 0
      }

      // Compare values
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [displayAccounts, filterStatus, sortColumn, sortDirection])

  // Initialize localAccounts when accounts changes
  React.useEffect(() => {
    setLocalAccounts(accounts)
  }, [accounts])

  // Fetch accounts function (moved outside useEffect to be callable)
  const fetchAccounts = React.useCallback(async (page = 1, size = pageSize) => {
    try {
      setLoading(true)
      const offset = (page - 1) * size
      const params = {
        limit: size,
        offset: offset
      }
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch
      }
      // Add timestamp to bypass caching
      params.t = Date.now()
      console.log('🔍 Fetching accounts with params:', params)
      const response = await accountsAPI.getAccounts(params)
      console.log('📥 API Response:', response)
      // Backend can return either 'accounts' or 'subscriptions' depending on endpoint
      const accountsData = response.accounts || response.subscriptions || []
      console.log('📥 Accounts data length:', accountsData.length)
      console.log('📥 First account:', accountsData[0]?.contact_name)
      setAccounts(accountsData)
      setTotalCount(response.total || 0)
      setTotalPages(response.totalPages || 0)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, pageSize])

  // Fetch accounts when debouncedSearch, pageSize, or showDeleted changes
  React.useEffect(() => {
    fetchAccounts(1, pageSize)
  }, [fetchAccounts, pageSize])

  // Calculate statistics
  const stats = {
    totalRevenue: filteredAccounts.reduce((sum, acc) => {
      if (acc.status === 'active' || acc.status === 'expiring_soon') {
        return sum + (parseFloat(acc.price) || 0)
      }
      return sum
    }, 0),
    totalAccounts: filteredAccounts.length,
    activeUsers: filteredAccounts.filter(acc => acc.status === 'active').length
  }

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
    toast.success('Transaction created successfully')
  }

  const handleAccountCreated = () => {
    setShowCreateAccountModal(false)
    fetchAccounts() // Refresh the accounts list
    toast.success('Account created successfully')
  }

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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Monthly Revenue</p>
              <p className="text-3xl font-bold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

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
              <p className="text-sm text-gray-600 mb-1">Active Users</p>
              <p className="text-3xl font-bold text-purple-600">{stats.activeUsers}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="text-purple-600" size={24} />
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
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Show deleted</span>
          </label>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card">
        {/* Toolbar */}
        {displayAccounts.length > 0 && (
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">
                {totalCount} total {totalCount === 1 ? 'Account' : 'Accounts'}
                {totalPages > 1 && <span className="text-gray-500"> • Showing {displayAccounts.length} per page</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ColumnSelector
                columns={COLUMN_DEFINITIONS}
                visibleColumns={visibleColumns}
                onColumnToggle={handleColumnToggle}
                onReset={handleResetColumns}
              />
            </div>
          </div>
        )}

        {displayAccounts.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
            <p className="text-gray-600 mb-6">Start by recording your first account payment</p>
            <button
              onClick={() => {
                if (!accounts || accounts.length === 0) {
                  toast.error('No accounts available. Please create an account first.')
                  return
                }
                setShowAccountSelector(true)
              }}
              className="btn btn-primary btn-md"
            >
              <DollarSign size={16} className="mr-2" />
              Record Payment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {visibleColumns.account_name && <th className="text-left py-3 px-4 font-medium text-gray-900">Account Name</th>}
                  {visibleColumns.mac_address && <th className="text-left py-3 px-4 font-medium text-gray-900">MAC Address</th>}
                  {visibleColumns.device && <th className="text-left py-3 px-4 font-medium text-gray-900">Device</th>}
                  {visibleColumns.product && <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>}
                  {visibleColumns.contact && <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>}
                  {visibleColumns.accounts_count && <th className="text-center py-3 px-4 font-medium text-gray-900">Accounts</th>}
                  {visibleColumns.transactions_count && <th className="text-center py-3 px-4 font-medium text-gray-900">Transactions</th>}
                  {visibleColumns.created_date && (
                    <th
                      onClick={() => handleSort('created_date')}
                      className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-100 select-none"
                      title="Click to sort by Created Date"
                    >
                      Created Date
                      <SortIndicator column="created_date" currentSort={sortColumn} direction={sortDirection} />
                    </th>
                  )}
                  {visibleColumns.next_renewal && (
                    <th
                      onClick={() => handleSort('next_renewal')}
                      className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-100 select-none"
                      title="Click to sort by Next Renewal date"
                    >
                      Next Renewal
                      <SortIndicator column="next_renewal" currentSort={sortColumn} direction={sortDirection} />
                    </th>
                  )}
                  {visibleColumns.actions && <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => {
                  const renewalColor = getRenewalColor(account.days_until_renewal)
                  return (
                    <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {/* Column 1: Account Name */}
                      {visibleColumns.account_name && (
                        <td className="py-4 px-4">
                          <button
                            onClick={() => navigate(`/accounts/${account.id}`)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                          >
                            {account.account_name || 'Unnamed Account'}
                          </button>
                        </td>
                      )}

                      {/* Column 2: MAC Address */}
                      {visibleColumns.mac_address && (
                        <td className="py-4 px-4">
                          <span className="font-mono text-sm text-gray-700">
                            {account.mac_address || 'N/A'}
                          </span>
                        </td>
                      )}

                      {/* Column 3: Device */}
                      {visibleColumns.device && (
                        <td className="py-4 px-4">
                          <span className="text-gray-900">
                            {account.device_name || 'Unknown Device'}
                          </span>
                        </td>
                      )}

                      {/* Column 4: Product */}
                      {visibleColumns.product && (
                        <td className="py-4 px-4">
                          <span className="font-medium text-blue-600">
                            {account.edition_name || account.edition || 'N/A'}
                          </span>
                        </td>
                      )}

                      {/* Column 5: Contact (clickable) */}
                      {visibleColumns.contact && (
                        <td className="py-4 px-4">
                          <a
                            href={`/contacts/${account.contact_id}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {account.contact_name || `${account.first_name || ''} ${account.last_name || ''}`.trim() || 'Unknown Contact'}
                          </a>
                        </td>
                      )}

                      {/* Column 6: Total Accounts for Contact */}
                      {visibleColumns.accounts_count && (
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                            {account.total_accounts_for_contact || 0}
                          </span>
                        </td>
                      )}

                      {/* Column 7: Transactions for THIS Account */}
                      {visibleColumns.transactions_count && (
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                            {account.transaction_count || 0}
                          </span>
                        </td>
                      )}

                      {/* Column 8: Created Date */}
                      {visibleColumns.created_date && (
                        <td className="py-4 px-4">
                          <span className="text-gray-600 text-sm">
                            {formatDate(account.created_at)}
                          </span>
                        </td>
                      )}

                      {/* Column 9: Next Renewal with Color Coding */}
                      {visibleColumns.next_renewal && (
                        <td className="py-4 px-4">
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
                        </td>
                      )}

                      {/* Column 10: Actions */}
                      {visibleColumns.actions && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
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
                            <AccountActions
                              account={account}
                              onDelete={handleDeleteAccount}
                              onRestore={handleRestoreAccount}
                              onRefresh={fetchAccounts}
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && displayAccounts.length > 0 && totalPages > 1 && (
          <div className="border-t border-gray-200 px-4 py-4 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Rows per page:</label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                className="input input-sm"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>

            <div className="text-sm text-gray-700">
              Page <span className="font-medium">{currentPage}</span> of{' '}
              <span className="font-medium">{totalPages}</span> ({' '}
              <span className="font-medium">{totalCount}</span> total)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="btn btn-sm btn-outline"
              >
                Previous
              </button>

              {/* Page number buttons */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage > totalPages - 3) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handleGoToPage(pageNum)}
                      className={`btn btn-sm ${
                        currentPage === pageNum
                          ? 'btn-primary'
                          : 'btn-outline'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="btn btn-sm btn-outline"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

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
    </div>
  )
}

export default AccountsPage
