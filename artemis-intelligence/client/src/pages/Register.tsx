import { FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { AuthResponse, getAuthErrorMessage, readAuthToken, saveAuthSession } from '../lib/auth'

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
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
      const { data } = await api.post<AuthResponse>('/api/auth/register', {
        name,
        email,
        password,
      })

      saveAuthSession(data)
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, 'Registration failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-3xl border border-gray-800 bg-space-900 p-8 shadow-2xl shadow-black/20">
        <div className="mb-8">
          <div className="mb-2 text-sm font-mono uppercase tracking-[0.3em] text-artemis-green">
            Mission Onboarding
          </div>
          <h1 className="font-display text-4xl font-black text-white">Create Account</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            Set up your profile so the app can save articles, remember your chat history, and personalize the experience.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300" htmlFor="register-name">
              Name
            </label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Reid Wiseman"
              autoComplete="name"
              required
              className="w-full rounded-xl border border-gray-700 bg-space-950 px-4 py-3 text-white placeholder:text-gray-500 focus:border-artemis-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300" htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="crew@artemis.ai"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-gray-700 bg-space-950 px-4 py-3 text-white placeholder:text-gray-500 focus:border-artemis-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300" htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Choose a strong password"
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded-xl border border-gray-700 bg-space-950 px-4 py-3 text-white placeholder:text-gray-500 focus:border-artemis-blue focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-artemis-green px-4 py-3 font-semibold text-space-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-artemis-blue hover:text-sky-400">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
