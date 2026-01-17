import React, { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { useCall } from '../context/CallContext'
import {
  LayoutDashboard,
  Users,
  UserCircle2,
  Building2,
  DollarSign,
  CreditCard,
  UserCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  Plug,
  Upload,
  Sliders,
  Package,
  MessageSquare,
  CheckSquare,
  FileBarChart,
  LayoutGrid,
} from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import IncomingCallNotification from './IncomingCallNotification'
import Dialpad from './Dialpad'

// COMPLETE navigation with all your CRM sections
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Contacts', href: '/contacts', icon: UserCircle2 },
  { name: 'Accounts', href: '/accounts', icon: Building2 },
  { name: 'Transactions', href: '/transactions', icon: DollarSign },
  { name: 'Communications', href: '/communications', icon: MessageSquare },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
  { name: 'My Dashboards', href: '/custom-dashboards', icon: LayoutGrid },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Team', href: '/team', icon: UserCheck },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const DashboardLayout = () => {
  const { user, organization, logout, isLoading } = useAuth()
  const { unreadCount, requestBrowserPermission, browserPermission } = useNotifications()
  const { incomingCall, acceptCall, declineCall } = useCall()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [showIncomingCallDialpad, setShowIncomingCallDialpad] = useState(false)
  const [incomingCallNumber, setIncomingCallNumber] = useState('')
  const [incomingCallName, setIncomingCallName] = useState('')
  const location = useLocation()

  // Request browser notification permission on first visit
  React.useEffect(() => {
    if (browserPermission === 'default') {
      // Wait a bit before requesting permission
      const timer = setTimeout(() => {
        requestBrowserPermission()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [browserPermission, requestBrowserPermission])

  // Listen for incoming call events
  React.useEffect(() => {
    // Handle dial back event (from accepting call in queue system)
    const handleOpenDialpad = (event) => {
      const { phoneNumber, callerName } = event.detail
      setIncomingCallNumber(phoneNumber)
      setIncomingCallName(callerName)
      setShowIncomingCallDialpad(true)
      console.log('Opening Dialpad for incoming call:', phoneNumber, callerName)
    }

    // Handle joining existing conference (new queue system - agent joins customer's conference)
    const handleJoinConference = (event) => {
      const { conferenceId, callerPhone, callerName } = event.detail

      console.log('Agent joining incoming call conference:', conferenceId)

      // Pass conference ID to Dialpad via window variable
      window.incomingConferenceId = conferenceId

      // Show dialpad with caller info
      setIncomingCallNumber(callerPhone)
      setIncomingCallName(callerName)
      setShowIncomingCallDialpad(true)

      // Use react-hot-toast for notification
      toast.success(`Joining call with ${callerName || callerPhone}...`)
    }

    window.addEventListener('openDialpadWithNumber', handleOpenDialpad)
    window.addEventListener('joinIncomingCallConference', handleJoinConference)

    return () => {
      window.removeEventListener('openDialpadWithNumber', handleOpenDialpad)
      window.removeEventListener('joinIncomingCallConference', handleJoinConference)
    }
  }, [])

  if (isLoading) {
    return <LoadingSpinner />
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Incoming Call Notification */}
      {incomingCall && (
        <IncomingCallNotification
          callerNumber={incomingCall.from}
          callerName={incomingCall.callerName}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      {/* Dialpad for Incoming Call Dial Back */}
      {showIncomingCallDialpad && (
        <Dialpad
          onClose={() => {
            setShowIncomingCallDialpad(false)
            setIncomingCallNumber('')
            setIncomingCallName('')
          }}
          prefilledNumber={incomingCallNumber}
          contactName={incomingCallName}
        />
      )}

      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-200 fixed w-full top-0 z-50">
        {/* Top Row - Brand & User */}
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left - Brand */}
            <div className="flex items-center">
              <button
                className="lg:hidden mr-3 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-primary-600" />
                <div className="ml-3">
                  <h1 className="text-lg font-semibold text-gray-900">
                    {organization?.name || 'UppalTV'}
                  </h1>
                  <p className="text-xs text-gray-500">CRM Dashboard</p>
                </div>
              </div>
            </div>

            {/* Right - Search, Notifications, User */}
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="hidden md:flex items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
                  />
                </div>
              </div>

              {/* Notifications */}
              <button className="p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 relative">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Admin Dropdown */}
              <div className="relative">
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700"
                  onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                >
                  <Settings size={18} />
                  <span className="hidden sm:inline text-sm font-medium">Admin</span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {/* Admin Dropdown Menu */}
                {adminMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setAdminMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                      <NavLink
                        to="/settings/user-management"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAdminMenuOpen(false)}
                      >
                        <UserCheck size={16} className="mr-3" />
                        User Management
                      </NavLink>
                      <NavLink
                        to="/settings/subscription"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAdminMenuOpen(false)}
                      >
                        <CreditCard size={16} className="mr-3" />
                        Subscription
                      </NavLink>
                      <NavLink
                        to="/settings/integrations"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAdminMenuOpen(false)}
                      >
                        <Plug size={16} className="mr-3" />
                        Integrations
                      </NavLink>
                      <NavLink
                        to="/settings/import"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAdminMenuOpen(false)}
                      >
                        <Upload size={16} className="mr-3" />
                        Import
                      </NavLink>
                      <NavLink
                        to="/settings/field-configuration"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAdminMenuOpen(false)}
                      >
                        <Sliders size={16} className="mr-3" />
                        Field Configuration
                      </NavLink>
                      <NavLink
                        to="/settings/products"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAdminMenuOpen(false)}
                      >
                        <Package size={16} className="mr-3" />
                        Products
                      </NavLink>
                      <div className="border-t border-gray-200 my-2"></div>
                      <NavLink
                        to="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAdminMenuOpen(false)}
                      >
                        <Settings size={16} className="mr-3" />
                        Settings
                      </NavLink>
                    </div>
                  </>
                )}
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.first_name?.[0]}{user?.last_name?.[0]}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{organization?.name}</p>
                  </div>
                  <ChevronDown size={16} className="text-gray-400 hidden sm:block" />
                </button>

                {/* User Dropdown */}
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">
                          {user?.first_name} {user?.last_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut size={16} className="mr-3" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Horizontal (Salesforce Style) */}
        <nav className="hidden lg:block border-t border-gray-200 bg-white">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8 overflow-x-auto">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href

                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={`
                      flex items-center px-1 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors relative
                      ${isActive
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon size={18} className="mr-2" />
                    {item.name}
                    {item.name === 'Communications' && unreadCount > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg lg:hidden overflow-y-auto">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.href

                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={`
                        flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                        ${isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }
                      `}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Icon size={20} className="mr-3" />
                      {item.name}
                      {item.name === 'Communications' && unreadCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </nav>
            </div>
          </div>
        </>
      )}

      {/* Main Content - Full Width with optimized padding */}
      <main className="pt-32 lg:pt-28">
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
