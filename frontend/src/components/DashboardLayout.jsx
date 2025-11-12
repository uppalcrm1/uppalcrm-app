import React, { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Building2,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  UserCircle2,
  CreditCard,
} from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Contacts', href: '/contacts', icon: UserCircle2 },
  { name: 'Accounts', href: '/accounts', icon: Building2 },
  { name: 'Transactions', href: '/transactions', icon: DollarSign },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Team', href: '/team', icon: UserCheck },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const DashboardLayout = () => {
  const { user, organization, logout, isLoading } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner />
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notifications */}
              <button className="p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 relative">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

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

        {/* Navigation Tabs - Horizontal */}
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
                      flex items-center px-1 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                      ${isActive
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon size={18} className="mr-2" />
                    {item.name}
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
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg lg:hidden">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
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
                    </NavLink>
                  )
                })}
              </nav>
            </div>
          </div>
        </>
      )}

      {/* Main Content - Now has full width */}
      <main className="pt-32 lg:pt-28">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4 max-w-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default DashboardLayout
