import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  AlertCircle,
  ArrowRight,
  Activity
} from 'lucide-react'
import { leadsAPI, organizationsAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const Dashboard = () => {
  // Fetch dashboard data
  const { data: leadStats, isLoading: leadsLoading } = useQuery({
    queryKey: ['leadStats'],
    queryFn: leadsAPI.getStats
  })

  const { data: orgStats, isLoading: orgLoading } = useQuery({
    queryKey: ['organizationStats'],
    queryFn: organizationsAPI.getStats
  })

  const { data: recentLeads, isLoading: recentLeadsLoading } = useQuery({
    queryKey: ['recentLeads'],
    queryFn: () => leadsAPI.getLeads({ limit: 5, sort: 'created_at', order: 'desc' })
  })

  const isLoading = leadsLoading || orgLoading || recentLeadsLoading

  if (isLoading) {
    return <LoadingSpinner className="mt-8" />
  }

  // Prepare chart data
  const statusData = leadStats ? [
    { name: 'New', value: parseInt(leadStats.stats.new_leads), color: '#3b82f6' },
    { name: 'Contacted', value: parseInt(leadStats.stats.contacted_leads), color: '#f59e0b' },
    { name: 'Qualified', value: parseInt(leadStats.stats.qualified_leads), color: '#8b5cf6' },
    { name: 'Converted', value: parseInt(leadStats.stats.converted_leads), color: '#10b981' },
    { name: 'Lost', value: parseInt(leadStats.stats.lost_leads), color: '#ef4444' },
  ] : []

  const weeklyData = [
    { name: 'Mon', leads: 12, converted: 2 },
    { name: 'Tue', leads: 19, converted: 4 },
    { name: 'Wed', leads: 15, converted: 3 },
    { name: 'Thu', leads: 22, converted: 5 },
    { name: 'Fri', leads: 18, converted: 2 },
    { name: 'Sat', leads: 8, converted: 1 },
    { name: 'Sun', leads: 5, converted: 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your leads.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">
                {leadStats?.stats.total_leads || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {leadStats?.stats.conversion_rate || 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${leadStats?.stats.total_value?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <UserPlus className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">New This Week</p>
              <p className="text-2xl font-bold text-gray-900">
                {leadStats?.stats.new_this_week || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Status Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            {statusData.map((entry) => (
              <div key={entry.name} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-600">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="leads" fill="#3b82f6" name="New Leads" />
                <Bar dataKey="converted" fill="#10b981" name="Converted" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Leads</h3>
            <Link to="/leads" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View all
            </Link>
          </div>
          
          {recentLeads?.leads?.length > 0 ? (
            <div className="space-y-3">
              {recentLeads.leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{lead.full_name}</p>
                    <p className="text-sm text-gray-600">{lead.company || 'No company'}</p>
                    <div className="flex items-center mt-1">
                      <span className={`badge badge-${
                        lead.status === 'converted' ? 'success' : 
                        lead.status === 'qualified' ? 'info' :
                        lead.status === 'lost' ? 'error' : 'gray'
                      }`}>
                        {lead.status}
                      </span>
                      {lead.priority === 'high' && (
                        <AlertCircle className="h-4 w-4 text-red-500 ml-2" />
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      ${lead.value?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No leads yet</p>
              <Link to="/leads" className="btn btn-primary btn-sm">
                Add Your First Lead
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link to="/leads?status=new" className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3 flex-1">
                <p className="font-medium text-gray-900">Follow up on new leads</p>
                <p className="text-sm text-gray-600">{leadStats?.stats.new_leads || 0} new leads waiting</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link to="/leads" className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserPlus className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-3 flex-1">
                <p className="font-medium text-gray-900">Add new lead</p>
                <p className="text-sm text-gray-600">Create a new lead entry</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link to="/leads?assigned_to=null" className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="ml-3 flex-1">
                <p className="font-medium text-gray-900">Assign unassigned leads</p>
                <p className="text-sm text-gray-600">
                  {(parseInt(leadStats?.stats.total_leads || 0) - parseInt(leadStats?.stats.assigned_leads || 0))} unassigned
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link to="/team" className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div className="ml-3 flex-1">
                <p className="font-medium text-gray-900">Manage team</p>
                <p className="text-sm text-gray-600">{orgStats?.basic_stats?.active_users || 0} active team members</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard