import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useSuperAdmin } from './contexts/SuperAdminContext'
import LoadingSpinner from './components/LoadingSpinner'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Contacts from './pages/Contacts'
import TeamPage from './pages/TeamPage'
import SettingsPage from './pages/SettingsPage'
import ZapierIntegrationPage from './pages/settings/ZapierIntegrationPage'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import SuperAdminSignups from './pages/SuperAdminSignups'
import SuperAdminOrganizations from './pages/SuperAdminOrganizations'
import SuperAdminAnalytics from './pages/SuperAdminAnalytics'
import SuperAdminLogin from './pages/SuperAdminLogin'
import SuperAdminLayout from './components/SuperAdminLayout'
import FieldManager from './components/FieldManager'
import DynamicLeadForm from './components/DynamicLeadForm'
import AccountManagement from './pages/AccountManagement'
import SubscriptionManagement from './pages/SubscriptionManagement'
import ImportLeads from './pages/ImportLeads'
import ImportContacts from './pages/ImportContacts'
import LeadDetail from './pages/LeadDetail'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingSpinner />
  }

  return isAuthenticated ? children : <Navigate to="/login" />
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingSpinner />
  }

  return !isAuthenticated ? children : <Navigate to="/dashboard" />
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Super Admin Routes */}
      <Route path="/super-admin/login" element={<SuperAdminLogin />} />
      <Route path="/super-admin" element={<SuperAdminLayout />}>
        <Route index element={<Navigate to="/super-admin/dashboard" />} />
        <Route path="dashboard" element={<SuperAdminDashboard />} />
        <Route path="signups" element={<SuperAdminSignups />} />
        <Route path="organizations" element={<SuperAdminOrganizations />} />
        <Route path="analytics" element={<SuperAdminAnalytics />} />
      </Route>

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="integrations/zapier" element={<ZapierIntegrationPage />} />
        <Route path="admin/fields" element={<FieldManager />} />
        <Route path="leads/new" element={<DynamicLeadForm />} />
        <Route path="leads/import" element={<ImportLeads />} />
        <Route path="contacts/import" element={<ImportContacts />} />
        <Route path="accounts" element={<AccountManagement />} />
        <Route path="subscription" element={<SubscriptionManagement />} />
        <Route path="licenses" element={<AccountManagement />} />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default App