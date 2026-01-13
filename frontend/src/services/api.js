import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api'

console.log('🔧 API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE_URL: API_BASE_URL,
  environment: import.meta.env.MODE
})

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth token management
let authToken = localStorage.getItem('authToken')
let organizationSlug = localStorage.getItem('organizationSlug')

export const setAuthToken = (token) => {
  authToken = token
  localStorage.setItem('authToken', token)
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export const setOrganizationSlug = (slug) => {
  organizationSlug = slug
  localStorage.setItem('organizationSlug', slug)
  api.defaults.headers.common['X-Organization-Slug'] = slug
}

export const clearAuth = () => {
  authToken = null
  organizationSlug = null
  localStorage.removeItem('authToken')
  localStorage.removeItem('organizationSlug')
  delete api.defaults.headers.common['Authorization']
  delete api.defaults.headers.common['X-Organization-Slug']
}

// Set initial headers if tokens exist
if (authToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
}
if (organizationSlug) {
  api.defaults.headers.common['X-Organization-Slug'] = organizationSlug
}

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    // Debug: Log all outgoing requests
    console.log('🚀 API Request:', config.method?.toUpperCase(), config.url)
    console.log('  - Headers:', config.headers)
    return config
  },
  (error) => {
    console.error('❌ Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred'
    const details = error.response?.data?.details
    const isSupedAdminRoute = error.config?.url?.includes('/api/super-admin')

    // Log validation errors with full details for debugging
    if (error.response?.status === 400 && details) {
      console.error('❌ Validation Error Details:', {
        message,
        details,
        url: error.config?.url,
        method: error.config?.method,
        requestData: error.config?.data,
        requestParams: error.config?.params
      })

      // Show detailed field errors in toast
      if (details.body && Array.isArray(details.body)) {
        const fieldErrors = details.body.map(err => `${err.field}: ${err.message}`).join(', ')
        toast.error(`Validation Error: ${fieldErrors}`)
      } else if (details.params && Array.isArray(details.params)) {
        const paramErrors = details.params.map(err => `${err.field}: ${err.message}`).join(', ')
        toast.error(`Parameter Error: ${paramErrors}`)
      } else {
        toast.error(message)
      }
    } else if (error.response?.status === 401) {
      // Don't interfere with super admin authentication
      if (!isSupedAdminRoute) {
        // Don't show error or redirect for auth check requests (like /auth/me)
        // or if we're already on the login page
        const isAuthCheckRequest = error.config?.url?.includes('/auth/me')
        const isOnLoginPage = window.location.pathname === '/login' || window.location.pathname === '/register'
        const isTwilioCall = error.config?.url?.includes('/twilio')

        // Don't clear auth or show errors if on login page or for Twilio calls when not authenticated
        if (!isOnLoginPage) {
          clearAuth()
        }

        // Only show error and redirect if NOT on login page, NOT an auth check, and NOT a Twilio call on login page
        if (!isAuthCheckRequest && !isOnLoginPage && !isTwilioCall) {
          window.location.href = '/login'
          toast.error('Session expired. Please log in again.')
        }
      }
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please wait a moment.')
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.')
    }

    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    return response.data
  },
  
  register: async (organizationData, adminData) => {
    const response = await api.post('/auth/register', {
      organization: organizationData,
      admin: adminData
    })
    return response.data
  },
  
  me: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },
  
  logout: async () => {
    await api.post('/auth/logout')
    clearAuth()
  },
  
  refresh: async () => {
    const response = await api.post('/auth/refresh')
    return response.data
  }
}

