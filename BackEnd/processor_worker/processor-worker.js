'use strict'

console.log('🚀 Processor Worker starting...')

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
  console.log('✅ Successfully loaded bfx-wrk-base')
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
    console.log('🔧 Processor Worker constructor called with:')
    console.log('   conf:', JSON.stringify(conf, null, 2))
    console.log('   ctx:', JSON.stringify(ctx, null, 2))
    
    super(conf, ctx)
    
    console.log('🔧 Initializing Processor Worker...')
    this.init()
    
    // Initialize facilities
    console.log('🔧 Setting up facilities...')
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/processor' }, 0],
      ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
    ])
    
    // Initialize simple metrics
    this.metrics = new SimpleMetrics('processor', 9102)
    
    console.log('🎯 =================================')
    console.log('🔄 PROCESSOR WORKER METRICS')
    console.log('📈 URL: http://localhost:9102/metrics')
    console.log('🎯 =================================')
    
    console.log('✅ Processor Worker constructor completed')
  }
  
  async _start(cb) {
    console.log('▶️  Processor Worker _start method called')
    
    try {
      console.log('🔌 Starting RPC server...')
      
      // Check if net facility is available
      if (!this.net_default) {
        console.error('❌ net_default facility not available')
        logger.error('ProcessorWorker', 'STARTUP', 'net_default facility not available', {
          availableFacilities: Object.keys(this).filter(k => k.includes('_'))
        })
        return cb(new Error('net_default facility not available'))
      }
      
      console.log('✅ net_default facility is available')
      logger.info('ProcessorWorker', 'STARTUP', 'Network facility initialized', {
        facilityReady: true
      })
      
      // Start RPC server
      console.log('🔌 Calling startRpcServer()...')
      await this.net_default.startRpcServer()
      console.log('✅ RPC server started successfully')
      
      // Log RPC server status
      logger.info('ProcessorWorker', 'STARTUP', 'RPC server started', {
        rpcServerReady: !!this.net_default.rpcServer,
        rpcClientReady: !!this.net_default.rpc,
        dhtReady: !!this.net_default.dht
      })
      
      // Register RPC methods using the correct API
      console.log('🔗 Registering RPC methods...')
      if (this.net_default.rpcServer && typeof this.net_default.rpcServer.respond === 'function') {
        this.net_default.rpcServer.respond('processRequest', async (data) => {
          const requestId = Math.random().toString(36).substr(2, 9)
          console.log(`📨 [${requestId}] Processor received processRequest RPC call`)
          
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
        console.log('✅ processRequest method registered successfully')
        
        logger.info('ProcessorWorker', 'STARTUP', 'RPC methods registered', {
          methodsRegistered: ['processRequest'],
          serverReady: true
        })
      } else {
        console.error('❌ RPC server or respond method not available')
        console.log('RPC server:', !!this.net_default.rpcServer)
        console.log('Respond method:', typeof this.net_default.rpcServer?.respond)
        
        logger.error('ProcessorWorker', 'STARTUP', 'RPC method registration failed', {
          rpcServer: !!this.net_default.rpcServer,
          respondMethod: typeof this.net_default.rpcServer?.respond,
          rpcServerType: this.net_default.rpcServer ? this.net_default.rpcServer.constructor.name : 'null'
        })
      }
      
      // Start lookup
      console.log('🔍 Starting lookup service...')
      this.net_default.startLookup()
      console.log('✅ Lookup service started')
      
      logger.info('ProcessorWorker', 'STARTUP', 'Lookup service started', {
        lookupReady: !!this.net_default.lookup
      })
      
      // Announce our service
      console.log('📢 Announcing processor service to DHT...')
      await this.net_default.lookup.announceInterval('processor')
      console.log('✅ Processor service announced successfully')
      
      // Log service announcement with key details
      logger.info('ProcessorWorker', 'STARTUP', 'Service announced to DHT', {
        topic: 'processor',
        announcementSuccess: true,
        publicKey: this.net_default.rpc?._defaultKeyPair?.publicKey?.toString('hex')?.substring(0, 16) + '...' || 'N/A'
      })
      
      // Log our public key for debugging
      if (this.net_default.rpc && this.net_default.rpc._defaultKeyPair) {
        const publicKey = this.net_default.rpc._defaultKeyPair.publicKey.toString('hex')
        console.log(`🔑 Processor public key: ${publicKey.substring(0, 16)}...`)
        
        logger.info('ProcessorWorker', 'STARTUP', 'Processor worker fully initialized', {
          publicKeyPreview: publicKey.substring(0, 16) + '...',
          topic: 'processor',
          methods: ['processRequest'],
          networkReady: true,
          announcementActive: true
        })
      }
      
      // Final startup success log
      logger.lifecycle('ProcessorWorker', 'STARTED', {
        topic: 'processor',
        methods: ['processRequest'],
        publicKey: this.net_default.rpc?._defaultKeyPair?.publicKey?.toString('hex')?.substring(0, 16) + '...' || 'N/A',
        startupDuration: 'completed'
      })
      
      console.log('🎉 Processor Worker ready to handle requests!')
      cb()
      
    } catch (error) {
      console.error('❌ Error starting Processor Worker:', error)
      
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
  
  // Lifecycle method
  stop() {
    console.log('🛑 Processor Worker stopping...')
    super.stop()
    console.log('✅ Processor Worker stopped')
  }
}

// Create worker instance
console.log('🔧 Creating Processor Worker instance...')

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
  console.log('▶️  Starting Processor Worker...')
  worker.start((err) => {
    if (err) {
      console.error('❌ Failed to start Processor Worker:', err)
      process.exit(1)
    }
    
          console.log('🎉 Processor Worker is now running!')
      console.log('🎯 Listening for "processor" topic requests')
      console.log('💡 Send any prompt to the AI model for processing')
      console.log('')
      console.log('🎯 ==========================================')
      console.log('📊 METRICS: http://localhost:9102/metrics')
      console.log('🎯 ==========================================')
  })
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down Processor Worker...')
    worker.stop()
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down Processor Worker...')
    worker.stop()
    process.exit(0)
  })
  
} catch (error) {
  console.error('❌ Failed to create Processor Worker:', error.message)
  console.error('❌ Error stack:', error.stack)
  process.exit(1)
} 