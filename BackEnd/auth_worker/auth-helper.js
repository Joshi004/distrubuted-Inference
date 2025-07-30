'use strict'

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const logger = require('../shared-logger.js')

// Auth Helper - Contains core auth business logic
// These functions are bound to the main AuthWorker instance
// Now uses Hyperbee storage instead of filesystem

class AuthHelper {
  
  // Helper method to extract data from request (consistent with gateway)
  static extractRequestData(requestData) {
    // Handle both old format (direct data) and new format (wrapped data)
    if (requestData && requestData.data && typeof requestData.data === 'object') {
      // New wrapped format: { data: {...}, meta: { key: "..." } }
      return {
        actualData: requestData.data,
        authKey: requestData.meta?.key || null
      }
    } else if (requestData && typeof requestData === 'object') {
      // Old direct format: { email: "...", password: "..." }
      return {
        actualData: requestData,
        authKey: null
      }
    } else {
      throw new Error('Invalid request format: expected object with data')
    }
  }
  
  // Helper method to get the users database (Hyperbee)
  static async getUsersDatabase(workerInstance) {
    if (!workerInstance.store_s0) {
      throw new Error('Store facility not available')
    }
    
    const usersDb = await workerInstance.store_s0.getBee({ 
      name: 'users' 
    }, {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    })
    await usersDb.ready()
    return usersDb
  }
  
  // RPC method for user registration (simplified version without requestId)
  static async register(workerInstance, data) {
    const requestId = Math.random().toString(36).substr(2, 9)
    console.log(`\n📝 Auth received register request`)
    console.log(`📝 Raw Data:`, JSON.stringify(data, null, 2))
    
    let email = null // Declare email outside try block for error handler access
    
    try {
      // Extract actual data from the request
      const { actualData } = AuthHelper.extractRequestData(data)
      console.log(`📝 Actual Data:`, JSON.stringify(actualData, null, 2))
      
      // Extract email and password from actual data
      const emailData = actualData.email
      const password = actualData.password
      email = emailData // Assign to the outer scope variable
      
      if (!email || !password) {
        throw new Error('Email and password are required')
      }
      
      // Get the users database
      const usersDb = await AuthHelper.getUsersDatabase(workerInstance)
      console.log(`📋 Connected to users database`)
      
      // Check if user already exists
      console.log(`🔍 Checking if user exists: ${email}`)
      const existingUser = await usersDb.get(email)
      
      if (existingUser && existingUser.value) {
        console.log(`❌ User already exists: ${email}`)
        console.log(`🔍 Existing user data:`, JSON.stringify(existingUser.value, null, 2))
        
        return {
          success: false,
          status: 409,
          message: 'User already exists'
        }
      }
      
      console.log(`✅ User does not exist, proceeding with registration`)
      
      // Hash password
      const saltRounds = 10
      const passwordHash = await bcrypt.hash(password, saltRounds)
      console.log(`🔒 Password hashed successfully`)
      
      // Store user in Hyperbee
      const userData = {
        email: email,
        passwordHash: passwordHash,
        createdAt: new Date().toISOString()
      }
      
      console.log(`💾 Storing user data:`, JSON.stringify({...userData, passwordHash: '[REDACTED]'}, null, 2))
      await usersDb.put(email, userData)
      console.log(`💾 User stored in Hyperbee database`)
      
      // Verify the user was stored correctly
      const verifyUser = await usersDb.get(email)
      if (verifyUser && verifyUser.value) {
        console.log(`✅ User storage verified`)
      } else {
        console.log(`⚠️  Warning: Could not verify user storage`)
      }
      
      console.log(`✅ User registered successfully`)
      
      // Return success response
      const response = {
        success: true,
        status: 201,
        message: 'User registered successfully',
        email: email
      }
      
      console.log(`📤 Returning response:`, JSON.stringify(response, null, 2))
      return response
      
    } catch (error) {
      console.error(`❌ Error during registration:`, error.message)
      console.error(`❌ Error stack:`, error.stack)
      
      // Generate request ID for logging (or use existing one if available)
      const errorRequestId = requestId || Math.random().toString(36).substr(2, 9)
      
      // Handle specific error types
      let status = 500
      let message = error.message
      
      if (error.message.includes('Store facility not available')) {
        status = 503
        message = 'Authentication service temporarily unavailable - store not ready'
        logger.error('AuthWorker', errorRequestId, 'Store facility not available during registration', {
          method: 'register',
          email: email,
          error: error.message
        })
      } else if (error.message.includes('CHANNEL_CLOSED')) {
        status = 503
        message = 'Authentication service temporarily unavailable - connection closed'
        logger.error('AuthWorker', errorRequestId, 'Channel closed during registration', {
          method: 'register',
          email: email,
          error: error.message,
          hint: 'Connection lost to storage service'
        })
      } else {
        // Log any other unexpected registration errors
        logger.error('AuthWorker', errorRequestId, 'Registration failed with unexpected error', {
          method: 'register',
          email: email,
          error: error.message,
          stack: error.stack
        })
      }
      
      // Return error in a structured format
      return {
        success: false,
        status: status,
        message: message
      }
    }
  }
  
  // RPC method for user login
  static async login(workerInstance, data) {
    const requestId = Math.random().toString(36).substr(2, 9)
    console.log(`\n🔐 [${requestId}] Auth received login request:`)
    console.log(`🔐 [${requestId}] Raw Data:`, JSON.stringify(data, null, 2))
    
    let email = null // Declare email outside try block for error handler access
    
    try {
      // Extract actual data from the request
      const { actualData } = AuthHelper.extractRequestData(data)
      console.log(`🔐 [${requestId}] Actual Data:`, JSON.stringify(actualData, null, 2))
      
      // Extract email and password from actual data
      const emailData = actualData.email
      const password = actualData.password
      email = emailData // Assign to the outer scope variable
      
      if (!email || !password) {
        throw new Error('Email and password are required')
      }
      
      // Get the users database
      const usersDb = await AuthHelper.getUsersDatabase(workerInstance)
      console.log(`📋 [${requestId}] Connected to users database`)
      
      // Find user by email
      const userResult = await usersDb.get(email)
      
      if (userResult && userResult.value) {
        const userData = userResult.value
        console.log(`📋 [${requestId}] User found in Hyperbee database`)
        console.log(`🔍 [${requestId}] User data structure:`, JSON.stringify(userData, null, 2))
        
        // Debug the values before bcrypt.compare
        console.log(`🔍 [${requestId}] Input password:`, password ? 'provided' : 'missing')
        console.log(`🔍 [${requestId}] Stored hash:`, userData.passwordHash ? 'found' : 'missing')
        
        if (!password) {
          throw new Error('Password is required for login')
        }
        
        if (!userData.passwordHash) {
          throw new Error('User account is corrupted - no password hash found')
        }
        
        // Validate password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, userData.passwordHash)
        
        if (isPasswordValid) {
          // Generate JWT token
          const payload = {
            email: email,
            role: 'user'
          }
          const jwtSecret = process.env.JWT_SECRET || 'distributed-ai-secure-secret-key-2025'
          
          // Enhanced debugging for JWT generation
          logger.debug('AuthWorker', requestId, 'JWT Generation Debug', {
            jwtSecretEnvVar: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
            secretPreview: jwtSecret.substring(0, 10) + '...',
            payload: payload
          })
          
          const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' })
          
          logger.debug('AuthWorker', requestId, 'JWT Token Generated', {
            tokenPreview: token.substring(0, 20) + '...',
            tokenLength: token.length,
            email: email
          })
          
          logger.info('AuthWorker', requestId, 'User authenticated successfully', { email })
          logger.jwt('AuthWorker', requestId, 'Token Generated', {
            email,
            expiresIn: '24h',
            secretPreview: jwtSecret.substring(0, 10) + '...',
            tokenPreview: token.substring(0, 20) + '...'
          })
          
          // Return success response
          const response = {
            success: true,
            status: 200,
            email: email,
            key: token
          }
          
          console.log(`📤 [${requestId}] Returning response:`, JSON.stringify(response, null, 2))
          return response
        } else {
          logger.error('AuthWorker', requestId, 'Invalid password', { email })
        }
      } else {
        logger.error('AuthWorker', requestId, 'User not found', { email })
      }
      
      // Return failure response for both invalid password and user not found
      const response = {
        success: false,
        status: 401,
        message: 'Invalid credentials'
      }
      
      console.log(`📤 [${requestId}] Returning response:`, JSON.stringify(response, null, 2))
      return response
      
    } catch (error) {
      console.error(`❌ [${requestId}] Error during login:`, error.message)
      console.error(`❌ [${requestId}] Error stack:`, error.stack)
      
      // Handle specific error types
      let status = 500
      let message = error.message
      
      if (error.message.includes('Store facility not available')) {
        status = 503
        message = 'Authentication service temporarily unavailable - store not ready'
        logger.error('AuthWorker', requestId, 'Store facility not available during login', {
          method: 'login',
          email: email,
          error: error.message
        })
      } else if (error.message.includes('CHANNEL_CLOSED')) {
        status = 503
        message = 'Authentication service temporarily unavailable - connection closed'
        logger.error('AuthWorker', requestId, 'Channel closed during login', {
          method: 'login',
          email: email,
          error: error.message,
          hint: 'Connection lost to storage service'
        })
      } else {
        // Log any other unexpected login errors
        logger.error('AuthWorker', requestId, 'Login failed with unexpected error', {
          method: 'login',
          email: email,
          error: error.message,
          stack: error.stack
        })
      }
      
      // Return error in a structured format
      return {
        success: false,
        status: status,
        message: message,
        requestId: requestId
      }
    }
  }
}

module.exports = AuthHelper 