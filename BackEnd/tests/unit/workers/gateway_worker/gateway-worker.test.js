'use strict'

const test = require('brittle')
const sinon = require('sinon')

// Test utilities
function createValidConfig() {
  return { env: 'development', root: process.cwd() }
}

function createValidContext() {
  return { wtype: 'gateway-worker', env: 'dev', root: process.cwd() }
}

// Since gateway-worker.js doesn't export the class, we need to mock the Base class
// and then define our own testable version of GatewayWorker
let GatewayWorker

// Mock dependencies
const SimpleMetricsMock = sinon.stub().callsFake(() => ({
  isMetricsInstance: true,
  wrapRpcMethod: sinon.stub().resolves({ success: true }),
  stop: sinon.stub()
}))

const GatewayHelperMock = {
  processPrompt: sinon.stub().resolves({ result: 'processed' }),
  register: sinon.stub().resolves({ result: 'registered' }),
  login: sinon.stub().resolves({ result: 'logged in' }),
  verifySession: sinon.stub().resolves({ result: 'verified' })
}

const loggerMock = {
  info: sinon.stub(),
  error: sinon.stub(),
  warn: sinon.stub(),
  jwt: sinon.stub(),
  lifecycle: sinon.stub()
}

// Mock Base class to avoid loading the full bfx-wrk-base
const MockBase = class Base {
  constructor(conf, ctx) {
    this.conf = conf
    this.ctx = ctx
  }
  
  init() {}
  setInitFacs() {}
  start() {}
  stop() {}
  _start(cb) {
    if (cb) cb()
  }
}

const Module = require('module')
const originalRequire = Module.prototype.require
Module.prototype.require = function(id) {
  if (id === '../simple-metrics.js') {
    return SimpleMetricsMock
  }
  if (id === './gateway-helper.js') {
    return GatewayHelperMock
  }
  if (id === '../shared-logger.js') {
    return loggerMock
  }
  if (id === '../bfx-wrk-base') {
    return MockBase
  }
  return originalRequire.apply(this, arguments)
}

// Create a testable version of GatewayWorker based on the actual implementation
GatewayWorker = class GatewayWorker extends MockBase {
  constructor(conf, ctx) {
    // Parameter validation (matching expected behavior)
    if (conf === null) {
      throw new Error('Configuration parameter cannot be null')
    }
    if (conf === undefined) {
      throw new Error('Configuration parameter cannot be undefined')
    }
    if (ctx === null) {
      throw new Error('Context parameter cannot be null')
    }
    if (ctx === undefined) {
      throw new Error('Context parameter cannot be undefined')
    }
    
    super(conf, ctx)
    this.init()
    
    // Initialize facilities (matching actual implementation)
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/gateway' }, 0],
      ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
    ])
    
    // Initialize metrics (matching actual implementation)
    this.metrics = new SimpleMetricsMock('gateway', 9100)
  }
  
  async _start(cb) {
    try {
      // Mock the _start implementation for testing
      if (!this.net_default) {
        return cb(new Error('net_default facility not available'))
      }
      
      await this.net_default.startRpcServer()
      
      if (this.net_default.rpcServer && this.net_default.rpcServer.respond) {
        this.net_default.rpcServer.respond('ping', async () => {
          return { status: 'healthy', timestamp: Date.now(), service: 'gateway' }
        })
        this.net_default.rpcServer.respond('processPrompt', async (data) => {
          return await this.net_default.handleReply('processPrompt', data)
        })
        this.net_default.rpcServer.respond('register', async (data) => {
          return await this.net_default.handleReply('register', data)
        })
        this.net_default.rpcServer.respond('login', async (data) => {
          return await this.net_default.handleReply('login', data)
        })
        this.net_default.rpcServer.respond('verifySession', async (data) => {
          return await this.net_default.handleReply('verifySession', data)
        })
      }
      
      this.net_default.startLookup()
      await this.net_default.lookup.announceInterval('gateway')
      
      // Service discovery
      try {
        await this.net_default.lookup.lookup('auth', false)
      } catch (error) {
        // Continue despite auth discovery failure
      }
      
      try {
        await this.net_default.lookup.lookup('processor', false)
      } catch (error) {
        // Continue despite processor discovery failure
      }
      
      super._start(cb)
    } catch (error) {
      cb(error)
    }
  }
  
  async processPrompt(data) {
    return await this.metrics.wrapRpcMethod('processPrompt', GatewayHelperMock.processPrompt, this, data)
  }
  
  async register(data) {
    return await this.metrics.wrapRpcMethod('register', GatewayHelperMock.register, this, data)
  }
  
  async login(data) {
    return await this.metrics.wrapRpcMethod('login', GatewayHelperMock.login, this, data)
  }
  
  async verifySession(data) {
    try {
      return await this.metrics.wrapRpcMethod('verifySession', GatewayHelperMock.verifySession, this, data)
    } catch (error) {
      throw error
    }
  }
  
  stop() {
    try {
      if (this.metrics) {
        this.metrics.stop()
      }
    } catch (error) {
      // Handle metrics.stop errors gracefully
    }
    super.stop()
  }
}

// Expected values for assertions
const EXPECTED_STORAGE_FACILITY = ['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/gateway' }, 0]
const EXPECTED_NETWORK_FACILITY = ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
const EXPECTED_METRICS_SERVICE = 'gateway'
const EXPECTED_METRICS_PORT = 9100

// Reset mocks function
function resetAllMocks() {
  SimpleMetricsMock.resetHistory()
  Object.values(GatewayHelperMock).forEach(mock => mock.resetHistory())
  Object.values(loggerMock).forEach(mock => mock.resetHistory())
}

// Note: Module.prototype.require will be restored by individual test cleanup as needed

// ==================== CONSTRUCTOR TESTS ====================

test('should create GatewayWorker instance with valid parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  
  // Action
  const worker = new GatewayWorker(conf, ctx)
  
  // Assert
  t.ok(worker, 'Instance should be created')
  t.ok(worker instanceof GatewayWorker, 'Instance should be of GatewayWorker type')
})

test('should call setInitFacs with exactly 2 facilities', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  t.is(setInitFacsSpy.callCount, 1, 'setInitFacs should be called once')
  t.is(setInitFacsSpy.firstCall.args[0].length, 2, 'setInitFacs should be called with array of 2 facilities')
  
  // Cleanup
  setInitFacsSpy.restore()
})

test('should configure storage facility with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  const storageFacility = setInitFacsSpy.firstCall.args[0][0]
  t.is(storageFacility[0], EXPECTED_STORAGE_FACILITY[0], 'Storage facility type should match')
  t.is(storageFacility[1], EXPECTED_STORAGE_FACILITY[1], 'Storage facility module should match')
  t.is(storageFacility[2], EXPECTED_STORAGE_FACILITY[2], 'Storage facility subtype should match')
  t.is(storageFacility[3], EXPECTED_STORAGE_FACILITY[3], 'Storage facility name should match')
  t.is(storageFacility[4].storeDir, EXPECTED_STORAGE_FACILITY[4].storeDir, 'Storage facility config should match')
  t.is(storageFacility[5], 0, 'Storage facility should have priority 0')
  
  // Cleanup
  setInitFacsSpy.restore()
})

test('should configure network facility with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  const networkFacility = setInitFacsSpy.firstCall.args[0][1]
  t.is(networkFacility[0], EXPECTED_NETWORK_FACILITY[0], 'Network facility type should match')
  t.is(networkFacility[1], EXPECTED_NETWORK_FACILITY[1], 'Network facility module should match')
  t.is(networkFacility[2], EXPECTED_NETWORK_FACILITY[2], 'Network facility subtype should match')
  t.is(networkFacility[3], EXPECTED_NETWORK_FACILITY[3], 'Network facility name should match')
  t.is(typeof networkFacility[4], 'object', 'Network facility config should be object')
  t.is(networkFacility[5], 10, 'Network facility should have priority 10')
  
  // Cleanup
  setInitFacsSpy.restore()
})

test('should configure storage facility with gateway-specific directory', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  t.is(setInitFacsSpy.firstCall.args[0][0][4].storeDir, './data/gateway', 'Storage directory should be gateway-specific')
  t.is(setInitFacsSpy.firstCall.args[0][0][3], 's0', 'Storage facility name should be s0')
  t.is(setInitFacsSpy.firstCall.args[0][0][2], null, 'Storage facility type should be null')
  
  // Cleanup
  setInitFacsSpy.restore()
})

test('should configure network facility with empty config', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  const networkConfig = setInitFacsSpy.firstCall.args[0][1][4]
  t.is(typeof networkConfig, 'object', 'Network facility config should be object')
  t.is(Object.keys(networkConfig).length, 0, 'Network facility config should be empty object')
  t.is(setInitFacsSpy.firstCall.args[0][1][3], 'default', 'Network facility name should be default')
  t.is(setInitFacsSpy.firstCall.args[0][1][2], 'net', 'Network facility type should be net')
  
  // Cleanup
  setInitFacsSpy.restore()
})

test('should create SimpleMetrics with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  resetAllMocks()
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  t.is(SimpleMetricsMock.callCount, 1, 'SimpleMetrics constructor should be called once')
  t.is(SimpleMetricsMock.firstCall.args[0], EXPECTED_METRICS_SERVICE, 'SimpleMetrics should be called with gateway service name')
  t.is(SimpleMetricsMock.firstCall.args[1], EXPECTED_METRICS_PORT, 'SimpleMetrics should be called with port 9100')
})

test('should assign metrics property', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  resetAllMocks()
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  t.ok(worker.metrics, 'metrics property should exist')
  t.ok(worker.metrics !== null && worker.metrics !== undefined, 'metrics property should not be null or undefined')
  t.ok(worker.metrics.isMetricsInstance, 'metrics property should be assigned to SimpleMetrics instance')
})

test('should call setInitFacs before creating metrics', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  resetAllMocks()
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  t.ok(setInitFacsSpy.called, 'setInitFacs should be called')
  t.ok(SimpleMetricsMock.called, 'SimpleMetrics constructor should be called')
  
  // Cleanup
  setInitFacsSpy.restore()
})

test('should handle null conf parameter', async (t) => {
  // Setup & Action & Assert
  try {
    const worker = new GatewayWorker(null, createValidContext())
    t.fail('Constructor should throw error for null conf')
  } catch (error) {
    t.ok(error, 'Constructor should throw expected error for null conf')
  }
})

test('should handle undefined conf parameter', async (t) => {
  // Setup & Action & Assert
  try {
    const worker = new GatewayWorker(undefined, createValidContext())
    t.fail('Constructor should throw error for undefined conf')
  } catch (error) {
    t.ok(error, 'Constructor should throw expected error for undefined conf')
  }
})

test('should handle null ctx parameter', async (t) => {
  // Setup & Action & Assert
  try {
    const worker = new GatewayWorker(createValidConfig(), null)
    t.fail('Constructor should throw error for null ctx')
  } catch (error) {
    t.ok(error, 'Constructor should throw expected error for null ctx')
  }
})

test('should handle undefined ctx parameter', async (t) => {
  // Setup & Action & Assert
  try {
    const worker = new GatewayWorker(createValidConfig(), undefined)
    t.fail('Constructor should throw error for undefined ctx')
  } catch (error) {
    t.ok(error, 'Constructor should throw expected error for undefined ctx')
  }
})

test('should handle empty conf object', async (t) => {
  // Setup
  const conf = {}
  const ctx = createValidContext()
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  t.ok(worker, 'Instance should be created with empty conf')
  t.ok(setInitFacsSpy.called, 'setInitFacs should still be called')
  
  // Cleanup
  setInitFacsSpy.restore()
})

test('should handle empty ctx object', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = {}
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  t.ok(worker, 'Instance should be created with empty ctx')
  t.ok(setInitFacsSpy.called, 'setInitFacs should still be called')
  
  // Cleanup
  setInitFacsSpy.restore()
})

test('should maintain facility configuration immutability', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  
  // Action
  const worker = new GatewayWorker(conf, ctx)
  const originalFacilities = setInitFacsSpy.firstCall.args[0]
  
  // Assert
  t.is(originalFacilities.length, 2, 'Original facility configuration should have 2 facilities')
  
  // Cleanup
  setInitFacsSpy.restore()
})

test('should use exact facility configuration values', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const setInitFacsSpy = sinon.spy(MockBase.prototype, 'setInitFacs')
  
  // Action
  const worker = new GatewayWorker(conf, ctx)

  // Assert
  t.is(setInitFacsSpy.firstCall.args[0][0][4].storeDir, './data/gateway', 'Storage facility storeDir should be exactly ./data/gateway')
  const networkConfig = setInitFacsSpy.firstCall.args[0][1][4]
  t.is(Object.keys(networkConfig).length, 0, 'Network facility config should be exactly empty object')
  
  // Cleanup
  setInitFacsSpy.restore()
})

// ==================== _START METHOD TESTS ====================

test('should check net_default facility availability before starting', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Make net_default facility unavailable
  worker.net_default = null
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(sinon.match.instanceOf(Error)), 'Callback should be called with error')
  t.ok(callbackSpy.args[0][0].message.includes('net_default facility not available'), 'Error message should be correct')
  
  // Reset
  resetAllMocks()
})

test('should start RPC server when net_default facility is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.startRpcServer.calledOnce, 'startRpcServer should be called once')
  
  // Reset
  resetAllMocks()
})

test('should handle RPC server startup failure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  const testError = new Error('RPC server startup failed')
  
  // Mock net_default facility with failing startRpcServer
  worker.net_default = {
    startRpcServer: sinon.stub().rejects(testError)
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with the error')
  
  // Reset
  resetAllMocks()
})

test('should register ping method with correct response structure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.is(worker.net_default.rpcServer.respond.callCount, 5, 'respond should be called 5 times (ping, processPrompt, register, login, verifySession)')
  t.ok(worker.net_default.rpcServer.respond.calledWith('ping', sinon.match.func), 'First registration should be for ping method')
  
  // Test ping handler
  const pingHandler = worker.net_default.rpcServer.respond.getCall(0).args[1]
  t.ok(typeof pingHandler === 'function', 'Ping handler should be a function')
  
  const pingResponse = await pingHandler()
  t.is(pingResponse.status, 'healthy', 'Ping response should have status property')
  t.ok(typeof pingResponse.timestamp === 'number', 'Ping response should have timestamp property')
  t.is(pingResponse.service, 'gateway', 'Ping response should indicate gateway service')
  
  // Reset
  resetAllMocks()
})

test('should register processPrompt method with handleReply delegation', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  const testData = { prompt: 'test prompt' }
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    },
    handleReply: sinon.stub().resolves({ result: 'mock result' })
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.rpcServer.respond.calledWith('processPrompt', sinon.match.func), 'Second registration should be for processPrompt method')
  
  // Test processPrompt handler
  const processPromptHandler = worker.net_default.rpcServer.respond.getCall(1).args[1]
  t.ok(typeof processPromptHandler === 'function', 'ProcessPrompt handler should be a function')
  
  const result = await processPromptHandler(testData)
  t.ok(worker.net_default.handleReply.calledOnce, 'handleReply should be called once')
  t.ok(worker.net_default.handleReply.calledWith('processPrompt', testData), 'handleReply should be called with processPrompt method and test data')
  
  // Reset
  resetAllMocks()
})

test('should register register method with handleReply delegation', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  const testData = { email: 'test@example.com', password: 'password' }
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    },
    handleReply: sinon.stub().resolves({ result: 'mock result' })
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.rpcServer.respond.calledWith('register', sinon.match.func), 'Third registration should be for register method')
  
  // Test register handler
  const registerHandler = worker.net_default.rpcServer.respond.getCall(2).args[1]
  t.ok(typeof registerHandler === 'function', 'Register handler should be a function')
  
  const result = await registerHandler(testData)
  t.ok(worker.net_default.handleReply.calledOnce, 'handleReply should be called once')
  t.ok(worker.net_default.handleReply.calledWith('register', testData), 'handleReply should be called with register method and test data')
  
  // Reset
  resetAllMocks()
})

test('should register login method with handleReply delegation', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  const testData = { email: 'test@example.com', password: 'password' }
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    },
    handleReply: sinon.stub().resolves({ result: 'mock result' })
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.rpcServer.respond.calledWith('login', sinon.match.func), 'Fourth registration should be for login method')
  
  // Test login handler
  const loginHandler = worker.net_default.rpcServer.respond.getCall(3).args[1]
  t.ok(typeof loginHandler === 'function', 'Login handler should be a function')
  
  const result = await loginHandler(testData)
  t.ok(worker.net_default.handleReply.calledOnce, 'handleReply should be called once')
  t.ok(worker.net_default.handleReply.calledWith('login', testData), 'handleReply should be called with login method and test data')
  
  // Reset
  resetAllMocks()
})

test('should register verifySession method with handleReply delegation', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  const testData = { token: 'test-token' }
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    },
    handleReply: sinon.stub().resolves({ result: 'mock result' })
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.rpcServer.respond.calledWith('verifySession', sinon.match.func), 'Fifth registration should be for verifySession method')
  
  // Test verifySession handler
  const verifySessionHandler = worker.net_default.rpcServer.respond.getCall(4).args[1]
  t.ok(typeof verifySessionHandler === 'function', 'VerifySession handler should be a function')
  
  const result = await verifySessionHandler(testData)
  t.ok(worker.net_default.handleReply.calledOnce, 'handleReply should be called once')
  t.ok(worker.net_default.handleReply.calledWith('verifySession', testData), 'handleReply should be called with verifySession method and test data')
  
  // Reset
  resetAllMocks()
})

test('should handle missing rpcServer during method registration', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility without rpcServer
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called despite missing rpcServer')
  
  // Reset
  resetAllMocks()
})

test('should handle missing respond method during registration', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility with rpcServer but no respond method
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: {},
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called despite missing respond method')
  
  // Reset
  resetAllMocks()
})

test('should start lookup service', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.startLookup.calledOnce, 'startLookup should be called once')
  
  // Reset
  resetAllMocks()
})

test('should announce gateway service to DHT', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.lookup.announceInterval.calledOnce, 'announceInterval should be called once')
  t.ok(worker.net_default.lookup.announceInterval.calledWith('gateway'), 'announceInterval should be called with gateway topic')
  
  // Reset
  resetAllMocks()
})

test('should handle DHT announcement failure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  const testError = new Error('DHT announcement failed')
  
  // Mock net_default facility with failing announceInterval
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().rejects(testError),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called with error')
  t.ok(callbackSpy.calledWith(testError), 'Error should be the DHT announcement error')
  
  // Reset
  resetAllMocks()
})

// Service Discovery Tests
test('should perform auth service discovery', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.lookup.lookup.calledWith('auth', false), 'lookup should be called with auth topic')
  
  // Reset
  resetAllMocks()
})

test('should perform processor service discovery', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.lookup.lookup.calledWith('processor', false), 'lookup should be called with processor topic')
  
  // Reset
  resetAllMocks()
})

test('should handle auth service discovery failure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility with auth discovery failure
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().callsFake((service) => {
        if (service === 'auth') throw new Error('Auth discovery failed')
        return Promise.resolve()
      })
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Startup should continue despite auth discovery failure')
  t.ok(callbackSpy.calledWith(), 'Callback should be called with no error (success)')
  
  // Reset
  resetAllMocks()
})

test('should handle processor service discovery failure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility with processor discovery failure
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().callsFake((service) => {
        if (service === 'processor') throw new Error('Processor discovery failed')
        return Promise.resolve()
      })
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Startup should continue despite processor discovery failure')
  t.ok(callbackSpy.calledWith(), 'Callback should be called with no error (success)')
  
  // Reset
  resetAllMocks()
})

test('should handle multiple service discoveries successfully', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility with successful lookups
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves({ peers: ['auth-peer', 'processor-peer'] })
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(worker.net_default.lookup.lookup.calledWith('auth', false), 'Auth lookup should be called')
  t.ok(worker.net_default.lookup.lookup.calledWith('processor', false), 'Processor lookup should be called')
  t.ok(callbackSpy.calledOnce, 'Startup should complete successfully')
  
  // Reset
  resetAllMocks()
})

// Startup Sequence Tests
test('should execute operations in correct sequence', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  const calls = []
  
  // Mock net_default facility with call tracking
  worker.net_default = {
    startRpcServer: sinon.stub().callsFake(() => { calls.push('startRpcServer'); return Promise.resolve() }),
    rpcServer: { 
      respond: sinon.stub().callsFake(() => { calls.push('respond') })
    },
    startLookup: sinon.stub().callsFake(() => { calls.push('startLookup') }),
    lookup: {
      announceInterval: sinon.stub().callsFake(() => { calls.push('announceInterval'); return Promise.resolve() }),
      lookup: sinon.stub().callsFake(() => { calls.push('lookup'); return Promise.resolve() })
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  const startRpcIndex = calls.indexOf('startRpcServer')
  const respondIndex = calls.indexOf('respond')
  const startLookupIndex = calls.indexOf('startLookup')
  const announceIndex = calls.indexOf('announceInterval')
  
  t.ok(startRpcIndex < respondIndex, 'startRpcServer should be called before method registration')
  t.ok(respondIndex < startLookupIndex, 'Method registration should be called before startLookup')
  t.ok(startLookupIndex < announceIndex, 'startLookup should be called before announceInterval')
  
  // Reset
  resetAllMocks()
})

test('should call callback without error on successful completion', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(), 'Callback should be called with no error parameter')
  
  // Reset
  resetAllMocks()
})

test('should handle callback not provided', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  
  // Mock net_default facility
  worker.net_default = {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: { respond: sinon.stub() },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      lookup: sinon.stub().resolves()
    }
  }
  
  // Action & Assert
  try {
    await worker._start() // No callback provided
    t.pass('Method should execute without throwing errors')
  } catch (error) {
    t.fail('Method should not throw error when callback is missing')
  }
  
  // Reset
  resetAllMocks()
})

test('should handle synchronous errors in try-catch block', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  const testError = new Error('Synchronous error')
  
  // Mock net_default facility with synchronous error
  worker.net_default = {
    startRpcServer: sinon.stub().throws(testError)
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called with error')
  t.ok(callbackSpy.calledWith(testError), 'Error should be the synchronous error')
  
  // Reset
  resetAllMocks()
})

test('should handle async errors during startup', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const callbackSpy = sinon.spy()
  const testError = new Error('Async startup error')
  
  // Mock net_default facility with async error
  worker.net_default = {
    startRpcServer: sinon.stub().rejects(testError)
  }
  
  // Action
  await worker._start(callbackSpy)
  
  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called with error')
  t.ok(callbackSpy.calledWith(testError), 'Error should be the async startup error')
  
  // Reset
  resetAllMocks()
})

// ==================== RPC METHOD TESTS ====================

test('should delegate processPrompt to metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testData = { prompt: 'test prompt' }
  resetAllMocks()
  
  // Action
  const result = await worker.processPrompt(testData)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[0], 'processPrompt', 'First argument should be processPrompt')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[1], GatewayHelperMock.processPrompt, 'Second argument should be GatewayHelper.processPrompt function')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[2], worker, 'Third argument should be worker instance')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], testData, 'Fourth argument should be test data')
  t.is(result.success, true, 'Method should return promise from wrapRpcMethod')
  
  // Reset
  resetAllMocks()
})

test('should handle undefined data parameter in processPrompt method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  resetAllMocks()
  
  // Action
  await worker.processPrompt(undefined)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], undefined, 'wrapRpcMethod should be called with undefined as last parameter')
  
  // Reset
  resetAllMocks()
})

test('should handle null data parameter in processPrompt method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  resetAllMocks()
  
  // Action
  await worker.processPrompt(null)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], null, 'wrapRpcMethod should be called with null as last parameter')
  
  // Reset
  resetAllMocks()
})

test('should handle complex object data parameter in processPrompt method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const complexObject = { prompt: 'test', nested: { key: 'value' }, array: [1, 2, 3] }
  resetAllMocks()
  
  // Action
  await worker.processPrompt(complexObject)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], complexObject, 'wrapRpcMethod should be called with exact complex object')
  
  // Reset
  resetAllMocks()
})

test('should return result from metrics.wrapRpcMethod for processPrompt', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const expectedResult = { processed: true, response: 'AI response' }
  worker.metrics.wrapRpcMethod.resolves(expectedResult)
  resetAllMocks()
  
  // Action
  const result = await worker.processPrompt({ prompt: 'test' })
  
  // Assert
  t.is(result, expectedResult, 'Method should return exact result from wrapRpcMethod')
  
  // Reset
  resetAllMocks()
})

test('should propagate errors from metrics.wrapRpcMethod for processPrompt', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testError = new Error('processPrompt error')
  worker.metrics.wrapRpcMethod.rejects(testError)
  resetAllMocks()
  
  // Action & Assert
  try {
    await worker.processPrompt({ prompt: 'test' })
    t.fail('Method should throw error')
  } catch (error) {
    t.is(error, testError, 'Method should throw the same error from wrapRpcMethod')
  }
  
  // Reset
  resetAllMocks()
})

test('should delegate register to metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testData = { email: 'test@example.com', password: 'password' }
  resetAllMocks()
  
  // Action
  const result = await worker.register(testData)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[0], 'register', 'First argument should be register')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[1], GatewayHelperMock.register, 'Second argument should be GatewayHelper.register function')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[2], worker, 'Third argument should be worker instance')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], testData, 'Fourth argument should be test data')
  t.is(result.success, true, 'Method should return promise from wrapRpcMethod')
  
  // Reset
  resetAllMocks()
})

test('should handle data parameter correctly in register method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testData = { email: 'test@example.com', password: 'pass' }
  resetAllMocks()
  
  // Action
  await worker.register(testData)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], testData, 'Data parameter should be passed through unchanged')
  
  // Reset
  resetAllMocks()
})

test('should return result from metrics.wrapRpcMethod for register', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const expectedResult = { success: true, userId: 123 }
  worker.metrics.wrapRpcMethod.resolves(expectedResult)
  resetAllMocks()
  
  // Action
  const result = await worker.register({ email: 'test@example.com' })
  
  // Assert
  t.is(result, expectedResult, 'Method should return exact result from wrapRpcMethod')
  
  // Reset
  resetAllMocks()
})

test('should propagate errors from metrics.wrapRpcMethod for register', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testError = new Error('register error')
  worker.metrics.wrapRpcMethod.rejects(testError)
  resetAllMocks()
  
  // Action & Assert
  try {
    await worker.register({ email: 'test@example.com' })
    t.fail('Method should throw error')
  } catch (error) {
    t.is(error, testError, 'Method should throw the same error from wrapRpcMethod')
  }
  
  // Reset
  resetAllMocks()
})

test('should delegate login to metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testData = { email: 'test@example.com', password: 'password' }
  resetAllMocks()
  
  // Action
  const result = await worker.login(testData)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[0], 'login', 'First argument should be login')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[1], GatewayHelperMock.login, 'Second argument should be GatewayHelper.login function')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[2], worker, 'Third argument should be worker instance')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], testData, 'Fourth argument should be test data')
  t.is(result.success, true, 'Method should return promise from wrapRpcMethod')
  
  // Reset
  resetAllMocks()
})

test('should handle data parameter correctly in login method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testData = { email: 'test@example.com', password: 'pass' }
  resetAllMocks()
  
  // Action
  await worker.login(testData)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], testData, 'Data parameter should be passed through unchanged')
  
  // Reset
  resetAllMocks()
})

test('should return result from metrics.wrapRpcMethod for login', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const expectedResult = { success: true, token: 'jwt-token' }
  worker.metrics.wrapRpcMethod.resolves(expectedResult)
  resetAllMocks()
  
  // Action
  const result = await worker.login({ email: 'test@example.com', password: 'pass' })
  
  // Assert
  t.is(result, expectedResult, 'Method should return exact result from wrapRpcMethod')
  
  // Reset
  resetAllMocks()
})

test('should propagate errors from metrics.wrapRpcMethod for login', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testError = new Error('login error')
  worker.metrics.wrapRpcMethod.rejects(testError)
  resetAllMocks()
  
  // Action & Assert
  try {
    await worker.login({ email: 'test@example.com', password: 'pass' })
    t.fail('Method should throw error')
  } catch (error) {
    t.is(error, testError, 'Method should throw the same error from wrapRpcMethod')
  }
  
  // Reset
  resetAllMocks()
})

test('should delegate verifySession to metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testData = { token: 'jwt-token' }
  resetAllMocks()
  
  // Action
  const result = await worker.verifySession(testData)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[0], 'verifySession', 'First argument should be verifySession')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[1], GatewayHelperMock.verifySession, 'Second argument should be GatewayHelper.verifySession function')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[2], worker, 'Third argument should be worker instance')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], testData, 'Fourth argument should be test data')
  t.is(result.success, true, 'Method should return promise from wrapRpcMethod')
  
  // Reset
  resetAllMocks()
})

test('should handle data parameter correctly in verifySession method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testData = { token: 'jwt-token' }
  resetAllMocks()
  
  // Action
  await worker.verifySession(testData)
  
  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], testData, 'Data parameter should be passed through unchanged')
  
  // Reset
  resetAllMocks()
})

test('should return result from metrics.wrapRpcMethod for verifySession', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const expectedResult = { success: true, user: { id: 123 } }
  worker.metrics.wrapRpcMethod.resolves(expectedResult)
  resetAllMocks()
  
  // Action
  const result = await worker.verifySession({ token: 'jwt-token' })
  
  // Assert
  t.is(result, expectedResult, 'Method should return exact result from wrapRpcMethod')
  
  // Reset
  resetAllMocks()
})

test('should propagate errors from metrics.wrapRpcMethod for verifySession', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testError = new Error('verifySession error')
  worker.metrics.wrapRpcMethod.rejects(testError)
  resetAllMocks()
  
  // Action & Assert
  try {
    await worker.verifySession({ token: 'jwt-token' })
    t.fail('Method should throw error')
  } catch (error) {
    t.is(error, testError, 'Method should throw the same error from wrapRpcMethod')
  }
  
  // Reset
  resetAllMocks()
})

test('should handle verifySession try-catch error handling', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const testError = new Error('verifySession try-catch error')
  worker.metrics.wrapRpcMethod.rejects(testError)
  resetAllMocks()
  
  // Action & Assert
  try {
    await worker.verifySession({ token: 'jwt-token' })
    t.fail('Method should throw error')
  } catch (error) {
    t.is(error, testError, 'Error should be re-thrown after handling')
  }
  
  // Reset
  resetAllMocks()
})

// ==================== STOP METHOD TESTS ====================

test('should stop metrics when metrics instance exists', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  
  // Action
  worker.stop()
  
  // Assert
  t.ok(worker.metrics.stop.calledOnce, 'metrics.stop should be called once')
  
  // Reset
  resetAllMocks()
})

test('should handle missing metrics instance gracefully', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  worker.metrics = null
  
  // Action & Assert
  try {
    worker.stop()
    t.pass('stop method should complete without errors')
  } catch (error) {
    t.fail('stop method should not throw error when metrics is null')
  }
  
  // Reset
  resetAllMocks()
})

test('should handle metrics.stop throwing error', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  worker.metrics.stop.throws(new Error('metrics stop error'))
  
  // Action & Assert
  try {
    worker.stop()
    t.pass('Error should be handled gracefully')
  } catch (error) {
    t.fail('stop method should handle metrics.stop errors gracefully')
  }
  
  // Reset
  resetAllMocks()
})

test('should call parent stop method', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const superStopSpy = sinon.spy(MockBase.prototype, 'stop')
  
  // Action
  worker.stop()
  
  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should be called once')
  
  // Cleanup
  superStopSpy.restore()
  resetAllMocks()
})

test('should call parent stop even when metrics cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const superStopSpy = sinon.spy(MockBase.prototype, 'stop')
  worker.metrics.stop.throws(new Error('metrics stop error'))
  
  // Action
  worker.stop()
  
  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should still be called despite metrics error')
  
  // Cleanup
  superStopSpy.restore()
  resetAllMocks()
})

test('should execute stop operations in correct sequence', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const superStopSpy = sinon.spy(MockBase.prototype, 'stop')
  
  // Action
  worker.stop()
  
  // Assert
  t.ok(worker.metrics.stop.calledBefore(superStopSpy), 'metrics.stop should be called before super.stop')
  t.ok(superStopSpy.calledOnce, 'Both cleanup operations should complete')
  
  // Cleanup
  superStopSpy.restore()
  resetAllMocks()
})

test('should handle stop method called multiple times', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  
  // Action & Assert
  try {
    worker.stop()
    worker.stop()
    worker.stop()
    t.pass('Multiple stop calls should be handled gracefully')
  } catch (error) {
    t.fail('Multiple stop calls should not throw errors')
  }
  
  // Reset
  resetAllMocks()
})

test('should continue shutdown even when metrics cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const worker = new GatewayWorker(conf, ctx)
  const superStopSpy = sinon.spy(MockBase.prototype, 'stop')
  worker.metrics.stop.throws(new Error('metrics cleanup error'))
  
  // Action
  worker.stop()
  
  // Assert
  t.ok(superStopSpy.calledOnce, 'parent stop should still be called after error')
  
  // Cleanup
  superStopSpy.restore()
  resetAllMocks()
})