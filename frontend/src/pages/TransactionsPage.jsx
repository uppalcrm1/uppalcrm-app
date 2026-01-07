import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  Search,
  Calendar,
  Download,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Eye,
  Edit,
  Trash2,
  FileText,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { transactionsAPI } from '../services/api'
import EditTransactionModal from '../components/EditTransactionModal'
import ColumnSelector from '../components/ColumnSelector'
import { formatSource, formatPaymentMethod } from '../constants/transactions'
import { formatDateOnly } from '../utils/dateUtils'
import { formatCurrency } from '../utils/currency'

// Define available columns with metadata
const COLUMN_DEFINITIONS = [
  { key: 'payment_date', label: 'Payment Date', description: 'Transaction payment date', required: true },
  { key: 'transaction_id', label: 'Transaction ID', description: 'Unique transaction identifier', required: true },
  { key: 'account_name', label: 'Account Name', description: 'Associated account', required: false },
  { key: 'contact_name', label: 'Contact Name', description: 'Associated contact', required: false },
  { key: 'amount', label: 'Amount', description: 'Transaction amount', required: true },
  { key: 'currency', label: 'Currency', description: 'Transaction currency (CAD or USD)', required: false },
  { key: 'status', label: 'Status', description: 'Transaction status', required: false },
  { key: 'source', label: 'Source', description: 'Payment source', required: false },
  { key: 'payment_method', label: 'Payment Method', description: 'Payment method used', required: false },
  { key: 'actions', label: 'Actions', description: 'Transaction actions', required: true }
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
  actions: true
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
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [revenueStats, setRevenueStats] = useState(null)
  const [loadingRevenue, setLoadingRevenue] = useState(false)
  const [sortDirection, setSortDirection] = useState('desc') // 'asc' or 'desc'

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

  // Fetch transactions on component mount
  useEffect(() => {
    fetchTransactions()
    fetchRevenueStats()
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await transactionsAPI.getTransactions()
      setTransactions(response.transactions || [])
      // Also refresh revenue stats when transactions change
      fetchRevenueStats()
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRevenueStats = async () => {
    try {
      setLoadingRevenue(true)
      const response = await transactionsAPI.getRevenueStats()
      setRevenueStats(response)
    } catch (error) {
      console.error('Error fetching revenue stats:', error)
    } finally {
      setLoadingRevenue(false)
    }
  }

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

  // Toggle sort direction
  const handleToggleSort = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  // Filter transactions
  const filteredTransactions = transactions.filter(transaction => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        (transaction.transaction_id || '').toLowerCase().includes(query) ||
        (transaction.account_name || '').toLowerCase().includes(query) ||
        (transaction.contact_name || '').toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Status filter
    if (filterStatus !== 'all' && transaction.status !== filterStatus) {
      return false
    }

    // Payment method filter
    if (filterMethod !== 'all' && transaction.payment_method !== filterMethod) {
      return false
    }

    // Source filter
    if (filterSource !== 'all' && transaction.source !== filterSource) {
      return false
    }

    return true
  })

  // Sort transactions by payment date
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const dateA = new Date(a.payment_date || 0)
    const dateB = new Date(b.payment_date || 0)
    
    if (sortDirection === 'asc') {
      return dateA - dateB
    } else {
      return dateB - dateA
    }
  })

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

  const handleView = (id) => {
    console.log('View transaction:', id)
    // TODO: Navigate to transaction details page
  }

  const handleEdit = (transaction) => {
    setSelectedTransaction(transaction)
    setShowEditModal(true)
  }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    setSelectedTransaction(null)
    fetchTransactions() // Refresh the list
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await transactionsAPI.deleteTransaction(id)
        fetchTransactions() // Refresh the list
      } catch (error) {
        console.error('Error deleting transaction:', error)
        alert('Failed to delete transaction')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-1">Track all payment transactions and revenue</p>
        </div>
        <button className="btn btn-primary btn-md">
          <Download size={16} className="mr-2" />
          Export Report
        </button>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
      </div>

      {/* Transactions Table */}
      <div className="card">
        {/* Toolbar */}
        {!loading && filteredTransactions.length > 0 && (
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">
                {filteredTransactions.length} {filteredTransactions.length === 1 ? 'Transaction' : 'Transactions'}
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

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
            <p className="text-gray-600">
              {searchQuery || filterStatus !== 'all' || filterMethod !== 'all' || filterSource !== 'all'
                ? 'Try adjusting your filters'
                : 'Transaction records will appear here once they are created'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {visibleColumns.payment_date && (
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      <button
                        onClick={handleToggleSort}
                        className="flex items-center gap-2 hover:text-primary-600 transition-colors"
                      >
                        Payment Date
                        {sortDirection === 'asc' ? (
                          <ArrowUp size={16} className="text-primary-600" />
                        ) : (
                          <ArrowDown size={16} className="text-primary-600" />
                        )}
                      </button>
                    </th>
                  )}
                  {visibleColumns.transaction_id && <th className="text-left py-3 px-4 font-medium text-gray-900">Transaction ID</th>}
                  {visibleColumns.account_name && <th className="text-left py-3 px-4 font-medium text-gray-900">Account Name</th>}
                  {visibleColumns.contact_name && <th className="text-left py-3 px-4 font-medium text-gray-900">Contact Name</th>}
                  {visibleColumns.amount && <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>}
                  {visibleColumns.currency && <th className="text-left py-3 px-4 font-medium text-gray-900">Currency</th>}
                  {visibleColumns.status && <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>}
                  {visibleColumns.source && <th className="text-left py-3 px-4 font-medium text-gray-900">Source</th>}
                  {visibleColumns.payment_method && <th className="text-left py-3 px-4 font-medium text-gray-900">Payment Method</th>}
                  {visibleColumns.actions && <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((transaction) => {
                  const statusBadge = getStatusBadge(transaction.status)
                  return (
                    <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {/* Column 1: Payment Date */}
                      {visibleColumns.payment_date && (
                        <td className="py-4 px-4">
                          <div className="flex items-center text-sm text-gray-900 font-mono">
                            <Calendar size={14} className="mr-2 text-gray-400" />
                            {formatDate(transaction.payment_date)}
                          </div>
                        </td>
                      )}

                      {/* Column 2: Transaction ID */}
                      {visibleColumns.transaction_id && (
                        <td className="py-4 px-4">
                          <span className="text-sm font-medium text-gray-900">
                            {transaction.transaction_id || 'Unknown'}
                          </span>
                        </td>
                      )}

                      {/* Column 3: Account Name */}
                      {visibleColumns.account_name && (
                        <td className="py-4 px-4">
                          {transaction.account_id ? (
                            <Link
                              to={`/accounts/${transaction.account_id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {transaction.account_name || 'Unknown Account'}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-500">No account</span>
                          )}
                        </td>
                      )}

                      {/* Column 4: Contact Name */}
                      {visibleColumns.contact_name && (
                        <td className="py-4 px-4">
                          {transaction.contact_id ? (
                            <Link
                              to={`/contacts/${transaction.contact_id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {transaction.contact_name || 'Unknown Contact'}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-500">No contact</span>
                          )}
                        </td>
                      )}

                      {/* Column 5: Amount */}
                      {visibleColumns.amount && (
                        <td className="py-4 px-4">
                          <span className="text-sm font-semibold text-green-600">
                            {formatCurrency(transaction.amount, transaction.currency || 'CAD')}
                          </span>
                        </td>
                      )}

                      {/* Column 6: Currency */}
                      {visibleColumns.currency && (
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.currency === 'USD'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {transaction.currency || 'CAD'}
                          </span>
                        </td>
                      )}

                      {/* Column 7: Status */}
                      {visibleColumns.status && (
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusBadge.class}`}>
                            {statusBadge.icon}
                            {statusBadge.text}
                          </span>
                        </td>
                      )}

                      {/* Column 8: Source */}
                      {visibleColumns.source && (
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-700">
                            {formatSource(transaction.source)}
                          </span>
                        </td>
                      )}

                      {/* Column 9: Payment Method */}
                      {visibleColumns.payment_method && (
                        <td className="py-4 px-4">
                          <div className="flex items-center text-sm text-gray-700">
                            <CreditCard size={14} className="mr-2 text-gray-400" />
                            {formatPaymentMethod(transaction.payment_method)}
                          </div>
                        </td>
                      )}

                      {/* Column 10: Actions */}
                      {visibleColumns.actions && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleView(transaction.id)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleEdit(transaction)}
                              className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                              title="Edit Transaction"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(transaction.id)}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                              title="Delete Transaction"
                            >
                              <Trash2 size={16} />
                            </button>
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
      </div>

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
