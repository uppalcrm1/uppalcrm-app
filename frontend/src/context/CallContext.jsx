import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { twilioAPI } from '../services/api'
import toast from 'react-hot-toast'

const CallContext = createContext()

export const useCall = () => {
  const context = useContext(CallContext)
  if (!context) {
    throw new Error('useCall must be used within a CallProvider')
  }
  return context
}

export const CallProvider = ({ children }) => {
  const [incomingCall, setIncomingCall] = useState(null)
  const [activeCall, setActiveCall] = useState(null)
  const [callHistory, setCallHistory] = useState([])
  const [missedCallCount, setMissedCallCount] = useState(0)

  // Fetch call history
  const fetchCallHistory = useCallback(async () => {
    try {
      const data = await twilioAPI.getCallHistory({ limit: 50 })
      setCallHistory(data.calls || [])
    } catch (error) {
      console.error('Error fetching call history:', error)
    }
  }, [])

  // Poll for incoming calls (simple polling approach)
  useEffect(() => {
    const checkForIncomingCalls = async () => {
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
          }
        }
      } catch (error) {
        // Silently fail - endpoint might not exist yet
      }
    }

    // Poll every 3 seconds
    const interval = setInterval(checkForIncomingCalls, 3000)

    return () => clearInterval(interval)
  }, [incomingCall])

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

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall) return

    try {
      // In a real implementation, this would connect the call
      setActiveCall({
        ...incomingCall,
        status: 'connected',
        startTime: new Date()
      })
      setIncomingCall(null)
      toast.success('Call connected')
    } catch (error) {
      console.error('Error accepting call:', error)
      toast.error('Failed to accept call')
    }
  }

  // Decline incoming call
  const declineCall = async () => {
    if (!incomingCall) return

    try {
      setMissedCallCount(prev => prev + 1)
      setIncomingCall(null)
      toast.info('Call declined')
    } catch (error) {
      console.error('Error declining call:', error)
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

  // Make outgoing call
  const makeCall = async (phoneNumber, contactInfo = {}) => {
    try {
      const result = await twilioAPI.makeCall({
        to: phoneNumber,
        leadId: contactInfo.leadId,
        contactId: contactInfo.contactId
      })

      setActiveCall({
        id: result.id,
        phoneNumber,
        direction: 'outbound',
        status: 'calling',
        startTime: new Date(),
        ...contactInfo
      })

      toast.success('Calling...')
      return result
    } catch (error) {
      console.error('Error making call:', error)
      toast.error(error.response?.data?.error || 'Failed to make call')
      throw error
    }
  }

  // Clear missed call count
  const clearMissedCalls = () => {
    setMissedCallCount(0)
  }

  // Load call history on mount
  useEffect(() => {
    fetchCallHistory()
  }, [fetchCallHistory])

  const value = {
    incomingCall,
    activeCall,
    callHistory,
    missedCallCount,
    acceptCall,
    declineCall,
    endCall,
    makeCall,
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
