import React, { useState, useEffect } from 'react';
import {
  Users,
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Edit,
  DollarSign,
  Calendar
} from 'lucide-react';

const AccountManagement = () => {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [newAccountCount, setNewAccountCount] = useState('');
  const [updateReason, setUpdateReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalAccounts: 0,
    totalActiveUsers: 0
  });

  useEffect(() => {
    fetchOrganizationsAccounts();
  }, []);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
    'Content-Type': 'application/json'
  });

  const fetchOrganizationsAccounts = async () => {
    try {
      // Try new accounts endpoint first, fallback to legacy licenses endpoint
      let response;
      try {
        response = await fetch('/api/super-admin/organizations/accounts', {
          headers: getAuthHeaders()
        });
      } catch (error) {
        // Fallback to legacy endpoint
        response = await fetch('/api/super-admin/organizations/licenses', {
          headers: getAuthHeaders()
        });
      }

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);

        // Calculate summary - handle both license and account terminology
        const totalRevenue = data.reduce((sum, org) => sum + ((org.purchased_licenses || org.purchased_accounts || 0) * org.price_per_user), 0);
        const totalAccounts = data.reduce((sum, org) => sum + (org.purchased_licenses || org.purchased_accounts || 0), 0);
        const totalActiveUsers = data.reduce((sum, org) => sum + (org.active_users || 0), 0);

        setSummary({ totalRevenue, totalAccounts, totalActiveUsers });
      }
    } catch (error) {
      console.error('Error fetching organizations accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccounts = async (e) => {
    e.preventDefault();
    if (!selectedOrg || !newAccountCount) return;

    setUpdating(true);
    try {
      // Try new accounts endpoint first, fallback to legacy licenses endpoint
      let response;
      try {
        response = await fetch(`/api/super-admin/organizations/${selectedOrg.id}/accounts`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            newAccountCount: parseInt(newAccountCount),
            reason: updateReason,
            effectiveDate: new Date()
          })
        });
      } catch (error) {
        // Fallback to legacy endpoint
        response = await fetch(`/api/super-admin/organizations/${selectedOrg.id}/licenses`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            newLicenseCount: parseInt(newAccountCount),
            reason: updateReason,
            effectiveDate: new Date()
          })
        });
      }

      const data = await response.json();

      if (response.ok) {
        alert('Account subscriptions updated successfully!');
        setSelectedOrg(null);
        setNewAccountCount('');
        setUpdateReason('');
        fetchOrganizationsAccounts(); // Refresh data
      } else {
        alert(`Update failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error updating accounts:', error);
      alert('Update failed: Network error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading account information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <CreditCard className="w-8 h-8 mr-3 text-blue-600" />
            Account Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage user accounts for all organizations ($15/user/month)
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Total Monthly Revenue</h3>
                <p className="text-3xl font-bold text-green-600">
                  ${summary.totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Total Accounts</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {summary.totalAccounts}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Active Users</h3>
                <p className="text-3xl font-bold text-purple-600">
                  {summary.totalActiveUsers}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Organizations Account Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Organization Accounts
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accounts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monthly Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.map((org) => {
                  const accountCount = org.purchased_licenses || org.purchased_accounts || 0;
                  const utilizationPercent = accountCount > 0 ? Math.round((org.active_users / accountCount) * 100) : 0;
                  const isOverUtilized = org.active_users > accountCount;

                  return (
                    <tr key={org.id} className={isOverUtilized ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {org.name}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            {org.payment_status === 'paid' ? (
                              <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-yellow-500 mr-1" />
                            )}
                            {org.payment_status || 'trial'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-medium">{accountCount}</span>
                        {isOverUtilized && (
                          <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                            Over limit
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {org.active_users}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(accountCount * (org.price_per_user || 15)).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className={`h-2 rounded-full ${
                                utilizationPercent > 100 ? 'bg-red-500' :
                                utilizationPercent > 80 ? 'bg-yellow-500' : 'bg-blue-600'
                              }`}
                              style={{
                                width: `${Math.min(utilizationPercent, 100)}%`
                              }}
                            ></div>
                          </div>
                          <span className={`text-sm ${
                            utilizationPercent > 100 ? 'text-red-600 font-medium' : 'text-gray-600'
                          }`}>
                            {utilizationPercent}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedOrg(org);
                            setNewAccountCount(accountCount.toString());
                          }}
                          className="text-indigo-600 hover:text-indigo-900 flex items-center"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Update Accounts
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Update Accounts Modal */}
        {selectedOrg && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Edit className="w-5 h-5 mr-2" />
                Update Accounts for {selectedOrg.name}
              </h3>

              <form onSubmit={handleUpdateAccounts}>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Current: <span className="font-medium">{selectedOrg.purchased_licenses || selectedOrg.purchased_accounts || 0}</span> accounts,
                    <span className="font-medium"> {selectedOrg.active_users}</span> active users
                  </p>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Account Count *
                  </label>
                  <input
                    type="number"
                    min={selectedOrg.active_users}
                    value={newAccountCount}
                    onChange={(e) => setNewAccountCount(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={updating}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum: {selectedOrg.active_users} (cannot be less than active users)
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Change
                  </label>
                  <textarea
                    value={updateReason}
                    onChange={(e) => setUpdateReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="e.g., Customer requested upgrade, team expansion, etc."
                    disabled={updating}
                  />
                </div>

                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span>Current monthly cost:</span>
                      <span>${((selectedOrg.purchased_licenses || selectedOrg.purchased_accounts || 0) * 15).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>New monthly cost:</span>
                      <span>${(parseInt(newAccountCount || 0) * 15).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600 font-medium">
                      <span>Monthly change:</span>
                      <span>
                        {((parseInt(newAccountCount || 0) - (selectedOrg.purchased_licenses || selectedOrg.purchased_accounts || 0)) * 15) >= 0 ? '+' : ''}
                        ${((parseInt(newAccountCount || 0) - (selectedOrg.purchased_licenses || selectedOrg.purchased_accounts || 0)) * 15).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrg(null);
                      setNewAccountCount('');
                      setUpdateReason('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating || !newAccountCount}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {updating ? 'Updating...' : 'Update Accounts'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountManagement;