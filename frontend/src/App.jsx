import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
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
import SuperAdminApp from './components/SuperAdminApp'
import FieldManager from './components/FieldManager'
import DynamicLeadForm from './components/DynamicLeadForm'
import LicenseManagement from './pages/LicenseManagement'
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

      {/* Super Admin Route */}
      <Route path="/super-admin" element={<SuperAdminApp />} />

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
        <Route path="licenses" element={<LicenseManagement />} />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default App