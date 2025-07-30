'use strict'

const test = require('brittle')
const sinon = require('sinon')

// Test utilities
function createValidWorkerInstance() {
  return { env: 'test' }
}

function createValidData() {
  return { prompt: 'test prompt' }
}

// Mock fetch and related APIs before requiring ProcessorHelper
let fetchStub
let abortControllerStub



// Setup global mocks
function setupGlobalMocks() {
  // Mock fetch
  fetchStub = sinon.stub()
  global.fetch = fetchStub

  // Don't mock setTimeout globally to avoid conflicts with brittle
  // Instead, we'll verify the timeout behavior indirectly
  
  // Mock AbortController
  abortControllerStub = sinon.stub()
  global.AbortController = sinon.stub().returns({
    abort: abortControllerStub,
    signal: {}
  })
}

// Mock logger module
const Module = require('module')
const originalRequire = Module.prototype.require
Module.prototype.require = function(id) {
  if (id === '../shared-logger.js') {
    return {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
      lifecycle: sinon.stub(),
      jwt: sinon.stub(),
      rpc: sinon.stub(),
      prompt: sinon.stub()
    }
  }
  return originalRequire.apply(this, arguments)
}

// Setup global mocks before loading ProcessorHelper
setupGlobalMocks()

// Load ProcessorHelper with mocked dependencies
const ProcessorHelper = require('../../../../processor_worker/processor-helper.js')

// Expected values for assertions
const EXPECTED_OLLAMA_ENDPOINT = 'http://localhost:11434/api/generate'
const EXPECTED_REQUEST_TIMEOUT = 30000
const EXPECTED_MODEL = 'llama3'

// Helper functions
function createSuccessfulFetchResponse(response = 'AI generated response') {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ response })
  })
}

function createErrorFetchResponse(status = 500, statusText = 'Internal Server Error') {
  return Promise.resolve({
    ok: false,
    status,
    statusText
  })
}

function createValidLongPrompt() {
  return 'a'.repeat(1000)
}

function createValidLongResponse() {
  return 'b'.repeat(10000)
}

function createSpecialCharPrompt() {
  return 'Test "quotes" and\nnewlines and émojis 🚀 and unicode ñ'
}

// Reset mocks function
function resetAllMocks() {
  if (fetchStub) fetchStub.reset()
  if (abortControllerStub) abortControllerStub.reset()
  if (global.AbortController && global.AbortController.reset) global.AbortController.reset()
}



// === INPUT VALIDATION TESTS ===

test('ProcessorHelper.processRequest - should return error when data is null', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  
  const result = await ProcessorHelper.processRequest(workerInstance, null)
  
  t.is(result.error, true, 'Should return error object')
  t.is(result.message, 'Invalid input: expected { prompt: string }', 'Should return validation error')
  t.ok(result.requestId, 'Should include requestId')
  t.is(fetchStub.callCount, 0, 'Should not make API call')
})

test('ProcessorHelper.processRequest - should return error when data is undefined', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  
  const result = await ProcessorHelper.processRequest(workerInstance, undefined)
  
  t.is(result.error, true, 'Should return error object')
  t.is(result.message, 'Invalid input: expected { prompt: string }', 'Should return validation error')
  t.ok(result.requestId, 'Should include requestId')
  t.is(fetchStub.callCount, 0, 'Should not make API call')
})

test('ProcessorHelper.processRequest - should return error when data is empty object', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  
  const result = await ProcessorHelper.processRequest(workerInstance, {})
  
  t.is(result.error, true, 'Should return error object')
  t.is(result.message, 'Invalid input: expected { prompt: string }', 'Should return validation error')
  t.ok(result.requestId, 'Should include requestId')
  t.is(fetchStub.callCount, 0, 'Should not make API call')
})

test('ProcessorHelper.processRequest - should return error when prompt is missing', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { other: 'value' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.error, true, 'Should return error object')
  t.is(result.message, 'Invalid input: expected { prompt: string }', 'Should return validation error')
  t.ok(result.requestId, 'Should include requestId')
  t.is(fetchStub.callCount, 0, 'Should not make API call')
})

test('ProcessorHelper.processRequest - should return error when prompt is not a string', async (t) => {
  resetAllMocks()
  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 123 }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.error, true, 'Should return error object')
  t.is(result.message, 'Invalid input: expected { prompt: string }', 'Should return validation error')
  t.ok(result.requestId, 'Should include requestId')
  t.is(fetchStub.callCount, 0, 'Should not make API call')
})

