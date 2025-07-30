'use strict'

require('dotenv').config()

console.log('🚀 Gateway Worker starting...')

// Load dependencies with error handling
try {
  const Base = require('bfx-wrk-base')
  console.log('✅ Successfully loaded bfx-wrk-base')
} catch (error) {
  console.error('❌ Failed to load bfx-wrk-base:', error.message)
  process.exit(1)
}

const Base = require('../bfx-wrk-base')
const GatewayHelper = require('./gateway-helper.js')
const logger = require('../shared-logger.js')
const SimpleMetrics = require('../simple-metrics.js')

// Global error handlers for uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('GatewayWorker', 'GLOBAL', 'Uncaught Exception', {
    error: error.message,
    stack: error.stack
  })
  console.error('🚨 UNCAUGHT EXCEPTION in GatewayWorker:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('GatewayWorker', 'GLOBAL', 'Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack
  })
  console.error('🚨 UNHANDLED REJECTION in GatewayWorker:', reason)
})

class GatewayWorker extends Base {
  constructor(conf, ctx) {
    console.log('🔧 Gateway Worker constructor called with:')
    console.log('   conf:', JSON.stringify(conf, null, 2))
    console.log('   ctx:', JSON.stringify(ctx, null, 2))
    
    super(conf, ctx)
    
    console.log('🔧 Initializing Gateway Worker...')
    this.init()
    
    // Initialize facilities
    console.log('🔧 Setting up facilities...')
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/gateway' }, 0],
      ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
    ])
    
    // Initialize simple metrics (always enabled, minimal overhead)
    this.metrics = new SimpleMetrics('gateway', 9100)
    
    console.log('🎯 =================================')
    console.log('📊 GATEWAY WORKER METRICS')
    console.log('📈 URL: http://localhost:9100/metrics')
    console.log('🎯 =================================')
    
    console.log('✅ Gateway Worker constructor completed')
  }
  
  async _start(cb) {
    console.log('▶️  Gateway Worker _start method called')
    
    try {
      // Log JWT configuration
      const jwtSecret = process.env.JWT_SECRET || 'distributed-ai-secure-secret-key-2025'
      logger.jwt('GatewayWorker', 'STARTUP', 'Secret Configured', {
        secretPreview: jwtSecret.substring(0, 10) + '...',
        isFromEnv: !!process.env.JWT_SECRET
      })
      
      console.log('🔌 Starting RPC server...')
      
      // Check if net facility is available
      if (!this.net_default) {
        console.error('❌ net_default facility not available')
        logger.error('GatewayWorker', 'STARTUP', 'net_default facility not available', {
          availableFacilities: Object.keys(this).filter(k => k.includes('_'))
        })
        return cb(new Error('net_default facility not available'))
      }
      
      console.log('✅ net_default facility is available')
      logger.info('GatewayWorker', 'STARTUP', 'Network facility initialized', {
        facilityReady: true
      })
      
      // Start RPC server
      console.log('🔌 Calling startRpcServer()...')
      await this.net_default.startRpcServer()
      console.log('✅ RPC server started successfully')
      
      // Log RPC server status
      logger.info('GatewayWorker', 'STARTUP', 'RPC server started', {
        rpcServerReady: !!this.net_default.rpcServer,
        rpcClientReady: !!this.net_default.rpc,
        dhtReady: !!this.net_default.dht
      })
      
      // Register RPC methods
      console.log('🔗 Registering RPC methods...')
      if (this.net_default.rpcServer && typeof this.net_default.rpcServer.respond === 'function') {
        // Register all gateway methods with enhanced logging
        const methods = ['ping', 'processPrompt', 'register', 'login', 'verifySession']
        
        // Register ping method for health checks
        this.net_default.rpcServer.respond('ping', async () => {
          console.log('🏓 Gateway received ping health check')
          return { status: 'healthy', timestamp: Date.now(), service: 'gateway' }
        })
        console.log('✅ ping method registered successfully')
        
        this.net_default.rpcServer.respond('processPrompt', async (data) => {
          return await this.net_default.handleReply('processPrompt', data)
        })
        
        this.net_default.rpcServer.respond('register', async (data) => {
          return await this.net_default.handleReply('register', data)
        })
        
        this.net_default.rpcServer.respond('login', async (data) => {
          return await this.net_default.handleReply('login', data)
        })
        
        this.net_default.rpcServer.respond('verifySession', async (data) => {
          return await this.net_default.handleReply('verifySession', data)
        })
        
        console.log('✅ All RPC methods registered successfully')
        
        logger.info('GatewayWorker', 'STARTUP', 'RPC methods registered', {
          methodsRegistered: methods,
          serverReady: true
        })
      } else {
        console.error('❌ RPC server or respond method not available')
        console.log('RPC server:', !!this.net_default.rpcServer)
        console.log('Respond method:', typeof this.net_default.rpcServer?.respond)
        
        logger.error('GatewayWorker', 'STARTUP', 'RPC method registration failed', {
          rpcServer: !!this.net_default.rpcServer,
          respondMethod: typeof this.net_default.rpcServer?.respond,
          rpcServerType: this.net_default.rpcServer ? this.net_default.rpcServer.constructor.name : 'null'
        })
      }
      
      // Start lookup
      console.log('🔍 Starting lookup service...')
      this.net_default.startLookup()
      console.log('✅ Lookup service started')
      
      logger.info('GatewayWorker', 'STARTUP', 'Lookup service started', {
        lookupReady: !!this.net_default.lookup
      })
      
      // Announce our service
      console.log('📢 Announcing gateway service to DHT...')
      await this.net_default.lookup.announceInterval('gateway')
      console.log('✅ Gateway service announced successfully')
      
      // Log service announcement with key details
      logger.info('GatewayWorker', 'STARTUP', 'Service announced to DHT', {
        topic: 'gateway',
        announcementSuccess: true,
        publicKey: this.net_default.rpc?._defaultKeyPair?.publicKey?.toString('hex')?.substring(0, 16) + '...' || 'N/A'
      })
      
      // Log our public key for debugging
      if (this.net_default.rpc && this.net_default.rpc._defaultKeyPair) {
        const publicKey = this.net_default.rpc._defaultKeyPair.publicKey.toString('hex')
        console.log(`🔑 Gateway public key: ${publicKey.substring(0, 16)}...`)
        
        logger.info('GatewayWorker', 'STARTUP', 'Gateway worker fully initialized', {
          publicKeyPreview: publicKey.substring(0, 16) + '...',
          topic: 'gateway',
          methods: ['ping', 'processPrompt', 'register', 'login', 'verifySession'],
          networkReady: true,
          announcementActive: true
        })
      }
      
      // Test connectivity to dependent services
      console.log('🔍 Testing service discovery...')
      
      // Check auth service availability
      try {
        const authKeys = await this.net_default.lookup.lookup('auth', false) // Force fresh lookup
        logger.info('GatewayWorker', 'STARTUP', 'Auth service discovery', {
          authKeysFound: authKeys.length,
          discoverySuccess: authKeys.length > 0
        })
        console.log(`🔍 Found ${authKeys.length} auth service(s) - using fresh DHT lookups to avoid stale announcements`)
      } catch (error) {
        logger.warn('GatewayWorker', 'STARTUP', 'Auth service discovery failed', {
          error: error.message,
          discoveryCritical: false
        })
        console.log(`⚠️  Could not discover auth services: ${error.message}`)
      }
      
      // Check processor service availability
      try {
        const processorKeys = await this.net_default.lookup.lookup('processor', false) // Force fresh lookup
        logger.info('GatewayWorker', 'STARTUP', 'Processor service discovery', {
          processorKeysFound: processorKeys.length,
          discoverySuccess: processorKeys.length > 0
        })
        console.log(`🔍 Found ${processorKeys.length} processor service(s) - using fresh DHT lookups to avoid stale announcements`)
      } catch (error) {
        logger.warn('GatewayWorker', 'STARTUP', 'Processor service discovery failed', {
          error: error.message,
          discoveryCritical: true
        })
        console.log(`⚠️  Could not discover processor services: ${error.message}`)
      }
      
      // Final startup success log
      logger.lifecycle('GatewayWorker', 'STARTED', {
        topic: 'gateway',
        methods: ['ping', 'processPrompt', 'register', 'login', 'verifySession'],
        publicKey: this.net_default.rpc?._defaultKeyPair?.publicKey?.toString('hex')?.substring(0, 16) + '...' || 'N/A',
        startupDuration: 'completed'
      })
      
      console.log('🎉 Gateway Worker ready to handle requests!')
      console.log('')
      console.log('🎯 ==========================================')
      console.log('📊 METRICS: http://localhost:9100/metrics')
      console.log('🎯 ==========================================')
      
      // Call parent's _start method
      super._start(cb)
      
    } catch (error) {
      console.error('❌ Error starting Gateway Worker:', error)
      
      // Enhanced startup error logging
      logger.error('GatewayWorker', 'STARTUP', 'Gateway worker startup failed', {
        error: error.message,
        stack: error.stack,
        networkFacilityAvailable: !!this.net_default,
        startupPhase: 'unknown'
      })
      
      cb(error)
    }
  }
  
  // RPC method called by clients - delegates to helper
  async processPrompt(data) {
    return await this.metrics.wrapRpcMethod('processPrompt', GatewayHelper.processPrompt, this, data)
  }
  
  // RPC method for user registration - delegates to helper
  async register(data) {
    return await this.metrics.wrapRpcMethod('register', GatewayHelper.register, this, data)
  }
  
  // RPC method for user login - delegates to helper
  async login(data) {
    return await this.metrics.wrapRpcMethod('login', GatewayHelper.login, this, data)
  }
  
  // RPC method for session verification - delegates to helper
  async verifySession(data) {
    try {
      return await this.metrics.wrapRpcMethod('verifySession', GatewayHelper.verifySession, this, data)
    } catch (error) {
      console.error('❌ GatewayWorker.verifySession() error:', error.message)
      throw error
    }
  }
  
  // Lifecycle method
  stop() {
    console.log('🛑 Gateway Worker stopping...')
    
    // Stop metrics server
    if (this.metrics) {
      this.metrics.stop()
    }
    
    super.stop()
    console.log('✅ Gateway Worker stopped')
  }
}

// Create worker instance
console.log('🔧 Creating Gateway Worker instance...')

const conf = {
  env: 'development',
  root: process.cwd()
}

const ctx = {
  wtype: 'gateway-worker',
  env: 'dev',
  root: process.cwd()
}

try {
  const worker = new GatewayWorker(conf, ctx)
  
  // Start the worker
  console.log('▶️  Starting Gateway Worker...')
  worker.start((err) => {
    if (err) {
      console.error('❌ Failed to start Gateway Worker:', err)
      process.exit(1)
    }
    
          console.log('🎉 Gateway Worker is now running!')
      console.log('🎯 Listening for "gateway" topic requests')
      console.log('🔍 Available methods: ping, processPrompt, register, login, verifySession')
      console.log('💡 Send processPrompt requests to test functionality')
  })
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down Gateway Worker...')
    worker.stop()
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down Gateway Worker...')
    worker.stop()
    process.exit(0)
  })
  
} catch (error) {
  console.error('❌ Failed to create Gateway Worker:', error.message)
  console.error('❌ Error stack:', error.stack)
  process.exit(1)
} 