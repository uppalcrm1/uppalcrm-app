import React from 'react'
import UserManagementSystem from '../components/UserManagement'

const TeamPage = () => {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="text-gray-600">Manage your team members and permissions with full control</p>
      </div>
      
      {/* Use the full UserManagement component */}
      <UserManagementSystem />
    </div>
  )
}

export default TeamPage