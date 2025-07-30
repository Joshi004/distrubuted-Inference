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
    let email = null // Declare email outside try block for error handler access
    
    try {
      // Extract actual data from the request
      const { actualData } = AuthHelper.extractRequestData(data)
      
      // Extract email and password from actual data
      const emailData = actualData.email
      const password = actualData.password
      email = emailData // Assign to the outer scope variable
      
      if (!email || !password) {
        throw new Error('Email and password are required')
      }
      
      logger.rpc('AuthWorker', requestId, 'register', 'RECEIVED', { email })
      
      // Get the users database
      const usersDb = await AuthHelper.getUsersDatabase(workerInstance)
      
      // Check if user already exists
      const existingUser = await usersDb.get(email)
      
      if (existingUser && existingUser.value) {
        logger.info('AuthWorker', requestId, 'Registration failed - user already exists', { email })
        
        return {
          success: false,
          status: 409,
          message: 'User already exists'
        }
      }
      
      // Hash password
      const saltRounds = 10
      const passwordHash = await bcrypt.hash(password, saltRounds)
      
      // Store user in Hyperbee
      const userData = {
        email: email,
        passwordHash: passwordHash,
        createdAt: new Date().toISOString()
      }
      
      await usersDb.put(email, userData)
      
      // Verify the user was stored correctly
      const verifyUser = await usersDb.get(email)
      if (!verifyUser || !verifyUser.value) {
        logger.warn('AuthWorker', requestId, 'User storage verification failed', { email })
      }
      
      logger.info('AuthWorker', requestId, 'User registered successfully', { email })
      
      // Return success response
      const response = {
        success: true,
        status: 201,
        message: 'User registered successfully',
        email: email
      }
      
      return response
      
    } catch (error) {
      
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
    let email = null // Declare email outside try block for error handler access
    
    try {
      // Extract actual data from the request
      const { actualData } = AuthHelper.extractRequestData(data)
      
      // Extract email and password from actual data
      const emailData = actualData.email
      const password = actualData.password
      email = emailData // Assign to the outer scope variable
      
      if (!email || !password) {
        throw new Error('Email and password are required')
      }
      
      logger.rpc('AuthWorker', requestId, 'login', 'RECEIVED', { email })
      
      // Get the users database
      const usersDb = await AuthHelper.getUsersDatabase(workerInstance)
      
      // Find user by email
      const userResult = await usersDb.get(email)
      
      if (userResult && userResult.value) {
        const userData = userResult.value
        
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
          
          const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' })
          
          logger.info('AuthWorker', requestId, 'User authenticated successfully', { email })
          logger.jwt('AuthWorker', requestId, 'Token Generated', {
            email,
            expiresIn: '24h'
          })
          
          // Return success response
          const response = {
            success: true,
            status: 200,
            email: email,
            key: token
          }
          
          return response
        } else {
          logger.info('AuthWorker', requestId, 'Login failed - invalid password', { email })
        }
      } else {
        logger.info('AuthWorker', requestId, 'Login failed - user not found', { email })
      }
      
      // Return failure response for both invalid password and user not found
      const response = {
        success: false,
        status: 401,
        message: 'Invalid credentials'
      }
      
      return response
      
    } catch (error) {
      
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