import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Device } from '@twilio/voice-sdk'
import { twilioAPI } from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { playRingtone, stopRingtone } from '../utils/audio'
import { showBrowserNotification, flashTabTitle, stopFlashTabTitle } from '../utils/notifications'

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

      // Set up event listeners on the incoming call IMMEDIATELY
      // These handle cases where caller hangs up or gets redirected BEFORE agent accepts
      const handleCallCancel = () => {
        console.log('📞 Incoming call cancelled (caller hung up or redirected to voicemail)')
        setIncomingCall(null)
      }

      const handleCallDisconnect = () => {
        console.log('📞 Incoming call disconnected before acceptance')
        setIncomingCall(null)
      }

      const handleCallReject = () => {
        console.log('📞 Incoming call rejected')
        setIncomingCall(null)
      }

      // Attach listeners to the call object
      call.on('cancel', handleCallCancel)
      call.on('disconnect', handleCallDisconnect)
      call.on('reject', handleCallReject)

      // Set incoming call data for display in notification
      setIncomingCall({
        callSid,
        from,
        callerName: 'Incoming Call',
        twilioCall: call,  // Store the actual SDK call object
        // Store listener functions for cleanup if needed
        _listeners: {
          handleCallCancel,
          handleCallDisconnect,
          handleCallReject
        }
      })

      // Play looping ringtone
      playRingtone()

      // Flash the browser tab title
      flashTabTitle('📞 Incoming Call!')

      // Show OS-level browser notification
      showBrowserNotification('📞 Incoming Call', {
        body: `Call from ${from}`,
        tag: 'incoming-call',
        requireInteraction: true
      })

      // Auto-dismiss if caller hangs up before agent answers
      call.on('cancel', () => {
        stopRingtone()
        stopFlashTabTitle()
        setIncomingCall(null)
        setMissedCallCount(prev => prev + 1)
        toast(`Missed call from ${from}`)
      })

      // Guard: also handle unexpected disconnect before answer
      call.on('disconnect', () => {
        stopRingtone()
        stopFlashTabTitle()
        setIncomingCall(null)
      })
    }

    // Listen for incoming calls from SDK
    window.addEventListener('twilioIncomingCall', handleIncomingCall)

    return () => {
      window.removeEventListener('twilioIncomingCall', handleIncomingCall)
    }
  }, [])

  // Accept incoming call - Use SDK's native accept() method
  const acceptCall = async () => {
    if (!incomingCall) return

    try {
      const { twilioCall, from, callSid, _listeners } = incomingCall

      console.log('Accepting incoming call:', callSid)

      if (!twilioCall) {
        throw new Error('No Twilio call object available')
      }

      // Clean up the incoming call event listeners before accepting
      if (_listeners) {
        twilioCall.removeListener('cancel', _listeners.handleCallCancel)
        twilioCall.removeListener('disconnect', _listeners.handleCallDisconnect)
        twilioCall.removeListener('reject', _listeners.handleCallReject)
      }

      // Accept the call using SDK's native method
      // This automatically connects the agent to the conference via the agent-bridge webhook
      await twilioCall.accept()

      console.log('✅ Incoming call accepted via SDK')
      console.log('Call status after accept():', twilioCall.status())

      // Set activeCall state with call object for Dialpad to use
      const activeCallState = {
        status: 'in-progress',
        from,
        callSid,
        twilioCall
      }
      setActiveCall(activeCallState)

      // Set up listeners for ALL possible call end events
      // The SDK can fire different events depending on call state and how it ends

      // When either party disconnects the call
      twilioCall.on('disconnect', () => {
        console.log('📞 Active call disconnected (caller or agent hung up)')
        console.log('Call status on disconnect:', twilioCall.status())
        setActiveCall(null)
      })

      // When call is cancelled (e.g., caller hangs up quickly)
      twilioCall.on('cancel', () => {
        console.log('📞 Active call cancelled')
        console.log('Call status on cancel:', twilioCall.status())
        setActiveCall(null)
      })

      // When an error occurs during the call
      twilioCall.on('error', (error) => {
        console.error('📞 Active call error:', error)
        console.log('Call status on error:', twilioCall.status())
        setActiveCall(null)
      })

      // Stop ringtone and tab flash
      stopRingtone()
      stopFlashTabTitle()

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
      const { twilioCall, callSid, _listeners } = incomingCall

      console.log('Declining incoming call:', callSid)

      if (!twilioCall) {
        throw new Error('No Twilio call object available')
      }

      // Clean up the incoming call event listeners before rejecting
      if (_listeners) {
        twilioCall.removeListener('cancel', _listeners.handleCallCancel)
        twilioCall.removeListener('disconnect', _listeners.handleCallDisconnect)
        twilioCall.removeListener('reject', _listeners.handleCallReject)
      }

      // Reject the call using SDK's native method
      await twilioCall.reject()

      console.log('✅ Incoming call rejected via SDK')

      // Stop ringtone and tab flash
      stopRingtone()
      stopFlashTabTitle()

      setMissedCallCount(prev => prev + 1)
      setIncomingCall(null)
      toast('Call declined')
    } catch (error) {
      console.error('Error declining call:', error)
      // Still stop audio and clear the call locally even if SDK call fails
      stopRingtone()
      stopFlashTabTitle()
      setIncomingCall(null)
      toast.error('Failed to decline call')
    }
  }

  // End active call
  const endCall = () => {
    if (activeCall) {
      setActiveCall(null)
      toast('Call ended')
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
