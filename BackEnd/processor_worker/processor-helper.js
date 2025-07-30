'use strict'

// Processor Helper - Contains core processor business logic
// These functions are bound to the main ProcessorWorker instance

const logger = require('../shared-logger.js')

class ProcessorHelper {
  
  // RPC method for processing AI requests
  static async processRequest(workerInstance, data) {
    const requestId = Math.random().toString(36).substr(2, 9)
    logger.rpc('ProcessorWorker', requestId, 'processRequest', 'RECEIVED', {
      hasData: !!data,
      dataType: typeof data
    })
    
    try {
      // Validate input data
      if (!data || typeof data.prompt !== 'string') {
        logger.error('ProcessorWorker', requestId, 'Invalid input data', {
          data: data,
          validationError: 'Expected { prompt: string }'
        })
        throw new Error('Invalid input: expected { prompt: string }')
      }
      
      const userPrompt = data.prompt
      logger.debug('ProcessorWorker', requestId, 'Processing user prompt', {
        promptLength: userPrompt.length,
        promptPreview: userPrompt.length > 50 ? userPrompt.substring(0, 50) + '...' : userPrompt
      })
      
      // Log AI processing start
      logger.prompt('ProcessorWorker', requestId, 'AI_PROCESSING_START', {
        prompt: userPrompt.length > 200 ? userPrompt.substring(0, 200) + '...' : userPrompt,
        promptLength: userPrompt.length,
        model: 'llama3.2'
      })
      
      // Call Llama3 via Ollama with user's prompt
      logger.info('ProcessorWorker', requestId, 'Sending prompt to Llama3', {
        model: 'llama3',
        endpoint: 'http://localhost:11434/api/generate'
      })
      
      // Add timeout and better error handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      let aiResponse
      try {
        const response = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3',
            prompt: userPrompt,
            stream: false
          }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
        }
        
        const ollamaResult = await response.json()
        
        if (!ollamaResult.response) {
          throw new Error('Invalid response from Ollama: missing response field')
        }
        
        aiResponse = ollamaResult.response.trim()
        logger.info('ProcessorWorker', requestId, 'Llama3 response received', {
          responseLength: aiResponse.length,
          model: 'llama3'
        })
      } catch (error) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          throw new Error('Ollama request timeout (30s)')
        } else if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to Ollama - make sure it\'s running on localhost:11434')
        }
        throw error
      }
      
      const result = {
        prompt: userPrompt,
        response: aiResponse,
        processed_at: new Date().toISOString(),
        requestId: requestId
      }
      
      logger.info('ProcessorWorker', requestId, 'Processing completed successfully', {
        responseLength: aiResponse.length,
        promptLength: userPrompt.length
      })
      
      // Log AI processing completion
      logger.prompt('ProcessorWorker', requestId, 'AI_PROCESSING_SUCCESS', {
        model: 'llama3.2',
        responseLength: aiResponse ? aiResponse.length : 0,
        responsePreview: aiResponse ? (aiResponse.length > 200 ? aiResponse.substring(0, 200) + '...' : aiResponse) : 'N/A',
        processingTime: 'N/A' // Could add timing if needed
      })
      
      return result
      
    } catch (error) {
      logger.error('ProcessorWorker', requestId, 'Error processing request', {
        method: 'processRequest',
        error: error.message,
        stack: error.stack,
        hasChannelClosed: error.message.includes('CHANNEL_CLOSED')
      })
      
      // Log AI processing failure
      logger.prompt('ProcessorWorker', requestId, 'AI_PROCESSING_ERROR', {
        model: 'llama3.2',
        error: error.message,
        errorType: error.message.includes('fetch failed') ? 'OLLAMA_CONNECTION' : 
                  error.message.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN'
      })
      
      // Return error in a structured format
      return {
        error: true,
        message: error.message,
        requestId: requestId
      }
    }
  }
}

module.exports = ProcessorHelper 