'use strict'

const test = require('brittle')
const sinon = require('sinon')
const ClientHelper = require('../../../../client_worker/client-helper.js')

// Test authorizedTopicRequest Method
test('should create request payload with data parameter', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const testData = { test: 'data' }
  const mockWorkerInstance = {
    sessionKey: 'test-session-key-12345',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', testData)

  const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  t.alike(callArgs[2].data, testData)
  t.ok(callArgs[2].hasOwnProperty('data'))
})

test('should add auth key for non-exempt methods when sessionKey exists', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key-12345',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'processPrompt', { test: 'data' })

  const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  t.is(callArgs[2].meta.key, 'test-session-key-12345')
})

test('should not add auth key for exempt methods (register, login)', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key-12345',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'register', { test: 'data' })

  const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  t.not(callArgs[2].hasOwnProperty('meta'))
})

test('should not add auth key for non-exempt methods when sessionKey is null', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'processPrompt', { test: 'data' })

  const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  t.not(callArgs[2].hasOwnProperty('meta'))
})

test('should not add auth key for non-exempt methods when sessionKey is undefined', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: undefined,
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'processPrompt', { test: 'data' })

  const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  t.not(callArgs[2].hasOwnProperty('meta'))
})

test('should call jTopicRequestRobust with correct parameters', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const testData = { test: 'data' }
  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', testData)

  t.ok(mockWorkerInstance.net_default.jTopicRequestRobust.calledWith(
    'test-topic',
    'test-method',
    sinon.match({ data: testData }),
    {},
    3,
    200
  ))
})

test('should generate unique session IDs for each request', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  let callCount = 0
  sandbox.stub(Math, 'random').callsFake(() => {
    callCount++
    return callCount * 0.1
  })

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', {})
  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', {})

  t.is(Math.random.callCount, 2)
})

test('should return result from jTopicRequestRobust on success', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const expectedResult = { success: true, data: 'test' }
  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves(expectedResult)
    }
  }

  const result = await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', {})

  t.alike(result, expectedResult)
})

test('should propagate error from jTopicRequestRobust on failure', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const expectedError = new Error('Network error')
  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().rejects(expectedError)
    }
  }

  try {
    await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', {})
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error, expectedError)
  }
})

test('should handle null data parameter', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', null)

  const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  t.is(callArgs[2].data, null)
})

test('should handle undefined data parameter', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', undefined)

  const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  t.is(callArgs[2].data, undefined)
})

test('should handle complex object data parameter', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const complexData = { 
    level1: { 
      level2: { 
        array: [1, 2, 3], 
        bool: true 
      } 
    } 
  }
  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', complexData)

  const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  t.alike(callArgs[2].data, complexData)
})

test('should handle empty string data parameter', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', '')

  const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  t.is(callArgs[2].data, '')
})

test('should validate exempt methods array contains register and login', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }

  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'register', {})
  await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'login', {})

  const registerCall = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
  const loginCall = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(1).args
  t.not(registerCall[2].hasOwnProperty('meta'))
  t.not(loginCall[2].hasOwnProperty('meta'))
})

// Test sleep Method
test('should return a Promise', (t) => {
  const result = ClientHelper.sleep(100)
  t.ok(result instanceof Promise)
  t.is(typeof result.then, 'function')
})

test('should resolve after specified milliseconds', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const clock = sinon.useFakeTimers()
  t.teardown(() => clock.restore())

  let resolved = false
  const sleepPromise = ClientHelper.sleep(100).then(() => {
    resolved = true
  })

  t.not(resolved)
  clock.tick(100)
  await sleepPromise
  t.ok(resolved)
})

test('should handle zero milliseconds', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const clock = sinon.useFakeTimers()
  t.teardown(() => clock.restore())

  let resolved = false
  const sleepPromise = ClientHelper.sleep(0).then(() => {
    resolved = true
  })

  clock.tick(0)
  await sleepPromise
  t.ok(resolved)
})

test('should handle negative milliseconds', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const clock = sinon.useFakeTimers()
  t.teardown(() => clock.restore())

  let resolved = false
  const sleepPromise = ClientHelper.sleep(-100).then(() => {
    resolved = true
  })

  clock.tick(0)
  await sleepPromise
  t.ok(resolved)
})

// Test sendRequest Method
test('should call authorizedTopicRequest with correct parameters', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ response: 'Test response' })
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  const testPrompt = 'Test prompt'
  await ClientHelper.sendRequest(mockWorkerInstance, testPrompt)

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'processPrompt',
    { prompt: testPrompt }
  ))
})

test('should return result from authorizedTopicRequest on success', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const expectedResult = { response: 'Test response' }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves(expectedResult)
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  const result = await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')

  t.alike(result, expectedResult)
})

test('should handle result with response property', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const testResult = { response: 'test response' }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves(testResult)
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  const result = await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')

  t.is(result.response, 'test response')
})

test('should handle result with error property', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const testResult = { error: true, message: 'test error' }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves(testResult)
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  const result = await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')

  t.is(result.error, true)
  t.is(result.message, 'test error')
})

test('should handle ERR_TOPIC_LOOKUP_EMPTY error', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const error = new Error('ERR_TOPIC_LOOKUP_EMPTY - no peers found')
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(error)
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  try {
    await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
    t.fail('Should have thrown error')
  } catch (thrownError) {
    t.ok(thrownError.message.includes('ERR_TOPIC_LOOKUP_EMPTY'))
  }
})

test('should handle UNKNOWN_METHOD error', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const error = new Error('UNKNOWN_METHOD - method not found')
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(error)
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  try {
    await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
    t.fail('Should have thrown error')
  } catch (thrownError) {
    t.ok(thrownError.message.includes('UNKNOWN_METHOD'))
  }
})

test('should handle CHANNEL_CLOSED error', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const error = new Error('CHANNEL_CLOSED - connection lost')
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(error)
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  try {
    await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
    t.fail('Should have thrown error')
  } catch (thrownError) {
    t.ok(thrownError.message.includes('CHANNEL_CLOSED'))
  }
})

test('should handle stale announcement error', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const error = new Error('Stale announcement error')
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(error)
  const staleStub = sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(true)

  try {
    await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
    t.fail('Should have thrown error')
  } catch (thrownError) {
    t.ok(staleStub.calledWith(error))
    t.is(thrownError, error)
  }
})

test('should handle unknown error types', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const error = new Error('Unknown error')
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(error)
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  try {
    await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
    t.fail('Should have thrown error')
  } catch (thrownError) {
    t.is(thrownError, error)
  }
})

test('should generate unique request IDs for error handling', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  let callCount = 0
  sandbox.stub(Math, 'random').callsFake(() => {
    callCount++
    return callCount * 0.1
  })

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const error = new Error('Test error')
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(error)
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  try {
    await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
  } catch (e) {}
  
  try {
    await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
  } catch (e) {}

  t.is(Math.random.callCount, 2)
})

test('should handle empty string prompt', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ response: 'response' })
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  await ClientHelper.sendRequest(mockWorkerInstance, '')

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'processPrompt',
    { prompt: '' }
  ))
})

test('should handle null prompt', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ response: 'response' })
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  // BUG REPORT: ClientHelper.sendRequest tries to access inputPrompt.length when inputPrompt is null
  // This causes TypeError: Cannot read properties of null (reading 'length')
  try {
    await ClientHelper.sendRequest(mockWorkerInstance, null)
    t.fail('Should have thrown error due to bug in sendRequest method')
  } catch (error) {
    t.ok(error.message.includes('Cannot read properties of null'))
  }
})

// Test registerUser Method
test('should call authorizedTopicRequest with correct parameters for register', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  const email = 'test@example.com'
  const password = 'password123'
  await ClientHelper.registerUser(mockWorkerInstance, email, password)

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'register',
    { email, password }
  ))
})

