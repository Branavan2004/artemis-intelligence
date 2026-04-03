import axios from 'axios'

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export const AUTH_TOKEN_KEY = 'artemis_token'
export const AUTH_USER_KEY = 'artemis_user'
export const AUTH_STATE_CHANGE_EVENT = 'artemis-auth-state-change'

function notifyAuthStateChanged() {
  window.dispatchEvent(new Event(AUTH_STATE_CHANGE_EVENT))
}

export function saveAuthSession(session: AuthResponse) {
  localStorage.setItem(AUTH_TOKEN_KEY, session.token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user))
  notifyAuthStateChanged()
}

export function readAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function readAuthUser(): AuthUser | null {
  const storedUser = localStorage.getItem(AUTH_USER_KEY)

  if (!storedUser) return null

  try {
    return JSON.parse(storedUser) as AuthUser
  } catch {
    return null
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
  notifyAuthStateChanged()
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return fallback
  }

  const apiError = error.response?.data?.error

  if (typeof apiError === 'string') {
    return apiError
  }

  if (Array.isArray(apiError)) {
    const messages = apiError
      .map((issue) => issue?.message)
      .filter((message): message is string => Boolean(message))

    if (messages.length > 0) {
      return messages.join(', ')
    }
  }

  return fallback
}
