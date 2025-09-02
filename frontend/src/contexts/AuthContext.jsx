import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { authAPI, setAuthToken, setOrganizationSlug, clearAuth } from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext()

const initialState = {
  user: null,
  organization: null,
  isLoading: true,
  isAuthenticated: false,
}

const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true }
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        organization: action.payload.organization,
        isLoading: false,
        isAuthenticated: true,
      }
    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        organization: null,
        isLoading: false,
        isAuthenticated: false,
      }
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      }
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      }
    default:
      return state
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Initialize auth on app start
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('authToken')
      
      if (!token) {
        dispatch({ type: 'AUTH_ERROR' })
        return
      }

      try {
        setAuthToken(token)
        const data = await authAPI.me()
        
        // Set organization slug from the response if not already set
        if (data.organization?.slug) {
          setOrganizationSlug(data.organization.slug)
        }
        
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: data.user,
            organization: data.organization,
          },
        })
      } catch (error) {
        console.error('Auth initialization failed:', error)
        clearAuth()
        dispatch({ type: 'AUTH_ERROR' })
      }
    }

    initAuth()
  }, [])

  const login = async (email, password) => {
    dispatch({ type: 'AUTH_START' })
    
    try {
      const data = await authAPI.login(email, password)
      
      setAuthToken(data.token)
      setOrganizationSlug(data.organization.slug)
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: data.user,
          organization: data.organization,
        },
      })
      
      toast.success(`Welcome back, ${data.user.first_name}!`)
      return { success: true, data }
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR' })
      const message = error.response?.data?.message || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const register = async (organizationData, adminData) => {
    dispatch({ type: 'AUTH_START' })
    
    try {
      const data = await authAPI.register(organizationData, adminData)
      
      setAuthToken(data.token)
      setOrganizationSlug(data.organization.slug)
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: data.user,
          organization: data.organization,
        },
      })
      
      toast.success('Organization created successfully!')
      return { success: true, data }
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR' })
      const message = error.response?.data?.message || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuth()
      dispatch({ type: 'LOGOUT' })
      toast.success('Logged out successfully')
    }
  }

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData })
  }

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}