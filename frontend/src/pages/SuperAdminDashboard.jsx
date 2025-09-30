import React, { useState, useEffect } from 'react';

const SuperAdminDashboard = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginCredentials, setLoginCredentials] = useState({
    email: 'admin@uppalcrm.com',
    password: 'SuperAdmin123!'
  });

  const API_BASE = 'https://uppalcrm-api.onrender.com/api/super-admin';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginCredentials),
      });

      const data = await response.json();

      if (response.ok) {
        setAuthToken(data.token);
        setIsLoggedIn(true);
        await loadOrganizations(data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Connection error: ' + error.message);
    }

    setLoading(false);
  };

  const loadOrganizations = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/organizations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      } else {
        throw new Error('Failed to load organizations');
      }
    } catch (error) {
      setError('Failed to load organizations: ' + error.message);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuthToken(null);
    setOrganizations([]);
    setError('');
  };

  const getStatusBadge = (isActive, trialStatus) => {
    let className = 'px-3 py-1 rounded-full text-xs font-semibold ';
    let text = '';

    if (!isActive) {
      className += 'bg-red-100 text-red-800';
      text = 'Inactive';
    } else if (trialStatus === 'active') {
      className += 'bg-yellow-100 text-yellow-800';
      text = 'Trial';
    } else {
      className += 'bg-green-100 text-green-800';
      text = 'Active';
    }

    return <span className={className}>{text}</span>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  const calculateStats = () => {
    const totalOrgs = organizations.length;
    const activeOrgs = organizations.filter(org => org.is_active).length;
    const trialOrgs = organizations.filter(org => org.trial_status === 'active').length;
    const totalUsers = organizations.reduce((sum, org) => sum + (org.active_user_count || 0), 0);

    return { totalOrgs, activeOrgs, trialOrgs, totalUsers };
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">🚀 Super Admin</h1>
            <p className="text-gray-600">Multi-Tenant CRM Dashboard</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={loginCredentials.email}
                onChange={(e) => setLoginCredentials({...loginCredentials, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={loginCredentials.password}
                onChange={(e) => setLoginCredentials({...loginCredentials, password: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">📊 Super Admin Dashboard</h1>
              <p className="text-indigo-100 mt-1">Multi-Tenant CRM Management</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
            <div className="text-3xl font-bold text-indigo-600">{stats.totalOrgs}</div>
            <div className="text-gray-600 font-semibold">Total Organizations</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="text-3xl font-bold text-green-600">{stats.activeOrgs}</div>
            <div className="text-gray-600 font-semibold">Active Organizations</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
            <div className="text-3xl font-bold text-yellow-600">{stats.trialOrgs}</div>
            <div className="text-gray-600 font-semibold">Active Trials</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <div className="text-3xl font-bold text-purple-600">{stats.totalUsers}</div>
            <div className="text-gray-600 font-semibold">Total Users</div>
          </div>
        </div>

        {/* Organizations List */}
        <div className="bg-white rounded-xl shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">🏢 All Organizations</h2>
          </div>
          <div className="p-6">
            {organizations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No organizations found
              </div>
            ) : (
              <div className="space-y-4">
                {organizations.map((org) => (
                  <div key={org.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-gray-800">
                        {org.organization_name || org.name}
                      </h3>
                      {getStatusBadge(org.is_active, org.trial_status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">Domain:</span>
                        <span className="ml-2 text-gray-800">{org.domain || 'Not set'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Plan:</span>
                        <span className="ml-2 text-gray-800">{org.subscription_plan || 'None'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Users:</span>
                        <span className="ml-2 text-gray-800">{org.active_user_count || 0}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Admin:</span>
                        <span className="ml-2 text-gray-800">{org.admin_email || 'Not set'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Created:</span>
                        <span className="ml-2 text-gray-800">{formatDate(org.created_at)}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Trial Status:</span>
                        <span className="ml-2 text-gray-800">{org.trial_status || 'None'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;