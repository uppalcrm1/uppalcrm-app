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
        clearAuth()
        window.location.href = '/login'
        toast.error('Session expired. Please log in again.')
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
  
  convertFromLead: async (leadId, additionalData = {}) => {
    const response = await api.post(`/contacts/convert-from-lead/${leadId}`, additionalData)
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

  updateTransaction: async (id, transactionData) => {
    const response = await api.put(`/transactions/${id}`, transactionData)
    return response.data
  },

  deleteTransaction: async (id) => {
    const response = await api.delete(`/transactions/${id}`)
    return response.data
  },

  getStats: async () => {
    const response = await api.get('/transactions/stats')
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

export default api