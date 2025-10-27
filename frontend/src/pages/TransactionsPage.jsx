import React, { useState } from 'react'
import {
  DollarSign,
  Search,
  Calendar,
  Download,
  Filter,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  FileText
} from 'lucide-react'
import ColumnSelector from '../components/ColumnSelector'
import InlineEditCell from '../components/InlineEditCell'
import { transactionsAPI } from '../services/api'

// Define available columns with metadata
const COLUMN_DEFINITIONS = [
  { key: 'transaction_id', label: 'Transaction ID', description: 'Transaction identifier', required: true },
  { key: 'contact', label: 'Contact', description: 'Contact name and email', required: false },
  { key: 'amount', label: 'Amount', description: 'Transaction amount', required: false },
  { key: 'date', label: 'Date', description: 'Transaction date', required: false },
  { key: 'method', label: 'Payment Method', description: 'Payment method used', required: false },
  { key: 'cycle', label: 'Billing Cycle', description: 'Billing cycle', required: false },
  { key: 'status', label: 'Status', description: 'Transaction status', required: false }
]

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = {
  transaction_id: true,
  contact: true,
  amount: true,
  date: true,
  method: true,
  cycle: false,
  status: true
}

// Payment method options
const PAYMENT_METHOD_OPTIONS = [
  { value: 'Credit Card', label: 'Credit Card' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Cash', label: 'Cash' }
]

// Billing cycle options
const BILLING_CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi-annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' }
]

// Status options
const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' }
]

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([])
  const [localTransactions, setLocalTransactions] = useState([]) // For optimistic updates
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [dateRange, setDateRange] = useState('all')

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

  // Inline edit handler with optimistic updates
  const handleFieldUpdate = async (recordId, fieldName, newValue) => {
    // Optimistic update: immediately update local state
    setLocalTransactions(prevTransactions =>
      prevTransactions.map(transaction =>
        transaction.id === recordId
          ? { ...transaction, [fieldName]: newValue }
          : transaction
      )
    )

    try {
      // Make API call to update the transaction
      await transactionsAPI.updateTransaction(recordId, { [fieldName]: newValue })

      // Also update the main transactions state for consistency
      setTransactions(prevTransactions =>
        prevTransactions.map(transaction =>
          transaction.id === recordId
            ? { ...transaction, [fieldName]: newValue }
            : transaction
        )
      )
    } catch (error) {
      // Error is thrown back to InlineEditCell for rollback
      console.error('Failed to update transaction:', error)
      throw error
    }
  }

  // Mock transaction data
  const mockTransactions = [
    {
      id: 'TXN-2024-001',
      account_id: 'ACC001',
      contact_name: 'John Doe',
      contact_email: 'john@example.com',
      amount: 99,
      transaction_date: '2024-10-01',
      payment_method: 'Credit Card',
      billing_cycle: 'monthly',
      status: 'completed',
      notes: 'Renewal payment'
    },
    {
      id: 'TXN-2024-002',
      account_id: 'ACC002',
      contact_name: 'Jane Smith',
      contact_email: 'jane@example.com',
      amount: 237,
      transaction_date: '2024-09-15',
      payment_method: 'PayPal',
      billing_cycle: 'quarterly',
      status: 'completed',
      notes: 'Quarterly subscription'
    },
    {
      id: 'TXN-2024-003',
      account_id: 'ACC001',
      contact_name: 'John Doe',
      contact_email: 'john@example.com',
      amount: 99,
      transaction_date: '2024-09-01',
      payment_method: 'Credit Card',
      billing_cycle: 'monthly',
      status: 'completed',
      notes: 'Monthly renewal'
    },
    {
      id: 'TXN-2024-004',
      account_id: 'ACC003',
      contact_name: 'Bob Wilson',
      contact_email: 'bob@example.com',
      amount: 588,
      transaction_date: '2024-08-10',
      payment_method: 'Bank Transfer',
      billing_cycle: 'annual',
      status: 'pending',
      notes: 'Annual subscription - awaiting confirmation'
    },
    {
      id: 'TXN-2024-005',
      account_id: 'ACC004',
      contact_name: 'Alice Johnson',
      contact_email: 'alice@example.com',
      amount: 149,
      transaction_date: '2024-08-05',
      payment_method: 'Credit Card',
      billing_cycle: 'monthly',
      status: 'failed',
      notes: 'Payment declined - card expired'
    }
  ]

  // Use localTransactions for display (optimistic updates), fallback to transactions or mockTransactions
  const sourceTransactions = transactions.length > 0 ? transactions : mockTransactions
  const displayTransactions = localTransactions.length > 0 ? localTransactions : sourceTransactions

  // Initialize localTransactions when source changes
  React.useEffect(() => {
    setLocalTransactions(sourceTransactions)
  }, [transactions.length, mockTransactions.length])

  // Calculate statistics
  const stats = {
    totalRevenue: displayTransactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0),
    completedTransactions: displayTransactions.filter(t => t.status === 'completed').length,
    pendingTransactions: displayTransactions.filter(t => t.status === 'pending').length,
    failedTransactions: displayTransactions.filter(t => t.status === 'failed').length,
    avgTransaction: displayTransactions.filter(t => t.status === 'completed').length > 0
      ? displayTransactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0) /
        displayTransactions.filter(t => t.status === 'completed').length
      : 0
  }

  const getStatusBadge = (status) => {
    const badges = {
      completed: {
        class: 'badge badge-success',
        icon: <CheckCircle size={12} className="mr-1" />,
        text: 'Completed'
      },
      pending: {
        class: 'badge badge-warning',
        icon: <Clock size={12} className="mr-1" />,
        text: 'Pending'
      },
      failed: {
        class: 'badge badge-danger',
        icon: <XCircle size={12} className="mr-1" />,
        text: 'Failed'
      }
    }
    return badges[status] || badges.completed
  }

  const getStatusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPaymentMethodIcon = (method) => {
    return <CreditCard size={14} className="mr-1" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-1">Track all payment transactions from your customers</p>
        </div>
        <button className="btn btn-primary btn-md">
          <Download size={16} className="mr-2" />
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                ${stats.totalRevenue.toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-2xl font-bold text-blue-600">{stats.completedTransactions}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingTransactions}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Transaction</p>
              <p className="text-2xl font-bold text-purple-600">
                ${stats.avgTransaction.toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-purple-600" size={24} />
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
              placeholder="Search by contact or account..."
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
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Transaction History Table */}
      <div className="card">
        {/* Toolbar */}
        {displayTransactions.length > 0 && (
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">
                {displayTransactions.length} {displayTransactions.length === 1 ? 'Transaction' : 'Transactions'}
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

        {displayTransactions.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
            <p className="text-gray-600">Transaction records will appear here once they are recorded</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {visibleColumns.transaction_id && <th className="text-left py-3 px-4 font-medium text-gray-900">Transaction ID</th>}
                  {visibleColumns.contact && <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>}
                  {visibleColumns.amount && <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>}
                  {visibleColumns.date && <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>}
                  {visibleColumns.method && <th className="text-left py-3 px-4 font-medium text-gray-900">Method</th>}
                  {visibleColumns.cycle && <th className="text-left py-3 px-4 font-medium text-gray-900">Cycle</th>}
                  {visibleColumns.status && <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>}
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayTransactions.map((transaction) => {
                  const statusBadge = getStatusBadge(transaction.status)
                  return (
                    <tr key={transaction.id} className="border-b border-gray-100">
                      {visibleColumns.transaction_id && (
                        <td className="py-4 px-4">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {transaction.id}
                          </span>
                        </td>
                      )}
                      {visibleColumns.contact && (
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{transaction.contact_name}</p>
                            <p className="text-sm text-gray-600">{transaction.contact_email}</p>
                          </div>
                        </td>
                      )}
                      {visibleColumns.amount && (
                        <td className="py-4 px-4">
                          <InlineEditCell
                            value={transaction.amount}
                            fieldName="amount"
                            fieldType="number"
                            recordId={transaction.id}
                            entityType="transactions"
                            onSave={handleFieldUpdate}
                            prefix="$"
                            placeholder="0"
                            className="text-lg font-bold text-green-600"
                          />
                        </td>
                      )}
                      {visibleColumns.date && (
                        <td className="py-4 px-4">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar size={12} className="mr-1" />
                            {transaction.transaction_date}
                          </div>
                        </td>
                      )}
                      {visibleColumns.method && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1">
                            {getPaymentMethodIcon(transaction.payment_method)}
                            <InlineEditCell
                              value={transaction.payment_method}
                              fieldName="payment_method"
                              fieldType="select"
                              recordId={transaction.id}
                              entityType="transactions"
                              onSave={handleFieldUpdate}
                              options={PAYMENT_METHOD_OPTIONS}
                              className="text-sm"
                            />
                          </div>
                        </td>
                      )}
                      {visibleColumns.cycle && (
                        <td className="py-4 px-4">
                          <InlineEditCell
                            value={transaction.billing_cycle}
                            fieldName="billing_cycle"
                            fieldType="select"
                            recordId={transaction.id}
                            entityType="transactions"
                            onSave={handleFieldUpdate}
                            options={BILLING_CYCLE_OPTIONS}
                            displayValue={
                              <span className="badge badge-gray">{transaction.billing_cycle}</span>
                            }
                          />
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-4 px-4">
                          <InlineEditCell
                            value={transaction.status}
                            fieldName="status"
                            fieldType="select"
                            recordId={transaction.id}
                            entityType="transactions"
                            onSave={handleFieldUpdate}
                            options={STATUS_OPTIONS}
                            displayValue={
                              <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(transaction.status)}`}>
                                {statusBadge.icon}
                                {statusBadge.text}
                              </span>
                            }
                          />
                        </td>
                      )}
                      <td className="py-4 px-4">
                        <button className="btn btn-sm btn-outline">
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination placeholder */}
        {displayTransactions.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600">
              Showing {displayTransactions.length} transaction(s)
            </p>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-outline" disabled>Previous</button>
              <button className="btn btn-sm btn-outline" disabled>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Summary</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-3" size={20} />
              <div>
                <p className="font-medium text-gray-900">Completed Transactions</p>
                <p className="text-sm text-gray-600">{stats.completedTransactions} transactions</p>
              </div>
            </div>
            <p className="text-lg font-bold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
          </div>

          {stats.pendingTransactions > 0 && (
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <Clock className="text-yellow-600 mr-3" size={20} />
                <div>
                  <p className="font-medium text-gray-900">Pending Transactions</p>
                  <p className="text-sm text-gray-600">Awaiting confirmation</p>
                </div>
              </div>
              <p className="text-lg font-bold text-yellow-600">{stats.pendingTransactions}</p>
            </div>
          )}

          {stats.failedTransactions > 0 && (
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <XCircle className="text-red-600 mr-3" size={20} />
                <div>
                  <p className="font-medium text-gray-900">Failed Transactions</p>
                  <p className="text-sm text-gray-600">Requires attention</p>
                </div>
              </div>
              <p className="text-lg font-bold text-red-600">{stats.failedTransactions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TransactionsPage
