import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const SuperAdminContext = createContext();

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api';

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

function superAdminReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.admin,
        token: action.payload.token,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        error: null,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

export function SuperAdminProvider({ children }) {
  const [state, dispatch] = useReducer(superAdminReducer, initialState);
  const queryClient = useQueryClient();

  // Initialize from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('superAdminToken');
    const user = localStorage.getItem('superAdminUser');

    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { token, admin: parsedUser }
        });
      } catch (error) {
        localStorage.removeItem('superAdminToken');
        localStorage.removeItem('superAdminUser');
      }
    }
  }, []);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }) => {
      const response = await fetch(`${API_BASE_URL}/platform/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      return response.json();
    },
    onMutate: () => {
      dispatch({ type: 'LOGIN_START' });
    },
    onSuccess: (data) => {
      localStorage.setItem('superAdminToken', data.token);
      localStorage.setItem('superAdminUser', JSON.stringify(data.admin));

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: data
      });
    },
    onError: (error) => {
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: error.message
      });
    },
  });

  const login = (credentials) => {
    loginMutation.mutate(credentials);
  };

  const logout = () => {
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminUser');
    queryClient.clear();
    dispatch({ type: 'LOGOUT' });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // API helper function with authentication
  const apiCall = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}/platform${endpoint}`;
    const token = state.token || localStorage.getItem('superAdminToken');

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        throw new Error('Session expired. Please login again.');
      }
      const error = await response.json();
      throw new Error(error.error || 'API call failed');
    }

    return response.json();
  };

  const value = {
    ...state,
    login,
    logout,
    clearError,
    apiCall,
  };

  return (
    <SuperAdminContext.Provider value={value}>
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  const context = useContext(SuperAdminContext);
  if (!context) {
    throw new Error('useSuperAdmin must be used within a SuperAdminProvider');
  }
  return context;
}

// Custom hooks for data fetching
export function useSuperAdminDashboard() {
  const { apiCall } = useSuperAdmin();

  return useQuery({
    queryKey: ['superAdminDashboard'],
    queryFn: () => apiCall('/dashboard'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSuperAdminTrialSignups(filters = {}) {
  const { apiCall } = useSuperAdmin();

  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) queryParams.append(key, value);
  });

  const endpoint = `/trial-signups${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  return useQuery({
    queryKey: ['superAdminTrialSignups', filters],
    queryFn: () => apiCall(endpoint),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useSuperAdminStats() {
  const { apiCall } = useSuperAdmin();

  return useQuery({
    queryKey: ['superAdminStats'],
    queryFn: () => apiCall('/stats'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSuperAdminOrganizations() {
  const { apiCall } = useSuperAdmin();

  return useQuery({
    queryKey: ['superAdminOrganizations'],
    queryFn: () => apiCall('/organizations'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation hooks
export function useUpdateSignupStatus() {
  const { apiCall } = useSuperAdmin();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, notes }) =>
      apiCall(`/trial-signups/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminTrialSignups'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    },
  });
}

export function useAddSignupNotes() {
  const { apiCall } = useSuperAdmin();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }) =>
      apiCall(`/trial-signups/${id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminTrialSignups'] });
    },
  });
}

export function useConvertSignup() {
  const { apiCall } = useSuperAdmin();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, organization_name, domain, admin_password }) =>
      apiCall(`/trial-signups/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({ organization_name, domain, admin_password }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminTrialSignups'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
    },
  });
}