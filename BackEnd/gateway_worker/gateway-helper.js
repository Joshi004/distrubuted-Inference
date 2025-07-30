'use strict'

const jwt = require('jsonwebtoken')
const RateLimiter = require('./rate-limiter.js')
const logger = require('../shared-logger.js')

// Gateway Helper - Contains core gateway business logic
// These functions are bound to the main GatewayWorker instance

class GatewayHelper {
  
  // Helper method to extract data and auth info from request
  static extractRequestData(requestData) {
    // Enforce new format: { data: {...}, meta: { key: "..." } }
    if (!requestData || !requestData.data || typeof requestData.data !== 'object') {
      throw new Error('Invalid request format: expected { data: {...}, meta: { key: "..." } }')
    }
    
    return {
      actualData: requestData.data,
      authKey: requestData.meta?.key || null
    }
  }

  // Helper method to validate authentication for protected methods
  static async validateAuthKey(authKey, methodName, requestId) {
    const exemptMethods = ['register', 'login']
    
    // Skip validation for authentication methods
    if (exemptMethods.includes(methodName)) {
      logger.debug('GatewayWorker', requestId, 'Auth validation skipped for exempt method', {
        method: methodName,
        exempt: true
      })
      return { isValid: true, skipAuth: true }
    }
    
    // Check if auth key is present for protected methods
    if (!authKey) {
      logger.warn('GatewayWorker', requestId, 'No auth token found for protected method', {
        method: methodName,
        authRequired: true
      })
      return { 
        isValid: false, 
        skipAuth: false,
        error: {
          success: false,
          status: 401,
          message: 'Unauthorized: Invalid or expired token',
          method: methodName
        }
      }
    }
    
    // Verify JWT token
    try {
      const jwtSecret = process.env.JWT_SECRET || 'distributed-ai-secure-secret-key-2025'
      
      // Enhanced debugging for JWT verification
      logger.debug('GatewayWorker', requestId, 'JWT Verification Debug', {
        jwtSecretEnvVar: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
        secretPreview: jwtSecret.substring(0, 10) + '...',
        tokenPreview: authKey.substring(0, 20) + '...',
        tokenLength: authKey.length,
        method: methodName
      })
      
      const decoded = jwt.verify(authKey, jwtSecret)
      
      logger.jwt('GatewayWorker', requestId, 'Token Verified', {
        method: methodName,
        email: decoded.email,
        role: decoded.role,
        secretPreview: jwtSecret.substring(0, 10) + '...',
        tokenPreview: authKey.substring(0, 20) + '...'
      })
      
      return { isValid: true, skipAuth: false, decoded: decoded }
    } catch (error) {
      logger.jwtError('GatewayWorker', requestId, 'Token Verification Failed', {
        method: methodName,
        error: error.message,
        tokenPreview: authKey ? authKey.substring(0, 20) + '...' : 'null'
      })
      
      return { 
        isValid: false, 
        skipAuth: false,
        error: {
          success: false,
          status: 401,
          message: 'Unauthorized: Invalid or expired token',
          method: methodName
        }
      }
    }
  }
  
  // RPC method called by clients for AI processing
  static async processPrompt(workerInstance, data) {
    const requestId = Math.random().toString(36).substr(2, 9)
    logger.info('GatewayWorker', requestId, 'Processing AI prompt request', {
      method: 'processPrompt'
    })
    
    try {
      // Extract actual data and auth info
      const { actualData, authKey } = GatewayHelper.extractRequestData(data)
      
      // Validate authentication for protected methods
      const authValidation = await GatewayHelper.validateAuthKey(authKey, 'processPrompt', requestId)
      if (!authValidation.isValid) {
        // Log authentication failure
        logger.prompt('GatewayWorker', requestId, 'AUTH_FAILED', {
          error: 'Authentication failed',
          method: 'processPrompt'
        })
        
        return authValidation.error
      }
      
      // Log authenticated request received at gateway
      logger.prompt('GatewayWorker', requestId, 'PROCESSING_START', {
        user: authValidation.decoded?.email || 'anonymous',
        prompt: actualData.prompt ? (actualData.prompt.length > 200 ? actualData.prompt.substring(0, 200) + '...' : actualData.prompt) : 'N/A',
        promptLength: actualData.prompt ? actualData.prompt.length : 0
      })

      // Apply per-user rate limiting
      let rateLimitInfo = null
      if (!authValidation.skipAuth && authValidation.decoded?.email) {
        const rlResult = await RateLimiter.checkRateLimit(workerInstance, authValidation.decoded.email)
        if (!rlResult.allowed) {
          logger.warn('GatewayWorker', requestId, 'Rate limit exceeded', {
            user: authValidation.decoded.email,
            method: 'processPrompt'
          })
          // Remove internal flag before sending to client
          const { allowed, ...clientError } = rlResult
          return clientError
        }
        // Store rate limit info for successful response
        rateLimitInfo = rlResult.rateLimitInfo
      }
      
      // Validate input data
      if (!actualData || typeof actualData.prompt !== 'string') {
        logger.error('GatewayWorker', requestId, 'Invalid input data for processPrompt', {
          method: 'processPrompt',
          hasActualData: !!actualData,
          promptType: typeof actualData?.prompt
        })
        throw new Error('Invalid input: expected { prompt: string }')
      }
      
      logger.debug('GatewayWorker', requestId, 'Forwarding request to processor', {
        promptLength: actualData.prompt.length
      })
      
      // Log processor connection attempt with network diagnostics
      logger.info('GatewayWorker', requestId, 'Attempting processor connection', {
        networkState: {
          networkFacilityReady: !!workerInstance.net_default,
          rpcClientReady: !!workerInstance.net_default?.rpc,
          lookupServiceReady: !!workerInstance.net_default?.lookup,
          dhtReady: !!workerInstance.net_default?.dht
        },
        targetTopic: 'processor',
        targetMethod: 'processRequest',
        promptLength: actualData.prompt ? actualData.prompt.length : 0
      })
      
      // Forward to processor using robust method to handle stale DHT connections
      const processorStartTime = Date.now()
      const result = await workerInstance.net_default.jTopicRequestRobust(
        'processor',
        'processRequest',
        actualData,
        {}, // options
        3,  // maxRetries
        100 // baseDelay in ms
      )
      const processorDuration = Date.now() - processorStartTime
      
      // Log successful processor response
      logger.info('GatewayWorker', requestId, 'Processor connection successful', {
        processingDuration: `${processorDuration}ms`,
        responseLength: result.response ? result.response.length : 0,
        responseType: typeof result.response,
        hasError: !!result.error
      })
      
      // Add rate limit information to the response
      if (rateLimitInfo) {
        result.rateLimitInfo = rateLimitInfo
      }
      
      // Log successful processing completion
      logger.prompt('GatewayWorker', requestId, 'PROCESSING_SUCCESS', {
        user: authValidation.decoded?.email || 'anonymous',
        responseLength: result.response ? result.response.length : 0,
        responsePreview: result.response ? (result.response.length > 200 ? result.response.substring(0, 200) + '...' : result.response) : 'N/A',
        rateLimitInfo: rateLimitInfo || null
      })
      
      return result
      
    } catch (error) {
      // Enhanced error logging with network state diagnostics
      logger.error('GatewayWorker', requestId, 'Error processing prompt request', {
        method: 'processPrompt',
        error: error.message,
        stack: error.stack,
        hasChannelClosed: error.message.includes('CHANNEL_CLOSED'),
        hasTopicLookupEmpty: error.message.includes('ERR_TOPIC_LOOKUP_EMPTY'),
        networkDiagnostics: {
          networkFacilityReady: !!workerInstance.net_default,
          rpcClientReady: !!workerInstance.net_default?.rpc,
          lookupServiceReady: !!workerInstance.net_default?.lookup,
          dhtReady: !!workerInstance.net_default?.dht,
          rpcServerReady: !!workerInstance.net_default?.rpcServer
        },
        targetService: 'processor',
        errorCategory: this.categorizeGatewayError(error)
      })
      
      // Log processing failure
      logger.prompt('GatewayWorker', requestId, 'PROCESSING_ERROR', {
        error: error.message,
        errorType: error.message.includes('CHANNEL_CLOSED') ? 'CHANNEL_CLOSED' : 'UNKNOWN'
      })
      
      // Return error in a structured format
      return {
        error: true,
        message: error.message,
        requestId: requestId
      }
    }
  }
  
  // Helper method to categorize gateway connection errors
  static categorizeGatewayError(error) {
    if (!error || !error.message) return 'UNKNOWN'
    
    if (error.message.includes('CHANNEL_CLOSED')) return 'PROCESSOR_CONNECTION_LOST'
    if (error.message.includes('ERR_TOPIC_LOOKUP_EMPTY')) return 'PROCESSOR_NOT_FOUND'
    if (error.message.includes('ETIMEDOUT')) return 'PROCESSOR_TIMEOUT'
    if (error.message.includes('ECONNREFUSED')) return 'PROCESSOR_REFUSED'
    if (error.message.includes('Invalid request format')) return 'INVALID_REQUEST_FORMAT'
    if (error.message.includes('Unauthorized')) return 'AUTH_FAILED'
    
    return 'UNKNOWN_PROCESSOR_ERROR'
  }
  
  // RPC method for user registration
  static async register(workerInstance, data) {
    const requestId = Math.random().toString(36).substr(2, 9)
    logger.info('GatewayWorker', requestId, 'Processing registration request', {
      method: 'register'
    })
    
    try {
      // Extract actual data and auth info
      const { actualData, authKey } = GatewayHelper.extractRequestData(data)
      
      // Validate authentication (register is exempt)
      const authValidation = await GatewayHelper.validateAuthKey(authKey, 'register', requestId)
      // Note: Register is always exempt, so this will always pass but maintains consistency
      
      logger.debug('GatewayWorker', requestId, 'Forwarding registration to auth worker', {
        method: 'register'
      })
      
      // Forward to auth worker using robust method to handle stale DHT connections
      const result = await workerInstance.net_default.jTopicRequestRobust(
        'auth',
        'register',
        actualData,
        {}, // options
        3,  // maxRetries
        100 // baseDelay in ms
      )
      
      logger.info('GatewayWorker', requestId, 'Registration request completed', {
        method: 'register',
        success: !!result.success
      })
      
      return result
      
    } catch (error) {
      
      // Log to error.log with full context
      logger.error('GatewayWorker', requestId, 'Error processing register request', {
        method: 'register',
        error: error.message,
        stack: error.stack,
        hasChannelClosed: error.message.includes('CHANNEL_CLOSED')
      })
      
      // Return error in a structured format
      return {
        success: false,
        status: 500,
        message: error.message,
        requestId: requestId
      }
    }
  }
  
  // RPC method for user login
  static async login(workerInstance, data) {
    const requestId = Math.random().toString(36).substr(2, 9)
    logger.info('GatewayWorker', requestId, 'Processing login request', {
      method: 'login'
    })
    
    try {
      // Extract actual data and auth info
      const { actualData, authKey } = GatewayHelper.extractRequestData(data)
      
      // Validate authentication (login is exempt)
      const authValidation = await GatewayHelper.validateAuthKey(authKey, 'login', requestId)
      // Note: Login is always exempt, so this will always pass but maintains consistency
      
      logger.debug('GatewayWorker', requestId, 'Forwarding login to auth worker', {
        method: 'login'
      })
      
      // Forward to auth worker using robust method to handle stale DHT connections
      const result = await workerInstance.net_default.jTopicRequestRobust(
        'auth',
        'login',
        actualData,
        {}, // options
        3,  // maxRetries
        100 // baseDelay in ms
      )
      
      logger.info('GatewayWorker', requestId, 'Login request completed', {
        method: 'login',
        success: !!result.success
      })
      
      // Add rate limit information for successful login
      if (result.success && result.email) {
        const rateLimitStatus = await RateLimiter.getRateLimitStatus(workerInstance, result.email)
        if (rateLimitStatus) {
          result.rateLimitInfo = rateLimitStatus
        }
      }
      
      return result
      
    } catch (error) {
      // Log to error.log with full context
      logger.error('GatewayWorker', requestId, 'Error processing login request', {
        method: 'login',
        error: error.message,
        stack: error.stack,
        hasChannelClosed: error.message.includes('CHANNEL_CLOSED')
      })
      
      // Return error in a structured format
      return {
        success: false,
        status: 500,
        message: error.message,
        requestId: requestId
      }
    }
  }
  
  // RPC method for session verification
  static async verifySession(workerInstance, data) {
    const requestId = Math.random().toString(36).substr(2, 9)
    logger.info('GatewayWorker', requestId, 'Verifying session request', {
      method: 'verifySession'
    })
    
    try {
      // Extract actual data and auth info
      const { actualData, authKey } = GatewayHelper.extractRequestData(data)
      
      // For session verification, we need to check if token exists and try to validate it
      if (!authKey) {
        logger.debug('GatewayWorker', requestId, 'No auth token provided for session verification', {
          method: 'verifySession'
        })
        return {
          success: false,
          status: 401,
          valid: false,
          message: 'No session token provided'
        }
      }
      
      // Try to verify the JWT token directly (we need to import jwt since it's already imported at top)
      try {
        const decoded = jwt.verify(authKey, process.env.JWT_SECRET || 'distributed-ai-secure-secret-key-2025')
        logger.info('GatewayWorker', requestId, 'Session verification successful', {
          method: 'verifySession',
          user: decoded.email
        })
        
        // Get rate limit status for the verified user
        const rateLimitStatus = await RateLimiter.getRateLimitStatus(workerInstance, decoded.email)
        
        const response = {
          success: true,
          status: 200,
          valid: true,
          email: decoded.email,
          message: 'Session is valid'
        }
        
        // Add rate limit info if available
        if (rateLimitStatus) {
          response.rateLimitInfo = rateLimitStatus
        }
        
        return response
      } catch (jwtError) {
        logger.debug('GatewayWorker', requestId, 'JWT token validation failed', {
          method: 'verifySession',
          error: jwtError.message
        })
        return {
          success: false,
          status: 401,
          valid: false,
          message: 'Session is invalid or expired'
        }
      }
      
    } catch (error) {
      // Log to error.log with full context
      logger.error('GatewayWorker', requestId, 'Error processing verifySession request', {
        method: 'verifySession',
        error: error.message,
        stack: error.stack,
        hasChannelClosed: error.message.includes('CHANNEL_CLOSED')
      })
      
      return {
        success: false,
        status: 500,
        valid: false,
        message: 'Session verification failed',
        requestId: requestId
      }
    }
  }
}

module.exports = GatewayHelper 