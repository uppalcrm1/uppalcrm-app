import React, { useState, useEffect, useRef } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Delete, X, User } from 'lucide-react'
import { Device } from '@twilio/voice-sdk'
import { twilioAPI } from '../services/api'
import toast from 'react-hot-toast'

const Dialpad = ({ onClose, prefilledNumber = '', contactName = '' }) => {
  const [phoneNumber, setPhoneNumber] = useState(prefilledNumber)
  const [isCallActive, setIsCallActive] = useState(false)
  const [callStatus, setCallStatus] = useState('')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isDialing, setIsDialing] = useState(false)
  const [deviceStatus, setDeviceStatus] = useState('initializing') // 'initializing', 'ready', 'error'
  const timerRef = useRef(null)
  const deviceRef = useRef(null)
  const activeCallRef = useRef(null)

  // Format phone number as user types
  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  const handleNumberClick = (num) => {
    if (phoneNumber.replace(/\D/g, '').length < 15) {
      const newNumber = phoneNumber.replace(/\D/g, '') + num
      setPhoneNumber(formatPhoneNumber(newNumber))
    }
  }

  const handleBackspace = () => {
    const numbers = phoneNumber.replace(/\D/g, '')
    const newNumber = numbers.slice(0, -1)
    setPhoneNumber(formatPhoneNumber(newNumber))
  }

  const handleClear = () => {
    setPhoneNumber('')
  }

  const handleCall = async () => {
    // ===== OUTBOUND CALL LOGIC =====
    const cleanNumber = phoneNumber.replace(/\D/g, '')
    if (cleanNumber.length < 10) {
      toast.error('Please enter a valid phone number')
      return
    }

    if (deviceStatus !== 'ready') {
      if (deviceStatus === 'error') {
        toast.error('Voice connection error. Please refresh the page and check your microphone permissions.')
      } else {
        toast.error('Voice connection is initializing. Please wait...')
      }
      return
    }

    if (!deviceRef.current) {
      toast.error('Voice connection not ready. Please refresh the page.')
      return
    }

    setIsDialing(true)
    setCallStatus('Dialing customer...')

    try {
      // Format phone number in E.164 format
      const formattedNumber = cleanNumber.startsWith('1')
        ? `+${cleanNumber}`
        : `+1${cleanNumber}`

      console.log(`📞 Initiating outbound call to ${formattedNumber}`)

      // Call customer - they will be put in queue and agent will need to accept
      const result = await twilioAPI.makeCall({
        to: formattedNumber
      })

      console.log('✅ Customer call initiated')
      setCallStatus('Ringing customer...')
      toast.success('Calling customer...')

    } catch (error) {
      console.error('Error making call:', error)

      // Extract detailed error message from response
      let errorMessage = 'Failed to make call'
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.response?.data?.details) {
        errorMessage = `Validation error: ${error.response.data.details[0]?.message || 'Invalid request'}`
      } else if (error.message) {
        errorMessage = error.message
      }

      toast.error(errorMessage)
      setCallStatus('')
    } finally {
      setIsDialing(false)
    }
  }

  const handleEndCall = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    if (activeCallRef.current) {
      activeCallRef.current.disconnect()
      activeCallRef.current = null
    }
    setIsCallActive(false)
    setCallStatus('Call ended')
    setCallDuration(0)

    setTimeout(() => {
      setCallStatus('')
    }, 2000)
  }

  const toggleMute = () => {
    if (activeCallRef.current && isCallActive) {
      activeCallRef.current.mute(!isMuted)
    }
    setIsMuted(!isMuted)
    toast.success(isMuted ? 'Microphone unmuted' : 'Microphone muted')
  }

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn)
    toast.success(isSpeakerOn ? 'Speaker off' : 'Speaker on')
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Initialize Twilio Device on mount
  useEffect(() => {
    const initDevice = async () => {
      try {
        setDeviceStatus('initializing')

        // Check microphone permission
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(track => track.stop())
          console.log('Microphone permission granted')
        } catch (error) {
          console.error('Microphone permission denied:', error)
          toast.error('Please allow microphone access to use calling')
          setDeviceStatus('error')
          return
        }

        const token = localStorage.getItem('authToken')
        if (!token) {
          console.error('No auth token found')
          setDeviceStatus('error')
          toast.error('Not authenticated. Please log in again.')
          return
        }

        // Get token from backend
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

        // Create and register device
        const device = new Device(twilioToken, {
          debug: true,
          sounds: {
            incoming: true,
            outgoing: true,
            disconnect: true
          }
        })

        device.on('registered', () => {
          console.log('Twilio Device registered and ready')
          setDeviceStatus('ready')
          toast.success('Voice connection ready')
        })

        device.on('tokenWillExpire', async () => {
          console.warn('Token expiring soon - refreshing...')
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
            console.log('Token refreshed successfully')
            toast.success('Voice connection refreshed')
          } catch (error) {
            console.error('Error refreshing token:', error)
            toast.error('Failed to refresh connection')
            setDeviceStatus('error')
          }
        })

        device.on('error', (error) => {
          console.error('Twilio Device error:', error)
          setDeviceStatus('error')
          toast.error(`Connection error: ${error.message}`)
        })

        await device.register()
        deviceRef.current = device
      } catch (error) {
        console.error('Error initializing Twilio device:', error)
        setDeviceStatus('error')
        toast.error(error.message || 'Failed to initialize voice connection')
      }
    }

    initDevice()

    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy()
      }
    }
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (activeCallRef.current) {
        activeCallRef.current.disconnect()
      }
    }
  }, [])

  // Auto-join incoming call conference when accepted
  useEffect(() => {
    const handleJoinIncomingConference = async (event) => {
      const { conferenceId, callerPhone, callerName } = event.detail

      if (!conferenceId || !deviceRef.current || deviceStatus !== 'ready' || isCallActive) {
        return
      }

      console.log('Auto-joining incoming call conference:', conferenceId)

      try {
        setIsDialing(true)
        setCallStatus('Joining conference...')

        // Auto-join the conference
        const call = await deviceRef.current.connect({
          params: {
            conference: conferenceId,
            participant: 'agent'
          }
        })

        activeCallRef.current = call
        setIsCallActive(true)
        setCallStatus('Connected')

        // Start call timer
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1)
        }, 1000)

        toast.success(`Connected to ${callerName || callerPhone}`)

        // Event listeners
        call.on('disconnect', () => {
          console.log('Call disconnected')
          handleEndCall()
        })

        call.on('error', (error) => {
          console.error('Call error:', error)
          toast.error(`Call error: ${error.message}`)
          handleEndCall()
        })
      } catch (error) {
        console.error('Error joining conference:', error)
        toast.error('Failed to join call')
        setCallStatus('')
        setIsCallActive(false)
      } finally {
        setIsDialing(false)
      }
    }

    window.addEventListener('joinIncomingCallConference', handleJoinIncomingConference)
    return () => {
      window.removeEventListener('joinIncomingCallConference', handleJoinIncomingConference)
    }
  }, [deviceStatus, isCallActive])

  const dialpadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ]

  const buttonLetters = {
    '2': 'ABC',
    '3': 'DEF',
    '4': 'GHI',
    '5': 'JKL',
    '6': 'MNO',
    '7': 'PQRS',
    '8': 'TUV',
    '9': 'WXYZ'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold">Phone</h3>
              <div className={`w-2 h-2 rounded-full ${
                deviceStatus === 'ready' ? 'bg-green-400' :
                deviceStatus === 'error' ? 'bg-red-400' :
                'bg-yellow-400'
              }`}></div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {deviceStatus !== 'ready' && (
            <p className="text-xs mt-2 text-white/80">
              {deviceStatus === 'initializing' ? 'Connecting...' : 'Connection error - refresh to retry'}
            </p>
          )}
        </div>

        {/* Contact/Number Display */}
        <div className="p-6 text-center border-b">
          {contactName && (
            <div className="flex items-center justify-center mb-2">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          )}
          {contactName && (
            <p className="text-sm text-gray-600 mb-1">{contactName}</p>
          )}
          <div className="text-2xl font-semibold text-gray-900 min-h-[36px]">
            {phoneNumber || 'Enter number'}
          </div>
          {callStatus && (
            <p className={`text-sm mt-1 ${isCallActive ? 'text-green-600' : 'text-gray-500'}`}>
              {callStatus}
              {isCallActive && callDuration > 0 && ` - ${formatDuration(callDuration)}`}
            </p>
          )}
        </div>


        {/* Dialpad */}
        {!isCallActive && (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3">
              {dialpadButtons.map((row, rowIndex) => (
                row.map((num) => (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num)}
                    className="flex flex-col items-center justify-center h-16 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                  >
                    <span className="text-2xl font-medium text-gray-900">{num}</span>
                    {buttonLetters[num] && (
                      <span className="text-xs text-gray-500 tracking-widest">
                        {buttonLetters[num]}
                      </span>
                    )}
                  </button>
                ))
              ))}
            </div>

            {/* Backspace button */}
            <div className="flex justify-end mt-2 pr-4">
              <button
                onClick={handleBackspace}
                className="p-2 text-gray-500 hover:text-gray-700"
                disabled={!phoneNumber}
              >
                <Delete size={24} />
              </button>
            </div>
          </div>
        )}

        {/* Call Controls */}
        {isCallActive && (
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <button
                onClick={toggleMute}
                className={`flex flex-col items-center p-4 rounded-xl transition-colors ${
                  isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                <span className="text-xs mt-1">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                onClick={() => setPhoneNumber('')}
                className="flex flex-col items-center p-4 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <span className="text-lg font-bold">#</span>
                <span className="text-xs mt-1">Keypad</span>
              </button>

              <button
                onClick={toggleSpeaker}
                className={`flex flex-col items-center p-4 rounded-xl transition-colors ${
                  isSpeakerOn ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
                <span className="text-xs mt-1">Speaker</span>
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 pt-0">
          {!isCallActive ? (
            <button
              onClick={handleCall}
              disabled={isDialing || !phoneNumber || deviceStatus !== 'ready'}
              className={`w-full py-4 rounded-full flex items-center justify-center space-x-2 transition-colors ${
                isDialing || !phoneNumber || deviceStatus !== 'ready'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Phone size={24} />
              <span className="font-semibold">
                {isDialing ? 'Dialing...' : deviceStatus !== 'ready' ? 'Connecting...' : 'Call'}
              </span>
            </button>
          ) : (
            <button
              onClick={handleEndCall}
              className="w-full py-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center space-x-2 transition-colors"
            >
              <PhoneOff size={24} />
              <span className="font-semibold">End Call</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dialpad
