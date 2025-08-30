import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Building2, Mail, Lock, ArrowRight } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

const LoginPage = () => {
  const { login, isLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm()

  const onSubmit = async (data) => {
    const result = await login(data.email, data.password, data.organizationSlug)
    
    if (!result.success) {
      // Set form errors based on the error message
      if (result.error.toLowerCase().includes('organization')) {
        setError('organizationSlug', { 
          type: 'manual', 
          message: 'Organization not found' 
        })
      } else if (result.error.toLowerCase().includes('password')) {
        setError('password', { 
          type: 'manual', 
          message: 'Invalid email or password' 
        })
      } else {
        setError('email', { 
          type: 'manual', 
          message: result.error 
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-2xl mb-4">
            <Building2 size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-600 mt-2">Sign in to your CRM dashboard</p>
        </div>

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Organization Slug */}
            <div>
              <label htmlFor="organizationSlug" className="block text-sm font-medium text-gray-700 mb-2">
                Organization
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  {...register('organizationSlug', {
                    required: 'Organization is required',
                    pattern: {
                      value: /^[a-z0-9-]+$/,
                      message: 'Only lowercase letters, numbers, and hyphens allowed'
                    }
                  })}
                  type="text"
                  placeholder="your-organization"
                  className={`input pl-10 ${errors.organizationSlug ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.organizationSlug && (
                <p className="mt-1 text-sm text-red-600">{errors.organizationSlug.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email address'
                    }
                  })}
                  type="email"
                  placeholder="you@company.com"
                  className={`input pl-10 ${errors.email ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className={`input pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-lg w-full"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} className="ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an organization?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                Create one here
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Demo Credentials</h3>
          <div className="text-xs text-blue-800 space-y-1">
            <p><strong>Organization:</strong> testcompany</p>
            <p><strong>Email:</strong> admin@testcompany.com</p>
            <p><strong>Password:</strong> SecurePassword123!</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage