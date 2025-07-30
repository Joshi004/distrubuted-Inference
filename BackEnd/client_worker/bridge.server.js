'use strict'

const express = require('express')
const ClientWorker = require('./client-worker.js')
const logger = require('../shared-logger.js')

// Global error handlers for uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('BridgeServer', 'GLOBAL', 'Uncaught Exception', {
    error: error.message,
    stack: error.stack
  })
  console.error('🚨 UNCAUGHT EXCEPTION in BridgeServer:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('BridgeServer', 'GLOBAL', 'Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack
  })
  console.error('🚨 UNHANDLED REJECTION in BridgeServer:', reason)
})

const app = express()
const port = process.env.PORT || 3000

// Middleware to parse JSON
app.use(express.json())

// CORS middleware to allow cross-origin requests from all domains
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Global client worker instance
let clientWorker = null
let isWorkerReady = false

// Initialize client worker
const conf = {
  env: 'development',
  root: process.cwd()
}

const ctx = {
  wtype: 'client-worker',
  env: 'dev',
  root: process.cwd()
}

console.log('🚀 Initializing Bridge Server...')

try {
  clientWorker = new ClientWorker(conf, ctx)
  
  // Start the worker
  clientWorker.start((err) => {
    if (err) {
      console.error('❌ Failed to start Client Worker:', err)
      process.exit(1)
    }
    
    isWorkerReady = true
    console.log('✅ Client Worker ready for bridge server')
  })
  
} catch (error) {
  console.error('❌ Failed to create Client Worker:', error.message)
  process.exit(1)
}

// User registration endpoint
app.post('/register', async (req, res) => {
  try {
    // Check if worker is ready
    if (!isWorkerReady) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Client worker is not ready yet'
      })
    }
    
    // Validate request body
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Email and password are required'
      })
    }
    
    console.log(`🌐 Bridge server registering user: "${email}"`)
    
    try {
      const result = await clientWorker.registerUser(email, password)
      
      // Return the response
      res.status(result.status || 200).json(result)
      
    } catch (error) {
      console.error(`❌ Bridge server registration error:`, error.message)
      res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: error.message
      })
    }
    
  } catch (error) {
    console.error('❌ Bridge server error:', error.message)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

// User login endpoint
app.post('/login', async (req, res) => {
  try {
    // Check if worker is ready
    if (!isWorkerReady) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Client worker is not ready yet'
      })
    }
    
    // Validate request body
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Email and password are required'
      })
    }
    
    console.log(`🌐 Bridge server logging in user: "${email}"`)
    
    try {
      const result = await clientWorker.loginUser(email, password)
      
      // Return the response
      res.status(result.status || 200).json(result)
      
          } catch (error) {
      logger.error('BridgeServer', 'LOGIN', 'Login error', {
        error: error.message,
        stack: error.stack,
        email: email || 'unknown'
      })
      res.status(500).json({
        success: false,
        error: 'Login failed',
        message: error.message
      })
    }
    
  } catch (error) {
    console.error('❌ Bridge server error:', error.message)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Session verification endpoint
app.post('/verify-session', async (req, res) => {
  try {
    // Check if worker is ready
    if (!isWorkerReady) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Client worker is not ready yet'
      })
    }
    
    console.log(`🌐 Bridge server verifying session...`)
    
    try {
      const result = await clientWorker.verifySession()
      
      // Return the response
      res.status(result.status || 200).json(result)
      
    } catch (error) {
      console.error(`❌ Bridge server session verification error:`, error.message)
      res.status(500).json({
        success: false,
        valid: false,
        message: 'Session verification failed'
      })
    }
    
  } catch (error) {
    console.error('❌ Bridge server error:', error.message)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

// API token retrieval endpoint
app.post('/get-api-token', async (req, res) => {
  try {
    // Check if worker is ready
    if (!isWorkerReady) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Client worker is not ready yet'
      })
    }
    
    console.log(`🌐 Bridge server retrieving API token...`)
    
    try {
      const result = clientWorker.getApiToken()
      
      // Return the response
      res.status(result.success ? 200 : 401).json(result)
      
    } catch (error) {
      console.error(`❌ Bridge server API token error:`, error.message)
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve API token'
      })
    }
    
  } catch (error) {
    console.error('❌ Bridge server error:', error.message)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Inference endpoint with authentication
app.post('/inference', async (req, res) => {
  try {
    // Check if worker is ready
    if (!isWorkerReady) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Client worker is not ready yet'
      })
    }
    
    // Validate request body
    const { prompt } = req.body
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Missing or invalid prompt in request body'
      })
    }
    
    // Check if ClientWorker has a valid session
    if (!clientWorker.sessionKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No active session - please login first'
      })
    }
    
    console.log(`🌐 Bridge server forwarding authenticated request: "${prompt}"`)
    
    // Generate request ID for tracking
    const requestId = Math.random().toString(36).substr(2, 9)
    
    // Log the incoming inference request
    logger.prompt('BridgeServer', requestId, 'REQUEST_RECEIVED', {
      source: 'web_ui',
      userAgent: req.headers['user-agent'],
      prompt: prompt.length > 200 ? prompt.substring(0, 200) + '...' : prompt,
      promptLength: prompt.length,
      timestamp: new Date().toISOString()
    })
    
    try {
      console.log(`🔄 Bridge server: Starting authenticated request with retries handled by ClientWorker...`)
      
      // ClientWorker.sendRequest() already handles all retries internally
      // We just wait for the final result (success or failure after all retries)
      const result = await clientWorker.sendRequest(prompt)
      
      // Check if the final result is an error object from the backend
      if (result && result.error) {
        console.log(`❌ Bridge server: Final result after retries is an error`)
        
        // Log error response
        logger.prompt('BridgeServer', requestId, 'REQUEST_FAILED', {
          status: 'error',
          error: result.message || 'Request processing failed after retries',
          requestId: result.requestId
        })
        
        // Backend returned an error after all retries exhausted
        return res.status(500).json({
          error: true,
          message: result.message || 'Request processing failed after retries',
          requestId: result.requestId
        })
      }
      
      console.log(`✅ Bridge server: Request successful after retries`)
      
      // Log successful response
      logger.prompt('BridgeServer', requestId, 'REQUEST_COMPLETED', {
        status: 'success',
        responseLength: result.response ? result.response.length : 0,
        responsePreview: result.response ? (result.response.length > 200 ? result.response.substring(0, 200) + '...' : result.response) : 'N/A',
        rateLimitInfo: result.rateLimitInfo || null
      })
      
      // Return successful response
      res.json(result)
      
    } catch (error) {
      // This catch block only fires after ClientWorker has exhausted all retries
      console.error(`❌ Bridge server: Final error after all retries exhausted:`, error.message)
      
      // Generate request ID for logging
      const requestId = Math.random().toString(36).substr(2, 9)
      
      // Provide more specific error messages based on the error type
      let userMessage = 'Request failed after multiple attempts'
      
      if (error.message.includes('CHANNEL_CLOSED')) {
        userMessage = 'Connection was lost and could not be restored after multiple attempts. Please check if the backend services are running.'
        logger.error('BridgeServer', requestId, 'Channel closed after all retries exhausted', {
          endpoint: '/inference',
          error: error.message,
          retryCount: 'exhausted',
          prompt: prompt ? prompt.substring(0, 100) + '...' : 'N/A'
        })
      } else if (error.message.includes('ERR_TOPIC_LOOKUP_EMPTY')) {
        userMessage = 'Backend service is not available. Please ensure the gateway worker is running.'
        logger.error('BridgeServer', requestId, 'Topic lookup empty after all retries', {
          endpoint: '/inference',
          error: error.message,
          retryCount: 'exhausted'
        })
      } else if (error.message.includes('ECONNREFUSED')) {
        userMessage = 'Connection refused. Backend services may be offline.'
        logger.error('BridgeServer', requestId, 'Connection refused after all retries', {
          endpoint: '/inference',
          error: error.message,
          retryCount: 'exhausted'
        })
      } else if (error.message.includes('ETIMEDOUT')) {
        userMessage = 'Request timed out after multiple attempts.'
        logger.error('BridgeServer', requestId, 'Request timeout after all retries', {
          endpoint: '/inference',
          error: error.message,
          retryCount: 'exhausted'
        })
      } else {
        // Log any other unexpected errors
        logger.error('BridgeServer', requestId, 'Unexpected error after all retries exhausted', {
          endpoint: '/inference',
          error: error.message,
          stack: error.stack,
          retryCount: 'exhausted'
        })
      }
      
      res.status(500).json({
        error: true,
        message: userMessage
      })
    }
    
  } catch (error) {
    console.error('❌ Bridge server error:', error.message)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    workerReady: isWorkerReady,
    timestamp: new Date().toISOString()
  })
})

// Global error handler for Express
app.use((err, req, res, next) => {
  logger.error('BridgeServer', 'EXPRESS', 'Unhandled Express error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  })
  console.error('🚨 EXPRESS ERROR:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  })
})

// Start the server
app.listen(port, () => {
  logger.lifecycle('BridgeServer', 'STARTED', {
    port: port,
    endpoints: ['/inference', '/register', '/login', '/verify-session', '/get-api-token', '/health']
  })
  console.log(`🌐 Bridge server listening on port ${port}`)
  console.log(`🔐 Auth endpoints:`)
  console.log(`   POST http://localhost:${port}/register`)
  console.log(`   POST http://localhost:${port}/login`)
  console.log(`   POST http://localhost:${port}/verify-session`)
  console.log(`   POST http://localhost:${port}/get-api-token`)
  console.log(`📡 Inference endpoint: POST http://localhost:${port}/inference`)
  console.log(`🏥 Health check: GET http://localhost:${port}/health`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Bridge Server...')
  if (clientWorker) {
    clientWorker.stop()
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Bridge Server...')
  if (clientWorker) {
    clientWorker.stop()
  }
  process.exit(0)
}) 