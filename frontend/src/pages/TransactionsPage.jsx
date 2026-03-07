import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  DollarSign,
  Search,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Eye,
  Edit,
  User,
  Download
} from 'lucide-react'
import { transactionsAPI } from '../services/api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import EditTransactionModal from '../components/EditTransactionModal'
import DataTable from '../components/shared/DataTable'
import { formatSource, formatPaymentMethod, TRANSACTION_STATUSES, PAYMENT_METHODS } from '../constants/transactions'
import { formatDateOnly } from '../utils/dateUtils'
import { formatCurrency } from '../utils/currency'
import InlineEditCell from '../components/InlineEditCell'
import { TransactionActions } from '../components/transactions/TransactionActions'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import toast from 'react-hot-toast'

// Define available columns with metadata
const COLUMN_DEFINITIONS = [
  { key: 'payment_date', label: 'Payment Date', description: 'Transaction payment date', required: true, sortKey: 'transaction_date' },
  { key: 'transaction_id', label: 'Transaction ID', description: 'Unique transaction identifier', required: true, sortable: false },
  { key: 'account_name', label: 'Account Name', description: 'Associated account', required: false, sortKey: 'account_name' },
  { key: 'contact_name', label: 'Contact Name', description: 'Associated contact', required: false, sortable: false },
  { key: 'amount', label: 'Amount', description: 'Transaction amount', required: true, sortKey: 'amount' },
  { key: 'currency', label: 'Currency', description: 'Transaction currency (CAD or USD)', required: false, sortable: false },
  { key: 'status', label: 'Status', description: 'Transaction status', required: false, sortable: false },
  { key: 'source', label: 'Source', description: 'Payment source', required: false, sortable: false },
  { key: 'payment_method', label: 'Payment Method', description: 'Payment method used', required: false, sortable: false },
  { key: 'created_by', label: 'Created By', description: 'User who created the transaction', required: false, sortable: false },
]

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = {
  payment_date: true,
  transaction_id: true,
  account_name: true,
  contact_name: true,
  amount: true,
  currency: true,
  status: true,
  source: true,
  payment_method: true,
  created_by: false,
}

// formatSource and formatPaymentMethod are now imported from constants/transactions.js
// formatCurrency is imported from utils/currency.js

// Helper function to format date to yyyy-mm-dd (timezone-safe)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'

  // Extract just the date part (YYYY-MM-DD) from ISO string
  const datePart = dateString.split('T')[0]
  return datePart
}

const TransactionsPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'transaction_date', direction: 'desc' })
  const [selectedTransactions, setSelectedTransactions] = useState([])
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showVoided, setShowVoided] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Debounce search - separate immediate input from debounced API calls
  const debouncedSearch = useDebouncedValue(searchTerm, 300)

  // Load column visibility from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('transactions_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  })

  // Column visibility handlers
  const handleColumnToggle = (columnKey) => {
    const newVisibleColumns = {
      ...visibleColumns,
      [columnKey]: !visibleColumns[columnKey]
    }
    setVisibleColumns(newVisibleColumns)
    localStorage.setItem('transactions_visible_columns', JSON.stringify(newVisibleColumns))
  }

  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    localStorage.setItem('transactions_visible_columns', JSON.stringify(DEFAULT_VISIBLE_COLUMNS))
  }

  // Fetch transactions list via React Query
  // Query key includes ALL variables from the old fetchTransactions dependency array:
  // debouncedSearch, pageSize, sortConfig, filterStatus, filterMethod, filterSource — plus currentPage
  const {
    data: transactionsData,
    isLoading,
  } = useQuery({
    queryKey: ['transactions', { search: debouncedSearch, sortConfig, filterStatus, filterMethod, filterSource, page: currentPage, pageSize, showVoided }],
    queryFn: async () => {
      const offset = (currentPage - 1) * pageSize
      const params = {
        limit: pageSize,
        offset,
        search: debouncedSearch || '',
        sort: sortConfig.key,
        order: sortConfig.direction
      }
      if (filterStatus !== 'all') params.status = filterStatus
      if (filterMethod !== 'all') params.payment_method = filterMethod
      if (filterSource !== 'all') params.source = filterSource
      if (showVoided) params.includeDeleted = 'true'
      return transactionsAPI.getTransactions(params)
    },
    keepPreviousData: true,
    staleTime: 30000,
  })

  const transactions = transactionsData?.transactions || []
  const totalCount = transactionsData?.total || 0
  const totalPages = transactionsData?.totalPages || 0

  // Fetch revenue stats via React Query
  const { data: revenueStats, isLoading: loadingRevenue } = useQuery({
    queryKey: ['transactions', 'stats'],
    queryFn: () => transactionsAPI.getRevenueStats(),
    staleTime: 30000,
  })

  // Reset to page 1 when search, sort, or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, sortConfig, filterStatus, filterMethod, filterSource, showVoided])

  // Clear selection when filters, search, pagination, or sort changes
  useEffect(() => {
    setSelectedTransactions([])
  }, [debouncedSearch, sortConfig, currentPage, filterStatus, filterMethod, filterSource, showVoided])

  // Bulk export selected transactions as CSV (client-side)
  const handleBulkExport = useCallback(() => {
    if (selectedTransactions.length === 0) return
    const selected = transactions.filter(t => selectedTransactions.includes(t.id))
    const headers = ['Payment Date', 'Transaction ID', 'Account Name', 'Contact Name', 'Amount', 'Currency', 'Status', 'Source', 'Payment Method', 'Created By']
    const rows = selected.map(t => [
      t.payment_date || '', t.transaction_id || '', t.account_name || '',
      t.contact_name || '', t.amount || '', t.currency || '',
      t.status || '', t.source || '', t.payment_method || '',
      t.created_by_name || ''
    ])
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions_selected_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success(`Exported ${selected.length} transactions`)
  }, [selectedTransactions, transactions])

  // Export all transactions matching current filters (server-side)
  const handleExportAll = useCallback(async () => {
    try {
      const params = {}
      if (debouncedSearch.trim()) params.search = debouncedSearch
      if (filterStatus !== 'all') params.status = filterStatus
      if (filterMethod !== 'all') params.payment_method = filterMethod
      if (filterSource !== 'all') params.source = filterSource
      const exportData = await transactionsAPI.exportTransactions(params)
      const blob = new Blob([exportData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Transactions exported successfully')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export transactions')
    }
  }, [debouncedSearch, filterStatus, filterMethod, filterSource])

  // Bulk void selected transactions (soft delete)
  const handleBulkDelete = useCallback(async () => {
    if (selectedTransactions.length === 0) return
    setBulkDeleting(true)
    try {
      await Promise.all(selectedTransactions.map(id => transactionsAPI.voidTransaction(id, 'Bulk voided')))
      queryClient.invalidateQueries(['transactions'])
      toast.success(`Successfully voided ${selectedTransactions.length} transactions`)
      setSelectedTransactions([])
      setShowBulkDeleteModal(false)
    } catch (error) {
      console.error('Bulk void failed:', error)
      toast.error('Failed to void some transactions')
    } finally {
      setBulkDeleting(false)
    }
  }, [selectedTransactions, queryClient])

  // Calculate statistics from frontend data (for filtering/display only)
  const stats = {
    // Use API values for accurate currency-converted totals
    totalRevenue: revenueStats?.total_revenue_cad || 0,
    totalTransactions: revenueStats?.total_transactions || transactions.length,
    avgTransaction: revenueStats?.average_transaction_cad || 0,
    thisMonthRevenue: revenueStats?.this_month_revenue_cad || 0,
    // Local counts for status badges
    completedTransactions: transactions.filter(t => t.status === 'completed').length,
    pendingTransactions: transactions.filter(t => t.status === 'pending').length,
    failedTransactions: transactions.filter(t => t.status === 'failed').length
  }

  // Sort handler — toggles direction, sends to server via fetchTransactions
  const handleSort = useCallback((key) => {
    setSortConfig(prev => {
      const direction = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      return { key, direction }
    })
  }, [])

  // Pagination change handler for DataTable
  const handlePaginationChange = useCallback((newPagination) => {
    setCurrentPage(newPagination.page)
    setPageSize(newPagination.limit)
  }, [])

  const getStatusBadge = (status) => {
    const badges = {
      completed: {
        class: 'bg-green-100 text-green-800',
        icon: <CheckCircle size={12} className="mr-1" />,
        text: 'Completed'
      },
      pending: {
        class: 'bg-yellow-100 text-yellow-800',
        icon: <Clock size={12} className="mr-1" />,
        text: 'Pending'
      },
      failed: {
        class: 'bg-red-100 text-red-800',
        icon: <XCircle size={12} className="mr-1" />,
        text: 'Failed'
      },
      refunded: {
        class: 'bg-blue-100 text-blue-800',
        icon: <XCircle size={12} className="mr-1" />,
        text: 'Refunded'
      }
    }
    return badges[status] || badges.completed
  }

  const handleEdit = (transaction) => {
    setSelectedTransaction(transaction)
    setShowEditModal(true)
  }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    setSelectedTransaction(null)
    queryClient.invalidateQueries(['transactions'])
  }

  // Void a transaction (soft delete)
  const handleVoidTransaction = async (id, reason) => {
    await transactionsAPI.voidTransaction(id, reason)
    queryClient.invalidateQueries(['transactions'])
  }

  // Restore a voided transaction
  const handleRestoreTransaction = async (id) => {
    await transactionsAPI.restoreTransaction(id, 'Restored from transactions list')
    queryClient.invalidateQueries(['transactions'])
  }

  // Inline edit handler
  const handleFieldUpdate = async (recordId, fieldName, newValue) => {
    try {
      await transactionsAPI.updateTransaction(recordId, { [fieldName]: newValue })
      queryClient.invalidateQueries(['transactions'])
    } catch (error) {
      console.error('Failed to update transaction:', error)
      throw error
    }
  }

  // Render cell content for DataTable
  const renderCell = useCallback((transaction, column) => {
    const statusBadge = getStatusBadge(transaction.status)
    switch (column.key) {
      case 'payment_date':
        return (
          <div className="flex items-center text-sm text-gray-900 font-mono">
            <Calendar size={14} className="mr-2 text-gray-400" />
            {formatDate(transaction.payment_date)}
          </div>
        )
      case 'transaction_id':
        return (
          <span className="text-sm font-medium text-gray-900">
            {transaction.transaction_id || 'Unknown'}
          </span>
        )
      case 'account_name':
        return transaction.account_id ? (
          <Link
            to={`/accounts/${transaction.account_id}`}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {transaction.account_name || 'Unknown Account'}
          </Link>
        ) : (
          <span className="text-sm text-gray-500">No account</span>
        )
      case 'contact_name':
        return transaction.contact_id ? (
          <Link
            to={`/contacts/${transaction.contact_id}`}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {transaction.contact_name || 'Unknown Contact'}
          </Link>
        ) : (
          <span className="text-sm text-gray-500">No contact</span>
        )
      case 'amount':
        return (
          <span className="text-sm font-semibold text-green-600">
            {formatCurrency(transaction.amount, transaction.currency || 'CAD')}
          </span>
        )
      case 'currency':
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            transaction.currency === 'USD'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {transaction.currency || 'CAD'}
          </span>
        )
      case 'status':
        return (
          <InlineEditCell
            value={transaction.status}
            fieldName="status"
            fieldType="select"
            recordId={transaction.id}
            entityType="transactions"
            onSave={handleFieldUpdate}
            options={TRANSACTION_STATUSES.map(s => ({ value: s.value, label: s.label }))}
            displayValue={
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusBadge.class}`}>
                {statusBadge.icon}
                {statusBadge.text}
              </span>
            }
          />
        )
      case 'source':
        return (
          <InlineEditCell
            value={transaction.source}
            fieldName="source"
            fieldType="select"
            recordId={transaction.id}
            entityType="transactions"
            onSave={handleFieldUpdate}
            options={[
              { value: 'website', label: 'Website' },
              { value: 'phone', label: 'Phone' },
              { value: 'email', label: 'Email' },
              { value: 'referral', label: 'Referral' },
              { value: 'walk-in', label: 'Walk-in' },
              { value: 'partner', label: 'Partner' }
            ]}
            className="text-sm"
          />
        )
      case 'payment_method':
        return (
          <InlineEditCell
            value={transaction.payment_method}
            fieldName="payment_method"
            fieldType="select"
            recordId={transaction.id}
            entityType="transactions"
            onSave={handleFieldUpdate}
            options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
            icon={<CreditCard size={14} />}
            className="text-sm"
          />
        )
      case 'created_by':
        return (
          <div className="flex items-center text-sm text-gray-700">
            <User size={14} className="mr-2 text-gray-400" />
            {transaction.created_by_name || 'Unknown'}
          </div>
        )
      default:
        return <span className="text-gray-500">&mdash;</span>
    }
  }, [handleFieldUpdate])

  // Render row actions for DataTable
  const renderRowActions = useCallback((transaction) => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(`/transactions/${transaction.id}`)}
        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
        title="View Details"
      >
        <Eye size={16} />
      </button>
      {!transaction.is_void && !transaction.deleted_at && (
        <button
          onClick={() => handleEdit(transaction)}
          className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          title="Edit Transaction"
        >
          <Edit size={16} />
        </button>
      )}
      <TransactionActions
        transaction={transaction}
        onVoid={handleVoidTransaction}
        onRestore={handleRestoreTransaction}
        onRefresh={() => queryClient.invalidateQueries(['transactions'])}
      />
    </div>
  ), [navigate, queryClient])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-1">Track all payment transactions and revenue</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportAll}
            className="btn btn-secondary btn-md"
            title="Export all transactions matching current filters"
          >
            <Download size={16} className="mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Revenue (CAD) */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue (CAD)</p>
              <p className="text-2xl font-bold text-green-600">
                {revenueStats && !loadingRevenue
                  ? formatCurrency(revenueStats.total_revenue_cad, 'CAD')
                  : formatCurrency(0, 'CAD')
                }
              </p>
              {revenueStats && revenueStats.breakdown && (
                <p className="text-xs text-gray-500 mt-1">
                  ${revenueStats.breakdown.cad_revenue.toFixed(2)} CAD + ${revenueStats.breakdown.usd_revenue.toFixed(2)} USD
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalTransactions}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">This Month</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(stats.thisMonthRevenue, 'CAD')}
              </p>
              {revenueStats && revenueStats.this_month_breakdown && (
                <p className="text-xs text-gray-500 mt-1">
                  ${revenueStats.this_month_breakdown.cad_revenue.toFixed(2)} CAD + ${revenueStats.this_month_breakdown.usd_revenue.toFixed(2)} USD
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        {/* Average Transaction */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average Transaction</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(stats.avgTransaction, 'CAD')}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="input"
          >
            <option value="all">All Methods</option>
            <option value="Credit Card">Credit Card</option>
            <option value="PayPal">PayPal</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
            <option value="Check">Check</option>
          </select>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="input"
          >
            <option value="all">All Sources</option>
            <option value="website">Website</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="referral">Referral</option>
            <option value="walk-in">Walk-in</option>
            <option value="partner">Partner</option>
          </select>
        </div>

        {/* Show Voided Toggle */}
        <div className="flex items-center mt-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Show voided</span>
          </label>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <DataTable
          data={transactions}
          loading={isLoading}
          entityName="Transaction"
          entityType="transactions"
          rowKey="id"
          columns={COLUMN_DEFINITIONS}
          visibleColumns={visibleColumns}
          onColumnToggle={handleColumnToggle}
          onColumnsReset={handleResetColumns}
          sortConfig={sortConfig}
          onSort={handleSort}
          pagination={{ page: currentPage, limit: pageSize, total: totalCount }}
          onPaginationChange={handlePaginationChange}
          pageSizeOptions={[25, 50, 100]}
          selectable
          selectedIds={selectedTransactions}
          onSelectionChange={setSelectedTransactions}
          bulkActions={[
            { label: 'Export', icon: Download, onClick: handleBulkExport },
            { label: 'Void', icon: XCircle, onClick: () => setShowBulkDeleteModal(true), variant: 'danger' },
          ]}
          renderCell={renderCell}
          renderRowActions={renderRowActions}
          getRowClassName={(row) => (row.is_void || row.deleted_at) ? 'opacity-50 bg-gray-50' : ''}
          emptyIcon={DollarSign}
          emptyMessage="No transactions found"
          emptySubMessage={
            searchTerm || filterStatus !== 'all' || filterMethod !== 'all' || filterSource !== 'all'
              ? 'Try adjusting your filters'
              : 'Transaction records will appear here once they are created'
          }
        />
      </div>

      {/* Bulk Void Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Void Selected Transactions"
        message={`Are you sure you want to void ${selectedTransactions.length} transaction${selectedTransactions.length !== 1 ? 's' : ''}? Voided transactions will be excluded from revenue calculations but can be restored later.`}
        confirmButtonText={`Void ${selectedTransactions.length} Transaction${selectedTransactions.length !== 1 ? 's' : ''}`}
        isDestructive
        loading={bulkDeleting}
      />

      {/* Edit Transaction Modal */}
      {showEditModal && selectedTransaction && (
        <EditTransactionModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowEditModal(false)
            setSelectedTransaction(null)
          }}
          onSuccess={handleEditSuccess}
          isOpen={showEditModal}
        />
      )}
    </div>
  )
}

export default TransactionsPage
