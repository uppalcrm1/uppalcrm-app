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
  User,
  Package
} from 'lucide-react'
import { transactionsAPI } from '../services/api'
import api from '../services/api'
import toast from 'react-hot-toast'
import {
  PAYMENT_METHODS,
  BILLING_TERMS
} from '../constants/transactions'

// Helper function to format date for input field (YYYY-MM-DD)
const formatDateForInput = (dateValue) => {
  if (!dateValue) return new Date().toISOString().split('T')[0]

  // If it's already a string in YYYY-MM-DD format, return it
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue
  }

  // If it's an ISO string or timestamp, extract the date part
  if (typeof dateValue === 'string') {
    return dateValue.split('T')[0]
  }

  // If it's a Date object, format it
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0]
  }

  // Fallback to today
  return new Date().toISOString().split('T')[0]
}

// Helper function to normalize term value to match BILLING_TERMS options
const normalizeTermValue = (termValue) => {
  if (!termValue) return ''

  const term = termValue.toString().toLowerCase().trim()

  // Map various term formats to standard values (1, 3, 6, 12)
  const termMap = {
    '1': '1',
    '1 month': '1',
    'monthly': '1',
    'month': '1',
    '3': '3',
    '3 months': '3',
    'quarterly': '3',
    'quarter': '3',
    '6': '6',
    '6 months': '6',
    'semi-annual': '6',
    'semi_annual': '6',
    'semiannual': '6',
    '12': '12',
    '12 months': '12',
    '1 year': '12',
    'annual': '12',
    'yearly': '12',
    'year': '12'
  }

  return termMap[term] || termValue.toString()
}

