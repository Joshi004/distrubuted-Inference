'use strict'

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ fetch is not available. This requires Node.js 18+ or you can install node-fetch as a polyfill.')
  console.error('   Run: npm install node-fetch')
  console.error('   Or upgrade to Node.js 18+')
  process.exit(1)
}

// Load dependencies with error handling
try {
  const Base = require('../bfx-wrk-base/base.js')
} catch (error) {
  console.error('❌ Failed to load bfx-wrk-base:', error.message)
  process.exit(1)
}

const Base = require('../bfx-wrk-base/base.js')
const ProcessorHelper = require('./processor-helper.js')
const logger = require('../shared-logger.js')
const SimpleMetrics = require('../simple-metrics.js')

class ProcessorWorker extends Base {
  constructor(conf, ctx) {
    logger.lifecycle('ProcessorWorker', 'CONSTRUCTOR_START', { conf, ctx })
    
    super(conf, ctx)
    
    logger.info('ProcessorWorker', 'CONSTRUCTOR', 'Initializing ProcessorWorker', {})
    this.init()
    
    // Initialize facilities
    logger.info('ProcessorWorker', 'CONSTRUCTOR', 'Setting up facilities', {
      facilities: ['hp-svc-facs-store', 'hp-svc-facs-net']
    })
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/processor' }, 0],
      ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
    ])
    
    // Initialize simple metrics
    this.metrics = new SimpleMetrics('processor', 9102)
    logger.info('ProcessorWorker', 'CONSTRUCTOR', 'Metrics initialized', {
      service: 'processor',
      port: 9102,
      metricsUrl: 'http://localhost:9102/metrics'
    })
    
    logger.lifecycle('ProcessorWorker', 'CONSTRUCTOR_COMPLETE', {})
  }
  
  async _start(cb) {
    logger.lifecycle('ProcessorWorker', 'START_INITIATED', {})
    
    try {
      logger.info('ProcessorWorker', 'STARTUP', 'Starting RPC server', {})
      
      // Check if net facility is available
      if (!this.net_default) {
        logger.error('ProcessorWorker', 'STARTUP', 'net_default facility not available', {
          availableFacilities: Object.keys(this).filter(k => k.includes('_'))
        })
        return cb(new Error('net_default facility not available'))
      }
      
      logger.info('ProcessorWorker', 'STARTUP', 'Network facility initialized', {
        facilityReady: true
      })
      
      // Start RPC server
      logger.info('ProcessorWorker', 'STARTUP', 'Calling startRpcServer', {})
      await this.net_default.startRpcServer()
      logger.info('ProcessorWorker', 'STARTUP', 'RPC server started successfully', {})
      
      // Log RPC server status
      logger.info('ProcessorWorker', 'STARTUP', 'RPC server started', {
        rpcServerReady: !!this.net_default.rpcServer,
        rpcClientReady: !!this.net_default.rpc,
        dhtReady: !!this.net_default.dht
      })
      
      // Register RPC methods using the correct API
      logger.info('ProcessorWorker', 'STARTUP', 'Registering RPC methods', {})
      if (this.net_default.rpcServer && typeof this.net_default.rpcServer.respond === 'function') {
        // Register ping method for health checks
        this.net_default.rpcServer.respond('ping', async () => {
          logger.debug('ProcessorWorker', 'PING', 'Health check received', {})
          return { status: 'healthy', timestamp: Date.now(), service: 'processor' }
        })
        logger.info('ProcessorWorker', 'STARTUP', 'Ping method registered', {})
        
        this.net_default.rpcServer.respond('processRequest', async (data) => {
          const requestId = Math.random().toString(36).substr(2, 9)
          logger.rpc('ProcessorWorker', requestId, 'processRequest', 'RECEIVED', {
            hasData: !!data,
            dataType: typeof data
          })
          
          // Log incoming request details
          logger.info('ProcessorWorker', requestId, 'Processing request received', {
            hasData: !!data,
            dataSize: data ? JSON.stringify(data).length : 0,
            dataType: typeof data
          })
          
          try {
            // Use NetFacility's handleReply which handles JSON parsing/serialization
            const result = await this.net_default.handleReply('processRequest', data)
            
            // Log successful processing
            logger.info('ProcessorWorker', requestId, 'Processing request completed', {
              responseSize: result ? result.length : 0,
              processingSuccess: true
            })
            
            return result
          } catch (error) {
            // Log processing error
            logger.error('ProcessorWorker', requestId, 'Processing request failed', {
              error: error.message,
              stack: error.stack,
              inputData: data ? JSON.stringify(data).substring(0, 200) : 'null'
            })
            throw error
          }
        })
        logger.info('ProcessorWorker', 'STARTUP', 'ProcessRequest method registered', {})
        
        logger.info('ProcessorWorker', 'STARTUP', 'RPC methods registered', {
          methodsRegistered: ['ping', 'processRequest'],
          serverReady: true
        })
      } else {
        
        logger.error('ProcessorWorker', 'STARTUP', 'RPC method registration failed', {
          rpcServer: !!this.net_default.rpcServer,
          respondMethod: typeof this.net_default.rpcServer?.respond,
          rpcServerType: this.net_default.rpcServer ? this.net_default.rpcServer.constructor.name : 'null'
        })
      }
      
      // Start lookup
      logger.info('ProcessorWorker', 'STARTUP', 'Starting lookup service', {})
      this.net_default.startLookup()
      logger.info('ProcessorWorker', 'STARTUP', 'Lookup service started successfully', {})
      
      logger.info('ProcessorWorker', 'STARTUP', 'Lookup service started', {
        lookupReady: !!this.net_default.lookup
      })
      
      // Announce our service
      logger.info('ProcessorWorker', 'STARTUP', 'Announcing service to DHT', {
        topic: 'processor'
      })
      await this.net_default.lookup.announceInterval('processor')
      logger.info('ProcessorWorker', 'STARTUP', 'Service announced successfully', {})
      
      // Log service announcement with key details
      logger.info('ProcessorWorker', 'STARTUP', 'Service announced to DHT', {
        topic: 'processor',
        announcementSuccess: true,
        publicKey: this.net_default.rpc?._defaultKeyPair?.publicKey?.toString('hex')?.substring(0, 16) + '...' || 'N/A'
      })
      
      // Log our public key for debugging
      if (this.net_default.rpc && this.net_default.rpc._defaultKeyPair) {
        const publicKey = this.net_default.rpc._defaultKeyPair.publicKey.toString('hex')
        logger.debug('ProcessorWorker', 'STARTUP', 'Public key available', {
          publicKeyPreview: publicKey.substring(0, 16) + '...'
        })
        
        logger.info('ProcessorWorker', 'STARTUP', 'Processor worker fully initialized', {
          publicKeyPreview: publicKey.substring(0, 16) + '...',
          topic: 'processor',
          methods: ['ping', 'processRequest'],
          networkReady: true,
          announcementActive: true
        })
      }
      
      // Final startup success log
      logger.lifecycle('ProcessorWorker', 'STARTED', {
        topic: 'processor',
        methods: ['ping', 'processRequest'],
        publicKey: this.net_default.rpc?._defaultKeyPair?.publicKey?.toString('hex')?.substring(0, 16) + '...' || 'N/A',
        startupDuration: 'completed'
      })
      
      logger.lifecycle('ProcessorWorker', 'READY', {
        message: 'ProcessorWorker ready to handle requests'
      })
      cb()
      
    } catch (error) {
      logger.error('ProcessorWorker', 'STARTUP', 'Error starting ProcessorWorker', {
        error: error.message,
        stack: error.stack
      })
      
      // Enhanced startup error logging
      logger.error('ProcessorWorker', 'STARTUP', 'Processor worker startup failed', {
        error: error.message,
        stack: error.stack,
        networkFacilityAvailable: !!this.net_default,
        startupPhase: 'unknown'
      })
      
      cb(error)
    }
  }
  
  // RPC method called by gateway - delegates to helper (async, non-blocking)
  async processRequest(data) {
    return await this.metrics.wrapRpcMethod('processRequest', ProcessorHelper.processRequest, this, data)
  }
  
  // Enhanced lifecycle method with proper DHT cleanup
  async stop(cb) {
    logger.lifecycle('ProcessorWorker', 'STOPPING', {})
    
    try {
      // Log shutdown start
      logger.info('ProcessorWorker', 'SHUTDOWN', 'Starting graceful shutdown', {
        topic: 'processor',
        announcementCleanup: true
      })
      
      // Clean up DHT announcements before stopping
      if (this.net_default && this.net_default.lookup) {
        logger.info('ProcessorWorker', 'SHUTDOWN', 'Cleaning up DHT announcements', {
          topic: 'processor'
        })
        await this.net_default.lookup.unnannounceInterval('processor')
        logger.info('ProcessorWorker', 'SHUTDOWN', 'DHT announcements cleaned', {
          topic: 'processor',
          cleanupSuccess: true
        })
      }
      
      // Call parent stop method
      super.stop(() => {
        logger.lifecycle('ProcessorWorker', 'STOPPED', {
          topic: 'processor',
          shutdownComplete: true
        })
        
        if (cb) cb()
      })
      
    } catch (error) {
      logger.error('ProcessorWorker', 'SHUTDOWN', 'Shutdown error', {
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

// Export the class for testing
module.exports = ProcessorWorker

// Only execute if this file is run directly (not required)
if (require.main === module) {
  // Create worker instance
  const logger = require('../shared-logger.js')
  logger.lifecycle('ProcessorWorker', 'INITIALIZATION', {
    message: 'Creating ProcessorWorker instance'
  })

  const conf = {
    env: 'development',
    root: process.cwd()
  }

  const ctx = {
    wtype: 'processor-worker',
    env: 'dev',
    root: process.cwd()
  }

  try {
    const worker = new ProcessorWorker(conf, ctx)
  
    // Start the worker
    logger.info('ProcessorWorker', 'MAIN', 'Starting ProcessorWorker', {})
    worker.start((err) => {
      if (err) {
        logger.error('ProcessorWorker', 'MAIN', 'Failed to start ProcessorWorker', {
          error: err.message,
          stack: err.stack
        })
        process.exit(1)
      }
      
      logger.lifecycle('ProcessorWorker', 'RUNNING', {
        topic: 'processor',
        metricsUrl: 'http://localhost:9102/metrics',
        status: 'ready'
      })
    })
  
    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.lifecycle('ProcessorWorker', 'SIGINT_RECEIVED', {
        message: 'Graceful shutdown initiated'
      })
      worker.stop()
      process.exit(0)
    })
  
    process.on('SIGTERM', () => {
      logger.lifecycle('ProcessorWorker', 'SIGTERM_RECEIVED', {
        message: 'Graceful shutdown initiated'
      })
      worker.stop()
      process.exit(0)
    })
  
  } catch (error) {
    logger.error('ProcessorWorker', 'MAIN', 'Failed to create ProcessorWorker', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  }
} 