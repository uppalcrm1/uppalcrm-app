import React from 'react'
import { AlertCircle, RefreshCw, X, Wifi, WifiOff } from 'lucide-react'

const ErrorMessage = ({
  error,
  onRetry,
  title = 'Something went wrong',
  dismissible = false,
  onDismiss,
  type = 'general'
}) => {
  const getErrorIcon = () => {
    switch (type) {
      case 'network':
        return WifiOff
      case 'validation':
        return AlertCircle
      case 'server':
        return AlertCircle
      default:
        return AlertCircle
    }
  }

  const getErrorMessage = () => {
    if (typeof error === 'string') {
      return error
    }

    if (error?.response?.data?.message) {
      return error.response.data.message
    }

    if (error?.message) {
      return error.message
    }

    switch (type) {
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection.'
      case 'validation':
        return 'Please check your input and try again.'
      case 'server':
        return 'The server encountered an error. Please try again later.'
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }

  const getErrorColor = () => {
    switch (type) {
      case 'network':
        return 'red'
      case 'validation':
        return 'yellow'
      case 'server':
        return 'red'
      default:
        return 'red'
    }
  }

  const Icon = getErrorIcon()
  const message = getErrorMessage()
  const color = getErrorColor()

  const colorClasses = {
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-400',
      title: 'text-red-800',
      text: 'text-red-700',
      button: 'bg-red-100 text-red-800 hover:bg-red-200'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      text: 'text-yellow-700',
      button: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    }
  }

  const colors = colorClasses[color]

  return (
    <div className={`rounded-md ${colors.bg} ${colors.border} border p-4`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${colors.icon}`} aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${colors.title}`}>
            {title}
          </h3>
          <div className={`mt-2 text-sm ${colors.text}`}>
            <p>{message}</p>

            {/* Error details for development */}
            {process.env.NODE_ENV === 'development' && error?.stack && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex items-center gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${colors.button} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600`}
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            )}

            {dismissible && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className={`text-sm font-medium ${colors.text} hover:underline focus:outline-none`}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>

        {/* Dismiss button */}
        {dismissible && onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onDismiss}
                className={`inline-flex rounded-md p-1.5 ${colors.text} hover:${colors.bg} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600`}
              >
                <span className="sr-only">Dismiss</span>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Preset error components for common scenarios
export const NetworkError = ({ onRetry, ...props }) => (
  <ErrorMessage
    type="network"
    title="Connection Error"
    onRetry={onRetry}
    {...props}
  />
)

export const ValidationError = ({ error, ...props }) => (
  <ErrorMessage
    type="validation"
    title="Validation Error"
    error={error}
    {...props}
  />
)

export const ServerError = ({ onRetry, ...props }) => (
  <ErrorMessage
    type="server"
    title="Server Error"
    onRetry={onRetry}
    {...props}
  />
)

export default ErrorMessage