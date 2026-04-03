import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { readAuthToken } from '../lib/auth'

interface RequireAuthProps {
  children: ReactNode
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation()
  const token = readAuthToken()

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
