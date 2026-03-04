// Module-level state for tab title flashing
let titleInterval = null
let originalTitle = null
let focusListener = null

/**
 * Request browser notification permission.
 * Returns true if granted, false if denied or unsupported.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/**
 * Show a browser (OS-level) notification.
 * Silently no-ops if permission is not granted.
 *
 * @param {string} title - Notification title
 * @param {object} options - Notification options (body, tag, requireInteraction, etc.)
 * @returns {Notification|null}
 */
export function showBrowserNotification(title, options = {}) {
  if (!('Notification' in window)) return null
  if (Notification.permission !== 'granted') return null

  const notification = new Notification(title, {
    icon: '/logo192.png',
    badge: '/logo192.png',
    requireInteraction: false,
    ...options
  })

  // Click to focus the CRM tab
  notification.onclick = () => {
    window.focus()
    notification.close()
  }

  return notification
}

/**
 * Flash the browser tab title to alert users in other tabs.
 * Automatically stops flashing when the user focuses the tab.
 *
 * @param {string} message - The alert message to flash (e.g. '📞 Incoming Call!')
 */
export function flashTabTitle(message) {
  stopFlashTabTitle() // Clear any existing flash first

  originalTitle = document.title

  titleInterval = setInterval(() => {
    document.title = document.title === originalTitle ? message : originalTitle
  }, 1000)

  // Auto-stop when user focuses the tab
  focusListener = () => stopFlashTabTitle()
  window.addEventListener('focus', focusListener, { once: true })
}

/**
 * Stop flashing the tab title and restore to original.
 */
export function stopFlashTabTitle() {
  if (titleInterval) {
    clearInterval(titleInterval)
    titleInterval = null
  }

  if (focusListener) {
    window.removeEventListener('focus', focusListener)
    focusListener = null
  }

  if (originalTitle !== null) {
    document.title = originalTitle
    originalTitle = null
  }
}
