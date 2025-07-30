'use strict'

const async = require('async')
const RPC = require('@hyperswarm/rpc')
const Base = require('bfx-facs-base')
const libKeys = require('hyper-cmd-lib-keys')
const DHT = require('hyperdht')
const Hyperswarm = require('hyperswarm')
const os = require('os')

const HyperDHTLookup = require('./lib/hyperdht.lookup')

class NetFacility extends Base {
  constructor (caller, opts, ctx) {
    super(caller, opts, ctx)

    this.name = 'net'
    this._hasConf = true

    if (!this.opts.timeout) {
      this.opts.timeout = 30000
    }

    if (!this.opts.poolLinger) {
      this.opts.poolLinger = 300000
    }

    this.init()
  }

  parseInputJSON (data) {
    data = data.toString()

    try {
      data = JSON.parse(data)
    } catch (e) {
      throw new Error('ERR_FACS_NET_DATA_FORMAT')
    }

    return data
  }

  handleInputError (data) {
    if (typeof data !== 'string' && !(data instanceof String)) {
      return
    }

    let isErr = false

    if (data.slice(0, 15).includes('[HRPC_ERR]=')) {
      isErr = true
    }

    if (!isErr) {
      return
    }

    throw new Error(data)
  }

  toOutJSON (data) {
    return Buffer.from(JSON.stringify(data))
  }

  toOut (data) {
    return Buffer.from(data.toString())
  }

  async jRequest (key, method, data, opts = {}) {
    if (!this.rpc) {
      throw new Error('ERR_FACS_NET_RPC_NOTFOUND')
    }

    if (!opts.timeout) {
      opts.timeout = this.opts.timeout
    }

    let res = await this.rpc.request(
      Buffer.from(key, 'hex'), method,
      this.toOutJSON(data), opts
    )

    res = this.parseInputJSON(res)
    this.handleInputError(res)

    return res
  }

  async jTopicRequest (topic, method, data, opts = {}, cached = false) {
    const key = await this.lookupTopicKey(topic, cached)
    return this.jRequest(key, method, data, opts)
  }

  /**
   * Robust topic request with retry logic for handling stale DHT keys
   * Based on research: handles "CHANNEL_CLOSED" errors due to stale peer information
   * @param {string} topic - The topic to send the request to
   * @param {string} method - The RPC method to call
   * @param {object} data - The data payload to send
   * @param {object} opts - Request options (timeout, etc.)
   * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
   * @param {number} baseDelay - Base delay between retries in ms (default: 100)
   * @returns {Promise} The response from the remote peer
   */
  async jTopicRequestRobust (topic, method, data, opts = {}, maxRetries = 3, baseDelay = 100) {
    let lastError = null
    const sessionId = Math.random().toString(36).substr(2, 9)
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Force fresh DHT lookup on retries to avoid stale keys
        const useCache = attempt === 1 ? false : false // Always force fresh lookup
        
        // For retry attempts after the first, add a small delay to allow DHT to update
        if (attempt > 1) {
          const delay = baseDelay * Math.pow(1.5, attempt - 2) // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        // Get fresh keys from DHT lookup
        const keys = await this.lookup.lookup(topic, useCache)
        if (!keys.length) {
          throw new Error('ERR_TOPIC_LOOKUP_EMPTY')
        }
        
        // Try each available key until one works
        for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
          try {
            const key = keys[keyIndex]
            const result = await this.jRequest(key, method, data, opts)
            
            // Log success if it was a retry
            if (attempt > 1 || keyIndex > 0) {
              console.log(`✅ jTopicRequestRobust succeeded on attempt ${attempt}, key ${keyIndex + 1}/${keys.length}`)
            }
            
            return result
          } catch (keyError) {
            // If this is a connection error and we have more keys to try, continue
            if (keyIndex < keys.length - 1 && this.isConnectionError(keyError)) {
              console.log(`⚠️  Key ${keyIndex + 1} failed (${keyError.message}), trying next key...`)
              continue
            }
            // If no more keys or non-connection error, propagate error
            throw keyError
          }
        }
        
      } catch (error) {
        lastError = error
        
        // Check if this is a retryable error (connection issues, stale DHT)
        const isRetryable = this.isRetryableError(error)
        const isLastAttempt = attempt === maxRetries
        
        if (!isRetryable || isLastAttempt) {
          // If not retryable or last attempt, throw the error
          if (isLastAttempt && isRetryable) {
            console.error(`❌ jTopicRequestRobust failed after ${maxRetries} attempts. Final error: ${error.message}`)
          }
          throw error
        }
        
        // Log retry attempt
        console.log(`⚠️  Attempt ${attempt}/${maxRetries} failed (${error.message}), retrying...`)
      }
    }
    
    // This shouldn't be reached, but just in case
    throw lastError || new Error('jTopicRequestRobust: Unexpected error state')
  }

  /**
   * Check if an error indicates a connection problem that might be resolved by retry
   * @param {Error} error - The error to check
   * @returns {boolean} True if the error is likely retryable
   */
  isRetryableError (error) {
    const retryableErrors = [
      'CHANNEL_CLOSED',
      'channel closed',
      'connection closed',
      'Connection closed',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'timeout',
      'Timeout'
    ]
    
    const errorMessage = error.message || error.toString()
    return retryableErrors.some(pattern => 
      errorMessage.includes(pattern)
    )
  }

  /**
   * Check if an error is specifically a connection error (not auth/validation)
   * @param {Error} error - The error to check  
   * @returns {boolean} True if it's a connection error
   */
  isConnectionError (error) {
    return this.isRetryableError(error)
  }

  async jEvent (k, m, d) {
    if (!this.rpc) {
      throw new Error('ERR_FACS_NET_RPC_NOTFOUND')
    }

    await this.rpc.event(
      Buffer.from(k, 'hex'), m,
      this.toOutJSON(d)
    )
  }

  async jTopicEvent (topic, method, data, cached = true) {
    const key = await this.lookupTopicKey(topic, cached)
    return this.jEvent(key, method, data)
  }

  async handleReply (met, data) {
    try {
      data = this.parseInputJSON(data)
    } catch (e) {
      return this.toOutJSON(`[HRPC_ERR]=${e.message}`)
    }

    try {
      const res = await this.caller[met](data)
      return this.toOutJSON(res)
    } catch (e) {
      return this.toOutJSON(`[HRPC_ERR]=${e.message}`)
    }
  }

  async getSeed (name) {
    const store = this.opts.fac_store || this.caller.store_s0

    const confBee = await store.getBee(
      { name: 'storeConf' },
      { keyEncoding: 'utf-8' }
    )
    await confBee.ready()

    let seed = await confBee.get(name)

    if (seed) {
      seed = seed.value
    } else {
      seed = libKeys.randomBytes(32)
      await confBee.put(name, seed)
    }

    return seed
  }

  buildFirewall (allowed, allowLocal = false) {
    // convert keys to Buffer if string
    allowed = allowed?.map(k => typeof k === 'string' ? Buffer.from(k, 'hex') : k)

    // if firewall enabled, allow from local ip
    const localIp = allowLocal ? this.getLocalIPAddress() : null

    return (remotePublicKey, remoteHandshakePayload) => {
      if (allowed && !libKeys.checkAllowList(allowed, remotePublicKey)) {
        if (allowLocal && localIp && remoteHandshakePayload?.addresses4) {
          for (const remoteHost of remoteHandshakePayload.addresses4) {
            if (remoteHost.host === localIp) return false
          }
        }

        return true
      }

      return false
    }
  }

  getLocalIPAddress () {
    for (const devices of Object.values(os.networkInterfaces())) {
      const device = devices.find(d => d.family === 'IPv4' && d.address !== '127.0.0.1' && !d.internal)
      if (device) return device.address
    }

    return '127.0.0.1'
  }

  async lookupTopicKey (topic, cached = true) {
    if (!this.lookup) {
      throw new Error('ERR_FACS_NET_LOOKUP_NOTFOUND')
    }

    const keys = await this.lookup.lookup(topic, cached)
    if (!keys.length) {
      throw new Error('ERR_TOPIC_LOOKUP_EMPTY')
    }

    const index = Math.floor(Math.random() * keys.length)
    return keys[index]
  }

  async startRpcServer (keyPair = null) {
    if (this.rpcServer) {
      return
    }

    await this.startRpc(keyPair)

    const server = this.rpc.createServer({
      firewall: this.buildFirewall(this.conf.allow, this.conf.allowLocal)
    })

    await server.listen()

    this.rpcServer = server
  }

  async startRpc (keyPair) {
    if (this.rpc) {
      return
    }

    const rpcOpts = {
      dht: this.dht,
      poolLinger: this.opts.poolLinger
    }

    if (keyPair) {
      rpcOpts.keyPair = keyPair
    } else {
      rpcOpts.seed = await this.getSeed('seedRpc')
    }

    const rpc = new RPC(rpcOpts)

    this.rpc = rpc
  }

  async startSwarm () {
    const seed = await this.getSeed('seedSwarm')

    const swarm = new Hyperswarm({
      seed,
      dht: this.dht
    })

    this.swarm = swarm
  }

  startLookup (opts) {
    if (!this.rpc) {
      throw new Error('ERR_FACS_NET_RPC_NOTFOUND')
    }

    this.lookup = new HyperDHTLookup({
      dht: this.dht,
      keyPair: this.rpc._defaultKeyPair,
      ...opts
    })
    this.lookup.start()
  }

  _start (cb) {
    async.series([
      next => { super._start(next) },
      async () => {
        const seed = await this.getSeed('seedDht')
        const keyPair = DHT.keyPair(seed)

        this.dht = new DHT({ keyPair })
      }
    ], cb)
  }

  _stop (cb) {
    async.series([
      next => { super._stop(next) },
      async () => {
        if (this.rpcServer) {
          await this.rpcServer.close()
        }

        if (this.rpc) {
          await this.rpc.destroy()
        }

        await this.dht.destroy()
        if (this.lookup) {
          await this.lookup.stop()
        }
      }
    ], cb)
  }
}

module.exports = NetFacility
