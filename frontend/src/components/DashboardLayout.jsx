import React, { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserPlus,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Building2,
  ChevronDown,
  ChevronRight,
  Zap,
  Puzzle,
  Plus,
  Sliders,
} from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Add New Lead', href: '/leads/new', icon: Plus },
  { name: 'Contacts', href: '/contacts', icon: UserPlus },
  { name: 'Team', href: '/team', icon: UserCheck },
  {
    name: 'Integrations',
    icon: Puzzle,
    hasSubmenu: true,
    children: [
      { name: 'Zapier', href: '/integrations/zapier', icon: Zap },
    ]
  },
  { name: 'Field Configuration', href: '/admin/fields', icon: Sliders },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const DashboardLayout = () => {
  const { user, organization, logout, isLoading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [submenuOpen, setSubmenuOpen] = useState({})
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner />
  }

  const handleLogout = async () => {
    await logout()
  }

  const toggleSubmenu = (itemName) => {
    setSubmenuOpen(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }))
  }

  const isSubmenuItemActive = (children) => {
    return children?.some(child => location.pathname === child.href)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-gray-900">{organization?.name}</h1>
                <p className="text-xs text-gray-500">CRM Dashboard</p>
              </div>
            </div>
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              
              // Handle items with submenus
              if (item.hasSubmenu && item.children) {
                const isAnyChildActive = isSubmenuItemActive(item.children)
                const isSubmenuExpanded = submenuOpen[item.name] || isAnyChildActive
                
                return (
                  <div key={item.name}>
                    {/* Parent menu item */}
                    <button
                      onClick={() => toggleSubmenu(item.name)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                        ${isAnyChildActive 
                          ? 'bg-primary-50 text-primary-700' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-center">
                        <Icon size={20} className="mr-3" />
                        {item.name}
                      </div>
                      <ChevronRight 
                        size={16} 
                        className={`transition-transform ${isSubmenuExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                    
                    {/* Submenu items */}
                    {isSubmenuExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          const isChildActive = location.pathname === child.href
                          
                          return (
                            <NavLink
                              key={child.name}
                              to={child.href}
                              className={`
                                flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                                ${isChildActive 
                                  ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600' 
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }
                              `}
                              onClick={() => setSidebarOpen(false)}
                            >
                              <ChildIcon size={18} className="mr-3" />
                              {child.name}
                            </NavLink>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
              
              // Handle regular menu items
              const isActive = location.pathname === item.href
              
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={20} className="mr-3" />
                  {item.name}
                </NavLink>
              )
            })}
          </nav>

          {/* User Profile */}
          <div className="border-t border-gray-200 p-4">
            <div className="relative">
              <button
                className="w-full flex items-center p-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                </div>
                <div className="ml-3 flex-1 text-left">
                  <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <ChevronDown size={16} className="text-gray-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200">
                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <LogOut size={16} className="mr-3" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                className="lg:hidden mr-4"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} className="text-gray-600" />
              </button>
              
              <div className="hidden sm:block">
                <h2 className="text-lg font-semibold text-gray-900">
                  {(() => {
                    // Check direct navigation items
                    const directItem = navigation.find(item => item.href === location.pathname)
                    if (directItem) return directItem.name
                    
                    // Check submenu items
                    for (const item of navigation) {
                      if (item.children) {
                        const childItem = item.children.find(child => child.href === location.pathname)
                        if (childItem) return childItem.name
                      }
                    }
                    
                    return 'Dashboard'
                  })()}
                </h2>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="hidden md:block relative">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Notifications */}
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
                <Bell size={20} />
              </button>

              {/* User Role Badge */}
              <div className="hidden sm:block">
                <span className={`badge ${user?.role === 'admin' ? 'badge-info' : 'badge-gray'}`}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Click outside to close user menu */}
      {userMenuOpen && (
        <div 
          className="fixed inset-0 z-30"
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </div>
  )
}

export default DashboardLayout