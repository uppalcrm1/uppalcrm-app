import React from 'react'
import { Users, Clock } from 'lucide-react'

const AdminTeam = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="text-gray-600 mt-1">Manage your team members and their roles</p>
      </div>

      <div className="card">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Team Management</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            This page is under construction. Soon you'll be able to invite team members, manage roles, and configure permissions.
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

export default AdminTeam
