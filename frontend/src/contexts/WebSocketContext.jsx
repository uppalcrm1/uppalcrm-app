import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const WebSocketContext = createContext()

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
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

    // Determine API URL
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004'

    console.log(`🔌 Attempting WebSocket connection to ${API_URL}`)

    // Create socket connection with JWT authentication
    const socket = io(API_URL, {
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
