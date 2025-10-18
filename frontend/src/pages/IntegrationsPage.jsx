import React from 'react'
import { Plug, Clock } from 'lucide-react'

const IntegrationsPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600 mt-1">Connect your CRM with other tools and services</p>
      </div>

      {/* Placeholder Card */}
      <div className="card">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
            <Plug className="h-8 w-8 text-purple-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Integrations Hub</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            This page is under construction. Soon you'll be able to connect with popular tools like Zapier, Slack, Google Workspace, and more.
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

export default IntegrationsPage
