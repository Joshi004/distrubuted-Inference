'use strict'

// Client Helper - Contains core client business logic
// These functions are bound to the main ClientWorker instance

const logger = require('../shared-logger.js')

class ClientHelper {
  
  // Authorized topic request wrapper - automatically adds auth key for protected methods
  static async authorizedTopicRequest(workerInstance, topic, method, data) {
    const exemptMethods = ['register', 'login']
    
    // All requests now use the new format: { data: {...}, meta?: { key: "..." } }
    const requestPayload = {
      data: data
    }
    
    // Only add auth key for non-exempt methods (and only if we have a session key)
    if (!exemptMethods.includes(method) && workerInstance.sessionKey) {
      requestPayload.meta = { key: workerInstance.sessionKey }
      logger.jwt('ClientWorker', 'RPC-OUT', 'Including Auth Key', {
        method,
        tokenPreview: workerInstance.sessionKey.substring(0, 20) + '...'
      })
    } else if (!exemptMethods.includes(method)) {
      logger.warn('ClientWorker', 'RPC-OUT', `No session key available for ${method} request`, {
        sessionKey: workerInstance.sessionKey || 'null'
      })
    } else {
      logger.debug('ClientWorker', 'RPC-OUT', `${method} is exempt from auth key requirement`, null)
    }
    
    // Use robust topic request that handles stale DHT connections internally
    const sessionId = Math.random().toString(36).substr(2, 9)
    
    // Log the start of the request
    logger.info('ClientWorker', sessionId, `Starting topic request: ${topic}.${method}`, {
      topic: topic,
      method: method,
      hasAuthKey: !!requestPayload.meta?.key,
      payloadSize: JSON.stringify(requestPayload).length
    })
    
    try {
      const startTime = Date.now()
      const result = await workerInstance.net_default.jTopicRequestRobust(
        topic,
        method,
        requestPayload,
        {}, // options
        3,  // maxRetries
        200 // baseDelay in ms for client requests
      )
      const duration = Date.now() - startTime
      
      // Log successful request
      logger.info('ClientWorker', sessionId, `Topic request succeeded`, {
        topic: topic,
        method: method,
        duration: `${duration}ms`,
        responseSize: JSON.stringify(result).length
      })
      
      return result
    } catch (error) {
      // Log final failure
      logger.error('ClientWorker', sessionId, `Topic request failed after retries`, {
        topic: topic,
        method: method,
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }
  

  
  // Sleep utility function
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  // Helper method to detect stale DHT announcement errors
  static isStaleAnnouncementError(error) {
    const staleIndicators = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'connection timeout',
      'no route to host'
    ]
    
    return staleIndicators.some(indicator => 
      error.message.toLowerCase().includes(indicator.toLowerCase())
    )
  }
  
  // Method for sending AI prompts to the gateway
  static async sendRequest(workerInstance, inputPrompt) {
    const requestId = Math.random().toString(36).substr(2, 9)
    
    logger.info('ClientWorker', requestId, 'Sending prompt to gateway', {
      promptLength: inputPrompt.length,
      promptPreview: inputPrompt.length > 100 ? inputPrompt.substring(0, 100) + '...' : inputPrompt
    })
    
    try {
      const result = await ClientHelper.authorizedTopicRequest(
        workerInstance,
        'gateway',
        'processPrompt',
        { prompt: inputPrompt }
      )
      
      if (result.response) {
        logger.info('ClientWorker', requestId, 'AI response received successfully', {
          responseLength: result.response.length
        })
      } else if (result.error) {
        logger.warn('ClientWorker', requestId, 'Gateway returned error response', {
          error: result.message
        })
      }
      
      return result
      
    } catch (error) {
      if (error.message.includes('ERR_TOPIC_LOOKUP_EMPTY')) {
        logger.error('ClientWorker', requestId, 'Topic lookup empty - gateway worker may not be running', {
          method: 'processPrompt',
          error: error.message
        })
      } else if (error.message.includes('UNKNOWN_METHOD')) {
        logger.error('ClientWorker', requestId, 'Unknown method - gateway method registration may have failed', {
          method: 'processPrompt',
          error: error.message
        })
      } else if (error.message.includes('CHANNEL_CLOSED')) {
        logger.error('ClientWorker', requestId, 'Channel closed - connection lost during request', {
          method: 'processPrompt',
          error: error.message,
          hint: 'Network issues, service restarts, or stale DHT announcements'
        })
      } else if (ClientHelper.isStaleAnnouncementError(error)) {
        logger.error('ClientWorker', requestId, 'Possible stale DHT announcement detected', {
          method: 'processPrompt',
          error: error.message,
          hint: 'Service may have been announced but is no longer reachable'
        })
      } else {
        logger.error('ClientWorker', requestId, 'Request failed with unexpected error', {
          method: 'processPrompt',
          error: error.message,
          stack: error.stack
        })
      }
      
      throw error
    }
  }
  
  // Method for user registration
  static async registerUser(workerInstance, email, password) {
    const requestId = Math.random().toString(36).substr(2, 9)
    
    logger.info('ClientWorker', requestId, 'Starting user registration', {
      email: email
    })
    
    try {
      const result = await ClientHelper.authorizedTopicRequest(
        workerInstance,
        'gateway',
        'register',
        { email, password }
      )
      
      if (result.success) {
        logger.info('ClientWorker', requestId, 'User registration successful', {
          email: result.email,
          status: result.status
        })
      } else {
        logger.warn('ClientWorker', requestId, 'User registration failed', {
          email: email,
          message: result.message
        })
      }
      
      return result
      
    } catch (error) {
      logger.error('ClientWorker', requestId, 'User registration error', {
        email: email,
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }
  
  // Method for user login
  static async loginUser(workerInstance, email, password) {
    const requestId = Math.random().toString(36).substr(2, 9)
    
    logger.info('ClientWorker', requestId, 'Starting user login', {
      email: email
    })
    
    try {
      const result = await ClientHelper.authorizedTopicRequest(
        workerInstance,
        'gateway',
        'login',
        { email, password }
      )
      
      // Store session key if login successful
      if (result.success && result.key) {
        workerInstance.sessionKey = result.key
        logger.jwt('ClientWorker', requestId, 'Session Key Stored', {
          email,
          tokenPreview: result.key.substring(0, 20) + '...',
          tokenLength: result.key.length
        })
        logger.info('ClientWorker', requestId, 'User login successful', {
          email: result.email,
          status: result.status
        })
      } else {
        logger.warn('ClientWorker', requestId, 'User login failed', {
          email: email,
          message: result.message
        })
      }
      
      return result
      
    } catch (error) {
      logger.error('ClientWorker', requestId, 'User login error', {
        email: email,
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }
  
  // Method for user logout
  static logout(workerInstance) {
    const requestId = Math.random().toString(36).substr(2, 9)
    
    logger.info('ClientWorker', requestId, 'User logout initiated', null)
    
    if (workerInstance.sessionKey) {
      workerInstance.sessionKey = null
      logger.info('ClientWorker', requestId, 'Session key cleared - logout successful', null)
      return {
        success: true,
        message: 'Logged out successfully'
      }
    } else {
      logger.warn('ClientWorker', requestId, 'Logout attempted with no active session', null)
      return {
        success: false,
        message: 'No active session to logout'
      }
    }
  }
  
  // Method to get current API token
  static getApiToken(workerInstance) {
    const requestId = Math.random().toString(36).substr(2, 9)
    
    logger.debug('ClientWorker', requestId, 'API token retrieval requested', null)
    
    if (workerInstance.sessionKey) {
      logger.info('ClientWorker', requestId, 'API token retrieved successfully', {
        tokenLength: workerInstance.sessionKey.length
      })
      return {
        success: true,
        token: workerInstance.sessionKey,
        message: 'API token retrieved successfully'
      }
    } else {
      logger.warn('ClientWorker', requestId, 'API token request failed - no active session', null)
      return {
        success: false,
        message: 'No active session - please login first'
      }
    }
  }
  
  // Method for session verification
  static async verifySession(workerInstance) {
    const requestId = Math.random().toString(36).substr(2, 9)
    
    logger.info('ClientWorker', requestId, 'Session verification initiated', null)
    
    try {
      // Check if we have a session key
      if (!workerInstance.sessionKey) {
        logger.warn('ClientWorker', requestId, 'Session verification failed - no session key found', null)
        return {
          success: false,
          valid: false,
          message: 'No active session'
        }
      }
      
      const result = await ClientHelper.authorizedTopicRequest(
        workerInstance,
        'gateway',
        'verifySession',
        {}
      )
      
      logger.info('ClientWorker', requestId, 'Session verification completed', {
        valid: result.valid,
        message: result.message
      })
      return result
      
    } catch (error) {
      logger.error('ClientWorker', requestId, 'Session verification error', {
        error: error.message,
        stack: error.stack
      })
      return {
        success: false,
        valid: false,
        message: 'Session verification failed'
      }
    }
  }

  // Method to detect stale DHT announcement errors
  static isStaleAnnouncementError(error) {
    if (!error || typeof error.message !== 'string') {
      return false
    }
    
    // Check for patterns that indicate stale DHT announcements
    const stalePatterns = [
      'connection reset',
      'connection refused',
      'timeout',
      'no route to host',
      'network unreachable'
    ]
    
    const errorMessage = error.message.toLowerCase()
    return stalePatterns.some(pattern => errorMessage.includes(pattern))
  }
}

module.exports = ClientHelper 