const EditTransactionModal = ({ transaction, onClose, onSuccess, isOpen }) => {

  // State for form data - pre-populate with existing transaction data
  const [formData, setFormData] = useState({
    amount: transaction?.amount?.toString() || '',
    payment_date: formatDateForInput(transaction?.payment_date),
    status: transaction?.status || 'completed',
    payment_method: transaction?.payment_method || 'Credit Card',
    source: transaction?.source || 'manual',
    term: normalizeTermValue(transaction?.term),
    transaction_reference: transaction?.transaction_reference || '',
    notes: transaction?.notes || '',
    currency: transaction?.currency || 'USD'
  })

  const [errors, setErrors] = useState({})
  const [paymentMethodOptions, setPaymentMethodOptions] = useState([
    'Credit Card', 'Debit Card', 'Bank Transfer', 'PayPal', 'Cash'
  ]) // Default options, will be replaced by field configuration
  const [sourceOptions, setSourceOptions] = useState([]) // Will be loaded from custom_field_definitions via API
  const queryClient = useQueryClient()

  // Update form data when transaction changes
  useEffect(() => {
    if (transaction) {
      console.log('📝 EditTransactionModal - Received transaction:', transaction)
      console.log('📅 Payment date value:', transaction.payment_date)
      console.log('📋 Term value:', transaction.term)

      const formattedDate = formatDateForInput(transaction.payment_date)
      const normalizedTerm = normalizeTermValue(transaction.term)

      setFormData({
        amount: transaction.amount?.toString() || '',
        payment_date: formattedDate,
        status: transaction.status || 'completed',
        payment_method: transaction.payment_method || 'Credit Card',
        source: transaction.source || 'manual',
        term: normalizedTerm,
        transaction_reference: transaction.transaction_reference || '',
        notes: transaction.notes || '',
        currency: transaction.currency || 'USD'
      })

      console.log('✅ Form data initialized:', {
        payment_date: formattedDate,
        term: normalizedTerm,
        raw_term: transaction.term
      })
    }
  }, [transaction])

  // Fetch field configuration for payment_method and source
  useEffect(() => {
    const loadFieldOptions = async () => {
      try {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = Date.now();
        const response = await api.get(`/custom-fields?entity_type=transactions&_t=${timestamp}`)
        const customFields = response.data.customFields || []
        const systemFields = response.data.systemFields || []
        const allFields = [...customFields, ...systemFields]

        console.log('📋 All transaction fields:', allFields)

        // Find the payment_method field
        const paymentMethodField = allFields.find(
          field => field.field_name === 'payment_method' || field.field_name === 'paymentMethod'
        )

        console.log('🔍 Payment method field found:', paymentMethodField)
        if (paymentMethodField) {
          console.log('   - Field label:', paymentMethodField.field_label)
          console.log('   - Field type:', paymentMethodField.field_type)
          console.log('   - Field options:', paymentMethodField.field_options)
        }

        if (paymentMethodField && paymentMethodField.field_options && paymentMethodField.field_options.length > 0) {
          // Extract labels from field options
          const options = paymentMethodField.field_options.map(opt =>
            typeof opt === 'string' ? opt : opt.label || opt.value
          )
          setPaymentMethodOptions(options)
          console.log('✅ Loaded payment method options from field config:', options)
        } else {
          console.log('⚠️ No payment_method field found or no options configured, using defaults')
        }

        // Find the source field (check both customFields and systemFields)
        const sourceField = allFields.find(
          field => field.field_name === 'source'
        )

        console.log('🔍 Source field found:', sourceField)

        if (sourceField && sourceField.field_options && sourceField.field_options.length > 0) {
          // Extract value/label pairs from field options
          const options = sourceField.field_options.map(opt => {
            if (typeof opt === 'string') {
              return { value: opt.toLowerCase().replace(/\s+/g, '-'), label: opt }
            }
            return { value: opt.value || opt.label, label: opt.label || opt.value }
          })
          setSourceOptions(options)
          console.log('✅ Loaded source options from field config:', options)
        } else {
          console.log('⚠️ No source field found or no options configured, using defaults')
        }
      } catch (error) {
        console.warn('⚠️ Could not load field config, using defaults:', error)
        // Keep default options if API call fails
      }
    }

    loadFieldOptions()
  }, [])

  // Mutation for updating transaction
  const updateTransactionMutation = useMutation({
    mutationFn: (data) => transactionsAPI.updateTransaction(transaction.id, data),
    onSuccess: (response) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries(['transactions'])
      queryClient.invalidateQueries(['accounts'])

      toast.success('Transaction updated successfully')
      onSuccess()
      onClose()
    },
    onError: (error) => {
      console.error('Transaction update failed:', error)

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
        const message = error.response?.data?.message || 'Failed to update transaction'
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

    updateTransactionMutation.mutate(transactionData)
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

  if (!isOpen || !transaction) return null

  const isSubmitting = updateTransactionMutation.isPending

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Edit size={24} className="mr-2 text-blue-600" />
              Edit Transaction
            </h2>
            <p className="text-sm text-gray-500 mt-1">Update transaction details</p>
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
            {/* Transaction ID Badge */}
            <div className="flex items-center bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm">
              <FileText size={14} className="mr-1" />
              <span className="font-medium">ID:</span>
              <span className="ml-1">{transaction.transaction_id || 'N/A'}</span>
            </div>

            {/* Account Badge */}
            <div className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              <Package size={14} className="mr-1" />
              <span className="font-medium">Account:</span>
              <span className="ml-1">{transaction.account_name || 'Unknown'}</span>
            </div>

            {/* Contact Badge */}
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
              <User size={14} className="mr-1" />
              <span className="font-medium">Contact:</span>
              <span className="ml-1">{transaction.contact_name || 'Unknown'}</span>
            </div>
          </div>
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
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        required
                        className={`input pl-10 ${errors.amount ? 'border-red-500' : ''}`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  {errors.amount && (
                    <p className="text-red-600 text-sm mt-1">{errors.amount}</p>
                  )}
                </div>

                {/* Currency Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    required
                    className={`select ${errors.currency ? 'border-red-500' : ''}`}
                  >
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="USD">USD - US Dollar</option>
                  </select>
                  {errors.currency && (
                    <p className="text-red-600 text-sm mt-1">{errors.currency}</p>
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
                    <option value="refunded">Refunded</option>
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
                    {paymentMethodOptions.map((method, index) => (
                      <option key={index} value={method}>{method}</option>
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
                    {sourceOptions.map(source => (
                      <option key={source.value} value={source.value}>
                        {source.label}
                      </option>
                    ))}
                  </select>
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
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Update Transaction
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditTransactionModal
