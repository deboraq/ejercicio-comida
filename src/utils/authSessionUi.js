const GUEST_MODE_KEY = 'fp-guest-mode'
const SESSION_LOST_KEY = 'fp-session-lost'
const SIGNOUT_VOLUNTARY_KEY = 'fp-signout-voluntary'

export function markGuestModeContinued() {
  try {
    sessionStorage.setItem(GUEST_MODE_KEY, '1')
    sessionStorage.removeItem(SESSION_LOST_KEY)
  } catch {
    /* ignore */
  }
}

export function clearGuestModeFlags() {
  try {
    sessionStorage.removeItem(GUEST_MODE_KEY)
    sessionStorage.removeItem(SESSION_LOST_KEY)
  } catch {
    /* ignore */
  }
}

export function isGuestModeContinued() {
  try {
    return sessionStorage.getItem(GUEST_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function markSessionLostUnexpectedly() {
  try {
    sessionStorage.setItem(SESSION_LOST_KEY, '1')
    sessionStorage.removeItem(GUEST_MODE_KEY)
  } catch {
    /* ignore */
  }
}

export function isSessionLostUnexpectedly() {
  try {
    return sessionStorage.getItem(SESSION_LOST_KEY) === '1'
  } catch {
    return false
  }
}

export function markSignOutVoluntary() {
  try {
    sessionStorage.setItem(SIGNOUT_VOLUNTARY_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function consumeSignOutVoluntary() {
  try {
    const v = sessionStorage.getItem(SIGNOUT_VOLUNTARY_KEY) === '1'
    sessionStorage.removeItem(SIGNOUT_VOLUNTARY_KEY)
    return v
  } catch {
    return false
  }
}
