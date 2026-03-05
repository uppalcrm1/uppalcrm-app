// Shared AudioContext — reused across all sounds to avoid autoplay blocking
let sharedAudioContext = null
let ringtoneInterval = null // interval handle only (context is shared, not per-ringtone)

/**
 * Get (or create) the shared AudioContext.
 * Resumes it if suspended (browser autoplay policy).
 */
function getAudioContext() {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume()
  }
  return sharedAudioContext
}

/**
 * Prime the AudioContext on first user interaction so it's ready
 * before any call or SMS arrives.
 */
function initAudioOnUserGesture() {
  getAudioContext()
  document.removeEventListener('click', initAudioOnUserGesture)
  document.removeEventListener('keydown', initAudioOnUserGesture)
}
document.addEventListener('click', initAudioOnUserGesture, { once: true })
document.addEventListener('keydown', initAudioOnUserGesture, { once: true })

/**
 * Play a looping phone ringtone using the shared AudioContext.
 * Two alternating tones (440Hz + 480Hz) — classic phone ring pattern.
 * Loops every 2 seconds until stopRingtone() is called.
 */
export function playRingtone() {
  stopRingtone() // Clear any existing ringtone first

  try {
    const ctx = getAudioContext()

    function playRingCycle() {
      // First tone: 440Hz for 400ms
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.frequency.value = 440
      gain1.gain.value = 0.3
      osc1.start()
      osc1.stop(ctx.currentTime + 0.4)

      // Second tone: 480Hz from 500ms to 900ms
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.value = 480
      gain2.gain.value = 0.3
      osc2.start(ctx.currentTime + 0.5)
      osc2.stop(ctx.currentTime + 0.9)
    }

    playRingCycle()
    ringtoneInterval = setInterval(playRingCycle, 2000)
  } catch (e) {
    console.error('Could not play ringtone:', e)
  }
}

/**
 * Stop the looping ringtone.
 * Does NOT close the shared AudioContext — it stays alive for reuse.
 */
export function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval)
    ringtoneInterval = null
  }
}

/**
 * Play a short two-tone notification beep for new SMS/WhatsApp messages.
 * D5 (587Hz) followed by G5 (784Hz). Uses the shared AudioContext.
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext()

    // First beep: D5 note
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.value = 587
    gain1.gain.value = 0.3
    osc1.start()
    osc1.stop(ctx.currentTime + 0.15)

    // Second beep: G5 note
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.value = 784
    gain2.gain.value = 0.3
    osc2.start(ctx.currentTime + 0.2)
    osc2.stop(ctx.currentTime + 0.35)
  } catch (e) {
    console.error('Could not play notification sound:', e)
  }
}
