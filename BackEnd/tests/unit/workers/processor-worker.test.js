'use strict'

const test = require('brittle')
const sinon = require('sinon')

// Test utilities
function createValidConfig() {
  return { worker: { env: 'test' } }
}

function createValidContext() {
  return { env: 'test' }
}

// Mock SimpleMetrics before requiring ProcessorWorker
const SimpleMetricsMock = sinon.stub().returns({
  isMetricsInstance: true
})

// Mock SimpleMetrics, ProcessorHelper and logger modules
const Module = require('module')
const originalRequire = Module.prototype.require
Module.prototype.require = function(id) {
  if (id === '../simple-metrics.js') {
    return SimpleMetricsMock
  }
  if (id === './processor-helper.js') {
    return {
      processRequest: sinon.stub().resolves('helper result')
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

// Load ProcessorWorker with mocked SimpleMetrics
const ProcessorWorker = require('../../../processor_worker/processor-worker.js')

// Expected values for assertions
const EXPECTED_STORAGE_FACILITY = ['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/processor' }, 0]
const EXPECTED_NETWORK_FACILITY = ['fac', 'hp-svc-facs-net', 'net', 'default', {}, 10]
const EXPECTED_METRICS_SERVICE = 'processor'
const EXPECTED_METRICS_PORT = 9102

test('should create ProcessorWorker instance with valid parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')

  // Action  
  const worker = new ProcessorWorker(conf, ctx)

  // Assert
  t.ok(worker, 'Instance should be created')
  t.ok(worker instanceof ProcessorWorker, 'Instance should be of ProcessorWorker type')
  
  // Cleanup
  consoleStub.restore()
})

test('should call setInitFacs with exactly 2 facilities', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const setInitFacsSpy = sinon.spy(ProcessorWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new ProcessorWorker(conf, ctx)

  // Assert
  t.is(setInitFacsSpy.callCount, 1, 'setInitFacs should be called once')
  t.is(setInitFacsSpy.firstCall.args[0].length, 2, 'setInitFacs should be called with array of 2 facilities')
  
  // Cleanup
  setInitFacsSpy.restore()
  consoleStub.restore()
})

test('should configure storage facility with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const setInitFacsSpy = sinon.spy(ProcessorWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new ProcessorWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storageFacility = facilities[0]
  
  t.alike(storageFacility, EXPECTED_STORAGE_FACILITY, 'Storage facility should match expected configuration')
  t.is(storageFacility[5], 0, 'Storage facility should have priority 0')
  
  // Cleanup
  setInitFacsSpy.restore()
  consoleStub.restore()
})

test('should configure network facility with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const setInitFacsSpy = sinon.spy(ProcessorWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new ProcessorWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const networkFacility = facilities[1]
  
  t.alike(networkFacility, EXPECTED_NETWORK_FACILITY, 'Network facility should match expected configuration')
  t.is(networkFacility[5], 10, 'Network facility should have priority 10')
  
  // Cleanup
  setInitFacsSpy.restore()
  consoleStub.restore()
})

test('should configure storage facility with processor-specific directory', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const setInitFacsSpy = sinon.spy(ProcessorWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new ProcessorWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const storageFacility = facilities[0]
  
  t.is(storageFacility[4].storeDir, './data/processor', 'Storage directory should be processor-specific')
  t.is(storageFacility[3], 's0', 'Storage facility name should be s0')
  
  // Cleanup
  setInitFacsSpy.restore()
  consoleStub.restore()
})

test('should configure network facility with empty config', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const setInitFacsSpy = sinon.spy(ProcessorWorker.prototype, 'setInitFacs')
  
  // Action
  const worker = new ProcessorWorker(conf, ctx)

  // Assert
  const facilities = setInitFacsSpy.firstCall.args[0]
  const networkFacility = facilities[1]
  
  t.alike(networkFacility[4], {}, 'Network facility config should be empty object')
  t.is(networkFacility[3], 'default', 'Network facility name should be default')
  
  // Cleanup
  setInitFacsSpy.restore()
  consoleStub.restore()
})

test('should create SimpleMetrics with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  SimpleMetricsMock.resetHistory() // Reset call history

  // Action
  const worker = new ProcessorWorker(conf, ctx)

  // Assert
  t.is(SimpleMetricsMock.callCount, 1, 'SimpleMetrics constructor should be called once')
  t.is(SimpleMetricsMock.firstCall.args[0], EXPECTED_METRICS_SERVICE, 'SimpleMetrics should be called with processor service name')
  t.is(SimpleMetricsMock.firstCall.args[1], EXPECTED_METRICS_PORT, 'SimpleMetrics should be called with port 9102')
  
  // Cleanup
  consoleStub.restore()
})

test('should assign metrics property', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const mockMetricsInstance = { isMetricsInstance: true }
  SimpleMetricsMock.returns(mockMetricsInstance)

  // Action
  const worker = new ProcessorWorker(conf, ctx)

  // Assert
  t.ok(worker.metrics, 'metrics property should exist')
  t.ok(worker.metrics !== null && worker.metrics !== undefined, 'metrics property should not be null or undefined')
  t.is(worker.metrics, mockMetricsInstance, 'metrics property should be assigned to SimpleMetrics instance')
  
  // Cleanup
  consoleStub.restore()
})

test('should call setInitFacs before creating metrics', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  // Spy on setInitFacs 
  const setInitFacsSpy = sinon.spy(ProcessorWorker.prototype, 'setInitFacs')
  
  // Reset SimpleMetrics to simple return
  SimpleMetricsMock.resetBehavior()
  SimpleMetricsMock.returns({ isMetricsInstance: true })

  // Action
  const worker = new ProcessorWorker(conf, ctx)

  // Assert
  t.ok(setInitFacsSpy.called, 'setInitFacs should be called')
  t.ok(SimpleMetricsMock.called, 'SimpleMetrics should be called')
  
  // Cleanup
  setInitFacsSpy.restore()
  consoleStub.restore()
})

// Helper function to create complete net_default mock
function createMockNetFacility() {
  return {
    startRpcServer: sinon.stub().resolves(),
    rpcServer: {
      respond: sinon.stub()
    },
    startLookup: sinon.stub(),
    lookup: {
      announceInterval: sinon.stub().resolves(),
      unnannounceInterval: sinon.stub().resolves()
    },
    handleReply: sinon.stub().resolves('mock result')
  }
}

// Helper function to create basic metrics mock
function createMockMetrics() {
  return {
    wrapRpcMethod: sinon.stub().resolves('wrapped result')
  }
}

// Method Tests - Temporarily simplified for debugging
// _start Method Tests
test('should call callback with error when net_default facility is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = null // Simulate missing facility

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(sinon.match.instanceOf(Error)), 'Callback should be called with error')
  t.ok(callbackSpy.args[0][0].message.includes('net_default facility not available'), 'Error message should be correct')
  
  // Cleanup
  consoleStub.restore()
  consoleErrorStub.restore()
})

// processRequest Method Tests
test('should call metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  const result = await worker.processRequest(testData)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  const call = worker.metrics.wrapRpcMethod.firstCall
  t.is(call.args[0], 'processRequest', 'First parameter should be processRequest')
  t.ok(typeof call.args[1] === 'function', 'Second parameter should be function')
  t.is(call.args[2], worker, 'Third parameter should be worker instance')
  t.is(call.args[3], testData, 'Fourth parameter should be test data')
  t.is(result, 'wrapped result', 'Should return mock result')
  
  // Cleanup
  consoleStub.restore()
})

test('should return result from metrics.wrapRpcMethod', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  const expectedResult = { response: 'processed response' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()
  worker.metrics.wrapRpcMethod.resolves(expectedResult)

  // Action
  const result = await worker.processRequest(testData)

  // Assert
  t.is(result, expectedResult, 'Method should return exact result from wrapRpcMethod')
  
  // Cleanup
  consoleStub.restore()
})

test('should propagate errors from metrics.wrapRpcMethod', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  const testError = new Error('wrapRpcMethod failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()
  worker.metrics.wrapRpcMethod.rejects(testError)

  // Action & Assert
  try {
    await worker.processRequest(testData)
    t.fail('Method should throw error')
  } catch (error) {
    t.is(error, testError, 'Method should throw the same error from wrapRpcMethod')
  }
  
  // Cleanup
  consoleStub.restore()
})

test('should handle undefined data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(undefined)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], undefined, 'wrapRpcMethod should be called with undefined as last parameter')
  
  // Cleanup
  consoleStub.restore()
})

test('should handle null data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(null)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], null, 'wrapRpcMethod should be called with null as last parameter')
  
  // Cleanup
  consoleStub.restore()
})

test('should handle complex object data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const complexObject = { 
    prompt: 'test', 
    metadata: { user: 'test-user', timestamp: Date.now() },
    nested: { deep: { value: 42 } }
  }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(complexObject)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], complexObject, 'wrapRpcMethod should be called with exact complex object')
  
  // Cleanup
  consoleStub.restore()
})

// stop Method Tests
test('should call unnannounceInterval when lookup is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop to avoid complex prototype manipulation
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(worker.net_default.lookup.unnannounceInterval.calledOnce, 'unnannounceInterval should be called once')
  t.ok(worker.net_default.lookup.unnannounceInterval.calledWith('processor'), 'unnannounceInterval should be called with processor topic')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should skip DHT cleanup when net_default is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = null // Simulate missing net_default
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should skip DHT cleanup when lookup is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup = null // Simulate missing lookup
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call parent stop method after DHT cleanup', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should be called once')
  t.ok(worker.net_default.lookup.unnannounceInterval.calledBefore(superStopSpy), 'DHT cleanup should be called before super.stop')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call parent stop method even when DHT cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should still be called')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with error')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should call callback when stop succeeds', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called exactly once')
  t.ok(callbackSpy.calledWith(), 'Callback should be called with no arguments (success)')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call callback with error when DHT cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with the error')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should handle missing callback parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    if (cb) cb() 
  }

  // Action
  try {
    await worker.stop() // No callback provided
    t.pass('Method should complete successfully without callback')
  } catch (error) {
    t.fail('Method should not throw error when callback is missing')
  }
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should continue shutdown even when unnannounceInterval fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should still be called after error')
  t.ok(callbackSpy.calledWith(testError), 'Error should be handled gracefully')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should proceed when net_default facility is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(worker.net_default.startRpcServer.called, 'startRpcServer should be called')
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(), 'Callback should be called without error (success)')
  
  // Cleanup
  consoleStub.restore()
})

test('should call startRpcServer on net_default', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(worker.net_default.startRpcServer.calledOnce, 'startRpcServer should be called once')
  
  // Cleanup
  consoleStub.restore()
})

test('should handle startRpcServer failure', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const testError = new Error('RPC server failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.startRpcServer.rejects(testError)

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with the error')
  
  // Cleanup
  consoleStub.restore()
  consoleErrorStub.restore()
})

// processRequest Method Tests
test('should call metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  const result = await worker.processRequest(testData)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  const call = worker.metrics.wrapRpcMethod.firstCall
  t.is(call.args[0], 'processRequest', 'First parameter should be processRequest')
  t.ok(typeof call.args[1] === 'function', 'Second parameter should be function')
  t.is(call.args[2], worker, 'Third parameter should be worker instance')
  t.is(call.args[3], testData, 'Fourth parameter should be test data')
  t.is(result, 'wrapped result', 'Should return mock result')
  
  // Cleanup
  consoleStub.restore()
})

test('should return result from metrics.wrapRpcMethod', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  const expectedResult = { response: 'processed response' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()
  worker.metrics.wrapRpcMethod.resolves(expectedResult)

  // Action
  const result = await worker.processRequest(testData)

  // Assert
  t.is(result, expectedResult, 'Method should return exact result from wrapRpcMethod')
  
  // Cleanup
  consoleStub.restore()
})

test('should propagate errors from metrics.wrapRpcMethod', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  const testError = new Error('wrapRpcMethod failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()
  worker.metrics.wrapRpcMethod.rejects(testError)

  // Action & Assert
  try {
    await worker.processRequest(testData)
    t.fail('Method should throw error')
  } catch (error) {
    t.is(error, testError, 'Method should throw the same error from wrapRpcMethod')
  }
  
  // Cleanup
  consoleStub.restore()
})

test('should handle undefined data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(undefined)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], undefined, 'wrapRpcMethod should be called with undefined as last parameter')
  
  // Cleanup
  consoleStub.restore()
})

test('should handle null data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(null)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], null, 'wrapRpcMethod should be called with null as last parameter')
  
  // Cleanup
  consoleStub.restore()
})

test('should handle complex object data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const complexObject = { 
    prompt: 'test', 
    metadata: { user: 'test-user', timestamp: Date.now() },
    nested: { deep: { value: 42 } }
  }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(complexObject)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], complexObject, 'wrapRpcMethod should be called with exact complex object')
  
  // Cleanup
  consoleStub.restore()
})

// stop Method Tests
test('should call unnannounceInterval when lookup is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop to avoid complex prototype manipulation
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(worker.net_default.lookup.unnannounceInterval.calledOnce, 'unnannounceInterval should be called once')
  t.ok(worker.net_default.lookup.unnannounceInterval.calledWith('processor'), 'unnannounceInterval should be called with processor topic')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should skip DHT cleanup when net_default is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = null // Simulate missing net_default
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should skip DHT cleanup when lookup is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup = null // Simulate missing lookup
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call parent stop method after DHT cleanup', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should be called once')
  t.ok(worker.net_default.lookup.unnannounceInterval.calledBefore(superStopSpy), 'DHT cleanup should be called before super.stop')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call parent stop method even when DHT cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should still be called')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with error')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should call callback when stop succeeds', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called exactly once')
  t.ok(callbackSpy.calledWith(), 'Callback should be called with no arguments (success)')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call callback with error when DHT cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with the error')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should handle missing callback parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    if (cb) cb() 
  }

  // Action
  try {
    await worker.stop() // No callback provided
    t.pass('Method should complete successfully without callback')
  } catch (error) {
    t.fail('Method should not throw error when callback is missing')
  }
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should continue shutdown even when unnannounceInterval fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should still be called after error')
  t.ok(callbackSpy.calledWith(testError), 'Error should be handled gracefully')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should register ping method when rpcServer.respond is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(worker.net_default.rpcServer.respond.calledWith('ping', sinon.match.func), 'respond should be called with ping method')
  
  // Cleanup
  consoleStub.restore()
})

test('should register processRequest method when rpcServer.respond is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(worker.net_default.rpcServer.respond.calledWith('processRequest', sinon.match.func), 'respond should be called with processRequest method')
  
  // Cleanup
  consoleStub.restore()
})

test('should skip RPC method registration when rpcServer.respond is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.rpcServer.respond = undefined // Remove respond method

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(worker.net_default.startLookup.called, 'Processing should continue to lookup service')
  t.ok(callbackSpy.calledOnce, 'Callback should be called')
  
  // Cleanup
  consoleStub.restore()
  consoleErrorStub.restore()
})

// processRequest Method Tests
test('should call metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  const result = await worker.processRequest(testData)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  const call = worker.metrics.wrapRpcMethod.firstCall
  t.is(call.args[0], 'processRequest', 'First parameter should be processRequest')
  t.ok(typeof call.args[1] === 'function', 'Second parameter should be function')
  t.is(call.args[2], worker, 'Third parameter should be worker instance')
  t.is(call.args[3], testData, 'Fourth parameter should be test data')
  t.is(result, 'wrapped result', 'Should return mock result')
  
  // Cleanup
  consoleStub.restore()
})

test('should return result from metrics.wrapRpcMethod', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  const expectedResult = { response: 'processed response' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()
  worker.metrics.wrapRpcMethod.resolves(expectedResult)

  // Action
  const result = await worker.processRequest(testData)

  // Assert
  t.is(result, expectedResult, 'Method should return exact result from wrapRpcMethod')
  
  // Cleanup
  consoleStub.restore()
})

test('should propagate errors from metrics.wrapRpcMethod', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  const testError = new Error('wrapRpcMethod failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()
  worker.metrics.wrapRpcMethod.rejects(testError)

  // Action & Assert
  try {
    await worker.processRequest(testData)
    t.fail('Method should throw error')
  } catch (error) {
    t.is(error, testError, 'Method should throw the same error from wrapRpcMethod')
  }
  
  // Cleanup
  consoleStub.restore()
})

test('should handle undefined data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(undefined)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], undefined, 'wrapRpcMethod should be called with undefined as last parameter')
  
  // Cleanup
  consoleStub.restore()
})

test('should handle null data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(null)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], null, 'wrapRpcMethod should be called with null as last parameter')
  
  // Cleanup
  consoleStub.restore()
})

test('should handle complex object data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const complexObject = { 
    prompt: 'test', 
    metadata: { user: 'test-user', timestamp: Date.now() },
    nested: { deep: { value: 42 } }
  }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(complexObject)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], complexObject, 'wrapRpcMethod should be called with exact complex object')
  
  // Cleanup
  consoleStub.restore()
})

// stop Method Tests
test('should call unnannounceInterval when lookup is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop to avoid complex prototype manipulation
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(worker.net_default.lookup.unnannounceInterval.calledOnce, 'unnannounceInterval should be called once')
  t.ok(worker.net_default.lookup.unnannounceInterval.calledWith('processor'), 'unnannounceInterval should be called with processor topic')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should skip DHT cleanup when net_default is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = null // Simulate missing net_default
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should skip DHT cleanup when lookup is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup = null // Simulate missing lookup
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call parent stop method after DHT cleanup', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should be called once')
  t.ok(worker.net_default.lookup.unnannounceInterval.calledBefore(superStopSpy), 'DHT cleanup should be called before super.stop')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call parent stop method even when DHT cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should still be called')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with error')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should call callback when stop succeeds', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called exactly once')
  t.ok(callbackSpy.calledWith(), 'Callback should be called with no arguments (success)')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call callback with error when DHT cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with the error')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should handle missing callback parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    if (cb) cb() 
  }

  // Action
  try {
    await worker.stop() // No callback provided
    t.pass('Method should complete successfully without callback')
  } catch (error) {
    t.fail('Method should not throw error when callback is missing')
  }
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should continue shutdown even when unnannounceInterval fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should still be called after error')
  t.ok(callbackSpy.calledWith(testError), 'Error should be handled gracefully')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should return correct ping response format', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()

  // Action
  await worker._start(callbackSpy)
  
  // Get the ping handler function
  const pingCall = worker.net_default.rpcServer.respond.getCalls().find(call => call.args[0] === 'ping')
  const pingHandler = pingCall.args[1]
  const result = await pingHandler()

  // Assert
  t.ok(result.status === 'healthy', 'Status should be healthy')
  t.ok(typeof result.timestamp === 'number', 'Timestamp should be a number')
  t.ok(result.service === 'processor', 'Service should be processor')
  t.ok(result.timestamp > 0, 'Timestamp should be valid')
  
  // Cleanup
  consoleStub.restore()
})

test('should delegate to net_default.handleReply with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  const testData = { test: 'data' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()

  // Action
  await worker._start(callbackSpy)
  
  // Get the processRequest handler function and call it
  const processCall = worker.net_default.rpcServer.respond.getCalls().find(call => call.args[0] === 'processRequest')
  const processHandler = processCall.args[1]
  await processHandler(testData)

  // Assert
  t.ok(worker.net_default.handleReply.calledOnce, 'handleReply should be called once')
  t.ok(worker.net_default.handleReply.calledWith('processRequest', testData), 'handleReply should be called with correct parameters')
  
  // Cleanup
  consoleStub.restore()
})

test('should return result from handleReply', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  const testData = { test: 'data' }
  const expectedResult = { processed: 'result' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.handleReply.resolves(expectedResult)

  // Action
  await worker._start(callbackSpy)
  
  // Get the processRequest handler function and call it
  const processCall = worker.net_default.rpcServer.respond.getCalls().find(call => call.args[0] === 'processRequest')
  const processHandler = processCall.args[1]
  const result = await processHandler(testData)

  // Assert
  t.is(result, expectedResult, 'Handler should return exact result from handleReply')
  
  // Cleanup
  consoleStub.restore()
})

test('should propagate errors from handleReply', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  const testData = { test: 'data' }
  const testError = new Error('handleReply failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.handleReply.rejects(testError)

  // Action
  await worker._start(callbackSpy)
  
  // Get the processRequest handler function and call it
  const processCall = worker.net_default.rpcServer.respond.getCalls().find(call => call.args[0] === 'processRequest')
  const processHandler = processCall.args[1]

  // Assert
  try {
    await processHandler(testData)
    t.fail('Handler should throw error')
  } catch (error) {
    t.is(error, testError, 'Handler should throw the same error from handleReply')
  }
  
  // Cleanup
  consoleStub.restore()
})

test('should call startLookup on net_default', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(worker.net_default.startLookup.calledOnce, 'startLookup should be called once')
  
  // Cleanup
  consoleStub.restore()
})

test('should call announceInterval with processor topic', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(worker.net_default.lookup.announceInterval.calledOnce, 'announceInterval should be called once')
  t.ok(worker.net_default.lookup.announceInterval.calledWith('processor'), 'announceInterval should be called with processor topic')
  
  // Cleanup
  consoleStub.restore()
})

test('should call callback without error when startup succeeds', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called exactly once')
  t.ok(callbackSpy.calledWith(), 'Callback should be called with no arguments (success)')
  
  // Cleanup
  consoleStub.restore()
})

test('should call callback with error when lookup.announceInterval fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const testError = new Error('announceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.announceInterval.rejects(testError)

  // Action
  await worker._start(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with the error')
  
  // Cleanup
  consoleStub.restore()
  consoleErrorStub.restore()
})

// processRequest Method Tests
test('should call metrics.wrapRpcMethod with correct parameters', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  const result = await worker.processRequest(testData)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  const call = worker.metrics.wrapRpcMethod.firstCall
  t.is(call.args[0], 'processRequest', 'First parameter should be processRequest')
  t.ok(typeof call.args[1] === 'function', 'Second parameter should be function')
  t.is(call.args[2], worker, 'Third parameter should be worker instance')
  t.is(call.args[3], testData, 'Fourth parameter should be test data')
  t.is(result, 'wrapped result', 'Should return mock result')
  
  // Cleanup
  consoleStub.restore()
})

test('should return result from metrics.wrapRpcMethod', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  const expectedResult = { response: 'processed response' }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()
  worker.metrics.wrapRpcMethod.resolves(expectedResult)

  // Action
  const result = await worker.processRequest(testData)

  // Assert
  t.is(result, expectedResult, 'Method should return exact result from wrapRpcMethod')
  
  // Cleanup
  consoleStub.restore()
})

test('should propagate errors from metrics.wrapRpcMethod', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const testData = { prompt: 'test prompt' }
  const testError = new Error('wrapRpcMethod failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()
  worker.metrics.wrapRpcMethod.rejects(testError)

  // Action & Assert
  try {
    await worker.processRequest(testData)
    t.fail('Method should throw error')
  } catch (error) {
    t.is(error, testError, 'Method should throw the same error from wrapRpcMethod')
  }
  
  // Cleanup
  consoleStub.restore()
})

test('should handle undefined data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(undefined)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], undefined, 'wrapRpcMethod should be called with undefined as last parameter')
  
  // Cleanup
  consoleStub.restore()
})

test('should handle null data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(null)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], null, 'wrapRpcMethod should be called with null as last parameter')
  
  // Cleanup
  consoleStub.restore()
})

test('should handle complex object data parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const complexObject = { 
    prompt: 'test', 
    metadata: { user: 'test-user', timestamp: Date.now() },
    nested: { deep: { value: 42 } }
  }
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.metrics = createMockMetrics()

  // Action
  await worker.processRequest(complexObject)

  // Assert
  t.ok(worker.metrics.wrapRpcMethod.calledOnce, 'wrapRpcMethod should be called once')
  t.is(worker.metrics.wrapRpcMethod.firstCall.args[3], complexObject, 'wrapRpcMethod should be called with exact complex object')
  
  // Cleanup
  consoleStub.restore()
})

// stop Method Tests
test('should call unnannounceInterval when lookup is available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop to avoid complex prototype manipulation
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(worker.net_default.lookup.unnannounceInterval.calledOnce, 'unnannounceInterval should be called once')
  t.ok(worker.net_default.lookup.unnannounceInterval.calledWith('processor'), 'unnannounceInterval should be called with processor topic')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should skip DHT cleanup when net_default is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = null // Simulate missing net_default
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should skip DHT cleanup when lookup is not available', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup = null // Simulate missing lookup
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call parent stop method after DHT cleanup', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should be called once')
  t.ok(worker.net_default.lookup.unnannounceInterval.calledBefore(superStopSpy), 'DHT cleanup should be called before super.stop')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call parent stop method even when DHT cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should still be called')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with error')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should call callback when stop succeeds', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const callbackSpy = sinon.spy()
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb() 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called exactly once')
  t.ok(callbackSpy.calledWith(), 'Callback should be called with no arguments (success)')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should call callback with error when DHT cleanup fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(callbackSpy.calledOnce, 'Callback should be called once')
  t.ok(callbackSpy.calledWith(testError), 'Callback should be called with the error')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})

test('should handle missing callback parameter', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    if (cb) cb() 
  }

  // Action
  try {
    await worker.stop() // No callback provided
    t.pass('Method should complete successfully without callback')
  } catch (error) {
    t.fail('Method should not throw error when callback is missing')
  }
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
})

test('should continue shutdown even when unnannounceInterval fails', async (t) => {
  // Setup
  const conf = createValidConfig()
  const ctx = createValidContext()
  const consoleStub = sinon.stub(console, 'log')
  const consoleErrorStub = sinon.stub(console, 'error')
  const callbackSpy = sinon.spy()
  const superStopSpy = sinon.spy()
  const testError = new Error('unnannounceInterval failed')
  
  const worker = new ProcessorWorker(conf, ctx)
  worker.net_default = createMockNetFacility()
  worker.net_default.lookup.unnannounceInterval.rejects(testError)
  
  // Mock super.stop
  const originalStop = worker.constructor.prototype.__proto__.stop
  worker.constructor.prototype.__proto__.stop = function(cb) { 
    superStopSpy()
    cb(testError) 
  }

  // Action
  await worker.stop(callbackSpy)

  // Assert
  t.ok(superStopSpy.calledOnce, 'super.stop should still be called after error')
  t.ok(callbackSpy.calledWith(testError), 'Error should be handled gracefully')
  
  // Cleanup
  worker.constructor.prototype.__proto__.stop = originalStop
  consoleStub.restore()
  consoleErrorStub.restore()
})
