import React, { useState, useEffect } from 'react';
import { 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Calendar, 
  Clock,
  Shield,
  LogOut,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle,
  XCircle
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const SuperAdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [expiringTrials, setExpiringTrials] = useState([]);
  const [businessLeads, setBusinessLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    temperature: 'all'
  });

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'organizations') fetchOrganizations();
    if (activeTab === 'expiring') fetchExpiringTrials();
    if (activeTab === 'leads') fetchBusinessLeads();
  }, [activeTab, filters]);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
    'Content-Type': 'application/json'
  });

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/super-admin/dashboard', {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const params = new URLSearchParams({
        status: filters.status,
        search: filters.search,
        page: 1,
        limit: 50
      });
      
      const response = await fetch(`/api/super-admin/organizations?${params}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const fetchExpiringTrials = async () => {
    try {
      const response = await fetch('/api/super-admin/expiring-trials?days=7', {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setExpiringTrials(data.expiring_trials);
      }
    } catch (error) {
      console.error('Error fetching expiring trials:', error);
    }
  };

  const fetchBusinessLeads = async () => {
    try {
      const params = new URLSearchParams({
        days: 30,
        temperature: filters.temperature
      });
      
      const response = await fetch(`/api/super-admin/business-leads?${params}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setBusinessLeads(data.leads);
      }
    } catch (error) {
      console.error('Error fetching business leads:', error);
    }
  };

  const extendTrial = async (orgId, days, reason) => {
    try {
      const response = await fetch(`/api/super-admin/organizations/${orgId}/trial`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'extend',
          days: days,
          reason: reason
        })
      });
      
      if (response.ok) {
        // Refresh data
        if (activeTab === 'organizations') fetchOrganizations();
        if (activeTab === 'expiring') fetchExpiringTrials();
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error extending trial:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('superAdminToken');
    window.location.reload();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getRiskBadge = (riskLevel) => {
    const colors = {
      'Critical': 'bg-red-100 text-red-800 border-red-200',
      'High': 'bg-orange-100 text-orange-800 border-orange-200',
      'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Low': 'bg-green-100 text-green-800 border-green-200'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[riskLevel] || colors.Low}`}>
        {riskLevel}
      </span>
    );
  };

  const getTemperatureBadge = (temperature) => {
    const colors = {
      'Hot': 'bg-red-100 text-red-800',
      'Warm': 'bg-yellow-100 text-yellow-800',
      'Cold': 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[temperature] || colors.Cold}`}>
        {temperature}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Last updated: {dashboardData?.last_updated ? formatDate(dashboardData.last_updated) : '-'}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-5 h-5 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: TrendingUp },
              { id: 'organizations', name: 'Organizations', icon: Users },
              { id: 'expiring', name: 'Expiring Trials', icon: AlertTriangle },
              { id: 'leads', name: 'Business Leads', icon: Calendar }
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <IconComponent className="w-5 h-5 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && dashboardData && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Active Trials</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.overview?.active_trials || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-red-100">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Expiring in 7 Days</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.overview?.expiring_next_7_days || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Paid Customers</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.overview?.paid_customers || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Calendar className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">New Signups Today</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.overview?.new_signups_today || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* At Risk Trials */}
            {dashboardData.at_risk_trials && dashboardData.at_risk_trials.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">At Risk Trials</h3>
                  <p className="text-sm text-gray-500">Trials requiring immediate attention</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Left</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dashboardData.at_risk_trials.map((trial) => (
                        <tr key={trial.organization_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{trial.organization_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{trial.admin_name}</div>
                            <div className="text-sm text-gray-500">{trial.admin_email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`font-medium ${trial.days_remaining <= 1 ? 'text-red-600' : 'text-yellow-600'}`}>
                              {trial.days_remaining} days
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getRiskBadge(trial.risk_level)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => extendTrial(trial.organization_id, 7, 'Emergency extension')}
                                className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                              >
                                +7 Days
                              </button>
                              <button
                                onClick={() => extendTrial(trial.organization_id, 14, 'Extended evaluation')}
                                className="text-green-600 hover:text-green-900 text-sm font-medium"
                              >
                                +14 Days
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'organizations' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search organizations..."
                      value={filters.search}
                      onChange={(e) => setFilters({...filters, search: e.target.value})}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                    />
                  </div>
                </div>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="converted">Converted</option>
                </select>
              </div>
            </div>

            {/* Organizations Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trial Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trial End</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engagement</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {organizations.map((org) => (
                      <tr key={org.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{org.organization_name}</div>
                          <div className="text-sm text-gray-500">{org.domain}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{org.admin_name}</div>
                          <div className="text-sm text-gray-500">{org.admin_email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            org.trial_status === 'active' ? 'bg-green-100 text-green-800' :
                            org.trial_status === 'expired' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {org.trial_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(org.trial_started_at)}
                          <div className="text-xs text-gray-500">Started trial</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(org.trial_ends_at)}
                          {org.days_remaining > 0 && (
                            <div className="text-xs text-gray-500">{org.days_remaining} days left</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{org.engagement_score}%</div>
                            <div className="ml-2 w-16 h-2 bg-gray-200 rounded-full">
                              <div 
                                className={`h-2 rounded-full ${
                                  org.engagement_score >= 70 ? 'bg-green-500' :
                                  org.engagement_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${org.engagement_score}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {org.trial_status === 'active' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => extendTrial(org.id, 7, 'Admin extension')}
                                className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                              >
                                +7 Days
                              </button>
                              <button
                                onClick={() => extendTrial(org.id, 14, 'Extended evaluation')}
                                className="text-green-600 hover:text-green-900 text-sm font-medium"
                              >
                                +14 Days
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'expiring' && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">Trials Expiring in Next 7 Days</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engagement</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {expiringTrials.map((trial) => (
                    <tr key={trial.organization_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {trial.organization_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{trial.admin_name}</div>
                        <div className="text-sm text-gray-500">{trial.admin_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-medium ${
                          trial.days_remaining <= 1 ? 'text-red-600' :
                          trial.days_remaining <= 3 ? 'text-orange-600' : 'text-yellow-600'
                        }`}>
                          {trial.days_remaining} days
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">{trial.engagement_score}%</div>
                          <div className="ml-2 w-16 h-2 bg-gray-200 rounded-full">
                            <div 
                              className={`h-2 rounded-full ${
                                trial.engagement_score >= 70 ? 'bg-green-500' :
                                trial.engagement_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${trial.engagement_score}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRiskBadge(trial.risk_level)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => extendTrial(trial.organization_id, 7, 'Expiration prevention')}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            +7 Days
                          </button>
                          <button
                            onClick={() => extendTrial(trial.organization_id, 14, 'Extended trial period')}
                            className="text-green-600 hover:text-green-900 text-sm font-medium"
                          >
                            +14 Days
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="space-y-6">
            {/* Lead Temperature Filter */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Filter by temperature:</span>
                <select
                  value={filters.temperature}
                  onChange={(e) => setFilters({...filters, temperature: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Temperatures</option>
                  <option value="Hot">🔥 Hot</option>
                  <option value="Warm">⚡ Warm</option>
                  <option value="Cold">❄️ Cold</option>
                </select>
              </div>
            </div>

            {/* Business Leads Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">Business Leads (Last 30 Days)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trial Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Temperature</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {businessLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{lead.company_name}</div>
                          <div className="text-sm text-gray-500">{lead.domain}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{lead.contact_name}</div>
                          <div className="text-sm text-gray-500">{lead.contact_email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(lead.lead_date)}
                          <div className="text-xs text-gray-500">{lead.days_since_signup} days ago</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            lead.trial_status === 'active' ? 'bg-green-100 text-green-800' :
                            lead.trial_status === 'expired' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {lead.trial_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getTemperatureBadge(lead.lead_temperature)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{lead.engagement_score}%</div>
                            <div className="ml-2 w-16 h-2 bg-gray-200 rounded-full">
                              <div 
                                className={`h-2 rounded-full ${
                                  lead.engagement_score >= 70 ? 'bg-green-500' :
                                  lead.engagement_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${lead.engagement_score}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminDashboard;