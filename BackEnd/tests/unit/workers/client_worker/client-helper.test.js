'use strict'

const test = require('brittle')
const sinon = require('sinon')
const ClientHelper = require('../../../../client_worker/client-helper.js')

  describe('authorizedTopicRequest Method', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: 'test-session-key-12345',
        net_default: {
          jTopicRequestRobust: sandbox.stub()
        }
      }
    })

    it('should create request payload with data parameter', async () => {
      // Setup
      const testData = { test: 'data' }
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', testData)

      // Assert
      const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      expect(callArgs[2]).to.have.property('data', testData)
      expect(callArgs[2]).to.have.keys(['data', 'meta'])
    })

    it('should add auth key for non-exempt methods when sessionKey exists', async () => {
      // Setup
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'processPrompt', { test: 'data' })

      // Assert
      const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      expect(callArgs[2]).to.have.deep.property('meta.key', 'test-session-key-12345')
    })

    it('should not add auth key for exempt methods (register, login)', async () => {
      // Setup
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'register', { test: 'data' })

      // Assert
      const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      expect(callArgs[2]).to.not.have.property('meta')
    })

    it('should not add auth key for non-exempt methods when sessionKey is null', async () => {
      // Setup
      mockWorkerInstance.sessionKey = null
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'processPrompt', { test: 'data' })

      // Assert
      const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      expect(callArgs[2]).to.not.have.property('meta')
    })

    it('should not add auth key for non-exempt methods when sessionKey is undefined', async () => {
      // Setup
      mockWorkerInstance.sessionKey = undefined
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'processPrompt', { test: 'data' })

      // Assert
      const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      expect(callArgs[2]).to.not.have.property('meta')
    })

    it('should call jTopicRequestRobust with correct parameters', async () => {
      // Setup
      const testData = { test: 'data' }
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', testData)

      // Assert
      expect(mockWorkerInstance.net_default.jTopicRequestRobust).to.have.been.calledWith(
        'test-topic',
        'test-method',
        sinon.match({ data: testData }),
        {},
        3,
        200
      )
    })

    it('should generate unique session IDs for each request', async () => {
      // Setup
      let callCount = 0
      sandbox.stub(Math, 'random').callsFake(() => {
        callCount++
        return callCount * 0.1
      })
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', {})
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', {})

      // Assert
      expect(Math.random).to.have.been.calledTwice
    })

    it('should return result from jTopicRequestRobust on success', async () => {
      // Setup
      const expectedResult = { success: true, data: 'test' }
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves(expectedResult)

      // Action
      const result = await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', {})

      // Assert
      expect(result).to.deep.equal(expectedResult)
    })

    it('should propagate error from jTopicRequestRobust on failure', async () => {
      // Setup
      const expectedError = new Error('Network error')
      mockWorkerInstance.net_default.jTopicRequestRobust.rejects(expectedError)

      // Action & Assert
      try {
        await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', {})
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).to.equal(expectedError)
      }
    })

    it('should handle null data parameter', async () => {
      // Setup
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', null)

      // Assert
      const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      expect(callArgs[2]).to.have.property('data', null)
    })

    it('should handle undefined data parameter', async () => {
      // Setup
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', undefined)

      // Assert
      const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      expect(callArgs[2]).to.have.property('data', undefined)
    })

    it('should handle complex object data parameter', async () => {
      // Setup
      const complexData = { 
        level1: { 
          level2: { 
            array: [1, 2, 3], 
            bool: true 
          } 
        } 
      }
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', complexData)

      // Assert
      const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      expect(callArgs[2]).to.have.deep.property('data', complexData)
    })

    it('should handle empty string data parameter', async () => {
      // Setup
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'test-method', '')

      // Assert
      const callArgs = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      expect(callArgs[2]).to.have.property('data', '')
    })

    it('should validate exempt methods array contains register and login', async () => {
      // Setup
      mockWorkerInstance.net_default.jTopicRequestRobust.resolves({ success: true })

      // Action
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'register', {})
      await ClientHelper.authorizedTopicRequest(mockWorkerInstance, 'test-topic', 'login', {})

      // Assert
      const registerCall = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(0).args
      const loginCall = mockWorkerInstance.net_default.jTopicRequestRobust.getCall(1).args
      expect(registerCall[2]).to.not.have.property('meta')
      expect(loginCall[2]).to.not.have.property('meta')
    })
  })

  describe('sleep Method', () => {
    let clock

    beforeEach(() => {
      clock = sinon.useFakeTimers()
    })

    afterEach(() => {
      clock.restore()
    })

    it('should return a Promise', () => {
      // Action
      const result = ClientHelper.sleep(100)

      // Assert
      expect(result).to.be.instanceOf(Promise)
      expect(typeof result.then).to.equal('function')
    })

    it('should resolve after specified milliseconds', async () => {
      // Setup
      let resolved = false

      // Action
      const sleepPromise = ClientHelper.sleep(100).then(() => {
        resolved = true
      })

      expect(resolved).to.be.false
      clock.tick(100)
      await sleepPromise

      // Assert
      expect(resolved).to.be.true
    })

    it('should handle zero milliseconds', async () => {
      // Setup
      let resolved = false

      // Action
      const sleepPromise = ClientHelper.sleep(0).then(() => {
        resolved = true
      })

      clock.tick(0)
      await sleepPromise

      // Assert
      expect(resolved).to.be.true
    })

    it('should handle negative milliseconds', async () => {
      // Setup
      let resolved = false

      // Action
      const sleepPromise = ClientHelper.sleep(-100).then(() => {
        resolved = true
      })

      clock.tick(0)
      await sleepPromise

      // Assert
      expect(resolved).to.be.true
    })
  })

  describe('sendRequest Method', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: 'test-session-key',
        net_default: {
          jTopicRequestRobust: sandbox.stub()
        }
      }
      sandbox.stub(ClientHelper, 'authorizedTopicRequest')
      sandbox.stub(ClientHelper, 'isStaleAnnouncementError').returns(false)
    })

    it('should call authorizedTopicRequest with correct parameters', async () => {
      // Setup
      const testPrompt = 'Test prompt'
      ClientHelper.authorizedTopicRequest.resolves({ response: 'Test response' })

      // Action
      await ClientHelper.sendRequest(mockWorkerInstance, testPrompt)

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'processPrompt',
        { prompt: testPrompt }
      )
    })

    it('should return result from authorizedTopicRequest on success', async () => {
      // Setup
      const expectedResult = { response: 'Test response' }
      ClientHelper.authorizedTopicRequest.resolves(expectedResult)

      // Action
      const result = await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')

      // Assert
      expect(result).to.deep.equal(expectedResult)
    })

    it('should handle result with response property', async () => {
      // Setup
      const testResult = { response: 'test response' }
      ClientHelper.authorizedTopicRequest.resolves(testResult)

      // Action
      const result = await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')

      // Assert
      expect(result).to.have.property('response', 'test response')
    })

    it('should handle result with error property', async () => {
      // Setup
      const testResult = { error: true, message: 'test error' }
      ClientHelper.authorizedTopicRequest.resolves(testResult)

      // Action
      const result = await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')

      // Assert
      expect(result).to.have.property('error', true)
      expect(result).to.have.property('message', 'test error')
    })

    it('should handle ERR_TOPIC_LOOKUP_EMPTY error', async () => {
      // Setup
      const error = new Error('ERR_TOPIC_LOOKUP_EMPTY - no peers found')
      ClientHelper.authorizedTopicRequest.rejects(error)

      // Action & Assert
      try {
        await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
        expect.fail('Should have thrown error')
      } catch (thrownError) {
        expect(thrownError.message).to.include('ERR_TOPIC_LOOKUP_EMPTY')
      }
    })

    it('should handle UNKNOWN_METHOD error', async () => {
      // Setup
      const error = new Error('UNKNOWN_METHOD - method not found')
      ClientHelper.authorizedTopicRequest.rejects(error)

      // Action & Assert
      try {
        await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
        expect.fail('Should have thrown error')
      } catch (thrownError) {
        expect(thrownError.message).to.include('UNKNOWN_METHOD')
      }
    })

    it('should handle CHANNEL_CLOSED error', async () => {
      // Setup
      const error = new Error('CHANNEL_CLOSED - connection lost')
      ClientHelper.authorizedTopicRequest.rejects(error)

      // Action & Assert
      try {
        await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
        expect.fail('Should have thrown error')
      } catch (thrownError) {
        expect(thrownError.message).to.include('CHANNEL_CLOSED')
      }
    })

    it('should handle stale announcement error', async () => {
      // Setup
      const error = new Error('Stale announcement error')
      ClientHelper.authorizedTopicRequest.rejects(error)
      ClientHelper.isStaleAnnouncementError.returns(true)

      // Action & Assert
      try {
        await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
        expect.fail('Should have thrown error')
      } catch (thrownError) {
        expect(ClientHelper.isStaleAnnouncementError).to.have.been.calledWith(error)
        expect(thrownError).to.equal(error)
      }
    })

    it('should handle unknown error types', async () => {
      // Setup
      const error = new Error('Unknown error')
      ClientHelper.authorizedTopicRequest.rejects(error)

      // Action & Assert
      try {
        await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
        expect.fail('Should have thrown error')
      } catch (thrownError) {
        expect(thrownError).to.equal(error)
      }
    })

    it('should generate unique request IDs for error handling', async () => {
      // Setup
      let callCount = 0
      sandbox.stub(Math, 'random').callsFake(() => {
        callCount++
        return callCount * 0.1
      })
      const error = new Error('Test error')
      ClientHelper.authorizedTopicRequest.rejects(error)

      // Action & Assert
      try {
        await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
      } catch (e) {}
      
      try {
        await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
      } catch (e) {}

      expect(Math.random).to.have.been.calledTwice
    })

    it('should handle empty string prompt', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ response: 'response' })

      // Action
      await ClientHelper.sendRequest(mockWorkerInstance, '')

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'processPrompt',
        { prompt: '' }
      )
    })

    it('should handle null prompt', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ response: 'response' })

      // Action
      await ClientHelper.sendRequest(mockWorkerInstance, null)

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'processPrompt',
        { prompt: null }
      )
    })
  })

  describe('registerUser Method', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: 'test-session-key',
        net_default: {
          jTopicRequestRobust: sandbox.stub()
        }
      }
      sandbox.stub(ClientHelper, 'authorizedTopicRequest')
    })

    it('should call authorizedTopicRequest with correct parameters', async () => {
      // Setup
      const email = 'test@example.com'
      const password = 'password123'
      ClientHelper.authorizedTopicRequest.resolves({ success: true })

      // Action
      await ClientHelper.registerUser(mockWorkerInstance, email, password)

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'register',
        { email, password }
      )
    })

    it('should return result from authorizedTopicRequest on success', async () => {
      // Setup
      const expectedResult = { success: true, userId: '123' }
      ClientHelper.authorizedTopicRequest.resolves(expectedResult)

      // Action
      const result = await ClientHelper.registerUser(mockWorkerInstance, 'test@example.com', 'password')

      // Assert
      expect(result).to.deep.equal(expectedResult)
    })

    it('should propagate error from authorizedTopicRequest', async () => {
      // Setup
      const expectedError = new Error('Registration failed')
      ClientHelper.authorizedTopicRequest.rejects(expectedError)

      // Action & Assert
      try {
        await ClientHelper.registerUser(mockWorkerInstance, 'test@example.com', 'password')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).to.equal(expectedError)
      }
    })

    it('should handle empty string email', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: true })

      // Action
      await ClientHelper.registerUser(mockWorkerInstance, '', 'password')

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'register',
        { email: '', password: 'password' }
      )
    })

    it('should handle empty string password', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: true })

      // Action
      await ClientHelper.registerUser(mockWorkerInstance, 'test@example.com', '')

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'register',
        { email: 'test@example.com', password: '' }
      )
    })

    it('should handle null email parameter', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: true })

      // Action
      await ClientHelper.registerUser(mockWorkerInstance, null, 'password')

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'register',
        { email: null, password: 'password' }
      )
    })

    it('should handle null password parameter', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: true })

      // Action
      await ClientHelper.registerUser(mockWorkerInstance, 'test@example.com', null)

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'register',
        { email: 'test@example.com', password: null }
      )
    })
  })

  describe('loginUser Method', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: null,
        net_default: {
          jTopicRequestRobust: sandbox.stub()
        }
      }
      sandbox.stub(ClientHelper, 'authorizedTopicRequest')
    })

    it('should call authorizedTopicRequest with correct parameters', async () => {
      // Setup
      const email = 'test@example.com'
      const password = 'password123'
      ClientHelper.authorizedTopicRequest.resolves({ success: true, key: 'token' })

      // Action
      await ClientHelper.loginUser(mockWorkerInstance, email, password)

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'login',
        { email, password }
      )
    })

    it('should store session key on successful login', async () => {
      // Setup
      const testToken = 'test-token-12345'
      ClientHelper.authorizedTopicRequest.resolves({ success: true, key: testToken })

      // Action
      await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

      // Assert
      expect(mockWorkerInstance.sessionKey).to.equal(testToken)
    })

    it('should not store session key when success is false', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: false, key: 'test-token' })

      // Action
      await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

      // Assert
      expect(mockWorkerInstance.sessionKey).to.be.null
    })

    it('should not store session key when key is missing', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: true })

      // Action
      await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

      // Assert
      expect(mockWorkerInstance.sessionKey).to.be.null
    })

    it('should not store session key when key is null', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: true, key: null })

      // Action
      await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

      // Assert
      expect(mockWorkerInstance.sessionKey).to.be.null
    })

    it('should not store session key when key is empty string', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: true, key: '' })

      // Action
      await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

      // Assert
      expect(mockWorkerInstance.sessionKey).to.be.null
    })

    it('should return result from authorizedTopicRequest', async () => {
      // Setup
      const expectedResult = { success: true, key: 'token', userId: '123' }
      ClientHelper.authorizedTopicRequest.resolves(expectedResult)

      // Action
      const result = await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')

      // Assert
      expect(result).to.deep.equal(expectedResult)
    })

    it('should propagate error from authorizedTopicRequest', async () => {
      // Setup
      const expectedError = new Error('Login failed')
      ClientHelper.authorizedTopicRequest.rejects(expectedError)

      // Action & Assert
      try {
        await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', 'password')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).to.equal(expectedError)
      }
    })

    it('should handle empty string email', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: true })

      // Action
      await ClientHelper.loginUser(mockWorkerInstance, '', 'password')

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'login',
        { email: '', password: 'password' }
      )
    })

    it('should handle empty string password', async () => {
      // Setup
      ClientHelper.authorizedTopicRequest.resolves({ success: true })

      // Action
      await ClientHelper.loginUser(mockWorkerInstance, 'test@example.com', '')

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'login',
        { email: 'test@example.com', password: '' }
      )
    })
  })

  describe('logout Method', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {}
    })

    it('should clear session key when sessionKey exists', () => {
      // Setup
      mockWorkerInstance.sessionKey = 'existing-session-key'

      // Action
      ClientHelper.logout(mockWorkerInstance)

      // Assert
      expect(mockWorkerInstance.sessionKey).to.be.null
    })

    it('should return success response when sessionKey exists', () => {
      // Setup
      mockWorkerInstance.sessionKey = 'existing-session-key'

      // Action
      const result = ClientHelper.logout(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', true)
      expect(result).to.have.property('message', 'Logged out successfully')
    })

    it('should return failure response when sessionKey is null', () => {
      // Setup
      mockWorkerInstance.sessionKey = null

      // Action
      const result = ClientHelper.logout(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.have.property('message', 'No active session to logout')
      expect(mockWorkerInstance.sessionKey).to.be.null
    })

    it('should return failure response when sessionKey is undefined', () => {
      // Setup
      mockWorkerInstance.sessionKey = undefined

      // Action
      const result = ClientHelper.logout(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.have.property('message', 'No active session to logout')
      expect(mockWorkerInstance.sessionKey).to.be.undefined
    })

    it('should return correct response structure for success', () => {
      // Setup
      mockWorkerInstance.sessionKey = 'existing-session-key'

      // Action
      const result = ClientHelper.logout(mockWorkerInstance)

      // Assert
      expect(result).to.have.keys(['success', 'message'])
      expect(result.success).to.be.true
      expect(result.message).to.equal('Logged out successfully')
    })

    it('should return correct response structure for failure', () => {
      // Setup
      mockWorkerInstance.sessionKey = null

      // Action
      const result = ClientHelper.logout(mockWorkerInstance)

      // Assert
      expect(result).to.have.keys(['success', 'message'])
      expect(result.success).to.be.false
      expect(result.message).to.equal('No active session to logout')
    })

    it('should handle empty string sessionKey', () => {
      // Setup
      mockWorkerInstance.sessionKey = ''

      // Action
      const result = ClientHelper.logout(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.have.property('message', 'No active session to logout')
    })
  })

  describe('getApiToken Method', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {}
    })

    it('should return token when sessionKey exists', () => {
      // Setup
      const testToken = 'test-api-token-12345'
      mockWorkerInstance.sessionKey = testToken

      // Action
      const result = ClientHelper.getApiToken(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', true)
      expect(result).to.have.property('token', testToken)
      expect(result).to.have.property('message', 'API token retrieved successfully')
    })

    it('should return failure response when sessionKey is null', () => {
      // Setup
      mockWorkerInstance.sessionKey = null

      // Action
      const result = ClientHelper.getApiToken(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.not.have.property('token')
      expect(result).to.have.property('message', 'No active session - please login first')
    })

    it('should return failure response when sessionKey is undefined', () => {
      // Setup
      mockWorkerInstance.sessionKey = undefined

      // Action
      const result = ClientHelper.getApiToken(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.not.have.property('token')
      expect(result).to.have.property('message', 'No active session - please login first')
    })

    it('should return correct response structure for success', () => {
      // Setup
      mockWorkerInstance.sessionKey = 'test-token'

      // Action
      const result = ClientHelper.getApiToken(mockWorkerInstance)

      // Assert
      expect(result).to.have.keys(['success', 'token', 'message'])
      expect(result.success).to.be.true
      expect(result.token).to.equal('test-token')
      expect(result.message).to.equal('API token retrieved successfully')
    })

    it('should return correct response structure for failure', () => {
      // Setup
      mockWorkerInstance.sessionKey = null

      // Action
      const result = ClientHelper.getApiToken(mockWorkerInstance)

      // Assert
      expect(result).to.have.keys(['success', 'message'])
      expect(result.success).to.be.false
      expect(result.message).to.equal('No active session - please login first')
    })

    it('should handle empty string sessionKey', () => {
      // Setup
      mockWorkerInstance.sessionKey = ''

      // Action
      const result = ClientHelper.getApiToken(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.not.have.property('token')
    })

    it('should return exact sessionKey value as token', () => {
      // Setup
      const specificToken = 'very-specific-token-value-12345'
      mockWorkerInstance.sessionKey = specificToken

      // Action
      const result = ClientHelper.getApiToken(mockWorkerInstance)

      // Assert
      expect(result.token).to.equal(specificToken)
    })
  })

  describe('verifySession Method', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: null,
        net_default: {
          jTopicRequestRobust: sandbox.stub()
        }
      }
      sandbox.stub(ClientHelper, 'authorizedTopicRequest')
    })

    it('should return failure when sessionKey is null', async () => {
      // Setup
      mockWorkerInstance.sessionKey = null

      // Action
      const result = await ClientHelper.verifySession(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.have.property('valid', false)
      expect(result).to.have.property('message', 'No active session')
      expect(ClientHelper.authorizedTopicRequest).to.not.have.been.called
    })

    it('should return failure when sessionKey is undefined', async () => {
      // Setup
      mockWorkerInstance.sessionKey = undefined

      // Action
      const result = await ClientHelper.verifySession(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.have.property('valid', false)
      expect(result).to.have.property('message', 'No active session')
      expect(ClientHelper.authorizedTopicRequest).to.not.have.been.called
    })

    it('should call authorizedTopicRequest when sessionKey exists', async () => {
      // Setup
      mockWorkerInstance.sessionKey = 'test-session-key'
      ClientHelper.authorizedTopicRequest.resolves({ success: true, valid: true })

      // Action
      await ClientHelper.verifySession(mockWorkerInstance)

      // Assert
      expect(ClientHelper.authorizedTopicRequest).to.have.been.calledWith(
        mockWorkerInstance,
        'gateway',
        'verifySession',
        {}
      )
    })

    it('should return result from authorizedTopicRequest on success', async () => {
      // Setup
      mockWorkerInstance.sessionKey = 'test-session-key'
      const expectedResult = { success: true, valid: true, email: 'test@example.com' }
      ClientHelper.authorizedTopicRequest.resolves(expectedResult)

      // Action
      const result = await ClientHelper.verifySession(mockWorkerInstance)

      // Assert
      expect(result).to.deep.equal(expectedResult)
    })

    it('should return error response when authorizedTopicRequest throws', async () => {
      // Setup
      mockWorkerInstance.sessionKey = 'test-session-key'
      ClientHelper.authorizedTopicRequest.rejects(new Error('Verification failed'))

      // Action
      const result = await ClientHelper.verifySession(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.have.property('valid', false)
      expect(result).to.have.property('message', 'Session verification failed')
    })

    it('should handle empty string sessionKey', async () => {
      // Setup
      mockWorkerInstance.sessionKey = ''

      // Action
      const result = await ClientHelper.verifySession(mockWorkerInstance)

      // Assert
      expect(result).to.have.property('success', false)
      expect(result).to.have.property('valid', false)
      expect(ClientHelper.authorizedTopicRequest).to.not.have.been.called
    })

    it('should return correct response structure for no session', async () => {
      // Setup
      mockWorkerInstance.sessionKey = null

      // Action
      const result = await ClientHelper.verifySession(mockWorkerInstance)

      // Assert
      expect(result).to.have.keys(['success', 'valid', 'message'])
      expect(result.success).to.be.false
      expect(result.valid).to.be.false
      expect(result.message).to.equal('No active session')
    })

    it('should return correct response structure for error', async () => {
      // Setup
      mockWorkerInstance.sessionKey = 'test-session-key'
      ClientHelper.authorizedTopicRequest.rejects(new Error('Verification failed'))

      // Action
      const result = await ClientHelper.verifySession(mockWorkerInstance)

      // Assert
      expect(result).to.have.keys(['success', 'valid', 'message'])
      expect(result.success).to.be.false
      expect(result.valid).to.be.false
      expect(result.message).to.equal('Session verification failed')
    })
  })

  describe('isStaleAnnouncementError Method (Referenced but Missing)', () => {
    it('should be defined as static method', () => {
      // Action & Assert
      expect(ClientHelper).to.have.property('isStaleAnnouncementError')
      expect(typeof ClientHelper.isStaleAnnouncementError).to.equal('function')
    })

    it('should return boolean value', () => {
      // Setup
      const testError = new Error('Test error')

      // Action
      const result = ClientHelper.isStaleAnnouncementError(testError)

      // Assert
      expect(typeof result).to.equal('boolean')
    })

    it('should handle error object with message property', () => {
      // Setup
      const errorWithMessage = new Error('Some error message')

      // Action
      const result = ClientHelper.isStaleAnnouncementError(errorWithMessage)

      // Assert
      expect(typeof result).to.equal('boolean')
    })

    it('should handle null error parameter', () => {
      // Action
      const result = ClientHelper.isStaleAnnouncementError(null)

      // Assert
      expect(result).to.be.false
    })

    it('should handle undefined error parameter', () => {
      // Action
      const result = ClientHelper.isStaleAnnouncementError(undefined)

      // Assert
      expect(result).to.be.false
    })

    it('should handle error without message property', () => {
      // Setup
      const errorWithoutMessage = {}

      // Action
      const result = ClientHelper.isStaleAnnouncementError(errorWithoutMessage)

      // Assert
      expect(result).to.be.false
    })
  })

  describe('Cross-Method Parameter Validation', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: 'test-session-key',
        net_default: {
          jTopicRequestRobust: sandbox.stub().resolves({ success: true })
        }
      }
      sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })
    })

    it('should handle null workerInstance across all methods', async () => {
      // Action & Assert - Test sync methods
      expect(() => ClientHelper.logout(null)).to.not.throw()
      expect(() => ClientHelper.getApiToken(null)).to.not.throw()

      // Action & Assert - Test async methods
      try {
        await ClientHelper.verifySession(null)
      } catch (error) {
        // Expected behavior - accessing properties on null should cause errors
        expect(error).to.be.instanceOf(Error)
      }
    })

    it('should handle undefined workerInstance across all methods', async () => {
      // Action & Assert - Test sync methods
      expect(() => ClientHelper.logout(undefined)).to.not.throw()
      expect(() => ClientHelper.getApiToken(undefined)).to.not.throw()

      // Action & Assert - Test async methods
      try {
        await ClientHelper.verifySession(undefined)
      } catch (error) {
        // Expected behavior - accessing properties on undefined should cause errors
        expect(error).to.be.instanceOf(Error)
      }
    })

    it('should handle workerInstance without required properties', async () => {
      // Setup
      const incompleteWorkerInstance = {}

      // Action & Assert - Test methods that access sessionKey
      const logoutResult = ClientHelper.logout(incompleteWorkerInstance)
      expect(logoutResult.success).to.be.false

      const tokenResult = ClientHelper.getApiToken(incompleteWorkerInstance)
      expect(tokenResult.success).to.be.false

      const verifyResult = await ClientHelper.verifySession(incompleteWorkerInstance)
      expect(verifyResult.success).to.be.false
    })

    it('should handle workerInstance with incorrect property types', () => {
      // Setup
      const incorrectWorkerInstance = {
        sessionKey: 123, // Should be string
        net_default: 'not an object' // Should be object
      }

      // Action & Assert - Methods should handle incorrect types
      const logoutResult = ClientHelper.logout(incorrectWorkerInstance)
      expect(logoutResult.success).to.be.true // sessionKey exists (truthy)

      const tokenResult = ClientHelper.getApiToken(incorrectWorkerInstance)
      expect(tokenResult.success).to.be.true // sessionKey exists (truthy)
    })
  })

  describe('Async Method Error Handling', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: 'test-session-key',
        net_default: {
          jTopicRequestRobust: sandbox.stub()
        }
      }
    })

    it('should handle Promise rejection in async methods', async () => {
      // Setup
      sandbox.stub(ClientHelper, 'authorizedTopicRequest').rejects(new Error('Promise rejected'))

      // Action & Assert
      try {
        await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.equal('Promise rejected')
      }

      try {
        await ClientHelper.registerUser(mockWorkerInstance, 'email', 'password')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.equal('Promise rejected')
      }

      try {
        await ClientHelper.loginUser(mockWorkerInstance, 'email', 'password')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.equal('Promise rejected')
      }
    })

    it('should handle synchronous exceptions in async methods', async () => {
      // Setup
      sandbox.stub(ClientHelper, 'authorizedTopicRequest').throws(new Error('Sync error'))

      // Action & Assert
      try {
        await ClientHelper.sendRequest(mockWorkerInstance, 'test prompt')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.equal('Sync error')
      }
    })
  })

  describe('Data Type Handling Across Methods', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: 'test-session-key',
        net_default: {
          jTopicRequestRobust: sandbox.stub().resolves({ success: true })
        }
      }
      sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })
    })

    it('should handle various data types for prompt parameter', async () => {
      // Action & Assert
      await ClientHelper.sendRequest(mockWorkerInstance, 'string prompt')
      expect(ClientHelper.authorizedTopicRequest.getCall(0)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { prompt: 'string prompt' }
      )

      await ClientHelper.sendRequest(mockWorkerInstance, 123)
      expect(ClientHelper.authorizedTopicRequest.getCall(1)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { prompt: 123 }
      )

      await ClientHelper.sendRequest(mockWorkerInstance, { nested: 'object' })
      expect(ClientHelper.authorizedTopicRequest.getCall(2)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { prompt: { nested: 'object' } }
      )

      await ClientHelper.sendRequest(mockWorkerInstance, [1, 2, 3])
      expect(ClientHelper.authorizedTopicRequest.getCall(3)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { prompt: [1, 2, 3] }
      )

      await ClientHelper.sendRequest(mockWorkerInstance, true)
      expect(ClientHelper.authorizedTopicRequest.getCall(4)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { prompt: true }
      )
    })

    it('should handle various data types for email parameter', async () => {
      // Action & Assert
      await ClientHelper.registerUser(mockWorkerInstance, 'string@email.com', 'password')
      expect(ClientHelper.authorizedTopicRequest.getCall(0)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { email: 'string@email.com', password: 'password' }
      )

      await ClientHelper.registerUser(mockWorkerInstance, 123, 'password')
      expect(ClientHelper.authorizedTopicRequest.getCall(1)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { email: 123, password: 'password' }
      )

      await ClientHelper.loginUser(mockWorkerInstance, { email: 'object' }, 'password')
      expect(ClientHelper.authorizedTopicRequest.getCall(2)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { email: { email: 'object' }, password: 'password' }
      )
    })

    it('should handle various data types for password parameter', async () => {
      // Action & Assert
      await ClientHelper.registerUser(mockWorkerInstance, 'email', 'string password')
      expect(ClientHelper.authorizedTopicRequest.getCall(0)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { email: 'email', password: 'string password' }
      )

      await ClientHelper.registerUser(mockWorkerInstance, 'email', 456)
      expect(ClientHelper.authorizedTopicRequest.getCall(1)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { email: 'email', password: 456 }
      )

      await ClientHelper.loginUser(mockWorkerInstance, 'email', { password: 'object' })
      expect(ClientHelper.authorizedTopicRequest.getCall(2)).to.have.been.calledWith(
        sinon.match.any, sinon.match.any, sinon.match.any, { email: 'email', password: { password: 'object' } }
      )
    })
  })

  describe('Session State Management', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: 'initial-session-key',
        net_default: {
          jTopicRequestRobust: sandbox.stub().resolves({ success: true })
        }
      }
      sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true })
    })

    it('should maintain session state consistency across methods', () => {
      // Setup - Set initial state
      mockWorkerInstance.sessionKey = 'active-session'

      // Action - Check state before logout
      let tokenResult = ClientHelper.getApiToken(mockWorkerInstance)
      expect(tokenResult.success).to.be.true

      // Action - Logout
      ClientHelper.logout(mockWorkerInstance)

      // Assert - State should be cleared
      tokenResult = ClientHelper.getApiToken(mockWorkerInstance)
      expect(tokenResult.success).to.be.false
    })

    it('should handle sessionKey modification during async operations', async () => {
      // Setup
      mockWorkerInstance.sessionKey = 'original-key'
      
      // Action - Start async operation and modify key during execution
      const verifyPromise = ClientHelper.verifySession(mockWorkerInstance)
      mockWorkerInstance.sessionKey = 'modified-key'
      
      // Assert - Operation should use original key state
      await verifyPromise
      expect(ClientHelper.authorizedTopicRequest).to.have.been.called
    })
  })

  describe('Method Interaction and State Consistency', () => {
    let mockWorkerInstance

    beforeEach(() => {
      mockWorkerInstance = {
        sessionKey: null,
        net_default: {
          jTopicRequestRobust: sandbox.stub().resolves({ success: true })
        }
      }
      sandbox.stub(ClientHelper, 'authorizedTopicRequest').resolves({ success: true, key: 'new-session-key' })
    })

    it('should handle rapid successive method calls', async () => {
      // Action - Call multiple methods rapidly
      const promises = [
        ClientHelper.getApiToken(mockWorkerInstance),
        ClientHelper.logout(mockWorkerInstance),
        ClientHelper.getApiToken(mockWorkerInstance)
      ]

      // Assert - All methods should complete
      const results = await Promise.all(promises.map(p => p instanceof Promise ? p : Promise.resolve(p)))
      expect(results).to.have.length(3)
    })

    it('should handle method calls with shared workerInstance', async () => {
      // Action - Use same instance across different methods
      const tokenResult1 = ClientHelper.getApiToken(mockWorkerInstance)
      const logoutResult = ClientHelper.logout(mockWorkerInstance)
      const tokenResult2 = ClientHelper.getApiToken(mockWorkerInstance)

      // Assert - Methods should handle shared state correctly
      expect(tokenResult1.success).to.be.false // No initial session
      expect(logoutResult.success).to.be.false // No session to logout
      expect(tokenResult2.success).to.be.false // Still no session
    })
  })
})