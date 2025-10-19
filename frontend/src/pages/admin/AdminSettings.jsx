import React from 'react'
import { Settings, Clock } from 'lucide-react'

const AdminSettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure your CRM preferences and organization settings</p>
      </div>

      <div className="card">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Settings className="h-8 w-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">System Settings</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            This page is under construction. Soon you'll be able to configure system preferences, security settings, and organization details.
          </p>
          <div className="inline-flex items-center text-sm text-gray-500">
            <Clock size={16} className="mr-2" />
            Coming soon
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminSettings
