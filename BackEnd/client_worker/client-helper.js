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
  
  // Method for sending AI prompts to the gateway
  static async sendRequest(workerInstance, inputPrompt) {
    console.log(`\n📤 Sending prompt: "${inputPrompt}"`)
    
    try {
      const result = await ClientHelper.authorizedTopicRequest(
        workerInstance,
        'gateway',
        'processPrompt',
        { prompt: inputPrompt }
      )
      
      if (result.response) {
        console.log(`✅ AI Response received`)
      } else if (result.error) {
        console.error(`❌ Error: ${result.message}`)
      }
      
      return result
      
    } catch (error) {
      console.error(`❌ Request failed: ${error.message}`)
      
      // Log all request failures to error.log with appropriate context
      const requestId = Math.random().toString(36).substr(2, 9)
      
      if (error.message.includes('ERR_TOPIC_LOOKUP_EMPTY')) {
        logger.error('ClientWorker', requestId, 'Topic lookup empty - gateway worker may not be running', {
          method: 'processPrompt',
          error: error.message
        })
        console.error(`💡 Hint: Make sure the gateway worker is running`)
      } else if (error.message.includes('UNKNOWN_METHOD')) {
        logger.error('ClientWorker', requestId, 'Unknown method - gateway method registration may have failed', {
          method: 'processPrompt',
          error: error.message
        })
        console.error(`💡 Hint: Gateway method registration may have failed`)
      } else if (error.message.includes('CHANNEL_CLOSED')) {
        logger.error('ClientWorker', requestId, 'Channel closed - connection lost during request', {
          method: 'processPrompt',
          error: error.message,
          hint: 'Network issues, service restarts, or stale DHT announcements'
        })
        console.error(`💡 Hint: Connection was closed, this may indicate network issues, service restarts, or stale DHT announcements`)
      } else if (ClientHelper.isStaleAnnouncementError(error)) {
        logger.error('ClientWorker', requestId, 'Possible stale DHT announcement detected', {
          method: 'processPrompt',
          error: error.message,
          hint: 'Service may have been announced but is no longer reachable'
        })
        console.error(`💡 Hint: This may be a stale DHT announcement. Try waiting a few minutes or restart the gateway service`)
      } else {
        // Log any other unexpected errors
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
    console.log(`\n📝 Registering user: "${email}"`)
    
    try {
      const result = await ClientHelper.authorizedTopicRequest(
        workerInstance,
        'gateway',
        'register',
        { email, password }
      )
      
      return result
      
    } catch (error) {
      console.error(`❌ Registration failed: ${error.message}`)
      throw error
    }
  }
  
  // Method for user login
  static async loginUser(workerInstance, email, password) {
    console.log(`\n🔐 Logging in user: "${email}"`)
    
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
        logger.jwt('ClientWorker', 'LOGIN', 'Session Key Stored', {
          email,
          tokenPreview: result.key.substring(0, 20) + '...',
          tokenLength: result.key.length
        })
      }
      
      return result
      
    } catch (error) {
      console.error(`❌ Login failed: ${error.message}`)
      throw error
    }
  }
  
  // Method for user logout
  static logout(workerInstance) {
    console.log(`\n🚪 Logging out...`)
    
    if (workerInstance.sessionKey) {
      workerInstance.sessionKey = null
      console.log(`🔑 Session key cleared`)
      return {
        success: true,
        message: 'Logged out successfully'
      }
    } else {
      return {
        success: false,
        message: 'No active session to logout'
      }
    }
  }
  
  // Method to get current API token
  static getApiToken(workerInstance) {
    console.log(`\n🔑 Getting API token...`)
    
    if (workerInstance.sessionKey) {
      console.log(`✅ API token retrieved`)
      return {
        success: true,
        token: workerInstance.sessionKey,
        message: 'API token retrieved successfully'
      }
    } else {
      console.log(`🚫 No active session`)
      return {
        success: false,
        message: 'No active session - please login first'
      }
    }
  }
  
  // Method for session verification
  static async verifySession(workerInstance) {
    console.log(`\n🔍 Verifying current session...`)
    
    try {
      // Check if we have a session key
      if (!workerInstance.sessionKey) {
        console.log(`🚫 No session key found`)
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
      
      console.log(`🔍 Session verification result: ${result.valid ? 'VALID' : 'INVALID'}`)
      return result
      
    } catch (error) {
      console.error(`❌ Session verification failed: ${error.message}`)
      return {
        success: false,
        valid: false,
        message: 'Session verification failed'
      }
    }
  }
}

module.exports = ClientHelper 