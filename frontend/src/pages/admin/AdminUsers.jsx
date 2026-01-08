import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usersAPI } from '../../services/api'
import toast from 'react-hot-toast'
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
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  // Add User Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'user',
    send_invitation: true
  })
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    console.log('🔍 AdminUsers: Component mounted, fetching data...')
    console.log('Current user:', currentUser)
    console.log('Auth token in localStorage:', localStorage.getItem('authToken'))
    console.log('Org slug in localStorage:', localStorage.getItem('organizationSlug'))
    fetchUsers()
    fetchStats()
  }, [])

  const fetchUsers = async () => {
    try {
      console.log('📡 Fetching users from API using centralized service...')

      const data = await usersAPI.getUsers()
      console.log('✅ Users data received:', data)
      console.log('Number of users:', data.users?.length || 0)

      setUsers(data.users || [])
      setError(null)
    } catch (error) {
      console.error('❌ Error fetching users:', error)
      setError(error.response?.data?.message || error.message || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      console.log('📊 Fetching user statistics from API...')

      const data = await usersAPI.getStats()
      console.log('✅ Stats data received:', data)
      setStats(data.user_stats)
    } catch (error) {
      console.error('❌ Error fetching stats:', error)
      // Don't fail the whole page if stats fail
    }
  }

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      role: 'user',
      send_invitation: true
    })
    setFormErrors({})
    setSubmitError(null)
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    resetForm()
    setIsSubmitting(false)
  }

  const validateForm = () => {
    const errors = {}

    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required'
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required'
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    } else if (users.some(u => u.email.toLowerCase() === formData.email.toLowerCase())) {
      errors.email = 'This email is already registered in your organization'
    }

    if (!formData.role) {
      errors.role = 'Role is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: null
      }))
    }
    setSubmitError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      console.log('📤 Creating new user:', formData)
      const response = await usersAPI.createUser(formData)
      console.log('✅ User created successfully:', response)

      // Show success message
      toast.success(`${formData.first_name} ${formData.last_name} has been added to your team!`)

      // Refresh the user list
      await fetchUsers()
      await fetchStats()

      // Close modal and reset form
      handleCloseModal()
    } catch (error) {
      console.error('❌ Error creating user:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create user'
      setSubmitError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (user) => {
    // Show confirmation dialog
    const confirmMessage = `Are you sure you want to delete ${user.first_name} ${user.last_name}?\n\nThis will permanently remove their account and cannot be undone.`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      console.log('🗑️ Deleting user:', user.id, user.email)

      // Show loading toast
      const loadingToast = toast.loading(`Deleting ${user.first_name} ${user.last_name}...`)

      await usersAPI.deleteUser(user.id)

      console.log('✅ User deleted successfully')

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast)
      toast.success(`${user.first_name} ${user.last_name} has been deleted`)

      // Refresh the user list and stats
      await fetchUsers()
      await fetchStats()
    } catch (error) {
      console.error('❌ Error deleting user:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete user'
      toast.error(errorMessage)
    }
  }

  const handleEditUser = (user) => {
    console.log('✏️ Opening edit modal for user:', user.id, user.email)
    setSelectedUser(user)
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setSelectedUser(null)
  }

  const handleUpdateUser = async (updatedRole) => {
    if (!selectedUser) return

    try {
      console.log('📤 Updating user role:', selectedUser.id, 'to', updatedRole)

      const loadingToast = toast.loading(`Updating ${selectedUser.first_name} ${selectedUser.last_name}...`)

      await usersAPI.updateUser(selectedUser.id, { role: updatedRole })

      console.log('✅ User updated successfully')

      toast.dismiss(loadingToast)
      toast.success(`${selectedUser.first_name} ${selectedUser.last_name} has been updated to ${updatedRole}`)

      // Refresh the user list and stats
      await fetchUsers()
      await fetchStats()

      // Close modal
      handleCloseEditModal()
    } catch (error) {
      console.error('❌ Error updating user:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update user'
      toast.error(errorMessage)
    }
  }

  const handleResetPassword = async () => {
    if (!selectedUser) return

    const newPassword = prompt(`Enter new password for ${selectedUser.first_name} ${selectedUser.last_name}:`, '')
    if (!newPassword) return

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    try {
      console.log('🔐 Resetting password for user:', selectedUser.id)

      const loadingToast = toast.loading('Resetting password...')

      await usersAPI.resetPassword(selectedUser.id, { password: newPassword })

      console.log('✅ Password reset successfully')

      toast.dismiss(loadingToast)
      toast.success(`Password reset successfully for ${selectedUser.first_name} ${selectedUser.last_name}`)

      // Close modal
      handleCloseEditModal()
    } catch (error) {
      console.error('❌ Error resetting password:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to reset password'
      toast.error(errorMessage)
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
                              onClick={() => handleEditUser(user)}
                              className="btn btn-sm btn-outline"
                              title="Edit user"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="btn btn-sm btn-outline text-red-600 hover:bg-red-50"
                              title="Delete user"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {user.id === currentUser?.id && (
                          <button 
                            onClick={() => handleEditUser(user)}
                            className="btn btn-sm btn-outline"
                            title="Edit your profile"
                          >
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Add Team Member</h3>
                    <p className="text-sm text-gray-600 mt-1">Invite a new team member to your organization</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600"
                    disabled={isSubmitting}
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                {/* Error Alert */}
                {submitError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="text-red-600 mt-0.5" size={16} />
                      <div className="ml-2">
                        <p className="text-sm text-red-800">{submitError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* First Name and Last Name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        className={`input ${formErrors.first_name ? 'border-red-500' : ''}`}
                        placeholder="John"
                        disabled={isSubmitting}
                      />
                      {formErrors.first_name && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.first_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        className={`input ${formErrors.last_name ? 'border-red-500' : ''}`}
                        placeholder="Doe"
                        disabled={isSubmitting}
                      />
                      {formErrors.last_name && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.last_name}</p>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`input ${formErrors.email ? 'border-red-500' : ''}`}
                      placeholder="john.doe@example.com"
                      disabled={isSubmitting}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Must be unique within your organization
                    </p>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className={`select ${formErrors.role ? 'border-red-500' : ''}`}
                      disabled={isSubmitting}
                    >
                      <option value="user">User - Standard access to leads and contacts</option>
                      <option value="manager">Manager - User permissions + team management</option>
                      <option value="admin">Admin - Full system access and configuration</option>
                    </select>
                    {formErrors.role && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
                    )}
                  </div>

                  {/* Send Invitation Email */}
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        name="send_invitation"
                        checked={formData.send_invitation}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="ml-3">
                      <label className="text-sm font-medium text-gray-700">
                        Send invitation email
                      </label>
                      <p className="text-xs text-gray-500">
                        User will receive an email with instructions to set up their account
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn btn-outline"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding User...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} className="mr-2" />
                        Add User
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Edit User Role</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Update role for {selectedUser.first_name} {selectedUser.last_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* User Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                    {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-900">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </p>
                    <p className="text-sm text-gray-600">{selectedUser.email}</p>
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-3 mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select New Role
                </label>

                <button
                  onClick={() => handleUpdateUser('admin')}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedUser.role === 'admin'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center">
                        <Shield size={16} className="mr-2 text-blue-600" />
                        <span className="font-medium text-gray-900">Admin</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Full system access and configuration
                      </p>
                    </div>
                    {selectedUser.role === 'admin' && (
                      <CheckCircle size={20} className="text-blue-600" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => handleUpdateUser('manager')}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedUser.role === 'manager'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center">
                        <Users size={16} className="mr-2 text-purple-600" />
                        <span className="font-medium text-gray-900">Manager</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        User permissions plus team management
                      </p>
                    </div>
                    {selectedUser.role === 'manager' && (
                      <CheckCircle size={20} className="text-purple-600" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => handleUpdateUser('user')}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedUser.role === 'user'
                      ? 'border-gray-500 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center">
                        <Users size={16} className="mr-2 text-gray-600" />
                        <span className="font-medium text-gray-900">User</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Standard access to leads and contacts
                      </p>
                    </div>
                    {selectedUser.role === 'user' && (
                      <CheckCircle size={20} className="text-gray-600" />
                    )}
                  </div>
                </button>
              </div>

              {/* Reset Password */}
              <div className="mb-4 pt-4 border-t border-gray-200">
                <button
                  onClick={handleResetPassword}
                  className="w-full btn btn-outline text-orange-600 hover:bg-orange-50 border-orange-300"
                >
                  <Mail size={16} className="mr-2" />
                  Reset Password
                </button>
              </div>

              {/* Cancel Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleCloseEditModal}
                  className="btn btn-outline"
                >
                  Cancel
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
