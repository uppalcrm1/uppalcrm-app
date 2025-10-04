import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Calendar,
  TrendingUp,
  Users,
  Database,
  Zap,
  Check,
  X,
  AlertTriangle,
  ArrowUpCircle,
  Settings
} from 'lucide-react';

const SubscriptionManagement = () => {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [billingPreview, setBillingPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    fetchSubscriptionData();
    fetchAvailablePlans();
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

      console.log('🔍 Fetching subscription from:', `${API_BASE_URL}/subscription`);
      console.log('📋 Headers:', getAuthHeaders());

      // Fetch subscription details
      const subResponse = await fetch(`${API_BASE_URL}/subscription`, {
        headers: getAuthHeaders()
      });

      console.log('📡 Response status:', subResponse.status);

      if (subResponse.ok) {
        const subData = await subResponse.json();
        console.log('✅ Subscription data:', subData);
        setSubscription(subData.subscription);
        setUsage(subData.usage);
      } else {
        const errorData = await subResponse.json();
        console.error('❌ Error response:', errorData);
      }

      // Fetch billing preview
      const billingResponse = await fetch(`${API_BASE_URL}/subscription/billing/preview`, {
        headers: getAuthHeaders()
      });

      if (billingResponse.ok) {
        const billingData = await billingResponse.json();
        setBillingPreview(billingData);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePlans = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/plans`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setPlans(data);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const handlePlanUpgrade = async (planId, billingCycle = 'monthly') => {
    if (!planId) return;

    setUpgrading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/subscription`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          subscription_plan_id: planId,
          billing_cycle: billingCycle
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Subscription updated successfully!');
        setSelectedPlan(null);
        fetchSubscriptionData(); // Refresh data
      } else {
        alert(`Failed to update subscription: ${data.error}`);
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription: Network error');
    } finally {
      setUpgrading(false);
    }
  };

  const getUsagePercentage = (current, limit) => {
    if (!limit) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageStatus = (current, limit) => {
    if (!limit) return 'unlimited';
    const percentage = (current / limit) * 100;
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'good';
  };

  const formatPrice = (priceInCents) => {
    return (priceInCents / 100).toFixed(2);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center\">
        <div className="text-center max-w-md\">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4\" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2\">No Subscription Found</h2>
          <p className="text-gray-600 mb-6\">Your organization doesn't have an active subscription.</p>
          <button
            onClick={() => fetchAvailablePlans()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700\"
          >
            View Available Plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6\">
      <div className="max-w-7xl mx-auto\">
        {/* Header */}
        <div className="mb-8\">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center\">
            <CreditCard className="w-8 h-8 mr-3 text-blue-600\" />
            Subscription Management
          </h1>
          <p className="text-gray-600 mt-2\">
            Manage your subscription plan, usage, and billing
          </p>
        </div>

        {/* Current Subscription Card */}
        <div className="bg-white rounded-lg shadow-sm border mb-8\">
          <div className="px-6 py-4 border-b border-gray-200\">
            <h2 className="text-lg font-medium text-gray-900 flex items-center justify-between\">
              <span className="flex items-center\">
                <Settings className="w-5 h-5 mr-2\" />
                Current Subscription
              </span>
              {getStatusBadge(subscription.status)}
            </h2>
          </div>
          <div className="p-6\">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6\">
              <div>
                <h3 className="text-xl font-semibold text-gray-900\">{subscription.plan_display_name}</h3>
                <p className="text-gray-600 mt-1\">{subscription.plan_description}</p>
                <div className="mt-4\">
                  <span className="text-2xl font-bold text-green-600\">
                    ${formatPrice(subscription.current_price)}
                  </span>
                  <span className="text-gray-500 ml-1\">/{subscription.billing_cycle}</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3\">Billing Period</h4>
                <div className="space-y-2\">
                  <div className="flex items-center text-sm\">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400\" />
                    <span>Start: {formatDate(subscription.current_period_start)}</span>
                  </div>
                  <div className="flex items-center text-sm\">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400\" />
                    <span>End: {formatDate(subscription.current_period_end)}</span>
                  </div>
                  {subscription.trial_end && subscription.status === 'trial' && (
                    <div className="flex items-center text-sm text-blue-600\">
                      <Calendar className="w-4 h-4 mr-2\" />
                      <span>Trial ends: {formatDate(subscription.trial_end)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end\">
                <button
                  onClick={() => setSelectedPlan('upgrade')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center\"
                >
                  <ArrowUpCircle className="w-4 h-4 mr-2\" />
                  Change Plan
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Overview */}
        {usage && (
          <div className="bg-white rounded-lg shadow-sm border mb-8\">
            <div className="px-6 py-4 border-b border-gray-200\">
              <h2 className="text-lg font-medium text-gray-900 flex items-center\">
                <TrendingUp className="w-5 h-5 mr-2\" />
                Current Usage
              </h2>
            </div>
            <div className="p-6\">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6\">
                {/* Users */}
                <div className="bg-gray-50 p-4 rounded-lg\">
                  <div className="flex items-center justify-between mb-2\">
                    <Users className="w-5 h-5 text-blue-600\" />
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      getUsageStatus(usage.active_users, subscription.max_users) === 'critical' ? 'bg-red-100 text-red-800' :
                      getUsageStatus(usage.active_users, subscription.max_users) === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {getUsageStatus(usage.active_users, subscription.max_users) === 'unlimited' ? 'Unlimited' :
                       `${Math.round(getUsagePercentage(usage.active_users, subscription.max_users))}%`}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900\">Active Users</h3>
                  <p className="text-2xl font-bold text-gray-900\">{usage.active_users}</p>
                  <p className="text-sm text-gray-500\">
                    {subscription.max_users ? `of ${subscription.max_users} limit` : 'Unlimited'}
                  </p>
                  {subscription.max_users && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2\">
                      <div
                        className={`h-2 rounded-full ${
                          getUsageStatus(usage.active_users, subscription.max_users) === 'critical' ? 'bg-red-500' :
                          getUsageStatus(usage.active_users, subscription.max_users) === 'warning' ? 'bg-yellow-500' :
                          'bg-blue-600'
                        }`}
                        style={{
                          width: `${getUsagePercentage(usage.active_users, subscription.max_users)}%`
                        }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Contacts */}
                <div className="bg-gray-50 p-4 rounded-lg\">
                  <div className="flex items-center justify-between mb-2\">
                    <Database className="w-5 h-5 text-green-600\" />
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      getUsageStatus(usage.total_contacts, subscription.max_contacts) === 'critical' ? 'bg-red-100 text-red-800' :
                      getUsageStatus(usage.total_contacts, subscription.max_contacts) === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {getUsageStatus(usage.total_contacts, subscription.max_contacts) === 'unlimited' ? 'Unlimited' :
                       `${Math.round(getUsagePercentage(usage.total_contacts, subscription.max_contacts))}%`}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900\">Contacts</h3>
                  <p className="text-2xl font-bold text-gray-900\">{usage.total_contacts}</p>
                  <p className="text-sm text-gray-500\">
                    {subscription.max_contacts ? `of ${subscription.max_contacts} limit` : 'Unlimited'}
                  </p>
                  {subscription.max_contacts && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2\">
                      <div
                        className={`h-2 rounded-full ${
                          getUsageStatus(usage.total_contacts, subscription.max_contacts) === 'critical' ? 'bg-red-500' :
                          getUsageStatus(usage.total_contacts, subscription.max_contacts) === 'warning' ? 'bg-yellow-500' :
                          'bg-green-600'
                        }`}
                        style={{
                          width: `${getUsagePercentage(usage.total_contacts, subscription.max_contacts)}%`
                        }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Leads */}
                <div className="bg-gray-50 p-4 rounded-lg\">
                  <div className="flex items-center justify-between mb-2\">
                    <Zap className="w-5 h-5 text-purple-600\" />
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      getUsageStatus(usage.total_leads, subscription.max_leads) === 'critical' ? 'bg-red-100 text-red-800' :
                      getUsageStatus(usage.total_leads, subscription.max_leads) === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {getUsageStatus(usage.total_leads, subscription.max_leads) === 'unlimited' ? 'Unlimited' :
                       `${Math.round(getUsagePercentage(usage.total_leads, subscription.max_leads))}%`}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900\">Leads</h3>
                  <p className="text-2xl font-bold text-gray-900\">{usage.total_leads}</p>
                  <p className="text-sm text-gray-500\">
                    {subscription.max_leads ? `of ${subscription.max_leads} limit` : 'Unlimited'}
                  </p>
                  {subscription.max_leads && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2\">
                      <div
                        className={`h-2 rounded-full ${
                          getUsageStatus(usage.total_leads, subscription.max_leads) === 'critical' ? 'bg-red-500' :
                          getUsageStatus(usage.total_leads, subscription.max_leads) === 'warning' ? 'bg-yellow-500' :
                          'bg-purple-600'
                        }`}
                        style={{
                          width: `${getUsagePercentage(usage.total_leads, subscription.max_leads)}%`
                        }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Custom Fields */}
                <div className="bg-gray-50 p-4 rounded-lg\">
                  <div className="flex items-center justify-between mb-2\">
                    <Settings className="w-5 h-5 text-orange-600\" />
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      getUsageStatus(usage.custom_fields_used, subscription.max_custom_fields) === 'critical' ? 'bg-red-100 text-red-800' :
                      getUsageStatus(usage.custom_fields_used, subscription.max_custom_fields) === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {getUsageStatus(usage.custom_fields_used, subscription.max_custom_fields) === 'unlimited' ? 'Unlimited' :
                       `${Math.round(getUsagePercentage(usage.custom_fields_used, subscription.max_custom_fields))}%`}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900\">Custom Fields</h3>
                  <p className="text-2xl font-bold text-gray-900\">{usage.custom_fields_used}</p>
                  <p className="text-sm text-gray-500\">
                    {subscription.max_custom_fields ? `of ${subscription.max_custom_fields} limit` : 'Unlimited'}
                  </p>
                  {subscription.max_custom_fields && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2\">
                      <div
                        className={`h-2 rounded-full ${
                          getUsageStatus(usage.custom_fields_used, subscription.max_custom_fields) === 'critical' ? 'bg-red-500' :
                          getUsageStatus(usage.custom_fields_used, subscription.max_custom_fields) === 'warning' ? 'bg-yellow-500' :
                          'bg-orange-600'
                        }`}
                        style={{
                          width: `${getUsagePercentage(usage.custom_fields_used, subscription.max_custom_fields)}%`
                        }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing Preview */}
        {billingPreview && (
          <div className="bg-white rounded-lg shadow-sm border mb-8\">
            <div className="px-6 py-4 border-b border-gray-200\">
              <h2 className="text-lg font-medium text-gray-900 flex items-center\">
                <CreditCard className="w-5 h-5 mr-2\" />
                Next Billing Cycle
              </h2>
            </div>
            <div className="p-6\">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6\">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2\">Base Cost</h3>
                  <p className="text-xl font-semibold text-gray-900\">
                    ${formatPrice(billingPreview.billing_preview.base_cost)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2\">Overage Cost</h3>
                  <p className="text-xl font-semibold text-gray-900\">
                    ${formatPrice(billingPreview.billing_preview.overage_cost)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2\">Total</h3>
                  <p className="text-xl font-bold text-green-600\">
                    ${formatPrice(billingPreview.billing_preview.total_cost)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan Selection Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50\">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto\">
              <div className="flex justify-between items-center mb-6\">
                <h3 className="text-lg font-medium text-gray-900\">Choose Your Plan</h3>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="text-gray-400 hover:text-gray-600\"
                >
                  <X className="w-6 h-6\" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6\">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border rounded-lg p-6 ${
                      plan.name === subscription?.plan_name ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="text-center mb-4\">
                      <h4 className="text-xl font-semibold text-gray-900\">{plan.display_name}</h4>
                      <p className="text-gray-600 text-sm mt-1\">{plan.description}</p>
                      <div className="mt-4\">
                        <span className="text-3xl font-bold text-gray-900\">
                          ${formatPrice(plan.monthly_price)}
                        </span>
                        <span className="text-gray-500\">/month</span>
                      </div>
                      {plan.yearly_price && (
                        <div className="mt-1\">
                          <span className="text-lg font-semibold text-green-600\">
                            ${formatPrice(plan.yearly_price)}
                          </span>
                          <span className="text-gray-500 text-sm\">/year</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 mb-6\">
                      <div className="flex items-center text-sm\">
                        <Users className="w-4 h-4 mr-2 text-gray-400\" />
                        <span>{plan.max_users ? `${plan.max_users} users` : 'Unlimited users'}</span>
                      </div>
                      <div className="flex items-center text-sm\">
                        <Database className="w-4 h-4 mr-2 text-gray-400\" />
                        <span>{plan.max_contacts ? `${plan.max_contacts} contacts` : 'Unlimited contacts'}</span>
                      </div>
                      <div className="flex items-center text-sm\">
                        <Zap className="w-4 h-4 mr-2 text-gray-400\" />
                        <span>{plan.max_leads ? `${plan.max_leads} leads` : 'Unlimited leads'}</span>
                      </div>
                    </div>

                    {plan.features_list && plan.features_list.length > 0 && (
                      <div className="mb-6\">
                        <h5 className="font-medium text-gray-900 mb-2\">Features</h5>
                        <ul className="space-y-1\">
                          {plan.features_list.map((feature, index) => (
                            <li key={index} className="flex items-center text-sm\">
                              {feature.is_included ? (
                                <Check className="w-4 h-4 mr-2 text-green-500\" />
                              ) : (
                                <X className="w-4 h-4 mr-2 text-red-500\" />
                              )}
                              <span>{feature.feature_name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {plan.name === subscription?.plan_name ? (
                      <div className="text-center py-2 px-4 bg-blue-100 text-blue-800 rounded-lg font-medium\">
                        Current Plan
                      </div>
                    ) : (
                      <div className="space-y-2\">
                        <button
                          onClick={() => handlePlanUpgrade(plan.id, 'monthly')}
                          disabled={upgrading}
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50\"
                        >
                          {upgrading ? 'Updating...' : 'Choose Monthly'}
                        </button>
                        {plan.yearly_price && (
                          <button
                            onClick={() => handlePlanUpgrade(plan.id, 'yearly')}
                            disabled={upgrading}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50\"
                          >
                            {upgrading ? 'Updating...' : 'Choose Yearly (Save!)'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionManagement;