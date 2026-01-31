import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { twilioAPI } from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

const CallContext = createContext()

export const useCall = () => {
  const context = useContext(CallContext)
  if (!context) {
    throw new Error('useCall must be used within a CallProvider')
  }
  return context
}

export const CallProvider = ({ children }) => {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated || false;
  const [incomingCall, setIncomingCall] = useState(null)
  const [activeCall, setActiveCall] = useState(null)
  const [callHistory, setCallHistory] = useState([])
  const [missedCallCount, setMissedCallCount] = useState(0)

  // Fetch call history
  const fetchCallHistory = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      return
    }

    try {
      const data = await twilioAPI.getCallHistory({ limit: 50 })
      setCallHistory(data.calls || [])
    } catch (error) {
      console.error('Error fetching call history:', error)
    }
  }, [isAuthenticated])

  // Poll for incoming calls (simple polling approach)
  useEffect(() => {
    const checkForIncomingCalls = async () => {
      if (!isAuthenticated) return
      const token = localStorage.getItem('authToken')
      if (!token) return

      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api'
        const response = await fetch(`${API_URL}/twilio/incoming-calls/pending`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Organization-Slug': localStorage.getItem('organizationSlug')
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.incomingCall && !incomingCall) {
            setIncomingCall(data.incomingCall)
            // Play notification sound
            playNotificationSound()
            // Request browser notification permission
            if (Notification.permission === 'granted') {
              new Notification('Incoming Call', {
                body: `Call from ${data.incomingCall.callerName || data.incomingCall.from}`,
                icon: '/phone-icon.png'
              })
            }
          } else if (!data.incomingCall && incomingCall) {
            // Call was accepted by another agent - clear the popup
            console.log('Incoming call no longer available (accepted by another agent)')
            setIncomingCall(null)
          }
        }
      } catch (error) {
        // Silently fail - endpoint might not exist yet
      }
    }

    // Only start polling if authenticated
    if (!isAuthenticated) return;

    // Poll every 10 seconds
    const interval = setInterval(checkForIncomingCalls, 10000)

    return () => clearInterval(interval)
  }, [incomingCall, isAuthenticated])

  // Play notification sound for incoming calls
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 880
      oscillator.type = 'sine'
      gainNode.gain.value = 0.5

      oscillator.start()
      setTimeout(() => {
        oscillator.stop()
        audioContext.close()
      }, 200)
    } catch (error) {
      console.error('Error playing notification sound:', error)
    }
  }

  // Accept incoming call - Move customer from queue to conference
  const acceptCall = async () => {
    if (!incomingCall) return

    try {
      console.log('Accepting incoming call:', incomingCall)

      // Call backend to dequeue customer into conference
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api'
      const response = await fetch(`${API_URL}/twilio/incoming-calls/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'X-Organization-Slug': localStorage.getItem('organizationSlug'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callSid: incomingCall.callSid
        })
      })

      if (!response.ok) {
        throw new Error('Failed to accept call')
      }

      const { conferenceId } = await response.json()

      console.log('Customer moved to conference:', conferenceId)

      // Clear the incoming notification
      setIncomingCall(null)

      // Dispatch event to connect agent to conference
      window.dispatchEvent(new CustomEvent('joinIncomingCallConference', {
        detail: {
          conferenceId,
          callerPhone: incomingCall.from,
          callerName: incomingCall.callerName
        }
      }))

      toast.success('Connecting to caller...')
    } catch (error) {
      console.error('Error accepting call:', error)
      toast.error('Failed to accept call')
    }
  }

  // Decline incoming call
  const declineCall = async () => {
    if (!incomingCall) return

    try {
      // Call backend to decline and hang up the call
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api'
      await fetch(`${API_URL}/twilio/incoming-calls/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'X-Organization-Slug': localStorage.getItem('organizationSlug'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callSid: incomingCall.callSid
        })
      })

      setMissedCallCount(prev => prev + 1)
      setIncomingCall(null)
      toast.info('Call declined')
    } catch (error) {
      console.error('Error declining call:', error)
      // Still clear the call locally even if backend fails
      setIncomingCall(null)
      toast.error('Failed to decline call')
    }
  }

  // End active call
  const endCall = () => {
    if (activeCall) {
      setActiveCall(null)
      toast.info('Call ended')
      fetchCallHistory() // Refresh history
    }
  }

  // Clear missed call count
  const clearMissedCalls = () => {
    setMissedCallCount(0)
  }

  // Load call history on mount (only if authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      fetchCallHistory()
    }
  }, [isAuthenticated, fetchCallHistory])

  const value = {
    incomingCall,
    activeCall,
    callHistory,
    missedCallCount,
    acceptCall,
    declineCall,
    endCall,
    clearMissedCalls,
    fetchCallHistory
  }

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  )
}

export default CallProvider
