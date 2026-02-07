import React from 'react'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

/**
 * FeatureGate Component - Hides features from organizations that don't have them enabled
 * If feature is disabled: returns null (completely hidden)
 * If feature is enabled: shows the wrapped component
 */
export const FeatureGate = ({ feature, children, fallback = null }) => {
  const { organization } = useAuth()

  // Check if feature is enabled for this org
  const isEnabled = organization?.[feature]

  if (!isEnabled) {
    // Completely hide - return nothing
    return fallback
  }

  return children
}

/**
 * FeatureGateWithError - Shows error page if someone tries to access directly
 */
export const FeatureGateWithError = ({ feature, children }) => {
  const { organization } = useAuth()
  const isEnabled = organization?.[feature]

  if (!isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-gray-900">Feature Not Available</h1>
          <p className="text-gray-600 mt-2">
            This feature is not available for your organization.
          </p>
        </div>
      </div>
    )
  }

  return children
}

export default FeatureGate
