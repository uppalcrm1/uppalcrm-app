import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'

let io = null
try {
  const socketIO = require('socket.io-client')
  io = socketIO.io || socketIO.default
} catch (error) {
  console.warn('socket.io-client module not found, WebSocket disabled:', error.message)
}

const WebSocketContext = createContext()

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    console.warn('useWebSocket must be used within a WebSocketProvider - returning dummy context')
    // Return a dummy context to prevent errors
    return {
      isConnected: false,
      connectionError: 'WebSocketProvider not found',
      on: () => {},
      off: () => {},
      emit: () => console.warn('WebSocket not initialized')
    }
  }
  return context
}

export const WebSocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isAuthenticated) {
      // Disconnect if not authenticated
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setIsConnected(false)
      return
    }

    // Get JWT token from localStorage
    const token = localStorage.getItem('authToken')
    if (!token) {
      console.warn('No auth token available for WebSocket connection')
      return
    }

    // Check if socket.io-client is available
    if (!io) {
      console.warn('socket.io-client not available, WebSocket disabled')
      setConnectionError('socket.io-client module not loaded')
      return
    }

    // Determine API URL
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004'

    console.log(`🔌 Attempting WebSocket connection to ${API_URL}`)

    // Create socket connection with JWT authentication
    let socket
    try {
      socket = io(API_URL, {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        autoConnect: true
      })
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionError(error.message)
      return
    }

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ WebSocket connected:', socket.id)
      setIsConnected(true)
      setConnectionError(null)
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason)
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error)
      setConnectionError(error.message)
      setIsConnected(false)
    })

    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error)
      setConnectionError(typeof error === 'string' ? error : 'WebSocket error')
    })

    // Handle token refresh on storage change
    const handleStorageChange = (e) => {
      if (e.key === 'authToken') {
        const newToken = e.newValue
        if (newToken && socket) {
          // Update socket auth with new token
          socket.auth = { token: newToken }
          if (!socket.connected) {
            socket.connect()
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    socketRef.current = socket

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [isAuthenticated])

  // Event subscription API
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback)
    }
  }, [])

  // Event unsubscription API
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback)
    }
  }, [])

  // Event emission API
  const emit = useCallback((event, data) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data)
    } else {
      console.warn('Cannot emit event: WebSocket not connected', { event })
    }
  }, [])

  const value = {
    isConnected,
    connectionError,
    on,
    off,
    emit
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}
