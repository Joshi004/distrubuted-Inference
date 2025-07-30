'use strict'

require('dotenv').config()

console.log('🚀 Auth Worker starting...')

// Load dependencies with error handling
try {
  const Base = require('../bfx-wrk-base/base.js')
  console.log('✅ Successfully loaded bfx-wrk-base')
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
  console.error('🚨 UNCAUGHT EXCEPTION in AuthWorker:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('AuthWorker', 'GLOBAL', 'Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack
  })
  console.error('🚨 UNHANDLED REJECTION in AuthWorker:', reason)
})

class AuthWorker extends Base {
  constructor(conf, ctx) {
    console.log('🔧 Auth Worker constructor called with:')
    console.log('   conf:', JSON.stringify(conf, null, 2))
    console.log('   ctx:', JSON.stringify(ctx, null, 2))
    
    super(conf, ctx)
    
    console.log('🔧 Initializing Auth Worker...')
    this.init()
    
    // Initialize facilities
    console.log('🔧 Setting up facilities...')
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', 'store', 's0', { storeDir: './data/auth' }, 0],
      ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
    ])
    
    // Initialize simple metrics
    this.metrics = new SimpleMetrics('auth', 9101)
    
    console.log('🎯 =================================')
    console.log('🔐 AUTH WORKER METRICS')
    console.log('📈 URL: http://localhost:9101/metrics')
    console.log('🎯 =================================')
    
    console.log('✅ Auth Worker constructor completed')
  }
  
  async _start(cb) {
    console.log('▶️  Auth Worker _start method called')
    
    try {
      // Log JWT configuration
      const jwtSecret = process.env.JWT_SECRET || 'distributed-ai-secure-secret-key-2025'
      logger.jwt('AuthWorker', 'STARTUP', 'JWT Secret Configured', {
        secretPreview: jwtSecret.substring(0, 10) + '...',
        isFromEnv: !!process.env.JWT_SECRET
      })
      
      // Enhanced debugging for JWT secret consistency
      logger.debug('AuthWorker', 'STARTUP', 'JWT Configuration Debug', {
        jwtSecretEnvVar: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
        secretPreview: jwtSecret.substring(0, 10) + '...',
        secretLength: jwtSecret.length
      })
      
      console.log('🔌 Starting RPC server...')
      
      // Check if net facility is available
      if (!this.net_default) {
        console.error('❌ net_default facility not available')
        if (cb) return cb(new Error('net_default facility not available'))
        return
      }
      
      console.log('✅ net_default facility is available')
      
      // Start RPC server
      console.log('🔌 Calling startRpcServer()...')
      await this.net_default.startRpcServer()
      console.log('✅ RPC server started successfully')
      
      // Register RPC methods
      console.log('🔗 Registering RPC methods...')
      if (this.net_default.rpcServer && typeof this.net_default.rpcServer.respond === 'function') {
        
        // Register ping method for health checks
        this.net_default.rpcServer.respond('ping', async () => {
          console.log('🏓 Auth received ping health check')
          return { status: 'healthy', timestamp: Date.now(), service: 'auth' }
        })
        console.log('✅ ping method registered successfully')
        
        // Register method
        this.net_default.rpcServer.respond('register', async (data) => {
          const requestId = Math.random().toString(36).substr(2, 9)
          logger.rpc('AuthWorker', requestId, 'register', 'RECEIVED', { hasData: !!data })
          // Use NetFacility's handleReply which handles JSON parsing/serialization
          return await this.net_default.handleReply('register', data)
        })
        console.log('✅ register method registered successfully')
        
        // Login method
        this.net_default.rpcServer.respond('login', async (data) => {
          const requestId = Math.random().toString(36).substr(2, 9)
          logger.rpc('AuthWorker', requestId, 'login', 'RECEIVED', { hasData: !!data })
          // Use NetFacility's handleReply which handles JSON parsing/serialization
          return await this.net_default.handleReply('login', data)
        })
        console.log('✅ login method registered successfully')
        
      } else {
        console.error('❌ RPC server or respond method not available')
        console.log('RPC server:', !!this.net_default.rpcServer)
        console.log('Respond method:', typeof this.net_default.rpcServer?.respond)
      }
      
      // Start lookup
      console.log('🔍 Starting lookup service...')
      this.net_default.startLookup()
      console.log('✅ Lookup service started')
      
      // Announce our service
      console.log('📢 Announcing auth service to DHT...')
      await this.net_default.lookup.announceInterval('auth')
      console.log('✅ Auth service announced successfully')
      
      // Log our public key for debugging
      if (this.net_default.rpc && this.net_default.rpc.keyPair) {
        const publicKey = this.net_default.rpc.keyPair.publicKey.toString('hex')
        console.log('🔑 Auth Worker Public Key:', publicKey)
      } else {
        console.log('⚠️  Public key not available yet')
      }
      
      logger.lifecycle('AuthWorker', 'STARTED', {
        topic: 'auth',
        methods: ['ping', 'register', 'login'],
        publicKey: this.net_default.rpc?.keyPair?.publicKey?.toString('hex')?.substring(0, 16) || 'N/A'
      })
      
      if (cb) cb()
      
    } catch (error) {
      console.error('❌ Error starting Auth Worker:', error)
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
    console.log('🛑 Auth Worker stopping...')
    
    try {
      // Log shutdown start
      logger.info('AuthWorker', 'SHUTDOWN', 'Starting graceful shutdown', {
        topic: 'auth',
        announcementCleanup: true
      })
      
      // Clean up DHT announcements before stopping
      if (this.net_default && this.net_default.lookup) {
        console.log('🧹 Cleaning up DHT announcements...')
        await this.net_default.lookup.unnannounceInterval('auth')
        console.log('✅ DHT announcements cleaned up')
        
        logger.info('AuthWorker', 'SHUTDOWN', 'DHT announcements cleaned', {
          topic: 'auth',
          cleanupSuccess: true
        })
      }
      
      // Call parent stop method
      super.stop(() => {
        console.log('✅ Auth Worker stopped')
        logger.lifecycle('AuthWorker', 'STOPPED', {
          topic: 'auth',
          shutdownComplete: true
        })
        
        if (cb) cb()
      })
      
    } catch (error) {
      console.error('❌ Error during auth shutdown:', error)
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
    console.log('🔧 Creating AuthWorker instance...')
    const worker = new AuthWorker(conf, ctx)
  
  // Start the worker
  worker.start((err) => {
    if (err) {
      logger.error('AuthWorker', 'STARTUP', 'Failed to start Auth Worker', {
        error: err.message,
        stack: err.stack
      })
      console.error('❌ Failed to start Auth Worker:', err)
      process.exit(1)
    }
    
    logger.lifecycle('AuthWorker', 'FULLY_STARTED', {
      message: 'Auth Worker is now running and accepting requests',
      methods: ['ping', 'register', 'login']
    })
          console.log('🎉 Auth Worker is now running!')
      console.log('🔍 Listening for:')
      console.log('   • ping requests: health checks')
      console.log('   • register requests: { email, password }')
      console.log('   • login requests: { email, password }')
      console.log('')
      console.log('🎯 ==========================================')
      console.log('📊 METRICS: http://localhost:9101/metrics')
      console.log('🎯 ==========================================')
  })
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Auth Worker...')
    worker.stop()
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Auth Worker...')
    worker.stop()
    process.exit(0)
  })
  
} catch (error) {
  logger.error('AuthWorker', 'INIT', 'Failed to create Auth Worker', {
    error: error.message,
    stack: error.stack
  })
  console.error('❌ Failed to create Auth Worker:', error.message)
  process.exit(1)
}
} 