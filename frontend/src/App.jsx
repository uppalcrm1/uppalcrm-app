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
import TasksDashboard from './pages/TasksDashboard'
import Contacts from './pages/Contacts'
import SettingsPage from './pages/SettingsPage'
import ZapierIntegrationPage from './pages/settings/ZapierIntegrationPage'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import SuperAdminSignups from './pages/SuperAdminSignups'
import SuperAdminOrganizations from './pages/SuperAdminOrganizations'
import SuperAdminOrgDetail from './pages/SuperAdminOrgDetail'
import SuperAdminAnalytics from './pages/SuperAdminAnalytics'
import SuperAdminLogin from './pages/SuperAdminLogin'
import SuperAdminLayout from './components/SuperAdminLayout'
import DynamicLeadForm from './components/DynamicLeadForm'
import AccountManagement from './pages/AccountManagement'
import SubscriptionManagement from './pages/SubscriptionManagement'
import ImportLeads from './pages/ImportLeads'
import ImportContacts from './pages/ImportContacts'
import ContactImport from './pages/ContactImport'
import LeadDetail from './pages/LeadDetail'
import ContactsPage from './pages/ContactsPage'
import ContactDetailPage from './pages/ContactDetailPage'
import AccountsPage from './pages/AccountsPage'
import AccountDetail from './pages/AccountDetail'
import TransactionsPage from './pages/TransactionsPage'
import SubscriptionPage from './pages/SubscriptionPage'
import IntegrationsPage from './pages/IntegrationsPage'
import ImportPage from './pages/ImportPage'
import FieldConfigurationPage from './pages/FieldConfigurationPage'
import AdminUsers from './pages/admin/AdminUsers'
import AdminSubscription from './pages/admin/AdminSubscription'
import AdminIntegrations from './pages/admin/AdminIntegrations'
import AdminImport from './pages/admin/AdminImport'
import AdminFields from './pages/admin/AdminFields'
import AdminSettings from './pages/admin/AdminSettings'
import AdminAISettings from './pages/admin/AdminAISettings'
import AdminProducts from './pages/admin/AdminProducts'
import CommunicationsPage from './pages/CommunicationsPage'

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
        <Route path="organizations/:id" element={<SuperAdminOrgDetail />} />
        <Route path="analytics" element={<SuperAdminAnalytics />} />
        <Route path="accounts" element={<AccountManagement />} />
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
        <Route path="tasks" element={<TasksDashboard />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/:id" element={<ContactDetailPage />} />
        <Route path="settings/*" element={<SettingsPage />} />
        <Route path="integrations/zapier" element={<ZapierIntegrationPage />} />
        <Route path="leads/new" element={<DynamicLeadForm />} />
        <Route path="leads/import" element={<ImportLeads />} />
        <Route path="contacts/import" element={<ImportContacts />} />
        <Route path="import/contacts" element={<ContactImport />} />
        <Route path="accounts/:id" element={<AccountDetail />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="field-configuration" element={<FieldConfigurationPage />} />
        <Route path="communications" element={<CommunicationsPage />} />

        {/* Admin Routes */}
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/subscription" element={<AdminSubscription />} />
        <Route path="admin/integrations" element={<AdminIntegrations />} />
        <Route path="admin/import" element={<AdminImport />} />
        <Route path="admin/fields" element={<AdminFields />} />
        <Route path="admin/products" element={<AdminProducts />} />
        <Route path="admin/settings" element={<AdminSettings />} />
        <Route path="admin/ai-settings" element={<AdminAISettings />} />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default App