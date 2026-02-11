import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, CheckCircle, DollarSign, Calendar } from 'lucide-react'
import { contactsAPI } from '../services/api'
import { formatBillingTerm, getTermOptions } from '../utils/billingHelpers'

const AccountDetailsModal = ({ contactName, onClose, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    edition_id: '',
    billing_term_months: 1,
    price: ''
  })

  // Fetch software editions
  const { data: editionsData, isLoading: editionsLoading } = useQuery({
    queryKey: ['editions'],
    queryFn: contactsAPI.getEditions
  })

  const editions = editionsData?.editions || []

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      edition_id: formData.edition_id,
      billing_term_months: formData.billing_term_months,
      price: parseFloat(formData.price)
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Create Account</h3>
              <p className="text-sm text-gray-600">for {contactName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product <span className="text-red-500">*</span>
              </label>
              {editionsLoading ? (
                <div className="text-sm text-gray-500">Loading products...</div>
              ) : (
                <select
                  name="edition_id"
                  value={formData.edition_id}
                  onChange={handleChange}
                  required
                  className="select"
                >
                  <option value="">Select Product</option>
                  {editions.map((edition) => (
                    <option key={edition.id} value={edition.id}>
                      {edition.name} - {edition.version}
                      {edition.price > 0 && ` ($${edition.price})`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Billing Term */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing Term <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.billing_term_months}
                onChange={(e) => setFormData(prev => ({ ...prev, billing_term_months: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                {getTermOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price <span className="text-red-500">*</span>
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
                  required
                  placeholder="0.00"
                  className="input pl-10"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn btn-secondary btn-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.edition_id || !formData.price}
              className="btn btn-primary btn-md"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Create Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AccountDetailsModal
