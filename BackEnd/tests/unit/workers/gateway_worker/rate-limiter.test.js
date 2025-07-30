'use strict'

const test = require('brittle')
const sinon = require('sinon')
const RateLimiter = require('../../../../gateway_worker/rate-limiter')

let mockWorkerInstance
let mockDatabase
let mockGetBee
let sandbox
let originalEnv

function setupMocks() {
  sandbox = sinon.createSandbox()
  originalEnv = { ...process.env }
  
  // Create mock database
  mockDatabase = {
    get: sandbox.stub(),
    put: sandbox.stub(),
    ready: sandbox.stub().resolves()
  }
  
  // Create mock getBee function
  mockGetBee = sandbox.stub().resolves(mockDatabase)
  
  // Create mock worker instance
  mockWorkerInstance = {
    store_s0: {
      getBee: mockGetBee
    }
  }
  
  // Reset static cached database
  RateLimiter._rateLimitDb = null
}

function resetMocks() {
  if (sandbox) {
    sandbox.restore()
  }
  process.env = originalEnv
  RateLimiter._rateLimitDb = null
}

// === _GETDB METHOD TESTS ===

test('RateLimiter._getDb - should throw error when workerInstance is null', async (t) => {
  setupMocks()
  
  try {
    await RateLimiter._getDb(null)
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error.message, 'Store facility not available in worker instance', 'Error message should match')
  }
  
  resetMocks()
})

test('RateLimiter._getDb - should throw error when workerInstance is undefined', async (t) => {
  setupMocks()
  
  try {
    await RateLimiter._getDb(undefined)
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error.message, 'Store facility not available in worker instance', 'Error message should match')
  }
  
  resetMocks()
})

test('RateLimiter._getDb - should throw error when store_s0 facility is not available', async (t) => {
  setupMocks()
  const workerWithoutStore = { store_s0: null }
  
  try {
    await RateLimiter._getDb(workerWithoutStore)
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error.message, 'Store facility not available in worker instance', 'Error message should match')
  }
  
  resetMocks()
})

test('RateLimiter._getDb - should create new database when _rateLimitDb is not cached', async (t) => {
  setupMocks()
  
  const result = await RateLimiter._getDb(mockWorkerInstance)
  
  t.ok(mockGetBee.calledOnce, 'getBee should be called once')
  t.alike(mockGetBee.firstCall.args[0], { name: 'rate-limits' }, 'First argument should match')
  t.alike(mockGetBee.firstCall.args[1], {
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  }, 'Second argument should match')
  t.ok(mockDatabase.ready.calledOnce, 'ready should be called once')
  t.is(result, mockDatabase, 'Should return database instance')
  
  resetMocks()
})

test('RateLimiter._getDb - should return cached database when _rateLimitDb exists', async (t) => {
  setupMocks()
  // Set cached database
  RateLimiter._rateLimitDb = mockDatabase
  
  const result = await RateLimiter._getDb(mockWorkerInstance)
  
  t.ok(!mockGetBee.called, 'getBee should not be called')
  t.ok(!mockDatabase.ready.called, 'ready should not be called')
  t.is(result, mockDatabase, 'Should return cached database')
  
  resetMocks()
})

test('RateLimiter._getDb - should call ready() on newly created database', async (t) => {
  setupMocks()
  
  await RateLimiter._getDb(mockWorkerInstance)
  
  t.ok(mockDatabase.ready.calledOnce, 'ready should be called once')
  
  resetMocks()
})

test('RateLimiter._getDb - should configure database with correct encoding parameters', async (t) => {
  setupMocks()
  
  await RateLimiter._getDb(mockWorkerInstance)
  
  t.ok(mockGetBee.calledWith(
    { name: 'rate-limits' },
    { keyEncoding: 'utf-8', valueEncoding: 'json' }
  ), 'getBee should be called with correct parameters')
  
  resetMocks()
})

// === _GETCONFIG METHOD TESTS ===

