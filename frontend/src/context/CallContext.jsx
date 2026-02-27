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

  // Listen for incoming calls from Twilio Voice SDK (no polling needed!)
  // The SDK fires twilioIncomingCall event when an incoming call arrives
  useEffect(() => {
    const handleIncomingCall = (event) => {
      const { call, from, callSid } = event.detail

      // Set incoming call data for display in notification
      setIncomingCall({
        callSid,
        from,
        callerName: 'Incoming Call',
        twilioCall: call  // Store the actual SDK call object
      })

      // Play notification sound
      playNotificationSound()

      // Request browser notification permission
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Incoming Call', {
          body: `Call from ${from}`,
          icon: '/phone-icon.png'
        })
      }
    }

    // Listen for incoming calls from SDK
    window.addEventListener('twilioIncomingCall', handleIncomingCall)

    return () => {
      window.removeEventListener('twilioIncomingCall', handleIncomingCall)
    }
  }, [])

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

  // Accept incoming call - Use SDK's native accept() method
  const acceptCall = async () => {
    if (!incomingCall) return

    try {
      const { twilioCall, from, callSid } = incomingCall

      console.log('Accepting incoming call:', callSid)

      if (!twilioCall) {
        throw new Error('No Twilio call object available')
      }

      // Accept the call using SDK's native method
      // This automatically connects the agent to the conference via the agent-bridge webhook
      await twilioCall.accept()

      console.log('✅ Incoming call accepted via SDK')

      // Clear the incoming notification
      setIncomingCall(null)

      // Notify user
      toast.success(`Connected to ${from}...`)
    } catch (error) {
      console.error('Error accepting call:', error)
      toast.error('Failed to accept call')
    }
  }

  // Decline incoming call - Use SDK's native reject() method
  const declineCall = async () => {
    if (!incomingCall) return

    try {
      const { twilioCall, callSid } = incomingCall

      console.log('Declining incoming call:', callSid)

      if (!twilioCall) {
        throw new Error('No Twilio call object available')
      }

      // Reject the call using SDK's native method
      await twilioCall.reject()

      console.log('✅ Incoming call rejected via SDK')

      setMissedCallCount(prev => prev + 1)
      setIncomingCall(null)
      toast.info('Call declined')
    } catch (error) {
      console.error('Error declining call:', error)
      // Still clear the call locally even if SDK call fails
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
