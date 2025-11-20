import React, { useEffect, useRef } from 'react'
import { Phone, PhoneOff, User } from 'lucide-react'

const IncomingCallNotification = ({
  callerNumber,
  callerName,
  onAccept,
  onDecline
}) => {
  const audioRef = useRef(null)

  // Play ringtone
  useEffect(() => {
    // Create a simple ringtone using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    let oscillator = null
    let gainNode = null
    let ringInterval = null

    const playRing = () => {
      oscillator = audioContext.createOscillator()
      gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 440
      oscillator.type = 'sine'
      gainNode.gain.value = 0.3

      oscillator.start()

      setTimeout(() => {
        if (oscillator) {
          oscillator.stop()
        }
      }, 500)
    }

    // Ring pattern: ring for 500ms, pause for 500ms
    playRing()
    ringInterval = setInterval(playRing, 1000)

    return () => {
      if (ringInterval) clearInterval(ringInterval)
      if (oscillator) {
        try {
          oscillator.stop()
        } catch (e) {}
      }
      audioContext.close()
    }
  }, [])

  // Format phone number for display
  const formatPhoneNumber = (number) => {
    if (!number) return 'Unknown'
    const cleaned = number.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return number
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-pulse-subtle">
        {/* Caller Info */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-8 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <User size={40} />
          </div>
          <h3 className="text-xl font-semibold mb-1">
            {callerName || 'Unknown Caller'}
          </h3>
          <p className="text-white/90 text-lg">
            {formatPhoneNumber(callerNumber)}
          </p>
          <p className="text-white/70 text-sm mt-2">Incoming Call...</p>
        </div>

        {/* Action Buttons */}
        <div className="p-6 flex justify-center space-x-8">
          {/* Decline Button */}
          <button
            onClick={onDecline}
            className="flex flex-col items-center group"
          >
            <div className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-lg group-hover:scale-105 transform">
              <PhoneOff size={28} className="text-white" />
            </div>
            <span className="text-sm text-gray-600 mt-2">Decline</span>
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="flex flex-col items-center group"
          >
            <div className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors shadow-lg group-hover:scale-105 transform animate-pulse">
              <Phone size={28} className="text-white" />
            </div>
            <span className="text-sm text-gray-600 mt-2">Accept</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-subtle {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default IncomingCallNotification
