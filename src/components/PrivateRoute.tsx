import React from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from '../store'

interface Props {
  element: React.ReactElement
  requireAdmin?: boolean
}

const PrivateRoute: React.FC<Props> = ({ element, requireAdmin }) => {
  const { isAuthenticated, user } = useSelector((s: RootState) => s.auth)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (requireAdmin && !user?.is_admin) return <Navigate to="/dashboard" replace />
  return element
}

export default PrivateRoute
