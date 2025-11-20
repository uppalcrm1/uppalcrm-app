import React, { useState, useEffect, useRef } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Delete, X, User } from 'lucide-react'
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
  const timerRef = useRef(null)

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
    const cleanNumber = phoneNumber.replace(/\D/g, '')
    if (cleanNumber.length < 10) {
      toast.error('Please enter a valid phone number')
      return
    }

    setIsDialing(true)
    setCallStatus('Dialing...')

    try {
      // Format number with country code if not present
      const formattedNumber = cleanNumber.startsWith('1')
        ? `+${cleanNumber}`
        : `+1${cleanNumber}`

      const result = await twilioAPI.makeCall({
        to: formattedNumber
      })

      setIsCallActive(true)
      setCallStatus('Calling...')

      // Start call timer
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)

      toast.success('Call initiated')
    } catch (error) {
      console.error('Error making call:', error)
      toast.error(error.response?.data?.error || 'Failed to make call')
      setCallStatus('')
    } finally {
      setIsDialing(false)
    }
  }

  const handleEndCall = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    setIsCallActive(false)
    setCallStatus('Call ended')
    setCallDuration(0)

    setTimeout(() => {
      setCallStatus('')
    }, 2000)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    toast.success(isMuted ? 'Microphone unmuted' : 'Microphone muted')
  }

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn)
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

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
            <h3 className="text-lg font-semibold">Phone</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
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
              disabled={isDialing || !phoneNumber}
              className={`w-full py-4 rounded-full flex items-center justify-center space-x-2 transition-colors ${
                isDialing || !phoneNumber
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Phone size={24} />
              <span className="font-semibold">
                {isDialing ? 'Dialing...' : 'Call'}
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
