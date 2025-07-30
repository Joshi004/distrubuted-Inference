'use strict'

require('dotenv').config()

// Load dependencies with error handling
try {
  const Base = require('bfx-wrk-base')
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
    super(conf, ctx)
    
    logger.lifecycle('GatewayWorker', 'INITIALIZING', {
      conf: conf,
      ctx: ctx
    })
    
    this.init()
    
    // Initialize facilities
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/gateway' }, 0],
      ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
    ])
    
    this.metrics = new SimpleMetrics('gateway', 9100)
    
    logger.lifecycle('GatewayWorker', 'CONSTRUCTOR_COMPLETED', {
      metricsPort: 9100,
      metricsUrl: 'http://localhost:9100/metrics'
    })
  }
  
  async _start(cb) {
    logger.lifecycle('GatewayWorker', 'STARTING', {})
    
    try {
      // Log JWT configuration
      const jwtSecret = process.env.JWT_SECRET || 'distributed-ai-secure-secret-key-2025'
      logger.jwt('GatewayWorker', 'STARTUP', 'Secret Configured', {
        secretPreview: jwtSecret.substring(0, 10) + '...',
        isFromEnv: !!process.env.JWT_SECRET
      })
      
      // Check if net facility is available
      if (!this.net_default) {
        logger.error('GatewayWorker', 'STARTUP', 'net_default facility not available', {
          availableFacilities: Object.keys(this).filter(k => k.includes('_'))
        })
        return cb(new Error('net_default facility not available'))
      }
      
      logger.info('GatewayWorker', 'STARTUP', 'Network facility initialized', {
        facilityReady: true
      })
      
      // Start RPC server
      await this.net_default.startRpcServer()
      
      // Log RPC server status
      logger.info('GatewayWorker', 'STARTUP', 'RPC server started', {
        rpcServerReady: !!this.net_default.rpcServer,
        rpcClientReady: !!this.net_default.rpc,
        dhtReady: !!this.net_default.dht
      })
      
      // Register RPC methods
      if (this.net_default.rpcServer && typeof this.net_default.rpcServer.respond === 'function') {
        // Register all gateway methods with enhanced logging
        const methods = ['ping', 'processPrompt', 'register', 'login', 'verifySession']
        
        // Register ping method for health checks
        this.net_default.rpcServer.respond('ping', async () => {
          logger.debug('GatewayWorker', 'PING', 'Health check received', {})
          return { status: 'healthy', timestamp: Date.now(), service: 'gateway' }
        })
        
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
        
        logger.info('GatewayWorker', 'STARTUP', 'RPC methods registered', {
          methodsRegistered: methods,
          serverReady: true
        })
      } else {
        logger.error('GatewayWorker', 'STARTUP', 'RPC method registration failed', {
          rpcServer: !!this.net_default.rpcServer,
          respondMethod: typeof this.net_default.rpcServer?.respond,
          rpcServerType: this.net_default.rpcServer ? this.net_default.rpcServer.constructor.name : 'null'
        })
      }
      
      // Start lookup
      this.net_default.startLookup()
      
      logger.info('GatewayWorker', 'STARTUP', 'Lookup service started', {
        lookupReady: !!this.net_default.lookup
      })
      
      // Announce our service
      await this.net_default.lookup.announceInterval('gateway')
      
      // Log service announcement with key details
      logger.info('GatewayWorker', 'STARTUP', 'Service announced to DHT', {
        topic: 'gateway',
        announcementSuccess: true,
        publicKey: this.net_default.rpc?._defaultKeyPair?.publicKey?.toString('hex')?.substring(0, 16) + '...' || 'N/A'
      })
      
      // Log our public key for debugging
      if (this.net_default.rpc && this.net_default.rpc._defaultKeyPair) {
        const publicKey = this.net_default.rpc._defaultKeyPair.publicKey.toString('hex')
        
        logger.info('GatewayWorker', 'STARTUP', 'Gateway worker fully initialized', {
          publicKeyPreview: publicKey.substring(0, 16) + '...',
          topic: 'gateway',
          methods: ['ping', 'processPrompt', 'register', 'login', 'verifySession'],
          networkReady: true,
          announcementActive: true
        })
      }
      
      // Check auth service availability
      try {
        const authKeys = await this.net_default.lookup.lookup('auth', false) // Force fresh lookup
        logger.info('GatewayWorker', 'STARTUP', 'Auth service discovery', {
          authKeysFound: authKeys.length,
          discoverySuccess: authKeys.length > 0
        })
      } catch (error) {
        logger.warn('GatewayWorker', 'STARTUP', 'Auth service discovery failed', {
          error: error.message,
          discoveryCritical: false
        })
      }
      
      // Check processor service availability
      try {
        const processorKeys = await this.net_default.lookup.lookup('processor', false) // Force fresh lookup
        logger.info('GatewayWorker', 'STARTUP', 'Processor service discovery', {
          processorKeysFound: processorKeys.length,
          discoverySuccess: processorKeys.length > 0
        })
      } catch (error) {
        logger.warn('GatewayWorker', 'STARTUP', 'Processor service discovery failed', {
          error: error.message,
          discoveryCritical: true
        })
      }
      
      // Final startup success log
      logger.lifecycle('GatewayWorker', 'STARTED', {
        topic: 'gateway',
        methods: ['ping', 'processPrompt', 'register', 'login', 'verifySession'],
        publicKey: this.net_default.rpc?._defaultKeyPair?.publicKey?.toString('hex')?.substring(0, 16) + '...' || 'N/A',
        startupDuration: 'completed',
        metricsUrl: 'http://localhost:9100/metrics'
      })
      
      // Call parent's _start method
      super._start(cb)
      
    } catch (error) {
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
      logger.error('GatewayWorker', 'RPC', 'verifySession method error', {
        error: error.message,
        method: 'verifySession'
      })
      throw error
    }
  }
  
  // Lifecycle method
  stop() {
    logger.lifecycle('GatewayWorker', 'STOPPING', {})
    
    // Stop metrics server
    if (this.metrics) {
      this.metrics.stop()
    }
    
    super.stop()
    logger.lifecycle('GatewayWorker', 'STOPPED', {})
  }
}

// Create worker instance
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
  worker.start((err) => {
    if (err) {
      logger.error('GatewayWorker', 'STARTUP', 'Failed to start Gateway Worker', {
        error: err.message,
        stack: err.stack
      })
      process.exit(1)
    }
    
    logger.lifecycle('GatewayWorker', 'READY', {
      topic: 'gateway',
      methods: ['ping', 'processPrompt', 'register', 'login', 'verifySession'],
      ready: true
    })
  })
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.lifecycle('GatewayWorker', 'SIGINT_RECEIVED', {})
    worker.stop()
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    logger.lifecycle('GatewayWorker', 'SIGTERM_RECEIVED', {})
    worker.stop()
    process.exit(0)
  })
  
} catch (error) {
  logger.error('GatewayWorker', 'INIT', 'Failed to create Gateway Worker', {
    error: error.message,
    stack: error.stack
  })
  process.exit(1)
} 