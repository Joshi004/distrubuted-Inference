'use strict'

const client = require('prom-client')
const express = require('express')

class SimpleMetrics {
  constructor(workerName, port = 9100) {
    this.workerName = workerName
    this.port = port
    this.register = new client.Registry()
    
    // Add basic labels
    this.register.setDefaultLabels({
      worker: workerName
    })
    
    // Only collect default system metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({ register: this.register })
    
    // Create only two custom metrics
    this.requestCounter = new client.Counter({
      name: 'requests_total',
      help: 'Total number of requests',
      labelNames: ['method', 'status'],
      registers: [this.register]
    })
    
    this.requestDuration = new client.Histogram({
      name: 'request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['method'],
      buckets: [0.1, 0.5, 1, 2, 5], // Simple buckets
      registers: [this.register]
    })
    
    // Start metrics server
    this._startServer()
  }
  
  _startServer() {
    const app = express()
    
    // Single metrics endpoint
    app.get('/metrics', (req, res) => {
      res.set('Content-Type', this.register.contentType)
      this.register.metrics().then(metrics => {
        res.end(metrics)
      })
    })
    
    this.server = app.listen(this.port, () => {
      console.log(`🎯 [${this.workerName.toUpperCase()}] Metrics server started`)
      console.log(`📊 ➜ Metrics URL: http://localhost:${this.port}/metrics`)
      console.log(`📈 ➜ Worker: ${this.workerName} | Port: ${this.port}`)
    })
  }
  
  // Simple method to track requests (async, non-blocking)
  trackRequest(method, status, duration) {
    // Use setImmediate to defer metrics collection to next tick
    // This ensures the main request flow is never blocked
    setImmediate(() => {
      try {
        this.requestCounter.inc({ method, status })
        this.requestDuration.observe({ method }, duration)
      } catch (error) {
        // Silently handle metrics errors to avoid disrupting main flow
        console.error('[METRICS] Error recording metrics:', error.message)
      }
    })
  }
  
  // Wrapper method to auto-track any RPC method without blocking
  async wrapRpcMethod(methodName, handler, workerInstance, data) {
    const startTime = Date.now()
    try {
      const result = await handler(workerInstance, data)
      
      // Track success asynchronously (non-blocking)
      const duration = (Date.now() - startTime) / 1000
      this.trackRequest(methodName, 'success', duration)
      
      return result
    } catch (error) {
      // Track error asynchronously (non-blocking)
      const duration = (Date.now() - startTime) / 1000
      this.trackRequest(methodName, 'error', duration)
      
      throw error
    }
  }
  
  // Clean shutdown
  async stop() {
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve))
    }
  }
}

module.exports = SimpleMetrics