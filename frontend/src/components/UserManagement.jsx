import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, UserPlus, Settings, Mail, Eye, EyeOff, Key, Shield, 
  Trash2, Edit, Check, X, Search, Filter, MoreHorizontal, 
  Download, Upload, AlertCircle, CheckCircle, Clock,
  ChevronDown, ChevronUp, RefreshCw, Archive, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { userManagementAPI } from '../services/api';

const UserManagementSystem = () => {
  const queryClient = useQueryClient();
  
  // State management
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination and filtering
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Form states
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'user'
  });

  // Fetch users with React Query
  const { 
    data: usersData, 
    isLoading: loadingUsers, 
    error: usersError,
    refetch: refetchUsers 
  } = useQuery({
    queryKey: ['users', page, limit, search, roleFilter, statusFilter, sortBy, sortOrder],
    queryFn: () => userManagementAPI.getUsers({ 
      page, limit, search, role: roleFilter, status: statusFilter, sort: sortBy, order: sortOrder 
    }),
    staleTime: 30000, // 30 seconds
  });

  // Fetch audit logs
  const { 
    data: auditData, 
    isLoading: loadingAudit 
  } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => userManagementAPI.getAuditLog({ page, limit: 10 }),
    enabled: showAuditLog,
    staleTime: 60000, // 1 minute
  });

  // Fetch license information
  const { 
    data: licenseData, 
    isLoading: loadingLicense,
    error: licenseError 
  } = useQuery({
    queryKey: ['license-info'],
    queryFn: userManagementAPI.getLicenseInfo,
    staleTime: 60000, // 1 minute
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: userManagementAPI.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      queryClient.invalidateQueries(['license-info']); // Refresh license info after user creation
      toast.success('User created successfully! Credentials sent via email.');
      setNewUser({ name: '', email: '', role: 'user' });
      setShowAddUser(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create user');
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, ...updates }) => userManagementAPI.updateUser(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('User updated successfully');
      setEditingUser(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update user');
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: userManagementAPI.resetPassword,
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('Password reset successfully! New credentials sent via email.');
      setShowResetPassword(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: userManagementAPI.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('User removed successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to remove user');
    }
  });

  const bulkOperationMutation = useMutation({
    mutationFn: userManagementAPI.bulkOperation,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['users']);
      const { results } = data;
      toast.success(`Bulk operation completed: ${results.successful} successful, ${results.failed} failed`);
      setSelectedUsers([]);
      setShowBulkActions(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to perform bulk operation');
    }
  });

  // Event handlers
  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === usersData?.users?.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(usersData?.users?.map(user => user.id) || []);
    }
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) {
      toast.error('Please fill in all required fields');
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleUpdateUser = (userId, updates) => {
    updateUserMutation.mutate({ id: userId, ...updates });
  };

  const handleDeleteUser = (userId) => {
    if (window.confirm('Are you sure you want to remove this user? They will be deactivated and their access will be revoked.')) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleBulkOperation = (operation, role = null) => {
    if (selectedUsers.length === 0) {
      toast.error('Please select users first');
      return;
    }

    const operationLabels = {
      activate: 'activate',
      deactivate: 'deactivate', 
      delete: 'remove',
      reset_password: 'reset passwords for'
    };

    const confirmMessage = `Are you sure you want to ${operationLabels[operation]} ${selectedUsers.length} selected user(s)?`;
    
    if (window.confirm(confirmMessage)) {
      bulkOperationMutation.mutate({
        userIds: selectedUsers,
        operation,
        role
      });
    }
  };

  // Utility functions
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const exportUsers = () => {
    const csv = [
      'Name,Email,Role,Status,Last Login,Created At',
      ...usersData.users.map(user => 
        `${user.name},${user.email},${user.role},${user.status},${formatDate(user.last_login)},${formatDate(user.created_at)}`
      )
    ].join('\\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Loading and error states
  if (loadingUsers) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-blue-600" size={48} />
          <p className="text-gray-600">Loading user management...</p>
        </div>
      </div>
    );
  }

  if (usersError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-red-600" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Users</h2>
          <p className="text-gray-600 mb-4">{usersError.message}</p>
          <button 
            onClick={() => refetchUsers()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const users = usersData?.users || [];
  const pagination = usersData?.pagination || {};

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Users className="text-blue-600" />
                User Management
              </h1>
              <p className="text-gray-600 mt-2">
                Manage team members and their access to your CRM ({pagination.total_users || 0} total)
              </p>
              
              {/* License Information */}
              {licenseData?.licenseInfo && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Shield className="text-blue-600" size={20} />
                        <div>
                          <div className="font-semibold text-gray-900">
                            {licenseData.licenseInfo.activeUsers}/{licenseData.licenseInfo.purchasedLicenses} Licenses Used
                          </div>
                          <div className="text-sm text-gray-600">
                            {licenseData.licenseInfo.availableSeats} seats available
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              licenseData.licenseInfo.utilizationPercentage >= 90 
                                ? 'bg-red-500' 
                                : licenseData.licenseInfo.utilizationPercentage >= 80 
                                ? 'bg-yellow-500' 
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, licenseData.licenseInfo.utilizationPercentage)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {licenseData.licenseInfo.utilizationPercentage}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        ${licenseData.licenseInfo.monthlyCost}/month
                      </div>
                      <div className="text-sm text-gray-600">
                        $15 per user
                      </div>
                    </div>
                  </div>
                  
                  {licenseData.licenseInfo.availableSeats === 0 && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <AlertCircle size={16} className="inline mr-1" />
                      License limit reached. Purchase additional licenses to add more users.
                    </div>
                  )}
                </div>
              )}
              
              {loadingLicense && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg animate-pulse">
                  <div className="flex items-center gap-2">
                    <Shield className="text-gray-400" size={20} />
                    <div className="text-gray-500">Loading license information...</div>
                  </div>
                </div>
              )}
              
              {licenseError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle size={20} />
                    <div>Failed to load license information</div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {selectedUsers.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center gap-2"
                  >
                    <Users size={18} />
                    Bulk Actions ({selectedUsers.length})
                    <ChevronDown size={16} />
                  </button>
                  
                  {showBulkActions && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                      <div className="p-2">
                        <button
                          onClick={() => handleBulkOperation('activate')}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 rounded flex items-center gap-2"
                        >
                          <UserCheck size={16} className="text-green-600" />
                          Activate Users
                        </button>
                        <button
                          onClick={() => handleBulkOperation('deactivate')}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 rounded flex items-center gap-2"
                        >
                          <Archive size={16} className="text-red-600" />
                          Deactivate Users
                        </button>
                        <button
                          onClick={() => handleBulkOperation('reset_password')}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded flex items-center gap-2"
                        >
                          <Key size={16} className="text-blue-600" />
                          Reset Passwords
                        </button>
                        <button
                          onClick={() => handleBulkOperation('delete')}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 rounded flex items-center gap-2 text-red-600"
                        >
                          <Trash2 size={16} />
                          Remove Users
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <button
                onClick={() => setShowAuditLog(true)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Clock size={18} />
                Audit Log
              </button>
              
              <button
                onClick={exportUsers}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Download size={18} />
                Export
              </button>
              
              <button
                onClick={() => setShowAddUser(true)}
                disabled={licenseData?.licenseInfo?.availableSeats === 0}
                className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  licenseData?.licenseInfo?.availableSeats === 0
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title={
                  licenseData?.licenseInfo?.availableSeats === 0
                    ? 'License limit reached. Purchase additional licenses to add more users.'
                    : 'Add a new team member'
                }
              >
                <UserPlus size={20} />
                Add Team Member
                {licenseData?.licenseInfo && (
                  <span className="ml-1 text-xs opacity-75">
                    ({licenseData.licenseInfo.availableSeats} left)
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border mb-6 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Search & Filters</h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-2"
            >
              <Filter size={18} />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
              {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <button
              onClick={() => refetchUsers()}
              className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Roles</option>
                  <option value="admin">Administrator</option>
                  <option value="user">Standard User</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="created_at">Created Date</option>
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                  <option value="last_login">Last Login</option>
                  <option value="role">Role</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Showing {users.length} of {pagination.total_users || 0}</span>
              {pagination.total_pages > 1 && (
                <span>Page {pagination.current_page} of {pagination.total_pages}</span>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left p-4 font-medium text-gray-700">User</th>
                  <th className="text-left p-4 font-medium text-gray-700">Role</th>
                  <th className="text-left p-4 font-medium text-gray-700">Status</th>
                  <th className="text-left p-4 font-medium text-gray-700">Last Login</th>
                  <th className="text-left p-4 font-medium text-gray-700">Created</th>
                  <th className="text-left p-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.is_first_login && (
                          <div className="text-xs text-orange-600 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Needs to change password on first login
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {editingUser === user.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateUser(user.id, { role: e.target.value })}
                            className="border rounded px-2 py-1 text-sm"
                          >
                            <option value="user">Standard User</option>
                            <option value="admin">Administrator</option>
                          </select>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role === 'admin' ? (
                              <><Shield size={12} className="inline mr-1" />Administrator</>
                            ) : (
                              'Standard User'
                            )}
                          </span>
                          <button
                            onClick={() => setEditingUser(user.id)}
                            className="text-gray-400 hover:text-blue-600"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(user.status)}`}>
                        {user.status === 'active' ? (
                          <><CheckCircle size={12} className="inline mr-1" />Active</>
                        ) : (
                          <><AlertCircle size={12} className="inline mr-1" />Inactive</>
                        )}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {formatDate(user.last_login)}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowResetPassword(user.id)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Reset Password"
                        >
                          <Key size={16} />
                        </button>
                        <button
                          onClick={() => handleUpdateUser(user.id, { 
                            status: user.status === 'active' ? 'inactive' : 'active' 
                          })}
                          className={`p-1 ${user.status === 'active' ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                          title={user.status === 'active' ? 'Deactivate User' : 'Activate User'}
                        >
                          {user.status === 'active' ? <Archive size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Remove User"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="p-6 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {users.length} of {pagination.total_users} users
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.has_prev}
                  className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {pagination.current_page} of {pagination.total_pages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.has_next}
                  className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {showAddUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold mb-4">Add New Team Member</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">What happens next:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• A secure password will be automatically generated</li>
                    <li>• Login credentials will be sent to their email</li>
                    <li>• They'll be required to change password on first login</li>
                    <li>• User will be automatically activated</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddUser(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50"
                  disabled={createUserMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={createUserMutation.isPending}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {createUserMutation.isPending ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Mail size={16} />
                  )}
                  {createUserMutation.isPending ? 'Creating...' : 'Add & Send Invite'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetPassword && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold mb-4">Reset Password</h3>
              
              <p className="text-gray-600 mb-6">
                A new secure password will be generated and sent to the user's email address. 
                They will be required to change it on their next login.
              </p>
              
              <div className="bg-orange-50 p-4 rounded-lg mb-6">
                <h4 className="font-medium text-orange-900 mb-2">Security Notice:</h4>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• User's current sessions will remain active</li>
                  <li>• New password must be changed on first login</li>
                  <li>• Email notification will be sent immediately</li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetPassword(null)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50"
                  disabled={resetPasswordMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={() => resetPasswordMutation.mutate(showResetPassword)}
                  disabled={resetPasswordMutation.isPending}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {resetPasswordMutation.isPending ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Key size={16} />
                  )}
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audit Log Modal */}
        {showAuditLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-xl font-semibold">User Management Audit Log</h3>
                <button
                  onClick={() => setShowAuditLog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="overflow-y-auto max-h-96">
                {loadingAudit ? (
                  <div className="p-6 text-center">
                    <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                    <p>Loading audit log...</p>
                  </div>
                ) : (
                  <div className="p-6">
                    {auditData?.audit_logs?.map((log) => (
                      <div key={log.id} className="border-b pb-4 mb-4 last:border-b-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                log.action.includes('DELETE') ? 'bg-red-100 text-red-800' :
                                log.action.includes('CREATE') ? 'bg-green-100 text-green-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {log.action.replace('_', ' ')}
                              </span>
                              <span className="text-sm text-gray-500">
                                by {log.performed_by_name || 'System'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {log.details?.target_user && `Target: ${log.details.target_user}`}
                              {log.details?.changes && ` | Changes: ${Object.keys(log.details.changes).join(', ')}`}
                            </p>
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(log.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-xl p-6 border">
            <h3 className="font-semibold text-gray-900 mb-2">Security Features</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Auto-generated secure passwords</li>
              <li>• Mandatory password change on first login</li>
              <li>• Email delivery of credentials</li>
              <li>• Role-based access control</li>
              <li>• Session management</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-xl p-6 border">
            <h3 className="font-semibold text-gray-900 mb-2">Admin Capabilities</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Add/remove team members</li>
              <li>• Reset any user's password</li>
              <li>• Upgrade users to admin</li>
              <li>• Bulk operations support</li>
              <li>• Complete audit trail</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-xl p-6 border">
            <h3 className="font-semibold text-gray-900 mb-2">User Experience</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Instant email notifications</li>
              <li>• Guided first-time setup</li>
              <li>• Advanced search & filtering</li>
              <li>• Export functionality</li>
              <li>• Real-time status updates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagementSystem;