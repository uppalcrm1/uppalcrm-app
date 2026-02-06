import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'

const WebSocketContext = createContext()

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)

  // Return safe dummy context if not found or WebSocket unavailable
  if (!context) {
    return {
      isConnected: false,
      connectionError: 'WebSocket not available',
      on: () => {},
      off: () => {},
      emit: () => {}
    }
  }

  return context
}

export const WebSocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const socketRef = useRef(null)

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setIsConnected(false)
      return
    }

    // Initialize WebSocket in a non-blocking way
    const initSocket = async () => {
      try {
        const token = localStorage.getItem('authToken')
        if (!token) {
          return
        }

        // Dynamically import socket.io-client
        const { io } = await import('socket.io-client')

        const API_URL = import.meta.env.VITE_API_URL
          ? import.meta.env.VITE_API_URL.replace('/api', '')
          : 'http://localhost:3004'

        const socket = io(API_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: Infinity,
          autoConnect: true,
          path: '/socket.io/'
        })

        socket.on('connect', () => {
          console.log('✅ WebSocket connected:', socket.id)
          setIsConnected(true)
          setConnectionError(null)
        })

        socket.on('disconnect', () => {
          console.log('❌ WebSocket disconnected')
          setIsConnected(false)
        })

        socket.on('connect_error', (error) => {
          console.warn('⚠️ WebSocket connection error:', error)
          setConnectionError(error?.message || 'Connection failed')
          setIsConnected(false)
        })

        socket.on('error', (error) => {
          console.warn('⚠️ WebSocket error:', error)
          setConnectionError(typeof error === 'string' ? error : 'WebSocket error')
        })

        const handleStorageChange = (e) => {
          if (e.key === 'authToken' && e.newValue) {
            socket.auth = { token: e.newValue }
            if (!socket.connected) {
              socket.connect()
            }
          }
        }

        window.addEventListener('storage', handleStorageChange)
        socketRef.current = socket

        return () => {
          window.removeEventListener('storage', handleStorageChange)
          if (socketRef.current) {
            socketRef.current.disconnect()
          }
        }
      } catch (error) {
        console.warn('⚠️ WebSocket initialization skipped:', error.message)
        setIsConnected(false)
        // Don't set error - just silently fail and use polling fallback
      }
    }

    // Start initialization but don't block rendering
    initSocket().catch(() => {
      // Silently handle any errors
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [isAuthenticated])

  const on = useCallback((event, callback) => {
    if (socketRef.current?.connected) {
      socketRef.current.on(event, callback)
    }
  }, [])

  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback)
    }
  }, [])

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ isConnected, connectionError, on, off, emit }}>
      {children}
    </WebSocketContext.Provider>
  )
}