// Users API
export const usersAPI = {
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params })
    return response.data
  },
  
  getUser: async (id) => {
    const response = await api.get(`/users/${id}`)
    return response.data
  },
  
  createUser: async (userData) => {
    const response = await api.post('/users', userData)
    return response.data
  },
  
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData)
    return response.data
  },
  
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`)
    return response.data
  },
  
  getStats: async () => {
    const response = await api.get('/users/stats')
    return response.data
  },

  getUsersForAssignment: async () => {
    const response = await api.get('/custom-fields/users-for-assignment')
    return response.data
  },

  resetPassword: async (id, passwordData) => {
    const response = await api.put(`/users/${id}/reset-password`, passwordData)
    return response.data
  }
}

// Organizations API
export const organizationsAPI = {
  getCurrent: async () => {
    const response = await api.get('/organizations/current')
    return response.data
  },
  
  updateCurrent: async (orgData) => {
    const response = await api.put('/organizations/current', orgData)
    return response.data
  },
  
  getStats: async () => {
    const response = await api.get('/organizations/current/stats')
    return response.data
  },
  
  getUsage: async () => {
    const response = await api.get('/organizations/current/usage')
    return response.data
  }
}

// Leads API (we'll extend the backend for this)
export const leadsAPI = {
  getLeads: async (params = {}) => {
    const response = await api.get('/leads', { params })
    return response.data
  },

  getLead: async (id) => {
    const response = await api.get(`/leads/${id}`)
    return response.data
  },

  createLead: async (leadData) => {
    // Use custom-fields router as workaround for authentication issues
    const response = await api.post('/custom-fields/create-lead', leadData)
    return response.data
  },

  updateLead: async (id, leadData) => {
    const response = await api.put(`/leads/${id}`, leadData)
    return response.data
  },

  deleteLead: async (id) => {
    const response = await api.delete(`/leads/${id}`)
    return response.data
  },

  assignLead: async (leadId, userId) => {
    const response = await api.put(`/leads/${leadId}/assign`, { assignedTo: userId })
    return response.data
  },

  getStats: async () => {
    const response = await api.get('/leads/stats')
    return response.data
  },

  // New functions for Kanban and List views
  updateLeadStatus: async (leadId, newStatus) => {
    const response = await api.patch(`/leads/${leadId}/status`, { status: newStatus })
    return response.data
  },

  getLeadsByStatus: async (params = {}) => {
    const response = await api.get('/leads/by-status', { params })
    return response.data
  },

  bulkUpdateLeads: async (leadIds, updates) => {
    const response = await api.patch('/leads/bulk', { leadIds, updates })
    return response.data
  },

  exportLeads: async (filters = {}) => {
    const response = await api.get('/leads/export', {
      params: filters,
      responseType: 'blob' // For file download
    })
    return response.data
  },

  getLeadStatuses: async () => {
    const response = await api.get('/lead-statuses')
    return response.data
  },

  // Lead conversion to contact
  convertLead: async (leadId, conversionData) => {
    const response = await api.post(`/leads/${leadId}/convert`, conversionData)
    return response.data
  },

  // Get lead conversion preview (shows field mappings)
  getConversionPreview: async (leadId) => {
    const response = await api.post(`/leads/${leadId}/conversion-preview`)
    return response.data
  },

  /**
   * Get all tasks for a specific lead with optional filtering
   * @param {string} leadId - The lead UUID
   * @param {Object} filters - Optional query parameters
   * @param {string} filters.status - Filter by task status (scheduled, completed, cancelled)
   * @param {string} filters.priority - Filter by priority (low, medium, high)
   * @param {string} filters.date_range - Filter by date range ('today', 'week', 'month')
   * @param {string} filters.overdue - Show only overdue tasks ('true')
   * @returns {Promise<{tasks: Array, stats: Object}>} Tasks array with statistics
   */
  getTasks: async (leadId, filters = {}) => {
    const response = await api.get(`/leads/${leadId}/tasks`, { params: filters })
    return response.data
  },

  /**
   * Create a new task for a lead
   * @param {string} leadId - The lead UUID
   * @param {Object} taskData - Task data
   * @param {string} taskData.subject - Task subject (required)
   * @param {string} [taskData.description] - Task description (optional)
   * @param {string} [taskData.scheduled_at] - ISO date when task is scheduled (optional)
   * @param {string} [taskData.priority='medium'] - Task priority: 'low', 'medium', 'high' (default: 'medium')
   * @param {string} [taskData.assigned_to] - UUID of user to assign task to (optional)
   * @returns {Promise<{message: string, task: Object}>} Created task object
   */
  createTask: async (leadId, taskData) => {
    const response = await api.post(`/leads/${leadId}/tasks`, taskData)
    return response.data
  },

  /**
   * Mark a task as completed with optional outcome and notes
   * @param {string} leadId - The lead UUID
   * @param {string} taskId - The task UUID
   * @param {Object} [completionData={}] - Optional completion data
   * @param {string} [completionData.outcome] - Task outcome (optional)
   * @param {string} [completionData.notes] - Completion notes (optional)
   * @returns {Promise<{message: string, task: Object}>} Updated task object with completed status
   */
  completeTask: async (leadId, taskId, completionData = {}) => {
    const response = await api.patch(`/leads/${leadId}/tasks/${taskId}/complete`, completionData)
    return response.data
  },

  /**
   * Update task details
   * @param {string} leadId - The lead UUID
   * @param {string} taskId - The task UUID
   * @param {Object} updateData - Fields to update (all optional)
   * @param {string} [updateData.subject] - Updated subject
   * @param {string} [updateData.description] - Updated description
   * @param {string} [updateData.scheduled_at] - Updated scheduled date (ISO format)
   * @param {string} [updateData.priority] - Updated priority: 'low', 'medium', 'high'
   * @param {string} [updateData.status] - Updated status: 'scheduled', 'completed', 'cancelled'
   * @returns {Promise<{message: string, task: Object}>} Updated task object
   */
  updateTask: async (leadId, taskId, updateData) => {
    const response = await api.patch(`/leads/${leadId}/tasks/${taskId}`, updateData)
    return response.data
  },

  /**
   * Delete a task
   * @param {string} leadId - The lead UUID
   * @param {string} taskId - The task UUID
   * @returns {Promise<{message: string}>} Success message
   */
  deleteTask: async (leadId, taskId) => {
    const response = await api.delete(`/leads/${leadId}/tasks/${taskId}`)
    return response.data
  },

  /**
   * Get all tasks across the organization with optional filtering and sorting
   * @param {Object} filters - Optional query parameters
   * @param {string} [filters.status] - Filter by task status (scheduled, completed, cancelled, pending, overdue)
   * @param {string} [filters.assigned_to] - Filter by assigned user UUID
   * @param {string} [filters.lead_owner] - Filter by lead owner UUID
   * @param {string} [filters.priority] - Filter by priority (low, medium, high)
   * @param {string} [filters.sort_by] - Sort field (scheduled_at, priority, created_at)
   * @param {string} [filters.sort_order] - Sort order (asc, desc)
   * @returns {Promise<{tasks: Array, stats: Object}>} All tasks with statistics
   */
  getAllTasks: async (filters = {}) => {
    const response = await api.get('/leads/tasks', { params: filters })
    return response.data
  },

  /**
   * Get all users in the organization for assignment dropdowns
   * @returns {Promise<{users: Array}>} List of users with id, first_name, last_name, email
   */
  getOrganizationUsers: async () => {
    const response = await api.get('/users')
    return response.data
  }
}

// Contacts API
export const contactsAPI = {
  getContacts: async (params = {}) => {
    const response = await api.get('/contacts', { params })
    return response.data
  },
  
  getContact: async (id) => {
    const response = await api.get(`/contacts/${id}`)
    return response.data
  },

  getContactDetail: async (id) => {
    const response = await api.get(`/contacts/${id}/detail`)
    return response.data
  },

  createContact: async (contactData) => {
    const response = await api.post('/contacts', contactData)
    return response.data
  },
  
  updateContact: async (id, contactData) => {
    const response = await api.put(`/contacts/${id}`, contactData)
    return response.data
  },

  updateContactStatus: async (id, status, accountData = null) => {
    const response = await api.put(`/contacts/${id}/status`, {
      status,
      accountData
    })
    return response.data
  },

  deleteContact: async (id) => {
    const response = await api.delete(`/contacts/${id}`)
    return response.data
  },
  
  getStats: async () => {
    // Debug: Log current auth state before making request
    console.log('📋 Debug - Making contacts/stats request with:')
    console.log('  - Authorization header:', api.defaults.headers.common['Authorization'])
    console.log('  - X-Organization-Slug header:', api.defaults.headers.common['X-Organization-Slug'])
    console.log('  - localStorage authToken:', localStorage.getItem('authToken'))
    console.log('  - localStorage organizationSlug:', localStorage.getItem('organizationSlug'))
    
    const response = await api.get('/contacts/stats')
    return response.data
  },
  
  convertFromLead: async (conversionData) => {
    const { leadId, ...data } = conversionData;
    const response = await api.post(`/contacts/convert-from-lead/${leadId}`, data)
    return response.data
  },
  
  // Software editions
  getEditions: async () => {
    const response = await api.get('/contacts/software-editions')
    return response.data
  },
  
  createEdition: async (editionData) => {
    const response = await api.post('/contacts/software-editions', editionData)
    return response.data
  },
  
  // Accounts management
  getAccounts: async (contactId) => {
    const response = await api.get(`/contacts/${contactId}/accounts`)
    return response.data
  },
  
  createAccount: async (contactId, accountData) => {
    const response = await api.post(`/contacts/${contactId}/accounts`, accountData)
    return response.data
  },
  
  // Device management
  getDevices: async (contactId) => {
    const response = await api.get(`/contacts/${contactId}/devices`)
    return response.data
  },
  
  registerDevice: async (contactId, deviceData) => {
    const response = await api.post(`/contacts/${contactId}/devices`, deviceData)
    return response.data
  },
  
  // License management
  getLicenses: async (contactId, params = {}) => {
    const response = await api.get(`/contacts/${contactId}/licenses`, { params })
    return response.data
  },
  
  generateLicense: async (contactId, licenseData) => {
    const response = await api.post(`/contacts/${contactId}/licenses`, licenseData)
    return response.data
  },
  
  transferLicense: async (licenseId, transferData) => {
    const response = await api.post(`/contacts/licenses/${licenseId}/transfer`, transferData)
    return response.data
  },
  
  // Trial management
  getTrials: async (contactId, params = {}) => {
    const response = await api.get(`/contacts/${contactId}/trials`, { params })
    return response.data
  },
  
  createTrial: async (contactId, trialData) => {
    const response = await api.post(`/contacts/${contactId}/trials`, trialData)
    return response.data
  },
  
  // Activity tracking
  recordDownload: async (downloadData) => {
    const response = await api.post('/contacts/downloads/record', downloadData)
    return response.data
  },

  recordActivation: async (activationData) => {
    const response = await api.post('/contacts/activations/record', activationData)
    return response.data
  },

  // Contact Interactions
  getInteractions: async (contactId, params = {}) => {
    const response = await api.get(`/contacts/${contactId}/interactions`, { params })
    return response.data
  },

  createInteraction: async (contactId, interactionData) => {
    const response = await api.post(`/contacts/${contactId}/interactions`, {
      ...interactionData,
      contact_id: contactId
    })
    return response.data
  },

  updateInteraction: async (contactId, interactionId, interactionData) => {
    const response = await api.put(`/contacts/${contactId}/interactions/${interactionId}`, interactionData)
    return response.data
  },

  deleteInteraction: async (contactId, interactionId) => {
    const response = await api.delete(`/contacts/${contactId}/interactions/${interactionId}`)
    return response.data
  },

  getInteractionStats: async (contactId) => {
    const response = await api.get(`/contacts/${contactId}/interactions/stats`)
    return response.data
  },

  getRecentInteractions: async (params = {}) => {
    const response = await api.get('/contacts/interactions/recent', { params })
    return response.data
  }
}

// Accounts API
export const accountsAPI = {
  getAccounts: async (params = {}) => {
    const response = await api.get('/accounts', { params })
    return response.data
  },

  getAccount: async (id) => {
    const response = await api.get(`/accounts/${id}`)
    return response.data
  },

  getAccountDetail: async (id) => {
    const response = await api.get(`/accounts/${id}/detail`)
    return response.data
  },

  createAccount: async (accountData) => {
    const response = await api.post('/accounts', accountData)
    return response.data
  },

  updateAccount: async (id, accountData) => {
    const response = await api.put(`/accounts/${id}`, accountData)
    return response.data
  },

  deleteAccount: async (id) => {
    const response = await api.delete(`/accounts/${id}`)
    return response.data
  },

  // Soft delete methods
  softDeleteAccount: async (id, reason) => {
    const response = await api.post(`/accounts/${id}/delete`, { reason })
    return response.data
  },

  restoreAccount: async (id) => {
    const response = await api.post(`/accounts/${id}/restore`)
    return response.data
  },

  getDeletedAccounts: async (params = {}) => {
    const response = await api.get('/accounts/deleted/list', { params })
    return response.data
  },

  permanentDeleteAccount: async (id, confirmation) => {
    const response = await api.delete(`/accounts/${id}/permanent`, {
      data: { confirmation }
    })
    return response.data
  },

  getStats: async () => {
    const response = await api.get('/accounts/stats')
    return response.data
  }
}

// Transactions API
export const transactionsAPI = {
  getTransactions: async (params = {}) => {
    const response = await api.get('/transactions', { params })
    return response.data
  },

  getTransaction: async (id) => {
    const response = await api.get(`/transactions/${id}`)
    return response.data
  },

  createTransaction: async (transactionData) => {
    const response = await api.post('/transactions', transactionData)
    return response.data
  },

  getAccountTransactions: async (accountId) => {
    const response = await api.get(`/transactions/accounts/${accountId}`)
    return response.data
  },

  getContactTransactions: async (contactId, params = {}) => {
    const response = await api.get('/transactions', {
      params: { ...params, contact_id: contactId }
    })
    return response.data
  },

  updateTransaction: async (id, transactionData) => {
    const response = await api.put(`/transactions/${id}`, transactionData)
    return response.data
  },

  deleteTransaction: async (id) => {
    const response = await api.delete(`/transactions/${id}`)
    return response.data
  },

  // Soft delete (void) methods
  voidTransaction: async (id, reason) => {
    const response = await api.post(`/transactions/${id}/void`, { reason })
    return response.data
  },

  restoreTransaction: async (id, justification) => {
    const response = await api.post(`/transactions/${id}/restore`, { justification })
    return response.data
  },

  getVoidedTransactions: async (params = {}) => {
    const response = await api.get('/transactions/voided/list', { params })
    return response.data
  },

  getStats: async () => {
    const response = await api.get('/transactions/stats')
    return response.data
  },

  // Currency configuration endpoints
  getExchangeRate: async () => {
    const response = await api.get('/transactions/config/exchange-rate')
    return response.data
  },

  updateExchangeRate: async (rate) => {
    const response = await api.put('/transactions/config/exchange-rate', { rate })
    return response.data
  },

  // Revenue stats with CAD conversion
  getRevenueStats: async () => {
    const response = await api.get('/transactions/stats/revenue')
    return response.data
  }
}

// Organization Trial Management API
export const trialAPI = {
  // Get current trial status
  getTrialStatus: async () => {
    const response = await api.get('/trials/status')
    return response.data
  },

  // Start a new trial
  startTrial: async (trialDays = 30) => {
    const response = await api.post('/trials/start', { trial_days: trialDays })
    return response.data
  },

  // Extend current trial
  extendTrial: async (additionalDays) => {
    const response = await api.post('/trials/extend', { additional_days: additionalDays })
    return response.data
  },

  // Convert trial to paid subscription
  convertTrial: async (paymentData) => {
    const response = await api.post('/trials/convert', paymentData)
    return response.data
  },

  // Cancel trial
  cancelTrial: async (reason) => {
    const response = await api.post('/trials/cancel', { reason })
    return response.data
  },

  // Get trial history
  getTrialHistory: async () => {
    const response = await api.get('/trials/history')
    return response.data
  },

  // Get subscription details
  getSubscription: async () => {
    const response = await api.get('/trials/subscription')
    return response.data
  },

  // Check trial eligibility
  checkEligibility: async () => {
    const response = await api.get('/trials/check-eligibility')
    return response.data
  },

  // Admin functions
  admin: {
    // Get all organizations with trial data
    getTrialOrganizations: async () => {
      const response = await api.get('/trials/admin/organizations')
      return response.data
    },

    // Expire trials manually
    expireTrials: async () => {
      const response = await api.post('/trials/admin/expire')
      return response.data
    },

    // Get trial statistics
    getStatistics: async () => {
      const response = await api.get('/trials/admin/statistics')
      return response.data
    }
  }
}

// Custom Fields API
export const customFieldsAPI = {
  getFields: async (entityType = 'leads') => {
    const response = await api.get('/custom-fields', {
      params: { entity_type: entityType }
    })
    return response.data
  },

  createField: async (fieldData) => {
    const response = await api.post('/custom-fields', fieldData)
    return response.data
  },

  updateField: async (fieldId, fieldData) => {
    const response = await api.put(`/custom-fields/${fieldId}`, fieldData)
    return response.data
  },

  deleteField: async (fieldId) => {
    const response = await api.delete(`/custom-fields/${fieldId}`)
    return response.data
  },

  toggleField: async (fieldId, enabled) => {
    const response = await api.put(`/custom-fields/${fieldId}/toggle`, { enabled })
    return response.data
  },

  getFormConfig: async () => {
    const response = await api.get('/custom-fields/form-config')
    return response.data
  },

  updateSystemField: async (fieldName, fieldData) => {
    const response = await api.put(`/custom-fields/default/${fieldName}`, fieldData)
    return response.data
  }
}

// User Management API
export const userManagementAPI = {
  // Get all users with pagination and filtering
  getUsers: async (params = {}) => {
    const response = await api.get('/user-management', { params })
    return response.data
  },

  // Create new user
  createUser: async (userData) => {
    const response = await api.post('/user-management', userData)
    return response.data
  },

  // Update user
  updateUser: async (userId, updates) => {
    const response = await api.put(`/user-management/${userId}`, updates)
    return response.data
  },

  // Reset user password
  resetPassword: async (userId) => {
    const response = await api.post(`/user-management/${userId}/reset-password`)
    return response.data
  },

  // Delete/deactivate user
  deleteUser: async (userId) => {
    const response = await api.delete(`/user-management/${userId}`)
    return response.data
  },

  // Bulk operations
  bulkOperation: async (operationData) => {
    const response = await api.post('/user-management/bulk', operationData)
    return response.data
  },

  // Get audit log
  getAuditLog: async (params = {}) => {
    const response = await api.get('/user-management/audit-log', { params })
    return response.data
  },

  // Get license information
  getLicenseInfo: async () => {
    const response = await api.get('/user-management/license-info')
    return response.data
  }
}

// AI Settings API
export const aiSettingsAPI = {
  // Get current organization's AI settings
  getSettings: async () => {
    const response = await api.get('/organizations/current/ai-settings')
    return response.data
  },

  // Update AI settings
  updateSettings: async (settings) => {
    const response = await api.put('/organizations/current/ai-settings', settings)
    return response.data
  },

  // Test sentiment analysis
  testSentiment: async (testData) => {
    const response = await api.post('/organizations/current/ai-settings/test', testData)
    return response.data
  },

  // Get usage statistics
  getUsage: async () => {
    const response = await api.get('/organizations/current/ai-settings/usage')
    return response.data
  },

  // Reset to default settings
  resetDefaults: async () => {
    const response = await api.post('/organizations/current/ai-settings/reset-defaults')
    return response.data
  }
}

// Products API
export const productsAPI = {
  // Get all products
  getProducts: async (includeInactive = false) => {
    const params = includeInactive ? { include_inactive: 'true' } : {}
    const response = await api.get('/products', { params })
    return response.data
  },

  // Create a new product
  createProduct: async (productData) => {
    const response = await api.post('/products', productData)
    return response.data
  },

  // Update a product
  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData)
    return response.data
  },

  // Delete (deactivate) a product
  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}`)
    return response.data
  }
}

