'use strict'

require('dotenv').config()

// Load dependencies with error handling
try {
  const Base = require('../bfx-wrk-base/base.js')
} catch (error) {
  console.error('❌ Failed to load bfx-wrk-base:', error.message)
  process.exit(1)
}

const Base = require('../bfx-wrk-base/base.js')
const AuthHelper = require('./auth-helper.js')
const logger = require('../shared-logger.js')
const SimpleMetrics = require('../simple-metrics.js')

// Global error handlers for uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('AuthWorker', 'GLOBAL', 'Uncaught Exception', {
    error: error.message,
    stack: error.stack
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('AuthWorker', 'GLOBAL', 'Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack
  })
})

class AuthWorker extends Base {
  constructor(conf, ctx) {
    super(conf, ctx)
    this.init()
    
    // Initialize facilities
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', 'store', 's0', { storeDir: './data/auth' }, 0],
      ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
    ])
    
    // Initialize simple metrics
    this.metrics = new SimpleMetrics('auth', 9101)
  }
  
  async _start(cb) {
    try {
      // Log JWT configuration
      const jwtSecret = process.env.JWT_SECRET || 'distributed-ai-secure-secret-key-2025'
      logger.jwt('AuthWorker', 'STARTUP', 'JWT Secret Configured', {
        secretPreview: jwtSecret.substring(0, 10) + '...',
        isFromEnv: !!process.env.JWT_SECRET
      })
      
      // Check if net facility is available
      if (!this.net_default) {
        const error = new Error('net_default facility not available')
        logger.error('AuthWorker', 'STARTUP', 'Net facility not available', { error: error.message })
        if (cb) return cb(error)
        return
      }
      
      // Start RPC server
      await this.net_default.startRpcServer()
      
      // Register RPC methods
      if (this.net_default.rpcServer && typeof this.net_default.rpcServer.respond === 'function') {
        
        // Register ping method for health checks
        this.net_default.rpcServer.respond('ping', async () => {
          return { status: 'healthy', timestamp: Date.now(), service: 'auth' }
        })
        
        // Register method
        this.net_default.rpcServer.respond('register', async (data) => {
          const requestId = Math.random().toString(36).substr(2, 9)
          logger.rpc('AuthWorker', requestId, 'register', 'RECEIVED', { hasData: !!data })
          return await this.net_default.handleReply('register', data)
        })
        
        // Login method
        this.net_default.rpcServer.respond('login', async (data) => {
          const requestId = Math.random().toString(36).substr(2, 9)
          logger.rpc('AuthWorker', requestId, 'login', 'RECEIVED', { hasData: !!data })
          return await this.net_default.handleReply('login', data)
        })
        
      } else {
        const error = new Error('RPC server or respond method not available')
        logger.error('AuthWorker', 'STARTUP', 'RPC setup failed', { 
          hasRpcServer: !!this.net_default.rpcServer,
          hasRespondMethod: typeof this.net_default.rpcServer?.respond
        })
        if (cb) return cb(error)
        return
      }
      
      // Start lookup and announce service
      this.net_default.startLookup()
      await this.net_default.lookup.announceInterval('auth')
      
      logger.lifecycle('AuthWorker', 'STARTED', {
        topic: 'auth',
        methods: ['ping', 'register', 'login'],
        publicKey: this.net_default.rpc?.keyPair?.publicKey?.toString('hex')?.substring(0, 16) || 'N/A'
      })
      
      if (cb) cb()
      
    } catch (error) {
      logger.error('AuthWorker', 'STARTUP', 'Failed to start Auth Worker', {
        error: error.message,
        stack: error.stack
      })
      if (cb) cb(error)
    }
  }
  
  // RPC method for user registration - delegates to helper (async, non-blocking)
  async register(data) {
    return await this.metrics.wrapRpcMethod('register', AuthHelper.register, this, data)
  }
  
  // RPC method for user login - delegates to helper (async, non-blocking)
  async login(data) {
    return await this.metrics.wrapRpcMethod('login', AuthHelper.login, this, data)
  }
  
  // Enhanced lifecycle method with proper DHT cleanup
  async stop(cb) {
    try {
      // Log shutdown start
      logger.info('AuthWorker', 'SHUTDOWN', 'Starting graceful shutdown', {
        topic: 'auth',
        announcementCleanup: true
      })
      
      // Clean up DHT announcements before stopping
      if (this.net_default && this.net_default.lookup) {
        await this.net_default.lookup.unnannounceInterval('auth')
        
        logger.info('AuthWorker', 'SHUTDOWN', 'DHT announcements cleaned', {
          topic: 'auth',
          cleanupSuccess: true
        })
      }
      
      // Call parent stop method
      super.stop(() => {
        logger.lifecycle('AuthWorker', 'STOPPED', {
          topic: 'auth',
          shutdownComplete: true
        })
        
        if (cb) cb()
      })
      
    } catch (error) {
      logger.error('AuthWorker', 'SHUTDOWN', 'Shutdown error', {
        error: error.message,
        stack: error.stack
      })
      
      // Still call parent stop even if cleanup fails
      super.stop(() => {
        if (cb) cb(error)
      })
    }
  }
}

module.exports = AuthWorker

// Only run worker when this file is executed directly, not when required as a module
if (require.main === module) {
  // Create worker instance
  const conf = {
    env: 'development',
    root: process.cwd()
  }

  const ctx = {
    wtype: 'auth-worker',
    env: 'dev',
    root: process.cwd()
  }

  try {
    const worker = new AuthWorker(conf, ctx)
  
    // Start the worker
    worker.start((err) => {
      if (err) {
        logger.error('AuthWorker', 'STARTUP', 'Failed to start Auth Worker', {
          error: err.message,
          stack: err.stack
        })
        process.exit(1)
      }
      
      logger.lifecycle('AuthWorker', 'FULLY_STARTED', {
        message: 'Auth Worker is now running and accepting requests',
        methods: ['ping', 'register', 'login'],
        metricsUrl: 'http://localhost:9101/metrics'
      })
    })
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.lifecycle('AuthWorker', 'SHUTDOWN_INITIATED', { signal: 'SIGINT' })
      worker.stop()
      process.exit(0)
    })
    
    process.on('SIGTERM', () => {
      logger.lifecycle('AuthWorker', 'SHUTDOWN_INITIATED', { signal: 'SIGTERM' })
      worker.stop()
      process.exit(0)
    })
    
  } catch (error) {
    logger.error('AuthWorker', 'INIT', 'Failed to create Auth Worker', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  }
} 