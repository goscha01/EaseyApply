import { ERROR_MESSAGES } from '../config/constants.js';

/**
 * Comprehensive error handling utility for the extension
 */
export class ErrorHandler {
  static errorLog = [];
  
  /**
   * Handle errors with context and logging
   * @param {Error} error - The error object
   * @param {string} context - Where the error occurred
   * @param {Object} additionalData - Additional data for debugging
   */
  static async handleError(error, context, additionalData = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      additionalData
    };
    
    // Log error
    console.error(`Error in ${context}:`, errorInfo);
    this.errorLog.push(errorInfo);
    
    // Store error in storage for debugging
    await this.logError(errorInfo);
    
    // Return appropriate fallback action
    return this.getFallbackAction(context, error);
  }
  
  /**
   * Log error to storage
   * @param {Object} errorInfo - Error information
   */
  static async logError(errorInfo) {
    try {
      const existingErrors = await this.getStoredErrors();
      existingErrors.push(errorInfo);
      
      // Keep only last 50 errors
      if (existingErrors.length > 50) {
        existingErrors.splice(0, existingErrors.length - 50);
      }
      
      chrome.storage.local.set({ 
        errorLog: existingErrors 
      });
    } catch (storageError) {
      console.error('Failed to log error to storage:', storageError);
    }
  }
  
  /**
   * Get stored errors
   * @returns {Promise<Array>} Array of stored errors
   */
  static async getStoredErrors() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['errorLog'], (result) => {
        resolve(result.errorLog || []);
      });
    });
  }
  
  /**
   * Get appropriate fallback action based on context
   * @param {string} context - Error context
   * @param {Error} error - Error object
   * @returns {Object} Fallback action
   */
  static getFallbackAction(context, error) {
    const fallbackActions = {
      'job-application': {
        action: 'skip-job',
        message: ERROR_MESSAGES.APPLICATION_FAILED,
        retry: false
      },
      'network-request': {
        action: 'retry',
        message: ERROR_MESSAGES.NETWORK_ERROR,
        retry: true,
        maxRetries: 3
      },
      'form-filling': {
        action: 'skip-field',
        message: 'Failed to fill form field',
        retry: true,
        maxRetries: 2
      },
      'navigation': {
        action: 'retry',
        message: ERROR_MESSAGES.TIMEOUT_ERROR,
        retry: true,
        maxRetries: 2
      }
    };
    
    return fallbackActions[context] || {
      action: 'stop',
      message: 'An unexpected error occurred',
      retry: false
    };
  }
  
  /**
   * Create user-friendly error message
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @returns {string} User-friendly error message
   */
  static getUserFriendlyMessage(error, context) {
    const errorMessages = {
      'NetworkError': ERROR_MESSAGES.NETWORK_ERROR,
      'TimeoutError': ERROR_MESSAGES.TIMEOUT_ERROR,
      'PermissionError': ERROR_MESSAGES.PERMISSION_DENIED,
      'ValidationError': ERROR_MESSAGES.INVALID_INPUT
    };
    
    return errorMessages[error.name] || error.message || 'An unexpected error occurred';
  }
  
  /**
   * Clear error log
   */
  static clearErrorLog() {
    this.errorLog = [];
    chrome.storage.local.remove(['errorLog']);
  }
  
  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  static getErrorStats() {
    const stats = {
      totalErrors: this.errorLog.length,
      errorsByContext: {},
      recentErrors: this.errorLog.slice(-10)
    };
    
    this.errorLog.forEach(error => {
      const context = error.context;
      stats.errorsByContext[context] = (stats.errorsByContext[context] || 0) + 1;
    });
    
    return stats;
  }
}

/**
 * Retry utility for operations that might fail
 * @param {Function} operation - Operation to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the operation
 */
export async function retryOperation(operation, options = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    backoffMultiplier = 2,
    onRetry = null
  } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      if (onRetry) {
        onRetry(error, attempt, maxRetries);
      }
      
      // Exponential backoff
      const waitTime = delay * Math.pow(backoffMultiplier, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper for operations
 * @param {Function} operation - Operation to timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Result of the operation
 */
export function withTimeout(operation, timeoutMs = 10000) {
  return Promise.race([
    operation(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
} 