import React, { useState, useEffect } from 'react'
import {
  X,
  Pencil,
  DollarSign,
  Package,
  CheckCircle,
  Loader
} from 'lucide-react'
import { accountsAPI, productsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { BILLING_TERMS } from '../constants/transactions'
import { formatBillingTerm } from '../utils/billingHelpers'

const EditAccountModal = ({ isOpen, onClose, onSuccess, account }) => {
  const [formData, setFormData] = useState({
    account_name: '',
    edition: '',
    device_name: '',
    mac_address: '',
    term: '1',
    price: '',
    account_status: 'active',
    notes: ''
  })

  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  // Pre-populate form data when account changes or modal opens
  useEffect(() => {
    if (isOpen && account) {
      console.log('📋 Pre-populating form with account:', account)
      // Use billing_term_months (clean field) if available, fallback to term
      const term = (account.billing_term_months || account.term || 1).toString()

      setFormData({
        account_name: account.account_name || '',
        edition: account.edition || '',
        device_name: account.device_name || '',
        mac_address: account.mac_address || '',
        term: term,
        price: account.price || '',
        account_status: account.account_status || 'active',
        notes: account.notes || ''
      })
      setErrors({})
    }
  }, [isOpen, account])

  // Load products on modal open
  useEffect(() => {
    if (isOpen) {
      loadProducts()
    }
  }, [isOpen])

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const response = await productsAPI.getProducts()
      setProducts(response.products || [])
    } catch (error) {
      console.error('Error loading products:', error)
      // Use fallback products if API fails
      setProducts([
        { name: 'Gold', price: 50 },
        { name: 'Smart', price: 30 },
        { name: 'Jio', price: 20 }
      ])
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Auto-fill price when product is selected
  const handleProductChange = (e) => {
    const productName = e.target.value
    const selectedProduct = products.find(p => p.name === productName)

    setFormData(prev => ({
      ...prev,
      edition: productName,
      price: selectedProduct?.price || prev.price
    }))

    if (errors.edition) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.edition
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.account_name?.trim()) {
      newErrors.account_name = 'Account name is required'
    }

    if (!formData.edition) {
      newErrors.edition = 'Product is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Please fix validation errors')
      return
    }

    setIsSubmitting(true)

    try {
      // Prepare account data - only editable fields
      // Use billing_term_months for consistency with backend field naming
      const accountData = {
        account_name: formData.account_name.trim(),
        edition: formData.edition,
        device_name: formData.device_name?.trim() || null,
        mac_address: formData.mac_address?.trim() || null,
        billing_term_months: parseInt(formData.term),
        price: parseFloat(formData.price) || 0,
        account_status: formData.account_status,
        notes: formData.notes?.trim() || null
      }

      console.log('Updating account:', accountData)

      // Update account using the accounts API
      await accountsAPI.updateAccount(account.id, accountData)

      toast.success('Account updated successfully!')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error updating account:', error)

      // Extract error details from response
      const errorData = error.response?.data || {}
      const errorMessage = errorData.message || error.message || 'Failed to update account'
      const errorType = errorData.error || 'Error'

      // Handle specific error types
      if (errorType === 'Duplicate MAC Address' || errorMessage.toLowerCase().includes('mac address')) {
        setErrors(prev => ({
          ...prev,
          mac_address: 'This MAC address is already registered'
        }))
        toast.error('This MAC address is already in use. Please check existing accounts or use a different MAC address.')
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Pencil size={24} className="mr-2 text-purple-600" />
              Edit Account
            </h2>
            <p className="text-sm text-gray-500 mt-1">Update account details</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            disabled={isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 space-y-6">
            {/* Two Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Account Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="account_name"
                    value={formData.account_name}
                    onChange={handleChange}
                    required
                    maxLength={255}
                    className={`input ${errors.account_name ? 'border-red-500' : ''}`}
                    placeholder="e.g., John's Living Room TV"
                  />
                  {errors.account_name && (
                    <p className="text-red-600 text-sm mt-1">{errors.account_name}</p>
                  )}
                </div>

                {/* Product */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="edition"
                    value={formData.edition}
                    onChange={handleProductChange}
                    required
                    className={`select ${errors.edition ? 'border-red-500' : ''}`}
                    disabled={loadingProducts}
                  >
                    <option value="">
                      {loadingProducts ? 'Loading products...' : 'Select product'}
                    </option>
                    {products.map((product) => (
                      <option key={product.name} value={product.name}>
                        {product.name}
                        {product.price && ` - $${product.price}`}
                      </option>
                    ))}
                  </select>
                  {errors.edition && (
                    <p className="text-red-600 text-sm mt-1">{errors.edition}</p>
                  )}
                </div>

                {/* Device Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device Name
                  </label>
                  <input
                    type="text"
                    name="device_name"
                    value={formData.device_name}
                    onChange={handleChange}
                    maxLength={255}
                    className="input"
                    placeholder="e.g., Mag Box, Fire Stick"
                  />
                </div>

                {/* MAC Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    MAC Address
                  </label>
                  <input
                    type="text"
                    name="mac_address"
                    value={formData.mac_address}
                    onChange={handleChange}
                    className={`input font-mono ${errors.mac_address ? 'border-red-500' : ''}`}
                    placeholder="Enter any identifier"
                  />
                  {errors.mac_address && (
                    <p className="text-red-600 text-sm mt-1">{errors.mac_address}</p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Billing Term */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Term
                  </label>
                  <select
                    name="term"
                    value={formData.term}
                    onChange={handleChange}
                    className="select"
                  >
                    {BILLING_TERMS.map(term => (
                      <option key={term.value} value={term.value}>
                        {formatBillingTerm(parseInt(term.value))}
                      </option>
                    ))}
                  </select>
                  {formData.term && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {formatBillingTerm(parseInt(formData.term))}
                    </p>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="input pl-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Account Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Status
                  </label>
                  <select
                    name="account_status"
                    value={formData.account_status}
                    onChange={handleChange}
                    className="select"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="on_hold">On Hold</option>
                  </select>
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
                placeholder="Add any additional information about this account..."
              />
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
                  <Loader size={16} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditAccountModal
