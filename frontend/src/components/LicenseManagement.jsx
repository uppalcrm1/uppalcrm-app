import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { 
  Plus, 
  Key, 
  Shield, 
  Calendar, 
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRightLeft,
  Copy,
  Download,
  X,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react'
import { contactsAPI } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'
import { format, differenceInDays, isPast } from 'date-fns'

const LICENSE_TYPES = [
  { value: 'standard', label: 'Standard', color: 'blue' },
  { value: 'premium', label: 'Premium', color: 'purple' },
  { value: 'enterprise', label: 'Enterprise', color: 'green' },
  { value: 'trial', label: 'Trial', color: 'yellow' }
]

const LICENSE_STATUSES = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'expired', label: 'Expired', color: 'red' },
  { value: 'suspended', label: 'Suspended', color: 'orange' },
  { value: 'revoked', label: 'Revoked', color: 'gray' }
]

const LicenseManagement = ({ contactId }) => {
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [selectedLicense, setSelectedLicense] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    license_type: '',
    expired_only: false
  })
  const [showLicenseKeys, setShowLicenseKeys] = useState({})
  const queryClient = useQueryClient()

  // Fetch licenses
  const { data: licensesData, isLoading } = useQuery({
    queryKey: ['licenses', contactId, filters],
    queryFn: () => contactsAPI.getLicenses(contactId, filters),
  })

  // Fetch software editions
  const { data: editionsData } = useQuery({
    queryKey: ['software-editions'],
    queryFn: () => contactsAPI.getEditions(),
  })

  // Generate license mutation
  const generateMutation = useMutation({
    mutationFn: (licenseData) => contactsAPI.generateLicense(contactId, licenseData),
    onSuccess: () => {
      queryClient.invalidateQueries(['licenses', contactId])
      toast.success('License generated successfully')
      setShowGenerateModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to generate license')
    }
  })

  // Transfer license mutation
  const transferMutation = useMutation({
    mutationFn: ({ licenseId, transferData }) => contactsAPI.transferLicense(licenseId, transferData),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['licenses'])
      toast.success(`License transferred successfully. ${data.remaining_days} days remaining.`)
      setShowTransferModal(false)
      setSelectedLicense(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to transfer license')
    }
  })

  const licenses = licensesData?.licenses || []
  const editions = editionsData?.editions || []

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy')
    })
  }

  const toggleLicenseKeyVisibility = (licenseId) => {
    setShowLicenseKeys(prev => ({
      ...prev,
      [licenseId]: !prev[licenseId]
    }))
  }

  const getLicenseStatus = (license) => {
    if (license.status === 'active' && isPast(new Date(license.expires_at))) {
      return { status: 'expired', color: 'red', label: 'Expired' }
    }
    const statusConfig = LICENSE_STATUSES.find(s => s.value === license.status)
    return statusConfig || { status: license.status, color: 'gray', label: license.status }
  }

  const getExpirationWarning = (expiresAt) => {
    const daysUntilExpiry = differenceInDays(new Date(expiresAt), new Date())
    
    if (daysUntilExpiry < 0) {
      return { type: 'expired', message: `Expired ${Math.abs(daysUntilExpiry)} days ago`, color: 'red' }
    } else if (daysUntilExpiry <= 7) {
      return { type: 'critical', message: `Expires in ${daysUntilExpiry} days`, color: 'red' }
    } else if (daysUntilExpiry <= 30) {
      return { type: 'warning', message: `Expires in ${daysUntilExpiry} days`, color: 'yellow' }
    }
    
    return null
  }

  if (isLoading) {
    return <LoadingSpinner className="py-8" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">License Management</h3>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary btn-sm"
          >
            <Filter size={16} className="mr-2" />
            Filter
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={16} className="mr-2" />
            Generate License
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="select"
              >
                <option value="">All Statuses</option>
                {LICENSE_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={filters.license_type}
                onChange={(e) => setFilters(prev => ({ ...prev, license_type: e.target.value }))}
                className="select"
              >
                <option value="">All Types</option>
                {LICENSE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.expired_only}
                  onChange={(e) => setFilters(prev => ({ ...prev, expired_only: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                />
                <span className="text-sm text-gray-700">Expired only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Licenses List */}
      {licenses.length === 0 ? (
        <div className="text-center py-8">
          <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No licenses found</h3>
          <p className="text-gray-600 mb-6">Generate software licenses to enable product access</p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} className="mr-2" />
            Generate License
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {licenses.map((license) => {
            const statusInfo = getLicenseStatus(license)
            const warningInfo = getExpirationWarning(license.expires_at)
            const isKeyVisible = showLicenseKeys[license.id]
            
            return (
              <div key={license.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                      <Key className="text-white" size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{license.edition_name}</h4>
                      <p className="text-sm text-gray-600">Version {license.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`badge badge-${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    {warningInfo && (
                      <div className={`flex items-center text-${warningInfo.color}-600 text-sm`}>
                        <AlertTriangle size={16} className="mr-1" />
                        {warningInfo.message}
                      </div>
                    )}
                  </div>
                </div>

                {/* License Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-3 text-sm">
                    {/* License Key */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-600">License Key:</span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleLicenseKeyVisibility(license.id)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title={isKeyVisible ? 'Hide key' : 'Show key'}
                          >
                            {isKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(license.license_key)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Copy to clipboard"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="text-gray-900 font-mono text-xs bg-gray-50 p-2 rounded">
                        {isKeyVisible ? license.license_key : '••••-••••-••••-••••'}
                      </div>
                    </div>

                    {/* License Type */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="text-gray-900 capitalize">{license.license_type}</span>
                    </div>

                    {/* Max Devices */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max Devices:</span>
                      <span className="text-gray-900">{license.max_devices}</span>
                    </div>

                    {/* Owner */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Owner:</span>
                      <span className="text-gray-900">{license.first_name} {license.last_name}</span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-3 text-sm">
                    {/* Expiration */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expires:</span>
                      <span className="text-gray-900">{format(new Date(license.expires_at), 'MMM d, yyyy')}</span>
                    </div>

                    {/* Created */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span className="text-gray-900">{format(new Date(license.created_at), 'MMM d, yyyy')}</span>
                    </div>

                    {/* Custom Features */}
                    {license.custom_features && Object.keys(license.custom_features).length > 0 && (
                      <div>
                        <span className="text-gray-600 block mb-1">Features:</span>
                        <div className="text-gray-900 text-xs bg-gray-50 p-2 rounded">
                          <pre>{JSON.stringify(license.custom_features, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-200 mt-4">
                  <button
                    onClick={() => {
                      setSelectedLicense(license)
                      setShowTransferModal(true)
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    <ArrowRightLeft size={14} className="mr-1" />
                    Transfer
                  </button>
                  <button
                    onClick={() => copyToClipboard(license.license_key)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Copy size={14} className="mr-1" />
                    Copy Key
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Generate License Modal */}
      {showGenerateModal && (
        <GenerateLicenseModal
          onClose={() => setShowGenerateModal(false)}
          onSubmit={(data) => generateMutation.mutate(data)}
          editions={editions}
          isLoading={generateMutation.isPending}
        />
      )}

      {/* Transfer License Modal */}
      {showTransferModal && selectedLicense && (
        <TransferLicenseModal
          license={selectedLicense}
          onClose={() => {
            setShowTransferModal(false)
            setSelectedLicense(null)
          }}
          onSubmit={(data) => transferMutation.mutate({
            licenseId: selectedLicense.id,
            transferData: data
          })}
          isLoading={transferMutation.isPending}
        />
      )}
    </div>
  )
}

// Generate License Modal
const GenerateLicenseModal = ({ onClose, onSubmit, editions, isLoading }) => {
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      license_type: 'standard',
      duration_months: 12,
      max_devices: 1
    }
  })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-lg px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Generate License</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Product */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product *</label>
              <select
                {...register('edition_id', { required: 'Please select a product' })}
                className={`select ${errors.edition_id ? 'border-red-500' : ''}`}
              >
                <option value="">Select product...</option>
                {editions.map(edition => (
                  <option key={edition.id} value={edition.id}>
                    {edition.name} - {edition.version}
                  </option>
                ))}
              </select>
              {errors.edition_id && (
                <p className="mt-1 text-sm text-red-600">{errors.edition_id.message}</p>
              )}
            </div>

            {/* License Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">License Type</label>
              <select {...register('license_type')} className="select">
                {LICENSE_TYPES.filter(type => type.value !== 'trial').map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Months)</label>
              <input
                {...register('duration_months', { 
                  required: 'Duration is required',
                  min: { value: 1, message: 'Duration must be at least 1 month' },
                  max: { value: 120, message: 'Duration cannot exceed 120 months' }
                })}
                type="number"
                min="1"
                max="120"
                className={`input ${errors.duration_months ? 'border-red-500' : ''}`}
              />
              {errors.duration_months && (
                <p className="mt-1 text-sm text-red-600">{errors.duration_months.message}</p>
              )}
            </div>

            {/* Max Devices */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Devices</label>
              <input
                {...register('max_devices', { 
                  required: 'Max devices is required',
                  min: { value: 1, message: 'Must allow at least 1 device' },
                  max: { value: 1000, message: 'Cannot exceed 1000 devices' }
                })}
                type="number"
                min="1"
                max="1000"
                className={`input ${errors.max_devices ? 'border-red-500' : ''}`}
              />
              {errors.max_devices && (
                <p className="mt-1 text-sm text-red-600">{errors.max_devices.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-md"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : 'Generate License'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Transfer License Modal  
const TransferLicenseModal = ({ license, onClose, onSubmit, isLoading }) => {
  const { register, handleSubmit, formState: { errors } } = useForm()

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-md px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Transfer License</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* License Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">License Details</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Edition:</strong> {license.edition_name}</p>
                <p><strong>Key:</strong> {license.license_key}</p>
                <p><strong>Expires:</strong> {format(new Date(license.expires_at), 'MMM d, yyyy')}</p>
              </div>
            </div>

            {/* New Contact ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Contact ID *</label>
              <input
                {...register('new_contact_id', { required: 'New contact ID is required' })}
                className={`input ${errors.new_contact_id ? 'border-red-500' : ''}`}
                placeholder="Enter contact ID"
              />
              {errors.new_contact_id && (
                <p className="mt-1 text-sm text-red-600">{errors.new_contact_id.message}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Notes</label>
              <textarea
                {...register('notes')}
                rows={3}
                className="input resize-none"
                placeholder="Reason for transfer..."
              />
            </div>

            {/* Warning */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="text-yellow-600 mt-0.5 mr-2" size={16} />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Transfer Warning:</p>
                  <p>This license will be transferred to the new contact and all associated devices will be updated.</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-md"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : 'Transfer License'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LicenseManagement