// Twilio API
export const twilioAPI = {
  // Get Twilio configuration
  getConfig: async () => {
    const response = await api.get('/twilio/config')
    return response.data
  },

  // Configure Twilio
  saveConfig: async (configData) => {
    const response = await api.post('/twilio/config', configData)
    return response.data
  },

  // Send SMS
  sendSMS: async (smsData) => {
    const response = await api.post('/twilio/sms/send', smsData)
    return response.data
  },

  // Get SMS history
  getSMSHistory: async (params = {}) => {
    const response = await api.get('/twilio/sms', { params })
    return response.data
  },

  // Get SMS conversations (grouped by phone number)
  getConversations: async () => {
    const response = await api.get('/twilio/sms/conversations')
    return response.data
  },

  // Get messages for a specific conversation
  getConversation: async (phoneNumber, params = {}) => {
    const response = await api.get(`/twilio/sms/conversation/${encodeURIComponent(phoneNumber)}`, { params })
    return response.data
  },

  // Make phone call
  makeCall: async (callData) => {
    const response = await api.post('/twilio/call/make', callData)
    return response.data
  },

  // Get call history
  getCallHistory: async (params = {}) => {
    const response = await api.get('/twilio/call', { params })
    return response.data
  },

  // Get SMS templates
  getTemplates: async (category = null) => {
    const params = category ? { category } : {}
    const response = await api.get('/twilio/templates', { params })
    return response.data
  },

  // Create SMS template
  createTemplate: async (templateData) => {
    const response = await api.post('/twilio/templates', templateData)
    return response.data
  },

  // Update SMS template
  updateTemplate: async (id, templateData) => {
    const response = await api.put(`/twilio/templates/${id}`, templateData)
    return response.data
  },

  // Delete SMS template
  deleteTemplate: async (id) => {
    const response = await api.delete(`/twilio/templates/${id}`)
    return response.data
  },

  // Get statistics
  getStats: async () => {
    const response = await api.get('/twilio/stats')
    return response.data
  }
}

// Lead Interactions API
export const leadInteractionsAPI = {
  getInteractions: async (leadId) => {
    const response = await api.get(`/leads/${leadId}/interactions`)
    return response.data
  },

  createInteraction: async (leadId, data) => {
    const response = await api.post(`/leads/${leadId}/interactions`, data)
    return response.data
  },

  updateInteraction: async (leadId, interactionId, data) => {
    const response = await api.put(`/leads/${leadId}/interactions/${interactionId}`, data)
    return response.data
  },

  deleteInteraction: async (leadId, interactionId) => {
    const response = await api.delete(`/leads/${leadId}/interactions/${interactionId}`)
    return response.data
  },

  completeInteraction: async (leadId, interactionId, data) => {
    const response = await api.patch(`/leads/${leadId}/interactions/${interactionId}/complete`, data)
    return response.data
  }
}

// Task Management API
export const taskAPI = {
  // Get all tasks for a lead with optional filters
  getTasks: async (leadId, params = {}) => {
    const response = await api.get(`/leads/${leadId}/tasks`, { params })
    return response.data
  },

  // Create a new task
  createTask: async (leadId, data) => {
    const response = await api.post(`/leads/${leadId}/tasks`, data)
    return response.data
  },

  // Update task details
  updateTask: async (leadId, taskId, data) => {
    const response = await api.patch(`/leads/${leadId}/tasks/${taskId}`, data)
    return response.data
  },

  // Mark task as completed
  completeTask: async (leadId, taskId, data = {}) => {
    // Validate UUIDs before making request
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!leadId || typeof leadId !== 'string' || !uuidRegex.test(leadId)) {
      throw new Error(`Invalid lead ID: ${leadId}`);
    }

    if (!taskId || typeof taskId !== 'string' || !uuidRegex.test(taskId)) {
      throw new Error(`Invalid task ID: ${taskId}`);
    }

    const response = await api.patch(`/leads/${leadId}/tasks/${taskId}/complete`, data)
    return response.data
  },

  // Delete a task
  deleteTask: async (leadId, taskId) => {
    const response = await api.delete(`/leads/${leadId}/tasks/${taskId}`)
    return response.data
  },

  // Bulk complete tasks
  bulkCompleteTasks: async (leadId, taskIds) => {
    const response = await api.post(`/leads/${leadId}/tasks/bulk-complete`, { taskIds })
    return response.data
  },

  // Get overdue tasks across all leads
  getOverdueTasks: async () => {
    const response = await api.get('/leads/tasks/overdue')
    return response.data
  },

  // Get upcoming tasks across all leads
  getUpcomingTasks: async (days = 7) => {
    const response = await api.get('/leads/tasks/upcoming', { params: { days } })
    return response.data
  },

  // Get all tasks across organization with filters
  getAllTasks: async (params = {}) => {
    const response = await api.get('/tasks/all', { params })
    return response.data
  }
}

