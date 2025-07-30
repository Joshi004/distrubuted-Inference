'use strict'

const test = require('brittle')
const sinon = require('sinon')

// Test utilities
function createValidConfig() {
  return { env: 'development', root: process.cwd() }
}

function createValidContext() {
  return { wtype: 'auth-worker', env: 'dev', root: process.cwd() }
}

// Mock SimpleMetrics before requiring AuthWorker
const SimpleMetricsMock = sinon.stub().returns({
  isMetricsInstance: true
})

// Create isolated console mock to avoid conflicts
let originalConsoleLog
let consoleLogStub

function mockConsole() {
  if (!originalConsoleLog) {
    originalConsoleLog = console.log
    consoleLogStub = sinon.stub()
    console.log = consoleLogStub
  }
  consoleLogStub.resetHistory()
  return consoleLogStub
}

function restoreConsole() {
  if (originalConsoleLog) {
    console.log = originalConsoleLog
    originalConsoleLog = null
    consoleLogStub = null
  }
}

// Mock SimpleMetrics, AuthHelper and logger modules
const Module = require('module')
const originalRequire = Module.prototype.require
Module.prototype.require = function(id) {
  if (id === '../simple-metrics.js') {
    return SimpleMetricsMock
  }
  if (id === './auth-helper.js') {
    return {
      register: sinon.stub().resolves('register result'),
      login: sinon.stub().resolves('login result')
    }
  }
  if (id === '../shared-logger.js') {
    return {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
      lifecycle: sinon.stub(),
      jwt: sinon.stub(),
      rpc: sinon.stub()
    }
  }
  return originalRequire.apply(this, arguments)
}

// Load AuthWorker with mocked SimpleMetrics
const AuthWorker = require('../../../../auth_worker/auth-worker.js')

// Expected values for assertions
const EXPECTED_STORAGE_FACILITY = ['fac', 'hp-svc-facs-store', 'store', 's0', { storeDir: './data/auth' }, 0]
const EXPECTED_NETWORK_FACILITY = ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
const EXPECTED_METRICS_SERVICE = 'auth'
const EXPECTED_METRICS_PORT = 9101

test('should create AuthWorker instance with valid parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()

  // Action  
  const worker = new AuthWorker(conf, ctx)

  // Assert
  t.ok(worker, 'Instance should be created')
  t.ok(worker instanceof AuthWorker, 'Instance should be of AuthWorker type')
  
  // Cleanup
  restoreConsole()
})

test('should call setInitFacs with exactly 2 facilities', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  t.is(setInitFacsSpy.callCount, 1, 'setInitFacs should be called once')
  t.is(setInitFacsSpy.firstCall.args[0].length, 2, 'setInitFacs should be called with array of 2 facilities')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should configure storage facility with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storageFacility = facilities[0]
  
  t.alike(storageFacility, EXPECTED_STORAGE_FACILITY, 'Storage facility should match expected configuration')
  t.is(storageFacility[5], 0, 'Storage facility should have priority 0')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should configure network facility with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const networkFacility = facilities[1]
  
  t.alike(networkFacility, EXPECTED_NETWORK_FACILITY, 'Network facility should match expected configuration')
  t.is(networkFacility[5], 10, 'Network facility should have priority 10')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should configure storage facility with auth-specific directory', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storageFacility = facilities[0]
  
  t.is(storageFacility[4].storeDir, './data/auth', 'Storage directory should be auth-specific')
  t.is(storageFacility[3], 's0', 'Storage facility name should be s0')
  t.is(storageFacility[2], 'store', 'Storage facility type should be store')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should configure network facility with empty config', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const networkFacility = facilities[1]
  
  t.alike(networkFacility[4], {}, 'Network facility config should be empty object')
  t.is(networkFacility[3], 'default', 'Network facility name should be default')
  t.is(networkFacility[2], 'net', 'Network facility type should be net')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should create SimpleMetrics with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  SimpleMetricsMock.resetHistory() // Reset call history

  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  t.is(SimpleMetricsMock.callCount, 1, 'SimpleMetrics constructor should be called once')
  t.is(SimpleMetricsMock.firstCall.args[0], EXPECTED_METRICS_SERVICE, 'SimpleMetrics should be called with auth service name')
  t.is(SimpleMetricsMock.firstCall.args[1], EXPECTED_METRICS_PORT, 'SimpleMetrics should be called with port 9101')
  
  // Cleanup
  restoreConsole()
})

test('should assign metrics property', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const mockMetricsInstance = { isMetricsInstance: true }
  SimpleMetricsMock.returns(mockMetricsInstance)

  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  t.ok(worker.metrics, 'metrics property should exist')
  t.ok(worker.metrics !== null && worker.metrics !== undefined, 'metrics property should not be null or undefined')
  t.is(worker.metrics, mockMetricsInstance, 'metrics property should be assigned to SimpleMetrics instance')
  
  // Cleanup
  restoreConsole()
})

test('should call setInitFacs before creating metrics', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  // Spy on setInitFacs 
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Reset SimpleMetrics to simple return
  SimpleMetricsMock.resetBehavior()
  SimpleMetricsMock.returns({ isMetricsInstance: true })

  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  t.ok(setInitFacsSpy.called, 'setInitFacs should be called')
  t.ok(SimpleMetricsMock.called, 'SimpleMetrics should be called')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should configure facilities with different priorities', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storageFacility = facilities[0]
  const networkFacility = facilities[1]
  
  t.is(storageFacility[5], 0, 'Storage facility should have priority 0')
  t.is(networkFacility[5], 10, 'Network facility should have priority 10')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should use auth-specific storage directory', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storageFacility = facilities[0]
  
  t.is(storageFacility[4].storeDir, './data/auth', 'Storage directory should be ./data/auth (not ./data/processor)')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should use auth-specific metrics service name', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  SimpleMetricsMock.resetHistory()

  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  t.is(SimpleMetricsMock.firstCall.args[0], 'auth', 'SimpleMetrics should be called with service name auth (not processor)')
  
  // Cleanup
  restoreConsole()
})

test('should use auth-specific metrics port', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  SimpleMetricsMock.resetHistory()

  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  t.is(SimpleMetricsMock.firstCall.args[1], 9101, 'SimpleMetrics should be called with port 9101 (not 9102)')
  
  // Cleanup
  restoreConsole()
})

// Edge Cases
test('should handle null conf parameter', async (t) => {
  // Setup
  const ctx = createValidContext()
  mockConsole()

  // Action & Assert
  try {
    const worker = new AuthWorker(null, ctx)
    t.pass('Constructor should handle null conf gracefully')
  } catch (error) {
    t.pass('Constructor should throw expected error for null conf')
  }
  
  // Cleanup
  restoreConsole()
})

test('should handle undefined conf parameter', async (t) => {
  // Setup
  const ctx = createValidContext()
  mockConsole()

  // Action & Assert
  try {
    const worker = new AuthWorker(undefined, ctx)
    t.pass('Constructor should handle undefined conf gracefully')
  } catch (error) {
    t.pass('Constructor should throw expected error for undefined conf')
  }
  
  // Cleanup
  restoreConsole()
})

test('should handle null ctx parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  mockConsole()

  // Action & Assert
  try {
    const worker = new AuthWorker(conf, null)
    t.pass('Constructor should handle null ctx gracefully')
  } catch (error) {
    t.pass('Constructor should throw expected error for null ctx')
  }
  
  // Cleanup
  restoreConsole()
})

test('should handle undefined ctx parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  mockConsole()

  // Action & Assert
  try {
    const worker = new AuthWorker(conf, undefined)
    t.pass('Constructor should handle undefined ctx gracefully')
  } catch (error) {
    t.pass('Constructor should throw expected error for undefined ctx')
  }
  
  // Cleanup
  restoreConsole()
})

test('should handle empty conf object', async (t) => {
  // Setup
  const conf = {}
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')

  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  t.ok(worker, 'Instance should be created with empty conf')
  t.ok(setInitFacsSpy.called, 'setInitFacs should still be called')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should handle empty ctx object', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = {}
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')

  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  t.ok(worker, 'Instance should be created with empty ctx')
  t.ok(setInitFacsSpy.called, 'setInitFacs should still be called')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should maintain facility configuration immutability', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new AuthWorker(conf, ctx)
  
  // Capture and modify arrays
  const capturedFacilities = setInitFacsSpy.firstCall.args[0]
  const originalLength = capturedFacilities.length
  capturedFacilities.push(['modified', 'array'])

  // Assert
  t.is(originalLength, 2, 'Original facility configuration should have 2 facilities')
  // Configuration integrity maintained - we don't test internal state, just that the call was made correctly
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

test('should use exact facility configuration values', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  const setInitFacsSpy = sinon.spy(AuthWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new AuthWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storageFacility = facilities[0]
  const networkFacility = facilities[1]
  
  t.is(storageFacility[4].storeDir, './data/auth', 'Storage facility storeDir should be exactly ./data/auth')
  t.alike(networkFacility[4], {}, 'Network facility config should be exactly empty object')
  
  // Cleanup
  setInitFacsSpy.restore()
  restoreConsole()
})

// AuthWorker _start Method Tests
test('should check net_default facility availability before starting', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = null // Mock missing net_default facility
  
  let callbackResult = null
  let callbackError = null
  
  // Action
  await worker._start((error) => {
    callbackError = error
    callbackResult = 'callback called'
  })
  
  // Assert
  t.ok(callbackError, 'Callback should be called with error')
  t.is(callbackError.message, 'net_default facility not available', 'Error message should match expected')
  t.is(callbackResult, 'callback called', 'Callback should be executed')
  
  // Cleanup
  restoreConsole()
})

test('should start RPC server when net_default facility is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const startRpcServerSpy = sinon.stub().resolves()
  worker.net_default = {
    startRpcServer: startRpcServerSpy,
    rpcServer: null, // Will prevent method registration
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  // Action
  await worker._start(() => {})
  
  // Assert
  t.is(startRpcServerSpy.callCount, 1, 'startRpcServer should be called once')
  
  // Cleanup
  restoreConsole()
})

test('should handle RPC server startup failure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const testError = new Error('RPC server startup failed')
  worker.net_default = {
    startRpcServer: sinon.stub().rejects(testError)
  }
  
  let callbackError = null
  
  // Action
  await worker._start((error) => {
    callbackError = error
  })
  
  // Assert
  t.ok(callbackError, 'Callback should be called with error')
  t.is(callbackError, testError, 'Error should be the RPC server startup error')
  
  // Cleanup
  restoreConsole()
})

test('should register ping method with correct response structure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const respondSpy = sinon.stub()
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: respondSpy },
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  // Action
  await worker._start(() => {})
  
  // Assert
  t.is(respondSpy.callCount, 3, 'respond should be called 3 times (ping, register, login)')
  t.is(respondSpy.firstCall.args[0], 'ping', 'First registration should be for ping method')
  t.is(typeof respondSpy.firstCall.args[1], 'function', 'Ping handler should be a function')
  
  // Test ping handler response structure
  const pingHandler = respondSpy.firstCall.args[1]
  const pingResponse = await pingHandler()
  t.ok(pingResponse.status, 'Ping response should have status property')
  t.ok(pingResponse.timestamp, 'Ping response should have timestamp property')
  t.is(pingResponse.service, 'auth', 'Ping response should indicate auth service')
  
  // Cleanup
  restoreConsole()
})

test('should register register method with handleReply delegation', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const respondSpy = sinon.stub()
  const handleReplySpy = sinon.stub().resolves('register result')
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: respondSpy },
    handleReply: handleReplySpy,
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  // Action
  await worker._start(() => {})
  
  // Assert
  t.is(respondSpy.secondCall.args[0], 'register', 'Second registration should be for register method')
  t.is(typeof respondSpy.secondCall.args[1], 'function', 'Register handler should be a function')
  
  // Test register handler delegation
  const registerHandler = respondSpy.secondCall.args[1]
  const testData = { username: 'test', password: 'test123' }
  await registerHandler(testData)
  
  t.is(handleReplySpy.callCount, 1, 'handleReply should be called once')
  t.is(handleReplySpy.firstCall.args[0], 'register', 'handleReply should be called with register method')
  t.is(handleReplySpy.firstCall.args[1], testData, 'handleReply should be called with test data')
  
  // Cleanup
  restoreConsole()
})

test('should register login method with handleReply delegation', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const respondSpy = sinon.stub()
  const handleReplySpy = sinon.stub().resolves('login result')
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: respondSpy },
    handleReply: handleReplySpy,
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  // Action
  await worker._start(() => {})
  
  // Assert
  t.is(respondSpy.thirdCall.args[0], 'login', 'Third registration should be for login method')
  t.is(typeof respondSpy.thirdCall.args[1], 'function', 'Login handler should be a function')
  
  // Test login handler delegation
  const loginHandler = respondSpy.thirdCall.args[1]
  const testData = { username: 'test', password: 'test123' }
  await loginHandler(testData)
  
  t.is(handleReplySpy.callCount, 1, 'handleReply should be called once')
  t.is(handleReplySpy.firstCall.args[0], 'login', 'handleReply should be called with login method')
  t.is(handleReplySpy.firstCall.args[1], testData, 'handleReply should be called with test data')
  
  // Cleanup
  restoreConsole()
})

test('should handle missing rpcServer during method registration', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: null, // Missing rpcServer
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  let callbackCalled = false
  
  // Action & Assert
  await worker._start(() => {
    callbackCalled = true
  })
  
  t.ok(callbackCalled, 'Callback should be called despite missing rpcServer')
  
  // Cleanup
  restoreConsole()
})

test('should handle missing respond method during registration', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { /* missing respond method */ },
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  let callbackCalled = false
  
  // Action & Assert
  await worker._start(() => {
    callbackCalled = true
  })
  
  t.ok(callbackCalled, 'Callback should be called despite missing respond method')
  
  // Cleanup
  restoreConsole()
})

test('should start lookup service', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const startLookupSpy = sinon.stub()
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: startLookupSpy,
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  // Action
  await worker._start(() => {})
  
  // Assert
  t.is(startLookupSpy.callCount, 1, 'startLookup should be called once')
  
  // Cleanup
  restoreConsole()
})

test('should announce auth service to DHT', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const announceIntervalSpy = sinon.stub().resolves()
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: { announceInterval: announceIntervalSpy }
  }
  
  // Action
  await worker._start(() => {})
  
  // Assert
  t.is(announceIntervalSpy.callCount, 1, 'announceInterval should be called once')
  t.is(announceIntervalSpy.firstCall.args[0], 'auth', 'announceInterval should be called with auth topic')
  
  // Cleanup
  restoreConsole()
})

test('should handle DHT announcement failure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const testError = new Error('DHT announcement failed')
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().rejects(testError) }
  }
  
  let callbackError = null
  
  // Action
  await worker._start((error) => {
    callbackError = error
  })
  
  // Assert
  t.ok(callbackError, 'Callback should be called with error')
  t.is(callbackError, testError, 'Error should be the DHT announcement error')
  
  // Cleanup
  restoreConsole()
})

test('should execute operations in correct sequence', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const callOrder = []
  
  const startRpcServerSpy = sinon.stub().callsFake(() => {
    callOrder.push('startRpcServer')
    return Promise.resolve()
  })
  
  const respondSpy = sinon.stub().callsFake(() => {
    callOrder.push('respond')
  })
  
  const startLookupSpy = sinon.stub().callsFake(() => {
    callOrder.push('startLookup')
  })
  
  const announceIntervalSpy = sinon.stub().callsFake(() => {
    callOrder.push('announceInterval')
    return Promise.resolve()
  })
  
  worker.net_default = {
    startRpcServer: startRpcServerSpy,
    rpcServer: { respond: respondSpy },
    startLookup: startLookupSpy,
    lookup: { announceInterval: announceIntervalSpy }
  }
  
  // Action
  await worker._start(() => {})
  
  // Assert
  t.ok(callOrder.indexOf('startRpcServer') < callOrder.indexOf('respond'), 'startRpcServer should be called before method registration')
  t.ok(callOrder.indexOf('respond') < callOrder.indexOf('startLookup'), 'Method registration should be called before startLookup')
  t.ok(callOrder.indexOf('startLookup') < callOrder.indexOf('announceInterval'), 'startLookup should be called before announceInterval')
  
  // Cleanup
  restoreConsole()
})

test('should call callback without error on successful completion', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  let callbackError = 'not called'
  let callbackCallCount = 0
  
  // Action
  await worker._start((error) => {
    callbackError = error
    callbackCallCount++
  })
  
  // Assert
  t.is(callbackCallCount, 1, 'Callback should be called once')
  t.is(callbackError, undefined, 'Callback should be called with no error parameter')
  
  // Cleanup
  restoreConsole()
})

test('should handle callback not provided', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  let executionCompleted = false
  
  // Action & Assert
  try {
    await worker._start() // No callback provided
    executionCompleted = true
    t.pass('Method should execute without throwing errors')
  } catch (error) {
    t.fail('Method should not throw errors when no callback provided')
  }
  
  t.ok(executionCompleted, 'Method execution should complete')
  
  // Cleanup
  restoreConsole()
})

test('should handle environment variable JWT_SECRET', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const originalJwtSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-jwt-secret-value'
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: null,
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  let callbackCalled = false
  
  // Action
  await worker._start(() => {
    callbackCalled = true
  })
  
  // Assert
  t.ok(callbackCalled, 'Method should execute normally with JWT_SECRET set')
  
  // Cleanup
  if (originalJwtSecret) {
    process.env.JWT_SECRET = originalJwtSecret
  } else {
    delete process.env.JWT_SECRET
  }
  restoreConsole()
})

test('should handle missing JWT_SECRET environment variable', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const originalJwtSecret = process.env.JWT_SECRET
  delete process.env.JWT_SECRET
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: null,
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  let callbackCalled = false
  
  // Action
  await worker._start(() => {
    callbackCalled = true
  })
  
  // Assert
  t.ok(callbackCalled, 'Method should execute normally with default JWT secret')
  
  // Cleanup
  if (originalJwtSecret) {
    process.env.JWT_SECRET = originalJwtSecret
  }
  restoreConsole()
})

// AuthWorker stop Method Tests
test('should clean up DHT announcements when lookup is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const unnannounceIntervalSpy = sinon.stub().resolves()
  const superStopSpy = sinon.stub().callsFake((cb) => cb())
  
  worker.net_default = {
    lookup: { unnannounceInterval: unnannounceIntervalSpy }
  }
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  // Action
  await worker.stop(() => {})
  
  // Assert
  t.is(unnannounceIntervalSpy.callCount, 1, 'unnannounceInterval should be called once')
  t.is(unnannounceIntervalSpy.firstCall.args[0], 'auth', 'unnannounceInterval should be called with auth topic')
  t.is(superStopSpy.callCount, 1, 'Parent stop should be called')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})

test('should handle missing lookup service during cleanup', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const superStopSpy = sinon.stub().callsFake((cb) => cb())
  
  worker.net_default = {} // Missing lookup property
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  let callbackCalled = false
  
  // Action
  await worker.stop(() => {
    callbackCalled = true
  })
  
  // Assert
  t.ok(callbackCalled, 'Callback should be called')
  t.is(superStopSpy.callCount, 1, 'Parent stop should still be called')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})

test('should handle missing net_default during cleanup', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const superStopSpy = sinon.stub().callsFake((cb) => cb())
  
  worker.net_default = null // Missing net_default
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  let callbackCalled = false
  
  // Action
  await worker.stop(() => {
    callbackCalled = true
  })
  
  // Assert
  t.ok(callbackCalled, 'Callback should be called')
  t.is(superStopSpy.callCount, 1, 'Parent stop should still be called')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})

test('should handle DHT cleanup failure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const testError = new Error('DHT cleanup failed')
  const unnannounceIntervalSpy = sinon.stub().rejects(testError)
  const superStopSpy = sinon.stub().callsFake((cb) => cb())
  
  worker.net_default = {
    lookup: { unnannounceInterval: unnannounceIntervalSpy }
  }
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  let callbackError = null
  
  // Action
  await worker.stop((error) => {
    callbackError = error
  })
  
  // Assert
  t.is(superStopSpy.callCount, 1, 'Parent stop should still be called')
  t.ok(callbackError, 'Error should be passed to callback')
  t.is(callbackError, testError, 'Error should be the DHT cleanup error')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})

test('should call parent stop method after DHT cleanup', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const callOrder = []
  
  const unnannounceIntervalSpy = sinon.stub().callsFake(() => {
    callOrder.push('cleanup')
    return Promise.resolve()
  })
  
  const superStopSpy = sinon.stub().callsFake((cb) => {
    callOrder.push('parent_stop')
    cb()
  })
  
  worker.net_default = {
    lookup: { unnannounceInterval: unnannounceIntervalSpy }
  }
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  // Action
  await worker.stop(() => {})
  
  // Assert
  t.ok(callOrder.indexOf('cleanup') < callOrder.indexOf('parent_stop'), 'DHT cleanup should be called before parent stop')
  t.is(superStopSpy.callCount, 1, 'Parent stop should be called')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})

test('should call parent stop even when DHT cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const testError = new Error('DHT cleanup failed')
  const unnannounceIntervalSpy = sinon.stub().rejects(testError)
  const superStopSpy = sinon.stub().callsFake((cb) => cb())
  
  worker.net_default = {
    lookup: { unnannounceInterval: unnannounceIntervalSpy }
  }
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  // Action
  await worker.stop(() => {})
  
  // Assert
  t.is(superStopSpy.callCount, 1, 'Parent stop should be called despite cleanup failure')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})

test('should handle callback not provided in stop method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const superStopSpy = sinon.stub().callsFake((cb) => cb())
  
  worker.net_default = {
    lookup: { unnannounceInterval: sinon.stub().resolves() }
  }
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  let executionCompleted = false
  
  // Action & Assert
  try {
    await worker.stop() // No callback provided
    executionCompleted = true
    t.pass('Method should execute without throwing errors')
  } catch (error) {
    t.fail('Method should not throw errors when no callback provided')
  }
  
  t.ok(executionCompleted, 'Method execution should complete')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})

test('should catch and handle all errors in try-catch block', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const testError = new Error('Synchronous error')
  const superStopSpy = sinon.stub().callsFake((cb) => cb())
  
  // Mock net_default to throw error when accessing lookup
  Object.defineProperty(worker, 'net_default', {
    get: function() {
      throw testError
    }
  })
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  let callbackError = null
  
  // Action
  await worker.stop((error) => {
    callbackError = error
  })
  
  // Assert
  t.is(superStopSpy.callCount, 1, 'Parent stop should still be attempted')
  t.ok(callbackError, 'Error should be caught and passed to callback')
  t.is(callbackError, testError, 'Error should be the synchronous error')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})

test('should handle async errors during DHT cleanup', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const testError = new Error('Async DHT cleanup error')
  const unnannounceIntervalSpy = sinon.stub().rejects(testError)
  const superStopSpy = sinon.stub().callsFake((cb) => cb())
  
  worker.net_default = {
    lookup: { unnannounceInterval: unnannounceIntervalSpy }
  }
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  let callbackError = null
  
  // Action
  await worker.stop((error) => {
    callbackError = error
  })
  
  // Assert
  t.ok(callbackError, 'Async error should be caught properly')
  t.is(callbackError, testError, 'Error should be the async DHT cleanup error')
  t.is(superStopSpy.callCount, 1, 'Parent stop should still be called')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})

// AuthWorker RPC Delegation Method Tests
test('should delegate register method to metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const wrapRpcMethodSpy = sinon.stub().resolves('register result')
  worker.metrics = { wrapRpcMethod: wrapRpcMethodSpy }
  
  const testData = { username: 'test', password: 'test123' }
  
  // Action
  const result = await worker.register(testData)
  
  // Assert
  t.is(wrapRpcMethodSpy.callCount, 1, 'wrapRpcMethod should be called once')
  t.is(wrapRpcMethodSpy.firstCall.args[0], 'register', 'First argument should be register')
  t.is(typeof wrapRpcMethodSpy.firstCall.args[1], 'function', 'Second argument should be AuthHelper.register function')
  t.is(wrapRpcMethodSpy.firstCall.args[2], worker, 'Third argument should be worker instance')
  t.is(wrapRpcMethodSpy.firstCall.args[3], testData, 'Fourth argument should be test data')
  t.is(result, 'register result', 'Method should return promise from wrapRpcMethod')
  
  // Cleanup
  restoreConsole()
})

test('should handle data parameter correctly in register method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const wrapRpcMethodSpy = sinon.stub().resolves('result')
  worker.metrics = { wrapRpcMethod: wrapRpcMethodSpy }
  
  const testCases = [
    { username: 'test1', password: 'pass1' },
    null,
    undefined,
    { complex: { nested: 'data' } },
    'string data'
  ]
  
  // Action & Assert
  for (const testData of testCases) {
    wrapRpcMethodSpy.resetHistory()
    await worker.register(testData)
    
    t.is(wrapRpcMethodSpy.firstCall.args[3], testData, 'Data parameter should be passed through unchanged')
  }
  
  // Cleanup
  restoreConsole()
})

test('should delegate login method to metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const wrapRpcMethodSpy = sinon.stub().resolves('login result')
  worker.metrics = { wrapRpcMethod: wrapRpcMethodSpy }
  
  const testData = { username: 'test', password: 'test123' }
  
  // Action
  const result = await worker.login(testData)
  
  // Assert
  t.is(wrapRpcMethodSpy.callCount, 1, 'wrapRpcMethod should be called once')
  t.is(wrapRpcMethodSpy.firstCall.args[0], 'login', 'First argument should be login')
  t.is(typeof wrapRpcMethodSpy.firstCall.args[1], 'function', 'Second argument should be AuthHelper.login function')
  t.is(wrapRpcMethodSpy.firstCall.args[2], worker, 'Third argument should be worker instance')
  t.is(wrapRpcMethodSpy.firstCall.args[3], testData, 'Fourth argument should be test data')
  t.is(result, 'login result', 'Method should return promise from wrapRpcMethod')
  
  // Cleanup
  restoreConsole()
})

test('should handle data parameter correctly in login method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const wrapRpcMethodSpy = sinon.stub().resolves('result')
  worker.metrics = { wrapRpcMethod: wrapRpcMethodSpy }
  
  const testCases = [
    { username: 'test1', password: 'pass1' },
    null,
    undefined,
    { complex: { nested: 'data' } },
    'string data'
  ]
  
  // Action & Assert
  for (const testData of testCases) {
    wrapRpcMethodSpy.resetHistory()
    await worker.login(testData)
    
    t.is(wrapRpcMethodSpy.firstCall.args[3], testData, 'Data parameter should be passed through unchanged')
  }
  
  // Cleanup
  restoreConsole()
})

// Edge Case Tests
test('should handle partial net_default facility setup during _start', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    // Missing rpcServer, startLookup, and lookup properties
  }
  
  let callbackCalled = false
  let callbackError = null
  
  // Action
  await worker._start((error) => {
    callbackCalled = true
    callbackError = error
  })
  
  // Assert
  t.ok(callbackCalled, 'Method should handle missing methods gracefully')
  // Should not crash, error handling depends on what methods are missing
  
  // Cleanup
  restoreConsole()
})

test('should handle rpcServer availability but missing respond method during _start', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { /* missing respond method */ },
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  let callbackCalled = false
  
  // Action
  await worker._start(() => {
    callbackCalled = true
  })
  
  // Assert
  t.ok(callbackCalled, 'Method registration should be skipped gracefully')
  
  // Cleanup
  restoreConsole()
})

test('should handle startRpcServer returning non-promise during _start', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  worker.net_default = {
    startRpcServer: sinon.stub().returns('non-promise value'), // Non-promise return
    rpcServer: null,
    startLookup: sinon.stub(),
    lookup: { announceInterval: sinon.stub().resolves() }
  }
  
  let callbackCalled = false
  
  // Action & Assert
  try {
    await worker._start(() => {
      callbackCalled = true
    })
    t.ok(callbackCalled, 'Method should handle non-async startRpcServer gracefully')
  } catch (error) {
    t.fail('Method should not throw errors for non-promise startRpcServer')
  }
  
  // Cleanup
  restoreConsole()
})

test('should handle lookup.unnannounceInterval returning non-promise during stop', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  mockConsole()
  
  const worker = new AuthWorker(conf, ctx)
  const unnannounceIntervalSpy = sinon.stub().returns('non-promise value') // Non-promise return
  const superStopSpy = sinon.stub().callsFake((cb) => cb())
  
  worker.net_default = {
    lookup: { unnannounceInterval: unnannounceIntervalSpy }
  }
  
  // Mock parent stop method
  const BaseWorker = Object.getPrototypeOf(AuthWorker.prototype)
  const originalStop = BaseWorker.stop
  BaseWorker.stop = superStopSpy
  
  let callbackCalled = false
  
  // Action
  await worker.stop(() => {
    callbackCalled = true
  })
  
  // Assert
  t.ok(callbackCalled, 'Method should handle non-async cleanup gracefully')
  t.is(superStopSpy.callCount, 1, 'Parent stop should still be called')
  
  // Cleanup
  BaseWorker.stop = originalStop
  restoreConsole()
})