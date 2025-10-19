import React from 'react'
import { Upload, Clock } from 'lucide-react'

const AdminImport = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
        <p className="text-gray-600 mt-1">Import leads, contacts, and other data in bulk</p>
      </div>

      <div className="card">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <Upload className="h-8 w-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Bulk Import</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            This page is under construction. Soon you'll be able to import data from CSV files, spreadsheets, and other CRM systems.
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

export default AdminImport