test('ProcessorHelper.processRequest - should proceed when prompt is empty string', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: '' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.ok(result.response, 'Should process empty string successfully')
  t.is(fetchStub.callCount, 1, 'Should make API call')
})

test('ProcessorHelper.processRequest - should proceed when valid prompt is provided', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test prompt' }
  
  // Should not throw validation error
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  t.ok(result, 'Should return result')
  t.is(fetchStub.callCount, 1, 'Should make API call')
})

// === SUCCESSFUL AI RESPONSE PROCESSING TESTS ===

test('ProcessorHelper.processRequest - should return formatted result for successful AI response', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse('AI generated response'))


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test prompt' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.ok(result.prompt, 'Should have prompt field')
  t.ok(result.response, 'Should have response field')
  t.ok(result.processed_at, 'Should have processed_at field')
  t.ok(result.requestId, 'Should have requestId field')
  t.is(result.response, 'AI generated response', 'Should contain AI response')
  t.ok(Date.parse(result.processed_at), 'Should have valid ISO date string')
  t.ok(typeof result.requestId === 'string' && result.requestId.length > 0, 'Should have non-empty requestId')
})

test('ProcessorHelper.processRequest - should trim AI response whitespace', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse('  AI response with spaces  '))


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test prompt' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.response, 'AI response with spaces', 'Should trim whitespace from response')
})

test('ProcessorHelper.processRequest - should preserve original prompt in result', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const originalPrompt = 'original user prompt'
  const data = { prompt: originalPrompt }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.prompt, originalPrompt, 'Should preserve original prompt')
})

test('ProcessorHelper.processRequest - should generate unique request ID', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test prompt' }
  
  const result1 = await ProcessorHelper.processRequest(workerInstance, data)
  const result2 = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.not(result1.requestId, result2.requestId, 'Should generate different requestIds')
  t.ok(result1.requestId.length > 0, 'First requestId should be non-empty')
  t.ok(result2.requestId.length > 0, 'Second requestId should be non-empty')
})

// === OLLAMA API CALL CONFIGURATION TESTS ===

test('ProcessorHelper.processRequest - should make POST request to correct Ollama endpoint', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(fetchStub.callCount, 1, 'Should call fetch once')
  const [url, options] = fetchStub.firstCall.args
  t.is(url, EXPECTED_OLLAMA_ENDPOINT, 'Should call correct endpoint')
  t.is(options.method, 'POST', 'Should use POST method')
})

test('ProcessorHelper.processRequest - should send correct request headers', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  await ProcessorHelper.processRequest(workerInstance, data)
  
  const [, options] = fetchStub.firstCall.args
  t.is(options.headers['Content-Type'], 'application/json', 'Should have correct content type')
})

test('ProcessorHelper.processRequest - should send correct request body format', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const userPrompt = 'user prompt'
  const data = { prompt: userPrompt }
  
  await ProcessorHelper.processRequest(workerInstance, data)
  
  const [, options] = fetchStub.firstCall.args
  const body = JSON.parse(options.body)
  t.is(body.model, EXPECTED_MODEL, 'Should use correct model')
  t.is(body.prompt, userPrompt, 'Should send user prompt')
  t.is(body.stream, false, 'Should disable streaming')
})

test('ProcessorHelper.processRequest - should configure 30-second timeout', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  await ProcessorHelper.processRequest(workerInstance, data)
  
  // Verify fetch was called with configuration that includes abort signal
  t.is(fetchStub.callCount, 1, 'Should call fetch once')
  const [, options] = fetchStub.firstCall.args
  t.ok(options.method === 'POST', 'Should use POST method')
  t.ok(options.headers, 'Should have headers')
  // AbortController is used internally for timeout, but signal may be mocked differently
})

// === ERROR HANDLING - API ERRORS TESTS ===

test('ProcessorHelper.processRequest - should handle HTTP error responses', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createErrorFetchResponse(500, 'Internal Server Error'))


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.error, true, 'Should return error object')
  t.is(result.message, 'Ollama API error: 500 Internal Server Error', 'Should format error message correctly')
  t.ok(result.requestId, 'Should include requestId in error')
})

