'use strict'

console.log('🚀 Client Worker starting...')

// Load dependencies with error handling
try {
  const Base = require('../bfx-wrk-base/base.js')
  console.log('✅ Successfully loaded bfx-wrk-base')
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
    console.log('🔐 Session key initialized')
    
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/client' }, 0],
      ['fac', 'hp-svc-facs-net', 'net', 'default', { allowLocal: true }, 10]
    ])
  }
  
  async _start(cb) {
    console.log('▶️  Starting Client Worker...')
    
    try {
      // Check if net facility is available
      if (!this.net_default) {
        console.error('❌ net_default facility not available')
        return cb(new Error('net_default facility not available'))
      }
      
      // Start RPC client
      await this.net_default.startRpc()
      console.log('✅ RPC client started')
      
      // Start lookup
      this.net_default.startLookup()
      console.log('✅ Lookup service started')
      
      console.log('🎉 Client Worker ready!')
      
      cb()
      
    } catch (error) {
      console.error('❌ Error starting Client Worker:', error)
      
      // Log the startup error to error.log
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
    console.log('🛑 Client Worker stopping...')
    super.stop()
    console.log('✅ Client Worker stopped')
  }
}

module.exports = ClientWorker 