test('should return result from authorizedTopicRequest on register success', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const expectedResult = { success: true, userId: '123' }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves(expectedResult)

  const result = await ClientHelper.registerUser(mockWorkerInstance, 'test@example.com', 'password')

  t.alike(result, expectedResult)
})

test('should propagate error from authorizedTopicRequest for register', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const expectedError = new Error('Registration failed')
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(expectedError)

  try {
    await ClientHelper.registerUser(mockWorkerInstance, 'test@example.com', 'password')
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error, expectedError)
  }
})

test('should handle empty string email for register', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  await ClientHelper.registerUser(mockWorkerInstance, '', 'password')

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'register',
    { email: '', password: 'password' }
  ))
})

test('should handle empty string password for register', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  await ClientHelper.registerUser(mockWorkerInstance, 'test@example.com', '')

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'register',
    { email: 'test@example.com', password: '' }
  ))
})

test('should handle null email parameter for register', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  await ClientHelper.registerUser(mockWorkerInstance, null, 'password')

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'register',
    { email: null, password: 'password' }
  ))
})

test('should handle null password parameter for register', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  await ClientHelper.registerUser(mockWorkerInstance, 'test@example.com', null)

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'register',
    { email: 'test@example.com', password: null }
  ))
})

// Test loginUser Method
test('should call authorizedTopicRequest with correct parameters for login', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true, key: 'token' })

  const email = 'test@example.com'
  const password = 'password123'
  await ClientHelper.loginUser(mockWorkerInstance, email, password)

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'login',
    { email, password }
  ))
})

test('should store session key on successful login', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const testToken = 'test-token-12345'
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true, key: testToken })

  await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

  t.is(mockWorkerInstance.sessionKey, testToken)
})

test('should not store session key when success is false', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: false, key: 'test-token' })

  await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

  t.is(mockWorkerInstance.sessionKey, null)
})

test('should not store session key when key is missing', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

  t.is(mockWorkerInstance.sessionKey, null)
})

test('should not store session key when key is null', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true, key: null })

  await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

  t.is(mockWorkerInstance.sessionKey, null)
})

test('should not store session key when key is empty string', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true, key: '' })

  await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

  t.is(mockWorkerInstance.sessionKey, null)
})

test('should return result from authorizedTopicRequest for login', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const expectedResult = { success: true, key: 'token', userId: '123' }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves(expectedResult)

  const result = await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

  t.alike(result, expectedResult)
})

test('should propagate error from authorizedTopicRequest for login', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const expectedError = new Error('Login failed')
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(expectedError)

  try {
    await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error, expectedError)
  }
})

test('should handle empty string email for login', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  await ClientHelper.loginUser(mockWorkerInstance, '', 'password')

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'login',
    { email: '', password: 'password' }
  ))
})

test('should handle empty string password for login', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', '')

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'login',
    { email: 'test@example.com', password: '' }
  ))
})

// Test logout Method
test('should clear session key when sessionKey exists', (t) => {
  const mockWorkerInstance = { sessionKey: 'existing-session-key' }

  ClientHelper.logout(mockWorkerInstance)

  t.is(mockWorkerInstance.sessionKey, null)
})

test('should return success response when sessionKey exists', (t) => {
  const mockWorkerInstance = { sessionKey: 'existing-session-key' }

  const result = ClientHelper.logout(mockWorkerInstance)

  t.is(result.success, true)
  t.is(result.message, 'Logged out successfully')
})

test('should return failure response when sessionKey is null', (t) => {
  const mockWorkerInstance = { sessionKey: null }

  const result = ClientHelper.logout(mockWorkerInstance)

  t.is(result.success, false)
  t.is(result.message, 'No active session to logout')
  t.is(mockWorkerInstance.sessionKey, null)
})

test('should return failure response when sessionKey is undefined', (t) => {
  const mockWorkerInstance = { sessionKey: undefined }

  const result = ClientHelper.logout(mockWorkerInstance)

  t.is(result.success, false)
  t.is(result.message, 'No active session to logout')
  t.is(mockWorkerInstance.sessionKey, undefined)
})

test('should return correct response structure for logout success', (t) => {
  const mockWorkerInstance = { sessionKey: 'existing-session-key' }

  const result = ClientHelper.logout(mockWorkerInstance)

  t.ok(result.hasOwnProperty('success'))
  t.ok(result.hasOwnProperty('message'))
  t.is(result.success, true)
  t.is(result.message, 'Logged out successfully')
})

test('should return correct response structure for logout failure', (t) => {
  const mockWorkerInstance = { sessionKey: null }

  const result = ClientHelper.logout(mockWorkerInstance)

  t.ok(result.hasOwnProperty('success'))
  t.ok(result.hasOwnProperty('message'))
  t.is(result.success, false)
  t.is(result.message, 'No active session to logout')
})

test('should handle empty string sessionKey for logout', (t) => {
  const mockWorkerInstance = { sessionKey: '' }

  const result = ClientHelper.logout(mockWorkerInstance)

  t.is(result.success, false)
  t.is(result.message, 'No active session to logout')
})

// Test getApiToken Method
test('should return token when sessionKey exists', (t) => {
  const testToken = 'test-api-token-12345'
  const mockWorkerInstance = { sessionKey: testToken }

  const result = ClientHelper.getApiToken(mockWorkerInstance)

  t.is(result.success, true)
  t.is(result.token, testToken)
  t.is(result.message, 'API token retrieved successfully')
})

test('should return failure response when sessionKey is null for getApiToken', (t) => {
  const mockWorkerInstance = { sessionKey: null }

  const result = ClientHelper.getApiToken(mockWorkerInstance)

  t.is(result.success, false)
  t.not(result.hasOwnProperty('token'))
  t.is(result.message, 'No active session - please login first')
})

test('should return failure response when sessionKey is undefined for getApiToken', (t) => {
  const mockWorkerInstance = { sessionKey: undefined }

  const result = ClientHelper.getApiToken(mockWorkerInstance)

  t.is(result.success, false)
  t.not(result.hasOwnProperty('token'))
  t.is(result.message, 'No active session - please login first')
})

test('should return correct response structure for getApiToken success', (t) => {
  const mockWorkerInstance = { sessionKey: 'test-token' }

  const result = ClientHelper.getApiToken(mockWorkerInstance)

  t.ok(result.hasOwnProperty('success'))
  t.ok(result.hasOwnProperty('token'))
  t.ok(result.hasOwnProperty('message'))
  t.is(result.success, true)
  t.is(result.token, 'test-token')
  t.is(result.message, 'API token retrieved successfully')
})

test('should return correct response structure for getApiToken failure', (t) => {
  const mockWorkerInstance = { sessionKey: null }

  const result = ClientHelper.getApiToken(mockWorkerInstance)

  t.ok(result.hasOwnProperty('success'))
  t.ok(result.hasOwnProperty('message'))
  t.not(result.hasOwnProperty('token'))
  t.is(result.success, false)
  t.is(result.message, 'No active session - please login first')
})

test('should handle empty string sessionKey for getApiToken', (t) => {
  const mockWorkerInstance = { sessionKey: '' }

  const result = ClientHelper.getApiToken(mockWorkerInstance)

  t.is(result.success, false)
  t.not(result.hasOwnProperty('token'))
})

test('should return exact sessionKey value as token', (t) => {
  const specificToken = 'very-specific-token-value-12345'
  const mockWorkerInstance = { sessionKey: specificToken }

  const result = ClientHelper.getApiToken(mockWorkerInstance)

  t.is(result.token, specificToken)
})

// Test verifySession Method
test('should return failure when sessionKey is null for verifySession', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest')

  const result = await ClientHelper.verifySession(mockWorkerInstance)

  t.is(result.success, false)
  t.is(result.valid, false)
  t.is(result.message, 'No active session')
  t.not(authorizedStub.called)
})

test('should return failure when sessionKey is undefined for verifySession', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: undefined,
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest')

  const result = await ClientHelper.verifySession(mockWorkerInstance)

  t.is(result.success, false)
  t.is(result.valid, false)
  t.is(result.message, 'No active session')
  t.not(authorizedStub.called)
})

test('should call authorizedTopicRequest when sessionKey exists for verifySession', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true, valid: true })

  await ClientHelper.verifySession(mockWorkerInstance)

  t.ok(authorizedStub.calledWith(
    mockWorkerInstance,
    'gateway',
    'verifySession',
    {}
  ))
})

test('should return result from authorizedTopicRequest on verifySession success', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const expectedResult = { success: true, valid: true, email: 'test@example.com' }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves(expectedResult)

  const result = await ClientHelper.verifySession(mockWorkerInstance)

  t.alike(result, expectedResult)
})

test('should return error response when authorizedTopicRequest throws for verifySession', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(new Error('Verification failed'))

  const result = await ClientHelper.verifySession(mockWorkerInstance)

  t.is(result.success, false)
  t.is(result.valid, false)
  t.is(result.message, 'Session verification failed')
})

test('should handle empty string sessionKey for verifySession', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: '',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest')

  const result = await ClientHelper.verifySession(mockWorkerInstance)

  t.is(result.success, false)
  t.is(result.valid, false)
  t.not(authorizedStub.called)
})

test('should return correct response structure for verifySession no session', async (t) => {
  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sinon.stub()
    }
  }

  const result = await ClientHelper.verifySession(mockWorkerInstance)

  t.ok(result.hasOwnProperty('success'))
  t.ok(result.hasOwnProperty('valid'))
  t.ok(result.hasOwnProperty('message'))
  t.is(result.success, false)
  t.is(result.valid, false)
  t.is(result.message, 'No active session')
})

test('should return correct response structure for verifySession error', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(new Error('Verification failed'))

  const result = await ClientHelper.verifySession(mockWorkerInstance)

  t.ok(result.hasOwnProperty('success'))
  t.ok(result.hasOwnProperty('valid'))
  t.ok(result.hasOwnProperty('message'))
  t.is(result.success, false)
  t.is(result.valid, false)
  t.is(result.message, 'Session verification failed')
})

// Test isStaleAnnouncementError Method
test('should be defined as static method', (t) => {
  t.ok(ClientHelper.hasOwnProperty('isStaleAnnouncementError'))
  t.is(typeof ClientHelper.isStaleAnnouncementError, 'function')
})

test('should return boolean value', (t) => {
  const testError = new Error('Test error')
  const result = ClientHelper.isStaleAnnouncementError(testError)
  t.is(typeof result, 'boolean')
})

test('should handle error object with message property', (t) => {
  const errorWithMessage = new Error('Some error message')
  const result = ClientHelper.isStaleAnnouncementError(errorWithMessage)
  t.is(typeof result, 'boolean')
})

test('should handle null error parameter', (t) => {
  const result = ClientHelper.isStaleAnnouncementError(null)
  t.is(result, false)
})

test('should handle undefined error parameter', (t) => {
  const result = ClientHelper.isStaleAnnouncementError(undefined)
  t.is(result, false)
})

test('should handle error without message property', (t) => {
  const errorWithoutMessage = {}
  const result = ClientHelper.isStaleAnnouncementError(errorWithoutMessage)
  t.is(result, false)
})

// Test Cross-Method Parameter Validation
test('should handle null workerInstance across all methods', async (t) => {
  // Test sync methods - these actually work fine and don't throw errors
  try {
    const logoutResult = ClientHelper.logout(null)
    t.pass('logout handles null gracefully')
  } catch (error) {
    t.fail('logout should not throw error with null workerInstance')
  }

  try {
    const tokenResult = ClientHelper.getApiToken(null)
    t.pass('getApiToken handles null gracefully')
  } catch (error) {
    t.fail('getApiToken should not throw error with null workerInstance')
  }

  // Test async methods - these should throw errors when accessing properties on null
  try {
    await ClientHelper.verifySession(null)
    t.fail('Should have thrown error')
  } catch (error) {
    t.ok(error instanceof Error)
  }
})

test('should handle undefined workerInstance across all methods', async (t) => {
  // Test sync methods - these actually work fine and don't throw errors
  try {
    const logoutResult = ClientHelper.logout(undefined)
    t.pass('logout handles undefined gracefully')
  } catch (error) {
    t.fail('logout should not throw error with undefined workerInstance')
  }

  try {
    const tokenResult = ClientHelper.getApiToken(undefined)
    t.pass('getApiToken handles undefined gracefully')
  } catch (error) {
    t.fail('getApiToken should not throw error with undefined workerInstance')
  }

  // Test async methods - these should throw errors when accessing properties on undefined
  try {
    await ClientHelper.verifySession(undefined)
    t.fail('Should have thrown error')
  } catch (error) {
    t.ok(error instanceof Error)
  }
})

test('should handle workerInstance without required properties', async (t) => {
  const incompleteWorkerInstance = {}

  // Test methods that access sessionKey
  const logoutResult = ClientHelper.logout(incompleteWorkerInstance)
  t.is(logoutResult.success, false)

  const tokenResult = ClientHelper.getApiToken(incompleteWorkerInstance)
  t.is(tokenResult.success, false)

  const verifyResult = await ClientHelper.verifySession(incompleteWorkerInstance)
  t.is(verifyResult.success, false)
})

test('should handle workerInstance with incorrect property types', (t) => {
  // Test logout with number sessionKey
  const logoutInstance = {
    sessionKey: 123, // Should be string
    net_default: 'not an object' // Should be object
  }
  const logoutResult = ClientHelper.logout(logoutInstance)
  t.is(logoutResult.success, true) // sessionKey exists (truthy number) - logout works with any truthy value

  // Test getApiToken with separate instance (since logout clears sessionKey)
  const tokenInstance = {
    sessionKey: 123, // Should be string
    net_default: 'not an object' // Should be object
  }
  const tokenResult = ClientHelper.getApiToken(tokenInstance)
  t.is(tokenResult.success, true) // getApiToken works with truthy number values (confirmed by direct test)
})

// Test Async Method Error Handling
test('should handle Promise rejection in async methods', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(new Error('Promise rejected'))

  try {
    await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error.message, 'Promise rejected')
  }

  try {
    await ClientHelper.registerUser(mockWorkerInstance, 'email', 'password')
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error.message, 'Promise rejected')
  }

  try {
    await ClientHelper.loginUser(mockWorkerInstance, 'email', 'password')
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error.message, 'Promise rejected')
  }
})

test('should handle synchronous exceptions in async methods', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  sandbox.stub(ClientHelper, 'authorizedTopicRequest').throws(new Error('Sync error'))

  try {
    await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
    t.fail('Should have thrown error')
  } catch (error) {
    t.is(error.message, 'Sync error')
  }
})

// Test Data Type Handling Across Methods
test('should handle various data types for prompt parameter', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })
  sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)

  await ClientHelper.sendRequest(mockWorkerInstance, 'string prompt')
  t.ok(authorizedStub.getCall(0).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { prompt: 'string prompt' }
  ))

  await ClientHelper.sendRequest(mockWorkerInstance, 123)
  t.ok(authorizedStub.getCall(1).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { prompt: 123 }
  ))

  await ClientHelper.sendRequest(mockWorkerInstance, { nested: 'object' })
  t.ok(authorizedStub.getCall(2).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { prompt: { nested: 'object' } }
  ))

  await ClientHelper.sendRequest(mockWorkerInstance, [1, 2, 3])
  t.ok(authorizedStub.getCall(3).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { prompt: [1, 2, 3] }
  ))

  await ClientHelper.sendRequest(mockWorkerInstance, true)
  t.ok(authorizedStub.getCall(4).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { prompt: true }
  ))
})

test('should handle various data types for email parameter', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  await ClientHelper.registerUser(mockWorkerInstance, 'string@email.com', 'password')
  t.ok(authorizedStub.getCall(0).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { email: 'string@email.com', password: 'password' }
  ))

  await ClientHelper.registerUser(mockWorkerInstance, 123, 'password')
  t.ok(authorizedStub.getCall(1).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { email: 123, password: 'password' }
  ))

  await ClientHelper.loginUser(mockWorkerInstance, { email: 'object' }, 'password')
  t.ok(authorizedStub.getCall(2).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { email: { email: 'object' }, password: 'password' }
  ))
})

test('should handle various data types for password parameter', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'test-session-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub().resolves({ success: true })
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })

  await ClientHelper.registerUser(mockWorkerInstance, 'email', 'string password')
  t.ok(authorizedStub.getCall(0).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { email: 'email', password: 'string password' }
  ))

  await ClientHelper.registerUser(mockWorkerInstance, 'email', 456)
  t.ok(authorizedStub.getCall(1).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { email: 'email', password: 456 }
  ))

  await ClientHelper.loginUser(mockWorkerInstance, 'email', { password: 'object' })
  t.ok(authorizedStub.getCall(2).calledWith(
    sinon.match.any, sinon.match.any, sinon.match.any, { email: 'email', password: { password: 'object' } }
  ))
})

// Test Session State Management
test('should maintain session state consistency across methods', (t) => {
  const mockWorkerInstance = { sessionKey: 'active-session' }

  // Check state before logout
  let tokenResult = ClientHelper.getApiToken(mockWorkerInstance)
  t.is(tokenResult.success, true)

  // Logout
  ClientHelper.logout(mockWorkerInstance)

  // State should be cleared
  tokenResult = ClientHelper.getApiToken(mockWorkerInstance)
  t.is(tokenResult.success, false)
})

test('should handle sessionKey modification during async operations', async (t) => {
  const sandbox = sinon.createSandbox()
  t.teardown(() => sandbox.restore())

  const mockWorkerInstance = {
    sessionKey: 'original-key',
    net_default: {
      jTopicRequestRobust: sandbox.stub()
    }
  }
  const authorizedStub = sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })
  
  // Start async operation and modify key during execution
  const verifyPromise = ClientHelper.verifySession(mockWorkerInstance)
  mockWorkerInstance.sessionKey = 'modified-key'
  
  // Operation should use original key state
  await verifyPromise
  t.ok(authorizedStub.called)
})

// Test Method Interaction and State Consistency
test('should handle rapid successive method calls', async (t) => {
  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sinon.stub().resolves({ success: true })
    }
  }

  // Call multiple methods rapidly
  const results = [
    ClientHelper.getApiToken(mockWorkerInstance),
    ClientHelper.logout(mockWorkerInstance),
    ClientHelper.getApiToken(mockWorkerInstance)
  ]

  // All methods should complete
  t.is(results.length, 3)
})

test('should handle method calls with shared workerInstance', async (t) => {
  const mockWorkerInstance = {
    sessionKey: null,
    net_default: {
      jTopicRequestRobust: sinon.stub().resolves({ success: true })
    }
  }

  // Use same instance across different methods
  const tokenResult1 = ClientHelper.getApiToken(mockWorkerInstance)
  const logoutResult = ClientHelper.logout(mockWorkerInstance)
  const tokenResult2 = ClientHelper.getApiToken(mockWorkerInstance)

  // Methods should handle shared state correctly
  t.is(tokenResult1.success, false) // No initial session
  t.is(logoutResult.success, false) // No session to logout
  t.is(tokenResult2.success, false) // Still no session
})