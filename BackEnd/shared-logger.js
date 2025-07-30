const fs = require('fs').promises
const path = require('path')

/**
 * Centralized logging system for all workers
 * Provides consistent logging format across AuthWorker, GatewayWorker, ClientWorker, etc.
 * All logging operations are asynchronous and non-blocking for better performance.
 */
class SharedLogger {
  constructor() {
    this.logsDir = path.join(__dirname, 'logs')
    this.errorLogFile = path.join(this.logsDir, 'error.log')
    this.eventLogFile = path.join(this.logsDir, 'event.log')
    this.promptLogFile = path.join(this.logsDir, 'prompt.log')
    
    // Queue for async logging to prevent blocking
    this.logQueue = []
    this.isProcessing = false
    
    // Ensure logs directory exists
    this.ensureLogsDirectory()
  }

  async ensureLogsDirectory() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create logs directory:', error.message)
    }
  }

  /**
   * Create a formatted log entry
   */
  formatLogEntry(level, workerName, requestId, message, data = null) {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      worker: workerName,
      requestId: requestId || 'N/A',
      message,
      data: data || null
    }
    
    return JSON.stringify(logEntry) + '\n'
  }

  /**
   * Write to log file with error handling (async, non-blocking)
   */
  writeToFileAsync(filePath, content) {
    // Add to queue instead of writing immediately
    this.logQueue.push({ filePath, content })
    
    // Process queue asynchronously without blocking
    if (!this.isProcessing) {
      setImmediate(() => this.processLogQueue())
    }
  }

  /**
   * Process the log queue asynchronously
   */
  async processLogQueue() {
    if (this.isProcessing || this.logQueue.length === 0) return
    
    this.isProcessing = true
    
    while (this.logQueue.length > 0) {
      const batch = this.logQueue.splice(0, 10) // Process in batches of 10
      
      try {
        await Promise.all(
          batch.map(({ filePath, content }) => 
            fs.appendFile(filePath, content, 'utf8').catch(err => 
              console.error(`Failed to write to log file ${filePath}:`, err.message)
            )
          )
        )
      } catch (error) {
        console.error('Batch log write failed:', error.message)
      }
    }
    
    this.isProcessing = false
  }

  /**
   * Log error events (non-blocking)
   */
  error(workerName, requestId, message, errorData = null) {
    const logEntry = this.formatLogEntry('ERROR', workerName, requestId, message, errorData)
    
    // Write to error log file asynchronously
    this.writeToFileAsync(this.errorLogFile, logEntry)
    
    // Also log to console for immediate visibility
    console.error(`🚨 [${workerName}][${requestId || 'N/A'}] ERROR: ${message}`)
    if (errorData) {
      console.error('   Data:', errorData)
    }
  }

  /**
   * Log informational events (non-blocking)
   */
  info(workerName, requestId, message, eventData = null) {
    const logEntry = this.formatLogEntry('INFO', workerName, requestId, message, eventData)
    
    // Write to event log file asynchronously
    this.writeToFileAsync(this.eventLogFile, logEntry)
    
    // Also log to console for immediate visibility
    console.log(`ℹ️  [${workerName}][${requestId || 'N/A'}] ${message}`)
    if (eventData) {
      console.log('   Data:', eventData)
    }
  }

  /**
   * Log warning events (non-blocking)
   */
  warn(workerName, requestId, message, warnData = null) {
    const logEntry = this.formatLogEntry('WARN', workerName, requestId, message, warnData)
    
    // Write to event log file asynchronously
    this.writeToFileAsync(this.eventLogFile, logEntry)
    
    // Also log to console for immediate visibility
    console.warn(`⚠️  [${workerName}][${requestId || 'N/A'}] WARN: ${message}`)
    if (warnData) {
      console.warn('   Data:', warnData)
    }
  }

  /**
   * Log debug events (only written to file, not console to reduce noise)
   */
  debug(workerName, requestId, message, debugData = null) {
    const logEntry = this.formatLogEntry('DEBUG', workerName, requestId, message, debugData)
    
    // Write to event log file only, asynchronously
    this.writeToFileAsync(this.eventLogFile, logEntry)
  }

  /**
   * Log JWT-related events (informational, non-blocking)
   * These go to event.log only - use jwtError() for actual JWT failures
   */
  jwt(workerName, requestId, action, jwtData = null) {
    const message = `JWT ${action}`
    const logEntry = this.formatLogEntry('JWT', workerName, requestId, message, jwtData)
    
    // Write to event log only - these are informational, not errors
    this.writeToFileAsync(this.eventLogFile, logEntry)
    
    // Console log with special JWT prefix
    console.log(`🔑 [${workerName}][${requestId || 'N/A'}] JWT ${action}`)
    if (jwtData) {
      console.log('   JWT Data:', jwtData)
    }
  }
  
  /**
   * Log JWT-related errors (critical failures, non-blocking)
   * These go to error.log for proper error tracking
   */
  jwtError(workerName, requestId, action, jwtData = null) {
    const message = `JWT ${action}`
    const logEntry = this.formatLogEntry('ERROR', workerName, requestId, message, jwtData)
    
    // Write to error log for actual JWT failures
    this.writeToFileAsync(this.errorLogFile, logEntry)
    
    // Also write to event log for complete audit trail
    this.writeToFileAsync(this.eventLogFile, logEntry)
    
    // Console log with error prefix
    console.error(`🚨 [${workerName}][${requestId || 'N/A'}] JWT ERROR: ${action}`)
    if (jwtData) {
      console.error('   JWT Error Data:', jwtData)
    }
  }

  /**
   * Log RPC call events (non-blocking)
   */
  rpc(workerName, requestId, method, direction, rpcData = null) {
    const message = `RPC ${direction}: ${method}`
    const logEntry = this.formatLogEntry('RPC', workerName, requestId, message, rpcData)
    
    // Write to event log file asynchronously
    this.writeToFileAsync(this.eventLogFile, logEntry)
    
    // Console log
    const arrow = direction === 'RECEIVED' ? '📨' : '📤'
    console.log(`${arrow} [${workerName}][${requestId || 'N/A'}] RPC ${direction}: ${method}`)
    if (rpcData) {
      console.log('   RPC Data:', rpcData)
    }
  }

  /**
   * Log startup/shutdown events (non-blocking)
   */
  lifecycle(workerName, event, lifecycleData = null) {
    const requestId = 'LIFECYCLE'
    const message = `Worker ${event}`
    const logEntry = this.formatLogEntry('LIFECYCLE', workerName, requestId, message, lifecycleData)
    
    // Write to event log file asynchronously
    this.writeToFileAsync(this.eventLogFile, logEntry)
    
    // Console log with lifecycle prefix
    const emoji = event === 'STARTED' ? '🚀' : event === 'STOPPED' ? '🛑' : '🔄'
    console.log(`${emoji} [${workerName}][${requestId}] Worker ${event}`)
    if (lifecycleData) {
      console.log('   Lifecycle Data:', lifecycleData)
    }
  }

  /**
   * Log inference/prompt requests and responses (non-blocking)
   * These go to prompt.log for dedicated request tracking
   */
  prompt(workerName, requestId, action, promptData = null) {
    const message = `PROMPT ${action}`
    const logEntry = this.formatLogEntry('PROMPT', workerName, requestId, message, promptData)
    
    // Write to prompt log file for dedicated request tracking
    this.writeToFileAsync(this.promptLogFile, logEntry)
    
    // Also write to event log for complete audit trail
    this.writeToFileAsync(this.eventLogFile, logEntry)
    
    // Console log with prompt prefix
    const emoji = action.includes('REQUEST') ? '📝' : action.includes('RESPONSE') ? '💬' : action.includes('ERROR') ? '❌' : '🔄'
    console.log(`${emoji} [${workerName}][${requestId || 'N/A'}] PROMPT ${action}`)
    if (promptData) {
      console.log('   Prompt Data:', promptData)
    }
  }
}

// Export singleton instance
module.exports = new SharedLogger() 