// Module-level state so ringtone can be started/stopped from anywhere
let ringtoneState = null // { interval, context }

/**
 * Play a looping phone ringtone using Web Audio API.
 * Two alternating tones (440Hz + 480Hz) — classic phone ring pattern.
 * Loops every 2 seconds until stopRingtone() is called.
 */
export function playRingtone() {
  stopRingtone() // Clear any existing ringtone first

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()

    function playRingCycle() {
      // First tone: 440Hz for 400ms
      const osc1 = audioContext.createOscillator()
      const gain1 = audioContext.createGain()
      osc1.connect(gain1)
      gain1.connect(audioContext.destination)
      osc1.frequency.value = 440
      gain1.gain.value = 0.3
      osc1.start()
      osc1.stop(audioContext.currentTime + 0.4)

      // Second tone: 480Hz from 500ms to 900ms
      const osc2 = audioContext.createOscillator()
      const gain2 = audioContext.createGain()
      osc2.connect(gain2)
      gain2.connect(audioContext.destination)
      osc2.frequency.value = 480
      gain2.gain.value = 0.3
      osc2.start(audioContext.currentTime + 0.5)
      osc2.stop(audioContext.currentTime + 0.9)
    }

    playRingCycle()
    const interval = setInterval(playRingCycle, 2000)

    ringtoneState = { interval, context: audioContext }
  } catch (e) {
    console.error('Could not play ringtone:', e)
  }
}

/**
 * Stop the looping ringtone and release audio resources.
 */
export function stopRingtone() {
  if (ringtoneState) {
    clearInterval(ringtoneState.interval)
    try {
      ringtoneState.context.close()
    } catch (e) {
      // Context may already be closed
    }
    ringtoneState = null
  }
}

/**
 * Play a short two-tone notification beep for new SMS/WhatsApp messages.
 * D5 (587Hz) followed by G5 (784Hz). Auto-closes audio context when done.
 */
export function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()

    // First beep: D5 note
    const osc1 = audioContext.createOscillator()
    const gain1 = audioContext.createGain()
    osc1.connect(gain1)
    gain1.connect(audioContext.destination)
    osc1.frequency.value = 587
    gain1.gain.value = 0.3
    osc1.start()
    osc1.stop(audioContext.currentTime + 0.15)

    // Second beep: G5 note
    const osc2 = audioContext.createOscillator()
    const gain2 = audioContext.createGain()
    osc2.connect(gain2)
    gain2.connect(audioContext.destination)
    osc2.frequency.value = 784
    gain2.gain.value = 0.3
    osc2.start(audioContext.currentTime + 0.2)
    osc2.stop(audioContext.currentTime + 0.35)

    setTimeout(() => audioContext.close(), 1000)
  } catch (e) {
    console.error('Could not play notification sound:', e)
  }
}
