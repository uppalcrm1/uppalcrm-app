import React from 'react'
import { Sliders, Clock } from 'lucide-react'

const FieldConfigurationPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Field Configuration</h1>
        <p className="text-gray-600 mt-1">Customize fields for leads, contacts, and other entities</p>
      </div>

      {/* Placeholder Card */}
      <div className="card">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
            <Sliders className="h-8 w-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Custom Fields</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            This page is under construction. Soon you'll be able to create custom fields, manage field types, and configure validation rules.
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

export default FieldConfigurationPage
