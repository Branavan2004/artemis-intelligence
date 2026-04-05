import { FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { AuthResponse, getAuthErrorMessage, readAuthToken, saveAuthSession } from '../lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const redirectTo = typeof location.state?.from === 'string' ? location.state.from : '/chat'
  const existingToken = readAuthToken()

  if (existingToken) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post<AuthResponse>('/api/auth/login', {
        email,
        password,
      })

      saveAuthSession(data)
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, 'Login failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] items-center justify-center">
      <div className="card-plain w-full max-w-[440px] p-8">
        <div className="border-b border-[color:var(--border)] pb-6">
          <p className="text-sm font-medium tracking-[-0.02em] text-[color:var(--text)]">Artemis Intelligence</p>
        </div>

        <div className="pt-6">
          <p className="section-label">Log in</p>
          <h1 className="section-title mt-2">Welcome back</h1>
          <p className="mt-3 text-sm text-[color:var(--muted)]">Enter your email and password to continue.</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--text)]" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--text)]" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="input-field"
            />
          </div>

          <button type="submit" disabled={loading} className="button-primary w-full">
            {loading ? 'Signing in...' : 'Log in'}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-sm border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            {error}
          </div>
        )}

        <p className="mt-6 text-sm text-[color:var(--muted)]">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="button-link">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
