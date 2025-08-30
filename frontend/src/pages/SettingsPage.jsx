import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Settings, 
  Building, 
  User, 
  Shield, 
  Bell,
  Palette,
  Database,
  Key,
  Save,
  AlertCircle
} from 'lucide-react'
import { organizationsAPI, authAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'

const SettingsPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('organization')

  // Fetch organization data
  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: organizationsAPI.getCurrent
  })

  const organization = orgData?.organization

  const tabs = [
    { id: 'organization', label: 'Organization', icon: Building },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ]

  if (isLoading) {
    return <LoadingSpinner className="mt-8" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and organization preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} className="mr-3" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="card">
            {activeTab === 'organization' && <OrganizationSettings organization={organization} />}
            {activeTab === 'profile' && <ProfileSettings user={user} />}
            {activeTab === 'security' && <SecuritySettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}

// Organization Settings Component
const OrganizationSettings = ({ organization }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: organization || {}
  })

  const updateMutation = useMutation({
    mutationFn: organizationsAPI.updateCurrent,
    onSuccess: () => {
      toast.success('Organization updated successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update organization')
    }
  })

  const onSubmit = (data) => {
    updateMutation.mutate(data)
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Organization Settings</h3>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Organization Name</label>
            <input
              {...register('name', { required: 'Organization name is required' })}
              className={`input ${errors.name ? 'border-red-500' : ''}`}
              placeholder="Your Organization"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Slug</label>
            <input
              {...register('slug')}
              className="input"
              placeholder="your-org"
              disabled
            />
            <p className="mt-1 text-xs text-gray-500">Contact support to change your organization slug</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="input resize-none"
              placeholder="Tell us about your organization..."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn btn-primary btn-md"
          >
            {updateMutation.isPending ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save size={16} className="mr-2" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}

// Profile Settings Component
const ProfileSettings = ({ user }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: user || {}
  })

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile Settings</h3>
      
      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
            <input
              {...register('first_name')}
              className="input"
              placeholder="John"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
            <input
              {...register('last_name')}
              className="input"
              placeholder="Doe"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              {...register('email')}
              type="email"
              className="input"
              placeholder="john@company.com"
              disabled
            />
            <p className="mt-1 text-xs text-gray-500">Contact support to change your email address</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" className="btn btn-primary btn-md">
            <Save size={16} className="mr-2" />
            Save Profile
          </button>
        </div>
      </form>
    </div>
  )
}

// Security Settings Component
const SecuritySettings = () => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Security Settings</h3>
      
      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Password</h4>
              <p className="text-sm text-gray-600">Update your password regularly</p>
            </div>
            <button className="btn btn-secondary btn-sm">Change Password</button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
              <p className="text-sm text-gray-600">Add an extra layer of security</p>
            </div>
            <button className="btn btn-secondary btn-sm">Enable 2FA</button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">API Keys</h4>
              <p className="text-sm text-gray-600">Manage your API access keys</p>
            </div>
            <button className="btn btn-secondary btn-sm">Manage Keys</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Notifications Settings Component
const NotificationSettings = () => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Notification Settings</h3>
      
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Email Notifications</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">New leads assigned to me</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Weekly lead summary</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Team member activity</span>
              <input type="checkbox" className="toggle" />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Push Notifications</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">New lead notifications</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Follow-up reminders</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary btn-md">
            <Save size={16} className="mr-2" />
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage