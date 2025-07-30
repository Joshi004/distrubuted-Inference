'use strict'

const test = require('brittle')
const sinon = require('sinon')

// Test utilities
function createValidWorkerInstance() {
  return {
    store_s0: {
      getBee: sinon.stub().resolves({
        ready: sinon.stub().resolves(),
        get: sinon.stub(),
        put: sinon.stub()
      })
    }
  }
}

function createWorkerInstanceWithoutStore() {
  return {}
}

function createWorkerInstanceWithNullStore() {
  return { store_s0: null }
}

// Mock external dependencies
let bcryptStub
let jwtStub

// Setup global mocks
function setupGlobalMocks() {
  // Mock bcrypt
  bcryptStub = {
    hash: sinon.stub().resolves('hashed_password'),
    compare: sinon.stub().resolves(true)
  }
  
  // Mock jwt
  jwtStub = {
    sign: sinon.stub().returns('jwt_token')
  }
}

// Mock external modules before requiring AuthHelper
const Module = require('module')
const originalRequire = Module.prototype.require
Module.prototype.require = function(id) {
  if (id === 'bcrypt') {
    return bcryptStub
  }
  if (id === 'jsonwebtoken') {
    return jwtStub
  }
  if (id === '../shared-logger.js') {
    return {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
      lifecycle: sinon.stub(),
      jwt: sinon.stub(),
      rpc: sinon.stub(),
      warn: sinon.stub()
    }
  }
  return originalRequire.apply(this, arguments)
}

// Setup global mocks before loading AuthHelper
setupGlobalMocks()

// Load AuthHelper with mocked dependencies
const AuthHelper = require('../../../../auth_worker/auth-helper.js')

// Reset mocks function
function resetAllMocks() {
  if (bcryptStub) {
    bcryptStub.hash.reset()
    bcryptStub.hash.resolves('hashed_password') // Reconfigure after reset
    bcryptStub.compare.reset()
    bcryptStub.compare.resolves(true) // Reconfigure after reset
  }
  if (jwtStub) {
    jwtStub.sign.reset()
    jwtStub.sign.returns('jwt_token') // Reconfigure after reset
  }
  // Reset any sinon stubs on worker instances will be handled per test
}

// === EXTRACTREQUESTDATA METHOD TESTS ===

test('AuthHelper.extractRequestData - should extract data from new wrapped format', async (t) => {
  resetAllMocks()
  
  const requestData = { 
    data: { email: "test@example.com" }, 
    meta: { key: "auth123" } 
  }
  
  const result = AuthHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { email: "test@example.com" }, 'actualData should be extracted correctly')
  t.is(result.authKey, "auth123", 'authKey should be correctly extracted from meta.key')
})

test('AuthHelper.extractRequestData - should extract data from new format with missing meta', async (t) => {
  resetAllMocks()
  
  const requestData = { 
    data: { email: "test@example.com" } 
  }
  
  const result = AuthHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { email: "test@example.com" }, 'actualData should be extracted correctly')
  t.is(result.authKey, null, 'authKey should be null when meta is missing')
})

test('AuthHelper.extractRequestData - should extract data from new format with missing meta.key', async (t) => {
  resetAllMocks()
  
  const requestData = { 
    data: { email: "test@example.com" }, 
    meta: {} 
  }
  
  const result = AuthHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { email: "test@example.com" }, 'actualData should be extracted correctly')
  t.is(result.authKey, null, 'authKey should be null when meta.key is missing')
})

test('AuthHelper.extractRequestData - should extract data from old direct format', async (t) => {
  resetAllMocks()
  
  const requestData = { email: "test@example.com", password: "pass123" }
  
  const result = AuthHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { email: "test@example.com", password: "pass123" }, 'actualData should contain full object')
  t.is(result.authKey, null, 'authKey should be null for old format')
})

test('AuthHelper.extractRequestData - should handle empty object in old format', async (t) => {
  resetAllMocks()
  
  const requestData = {}
  
  const result = AuthHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, {}, 'actualData should be empty object')
  t.is(result.authKey, null, 'authKey should be null')
})

test('AuthHelper.extractRequestData - should throw error for null requestData', async (t) => {
  resetAllMocks()
  
  try {
    AuthHelper.extractRequestData(null)
    t.fail('Should throw error')
  } catch (error) {
    t.is(error.message, 'Invalid request format: expected object with data', 'Error message should match expected')
  }
})

test('AuthHelper.extractRequestData - should throw error for undefined requestData', async (t) => {
  resetAllMocks()
  
  try {
    AuthHelper.extractRequestData(undefined)
    t.fail('Should throw error')
  } catch (error) {
    t.is(error.message, 'Invalid request format: expected object with data', 'Error message should match expected')
  }
})

test('AuthHelper.extractRequestData - should throw error for non-object requestData', async (t) => {
  resetAllMocks()
  
  try {
    AuthHelper.extractRequestData("invalid")
    t.fail('Should throw error')
  } catch (error) {
    t.is(error.message, 'Invalid request format: expected object with data', 'Error message should match expected')
  }
})

test('AuthHelper.extractRequestData - should handle complex nested data in new format', async (t) => {
  resetAllMocks()
  
  const requestData = { 
    data: { user: { email: "test@example.com", profile: { name: "Test" } } }, 
    meta: { key: "token123" } 
  }
  
  const result = AuthHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { user: { email: "test@example.com", profile: { name: "Test" } } }, 'Nested data structure should be intact')
  t.is(result.authKey, "token123", 'authKey should be extracted correctly')
})

test('AuthHelper.extractRequestData - should handle complex nested data in old format', async (t) => {
  resetAllMocks()
  
  const requestData = { user: { email: "test@example.com", profile: { name: "Test" } } }
  
  const result = AuthHelper.extractRequestData(requestData)
  
  t.alike(result.actualData, { user: { email: "test@example.com", profile: { name: "Test" } } }, 'Nested data structure should be intact')
  t.is(result.authKey, null, 'authKey should be null')
})

// === GETUSERSDATABASE METHOD TESTS ===

test('AuthHelper.getUsersDatabase - should throw error when store_s0 facility is not available', async (t) => {
  resetAllMocks()
  
  const workerInstance = createWorkerInstanceWithoutStore()
  
  try {
    await AuthHelper.getUsersDatabase(workerInstance)
    t.fail('Should throw error')
  } catch (error) {
    t.is(error.message, 'Store facility not available', 'Error message should match expected')
  }
})

test('AuthHelper.getUsersDatabase - should throw error when store_s0 facility is null', async (t) => {
  resetAllMocks()
  
  const workerInstance = createWorkerInstanceWithNullStore()
  
  try {
    await AuthHelper.getUsersDatabase(workerInstance)
    t.fail('Should throw error')
  } catch (error) {
    t.is(error.message, 'Store facility not available', 'Error message should match expected')
  }
})

test('AuthHelper.getUsersDatabase - should call getBee with correct parameters', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  
  await AuthHelper.getUsersDatabase(workerInstance)
  
  t.is(workerInstance.store_s0.getBee.callCount, 1, 'getBee should be called once')
  const [nameParam, optionsParam] = workerInstance.store_s0.getBee.firstCall.args
  t.alike(nameParam, { name: 'users' }, 'getBee should be called with name users')
  t.alike(optionsParam, { keyEncoding: 'utf-8', valueEncoding: 'json' }, 'getBee should be called with correct encoding options')
})

test('AuthHelper.getUsersDatabase - should call ready() on returned database', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves()
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  await AuthHelper.getUsersDatabase(workerInstance)
  
  t.is(mockDatabase.ready.callCount, 1, 'ready() should be called on database')
})

test('AuthHelper.getUsersDatabase - should return the database instance', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves()
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const result = await AuthHelper.getUsersDatabase(workerInstance)
  
  t.is(result, mockDatabase, 'Should return the same database instance')
})

test('AuthHelper.getUsersDatabase - should propagate getBee errors', async (t) => {
  resetAllMocks()
  
  const testError = new Error('getBee failed')
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.rejects(testError)
  
  try {
    await AuthHelper.getUsersDatabase(workerInstance)
    t.fail('Should propagate error')
  } catch (error) {
    t.is(error, testError, 'Should propagate the same error')
  }
})

test('AuthHelper.getUsersDatabase - should propagate ready() errors', async (t) => {
  resetAllMocks()
  
  const testError = new Error('ready failed')
  const mockDatabase = {
    ready: sinon.stub().rejects(testError)
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  try {
    await AuthHelper.getUsersDatabase(workerInstance)
    t.fail('Should propagate error')
  } catch (error) {
    t.is(error, testError, 'Should propagate the same error')
  }
})

// === REGISTER METHOD TESTS ===

test('AuthHelper.register - should extract data using extractRequestData', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves(null),
    put: sinon.stub().resolves()
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const wrappedData = { 
    data: { email: "test@example.com", password: "pass123" } 
  }
  
  await AuthHelper.register(workerInstance, wrappedData)
  
  // Verify that the method processes the wrapped data correctly
  t.is(mockDatabase.get.callCount, 2, 'Database get should be called twice (check existence + verify storage)')
  t.is(mockDatabase.get.firstCall.args[0], "test@example.com", 'Should use extracted email')
})

test('AuthHelper.register - should throw error when email is missing', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { password: "pass123" }
  
  const result = await AuthHelper.register(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.message, 'Email and password are required', 'Should return validation error')
})

test('AuthHelper.register - should throw error when password is missing', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { email: "test@example.com" }
  
  const result = await AuthHelper.register(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.message, 'Email and password are required', 'Should return validation error')
})

test('AuthHelper.register - should throw error when both email and password are missing', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = {}
  
  const result = await AuthHelper.register(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.message, 'Email and password are required', 'Should return validation error')
})

test('AuthHelper.register - should check if user already exists', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves(null),
    put: sinon.stub().resolves()
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.register(workerInstance, data)
  
  t.is(mockDatabase.get.callCount, 2, 'Database get should be called twice (check + verify)')
  t.is(mockDatabase.get.firstCall.args[0], "test@example.com", 'Should check user existence with email')
})

test('AuthHelper.register - should return error when user already exists', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.register(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 409, 'Should return conflict status')
  t.is(result.message, 'User already exists', 'Should return user exists message')
})

test('AuthHelper.register - should proceed when user does not exist', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub()
  }
  mockDatabase.get.onFirstCall().resolves(null) // User doesn't exist
  mockDatabase.get.onSecondCall().resolves({ value: { email: "test@example.com" } }) // Verification
  mockDatabase.put = sinon.stub().resolves()
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.register(workerInstance, data)
  
  t.is(bcryptStub.hash.callCount, 1, 'Password should be hashed')
  t.is(mockDatabase.put.callCount, 1, 'User should be stored')
  t.is(result.success, true, 'Should return success')
})

test('AuthHelper.register - should hash password before storing', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub()
  }
  mockDatabase.get.onFirstCall().resolves(null)
  mockDatabase.get.onSecondCall().resolves({ value: { email: "test@example.com" } })
  mockDatabase.put = sinon.stub().resolves()
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.register(workerInstance, data)
  
  t.is(bcryptStub.hash.callCount, 1, 'bcrypt.hash should be called once')
  t.is(bcryptStub.hash.firstCall.args[0], "pass123", 'Should hash the provided password')
  t.is(bcryptStub.hash.firstCall.args[1], 10, 'Should use saltRounds of 10')
})

test('AuthHelper.register - should store user with correct data structure', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub()
  }
  mockDatabase.get.onFirstCall().resolves(null)
  mockDatabase.get.onSecondCall().resolves({ value: { email: "test@example.com" } })
  mockDatabase.put = sinon.stub().resolves()
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.register(workerInstance, data)
  
  t.is(mockDatabase.put.callCount, 1, 'Database put should be called once')
  t.is(mockDatabase.put.firstCall.args[0], "test@example.com", 'Should use email as key')
  
  const userData = mockDatabase.put.firstCall.args[1]
  t.is(userData.email, "test@example.com", 'User data should contain email')
  t.is(userData.passwordHash, "hashed_password", 'User data should contain hashed password')
  t.ok(userData.createdAt, 'User data should contain createdAt')
  t.ok(Date.parse(userData.createdAt), 'createdAt should be valid ISO string')
})

test('AuthHelper.register - should verify user storage after creation', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub()
  }
  mockDatabase.get.onFirstCall().resolves(null) // User doesn't exist
  mockDatabase.get.onSecondCall().resolves({ value: { email: "test@example.com" } }) // Verification
  mockDatabase.put = sinon.stub().resolves()
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.register(workerInstance, data)
  
  t.is(mockDatabase.get.callCount, 2, 'Database get should be called twice')
  t.is(mockDatabase.get.secondCall.args[0], "test@example.com", 'Should verify with same email')
})

test('AuthHelper.register - should return success response for valid registration', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub()
  }
  mockDatabase.get.onFirstCall().resolves(null)
  mockDatabase.get.onSecondCall().resolves({ value: { email: "test@example.com" } })
  mockDatabase.put = sinon.stub().resolves()
  
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.register(workerInstance, data)
  
  t.is(result.success, true, 'Should return success')
  t.is(result.status, 201, 'Should return created status')
  t.is(result.message, 'User registered successfully', 'Should return success message')
  t.is(result.email, 'test@example.com', 'Should include email in response')
})

test('AuthHelper.register - should handle store facility unavailable error', async (t) => {
  resetAllMocks()
  
  const workerInstance = createWorkerInstanceWithoutStore()
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.register(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 503, 'Should return service unavailable status')
  t.is(result.message, 'Authentication service temporarily unavailable - store not ready', 'Should return specific error message')
})

test('AuthHelper.register - should handle channel closed error', async (t) => {
  resetAllMocks()
  
  const channelError = new Error('CHANNEL_CLOSED')
  const mockDatabase = {
    ready: sinon.stub().rejects(channelError)
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.register(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 503, 'Should return service unavailable status')
  t.is(result.message, 'Authentication service temporarily unavailable - connection closed', 'Should return specific error message')
})

test('AuthHelper.register - should handle unexpected errors', async (t) => {
  resetAllMocks()
  
  const unexpectedError = new Error('Unexpected database error')
  const mockDatabase = {
    ready: sinon.stub().rejects(unexpectedError)
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.register(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 500, 'Should return internal server error status')
  t.is(result.message, 'Unexpected database error', 'Should preserve original error message')
})

// === LOGIN METHOD TESTS ===

test('AuthHelper.login - should extract data using extractRequestData', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com", passwordHash: "hashed_password" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const wrappedData = { 
    data: { email: "test@example.com", password: "pass123" } 
  }
  
  await AuthHelper.login(workerInstance, wrappedData)
  
  t.is(mockDatabase.get.callCount, 1, 'Database get should be called')
  t.is(mockDatabase.get.firstCall.args[0], "test@example.com", 'Should use extracted email')
})

test('AuthHelper.login - should throw error when email is missing', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { password: "pass123" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.message, 'Email and password are required', 'Should return validation error')
})

test('AuthHelper.login - should throw error when password is missing', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { email: "test@example.com" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.message, 'Email and password are required', 'Should return validation error')
})

test('AuthHelper.login - should find user by email', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com", passwordHash: "hashed_password" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.login(workerInstance, data)
  
  t.is(mockDatabase.get.callCount, 1, 'Database get should be called once')
  t.is(mockDatabase.get.firstCall.args[0], "test@example.com", 'Should lookup user by email')
})

test('AuthHelper.login - should return error when user not found', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves(null)
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 401, 'Should return unauthorized status')
  t.is(result.message, 'Invalid credentials', 'Should return generic error message')
})

test('AuthHelper.login - should validate password using bcrypt.compare', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com", passwordHash: "stored_hash" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.login(workerInstance, data)
  
  t.is(bcryptStub.compare.callCount, 1, 'bcrypt.compare should be called once')
  t.is(bcryptStub.compare.firstCall.args[0], "pass123", 'Should compare provided password')
  t.is(bcryptStub.compare.firstCall.args[1], "stored_hash", 'Should compare against stored hash')
})

test('AuthHelper.login - should return error for invalid password', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com", passwordHash: "stored_hash" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  bcryptStub.compare.resolves(false) // Invalid password
  
  const data = { email: "test@example.com", password: "wrongpass" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 401, 'Should return unauthorized status')
  t.is(result.message, 'Invalid credentials', 'Should return generic error message')
})

test('AuthHelper.login - should generate JWT token for valid credentials', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com", passwordHash: "stored_hash" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  bcryptStub.compare.resolves(true) // Valid password
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.login(workerInstance, data)
  
  t.is(jwtStub.sign.callCount, 1, 'jwt.sign should be called once')
  const [payload, secret, options] = jwtStub.sign.firstCall.args
  t.alike(payload, { email: "test@example.com", role: "user" }, 'Should use correct payload')
  t.alike(options, { expiresIn: "24h" }, 'Should set 24h expiration')
})

test('AuthHelper.login - should use environment JWT_SECRET when available', async (t) => {
  resetAllMocks()
  
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'env_secret'
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com", passwordHash: "stored_hash" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  bcryptStub.compare.resolves(true)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.login(workerInstance, data)
  
  t.is(jwtStub.sign.firstCall.args[1], 'env_secret', 'Should use environment JWT secret')
  
  // Cleanup
  if (originalSecret) {
    process.env.JWT_SECRET = originalSecret
  } else {
    delete process.env.JWT_SECRET
  }
})

test('AuthHelper.login - should use default JWT_SECRET when environment variable missing', async (t) => {
  resetAllMocks()
  
  const originalSecret = process.env.JWT_SECRET
  delete process.env.JWT_SECRET
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com", passwordHash: "stored_hash" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  bcryptStub.compare.resolves(true)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.login(workerInstance, data)
  
  t.is(jwtStub.sign.firstCall.args[1], 'distributed-ai-secure-secret-key-2025', 'Should use default secret')
  
  // Cleanup
  if (originalSecret) {
    process.env.JWT_SECRET = originalSecret
  }
})

test('AuthHelper.login - should set token expiration to 24 hours', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com", passwordHash: "stored_hash" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  bcryptStub.compare.resolves(true)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  await AuthHelper.login(workerInstance, data)
  
  const options = jwtStub.sign.firstCall.args[2]
  t.is(options.expiresIn, '24h', 'Should set 24h expiration')
})

test('AuthHelper.login - should return success response with token', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com", passwordHash: "stored_hash" } })
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  bcryptStub.compare.resolves(true)
  jwtStub.sign.returns('generated_token')
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.is(result.success, true, 'Should return success')
  t.is(result.status, 200, 'Should return OK status')
  t.is(result.email, 'test@example.com', 'Should include email')
  t.is(result.key, 'generated_token', 'Should include JWT token as key')
})

test('AuthHelper.login - should handle missing passwordHash in user data', async (t) => {
  resetAllMocks()
  
  const mockDatabase = {
    ready: sinon.stub().resolves(),
    get: sinon.stub().resolves({ value: { email: "test@example.com" } }) // Missing passwordHash
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 500, 'Should return internal server error status')
  t.is(result.message, 'User account is corrupted - no password hash found', 'Should return specific error message')
})

test('AuthHelper.login - should handle store facility unavailable error', async (t) => {
  resetAllMocks()
  
  const workerInstance = createWorkerInstanceWithoutStore()
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 503, 'Should return service unavailable status')
  t.is(result.message, 'Authentication service temporarily unavailable - store not ready', 'Should return specific error message')
})

test('AuthHelper.login - should handle channel closed error', async (t) => {
  resetAllMocks()
  
  const channelError = new Error('CHANNEL_CLOSED')
  const mockDatabase = {
    ready: sinon.stub().rejects(channelError)
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 503, 'Should return service unavailable status')
  t.is(result.message, 'Authentication service temporarily unavailable - connection closed', 'Should return specific error message')
})

test('AuthHelper.login - should handle unexpected errors', async (t) => {
  resetAllMocks()
  
  const unexpectedError = new Error('Unexpected login error')
  const mockDatabase = {
    ready: sinon.stub().rejects(unexpectedError)
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.is(result.success, false, 'Should return failure')
  t.is(result.status, 500, 'Should return internal server error status')
  t.is(result.message, 'Unexpected login error', 'Should preserve original error message')
})

test('AuthHelper.login - should include requestId in error responses', async (t) => {
  resetAllMocks()
  
  const unexpectedError = new Error('Test error')
  const mockDatabase = {
    ready: sinon.stub().rejects(unexpectedError)
  }
  const workerInstance = createValidWorkerInstance()
  workerInstance.store_s0.getBee.resolves(mockDatabase)
  
  const data = { email: "test@example.com", password: "pass123" }
  
  const result = await AuthHelper.login(workerInstance, data)
  
  t.ok(result.requestId, 'Should include requestId in error response')
  t.ok(typeof result.requestId === 'string' && result.requestId.length > 0, 'RequestId should be non-empty string')
})