// Reporting & Analytics API
export const reportingAPI = {
  // Get all dashboard KPIs in a single request
  getDashboardKPIs: async () => {
    const response = await api.get('/reporting/dashboard/kpis')
    return response.data
  },

  // Get monthly revenue trend
  getRevenueTrend: async (months = 12) => {
    const response = await api.get('/reporting/dashboard/revenue-trend', {
      params: { months }
    })
    return response.data
  },

  // Get revenue breakdown by product
  getRevenueByProduct: async (startDate = null, endDate = null) => {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate

    const response = await api.get('/reporting/dashboard/revenue-by-product', { params })
    return response.data
  },

  // Get payment methods breakdown
  getPaymentMethods: async () => {
    const response = await api.get('/reporting/dashboard/payment-methods')
    return response.data
  },

  // Get new customers trend
  getNewCustomersTrend: async (months = 6) => {
    const response = await api.get('/reporting/dashboard/new-customers', {
      params: { months }
    })
    return response.data
  },

  // Get accounts breakdown by product
  getAccountsByProduct: async () => {
    const response = await api.get('/reporting/dashboard/accounts-by-product')
    return response.data
  }
}

// Reports API (Custom Reports)
export const reportsAPI = {
  // Execute a dynamic report
  executeReport: async (config) => {
    const response = await api.post('/reports/execute', config)
    return response.data
  },

  // Get all saved reports for current user
  getSavedReports: async (filters = {}) => {
    const response = await api.get('/reports/saved', { params: filters })
    return response.data
  },

  // Get a single saved report
  getSavedReport: async (id) => {
    const response = await api.get(`/reports/saved/${id}`)
    return response.data
  },

  // Create a new saved report
  createSavedReport: async (reportData) => {
    const response = await api.post('/reports/saved', reportData)
    return response.data
  },

  // Update a saved report
  updateSavedReport: async (id, reportData) => {
    const response = await api.put(`/reports/saved/${id}`, reportData)
    return response.data
  },

  // Delete a saved report
  deleteSavedReport: async (id) => {
    const response = await api.delete(`/reports/saved/${id}`)
    return response.data
  },

  // Toggle favorite status
  toggleFavorite: async (id) => {
    const response = await api.post(`/reports/saved/${id}/favorite`)
    return response.data
  },

  // Export report to CSV
  exportCSV: async (config) => {
    const response = await api.post('/reports/export/csv', config, {
      responseType: 'blob'
    })
    return response.data
  },

  // Get available data sources
  getDataSources: async () => {
    const response = await api.get('/reports/metadata/sources')
    return response.data
  },

  // Get fields for a data source
  getFields: async (dataSource) => {
    const response = await api.get(`/reports/metadata/fields/${dataSource}`)
    return response.data
  },

  // Get operators for a field type
  getOperators: async (fieldType) => {
    const response = await api.get(`/reports/metadata/operators/${fieldType}`)
    return response.data
  }
}

