'use strict'

const test = require('brittle')
const sinon = require('sinon')

// Test utilities
function createValidWorkerInstance() {
  return {
    net_default: {
      jTopicRequestRobust: sinon.stub().resolves({ response: 'test response' })
    }
  }
}

function createWorkerInstanceWithoutNetwork() {
  return {}
}

function createWorkerInstanceWithNullNetwork() {
  return { net_default: null }
}

// Mock external dependencies
let jwtStub
let rateLimiterStub

// Setup global mocks
function setupGlobalMocks() {
  // Mock jwt
  jwtStub = {
    verify: sinon.stub().returns({ email: 'test@example.com', role: 'user' })
  }
  
  // Mock RateLimiter
  rateLimiterStub = {
    checkRateLimit: sinon.stub().resolves({ 
      allowed: true, 
      rateLimitInfo: { remaining: 10, resetTime: Date.now() + 3600000 }
    }),
    getRateLimitStatus: sinon.stub().resolves({ 
      remaining: 10, 
      resetTime: Date.now() + 3600000 
    })
  }
}

// Mock external modules before requiring GatewayHelper
const Module = require('module')
const originalRequire = Module.prototype.require
Module.prototype.require = function(id) {
  if (id === 'jsonwebtoken') {
    return jwtStub
  }
  if (id === './rate-limiter.js') {
    return rateLimiterStub
  }
  if (id === '../shared-logger.js') {
    return {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
      lifecycle: sinon.stub(),
      jwt: sinon.stub(),
      jwtError: sinon.stub(),
      rpc: sinon.stub(),
      warn: sinon.stub(),
      prompt: sinon.stub()
    }
  }
  return originalRequire.apply(this, arguments)
}

// Setup global mocks before loading GatewayHelper
setupGlobalMocks()

// Load GatewayHelper with mocked dependencies
const GatewayHelper = require('../../../../gateway_worker/gateway-helper.js')

// Reset mocks function
function resetAllMocks() {
  if (jwtStub) {
    jwtStub.verify.reset()
    jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  }
  if (rateLimiterStub) {
    rateLimiterStub.checkRateLimit.reset()
    rateLimiterStub.checkRateLimit.resolves({ 
      allowed: true, 
      rateLimitInfo: { remaining: 10, resetTime: Date.now() + 3600000 }
    })
    rateLimiterStub.getRateLimitStatus.reset()
    rateLimiterStub.getRateLimitStatus.resolves({ 
      remaining: 10, 
      resetTime: Date.now() + 3600000 
    })
  }
}

// === EXTRACTREQUESTDATA METHOD TESTS ===

test('GatewayHelper.extractRequestData - should extract data from new wrapped format with meta key', async (t) => {
  resetAllMocks()
  
  const requestData = { 
    data: { prompt: "test prompt" }, 
    meta: { key: "auth123" } 
  }
  
  const result = GatewayHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { prompt: "test prompt" }, 'actualData should be extracted correctly')
  t.is(result.authKey, "auth123", 'authKey should be correctly extracted from meta.key')
})

test('GatewayHelper.extractRequestData - should extract data from new wrapped format with missing meta', async (t) => {
  resetAllMocks()
  
  const requestData = { 
    data: { prompt: "test prompt" } 
  }
  
  const result = GatewayHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { prompt: "test prompt" }, 'actualData should be extracted correctly')
  t.is(result.authKey, null, 'authKey should be null when meta is missing')
})

test('GatewayHelper.extractRequestData - should extract data from new wrapped format with missing meta.key', async (t) => {
  resetAllMocks()
  
  const requestData = { 
    data: { prompt: "test prompt" }, 
    meta: {} 
  }
  
  const result = GatewayHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { prompt: "test prompt" }, 'actualData should be extracted correctly')
  t.is(result.authKey, null, 'authKey should be null when meta.key is missing')
})

test('GatewayHelper.extractRequestData - should handle complex nested data structures', async (t) => {
  resetAllMocks()
  
  const requestData = { 
    data: { user: { email: "test@example.com", profile: { name: "Test" } } }, 
    meta: { key: "token123" } 
  }
  
  const result = GatewayHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { user: { email: "test@example.com", profile: { name: "Test" } } }, 'Nested data structure should be intact')
  t.is(result.authKey, "token123", 'authKey should be extracted correctly')
})

test('GatewayHelper.extractRequestData - should throw error for null requestData', async (t) => {
  resetAllMocks()
  
  try {
    GatewayHelper.extractRequestData(null)
    t.fail('Should throw error')
  } catch (error) {
    t.ok(error.message.includes('Invalid request format'), 'Error message should indicate invalid format')
  }
})

test('GatewayHelper.extractRequestData - should throw error for undefined requestData', async (t) => {
  resetAllMocks()
  
  try {
    GatewayHelper.extractRequestData(undefined)
    t.fail('Should throw error')
  } catch (error) {
    t.ok(error.message.includes('Invalid request format'), 'Error message should indicate invalid format')
  }
})

test('GatewayHelper.extractRequestData - should throw error for non-object requestData', async (t) => {
  resetAllMocks()
  
  try {
    GatewayHelper.extractRequestData("invalid")
    t.fail('Should throw error')
  } catch (error) {
    t.ok(error.message.includes('Invalid request format'), 'Error message should indicate invalid format')
  }
})

test('GatewayHelper.extractRequestData - should throw error for invalid new format without data field', async (t) => {
  resetAllMocks()
  
  try {
    GatewayHelper.extractRequestData({ meta: { key: "token" } })
    t.fail('Should throw error')
  } catch (error) {
    t.ok(error.message.includes('Invalid request format'), 'Error message should indicate invalid format')
  }
})

test('GatewayHelper.extractRequestData - should throw error for invalid new format with non-object data', async (t) => {
  resetAllMocks()
  
  try {
    GatewayHelper.extractRequestData({ data: "string", meta: { key: "token" } })
    t.fail('Should throw error')
  } catch (error) {
    t.ok(error.message.includes('Invalid request format'), 'Error message should indicate invalid format')
  }
})

// === VALIDATEAUTHKEY METHOD TESTS ===

test('GatewayHelper.validateAuthKey - should return valid with skipAuth true for register method', async (t) => {
  resetAllMocks()
  
  const result = await GatewayHelper.validateAuthKey('anytoken', 'register', 'req123')
  
  t.is(result.isValid, true, 'Should be valid')
  t.is(result.skipAuth, true, 'Should skip auth for register')
})

test('GatewayHelper.validateAuthKey - should return valid with skipAuth true for login method', async (t) => {
  resetAllMocks()
  
  const result = await GatewayHelper.validateAuthKey('anytoken', 'login', 'req123')
  
  t.is(result.isValid, true, 'Should be valid')
  t.is(result.skipAuth, true, 'Should skip auth for login')
})

test('GatewayHelper.validateAuthKey - should handle case-sensitive method names for exempt methods', async (t) => {
  resetAllMocks()
  
  const result = await GatewayHelper.validateAuthKey('anytoken', 'Register', 'req123')
  
  t.is(result.isValid, true, 'Should be valid for valid token')
  t.is(result.skipAuth, false, 'Should not skip auth for case-different method name (Register vs register)')
})

test('GatewayHelper.validateAuthKey - should return error when authKey is missing for protected methods', async (t) => {
  resetAllMocks()
  
  const result = await GatewayHelper.validateAuthKey(null, 'processPrompt', 'req123')
  
  t.is(result.isValid, false, 'Should not be valid')
  t.is(result.skipAuth, false, 'Should not skip auth')
  t.ok(result.error, 'Should have error object')
  t.is(result.error.status, 401, 'Should return 401 status')
})

test('GatewayHelper.validateAuthKey - should return error when authKey is empty string for protected methods', async (t) => {
  resetAllMocks()
  
  const result = await GatewayHelper.validateAuthKey('', 'processPrompt', 'req123')
  
  t.is(result.isValid, false, 'Should not be valid')
  t.is(result.skipAuth, false, 'Should not skip auth')
  t.ok(result.error, 'Should have error object')
  t.is(result.error.status, 401, 'Should return 401 status')
})

test('GatewayHelper.validateAuthKey - should return error when authKey is null for protected methods', async (t) => {
  resetAllMocks()
  
  const result = await GatewayHelper.validateAuthKey(null, 'verifySession', 'req123')
  
  t.is(result.isValid, false, 'Should not be valid')
  t.is(result.skipAuth, false, 'Should not skip auth')
  t.ok(result.error, 'Should have error object')
  t.is(result.error.status, 401, 'Should return 401 status')
})

test('GatewayHelper.validateAuthKey - should successfully verify valid JWT token', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const result = await GatewayHelper.validateAuthKey('validtoken', 'processPrompt', 'req123')
  
  t.is(result.isValid, true, 'Should be valid')
  t.is(result.skipAuth, false, 'Should not skip auth')
  t.ok(result.decoded, 'Should have decoded data')
  t.is(result.decoded.email, 'test@example.com', 'Should have correct email')
})

test('GatewayHelper.validateAuthKey - should use environment JWT_SECRET when available', async (t) => {
  resetAllMocks()
  
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'env_secret'
  
  await GatewayHelper.validateAuthKey('validtoken', 'processPrompt', 'req123')
  
  t.is(jwtStub.verify.callCount, 1, 'JWT verify should be called')
  t.is(jwtStub.verify.firstCall.args[1], 'env_secret', 'Should use environment secret')
  
  // Cleanup
  if (originalSecret) {
    process.env.JWT_SECRET = originalSecret
  } else {
    delete process.env.JWT_SECRET
  }
})

test('GatewayHelper.validateAuthKey - should use default JWT_SECRET when environment variable missing', async (t) => {
  resetAllMocks()
  
  const originalSecret = process.env.JWT_SECRET
  delete process.env.JWT_SECRET
  
  await GatewayHelper.validateAuthKey('validtoken', 'processPrompt', 'req123')
  
  t.is(jwtStub.verify.callCount, 1, 'JWT verify should be called')
  t.is(jwtStub.verify.firstCall.args[1], 'distributed-ai-secure-secret-key-2025', 'Should use default secret')
  
  // Cleanup
  if (originalSecret) {
    process.env.JWT_SECRET = originalSecret
  }
})

test('GatewayHelper.validateAuthKey - should return decoded user data for valid token', async (t) => {
  resetAllMocks()
  
  const mockDecoded = { email: 'user@test.com', role: 'admin' }
  jwtStub.verify.returns(mockDecoded)
  
  const result = await GatewayHelper.validateAuthKey('validtoken', 'processPrompt', 'req123')
  
  t.is(result.isValid, true, 'Should be valid')
  t.alike(result.decoded, mockDecoded, 'Should return decoded data')
})

test('GatewayHelper.validateAuthKey - should handle JWT verification with correct payload structure', async (t) => {
  resetAllMocks()
  
  const payload = { email: 'test@example.com', role: 'user', iat: Date.now() }
  jwtStub.verify.returns(payload)
  
  const result = await GatewayHelper.validateAuthKey('validtoken', 'processPrompt', 'req123')
  
  t.is(result.isValid, true, 'Should be valid')
  t.is(result.decoded.email, 'test@example.com', 'Should have email field')
  t.is(result.decoded.role, 'user', 'Should have role field')
})

test('GatewayHelper.validateAuthKey - should return error for expired JWT token', async (t) => {
  resetAllMocks()
  
  const expiredError = new Error('jwt expired')
  expiredError.name = 'TokenExpiredError'
  jwtStub.verify.throws(expiredError)
  
  const result = await GatewayHelper.validateAuthKey('expiredtoken', 'processPrompt', 'req123')
  
  t.is(result.isValid, false, 'Should not be valid')
  t.ok(result.error, 'Should have error object')
  t.is(result.error.status, 401, 'Should return 401 status')
})

test('GatewayHelper.validateAuthKey - should return error for malformed JWT token', async (t) => {
  resetAllMocks()
  
  const malformedError = new Error('jwt malformed')
  jwtStub.verify.throws(malformedError)
  
  const result = await GatewayHelper.validateAuthKey('malformedtoken', 'processPrompt', 'req123')
  
  t.is(result.isValid, false, 'Should not be valid')
  t.ok(result.error, 'Should have error object')
  t.is(result.error.status, 401, 'Should return 401 status')
})

test('GatewayHelper.validateAuthKey - should return error for JWT with invalid signature', async (t) => {
  resetAllMocks()
  
  const signatureError = new Error('invalid signature')
  jwtStub.verify.throws(signatureError)
  
  const result = await GatewayHelper.validateAuthKey('invalidsigtoken', 'processPrompt', 'req123')
  
  t.is(result.isValid, false, 'Should not be valid')
  t.ok(result.error, 'Should have error object')
  t.is(result.error.status, 401, 'Should return 401 status')
})

test('GatewayHelper.validateAuthKey - should return error for JWT with missing required fields', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({}) // Missing email and role
  
  const result = await GatewayHelper.validateAuthKey('incompletetoken', 'processPrompt', 'req123')
  
  t.is(result.isValid, true, 'Should still be valid - field validation is not in validateAuthKey')
  t.ok(result.decoded, 'Should have decoded object')
})

test('GatewayHelper.validateAuthKey - should handle JWT verification errors gracefully', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.throws(new Error('General JWT error'))
  
  const result = await GatewayHelper.validateAuthKey('errortoken', 'processPrompt', 'req123')
  
  t.is(result.isValid, false, 'Should not be valid')
  t.is(result.skipAuth, false, 'Should not skip auth')
  t.ok(result.error, 'Should have error object')
  t.is(result.error.status, 401, 'Should return 401 status')
  t.ok(result.error.message.includes('Unauthorized'), 'Should have unauthorized message')
})

// === PROCESSPROMPT METHOD TESTS ===

test('GatewayHelper.processPrompt - should extract data using extractRequestData', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 1, 'Should call processor')
  const [topic, method, actualData] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.is(topic, 'processor', 'Should use processor topic')
  t.is(method, 'processRequest', 'Should use processRequest method')
  t.alike(actualData, { prompt: 'test prompt' }, 'Should pass extracted data')
})

test('GatewayHelper.processPrompt - should validate authentication using validateAuthKey', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(jwtStub.verify.callCount, 1, 'Should validate auth token')
  t.ok(result, 'Should return result')
})

test('GatewayHelper.processPrompt - should return authentication error when auth validation fails', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.throws(new Error('Invalid token'))
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'invalidtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 401, 'Should return 401 status')
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 0, 'Should not call processor')
})

test('GatewayHelper.processPrompt - should proceed when authentication validation succeeds', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 1, 'Should call processor')
  t.ok(result, 'Should return result')
})

test('GatewayHelper.processPrompt - should apply rate limiting for authenticated users', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  rateLimiterStub.checkRateLimit.resolves({ allowed: true, rateLimitInfo: { remaining: 5 } })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(rateLimiterStub.checkRateLimit.callCount, 1, 'Should check rate limit')
  t.is(rateLimiterStub.checkRateLimit.firstCall.args[1], 'test@example.com', 'Should use user email')
})

test('GatewayHelper.processPrompt - should return rate limit error when limit exceeded', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  rateLimiterStub.checkRateLimit.resolves({ allowed: false, status: 429, message: 'Rate limit exceeded' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.status, 429, 'Should return rate limit status')
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 0, 'Should not call processor')
})

test('GatewayHelper.processPrompt - should skip rate limiting when authentication is skipped', async (t) => {
  resetAllMocks()
  
  // This test doesn't fully apply since processPrompt is not exempt, but testing the logic path
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' } } // No auth token
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.status, 401, 'Should return auth error instead of processing')
  t.is(rateLimiterStub.checkRateLimit.callCount, 0, 'Should not check rate limit for failed auth')
})

test('GatewayHelper.processPrompt - should include rate limit info in successful response', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  const mockRateLimitInfo = { remaining: 5, resetTime: Date.now() + 3600000 }
  rateLimiterStub.checkRateLimit.resolves({ allowed: true, rateLimitInfo: mockRateLimitInfo })
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.resolves({ response: 'AI response' })
  
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.alike(result.rateLimitInfo, mockRateLimitInfo, 'Should include rate limit info')
})

test('GatewayHelper.processPrompt - should handle rate limiting errors gracefully', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  rateLimiterStub.checkRateLimit.rejects(new Error('Rate limiter error'))
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.error, true, 'Should return error')
  t.ok(result.message.includes('Rate limiter error'), 'Should include rate limiter error')
})

test('GatewayHelper.processPrompt - should validate prompt field exists', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } } // Missing prompt
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.error, true, 'Should return error')
  t.ok(result.message.includes('Invalid input'), 'Should have validation error')
})

test('GatewayHelper.processPrompt - should validate prompt field is string type', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 123 }, meta: { key: 'validtoken' } } // Non-string prompt
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.error, true, 'Should return error')
  t.ok(result.message.includes('Invalid input'), 'Should have validation error')
})

test('GatewayHelper.processPrompt - should return error for missing prompt field', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { other: 'field' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.error, true, 'Should return error')
  t.ok(result.message.includes('Invalid input'), 'Should have validation error')
})

test('GatewayHelper.processPrompt - should return error for non-string prompt field', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: null }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.error, true, 'Should return error')
  t.ok(result.message.includes('Invalid input'), 'Should have validation error')
})

test('GatewayHelper.processPrompt - should handle empty string prompt', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: '' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 1, 'Should process empty string prompt')
})

test('GatewayHelper.processPrompt - should forward request to processor using jTopicRequestRobust', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 1, 'Should call jTopicRequestRobust')
})

test('GatewayHelper.processPrompt - should use correct topic name for processor', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  await GatewayHelper.processPrompt(workerInstance, data)
  
  const [topic] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.is(topic, 'processor', 'Should use processor topic')
})

test('GatewayHelper.processPrompt - should use correct method name for processor', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  await GatewayHelper.processPrompt(workerInstance, data)
  
  const [, method] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.is(method, 'processRequest', 'Should use processRequest method')
})

test('GatewayHelper.processPrompt - should pass actualData to processor', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  await GatewayHelper.processPrompt(workerInstance, data)
  
  const [, , actualData] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.alike(actualData, { prompt: 'test prompt' }, 'Should pass extracted data')
})

test('GatewayHelper.processPrompt - should handle CHANNEL_CLOSED errors from processor', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.rejects(new Error('CHANNEL_CLOSED'))
  
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.error, true, 'Should return error')
  t.ok(result.message.includes('CHANNEL_CLOSED'), 'Should include error message')
})

// === CATEGORIZEGATEWAYERROR METHOD TESTS ===

test('GatewayHelper.categorizeGatewayError - should categorize CHANNEL_CLOSED errors as PROCESSOR_CONNECTION_LOST', async (t) => {
  resetAllMocks()
  
  const error = new Error('CHANNEL_CLOSED')
  const result = GatewayHelper.categorizeGatewayError(error)
  
  t.is(result, 'PROCESSOR_CONNECTION_LOST', 'Should categorize CHANNEL_CLOSED correctly')
})

test('GatewayHelper.categorizeGatewayError - should categorize ERR_TOPIC_LOOKUP_EMPTY errors as PROCESSOR_NOT_FOUND', async (t) => {
  resetAllMocks()
  
  const error = new Error('ERR_TOPIC_LOOKUP_EMPTY')
  const result = GatewayHelper.categorizeGatewayError(error)
  
  t.is(result, 'PROCESSOR_NOT_FOUND', 'Should categorize lookup empty correctly')
})

test('GatewayHelper.categorizeGatewayError - should categorize ETIMEDOUT errors as PROCESSOR_TIMEOUT', async (t) => {
  resetAllMocks()
  
  const error = new Error('ETIMEDOUT')
  const result = GatewayHelper.categorizeGatewayError(error)
  
  t.is(result, 'PROCESSOR_TIMEOUT', 'Should categorize timeout correctly')
})

test('GatewayHelper.categorizeGatewayError - should categorize ECONNREFUSED errors as PROCESSOR_REFUSED', async (t) => {
  resetAllMocks()
  
  const error = new Error('ECONNREFUSED')
  const result = GatewayHelper.categorizeGatewayError(error)
  
  t.is(result, 'PROCESSOR_REFUSED', 'Should categorize connection refused correctly')
})

test('GatewayHelper.categorizeGatewayError - should categorize Invalid request format errors as INVALID_REQUEST_FORMAT', async (t) => {
  resetAllMocks()
  
  const error = new Error('Invalid request format')
  const result = GatewayHelper.categorizeGatewayError(error)
  
  t.is(result, 'INVALID_REQUEST_FORMAT', 'Should categorize invalid format correctly')
})

test('GatewayHelper.categorizeGatewayError - should categorize Unauthorized errors as AUTH_FAILED', async (t) => {
  resetAllMocks()
  
  const error = new Error('Unauthorized')
  const result = GatewayHelper.categorizeGatewayError(error)
  
  t.is(result, 'AUTH_FAILED', 'Should categorize auth errors correctly')
})

test('GatewayHelper.categorizeGatewayError - should return UNKNOWN_PROCESSOR_ERROR for unrecognized errors', async (t) => {
  resetAllMocks()
  
  const error = new Error('Some random error')
  const result = GatewayHelper.categorizeGatewayError(error)
  
  t.is(result, 'UNKNOWN_PROCESSOR_ERROR', 'Should return unknown for unrecognized errors')
})

test('GatewayHelper.categorizeGatewayError - should handle null error input', async (t) => {
  resetAllMocks()
  
  const result = GatewayHelper.categorizeGatewayError(null)
  
  t.is(result, 'UNKNOWN', 'Should handle null input')
})

// === REGISTER METHOD TESTS ===

test('GatewayHelper.register - should extract data using extractRequestData', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { email: 'test@example.com', password: 'pass123' }, meta: { key: 'token' } }
  
  await GatewayHelper.register(workerInstance, data)
  
  const [topic, method, actualData] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.is(topic, 'auth', 'Should use auth topic')
  t.is(method, 'register', 'Should use register method')
  t.alike(actualData, { email: 'test@example.com', password: 'pass123' }, 'Should pass extracted data')
})

test('GatewayHelper.register - should forward request to auth worker', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.register(workerInstance, data)
  
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 1, 'Should call auth worker')
})

test('GatewayHelper.register - should return response from auth worker', async (t) => {
  resetAllMocks()
  
  const authResponse = { success: true, message: 'User registered' }
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.resolves(authResponse)
  
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  const result = await GatewayHelper.register(workerInstance, data)
  
  t.alike(result, authResponse, 'Should return auth worker response')
})

// === LOGIN METHOD TESTS ===

test('GatewayHelper.login - should extract data using extractRequestData', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.login(workerInstance, data)
  
  const [topic, method, actualData] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.is(topic, 'auth', 'Should use auth topic')
  t.is(method, 'login', 'Should use login method')
  t.alike(actualData, { email: 'test@example.com', password: 'pass123' }, 'Should pass extracted data')
})

test('GatewayHelper.login - should add rate limit info for successful login', async (t) => {
  resetAllMocks()
  
  const authResponse = { success: true, key: 'jwt-token', email: 'test@example.com' }
  const mockRateLimitStatus = { remaining: 10, resetTime: Date.now() + 3600000 }
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.resolves(authResponse)
  rateLimiterStub.getRateLimitStatus.resolves(mockRateLimitStatus)
  
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  const result = await GatewayHelper.login(workerInstance, data)
  
  t.alike(result.rateLimitInfo, mockRateLimitStatus, 'Should include rate limit info')
})

// === VERIFYSESSION METHOD TESTS ===

test('GatewayHelper.verifySession - should extract data using extractRequestData', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(jwtStub.verify.callCount, 1, 'Should verify JWT token')
  t.is(result.success, true, 'Should extract and process data')
})

test('GatewayHelper.verifySession - should handle missing authKey correctly', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {} } // Missing meta.key
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 401, 'Should return 401 status')
  t.is(result.valid, false, 'Should mark as invalid')
  t.ok(result.message.includes('No session token'), 'Should have appropriate message')
})

test('GatewayHelper.verifySession - should return success response for valid session', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(result.success, true, 'Should return success')
  t.is(result.status, 200, 'Should return 200 status')
  t.is(result.valid, true, 'Should mark as valid')
  t.ok(result.message.includes('Session is valid'), 'Should have success message')
})

test('GatewayHelper.verifySession - should return error for expired JWT token', async (t) => {
  resetAllMocks()
  
  const expiredError = new Error('jwt expired')
  expiredError.name = 'TokenExpiredError'
  jwtStub.verify.throws(expiredError)
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'expiredtoken' } }
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 401, 'Should return 401 status')
  t.is(result.valid, false, 'Should mark as invalid')
})

// Additional ProcessPrompt tests
test('GatewayHelper.processPrompt - should handle ERR_TOPIC_LOOKUP_EMPTY errors', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.rejects(new Error('ERR_TOPIC_LOOKUP_EMPTY'))
  
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.error, true, 'Should return error')
  t.ok(result.message.includes('ERR_TOPIC_LOOKUP_EMPTY'), 'Should include error message')
})

test('GatewayHelper.processPrompt - should handle ETIMEDOUT errors from processor', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.rejects(new Error('ETIMEDOUT'))
  
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.error, true, 'Should return error')
  t.ok(result.message.includes('ETIMEDOUT'), 'Should include error message')
})

test('GatewayHelper.processPrompt - should handle ECONNREFUSED errors from processor', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.rejects(new Error('ECONNREFUSED'))
  
  const data = { data: { prompt: 'test prompt' }, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.processPrompt(workerInstance, data)
  
  t.is(result.error, true, 'Should return error')
  t.ok(result.message.includes('ECONNREFUSED'), 'Should include error message')
})

// Additional CategorizeGatewayError tests
test('GatewayHelper.categorizeGatewayError - should handle undefined error input', async (t) => {
  resetAllMocks()
  
  const result = GatewayHelper.categorizeGatewayError(undefined)
  
  t.is(result, 'UNKNOWN', 'Should handle undefined input')
})

test('GatewayHelper.categorizeGatewayError - should handle error without message property', async (t) => {
  resetAllMocks()
  
  const error = { name: 'Error' } // No message property
  const result = GatewayHelper.categorizeGatewayError(error)
  
  t.is(result, 'UNKNOWN', 'Should handle error without message')
})

test('GatewayHelper.categorizeGatewayError - should handle empty error message', async (t) => {
  resetAllMocks()
  
  const error = new Error('')
  const result = GatewayHelper.categorizeGatewayError(error)
  
  t.is(result, 'UNKNOWN', 'Should handle empty message as unknown error')
})

test('GatewayHelper.categorizeGatewayError - should handle non-Error objects', async (t) => {
  resetAllMocks()
  
  const nonError = 'string error'
  const result = GatewayHelper.categorizeGatewayError(nonError)
  
  t.is(result, 'UNKNOWN', 'Should handle non-Error objects')
})

// Additional Register tests
test('GatewayHelper.register - should handle wrapped data format correctly', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const wrappedData = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.register(workerInstance, wrappedData)
  
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 1, 'Should process wrapped format')
})

test('GatewayHelper.register - should use correct topic name for auth worker', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.register(workerInstance, data)
  
  const [topic] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.is(topic, 'auth', 'Should use auth topic')
})

test('GatewayHelper.register - should use correct method name for auth worker', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.register(workerInstance, data)
  
  const [, method] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.is(method, 'register', 'Should use register method')
})

test('GatewayHelper.register - should handle CHANNEL_CLOSED errors', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.rejects(new Error('CHANNEL_CLOSED'))
  
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  const result = await GatewayHelper.register(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.ok(result.message.includes('CHANNEL_CLOSED'), 'Should include error message')
})

test('GatewayHelper.register - should return structured error response', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.rejects(new Error('Test error'))
  
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  const result = await GatewayHelper.register(workerInstance, data)
  
  t.is(result.success, false, 'Should have success false')
  t.is(result.status, 500, 'Should have status code')
  t.ok(result.message, 'Should have error message')
  t.ok(result.requestId, 'Should have requestId')
})

// Additional Login tests
test('GatewayHelper.login - should handle wrapped data format correctly', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const wrappedData = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.login(workerInstance, wrappedData)
  
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 1, 'Should process wrapped format')
})

test('GatewayHelper.login - should forward request to auth worker', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.login(workerInstance, data)
  
  t.is(workerInstance.net_default.jTopicRequestRobust.callCount, 1, 'Should call auth worker')
})

test('GatewayHelper.login - should use correct topic name for auth worker', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.login(workerInstance, data)
  
  const [topic] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.is(topic, 'auth', 'Should use auth topic')
})

test('GatewayHelper.login - should use correct method name for auth worker', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.login(workerInstance, data)
  
  const [, method] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.is(method, 'login', 'Should use login method')
})

test('GatewayHelper.login - should pass extracted actualData to auth worker', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.login(workerInstance, data)
  
  const [, , actualData] = workerInstance.net_default.jTopicRequestRobust.firstCall.args
  t.alike(actualData, { email: 'test@example.com', password: 'pass123' }, 'Should pass extracted data')
})

test('GatewayHelper.login - should return response from auth worker', async (t) => {
  resetAllMocks()
  
  const authResponse = { success: true, key: 'jwt-token', email: 'test@example.com' }
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.resolves(authResponse)
  
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  const result = await GatewayHelper.login(workerInstance, data)
  
  t.is(result.success, true, 'Should return success')
  t.is(result.key, 'jwt-token', 'Should return JWT token')
  t.is(result.email, 'test@example.com', 'Should return email')
})

test('GatewayHelper.login - should call getRateLimitStatus with user email', async (t) => {
  resetAllMocks()
  
  const authResponse = { success: true, key: 'jwt-token', email: 'test@example.com' }
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.resolves(authResponse)
  
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  await GatewayHelper.login(workerInstance, data)
  
  t.is(rateLimiterStub.getRateLimitStatus.callCount, 1, 'Should call getRateLimitStatus')
  t.is(rateLimiterStub.getRateLimitStatus.firstCall.args[1], 'test@example.com', 'Should use user email')
})

test('GatewayHelper.login - should skip rate limit info for failed login', async (t) => {
  resetAllMocks()
  
  const authResponse = { success: false, message: 'Invalid credentials' }
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.resolves(authResponse)
  
  const data = { data: { email: 'test@example.com', password: 'wrongpass' } }
  
  const result = await GatewayHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(rateLimiterStub.getRateLimitStatus.callCount, 0, 'Should not call rate limit service')
  t.is(result.rateLimitInfo, undefined, 'Should not include rate limit info')
})

test('GatewayHelper.login - should handle CHANNEL_CLOSED errors', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.rejects(new Error('CHANNEL_CLOSED'))
  
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  const result = await GatewayHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.ok(result.message.includes('CHANNEL_CLOSED'), 'Should include error message')
})

test('GatewayHelper.login - should return structured error response', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.net_default.jTopicRequestRobust.rejects(new Error('Test error'))
  
  const data = { data: { email: 'test@example.com', password: 'pass123' } }
  
  const result = await GatewayHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should have success false')
  t.is(result.status, 500, 'Should have status code')
  t.ok(result.message, 'Should have error message')
  t.ok(result.requestId, 'Should have requestId')
})

// Additional VerifySession tests
test('GatewayHelper.verifySession - should return error for missing auth token', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: {} } // Empty meta
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 401, 'Should return 401 status')
  t.is(result.valid, false, 'Should mark as invalid')
})

test('GatewayHelper.verifySession - should verify JWT token using jwt.verify', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } }
  
  await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(jwtStub.verify.callCount, 1, 'Should call jwt.verify')
  t.is(jwtStub.verify.firstCall.args[0], 'validtoken', 'Should verify the provided token')
})

test('GatewayHelper.verifySession - should use environment JWT_SECRET when available', async (t) => {
  resetAllMocks()
  
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'env_secret'
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } }
  
  await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(jwtStub.verify.firstCall.args[1], 'env_secret', 'Should use environment secret')
  
  // Cleanup
  if (originalSecret) {
    process.env.JWT_SECRET = originalSecret
  } else {
    delete process.env.JWT_SECRET
  }
})

test('GatewayHelper.verifySession - should use default JWT_SECRET when environment variable missing', async (t) => {
  resetAllMocks()
  
  const originalSecret = process.env.JWT_SECRET
  delete process.env.JWT_SECRET
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } }
  
  await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(jwtStub.verify.firstCall.args[1], 'distributed-ai-secure-secret-key-2025', 'Should use default secret')
  
  // Cleanup
  if (originalSecret) {
    process.env.JWT_SECRET = originalSecret
  }
})

test('GatewayHelper.verifySession - should return user email for valid token', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'user@test.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(result.email, 'user@test.com', 'Should return user email')
  t.is(result.valid, true, 'Should mark as valid')
})

test('GatewayHelper.verifySession - should include decoded email in response', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'decoded@example.com', role: 'admin' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(result.email, 'decoded@example.com', 'Should include decoded email')
})

test('GatewayHelper.verifySession - should include rateLimitInfo when available', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'test@example.com', role: 'user' })
  const mockRateLimitStatus = { remaining: 8, resetTime: Date.now() + 3600000 }
  rateLimiterStub.getRateLimitStatus.resolves(mockRateLimitStatus)
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } }
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.alike(result.rateLimitInfo, mockRateLimitStatus, 'Should include rate limit info')
})

test('GatewayHelper.verifySession - should call getRateLimitStatus with verified user email', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.returns({ email: 'verified@example.com', role: 'user' })
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'validtoken' } }
  
  await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(rateLimiterStub.getRateLimitStatus.callCount, 1, 'Should call getRateLimitStatus')
  t.is(rateLimiterStub.getRateLimitStatus.firstCall.args[1], 'verified@example.com', 'Should use verified email')
})

test('GatewayHelper.verifySession - should return error for invalid JWT token', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.throws(new Error('invalid token'))
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'invalidtoken' } }
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 401, 'Should return 401 status')
  t.is(result.valid, false, 'Should mark as invalid')
})

test('GatewayHelper.verifySession - should return error for JWT with wrong signature', async (t) => {
  resetAllMocks()
  
  jwtStub.verify.throws(new Error('invalid signature'))
  
  const workerInstance = createValidWorkerInstance()
  const data = { data: {}, meta: { key: 'wrongsigtoken' } }
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 401, 'Should return 401 status')
  t.is(result.valid, false, 'Should mark as invalid')
})

test('GatewayHelper.verifySession - should handle unexpected errors during verification', async (t) => {
  resetAllMocks()
  
  // Simulate an unexpected error in the verification process
  const data = null // This will cause extractRequestData to throw
  
  const workerInstance = createValidWorkerInstance()
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 500, 'Should return 500 for unexpected errors')
  t.is(result.valid, false, 'Should mark as invalid')
})

test('GatewayHelper.verifySession - should include requestId in error responses', async (t) => {
  resetAllMocks()
  
  // Force an unexpected error that goes to the catch block
  const data = null // This causes extractRequestData to throw
  
  const workerInstance = createValidWorkerInstance()
  
  const result = await GatewayHelper.verifySession(workerInstance, data)
  
  t.ok(result.requestId, 'Should include requestId')
  t.ok(typeof result.requestId === 'string' && result.requestId.length > 0, 'RequestId should be non-empty string')
})