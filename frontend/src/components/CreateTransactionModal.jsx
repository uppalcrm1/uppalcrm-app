import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  DollarSign,
  CreditCard,
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  Edit,
  Check,
  RotateCcw,
  User,
  Package
} from 'lucide-react'
import { transactionsAPI } from '../services/api'
import toast from 'react-hot-toast'
import {
  PAYMENT_METHODS,
  TRANSACTION_SOURCES,
  BILLING_TERMS
} from '../constants/transactions'

const CreateTransactionModal = ({ account, onClose, onSuccess, isOpen }) => {
  // State for form data
  const [formData, setFormData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0], // Default to today
    status: 'completed',
    payment_method: 'Credit Card',
    source: 'manual',
    term: '',
    transaction_reference: '',
    notes: '',
    currency: 'USD'
  })

  const [isAmountOverridden, setIsAmountOverridden] = useState(false)
  const [errors, setErrors] = useState({})

  const queryClient = useQueryClient()

  // Helper function to map billing cycle to term
  const mapBillingCycleToTerm = (cycle) => {
    const mapping = {
      'monthly': '1',
      'quarterly': '3',
      'semi-annual': '6',
      'semi_annual': '6',
      'annual': '12',
      'yearly': '12'
    }
    return mapping[cycle?.toLowerCase()] || '1'
  }

  // Auto-calculate amount from account price
  useEffect(() => {
    if (!isAmountOverridden && account?.price) {
      setFormData(prev => ({
        ...prev,
        amount: account.price.toString()
      }))
    }
  }, [account?.price, isAmountOverridden])

  // Auto-fill term from account billing cycle
  useEffect(() => {
    if (account?.billing_cycle) {
      setFormData(prev => ({
        ...prev,
        term: mapBillingCycleToTerm(account.billing_cycle)
      }))
    }
  }, [account?.billing_cycle])

  // Mutation for creating transaction
  const createTransactionMutation = useMutation({
    mutationFn: (data) => transactionsAPI.createTransaction(data),
    onSuccess: (response) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries(['transactions'])
      queryClient.invalidateQueries(['accounts'])

      toast.success('Transaction created successfully')
      onSuccess()
      onClose()
    },
    onError: (error) => {
      console.error('Transaction creation failed:', error)

      // Handle validation errors from backend
      const details = error.response?.data?.details
      if (details && Array.isArray(details)) {
        const fieldErrors = {}
        details.forEach(err => {
          const field = err.path?.[0] || err.field
          fieldErrors[field] = err.message
        })
        setErrors(fieldErrors)
        toast.error('Please fix validation errors')
      } else {
        const message = error.response?.data?.message || 'Failed to create transaction'
        toast.error(message)
      }
    }
  })

  // Validate form
  const validateForm = () => {
    const newErrors = {}

    if (!formData.amount || parseFloat(formData.amount) < 0) {
      newErrors.amount = 'Amount must be a positive number'
    }

    if (!formData.status) {
      newErrors.status = 'Status is required'
    }

    if (!formData.payment_method) {
      newErrors.payment_method = 'Payment method is required'
    }

    if (!formData.term) {
      newErrors.term = 'Billing term is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const transactionData = {
      account_id: account.id,
      contact_id: account.contact_id,
      product_id: account.product_id || null,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      status: formData.status,
      payment_method: formData.payment_method,
      payment_date: formData.payment_date,
      source: formData.source,
      term: formData.term,
      transaction_reference: formData.transaction_reference || null,
      notes: formData.notes || null
    }

    createTransactionMutation.mutate(transactionData)
  }

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Handle amount change with override tracking
  const handleAmountChange = (e) => {
    const value = e.target.value
    setIsAmountOverridden(true)
    setFormData(prev => ({ ...prev, amount: value }))

    // Clear error for amount
    if (errors.amount) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.amount
        return newErrors
      })
    }
  }

  // Reset amount to auto-calculated value
  const handleResetAmount = () => {
    setIsAmountOverridden(false)
    setFormData(prev => ({
      ...prev,
      amount: account.price ? account.price.toString() : ''
    }))
  }

  // Close modal on ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // ✅ CRITICAL: Prevent creating transactions without an account (business rule enforcement)
  if (!account || !account.id) {
    console.error('CreateTransactionModal: Cannot create transaction without an account')
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center mb-4">
            <AlertCircle className="text-red-600 mr-2" size={24} />
            <h3 className="text-lg font-semibold text-red-600">Error</h3>
          </div>
          <p className="text-gray-700 mb-4">
            Cannot create transaction without selecting an account. Please select an account first.
          </p>
          <button onClick={onClose} className="btn btn-primary w-full">
            Close
          </button>
        </div>
      </div>
    )
  }

  const isSubmitting = createTransactionMutation.isPending

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <DollarSign size={24} className="mr-2 text-blue-600" />
              Create Transaction
            </h2>
            <p className="text-sm text-gray-500 mt-1">Record a payment for this account</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            disabled={isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        {/* Context Information */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-3">
            {/* Account Badge */}
            <div className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              <Package size={14} className="mr-1" />
              <span className="font-medium">Account:</span>
              <span className="ml-1">{account?.account_name || 'Unknown'}</span>
            </div>

            {/* Contact Badge */}
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
              <User size={14} className="mr-1" />
              <span className="font-medium">Contact:</span>
              <span className="ml-1">{account?.contact_name || 'Unknown'}</span>
            </div>

            {/* Product Badge (if available) */}
            {account?.edition && (
              <div className="flex items-center bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                <CreditCard size={14} className="mr-1" />
                <span className="font-medium">Product:</span>
                <span className="ml-1">{account.edition}</span>
              </div>
            )}
          </div>

          {/* Warning Messages */}
          {!account?.product_id && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-800 flex items-center">
                <Info size={14} className="mr-2 flex-shrink-0" />
                No product assigned to this account
              </p>
            </div>
          )}

          {(!account?.price || account?.price === 0) && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-blue-800 flex items-center">
                <Info size={14} className="mr-2 flex-shrink-0" />
                No price set for this account - please enter amount manually
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 space-y-6">
            {/* Two Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Amount Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleAmountChange}
                        min="0"
                        step="0.01"
                        required
                        className={`input pl-10 ${errors.amount ? 'border-red-500' : ''}`}
                        placeholder="0.00"
                      />
                    </div>
                    {isAmountOverridden && account?.price && (
                      <button
                        type="button"
                        onClick={handleResetAmount}
                        className="btn btn-secondary btn-sm flex items-center"
                        title="Reset to calculated amount"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                  {isAmountOverridden && account?.price ? (
                    <span className="text-xs text-orange-600 mt-1 flex items-center">
                      <Edit size={12} className="mr-1" />
                      Manual override (original: ${account.price})
                    </span>
                  ) : (
                    account?.price && (
                      <span className="text-xs text-green-600 mt-1 flex items-center">
                        <Check size={12} className="mr-1" />
                        Auto-calculated from account price
                      </span>
                    )
                  )}
                  {errors.amount && (
                    <p className="text-red-600 text-sm mt-1">{errors.amount}</p>
                  )}
                </div>

                {/* Payment Date Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="payment_date"
                    value={formData.payment_date}
                    onChange={handleChange}
                    required
                    className={`input ${errors.payment_date ? 'border-red-500' : ''}`}
                  />
                  {errors.payment_date && (
                    <p className="text-red-600 text-sm mt-1">{errors.payment_date}</p>
                  )}
                </div>

                {/* Status Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    required
                    className={`select ${errors.status ? 'border-red-500' : ''}`}
                  >
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                  {errors.status && (
                    <p className="text-red-600 text-sm mt-1">{errors.status}</p>
                  )}
                </div>

                {/* Term Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Term <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="term"
                    value={formData.term}
                    onChange={handleChange}
                    required
                    className={`select ${errors.term ? 'border-red-500' : ''}`}
                  >
                    <option value="">Select term</option>
                    {BILLING_TERMS.map(term => (
                      <option key={term.value} value={term.value}>
                        {term.label}
                      </option>
                    ))}
                  </select>
                  {account?.billing_cycle && (
                    <span className="text-xs text-gray-500 mt-1 flex items-center">
                      <Info size={12} className="mr-1" />
                      Auto-filled from account billing cycle
                    </span>
                  )}
                  {errors.term && (
                    <p className="text-red-600 text-sm mt-1">{errors.term}</p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Payment Method Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="payment_method"
                    value={formData.payment_method}
                    onChange={handleChange}
                    required
                    className={`select ${errors.payment_method ? 'border-red-500' : ''}`}
                  >
                    {PAYMENT_METHODS.map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                  {errors.payment_method && (
                    <p className="text-red-600 text-sm mt-1">{errors.payment_method}</p>
                  )}
                </div>

                {/* Source Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <select
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    className="select"
                  >
                    {TRANSACTION_SOURCES.map(source => (
                      <option key={source.value} value={source.value}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500 mt-1">Where this payment came from</span>
                </div>

                {/* Transaction Reference Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Reference
                  </label>
                  <input
                    type="text"
                    name="transaction_reference"
                    value={formData.transaction_reference}
                    onChange={handleChange}
                    maxLength={255}
                    className="input"
                    placeholder="e.g., Invoice #12345, PayPal TX-ABC123"
                  />
                  <span className="text-xs text-gray-500 mt-1">Optional</span>
                </div>
              </div>
            </div>

            {/* Full Width Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="input"
                placeholder="Add any additional information about this transaction..."
              />
              <span className="text-xs text-gray-500 mt-1">Optional</span>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-md"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Object.keys(errors).length > 0}
              className="btn btn-primary btn-md flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Create Transaction
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateTransactionModal
