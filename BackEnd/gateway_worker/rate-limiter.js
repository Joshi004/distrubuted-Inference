'use strict'

// Load environment variables (if available)
require('dotenv').config()

const logger = require('../shared-logger.js')

// Default configuration values
const DEFAULT_MAX_REQUESTS = 10           // requests
const DEFAULT_RESET_INTERVAL_MINUTE = 1   // minutes

class RateLimiter {
  // Lazily initialise and cache the Hyperbee database instance used for rate-limit records
  static async _getDb (workerInstance) {
    if (!workerInstance || !workerInstance.store_s0) {
      throw new Error('Store facility not available in worker instance')
    }

    // Re-use the same Bee instance for the lifetime of the process
    if (!RateLimiter._rateLimitDb) {
      RateLimiter._rateLimitDb = await workerInstance.store_s0.getBee(
        { name: 'rate-limits' },
        {
          keyEncoding: 'utf-8',
          valueEncoding: 'json'
        }
      )
      await RateLimiter._rateLimitDb.ready()
    }

    return RateLimiter._rateLimitDb
  }

  // Helper to resolve config from environment variables or fall back to defaults
  static _getConfig () {
    const maxReq = parseInt(process.env.MAX_REQUESTS_PER_INTERVAL, 10)
    const resetMin = parseInt(process.env.RESET_INTERVAL_MINUTE, 10)

    return {
      maxRequests: Number.isFinite(maxReq) ? maxReq : DEFAULT_MAX_REQUESTS,
      resetIntervalMs: (Number.isFinite(resetMin) ? resetMin : DEFAULT_RESET_INTERVAL_MINUTE) * 60 * 1000
    }
  }

  /**
   * Perform a rate-limit check for the supplied userEmail.
   * This method is **stateful** – it will decrement the user\'s remaining
   * request count if the call is allowed.
   *
   * @param {object} workerInstance – reference to the GatewayWorker instance
   * @param {string} userEmail      – email address identifying the user
   * @returns {{ allowed: boolean, error?: string, status?: number }}
   */
  static async checkRateLimit (workerInstance, userEmail) {
    // If no email is provided we cannot safely apply a per-user rate limit – allow.
    if (!userEmail) {
      return { allowed: true }
    }

    try {
      const db = await RateLimiter._getDb(workerInstance)
      const { maxRequests, resetIntervalMs } = RateLimiter._getConfig()
      const key = `ratelimit:${userEmail}`
      const now = Date.now()

      const recordEntry = await db.get(key)
      let record = recordEntry && recordEntry.value ? recordEntry.value : null

      if (!record) {
        // First request recorded for this user
        record = {
          userEmail,
          lastResetTimestamp: now,
          remainingRequests: maxRequests - 1
        }
        await db.put(key, record)
        
        const nextResetMs = resetIntervalMs - (now - record.lastResetTimestamp)
        const nextResetSec = Math.ceil(nextResetMs / 1000)
        
        return { 
          allowed: true,
          rateLimitInfo: {
            remainingRequests: record.remainingRequests,
            maxRequests,
            nextResetInSeconds: nextResetSec,
            windowDurationMinutes: Math.floor(resetIntervalMs / (60 * 1000))
          }
        }
      }

      // Check whether the current window has expired
      if (now - record.lastResetTimestamp >= resetIntervalMs) {
        record.lastResetTimestamp = now
        record.remainingRequests = maxRequests - 1
        await db.put(key, record)
        
        const nextResetMs = resetIntervalMs
        const nextResetSec = Math.ceil(nextResetMs / 1000)
        
        return { 
          allowed: true,
          rateLimitInfo: {
            remainingRequests: record.remainingRequests,
            maxRequests,
            nextResetInSeconds: nextResetSec,
            windowDurationMinutes: Math.floor(resetIntervalMs / (60 * 1000))
          }
        }
      }

      // Within the same window – enforce limits
      if (record.remainingRequests > 0) {
        record.remainingRequests -= 1
        await db.put(key, record)
        
        const nextResetMs = resetIntervalMs - (now - record.lastResetTimestamp)
        const nextResetSec = Math.ceil(nextResetMs / 1000)
        
        return { 
          allowed: true,
          rateLimitInfo: {
            remainingRequests: record.remainingRequests,
            maxRequests,
            nextResetInSeconds: nextResetSec,
            windowDurationMinutes: Math.floor(resetIntervalMs / (60 * 1000))
          }
        }
      }

      // No remaining requests → blocked
      const retryAfterMs = resetIntervalMs - (now - record.lastResetTimestamp)
      const retryAfterSec = Math.ceil(retryAfterMs / 1000)

      return {
        allowed: false,
        error: true,
        success: false,
        status: 429,
        message: 'Rate limit exceeded',
        retryAfter: retryAfterSec, // seconds until limit resets
        rateLimitInfo: {
          remainingRequests: 0,
          maxRequests,
          nextResetInSeconds: retryAfterSec,
          windowDurationMinutes: Math.floor(resetIntervalMs / (60 * 1000))
        }
      }
    } catch (err) {
      // Fail-open on storage errors to avoid blocking legitimate traffic
      logger.error('RateLimiter', 'RATE_LIMIT_ERROR', 'Rate limiter storage error - allowing request', {
        error: err.message,
        userEmail: userEmail,
        failOpen: true
      })
      return { allowed: true }
    }
  }

  /**
   * Get current rate limit status for a user WITHOUT consuming a request
   * This is useful for login, verifySession, etc. where we want to show limits but not decrement
   *
   * @param {object} workerInstance – reference to the GatewayWorker instance
   * @param {string} userEmail      – email address identifying the user
   * @returns {object} Rate limit information
   */
  static async getRateLimitStatus(workerInstance, userEmail) {
    if (!userEmail) {
      return null // No rate limit info if no user
    }

    try {
      const db = await RateLimiter._getDb(workerInstance)
      const { maxRequests, resetIntervalMs } = RateLimiter._getConfig()
      const key = `ratelimit:${userEmail}`
      const now = Date.now()

      const recordEntry = await db.get(key)
      let record = recordEntry && recordEntry.value ? recordEntry.value : null

      if (!record) {
        // No record yet - user has full quota
        return {
          remainingRequests: maxRequests,
          maxRequests,
          nextResetInSeconds: Math.ceil(resetIntervalMs / 1000),
          windowDurationMinutes: Math.floor(resetIntervalMs / (60 * 1000))
        }
      }

      // Check if window has expired
      if (now - record.lastResetTimestamp >= resetIntervalMs) {
        // Window expired - user has full quota
        return {
          remainingRequests: maxRequests,
          maxRequests,
          nextResetInSeconds: Math.ceil(resetIntervalMs / 1000),
          windowDurationMinutes: Math.floor(resetIntervalMs / (60 * 1000))
        }
      }

      // Within current window
      const nextResetMs = resetIntervalMs - (now - record.lastResetTimestamp)
      const nextResetSec = Math.ceil(nextResetMs / 1000)

      return {
        remainingRequests: record.remainingRequests,
        maxRequests,
        nextResetInSeconds: nextResetSec,
        windowDurationMinutes: Math.floor(resetIntervalMs / (60 * 1000))
      }

    } catch (err) {
      logger.error('RateLimiter', 'RATE_LIMIT_STATUS_ERROR', 'Rate limiter status retrieval error', {
        error: err.message,
        userEmail: userEmail,
        operation: 'getRateLimitStatus'
      })
      return null
    }
  }
}

module.exports = RateLimiter 