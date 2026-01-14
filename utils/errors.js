/**
 * Custom Error Classes
 * Provides standardized error handling across the application
 */

/**
 * Application Error
 * Base error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Mark as operational error (not programming error)
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error
 * For input validation failures
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication Error
 * For authentication failures
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error
 * For permission/authorization failures
 */
class AuthorizationError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not Found Error
 * For resource not found errors
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict Error
 * For resource conflict errors (e.g., duplicate records)
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Database Error
 * For database operation errors
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, details);
    this.name = 'DatabaseError';
  }
}

/**
 * External Service Error
 * For errors from external services/APIs
 */
class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error', details = null) {
    super(`${service}: ${message}`, 503, details);
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError
};
