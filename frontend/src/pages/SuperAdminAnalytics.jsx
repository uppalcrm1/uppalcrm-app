import React, { useMemo } from 'react';
import { useSuperAdminStats, useSuperAdminTrialSignups } from '../contexts/SuperAdminContext';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  Target,
  DollarSign,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  AlertCircle,
  Loader2
} from 'lucide-react';

function MetricCard({ title, value, change, changeType, icon: Icon, loading }) {
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
              changeType === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {changeType === 'up' ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              {change}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${
          changeType === 'up' ? 'bg-green-50' : 'bg-blue-50'
        }`}>
          <Icon className={`h-6 w-6 ${
            changeType === 'up' ? 'text-green-600' : 'text-blue-600'
          }`} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function SimpleBarChart({ data, title }) {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div className="w-20 text-sm text-gray-600">{item.label}</div>
            <div className="flex-1 bg-gray-200 rounded-full h-3 relative">
              <div
                className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
            <div className="w-12 text-sm font-medium text-gray-900 text-right">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuperAdminAnalytics() {
  const { data: statsData, isLoading: statsLoading, error: statsError } = useSuperAdminStats();
  const { data: signupsData, isLoading: signupsLoading, error: signupsError } = useSuperAdminTrialSignups();

  const isLoading = statsLoading || signupsLoading;
  const error = statsError || signupsError;

  const analytics = useMemo(() => {
    if (!statsData || !signupsData) return null;

    const trialStats = statsData.trial_signups || {};
    const orgStats = statsData.organizations || {};
    const signups = signupsData.signups || [];

    // Source analytics
    const sourceData = signups.reduce((acc, signup) => {
      const source = signup.utm_source || 'direct';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    const sourceChartData = Object.entries(sourceData).map(([label, value]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value
    }));

    // Status analytics
    const statusData = signups.reduce((acc, signup) => {
      acc[signup.status] = (acc[signup.status] || 0) + 1;
      return acc;
    }, {});

    const statusChartData = Object.entries(statusData).map(([label, value]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value
    }));

    // Industry analytics
    const industryData = signups.reduce((acc, signup) => {
      const industry = signup.industry || 'Other';
      acc[industry] = (acc[industry] || 0) + 1;
      return acc;
    }, {});

    const industryChartData = Object.entries(industryData)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Team size analytics
    const teamSizeData = signups.reduce((acc, signup) => {
      const size = signup.team_size || 'Not specified';
      acc[size] = (acc[size] || 0) + 1;
      return acc;
    }, {});

    const teamSizeChartData = Object.entries(teamSizeData).map(([label, value]) => ({
      label,
      value
    }));

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSignups = signups.filter(signup =>
      new Date(signup.created_at) >= thirtyDaysAgo
    );

    const weeklyData = Array.from({ length: 4 }, (_, i) => {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);

      const weekSignups = recentSignups.filter(signup => {
        const signupDate = new Date(signup.created_at);
        return signupDate >= weekStart && signupDate < weekEnd;
      });

      return {
        label: `Week ${4 - i}`,
        value: weekSignups.length
      };
    });

    return {
      trialStats,
      orgStats,
      sourceChartData,
      statusChartData,
      industryChartData,
      teamSizeChartData,
      weeklyData,
      totalSignups: signups.length,
      conversionRate: trialStats.conversion_rate || 0
    };
  }, [statsData, signupsData]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {error.isAuthError ? 'Session Expired' : 'Failed to Load Analytics'}
          </h3>
          <p className="text-gray-600">
            {error.isAuthError ? 'Your session has expired. Please log in again.' : error.message}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-gray-600">Insights and metrics for your CRM platform</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Signups"
          value={analytics.totalSignups}
          change="+12% this month"
          changeType="up"
          icon={Users}
          loading={isLoading}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${analytics.conversionRate}%`}
          change="+2.1% this month"
          changeType="up"
          icon={Target}
          loading={isLoading}
        />
        <MetricCard
          title="Active Organizations"
          value={analytics.orgStats.active || 0}
          change="+8% this month"
          changeType="up"
          icon={Building2}
          loading={isLoading}
        />
        <MetricCard
          title="Trial Organizations"
          value={analytics.orgStats.trial || 0}
          change="+15% this month"
          changeType="up"
          icon={Activity}
          loading={isLoading}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Signup Sources">
          <SimpleBarChart
            data={analytics.sourceChartData}
            title="Where signups come from"
          />
        </ChartCard>

        <ChartCard title="Signup Status">
          <SimpleBarChart
            data={analytics.statusChartData}
            title="Current status distribution"
          />
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Industry Distribution">
          <SimpleBarChart
            data={analytics.industryChartData}
            title="Top industries (max 8)"
          />
        </ChartCard>

        <ChartCard title="Team Size Distribution">
          <SimpleBarChart
            data={analytics.teamSizeChartData}
            title="Company sizes"
          />
        </ChartCard>
      </div>

      {/* Activity Timeline */}
      <ChartCard title="Recent Activity" className="lg:col-span-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <SimpleBarChart
              data={analytics.weeklyData}
              title="Weekly signups (last 4 weeks)"
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Key Insights</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Conversion Rate</span>
                </div>
                <span className="text-sm text-green-700">{analytics.conversionRate}%</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Top Source</span>
                </div>
                <span className="text-sm text-blue-700">
                  {analytics.sourceChartData.length > 0 ?
                    analytics.sourceChartData.reduce((a, b) => a.value > b.value ? a : b).label :
                    'No data'
                  }
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Popular Industry</span>
                </div>
                <span className="text-sm text-purple-700">
                  {analytics.industryChartData.length > 0 ?
                    analytics.industryChartData[0].label :
                    'No data'
                  }
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-900">This Week</span>
                </div>
                <span className="text-sm text-yellow-700">
                  {analytics.weeklyData.length > 0 ?
                    analytics.weeklyData[analytics.weeklyData.length - 1].value :
                    0
                  } signups
                </span>
              </div>
            </div>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}