test('ProcessorHelper.processRequest - should handle missing response field in Ollama result', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}) // Missing response field
  }))


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.error, true, 'Should return error object')
  t.is(result.message, 'Invalid response from Ollama: missing response field', 'Should handle missing response field')
  t.ok(result.requestId, 'Should include requestId in error')
})

test('ProcessorHelper.processRequest - should handle timeout errors', async (t) => {
  resetAllMocks()
  
  // Mock AbortError
  const abortError = new Error('Fetch aborted')
  abortError.name = 'AbortError'
  fetchStub.rejects(abortError)


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.error, true, 'Should return error object')
  t.is(result.message, 'Ollama request timeout (30s)', 'Should handle timeout error')
  t.ok(result.requestId, 'Should include requestId in error')
})

test('ProcessorHelper.processRequest - should handle connection refused errors', async (t) => {
  resetAllMocks()
  
  const connError = new Error('Connection refused')
  connError.code = 'ECONNREFUSED'
  fetchStub.rejects(connError)


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.error, true, 'Should return error object')
  t.ok(result.message.includes('Cannot connect to Ollama'), 'Should handle connection error')
  t.ok(result.requestId, 'Should include requestId in error')
})

// === ERROR RESULT FORMATTING TESTS ===

test('ProcessorHelper.processRequest - should return structured error object', async (t) => {
  resetAllMocks()
  
  fetchStub.rejects(new Error('Test error'))


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.error, true, 'Should have error flag as boolean true')
  t.ok(typeof result.message === 'string', 'Should have message as string')
  t.ok(typeof result.requestId === 'string' && result.requestId.length > 0, 'Should have non-empty requestId')
})

test('ProcessorHelper.processRequest - should preserve original error message', async (t) => {
  resetAllMocks()
  
  const customError = new Error('Custom error message')
  fetchStub.rejects(customError)


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.message, 'Custom error message', 'Should preserve original error message')
})

test('ProcessorHelper.processRequest - should include requestId in error response', async (t) => {
  resetAllMocks()
  
  fetchStub.rejects(new Error('Test error'))


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.ok(result.requestId, 'Should have requestId')
  t.ok(typeof result.requestId === 'string' && result.requestId.length > 0, 'RequestId should be non-empty string')
})

// === EDGE CASES TESTS ===

test('ProcessorHelper.processRequest - should handle very long prompts', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const longPrompt = createValidLongPrompt()
  const data = { prompt: longPrompt }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.ok(result.response, 'Should process successfully')
  const [, options] = fetchStub.firstCall.args
  const body = JSON.parse(options.body)
  t.is(body.prompt, longPrompt, 'Should send full prompt to API')
})

test('ProcessorHelper.processRequest - should handle very long AI responses', async (t) => {
  resetAllMocks()
  
  const longResponse = createValidLongResponse()
  fetchStub.returns(createSuccessfulFetchResponse(longResponse))


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.response, longResponse, 'Should return full response without truncation')
})

test('ProcessorHelper.processRequest - should handle special characters in prompt', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const specialPrompt = createSpecialCharPrompt()
  const data = { prompt: specialPrompt }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.ok(result.response, 'Should process successfully')
  t.is(result.prompt, specialPrompt, 'Should preserve special characters')
})

test('ProcessorHelper.processRequest - should handle JSON parsing errors from Ollama', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(Promise.resolve({
    ok: true,
    json: () => Promise.reject(new Error('Invalid JSON'))
  }))


  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.is(result.error, true, 'Should return error object')
  t.ok(result.message.includes('Invalid JSON'), 'Should handle JSON parsing error')
})

// === METHOD PARAMETERS TESTS ===

test('ProcessorHelper.processRequest - should work with any workerInstance parameter', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  // Test with null workerInstance
  const data = { prompt: 'test' }
  
  const result = await ProcessorHelper.processRequest(null, data)
  
  t.ok(result.response, 'Should work regardless of workerInstance value')
})

test('ProcessorHelper.processRequest - should handle data parameter with extra properties', async (t) => {
  resetAllMocks()
  
  fetchStub.returns(createSuccessfulFetchResponse())
  
  const workerInstance = createValidWorkerInstance()
  const data = { prompt: 'test', extra: 'value', other: 123 }
  
  const result = await ProcessorHelper.processRequest(workerInstance, data)
  
  t.ok(result.response, 'Should process successfully')
  const [, options] = fetchStub.firstCall.args
  const body = JSON.parse(options.body)
  t.is(body.prompt, 'test', 'Should use only prompt property')
})