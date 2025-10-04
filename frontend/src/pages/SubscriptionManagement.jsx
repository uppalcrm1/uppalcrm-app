import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Calendar,
  TrendingUp,
  Users,
  Database,
  Zap,
  AlertTriangle,
  DollarSign,
  CheckCircle,
  Plus,
  Minus
} from 'lucide-react';

const SubscriptionManagement = () => {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseAction, setLicenseAction] = useState(null); // 'add' or 'remove'
  const [licenseQuantity, setLicenseQuantity] = useState(1);
  const [processingLicense, setProcessingLicense] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api';

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('authToken')}`,
    'Content-Type': 'application/json',
    'X-Organization-Slug': localStorage.getItem('organizationSlug')
  });

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);

      const subResponse = await fetch(`${API_BASE_URL}/subscription`, {
        headers: getAuthHeaders()
      });

      if (subResponse.ok) {
        const subData = await subResponse.json();
        console.log('✅ Subscription data:', subData);
        setSubscription(subData.subscription);
        setUsage(subData.usage);
      } else {
        const errorData = await subResponse.json();
        console.error('❌ Error response:', errorData);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLicenseChange = async () => {
    if (!licenseAction || licenseQuantity < 1) return;

    setProcessingLicense(true);
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/current/licenses`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: licenseAction,
          quantity: licenseQuantity
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ ${data.message}\n\nNew monthly cost: $${data.pricing.new_monthly_cost}`);
        setShowLicenseModal(false);
        setLicenseQuantity(1);
        fetchSubscriptionData(); // Refresh data
      } else {
        alert(`❌ ${data.error}\n${data.message}`);
      }
    } catch (error) {
      console.error('Error updating licenses:', error);
      alert('Failed to update licenses. Please try again.');
    } finally {
      setProcessingLicense(false);
    }
  };

  const openLicenseModal = (action) => {
    setLicenseAction(action);
    setLicenseQuantity(1);
    setShowLicenseModal(true);
  };

  const getUsagePercentage = (current, limit) => {
    if (!limit) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageStatus = (current, limit) => {
    if (!limit) return 'unlimited';
    const percentage = (current / limit) * 100;
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'good';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      trial: { color: 'bg-blue-100 text-blue-800', label: 'Trial' },
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
      expired: { color: 'bg-gray-100 text-gray-800', label: 'Expired' }
    };

    const config = statusMap[status] || { color: 'bg-gray-100 text-gray-800', label: status };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading subscription information...</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Subscription Found</h2>
          <p className="text-gray-600 mb-6">Your organization doesn't have an active subscription.</p>
        </div>
      </div>
    );
  }

  // Check if trial
  const isTrial = subscription.is_trial || subscription.status === 'trial';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <CreditCard className="w-8 h-8 mr-3 text-blue-600" />
            Subscription & Billing
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your subscription and view usage details
          </p>
        </div>

        {/* Subscription Overview Card */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Subscription Overview</h2>
            {getStatusBadge(subscription.status)}
          </div>
          <div className="p-6">
            {isTrial ? (
              /* Trial Display */
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-blue-600">Trial Account</h3>
                  <p className="text-gray-600 mt-2">You're currently on a free trial period</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Trial Ends</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {formatDate(subscription.trial_ends_at)}
                    </p>
                    {subscription.days_remaining !== undefined && (
                      <p className="text-sm text-gray-600 mt-1">
                        {subscription.days_remaining} days remaining
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <Users className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">User Limit</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {subscription.max_users} users
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      included in trial
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>After trial:</strong> Pricing is simple - just $15 per user per month.
                    No hidden fees, no plan tiers.
                  </p>
                </div>
              </div>
            ) : (
              /* Paid Subscription Display */
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-green-600">Active Subscription</h3>
                    <p className="text-gray-600 mt-2">Your account is now active with full access</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">
                      ${subscription.monthly_price || 0}
                      <span className="text-lg text-gray-500 font-normal">/month</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {subscription.max_users} users × ${subscription.price_per_user || 15}
                    </p>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                    Pricing Breakdown
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Price per user</span>
                      <span className="font-semibold">${subscription.price_per_user || 15}/month</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Number of users</span>
                      <span className="font-semibold">{subscription.max_users} users</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-lg font-semibold text-gray-900">Total Monthly Cost</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${subscription.monthly_price || (subscription.max_users * 15)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Billing Period */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <Calendar className="w-5 h-5 text-gray-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Current Period Start</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(subscription.current_period_start)}
                    </p>
                  </div>

                  <div className="bg-white border border-gray-200 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <Calendar className="w-5 h-5 text-gray-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Current Period End</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(subscription.current_period_end)}
                    </p>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-blue-50 p-4 rounded-lg flex items-center">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Payment Method</p>
                    <p className="text-sm text-gray-600">
                      {subscription.payment_method === 'manual' ? 'Manual Payment (Invoice)' : subscription.payment_method}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manage Licenses Section - Only for paid subscriptions */}
        {!isTrial && subscription && (
          <div className="bg-white rounded-lg shadow-sm border mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Manage Licenses
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Licenses */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Current Licenses</h3>
                  <div className="flex items-baseline space-x-2 mb-2">
                    <span className="text-4xl font-bold text-gray-900">{subscription.max_users}</span>
                    <span className="text-gray-600">users</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">In use:</span>
                      <span className="font-semibold">{usage?.users_count || 0} users</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Available:</span>
                      <span className="font-semibold text-green-600">
                        {(subscription.max_users || 0) - (usage?.users_count || 0)} seats
                      </span>
                    </div>
                  </div>
                </div>

                {/* License Actions */}
                <div className="space-y-4">
                  <div>
                    <button
                      onClick={() => openLicenseModal('add')}
                      className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Add Licenses</span>
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Add more users to your subscription
                    </p>
                  </div>

                  {((subscription.max_users || 0) - (usage?.users_count || 0)) > 0 && (
                    <div>
                      <button
                        onClick={() => openLicenseModal('remove')}
                        className="w-full flex items-center justify-center space-x-2 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <Minus className="w-5 h-5" />
                        <span>Remove Licenses</span>
                      </button>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Remove unused licenses
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Info */}
              <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>How it works:</strong> Adding licenses = +$15/month per user.
                  Removing licenses = -$15/month per user. Changes take effect immediately.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* License Change Modal */}
        {showLicenseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {licenseAction === 'add' ? 'Add' : 'Remove'} Licenses
              </h3>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of licenses to {licenseAction}:
                </label>
                <input
                  type="number"
                  min="1"
                  value={licenseQuantity}
                  onChange={(e) => setLicenseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Price Preview */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current licenses:</span>
                    <span className="font-semibold">{subscription.max_users} users</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{licenseAction === 'add' ? 'Adding' : 'Removing'}:</span>
                    <span className="font-semibold">
                      {licenseAction === 'add' ? '+' : '-'}{licenseQuantity} users
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold">New licenses:</span>
                    <span className="font-bold text-blue-600">
                      {licenseAction === 'add'
                        ? subscription.max_users + licenseQuantity
                        : subscription.max_users - licenseQuantity} users
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Current cost:</span>
                    <span className="font-semibold">${subscription.monthly_price || (subscription.max_users * 15)}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Change:</span>
                    <span className={`font-semibold ${licenseAction === 'add' ? 'text-red-600' : 'text-green-600'}`}>
                      {licenseAction === 'add' ? '+' : '-'}${licenseQuantity * 15}/month
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-200">
                    <span className="font-bold">New monthly cost:</span>
                    <span className="font-bold text-blue-600">
                      ${licenseAction === 'add'
                        ? (subscription.monthly_price || (subscription.max_users * 15)) + (licenseQuantity * 15)
                        : (subscription.monthly_price || (subscription.max_users * 15)) - (licenseQuantity * 15)}/month
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowLicenseModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={processingLicense}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLicenseChange}
                  disabled={processingLicense}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {processingLicense ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Usage Overview */}
        {usage && (
          <div className="bg-white rounded-lg shadow-sm border mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Current Usage
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Users */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      getUsageStatus(usage.users_count, subscription.max_users) === 'critical' ? 'bg-red-100 text-red-800' :
                      getUsageStatus(usage.users_count, subscription.max_users) === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {getUsageStatus(usage.users_count, subscription.max_users) === 'unlimited' ? 'Unlimited' :
                       `${Math.round(getUsagePercentage(usage.users_count, subscription.max_users))}%`}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Active Users</h3>
                  <p className="text-2xl font-bold text-gray-900">{usage.users_count || 0}</p>
                  <p className="text-sm text-gray-500">
                    {subscription.max_users ? `of ${subscription.max_users} limit` : 'Unlimited'}
                  </p>
                  {subscription.max_users && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          getUsageStatus(usage.users_count, subscription.max_users) === 'critical' ? 'bg-red-500' :
                          getUsageStatus(usage.users_count, subscription.max_users) === 'warning' ? 'bg-yellow-500' :
                          'bg-blue-600'
                        }`}
                        style={{
                          width: `${getUsagePercentage(usage.users_count, subscription.max_users)}%`
                        }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Contacts */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Database className="w-5 h-5 text-green-600" />
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                      Unlimited
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Contacts</h3>
                  <p className="text-2xl font-bold text-gray-900">{usage.contacts_count || 0}</p>
                  <p className="text-sm text-gray-500">Unlimited</p>
                </div>

                {/* Leads */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                      Unlimited
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Leads</h3>
                  <p className="text-2xl font-bold text-gray-900">{usage.leads_count || 0}</p>
                  <p className="text-sm text-gray-500">Unlimited</p>
                </div>

                {/* Storage */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Database className="w-5 h-5 text-orange-600" />
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                      Unlimited
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Storage</h3>
                  <p className="text-2xl font-bold text-gray-900">-</p>
                  <p className="text-sm text-gray-500">Unlimited</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionManagement;
