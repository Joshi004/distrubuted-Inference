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
    
    // Robust retry logic for handling connection issues
    return await ClientHelper.retryTopicRequest(workerInstance, topic, method, requestPayload)
  }
  
  // Retry wrapper for topic requests with exponential backoff
  static async retryTopicRequest(workerInstance, topic, method, requestPayload, maxRetries = 3) {
    const baseDelay = 500 // Start with 500ms delay
    let lastError = null
    const sessionId = Math.random().toString(36).substr(2, 9)
    
    // Log the start of the request session
    logger.info('ClientWorker', sessionId, `Starting topic request session: ${topic}.${method}`, {
      topic: topic,
      method: method,
      maxRetries: maxRetries,
      hasAuthKey: !!requestPayload.meta?.key,
      payloadSize: JSON.stringify(requestPayload).length
    })
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptId = `${sessionId}-${attempt}`
      
      try {
        // Log attempt start with connection details
        logger.info('ClientWorker', attemptId, `Attempting topic request (${attempt}/${maxRetries})`, {
          topic: topic,
          method: method,
          attempt: attempt,
          networkFacilityReady: !!workerInstance.net_default,
          rpcClientReady: !!workerInstance.net_default?.rpc,
          lookupServiceReady: !!workerInstance.net_default?.lookup
        })
        
        // Try the request with robust method that tries all available keys
        const startTime = Date.now()
        const result = await workerInstance.net_default.jTopicRequest(topic, method, requestPayload, {}, false)
        const duration = Date.now() - startTime
        
        // Log successful request
        logger.info('ClientWorker', attemptId, `Topic request succeeded`, {
          topic: topic,
          method: method,
          attempt: attempt,
          duration: `${duration}ms`,
          responseSize: JSON.stringify(result).length,
          wasRetry: attempt > 1
        })
        
        // If successful and it was a retry, log success
        if (attempt > 1) {
          console.log(`✅ Request succeeded on attempt ${attempt}/${maxRetries} after ${duration}ms`)
        }
        
        return result
        
      } catch (error) {
        lastError = error
        const isLastAttempt = attempt === maxRetries
        const duration = Date.now() - (Date.now() - 100) // Approximate duration for failed requests
        
        // Enhanced error logging with connection context
        logger.error('ClientWorker', attemptId, `Topic request failed (${attempt}/${maxRetries})`, {
          topic: topic,
          method: method,
          attempt: attempt,
          error: error.message,
          errorStack: error.stack,
          duration: `${duration}ms`,
          networkState: {
            networkFacilityReady: !!workerInstance.net_default,
            rpcClientReady: !!workerInstance.net_default?.rpc,
            lookupServiceReady: !!workerInstance.net_default?.lookup,
            dhtReady: !!workerInstance.net_default?.dht
          },
          isRetryable: ClientHelper.isRetryableError(error),
          isLastAttempt: isLastAttempt
        })
        
        // Check if this is a retryable error
        const isRetryable = ClientHelper.isRetryableError(error)
        const isStaleAnnouncementError = ClientHelper.isStaleAnnouncementError(error)
        
        if (isRetryable && !isLastAttempt) {
          let delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff
          
          // If this appears to be a stale announcement error, use shorter delays
          if (isStaleAnnouncementError) {
            delay = Math.min(delay, 1000) // Cap at 1 second for stale announcement retries
            console.log(`⚠️  Possible stale service announcement detected on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`)
            console.log('   Note: Using fresh DHT lookup to bypass stale announcements')
            
            logger.warn('ClientWorker', `STALE-RETRY-${attempt}`, `Retrying after possible stale announcement`, {
              method: method,
              topic: topic,
              attempt: attempt,
              maxRetries: maxRetries,
              delay: delay,
              error: error.message,
              errorType: 'possible_stale_announcement',
              sessionId: sessionId
            })
          } else {
            console.log(`⚠️  ${error.message.split(':')[0]} error on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`)
            
            // Log retry attempts for CHANNEL_CLOSED and other significant errors
            if (error.message.includes('CHANNEL_CLOSED') || error.message.includes('ERR_TOPIC_LOOKUP_EMPTY')) {
              logger.warn('ClientWorker', `RETRY-${attempt}`, `Retrying after ${error.message.split(':')[0]} error`, {
                method: method,
                topic: topic,
                attempt: attempt,
                maxRetries: maxRetries,
                delay: delay,
                error: error.message,
                sessionId: sessionId
              })
            }
          }
          
          // Wait before retry
          await ClientHelper.sleep(delay)
          continue
        }
        
        // If not retryable or last attempt, break and throw
        break
      }
    }
    
    // If we get here, all retries failed
    const isStaleError = ClientHelper.isStaleAnnouncementError(lastError)
    
    logger.error('ClientWorker', sessionId, `All retry attempts exhausted for ${topic}.${method}`, {
      topic: topic,
      method: method,
      totalAttempts: maxRetries,
      finalError: lastError.message,
      finalErrorStack: lastError.stack,
      possibleStaleAnnouncement: isStaleError
    })
    
    console.error(`❌ All ${maxRetries} attempts failed for ${topic}.${method}`)
    
    // Provide specific guidance for stale announcement failures
    if (isStaleError && topic === 'gateway') {
      console.error(`💡 This looks like a stale DHT announcement issue.`)
      console.error(`   Suggested fixes:`)
      console.error(`   1. Wait 5+ minutes for stale announcements to expire`)
      console.error(`   2. Restart the gateway service`)
      console.error(`   3. Run the cleanup script: ./cleanup.sh`)
      console.error(`   4. Check if the gateway worker is actually running`)
    }
    
    throw lastError
  }
  
  // Check if an error is retryable
  static isRetryableError(error) {
    if (!error || !error.message) return false
    
    const retryableErrors = [
      'CHANNEL_CLOSED',
      'ECONNRESET',
      'ECONNREFUSED', 
      'ETIMEDOUT',
      'ENOTFOUND',
      'ERR_TOPIC_LOOKUP_EMPTY',
      'UNKNOWN_METHOD',      // Service might be stale and not have the method
      'Request timed out',   // Service might be unresponsive (stale)
      'Connection refused'   // Service might be down (stale announcement)
    ]
    
    return retryableErrors.some(errorType => error.message.includes(errorType))
  }
  
  // Check if an error likely indicates a stale DHT announcement
  static isStaleAnnouncementError(error) {
    if (!error || !error.message) return false
    
    const staleAnnouncementErrors = [
      'CHANNEL_CLOSED',      // Service was announced but is no longer running
      'ECONNREFUSED',        // Service was announced but port is not listening
      'ETIMEDOUT',           // Service was announced but is unresponsive
      'UNKNOWN_METHOD',      // Service was announced but doesn't have the expected method
      'Connection refused',  // Service was announced but connection is refused
      'Request timed out'    // Service was announced but times out
    ]
    
    return staleAnnouncementErrors.some(errorType => error.message.includes(errorType))
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