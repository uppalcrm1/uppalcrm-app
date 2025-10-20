import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  AlertCircle
} from 'lucide-react'

const AdminUsers = () => {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api'

  useEffect(() => {
    console.log('🔍 AdminUsers: Component mounted, fetching data...')
    console.log('API Base URL:', API_BASE_URL)
    console.log('Current user:', currentUser)
    fetchUsers()
    fetchStats()
  }, [])

  const fetchUsers = async () => {
    try {
      console.log('📡 Fetching users from API...')
      const token = localStorage.getItem('token')
      console.log('Token exists:', !!token)

      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('API Response status:', response.status)
      console.log('API Response ok:', response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error response:', errorText)
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('✅ Users data received:', data)
      console.log('Number of users:', data.users?.length || 0)
      console.log('Users array:', data.users)

      setUsers(data.users || [])
      setError(null)
    } catch (error) {
      console.error('❌ Error fetching users:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      console.log('📊 Fetching user statistics...')
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/users/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('Stats API Response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Stats data received:', data)
        setStats(data.user_stats)
      } else {
        console.warn('⚠️  Stats endpoint returned non-OK status:', response.status)
      }
    } catch (error) {
      console.error('❌ Error fetching stats:', error)
      // Don't fail the whole page if stats fail
    }
  }

  const getRoleBadgeClass = (role) => {
    const badges = {
      admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-purple-100 text-purple-800',
      user: 'bg-gray-100 text-gray-800',
      viewer: 'bg-green-100 text-green-800'
    }
    return badges[role] || badges.user
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = roleFilter === 'all' || user.role === roleFilter

    return matchesSearch && matchesRole
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-600">Loading users...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage your team members and their access</p>
        </div>
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-start">
            <AlertCircle className="text-red-600 mt-1" size={20} />
            <div className="ml-3">
              <h3 className="text-red-800 font-semibold">Error Loading Users</h3>
              <p className="text-red-700 mt-1">{error}</p>
              <button
                onClick={() => {
                  setLoading(true)
                  setError(null)
                  fetchUsers()
                  fetchStats()
                }}
                className="mt-3 btn btn-sm btn-outline text-red-600 hover:bg-red-100"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage your team members and their access</p>
        </div>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-md"
          >
            <UserPlus size={16} className="mr-2" />
            Add Team Member
          </button>
        )}
      </div>

      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="card bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Debug:</strong> Total users loaded: {users.length} |
            Filtered: {filteredUsers.length} |
            Current user: {currentUser?.email} ({currentUser?.role})
          </p>
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_users || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Users</p>
                <p className="text-2xl font-bold text-green-600">{stats.active_users || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Admin Users</p>
                <p className="text-2xl font-bold text-purple-600">{stats.admin_users || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="text-purple-600" size={24} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Recent Logins</p>
                <p className="text-2xl font-bold text-orange-600">{stats.active_last_week || 0}</p>
                <p className="text-xs text-gray-500">Last 7 days</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          <div className="relative">
            <Filter size={16} className="absolute left-3 top-3 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="user">User</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Team Members ({filteredUsers.length})
          </h2>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || roleFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : users.length === 0
                ? 'No users available. Check API connection.'
                : 'Add your first team member to get started'
              }
            </p>
            {users.length === 0 && (
              <button
                onClick={() => {
                  setLoading(true)
                  fetchUsers()
                }}
                className="btn btn-primary"
              >
                Refresh Users
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Last Login</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                          {user.id === currentUser?.id && (
                            <span className="text-xs text-gray-500">(You)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center text-gray-900">
                        <Mail size={14} className="mr-2 text-gray-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                        {user.role === 'admin' && <Shield size={12} className="mr-1" />}
                        {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {user.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle size={12} className="mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle size={12} className="mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock size={12} className="mr-1" />
                        {formatDate(user.last_login)}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {currentUser?.role === 'admin' && user.id !== currentUser.id && (
                          <>
                            <button
                              className="btn btn-sm btn-outline"
                              title="Edit user"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="btn btn-sm btn-outline text-red-600 hover:bg-red-50"
                              title="Delete user"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {user.id === currentUser?.id && (
                          <button className="btn btn-sm btn-outline">
                            <Edit2 size={14} />
                            Edit Profile
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination placeholder */}
        {filteredUsers.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600">
              Showing {filteredUsers.length} user(s)
            </p>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-outline" disabled>Previous</button>
              <button className="btn btn-sm btn-outline" disabled>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Add Team Member</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle size={20} />
                </button>
              </div>
              <p className="text-gray-600 mb-4">
                Use the existing UserManagement component or create a new user form here.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button className="btn btn-primary">
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsers
