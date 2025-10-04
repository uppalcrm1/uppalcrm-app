import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Calendar,
  Users,
  Database,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Mail,
  Clock
} from 'lucide-react';

export default function SuperAdminOrgDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api';

  useEffect(() => {
    fetchOrganizationDetails();
  }, [id]);

  const fetchOrganizationDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('superAdminToken');

      const response = await fetch(`${API_BASE_URL}/platform/organizations/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrgData(data);
      } else {
        setError('Failed to load organization details');
      }
    } catch (error) {
      console.error('Error fetching organization details:', error);
      setError('Failed to load organization details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading organization details...</p>
        </div>
      </div>
    );
  }

  if (error || !orgData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error || 'Organization not found'}</p>
          <button
            onClick={() => navigate('/super-admin/organizations')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Organizations
          </button>
        </div>
      </div>
    );
  }

  const { organization, subscription, trial, usage, admins } = orgData;
  const isTrial = organization.is_trial;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/super-admin/organizations')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{organization.name}</h1>
              <p className="text-gray-600">Organization Details & Billing</p>
            </div>
          </div>
          <div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
              isTrial ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
            }`}>
              {isTrial ? 'TRIAL' : 'PAID'}
            </span>
          </div>
        </div>

        {/* Trial Warning (if trial) */}
        {trial && (
          <div className={`p-4 rounded-lg border ${
            trial.is_expired ? 'bg-red-50 border-red-200' :
            trial.days_remaining <= 7 ? 'bg-yellow-50 border-yellow-200' :
            'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center space-x-3">
              <Clock className={`h-5 w-5 ${
                trial.is_expired ? 'text-red-600' :
                trial.days_remaining <= 7 ? 'text-yellow-600' :
                'text-green-600'
              }`} />
              <div>
                <p className="font-medium text-gray-900">
                  {trial.is_expired ? 'Trial Expired' : `Trial expires in ${trial.days_remaining} days`}
                </p>
                <p className="text-sm text-gray-600">Expires on {formatDate(trial.expires_at)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  subscription.status === 'active' ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  <CheckCircle className={`h-6 w-6 ${
                    subscription.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    {subscription.status === 'trial' ? 'Trial Subscription' : 'Active Subscription'}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {organization.is_active ? 'Full access enabled' : 'Account inactive'}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-gray-900">${subscription.monthly_price}/month</p>
              <p className="text-sm text-gray-600 mt-1">
                {subscription.max_users} users × ${subscription.price_per_user}
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-600">Price per user</p>
              <p className="text-2xl font-bold text-gray-900">${subscription.price_per_user}/month</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Number of users</p>
              <p className="text-2xl font-bold text-gray-900">{subscription.max_users} users</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Monthly Cost</p>
              <p className="text-2xl font-bold text-indigo-600">${subscription.monthly_price}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Method</p>
              <p className="text-sm font-medium text-gray-900 mt-2">
                {subscription.payment_method === 'manual' ? 'Manual Payment (Invoice)' : subscription.payment_method}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t">
            <div>
              <p className="text-sm text-gray-600">Current Period Start</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(subscription.current_period_start)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Period End</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(subscription.current_period_end)}</p>
            </div>
          </div>
        </div>

        {/* Current Usage */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Active Users */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Active Users</span>
                <Users className="h-4 w-4 text-gray-400" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{usage.users.active}</span>
                  <span className="text-sm text-gray-600">of {usage.users.limit} limit</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{ width: `${usage.users.percentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{usage.users.percentage}% used</p>
            </div>

            {/* Contacts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Contacts</span>
                <Briefcase className="h-4 w-4 text-gray-400" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{usage.contacts.total}</span>
                  <span className="text-sm text-gray-600">Unlimited</span>
                </div>
              </div>
            </div>

            {/* Leads */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Leads</span>
                <Users className="h-4 w-4 text-gray-400" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{usage.leads.total}</span>
                  <span className="text-sm text-gray-600">Unlimited</span>
                </div>
              </div>
            </div>

            {/* Storage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Storage</span>
                <Database className="h-4 w-4 text-gray-400" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900">-</span>
                  <span className="text-sm text-gray-600">Unlimited</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Organization Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Organization Slug</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{organization.slug}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Domain</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{organization.domain || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created At</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(organization.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Updated</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(organization.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Admin Users */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Users</h2>
          <div className="space-y-4">
            {admins.length === 0 ? (
              <p className="text-gray-500 text-sm">No admin users found</p>
            ) : (
              admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{admin.name}</p>
                      <p className="text-xs text-gray-600">{admin.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Created: {formatDate(admin.created_at)}</p>
                    <p className="text-xs text-gray-500">Last login: {formatDate(admin.last_login)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