test('RateLimiter._getConfig - should use environment variables when valid integers provided', async (t) => {
  setupMocks()
  process.env.MAX_REQUESTS_PER_INTERVAL = '20'
  process.env.RESET_INTERVAL_MINUTE = '5'
  
  const config = RateLimiter._getConfig()
  
  t.alike(config, {
    maxRequests: 20,
    resetIntervalMs: 300000
  }, 'Config should use environment variables')
  
  resetMocks()
})

test('RateLimiter._getConfig - should use default values when environment variables are missing', async (t) => {
  setupMocks()
  delete process.env.MAX_REQUESTS_PER_INTERVAL
  delete process.env.RESET_INTERVAL_MINUTE
  
  const config = RateLimiter._getConfig()
  
  t.alike(config, {
    maxRequests: 10,
    resetIntervalMs: 60000
  }, 'Config should use default values')
  
  resetMocks()
})

test('RateLimiter._getConfig - should use default values when environment variables are invalid', async (t) => {
  setupMocks()
  process.env.MAX_REQUESTS_PER_INTERVAL = 'invalid'
  process.env.RESET_INTERVAL_MINUTE = 'abc'
  
  const config = RateLimiter._getConfig()
  
  t.alike(config, {
    maxRequests: 10,
    resetIntervalMs: 60000
  }, 'Config should use default values for invalid inputs')
  
  resetMocks()
})

test('RateLimiter._getConfig - should handle zero values in environment variables', async (t) => {
  setupMocks()
  process.env.MAX_REQUESTS_PER_INTERVAL = '0'
  process.env.RESET_INTERVAL_MINUTE = '0'
  
  const config = RateLimiter._getConfig()
  
  t.alike(config, {
    maxRequests: 0,
    resetIntervalMs: 0
  }, 'Config should handle zero values')
  
  resetMocks()
})

test('RateLimiter._getConfig - should handle negative values in environment variables', async (t) => {
  setupMocks()
  process.env.MAX_REQUESTS_PER_INTERVAL = '-5'
  process.env.RESET_INTERVAL_MINUTE = '-2'
  
  const config = RateLimiter._getConfig()
  
  t.alike(config, {
    maxRequests: -5,
    resetIntervalMs: -120000
  }, 'Config should handle negative values')
  
  resetMocks()
})

test('RateLimiter._getConfig - should correctly convert minutes to milliseconds', async (t) => {
  setupMocks()
  process.env.RESET_INTERVAL_MINUTE = '3'
  
  const config = RateLimiter._getConfig()
  
  t.is(config.resetIntervalMs, 180000, 'Should convert 3 minutes to 180000ms')
  
  resetMocks()
})

test('RateLimiter._getConfig - should handle partial environment variable configuration', async (t) => {
  setupMocks()
  process.env.MAX_REQUESTS_PER_INTERVAL = '15'
  delete process.env.RESET_INTERVAL_MINUTE
  
  const config = RateLimiter._getConfig()
  
  t.alike(config, {
    maxRequests: 15,
    resetIntervalMs: 60000
  }, 'Config should mix environment and default values')
  
  resetMocks()
})

// === CHECKRATELIMIT METHOD TESTS ===

test('RateLimiter.checkRateLimit - should allow request when userEmail is null', async (t) => {
  setupMocks()
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, null)
  
  t.alike(result, { allowed: true }, 'Should allow request when email is null')
  t.ok(!RateLimiter._getDb.called, '_getDb should not be called')
  
  resetMocks()
})

test('RateLimiter.checkRateLimit - should allow request when userEmail is undefined', async (t) => {
  setupMocks()
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, undefined)
  
  t.alike(result, { allowed: true }, 'Should allow request when email is undefined')
  t.ok(!RateLimiter._getDb.called, '_getDb should not be called')
  
  resetMocks()
})

test('RateLimiter.checkRateLimit - should allow request when userEmail is empty string', async (t) => {
  setupMocks()
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, "")
  
  t.alike(result, { allowed: true }, 'Should allow request when email is empty')
  t.ok(!RateLimiter._getDb.called, '_getDb should not be called')
  
  resetMocks()
})

test('RateLimiter.checkRateLimit - should create new record for first-time user', async (t) => {
  setupMocks()
  const mockDateNow = sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  mockDatabase.get.resolves(null)
  mockDatabase.put.resolves()
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, "test@example.com")
  
  t.ok(mockDatabase.get.calledWith("ratelimit:test@example.com"), 'Should check for existing record')
  t.ok(mockDatabase.put.calledOnce, 'Should create new record')
  t.ok(result.allowed, 'Should allow first request')
  t.is(result.rateLimitInfo.remainingRequests, 9, 'Should have decremented requests')
  
  resetMocks()
})

test('RateLimiter.checkRateLimit - should block request when no requests remain', async (t) => {
  setupMocks()
  const mockDateNow = sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  const record = {
    userEmail: 'test@example.com',
    lastResetTimestamp: 970000,
    remainingRequests: 0
  }
  mockDatabase.get.resolves({ value: record })
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, "test@example.com")
  
  t.is(result.allowed, false, 'Should block request')
  t.is(result.status, 429, 'Should return 429 status')
  t.is(result.message, 'Rate limit exceeded', 'Should have correct message')
  t.ok(!mockDatabase.put.called, 'Should not update database when blocked')
  
  resetMocks()
})

test('RateLimiter.checkRateLimit - should reset window when time interval has expired', async (t) => {
  setupMocks()
  const mockDateNow = sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  const oldRecord = {
    userEmail: 'test@example.com',
    lastResetTimestamp: 940000, // 60 seconds ago
    remainingRequests: 3
  }
  mockDatabase.get.resolves({ value: oldRecord })
  mockDatabase.put.resolves()
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, "test@example.com")
  
  const updatedRecord = mockDatabase.put.firstCall.args[1]
  t.is(updatedRecord.lastResetTimestamp, 1000000, 'Should update timestamp')
  t.is(updatedRecord.remainingRequests, 9, 'Should reset remaining requests')
  t.ok(result.allowed, 'Should allow request after reset')
  
  resetMocks()
})

test('RateLimiter.checkRateLimit - should fail-open when database error occurs', async (t) => {
  setupMocks()
  sandbox.stub(RateLimiter, '_getDb').rejects(new Error('Database error'))
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, "test@example.com")
  
  t.alike(result, { allowed: true }, 'Should fail-open on database error')
  
  resetMocks()
})

// === GETRATELIMITSTATUS METHOD TESTS ===

test('RateLimiter.getRateLimitStatus - should return null when userEmail is null', async (t) => {
  setupMocks()
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  
  const result = await RateLimiter.getRateLimitStatus(mockWorkerInstance, null)
  
  t.is(result, null, 'Should return null when email is null')
  t.ok(!RateLimiter._getDb.called, '_getDb should not be called')
  
  resetMocks()
})

test('RateLimiter.getRateLimitStatus - should return full quota when no record exists', async (t) => {
  setupMocks()
  sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  mockDatabase.get.resolves(null)
  
  const result = await RateLimiter.getRateLimitStatus(mockWorkerInstance, "test@example.com")
  
  t.is(result.remainingRequests, 10, 'Should return full quota')
  t.is(result.maxRequests, 10, 'Should return max requests')
  t.is(result.nextResetInSeconds, 60, 'Should return full reset interval')
  t.is(result.windowDurationMinutes, 1, 'Should return window duration')
  
  resetMocks()
})

test('RateLimiter.getRateLimitStatus - should not modify database when no record exists', async (t) => {
  setupMocks()
  sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  mockDatabase.get.resolves(null)
  
  await RateLimiter.getRateLimitStatus(mockWorkerInstance, "test@example.com")
  
  t.ok(!mockDatabase.put.called, 'Should not modify database')
  
  resetMocks()
})

test('RateLimiter.getRateLimitStatus - should return current remaining requests within window', async (t) => {
  setupMocks()
  sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  const record = {
    userEmail: 'test@example.com',
    lastResetTimestamp: 970000, // 30 seconds ago
    remainingRequests: 3
  }
  mockDatabase.get.resolves({ value: record })
  
  const result = await RateLimiter.getRateLimitStatus(mockWorkerInstance, "test@example.com")
  
  t.is(result.remainingRequests, 3, 'Should return current remaining requests')
  t.is(result.nextResetInSeconds, 30, 'Should calculate correct reset time')
  
  resetMocks()
})

test('RateLimiter.getRateLimitStatus - should return null on database error', async (t) => {
  setupMocks()
  sandbox.stub(RateLimiter, '_getDb').rejects(new Error('Database error'))
  
  const result = await RateLimiter.getRateLimitStatus(mockWorkerInstance, "test@example.com")
  
  t.is(result, null, 'Should return null on database error')
  
  resetMocks()
})

// === EDGE CASES TESTS ===

test('RateLimiter - should handle very large maxRequests values', async (t) => {
  setupMocks()
  sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 999999,
    resetIntervalMs: 60000
  })
  mockDatabase.get.resolves(null)
  mockDatabase.put.resolves()
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, "test@example.com")
  
  t.ok(result.allowed, 'Should handle large values')
  t.is(result.rateLimitInfo.maxRequests, 999999, 'Should return large max value')
  
  resetMocks()
})

test('RateLimiter - should handle zero maxRequests configuration', async (t) => {
  setupMocks()
  sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 0,
    resetIntervalMs: 60000
  })
  mockDatabase.get.resolves(null)
  mockDatabase.put.resolves()
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, "test@example.com")
  
  t.ok(result.allowed, 'Should allow first request even with zero max')
  const putCall = mockDatabase.put.firstCall.args[1]
  t.is(putCall.remainingRequests, -1, 'Should show negative remaining requests')
  
  resetMocks()
})

test('RateLimiter - should handle very long email addresses', async (t) => {
  setupMocks()
  sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  const longEmail = 'a'.repeat(500) + '@example.com'
  mockDatabase.get.resolves(null)
  mockDatabase.put.resolves()
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, longEmail)
  
  t.ok(result.allowed, 'Should handle long emails')
  t.ok(mockDatabase.get.calledWith(`ratelimit:${longEmail}`), 'Should use correct key')
  
  resetMocks()
})

test('RateLimiter - should handle email with Unicode characters', async (t) => {
  setupMocks()
  sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  const unicodeEmail = 'tëst@example.com'
  mockDatabase.get.resolves(null)
  mockDatabase.put.resolves()
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, unicodeEmail)
  
  t.ok(result.allowed, 'Should handle Unicode emails')
  t.ok(mockDatabase.get.calledWith(`ratelimit:${unicodeEmail}`), 'Should use correct key')
  
  resetMocks()
})

test('RateLimiter - should handle corrupted record structure', async (t) => {
  setupMocks()
  sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  const corruptedRecord = {
    someField: 'value'
    // Missing userEmail, lastResetTimestamp, remainingRequests
  }
  mockDatabase.get.resolves({ value: corruptedRecord })
  mockDatabase.put.resolves()
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, "test@example.com")
  
  t.is(result.allowed, false, 'Should block request with corrupted record for safety')
  t.is(result.status, 429, 'Should return 429 status for corrupted record')
  
  resetMocks()
})

test('RateLimiter - should handle record with negative remainingRequests', async (t) => {
  setupMocks()
  sandbox.stub(Date, 'now').returns(1000000)
  sandbox.stub(RateLimiter, '_getDb').resolves(mockDatabase)
  sandbox.stub(RateLimiter, '_getConfig').returns({
    maxRequests: 10,
    resetIntervalMs: 60000
  })
  const negativeRecord = {
    userEmail: 'test@example.com',
    lastResetTimestamp: 970000,
    remainingRequests: -5
  }
  mockDatabase.get.resolves({ value: negativeRecord })
  
  const result = await RateLimiter.checkRateLimit(mockWorkerInstance, "test@example.com")
  
  t.is(result.allowed, false, 'Should block request with negative remaining')
  t.is(result.status, 429, 'Should return 429 status')
  
  resetMocks()
})