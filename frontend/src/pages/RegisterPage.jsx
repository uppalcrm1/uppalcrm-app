import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Building2, Mail, Lock, User, ArrowRight, Globe } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

const RegisterPage = () => {
  const { register: registerAuth, isLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
  } = useForm()

  const onSubmit = async (data) => {
    const organizationData = {
      name: data.organizationName,
      slug: data.organizationSlug,
      domain: data.domain || undefined,
    }

    const adminData = {
      email: data.email,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
    }

    const result = await registerAuth(organizationData, adminData)
    
    if (!result.success) {
      if (result.error.toLowerCase().includes('slug')) {
        setError('organizationSlug', { 
          type: 'manual', 
          message: 'Organization URL is already taken' 
        })
      } else if (result.error.toLowerCase().includes('email')) {
        setError('email', { 
          type: 'manual', 
          message: 'Email address is already in use' 
        })
      } else {
        setError('organizationName', { 
          type: 'manual', 
          message: result.error 
        })
      }
    }
  }

  // Auto-generate slug from organization name
  const organizationName = watch('organizationName')
  React.useEffect(() => {
    if (organizationName && !watch('organizationSlug')) {
      const slug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      document.getElementById('organizationSlug').value = slug
    }
  }, [organizationName, watch])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-2xl mb-4">
            <Building2 size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create your organization</h1>
          <p className="text-gray-600 mt-2">Set up your CRM workspace in minutes</p>
        </div>

        {/* Registration Form */}
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Organization Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Organization Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Organization Name */}
                <div className="md:col-span-2">
                  <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 mb-2">
                    Organization Name *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      {...register('organizationName', {
                        required: 'Organization name is required',
                        minLength: {
                          value: 2,
                          message: 'Organization name must be at least 2 characters'
                        }
                      })}
                      type="text"
                      placeholder="Your Company Inc"
                      className={`input pl-10 ${errors.organizationName ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.organizationName && (
                    <p className="mt-1 text-sm text-red-600">{errors.organizationName.message}</p>
                  )}
                </div>

                {/* Organization Slug */}
                <div>
                  <label htmlFor="organizationSlug" className="block text-sm font-medium text-gray-700 mb-2">
                    Organization URL *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      {...register('organizationSlug', {
                        required: 'Organization URL is required',
                        pattern: {
                          value: /^[a-z0-9-]+$/,
                          message: 'Only lowercase letters, numbers, and hyphens allowed'
                        },
                        minLength: {
                          value: 2,
                          message: 'URL must be at least 2 characters'
                        }
                      })}
                      id="organizationSlug"
                      type="text"
                      placeholder="your-company"
                      className={`input pl-10 ${errors.organizationSlug ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.organizationSlug && (
                    <p className="mt-1 text-sm text-red-600">{errors.organizationSlug.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">This will be your organization's unique identifier</p>
                </div>

                {/* Domain (Optional) */}
                <div>
                  <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Domain (Optional)
                  </label>
                  <input
                    {...register('domain', {
                      pattern: {
                        value: /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
                        message: 'Please enter a valid domain'
                      }
                    })}
                    type="text"
                    placeholder="crm.yourcompany.com"
                    className={`input ${errors.domain ? 'border-red-500' : ''}`}
                  />
                  {errors.domain && (
                    <p className="mt-1 text-sm text-red-600">{errors.domain.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Admin User Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin User Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      {...register('firstName', {
                        required: 'First name is required',
                        minLength: {
                          value: 2,
                          message: 'First name must be at least 2 characters'
                        }
                      })}
                      type="text"
                      placeholder="John"
                      className={`input pl-10 ${errors.firstName ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    {...register('lastName', {
                      required: 'Last name is required',
                      minLength: {
                        value: 2,
                        message: 'Last name must be at least 2 characters'
                      }
                    })}
                    type="text"
                    placeholder="Doe"
                    className={`input ${errors.lastName ? 'border-red-500' : ''}`}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="md:col-span-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
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
                      placeholder="john@yourcompany.com"
                      className={`input pl-10 ${errors.email ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                {/* Password */}
                <div className="md:col-span-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 8,
                          message: 'Password must be at least 8 characters'
                        },
                        pattern: {
                          value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                          message: 'Password must contain uppercase, lowercase, and number'
                        }
                      })}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
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
                  <p className="mt-1 text-xs text-gray-500">
                    Must contain at least 8 characters with uppercase, lowercase, and numbers
                  </p>
                </div>
              </div>
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
                  Create Organization
                  <ArrowRight size={16} className="ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage