'use strict'

const test = require('brittle')
const sinon = require('sinon')

// Mock dependencies using Module.prototype.require pattern
const Module = require('module')
const originalRequire = Module.prototype.require

// Mock objects
const BaseMock = class {
  constructor(conf, ctx) {
    this.conf = conf
    this.ctx = ctx
  }
  init() {}
  setInitFacs() {}
  start() {}
  stop() {}
}

const ClientHelperMock = {
  sendRequest: sinon.stub(),
  registerUser: sinon.stub(),
  loginUser: sinon.stub(),
  logout: sinon.stub(),
  verifySession: sinon.stub(),
  getApiToken: sinon.stub()
}

const loggerMock = {
  error: sinon.stub()
}

// Setup module mocking
Module.prototype.require = function(id) {
  if (id === '../bfx-wrk-base/base.js') {
    return BaseMock
  }
  if (id === './client-helper.js') {
    return ClientHelperMock
  }
  if (id === '../shared-logger.js') {
    return loggerMock
  }
  return originalRequire.apply(this, arguments)
}

// Now require ClientWorker
const ClientWorker = require('../../../../client_worker/client-worker.js')

// Test utilities
function createValidConfig() {
  return { env: 'development', root: process.cwd() }
}

function createValidContext() {
  return { wtype: 'client-worker', env: 'dev', root: process.cwd() }
}

function createMockNetFacility() {
  return {
    startRpc: sinon.stub().resolves(),
    startLookup: sinon.stub()
  }
}

// Setup spies once
const setInitFacsSpy = sinon.spy(BaseMock.prototype, 'setInitFacs')
const superInitSpy = sinon.spy(BaseMock.prototype, 'init')
const superStopSpy = sinon.spy(BaseMock.prototype, 'stop')

function resetMocks() {
  // Reset ClientHelper stubs
  Object.values(ClientHelperMock).forEach(stub => {
    if (stub.reset) stub.reset()
  })
  
  // Reset logger mock
  loggerMock.error.reset()
  
  // Reset spies
  setInitFacsSpy.resetHistory()
  superInitSpy.resetHistory()
  superStopSpy.resetHistory()
}

// Note: Original require will be restored automatically when process ends

// Constructor Tests

// ✅ Test: should create ClientWorker instance with valid parameters
test('should create ClientWorker instance with valid parameters', (t) => {
  resetMocks()
  
  const conf = createValidConfig()
  const ctx = createValidContext()
  
  const worker = new ClientWorker(conf, ctx)
  
  t.ok(worker instanceof ClientWorker, 'Instance should be ClientWorker')
  t.ok(worker instanceof BaseMock, 'Instance should extend BaseMock')
  t.end()
})

// ✅ Test: should initialize sessionKey property to null
test('should initialize sessionKey property to null', (t) => {
  resetMocks()
  
  const conf = createValidConfig()
  const ctx = createValidContext()
  
  const worker = new ClientWorker(conf, ctx)
  
  t.is(worker.sessionKey, null, 'sessionKey should be null')
  t.end()
})

// ✅ Test: should call setInitFacs with exactly 2 facilities
test('should call setInitFacs with exactly 2 facilities', (t) => {
  resetMocks()
  
  const conf = createValidConfig()
  const ctx = createValidContext()
  
  new ClientWorker(conf, ctx)
  
  t.ok(setInitFacsSpy.calledOnce, 'setInitFacs should be called once')
  t.is(setInitFacsSpy.firstCall.args[0].length, 2, 'should have 2 facilities')
  t.end()
})

// ✅ Test: should configure storage facility with correct parameters
test('should configure storage facility with correct parameters', (t) => {
  resetMocks()
  
  const conf = createValidConfig()
  const ctx = createValidContext()
  
  new ClientWorker(conf, ctx)
  
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storageFacility = facilities[0]
  
  t.alike(storageFacility, [
    'fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/client' }, 0
  ], 'Storage facility should match expected configuration')
  t.end()
})

// ✅ Test: should configure network facility with correct parameters
test('should configure network facility with correct parameters', (t) => {
  resetMocks()
  
  const conf = createValidConfig()
  const ctx = createValidContext()
  
  new ClientWorker(conf, ctx)
  
  const facilities = setInitFacsSpy.firstCall.args[0]
  const networkFacility = facilities[1]
  
  t.alike(networkFacility, [
    'fac', 'hp-svc-facs-net', 'net', 'default', { allowLocal: true }, 10
  ], 'Network facility should match expected configuration')
  t.end()
})

// ✅ Test: should configure storage facility with client-specific directory
test('should configure storage facility with client-specific directory', (t) => {
  resetMocks()
  
  const conf = createValidConfig()
  const ctx = createValidContext()
  
  new ClientWorker(conf, ctx)
  
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storageFacility = facilities[0]
  
  t.alike(storageFacility[4], { storeDir: './data/client' }, 'Storage config should be client-specific')
  t.is(storageFacility[3], 's0', 'Storage facility name should be s0')
  t.is(storageFacility[2], null, 'Storage facility type should be null')
  t.end()
})

// ✅ Test: should configure network facility with allowLocal option
test('should configure network facility with allowLocal option', (t) => {
  resetMocks()
  
  const conf = createValidConfig()
  const ctx = createValidContext()
  
  new ClientWorker(conf, ctx)
  
  const facilities = setInitFacsSpy.firstCall.args[0]
  const networkFacility = facilities[1]
  
  t.alike(networkFacility[4], { allowLocal: true }, 'Network config should have allowLocal')
  t.is(networkFacility[3], 'default', 'Network facility name should be default')
  t.is(networkFacility[2], 'net', 'Network facility type should be net')
  t.end()
})

// ✅ Test: should configure facilities with different priorities
test('should configure facilities with different priorities', (t) => {
  resetMocks()
  
  const conf = createValidConfig()
  const ctx = createValidContext()
  
  new ClientWorker(conf, ctx)
  
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storagePriority = facilities[0][5]
  const networkPriority = facilities[1][5]
  
  t.is(storagePriority, 0, 'Storage facility should have priority 0')
  t.is(networkPriority, 10, 'Network facility should have priority 10')
  t.end()
})

// _start Method Tests

// ✅ Test: should check net_default facility availability before starting
test('should check net_default facility availability before starting', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  worker.net_default = null
  
  worker._start((err) => {
    t.ok(err instanceof Error, 'Should return error')
    t.is(err.message, 'net_default facility not available', 'Error message should match')
    t.end()
  })
})

// ✅ Test: should proceed when net_default facility is available
test('should proceed when net_default facility is available', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  worker.net_default = createMockNetFacility()
  
  worker._start((err) => {
    t.not(err, 'Should not return error')
    t.end()
  })
})

// ✅ Test: should start RPC client when net_default facility is available
test('should start RPC client when net_default facility is available', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const mockNetFacility = createMockNetFacility()
  worker.net_default = mockNetFacility
  
  worker._start((err) => {
    t.ok(mockNetFacility.startRpc.calledOnce, 'startRpc should be called once')
    t.not(err, 'Should not return error')
    t.end()
  })
})

// ✅ Test: should handle RPC client startup failure
test('should handle RPC client startup failure', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const mockNetFacility = createMockNetFacility()
  const startRpcError = new Error('RPC startup failed')
  mockNetFacility.startRpc.rejects(startRpcError)
  worker.net_default = mockNetFacility
  
  worker._start((err) => {
    t.is(err, startRpcError, 'Should return RPC startup error')
    t.ok(loggerMock.error.calledOnce, 'Should log error')
    t.end()
  })
})

// ✅ Test: should start lookup service after RPC client
test('should start lookup service after RPC client', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const mockNetFacility = createMockNetFacility()
  worker.net_default = mockNetFacility
  
  worker._start((err) => {
    t.ok(mockNetFacility.startLookup.calledOnce, 'startLookup should be called once')
    t.ok(mockNetFacility.startRpc.calledBefore(mockNetFacility.startLookup), 'startRpc should be called before startLookup')
    t.not(err, 'Should not return error')
    t.end()
  })
})

// Delegation Methods Tests

// ✅ Test: should delegate sendRequest to ClientHelper.sendRequest with correct parameters
test('should delegate sendRequest to ClientHelper.sendRequest with correct parameters', async (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const testPrompt = 'Test AI prompt for processing'
  const expectedResult = { response: 'AI response' }
  ClientHelperMock.sendRequest.resolves(expectedResult)
  
  const result = await worker.sendRequest(testPrompt)
  
  t.ok(ClientHelperMock.sendRequest.calledOnce, 'ClientHelper.sendRequest should be called once')
  t.ok(ClientHelperMock.sendRequest.calledWith(worker, testPrompt), 'Should be called with correct parameters')
  t.is(result, expectedResult, 'Should return expected result')
  t.end()
})

// ✅ Test: should delegate registerUser to ClientHelper.registerUser with correct parameters
test('should delegate registerUser to ClientHelper.registerUser with correct parameters', async (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const testEmail = 'test@example.com'
  const testPassword = 'testpass123'
  const expectedResult = { success: true }
  ClientHelperMock.registerUser.resolves(expectedResult)
  
  const result = await worker.registerUser(testEmail, testPassword)
  
  t.ok(ClientHelperMock.registerUser.calledOnce, 'ClientHelper.registerUser should be called once')
  t.ok(ClientHelperMock.registerUser.calledWith(worker, testEmail, testPassword), 'Should be called with correct parameters')
  t.is(result, expectedResult, 'Should return expected result')
  t.end()
})

// ✅ Test: should delegate loginUser to ClientHelper.loginUser with correct parameters
test('should delegate loginUser to ClientHelper.loginUser with correct parameters', async (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const testEmail = 'test@example.com'
  const testPassword = 'testpass123'
  const expectedResult = { success: true, token: 'jwt_token' }
  ClientHelperMock.loginUser.resolves(expectedResult)
  
  const result = await worker.loginUser(testEmail, testPassword)
  
  t.ok(ClientHelperMock.loginUser.calledOnce, 'ClientHelper.loginUser should be called once')
  t.ok(ClientHelperMock.loginUser.calledWith(worker, testEmail, testPassword), 'Should be called with correct parameters')
  t.is(result, expectedResult, 'Should return expected result')
  t.end()
})

// ✅ Test: should delegate logout to ClientHelper.logout with correct parameters
test('should delegate logout to ClientHelper.logout with correct parameters', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const expectedResult = { success: true, message: 'Logged out' }
  ClientHelperMock.logout.returns(expectedResult)
  
  const result = worker.logout()
  
  t.ok(ClientHelperMock.logout.calledOnce, 'ClientHelper.logout should be called once')
  t.ok(ClientHelperMock.logout.calledWith(worker), 'Should be called with worker instance')
  t.is(result, expectedResult, 'Should return expected result')
  t.end()
})

// ✅ Test: should delegate verifySession to ClientHelper.verifySession with correct parameters
test('should delegate verifySession to ClientHelper.verifySession with correct parameters', async (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const expectedResult = { valid: true, email: 'test@example.com' }
  ClientHelperMock.verifySession.resolves(expectedResult)
  
  const result = await worker.verifySession()
  
  t.ok(ClientHelperMock.verifySession.calledOnce, 'ClientHelper.verifySession should be called once')
  t.ok(ClientHelperMock.verifySession.calledWith(worker), 'Should be called with worker instance')
  t.is(result, expectedResult, 'Should return expected result')
  t.end()
})

// ✅ Test: should delegate getApiToken to ClientHelper.getApiToken with correct parameters
test('should delegate getApiToken to ClientHelper.getApiToken with correct parameters', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const expectedResult = { success: true, token: 'jwt_token' }
  ClientHelperMock.getApiToken.returns(expectedResult)
  
  const result = worker.getApiToken()
  
  t.ok(ClientHelperMock.getApiToken.calledOnce, 'ClientHelper.getApiToken should be called once')
  t.ok(ClientHelperMock.getApiToken.calledWith(worker), 'Should be called with worker instance')
  t.is(result, expectedResult, 'Should return expected result')
  t.end()
})

// stop Method Tests

// ✅ Test: should call parent stop method
test('should call parent stop method', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  
  worker.stop()
  
  t.ok(superStopSpy.calledOnce, 'super.stop should be called once')
  t.end()
})

// ✅ Test: should complete stop operation successfully
test('should complete stop operation successfully', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  
  try {
    worker.stop()
    t.pass('Stop method should not throw')
  } catch (error) {
    t.fail(`Stop method should not throw: ${error.message}`)
  }
  t.ok(superStopSpy.calledOnce, 'super.stop should be called once')
  t.end()
})

// Edge Cases

// ✅ Test: should handle null conf parameter
test('should handle null conf parameter', (t) => {
  resetMocks()
  
  try {
    new ClientWorker(null, createValidContext())
    t.pass('Should handle null conf parameter')
  } catch (error) {
    t.fail(`Should handle null conf parameter: ${error.message}`)
  }
  t.end()
})

// ✅ Test: should handle undefined conf parameter
test('should handle undefined conf parameter', (t) => {
  resetMocks()
  
  try {
    new ClientWorker(undefined, createValidContext())
    t.pass('Should handle undefined conf parameter')
  } catch (error) {
    t.fail(`Should handle undefined conf parameter: ${error.message}`)
  }
  t.end()
})

// ✅ Test: should handle null ctx parameter
test('should handle null ctx parameter', (t) => {
  resetMocks()
  
  try {
    new ClientWorker(createValidConfig(), null)
    t.pass('Should handle null ctx parameter')
  } catch (error) {
    t.fail(`Should handle null ctx parameter: ${error.message}`)
  }
  t.end()
})

// ✅ Test: should handle undefined ctx parameter
test('should handle undefined ctx parameter', (t) => {
  resetMocks()
  
  try {
    new ClientWorker(createValidConfig(), undefined)
    t.pass('Should handle undefined ctx parameter')
  } catch (error) {
    t.fail(`Should handle undefined ctx parameter: ${error.message}`)
  }
  t.end()
})

// ✅ Test: should handle empty conf object
test('should handle empty conf object', (t) => {
  resetMocks()
  
  const worker = new ClientWorker({}, createValidContext())
  
  t.ok(worker instanceof ClientWorker, 'Should create instance with empty conf')
  t.ok(setInitFacsSpy.calledOnce, 'Should still call setInitFacs')
  t.end()
})

// ✅ Test: should handle empty ctx object
test('should handle empty ctx object', (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), {})
  
  t.ok(worker instanceof ClientWorker, 'Should create instance with empty ctx')
  t.ok(setInitFacsSpy.calledOnce, 'Should still call setInitFacs')
  t.end()
})

// ✅ Test: should handle parameter validation for delegation methods
test('should handle parameter validation for delegation methods', async (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  
  // Setup mocks to return values
  ClientHelperMock.sendRequest.resolves({})
  ClientHelperMock.registerUser.resolves({})
  ClientHelperMock.loginUser.resolves({})
  ClientHelperMock.logout.returns({})
  ClientHelperMock.verifySession.resolves({})
  ClientHelperMock.getApiToken.returns({})
  
  // Test various parameter combinations
  await worker.sendRequest(null)
  t.ok(ClientHelperMock.sendRequest.calledWith(worker, null), 'sendRequest should handle null')
  
  await worker.registerUser(undefined, undefined)
  t.ok(ClientHelperMock.registerUser.calledWith(worker, undefined, undefined), 'registerUser should handle undefined')
  
  await worker.loginUser('email', null)
  t.ok(ClientHelperMock.loginUser.calledWith(worker, 'email', null), 'loginUser should handle null password')
  
  worker.logout()
  t.ok(ClientHelperMock.logout.calledWith(worker), 'logout should work with no additional params')
  
  await worker.verifySession()
  t.ok(ClientHelperMock.verifySession.calledWith(worker), 'verifySession should work with no additional params')
  
  worker.getApiToken()
  t.ok(ClientHelperMock.getApiToken.calledWith(worker), 'getApiToken should work with no additional params')
  
  t.end()
})

// ✅ Test: should handle ClientHelper errors gracefully
test('should handle ClientHelper errors gracefully', async (t) => {
  resetMocks()
  
  const worker = new ClientWorker(createValidConfig(), createValidContext())
  const testError = new Error('ClientHelper error')
  
  // Setup error responses
  ClientHelperMock.sendRequest.rejects(testError)
  ClientHelperMock.registerUser.rejects(testError)
  ClientHelperMock.loginUser.rejects(testError)
  ClientHelperMock.logout.throws(testError)
  ClientHelperMock.verifySession.rejects(testError)
  ClientHelperMock.getApiToken.throws(testError)
  
  // Test that errors propagate unchanged
  try {
    await worker.sendRequest('test')
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error, testError, 'sendRequest should propagate error unchanged')
  }
  
  try {
    await worker.registerUser('email', 'pass')
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error, testError, 'registerUser should propagate error unchanged')
  }
  
  try {
    await worker.loginUser('email', 'pass')
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error, testError, 'loginUser should propagate error unchanged')
  }
  
  try {
    worker.logout()
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error, testError, 'logout should propagate error unchanged')
  }
  
  try {
    await worker.verifySession()
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error, testError, 'verifySession should propagate error unchanged')
  }
  
  try {
    worker.getApiToken()
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error, testError, 'getApiToken should propagate error unchanged')
  }
  
  t.end()
})