import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  ArrowLeft, 
  Edit, 
  Trash2,
  Mail,
  Phone,
  Building,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Users,
  Smartphone,
  Key,
  PlayCircle,
  Download,
  Activity
} from 'lucide-react'
import { contactsAPI } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import { format } from 'date-fns'
import AccountManagement from './AccountManagement'
import DeviceRegistration from './DeviceRegistration'
import LicenseManagement from './LicenseManagement'
import TrialManagement from './TrialManagement'

const ContactDetail = ({ contact, onBack, onEdit, onDelete }) => {
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch fresh contact data
  const { data: contactData, isLoading } = useQuery({
    queryKey: ['contact', contact.id],
    queryFn: () => contactsAPI.getContact(contact.id),
    initialData: { contact }
  })

  if (isLoading) {
    return <LoadingSpinner className="mt-8" />
  }

  const contactInfo = contactData?.contact || contact

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'accounts', label: 'Accounts', icon: Building },
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'licenses', label: 'Licenses', icon: Key },
    { id: 'trials', label: 'Trials', icon: PlayCircle },
    { id: 'activity', label: 'Activity', icon: Activity }
  ]

  const getStatusBadgeColor = (status) => {
    const colors = {
      'active': 'green',
      'inactive': 'gray',
      'prospect': 'blue',
      'customer': 'purple'
    }
    return colors[status] || 'gray'
  }

  const getTypeBadgeColor = (type) => {
    const colors = {
      'customer': 'green',
      'prospect': 'blue',
      'partner': 'purple',
      'vendor': 'orange'
    }
    return colors[type] || 'gray'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{contactInfo.full_name}</h1>
            <p className="text-gray-600">{contactInfo.company || 'Individual Contact'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onEdit(contactInfo)}
            className="btn btn-secondary btn-md"
          >
            <Edit size={16} className="mr-2" />
            Edit
          </button>
          <button
            onClick={() => onDelete(contactInfo.id)}
            className="btn btn-danger btn-md"
          >
            <Trash2 size={16} className="mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Contact Header Card */}
      <div className="card">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Basic Info */}
          <div className="lg:col-span-2">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-semibold">
                  {contactInfo.first_name[0]}{contactInfo.last_name[0]}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">{contactInfo.full_name}</h2>
                  <span className={`badge badge-${getStatusBadgeColor(contactInfo.status)}`}>
                    {contactInfo.status}
                  </span>
                  <span className={`badge badge-${getTypeBadgeColor(contactInfo.type)}`}>
                    {contactInfo.type}
                  </span>
                </div>
                
                {contactInfo.title && (
                  <p className="text-gray-600 mb-2">{contactInfo.title}</p>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {contactInfo.email && (
                    <div className="flex items-center text-gray-600">
                      <Mail size={16} className="mr-2" />
                      <a href={`mailto:${contactInfo.email}`} className="hover:text-primary-600">
                        {contactInfo.email}
                      </a>
                    </div>
                  )}
                  {contactInfo.phone && (
                    <div className="flex items-center text-gray-600">
                      <Phone size={16} className="mr-2" />
                      <a href={`tel:${contactInfo.phone}`} className="hover:text-primary-600">
                        {contactInfo.phone}
                      </a>
                    </div>
                  )}
                  {contactInfo.company && (
                    <div className="flex items-center text-gray-600">
                      <Building size={16} className="mr-2" />
                      {contactInfo.company}
                    </div>
                  )}
                  <div className="flex items-center text-gray-600">
                    <Calendar size={16} className="mr-2" />
                    Created {format(new Date(contactInfo.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                ${contactInfo.value?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-gray-600">Total Value</div>
            </div>
            
            {contactInfo.assigned_user && (
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center mr-2">
                    <span className="text-white text-xs font-medium">
                      {contactInfo.assigned_user.first_name[0]}{contactInfo.assigned_user.last_name[0]}
                    </span>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-900">{contactInfo.assigned_user.full_name}</div>
                <div className="text-xs text-gray-600">Assigned To</div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {contactInfo.notes && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Notes</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{contactInfo.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="card">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} className="mr-2" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <ContactOverview contact={contactInfo} />
          )}
          
          {activeTab === 'accounts' && (
            <AccountManagement contactId={contactInfo.id} />
          )}
          
          {activeTab === 'devices' && (
            <DeviceRegistration contactId={contactInfo.id} />
          )}
          
          {activeTab === 'licenses' && (
            <LicenseManagement contactId={contactInfo.id} />
          )}
          
          {activeTab === 'trials' && (
            <TrialManagement contactId={contactInfo.id} />
          )}
          
          {activeTab === 'activity' && (
            <ContactActivity contactId={contactInfo.id} />
          )}
        </div>
      </div>
    </div>
  )
}

// Overview Tab Component
const ContactOverview = ({ contact }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">First Name:</span>
              <span className="text-gray-900">{contact.first_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Name:</span>
              <span className="text-gray-900">{contact.last_name}</span>
            </div>
            {contact.title && (
              <div className="flex justify-between">
                <span className="text-gray-600">Title:</span>
                <span className="text-gray-900">{contact.title}</span>
              </div>
            )}
            {contact.email && (
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="text-gray-900">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="text-gray-900">{contact.phone}</span>
              </div>
            )}
            {contact.company && (
              <div className="flex justify-between">
                <span className="text-gray-600">Company:</span>
                <span className="text-gray-900">{contact.company}</span>
              </div>
            )}
          </div>
        </div>

        {/* Business Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="text-gray-900 capitalize">{contact.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="text-gray-900 capitalize">{contact.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Priority:</span>
              <span className="text-gray-900 capitalize">{contact.priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Value:</span>
              <span className="text-gray-900">${contact.value?.toLocaleString() || 0}</span>
            </div>
            {contact.source && (
              <div className="flex justify-between">
                <span className="text-gray-600">Source:</span>
                <span className="text-gray-900 capitalize">{contact.source}</span>
              </div>
            )}
            {contact.converted_from_lead_id && (
              <div className="flex justify-between">
                <span className="text-gray-600">Converted from Lead:</span>
                <span className="text-green-600">Yes</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">Created on {format(new Date(contact.created_at), 'MMMM d, yyyy')}</span>
          </div>
          {contact.updated_at && contact.updated_at !== contact.created_at && (
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">Last updated on {format(new Date(contact.updated_at), 'MMMM d, yyyy')}</span>
            </div>
          )}
          {contact.last_contact_date && (
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-gray-600">Last contact on {format(new Date(contact.last_contact_date), 'MMMM d, yyyy')}</span>
            </div>
          )}
          {contact.next_follow_up && (
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-gray-600">Next follow-up on {format(new Date(contact.next_follow_up), 'MMMM d, yyyy')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Activity Tab Component
const ContactActivity = ({ contactId }) => {
  // This would typically fetch activity data from the API
  // For now, showing a placeholder
  return (
    <div className="text-center py-8">
      <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Activity Timeline</h3>
      <p className="text-gray-600">Track downloads, activations, and contact interactions</p>
      <div className="mt-6">
        <button className="btn btn-primary btn-md">
          <Download size={16} className="mr-2" />
          Record Activity
        </button>
      </div>
    </div>
  )
}

export default ContactDetail