// Dashboards API (Custom Dashboards)
export const dashboardsAPI = {
  // Get all saved dashboards for current user
  getSavedDashboards: async () => {
    const response = await api.get('/dashboards/saved')
    return response.data
  },

  // Get a single saved dashboard
  getSavedDashboard: async (id) => {
    const response = await api.get(`/dashboards/saved/${id}`)
    return response.data
  },

  // Create a new saved dashboard
  createSavedDashboard: async (dashboardData) => {
    const response = await api.post('/dashboards/saved', dashboardData)
    return response.data
  },

  // Update a saved dashboard
  updateSavedDashboard: async (id, dashboardData) => {
    const response = await api.put(`/dashboards/saved/${id}`, dashboardData)
    return response.data
  },

  // Delete a saved dashboard
  deleteSavedDashboard: async (id) => {
    const response = await api.delete(`/dashboards/saved/${id}`)
    return response.data
  },

  // Set a dashboard as default
  setDefaultDashboard: async (id) => {
    const response = await api.post(`/dashboards/saved/${id}/set-default`)
    return response.data
  },

  // Execute a widget
  executeWidget: async (widgetConfig) => {
    const response = await api.post('/dashboards/widgets/execute', widgetConfig)
    return response.data
  }
}

// Field Mapping API
export const fieldMappingAPI = {
  // Get all field mappings
  getAll: async () => {
    const response = await api.get('/field-mappings')
    return { fieldMappings: response.data.data || [] }
  },

  // Get a single field mapping
  getById: async (id) => {
    const response = await api.get(`/field-mappings/${id}`)
    return response.data
  },

  // Create a new field mapping
  create: async (mappingData) => {
    const response = await api.post('/field-mappings', mappingData)
    return response.data
  },

  // Update a field mapping
  update: async (id, mappingData) => {
    const response = await api.put(`/field-mappings/${id}`, mappingData)
    return response.data
  },

  // Delete a field mapping
  delete: async (id) => {
    const response = await api.delete(`/field-mappings/${id}`)
    return response.data
  },

  // Get available fields for an entity
  getEntityFields: async (entityType) => {
    const response = await api.get(`/field-mappings/fields/${entityType}`)
    return response.data
  }
}

// Field Mapping Templates API
export const fieldMappingTemplateAPI = {
  // Get all templates
  getAll: async () => {
    const response = await api.get('/field-mapping-templates')
    return { templates: response.data.data || [] }
  },

  // Get a single template
  getById: async (id) => {
    const response = await api.get(`/field-mapping-templates/${id}`)
    return response.data
  },

  // Apply a template to create mappings
  apply: async (templateId) => {
    const response = await api.post(`/field-mapping-templates/${templateId}/apply`)
    return response.data
  },

  // Create a custom template
  create: async (templateData) => {
    const response = await api.post('/field-mapping-templates', templateData)
    return response.data
  },

  // Update a template
  update: async (id, templateData) => {
    const response = await api.put(`/field-mapping-templates/${id}`, templateData)
    return response.data
  },

  // Delete a template
  delete: async (id) => {
    const response = await api.delete(`/field-mapping-templates/${id}`)
    return response.data
  }
}

export default api