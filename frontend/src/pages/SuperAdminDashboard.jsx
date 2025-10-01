import React from 'react';
import { useSuperAdminDashboard, useSuperAdminStats } from '../contexts/SuperAdminContext';
import {
  Users,
  Building2,
  UserPlus,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';

function StatCard({ title, value, icon: Icon, change, changeType, loading }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              value
            )}
          </p>
          {change && (
            <div className={`flex items-center mt-2 text-sm ${
              changeType === 'positive' ? 'text-green-600' : 'text-red-600'
            }`}>
              {changeType === 'positive' ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              {change}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${
          changeType === 'positive' ? 'bg-green-50' : 'bg-blue-50'
        }`}>
          <Icon className={`h-6 w-6 ${
            changeType === 'positive' ? 'text-green-600' : 'text-blue-600'
          }`} />
        </div>
      </div>
    </div>
  );
}

function RecentSignupCard({ signup }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'contacted':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'qualified':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'converted':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="h-10 w-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-sm font-medium text-white">
            {signup.full_name?.charAt(0) || 'U'}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{signup.full_name}</p>
          <p className="text-xs text-gray-500">{signup.company}</p>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(signup.status)}`}>
          {signup.status}
        </span>
        <span className="text-xs text-gray-500">{formatDate(signup.created_at)}</span>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useSuperAdminDashboard();
  const { data: statsData, isLoading: statsLoading, error: statsError } = useSuperAdminStats();

  const isLoading = dashboardLoading || statsLoading;
  const error = dashboardError || statsError;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Dashboard</h3>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  const trialStats = dashboardData?.trial_stats || {};
  const orgStats = dashboardData?.organization_stats || {};
  const recentSignups = dashboardData?.recent_signups || [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white p-6">
        <h2 className="text-2xl font-bold mb-2">Welcome to Super Admin Dashboard</h2>
        <p className="text-indigo-100">
          Monitor and manage all platform activities, trial signups, and organization conversions.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Signups"
          value={trialStats.total_signups || 0}
          icon={UserPlus}
          change="+12% from last month"
          changeType="positive"
          loading={isLoading}
        />
        <StatCard
          title="Active Organizations"
          value={orgStats.active || 0}
          icon={Building2}
          change="+8% from last month"
          changeType="positive"
          loading={isLoading}
        />
        <StatCard
          title="Trial Conversions"
          value={trialStats.total_conversions || 0}
          icon={TrendingUp}
          change={`${trialStats.conversion_rate || 0}% conversion rate`}
          changeType="positive"
          loading={isLoading}
        />
        <StatCard
          title="Pending Reviews"
          value={trialStats.pending_signups || 0}
          icon={Clock}
          loading={isLoading}
        />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trial Status Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trial Status Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="h-12 w-12 bg-yellow-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : (trialStats.pending_signups || 0)}
              </p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : (trialStats.contacted_signups || 0)}
              </p>
              <p className="text-sm text-gray-600">Contacted</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : (trialStats.converted_signups || 0)}
              </p>
              <p className="text-sm text-gray-600">Converted</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : (trialStats.rejected_signups || 0)}
              </p>
              <p className="text-sm text-gray-600">Rejected</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : `${trialStats.conversion_rate || 0}%`}
              </p>
              <p className="text-sm text-gray-600">Rate</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 7 days</span>
              <span className="text-sm font-medium text-gray-900">
                {isLoading ? '...' : (trialStats.signups_last_7_days || 0)} signups
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 30 days</span>
              <span className="text-sm font-medium text-gray-900">
                {isLoading ? '...' : (trialStats.signups_last_30_days || 0)} signups
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Trial Organizations</span>
              <span className="text-sm font-medium text-gray-900">
                {isLoading ? '...' : (orgStats.trial || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Paid Organizations</span>
              <span className="text-sm font-medium text-gray-900">
                {isLoading ? '...' : (orgStats.paid || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Signups */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Recent Trial Signups</h3>
          <button
            onClick={() => window.location.href = '/super-admin/signups'}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View All →
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : recentSignups.length > 0 ? (
          <div className="space-y-3">
            {recentSignups.slice(0, 5).map((signup) => (
              <RecentSignupCard key={signup.id} signup={signup} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <UserPlus className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No recent signups</p>
          </div>
        )}
      </div>
    </div>
  );
}