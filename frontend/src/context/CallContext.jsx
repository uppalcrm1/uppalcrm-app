import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Device } from '@twilio/voice-sdk'
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
  const [deviceStatus, setDeviceStatus] = useState('initializing') // 'initializing', 'ready', 'error'
  const deviceRef = useRef(null)

  // Initialize Twilio Device when user logs in
  useEffect(() => {
    if (!isAuthenticated) {
      // Cleanup device when logging out
      if (deviceRef.current) {
        deviceRef.current.destroy()
        deviceRef.current = null
      }
      setDeviceStatus('initializing')
      return
    }

    const initDevice = async () => {
      try {
        console.log('🎧 Twilio Device initializing in CallContext...')
        setDeviceStatus('initializing')

        // Check microphone permission
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(track => track.stop())
          console.log('✅ Microphone permission granted')
        } catch (error) {
          console.error('❌ Microphone permission denied:', error)
          setDeviceStatus('error')
          toast.error('Please allow microphone access for incoming calls')
          return
        }

        const token = localStorage.getItem('authToken')
        if (!token) {
          console.error('No auth token found')
          setDeviceStatus('error')
          return
        }

        // Fetch Twilio token from backend
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api'
        const response = await fetch(`${API_URL}/twilio/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Organization-Slug': localStorage.getItem('organizationSlug')
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to get Twilio token: ${response.statusText}`)
        }

        const { token: twilioToken } = await response.json()
        console.log('✅ Token received, creating device in CallContext...')

        // Create device instance
        const device = new Device(twilioToken, {
          debug: true,
          sounds: {
            incoming: true,
            outgoing: true,
            disconnect: true
          }
        })

        // Device registered - ready to make/receive calls
        device.on('registered', () => {
          console.log('✅ Twilio Device registered and ready')
          console.log('📱 Registered identity:', device.identity)
          setDeviceStatus('ready')
          toast.success('Voice connection ready')
        })

        // Handle token expiration
        device.on('tokenWillExpire', async () => {
          console.warn('⏰ Token expiring soon - refreshing...')
          try {
            const token = localStorage.getItem('authToken')
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api'
            const response = await fetch(`${API_URL}/twilio/token`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Organization-Slug': localStorage.getItem('organizationSlug')
              }
            })

            if (!response.ok) {
              throw new Error('Failed to refresh token')
            }

            const { token: newToken } = await response.json()
            device.updateToken(newToken)
            console.log('✅ Token refreshed successfully')
          } catch (error) {
            console.error('❌ Error refreshing token:', error)
            setDeviceStatus('error')
          }
        })

        // Handle errors
        device.on('error', (error) => {
          console.error('❌ Twilio Device error:', error)
          setDeviceStatus('error')
          toast.error(`Connection error: ${error.message}`)
        })

        // Handle incoming calls via SDK
        device.on('incoming', (call) => {
          console.log('📞 SDK incoming event fired! Call object:', call)
          console.log('📞 SDK incoming call received from:', call.parameters.From)

          // Dispatch custom event for CallContext to handle
          window.dispatchEvent(new CustomEvent('twilioIncomingCall', {
            detail: {
              call: call,
              from: call.parameters.From,
              callSid: call.parameters.CallSid
            }
          }))
        })

        // Register the device
        await device.register()
        deviceRef.current = device

        console.log('✅ Device initialization complete')
      } catch (error) {
        console.error('❌ Error initializing Twilio device:', error)
        setDeviceStatus('error')
        toast.error(error.message || 'Failed to initialize voice connection')
      }
    }

    initDevice()

    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy()
        deviceRef.current = null
      }
    }
  }, [isAuthenticated])

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

      // Set activeCall state with call object for Dialpad to use
      const activeCallState = {
        status: 'in-progress',
        from,
        callSid,
        twilioCall
      }
      setActiveCall(activeCallState)

      // Set up disconnect listener to clear activeCall when call ends
      // This handles both agent hang-up and customer hang-up
      twilioCall.on('disconnect', () => {
        console.log('📞 Incoming call disconnected')
        setActiveCall(null)
      })

      // Clear the incoming notification
      setIncomingCall(null)

      // Dispatch event to open Dialpad with caller info
      window.dispatchEvent(new CustomEvent('incomingCallAccepted', {
        detail: {
          from,
          callSid
        }
      }))

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
    fetchCallHistory,
    device: deviceRef.current,
    deviceStatus
  }

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  )
}

export default CallProvider
