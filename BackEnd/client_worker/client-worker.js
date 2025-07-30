'use strict'

// Load dependencies with error handling
try {
  const Base = require('../bfx-wrk-base/base.js')
} catch (error) {
  console.error('❌ Failed to load bfx-wrk-base:', error.message)
  process.exit(1)
}

const Base = require('../bfx-wrk-base/base.js')
const ClientHelper = require('./client-helper.js')
const logger = require('../shared-logger.js')

class ClientWorker extends Base {
  constructor(conf, ctx) {
    super(conf, ctx)
    this.init()
    
    // Initialize session key for auth
    this.sessionKey = null
    logger.debug('ClientWorker', 'INIT', 'Session key initialized', null)
    
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/client' }, 0],
      ['fac', 'hp-svc-facs-net', 'net', 'default', { allowLocal: true }, 10]
    ])
  }
  
  async _start(cb) {
    logger.lifecycle('ClientWorker', 'STARTING', {
      robustDht: true,
      facilities: ['hp-svc-facs-store', 'hp-svc-facs-net']
    })
    
    try {
      // Check if net facility is available
      if (!this.net_default) {
        const error = new Error('net_default facility not available')
        logger.error('ClientWorker', 'STARTUP', 'Net facility not available', {
          error: error.message
        })
        return cb(error)
      }
      
      // Start RPC client
      await this.net_default.startRpc()
      logger.info('ClientWorker', 'STARTUP', 'RPC client started successfully', null)
      
      // Start lookup
      this.net_default.startLookup()
      logger.info('ClientWorker', 'STARTUP', 'Lookup service started successfully', null)
      
      logger.lifecycle('ClientWorker', 'STARTED', {
        robustDhtEnabled: true,
        features: ['robust_retries', 'stale_announcement_handling', 'service_failure_recovery']
      })
      
      cb()
      
    } catch (error) {
      logger.error('ClientWorker', 'STARTUP', 'Failed to start Client Worker', {
        error: error.message,
        stack: error.stack
      })
      
      cb(error)
    }
  }
  
  // Delegates to helper
  async sendRequest(inputPrompt) {
    return await ClientHelper.sendRequest(this, inputPrompt)
  }
  
  // Delegates to helper
  async registerUser(email, password) {
    return await ClientHelper.registerUser(this, email, password)
  }
  
  // Delegates to helper
  async loginUser(email, password) {
    return await ClientHelper.loginUser(this, email, password)
  }
  
  // Delegates to helper
  logout() {
    return ClientHelper.logout(this)
  }
  
  // Delegates to helper
  async verifySession() {
    return await ClientHelper.verifySession(this)
  }
  
  // Delegates to helper
  getApiToken() {
    return ClientHelper.getApiToken(this)
  }
  

  
  stop() {
    logger.lifecycle('ClientWorker', 'STOPPING', null)
    super.stop()
    logger.lifecycle('ClientWorker', 'STOPPED', null)
  }
}

module.exports = ClientWorker 