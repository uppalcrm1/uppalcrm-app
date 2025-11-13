import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Settings,
  Building,
  User,
  Shield,
  Bell,
  Users,
  CreditCard,
  Plug,
  Upload,
  Sliders,
  Package,
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
  const location = useLocation()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState(() => {
    const path = location.pathname
    if (path.includes('/user-management')) return 'user-management'
    if (path.includes('/subscription')) return 'subscription'
    if (path.includes('/integrations')) return 'integrations'
    if (path.includes('/import')) return 'import'
    if (path.includes('/field-configuration')) return 'field-configuration'
    if (path.includes('/products')) return 'products'
    return 'organization'
  })

  // Handle direct navigation from Admin dropdown
  useEffect(() => {
    const path = location.pathname
    if (path.includes('/user-management')) setActiveTab('user-management')
    else if (path.includes('/subscription')) setActiveTab('subscription')
    else if (path.includes('/integrations')) setActiveTab('integrations')
    else if (path.includes('/import')) setActiveTab('import')
    else if (path.includes('/field-configuration')) setActiveTab('field-configuration')
    else if (path.includes('/products')) setActiveTab('products')
    else setActiveTab('organization')
  }, [location.pathname])

  // Fetch organization data
  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: organizationsAPI.getCurrent
  })

  const organization = orgData?.organization

  // COMPLETE tabs list - all admin features
  const tabs = [
    { id: 'organization', label: 'Organization', icon: Building },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'user-management', label: 'User Management', icon: Users },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'field-configuration', label: 'Field Configuration', icon: Sliders },
    { id: 'products', label: 'Products', icon: Package },
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
        {/* Sidebar with ALL tabs */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    navigate(`/settings/${tab.id}`)
                  }}
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

        {/* Content Area */}
        <div className="lg:col-span-3">
          <div className="card">
            {activeTab === 'organization' && <OrganizationSettings organization={organization} />}
            {activeTab === 'profile' && <ProfileSettings user={user} />}
            {activeTab === 'security' && <SecuritySettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'user-management' && <UserManagementSettings />}
            {activeTab === 'subscription' && <SubscriptionSettings organization={organization} />}
            {activeTab === 'integrations' && <IntegrationsSettings />}
            {activeTab === 'import' && <ImportSettings />}
            {activeTab === 'field-configuration' && <FieldConfigurationSettings />}
            {activeTab === 'products' && <ProductsSettings />}
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
              placeholder="Enter organization name"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Slug</label>
            <input
              {...register('slug')}
              className="input"
              placeholder="organization-slug"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Contact support to change your organization slug</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              {...register('description')}
              rows={4}
              className="input"
              placeholder="Tell us about your organization..."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
            <Save size={16} className="mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Profile Settings Component
const ProfileSettings = ({ user }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile Settings</h3>
      <div className="space-y-4">
        <p className="text-gray-600">Update your personal information here.</p>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Profile settings coming soon...</p>
        </div>
      </div>
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
        <div className="border border-gray-200 rounded-lg p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
              <p className="text-sm text-gray-600">Receive email updates about your account</p>
            </div>
            <input type="checkbox" className="toggle" defaultChecked />
          </label>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Lead Notifications</h4>
              <p className="text-sm text-gray-600">Get notified when new leads are assigned</p>
            </div>
            <input type="checkbox" className="toggle" defaultChecked />
          </label>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Task Reminders</h4>
              <p className="text-sm text-gray-600">Receive reminders for upcoming tasks</p>
            </div>
            <input type="checkbox" className="toggle" defaultChecked />
          </label>
        </div>
      </div>
    </div>
  )
}

// User Management Settings Component
const UserManagementSettings = () => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">User Management</h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-gray-600">Manage your team members and their permissions</p>
          <button className="btn btn-primary btn-sm">
            <User size={16} className="mr-2" />
            Add User
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">User management interface coming soon...</p>
          <p className="text-xs text-gray-500 mt-2">Navigate to Team page for basic user management</p>
        </div>
      </div>
    </div>
  )
}

// Subscription Settings Component
const SubscriptionSettings = ({ organization }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Subscription</h3>

      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-medium text-gray-900">Current Plan</h4>
              <p className="text-sm text-gray-600">
                {organization?.subscription_plan || 'Starter'} Plan
              </p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Active
            </span>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600 mb-4">$15 per user/month</p>
            <button className="btn btn-secondary btn-sm">Upgrade Plan</button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Billing History</h4>
          <p className="text-sm text-gray-600">View your billing history and download invoices</p>
          <button className="btn btn-secondary btn-sm mt-4">View Billing History</button>
        </div>
      </div>
    </div>
  )
}

// Integrations Settings Component
const IntegrationsSettings = () => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Integrations</h3>

      <div className="space-y-4">
        <p className="text-gray-600">Connect your CRM with external services</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Gmail</h4>
              <span className="text-xs text-gray-500">Not Connected</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Sync emails with your CRM</p>
            <button className="btn btn-secondary btn-sm">Connect</button>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">WhatsApp</h4>
              <span className="text-xs text-gray-500">Not Connected</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Enable WhatsApp messaging</p>
            <button className="btn btn-secondary btn-sm">Connect</button>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Payment Gateway</h4>
              <span className="text-xs text-gray-500">Not Connected</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Accept payments online</p>
            <button className="btn btn-secondary btn-sm">Connect</button>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Zapier</h4>
              <span className="text-xs text-gray-500">Not Connected</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Automate workflows</p>
            <button className="btn btn-secondary btn-sm">Connect</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Import Settings Component
const ImportSettings = () => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Import Data</h3>

      <div className="space-y-6">
        <p className="text-gray-600">Import your data from CSV, Excel, or other CRMs</p>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload size={48} className="mx-auto text-gray-400 mb-4" />
          <h4 className="text-sm font-medium text-gray-900 mb-2">Upload File</h4>
          <p className="text-sm text-gray-600 mb-4">CSV, Excel, or other supported formats</p>
          <button className="btn btn-primary btn-sm">Choose File</button>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Import from other CRM</h4>
          <p className="text-sm text-gray-600 mb-4">Migrate data from Salesforce, HubSpot, or other CRMs</p>
          <button className="btn btn-secondary btn-sm">Start Migration</button>
        </div>
      </div>
    </div>
  )
}

// Field Configuration Settings Component
const FieldConfigurationSettings = () => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Field Configuration</h3>

      <div className="space-y-4">
        <p className="text-gray-600">Customize fields for leads, contacts, and accounts</p>

        <div className="flex justify-end mb-4">
          <button className="btn btn-primary btn-sm">
            <Sliders size={16} className="mr-2" />
            Add Custom Field
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Field configuration interface coming soon...</p>
          <p className="text-xs text-gray-500 mt-2">You'll be able to add custom fields, set validation rules, and control permissions</p>
        </div>
      </div>
    </div>
  )
}

// Products Settings Component
const ProductsSettings = () => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Products</h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-gray-600">Manage your software editions and pricing</p>
          <button className="btn btn-primary btn-sm">
            <Package size={16} className="mr-2" />
            Add Product
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Gold Edition</h4>
            <p className="text-2xl font-bold text-gray-900 mb-2">$99/year</p>
            <p className="text-sm text-gray-600">Premium features</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Smart Edition</h4>
            <p className="text-2xl font-bold text-gray-900 mb-2">$49/year</p>
            <p className="text-sm text-gray-600">Standard features</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Jio Edition</h4>
            <p className="text-2xl font-bold text-gray-900 mb-2">$29/year</p>
            <p className="text-sm text-gray-600">Basic features</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
