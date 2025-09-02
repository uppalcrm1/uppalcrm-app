import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { 
  Plus, 
  Smartphone, 
  Monitor, 
  Laptop, 
  Server,
  Edit, 
  Trash2, 
  Wifi,
  Calendar,
  X,
  CheckCircle,
  AlertCircle,
  Shield
} from 'lucide-react'
import { contactsAPI } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const DEVICE_TYPES = [
  { value: 'desktop', label: 'Desktop', icon: Monitor },
  { value: 'laptop', label: 'Laptop', icon: Laptop },
  { value: 'mobile', label: 'Mobile', icon: Smartphone },
  { value: 'server', label: 'Server', icon: Server }
]

const DeviceRegistration = ({ contactId }) => {
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const queryClient = useQueryClient()

  // Fetch devices
  const { data: devicesData, isLoading } = useQuery({
    queryKey: ['devices', contactId],
    queryFn: () => contactsAPI.getDevices(contactId),
  })

  // Register device mutation
  const registerMutation = useMutation({
    mutationFn: (deviceData) => contactsAPI.registerDevice(contactId, deviceData),
    onSuccess: () => {
      queryClient.invalidateQueries(['devices', contactId])
      toast.success('Device registered successfully')
      setShowRegisterModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to register device')
    }
  })

  const devices = devicesData?.devices || []

  const getDeviceIcon = (deviceType) => {
    const deviceConfig = DEVICE_TYPES.find(d => d.value === deviceType)
    return deviceConfig ? deviceConfig.icon : Monitor
  }

  const formatMacAddress = (mac) => {
    return mac.match(/.{1,2}/g)?.join(':').toUpperCase() || mac
  }

  if (isLoading) {
    return <LoadingSpinner className="py-8" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Registered Devices</h3>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="btn btn-primary btn-sm"
        >
          <Plus size={16} className="mr-2" />
          Register Device
        </button>
      </div>

      {/* Devices List */}
      {devices.length === 0 ? (
        <div className="text-center py-8">
          <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No devices registered</h3>
          <p className="text-gray-600 mb-6">Register devices to track software installations and licensing</p>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} className="mr-2" />
            Register Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {devices.map((device) => {
            const DeviceIcon = getDeviceIcon(device.device_type)
            return (
              <div key={device.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                      <DeviceIcon className="text-white" size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{device.device_name}</h4>
                      <p className="text-sm text-gray-600 capitalize">{device.device_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {device.license_id && (
                      <div className="flex items-center text-green-600" title="Licensed">
                        <Shield size={16} />
                      </div>
                    )}
                    <button
                      onClick={() => setSelectedDevice(device)}
                      className="p-1 text-gray-600 hover:text-primary-600"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </div>

                {/* Device Details */}
                <div className="space-y-3 text-sm">
                  {/* MAC Address */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">MAC Address:</span>
                    <div className="flex items-center">
                      <Wifi size={12} className="mr-1 text-gray-400" />
                      <span className="text-gray-900 font-mono text-xs">{formatMacAddress(device.mac_address)}</span>
                    </div>
                  </div>

                  {/* Owner */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Owner:</span>
                    <span className="text-gray-900">{device.first_name} {device.last_name}</span>
                  </div>

                  {/* License */}
                  {device.license_key ? (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">License:</span>
                      <span className="text-gray-900 font-mono text-xs">{device.license_key}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">License:</span>
                      <span className="text-orange-600">Not assigned</span>
                    </div>
                  )}

                  {/* OS Info */}
                  {device.os_info && Object.keys(device.os_info).length > 0 && (
                    <div>
                      <span className="text-gray-600 block mb-1">Operating System:</span>
                      <div className="text-gray-900 text-xs bg-gray-50 p-2 rounded">
                        <OSInfoDisplay osInfo={device.os_info} />
                      </div>
                    </div>
                  )}

                  {/* Hardware Info */}
                  {device.hardware_info && Object.keys(device.hardware_info).length > 0 && (
                    <div>
                      <span className="text-gray-600 block mb-1">Hardware:</span>
                      <div className="text-gray-900 text-xs bg-gray-50 p-2 rounded">
                        <HardwareInfoDisplay hardwareInfo={device.hardware_info} />
                      </div>
                    </div>
                  )}

                  {/* Registration Date */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Registered:</span>
                    <span className="text-gray-900">{format(new Date(device.registered_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Register Device Modal */}
      {showRegisterModal && (
        <RegisterDeviceModal
          onClose={() => setShowRegisterModal(false)}
          onSubmit={(data) => registerMutation.mutate(data)}
          isLoading={registerMutation.isPending}
        />
      )}

      {/* Device Details Modal */}
      {selectedDevice && (
        <DeviceDetailsModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      )}
    </div>
  )
}

// Helper component to display OS info
const OSInfoDisplay = ({ osInfo }) => {
  return (
    <div className="space-y-1">
      {osInfo.name && <div><strong>Name:</strong> {osInfo.name}</div>}
      {osInfo.version && <div><strong>Version:</strong> {osInfo.version}</div>}
      {osInfo.architecture && <div><strong>Architecture:</strong> {osInfo.architecture}</div>}
      {osInfo.platform && <div><strong>Platform:</strong> {osInfo.platform}</div>}
    </div>
  )
}

// Helper component to display hardware info
const HardwareInfoDisplay = ({ hardwareInfo }) => {
  return (
    <div className="space-y-1">
      {hardwareInfo.cpu && <div><strong>CPU:</strong> {hardwareInfo.cpu}</div>}
      {hardwareInfo.memory && <div><strong>Memory:</strong> {hardwareInfo.memory}</div>}
      {hardwareInfo.storage && <div><strong>Storage:</strong> {hardwareInfo.storage}</div>}
      {hardwareInfo.graphics && <div><strong>Graphics:</strong> {hardwareInfo.graphics}</div>}
    </div>
  )
}

// Register Device Modal
const RegisterDeviceModal = ({ onClose, onSubmit, isLoading }) => {
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    defaultValues: {
      device_type: 'desktop'
    }
  })

  // MAC address validation
  const validateMacAddress = (value) => {
    if (!value) return true // Optional field
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
    return macRegex.test(value) || 'Please enter a valid MAC address (e.g., 00:1B:44:11:3A:B7)'
  }

  // Format MAC address as user types
  const handleMacAddressChange = (e) => {
    let value = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase()
    if (value.length <= 12) {
      value = value.match(/.{1,2}/g)?.join(':') || value
      setValue('mac_address', value)
    }
  }

  const handleFormSubmit = (data) => {
    const cleanData = {
      ...data,
      os_info: data.os_name || data.os_version || data.os_architecture ? {
        name: data.os_name,
        version: data.os_version,
        architecture: data.os_architecture,
        platform: data.os_platform
      } : {},
      hardware_info: data.cpu || data.memory || data.storage ? {
        cpu: data.cpu,
        memory: data.memory,
        storage: data.storage,
        graphics: data.graphics
      } : {}
    }

    // Remove OS and hardware individual fields
    delete cleanData.os_name
    delete cleanData.os_version
    delete cleanData.os_architecture
    delete cleanData.os_platform
    delete cleanData.cpu
    delete cleanData.memory
    delete cleanData.storage
    delete cleanData.graphics

    onSubmit(cleanData)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-2xl px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Register New Device</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Basic Device Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Device Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Device Name</label>
                <input
                  {...register('device_name')}
                  className="input"
                  placeholder="John's MacBook Pro"
                />
              </div>

              {/* Device Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Device Type</label>
                <select {...register('device_type')} className="select">
                  {DEVICE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* MAC Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">MAC Address *</label>
                <input
                  {...register('mac_address', { 
                    required: 'MAC address is required',
                    validate: validateMacAddress
                  })}
                  className={`input font-mono ${errors.mac_address ? 'border-red-500' : ''}`}
                  placeholder="00:1B:44:11:3A:B7"
                  onChange={handleMacAddressChange}
                  maxLength={17}
                />
                {errors.mac_address && (
                  <p className="mt-1 text-sm text-red-600">{errors.mac_address.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Enter the device's network MAC address (automatically formatted)
                </p>
              </div>
            </div>

            {/* Operating System Info */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Operating System (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">OS Name</label>
                  <input
                    {...register('os_name')}
                    className="input"
                    placeholder="Windows 11, macOS Ventura, Ubuntu"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Version</label>
                  <input
                    {...register('os_version')}
                    className="input"
                    placeholder="22H2, 13.0.1, 22.04"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Architecture</label>
                  <input
                    {...register('os_architecture')}
                    className="input"
                    placeholder="x64, ARM64"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                  <input
                    {...register('os_platform')}
                    className="input"
                    placeholder="Windows, macOS, Linux"
                  />
                </div>
              </div>
            </div>

            {/* Hardware Info */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Hardware Information (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CPU</label>
                  <input
                    {...register('cpu')}
                    className="input"
                    placeholder="Intel i7-12700K, Apple M2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Memory</label>
                  <input
                    {...register('memory')}
                    className="input"
                    placeholder="16GB, 32GB"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Storage</label>
                  <input
                    {...register('storage')}
                    className="input"
                    placeholder="512GB SSD, 1TB NVMe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Graphics</label>
                  <input
                    {...register('graphics')}
                    className="input"
                    placeholder="NVIDIA RTX 4080, Integrated"
                  />
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <CheckCircle className="text-blue-600 mt-0.5 mr-2" size={16} />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Device Registration:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• MAC address is used for unique device identification</li>
                    <li>• Hardware and OS info help with license compatibility</li>
                    <li>• Device can be linked to licenses after registration</li>
                    <li>• All information can be updated later if needed</li>
                  </ul>
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
                {isLoading ? <LoadingSpinner size="sm" /> : 'Register Device'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Device Details Modal
const DeviceDetailsModal = ({ device, onClose }) => {
  const DeviceIcon = getDeviceIcon(device.device_type)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-lg px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Device Details</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Device Header */}
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
                <DeviceIcon className="text-white" size={24} />
              </div>
              <div>
                <h4 className="text-xl font-semibold text-gray-900">{device.device_name}</h4>
                <p className="text-gray-600 capitalize">{device.device_type}</p>
              </div>
            </div>

            {/* Device Info */}
            <div className="space-y-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Network Information</h5>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">MAC Address:</span>
                    <span className="text-gray-900 font-mono">{formatMacAddress(device.mac_address)}</span>
                  </div>
                </div>
              </div>

              {device.os_info && Object.keys(device.os_info).length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Operating System</h5>
                  <OSInfoDisplay osInfo={device.os_info} />
                </div>
              )}

              {device.hardware_info && Object.keys(device.hardware_info).length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Hardware</h5>
                  <HardwareInfoDisplay hardwareInfo={device.hardware_info} />
                </div>
              )}

              <div>
                <h5 className="font-medium text-gray-900 mb-2">Registration</h5>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registered:</span>
                    <span className="text-gray-900">{format(new Date(device.registered_at), 'MMMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Owner:</span>
                    <span className="text-gray-900">{device.first_name} {device.last_name}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end pt-6 border-t">
              <button onClick={onClose} className="btn btn-primary btn-md">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const getDeviceIcon = (deviceType) => {
  const deviceConfig = DEVICE_TYPES.find(d => d.value === deviceType)
  return deviceConfig ? deviceConfig.icon : Monitor
}

const formatMacAddress = (mac) => {
  return mac.match(/.{1,2}/g)?.join(':').toUpperCase() || mac
}

export default DeviceRegistration