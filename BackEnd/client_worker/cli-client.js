'use strict'

const ClientWorker = require('./client-worker.js')
const readline = require('readline')
const logger = require('../shared-logger.js')

// Create worker instance
const conf = {
  env: 'development',
  root: process.cwd()
}

const ctx = {
  wtype: 'client-worker',
  env: 'dev',
  root: process.cwd()
}

console.log('🚀 Starting CLI Client...')

logger.lifecycle('CLIClient', 'STARTING', { interface: 'command_line' })

try {
  const worker = new ClientWorker(conf, ctx)
  
  // Start the worker
  worker.start((err) => {
    if (err) {
      logger.error('CLIClient', 'STARTUP', 'Failed to start Client Worker', {
        error: err.message,
        stack: err.stack
      })
      console.error('❌ Failed to start Client Worker:', err)
      process.exit(1)
    }
    
    logger.lifecycle('CLIClient', 'STARTED', { ready: true })
    
    console.log('💡 Available commands:')
    console.log('💡   • Type any prompt to send to the AI model')
    console.log('💡   • Type "register <email> <password>" to register a new user')
    console.log('💡   • Type "login <email> <password>" to login a user')
    console.log('💡   • Type "logout" to clear session and logout')
    console.log('💡   • Type "settoken <token>" to set API token manually')
    console.log('💡   • Type "gettoken" to get current API token')
    console.log('💡   • Type "status" to show authentication status')
    console.log('💡   • Type "help" to see all commands')
    console.log('💡   • Type "exit" to quit')
    console.log('🌐   Get API tokens from web UI: http://localhost:3001')
    
    // Setup input handling after worker is ready
    setupInputHandling(worker)
  })
  
  // Function to set up input handling after worker is ready
  function setupInputHandling(worker) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: ''
    })
    
    console.log('\n🔗 Token Workflow:')
    console.log('   1. Login via web UI (http://localhost:3001) OR CLI (login command)')
    console.log('   2. Get API token from web UI navbar OR CLI (gettoken command)')  
    console.log('   3. Use token in CLI (settoken command) or other applications')
    console.log('   4. Send AI prompts directly without re-login!\n')
    
    let isProcessing = false
    
    rl.on('line', async (input) => {
      input = input.trim()
      
      if (input === 'exit') {
        console.log('👋 Exiting...')
        rl.close()
        process.exit(0)
      } else if (input && !isProcessing) {
        isProcessing = true
        try {
          // Parse commands
          const parts = input.split(' ')
          const command = parts[0].toLowerCase()
          
          if (command === 'register') {
            if (parts.length !== 3) {
              console.log('❌ Usage: register <email> <password>')
            } else {
              const [, email, password] = parts
              const result = await worker.registerUser(email, password)
              if (result.success) {
                console.log(`✅ Registration Response:`)
                console.log(`   Email: ${result.email}`)
                console.log(`   Status: ${result.status}`)
                console.log(`   Message: ${result.message}`)
              } else {
                console.log(`❌ Registration failed: ${result.message}`)
              }
            }
          } else if (command === 'login') {
            if (parts.length !== 3) {
              console.log('❌ Usage: login <email> <password>')
            } else {
              const [, email, password] = parts
              const result = await worker.loginUser(email, password)
              if (result.success) {
                console.log(`✅ Login Response:`)
                console.log(`   Email: ${result.email}`)
                console.log(`   Key: ${result.key}`)
                console.log(`   Status: ${result.status}`)
              } else {
                console.log(`❌ Login failed: ${result.message}`)
              }
            }
          } else if (command === 'logout') {
            const result = worker.logout()
            if (result.success) {
              console.log(`✅ Logout Response:`)
              console.log(`   Message: ${result.message}`)
            } else {
              console.log(`⚠️  ${result.message}`)
            }
          } else if (command === 'settoken') {
            if (parts.length !== 2) {
              console.log('❌ Usage: settoken <your-api-token>')
              console.log('💡 Get your token from the web UI (click "API Token" in navbar)')
            } else {
              const [, token] = parts
              worker.sessionKey = token
              console.log(`✅ API token set successfully`)
              console.log(`🔑 Token: ${token.substring(0, 8)}${'*'.repeat(Math.max(0, token.length - 16))}${token.substring(Math.max(8, token.length - 8))}`)
              console.log(`💡 You can now send AI prompts without logging in`)
            }
          } else if (command === 'gettoken') {
            const result = worker.getApiToken()
            if (result.success) {
              console.log(`✅ Current API Token:`)
              console.log(`🔑 Token: ${result.token}`)
              console.log(`💡 Copy this token to use in other applications`)
            } else {
              console.log(`❌ ${result.message}`)
              console.log(`💡 Try logging in first with: login <email> <password>`)
            }
          } else if (command === 'cleartoken') {
            worker.sessionKey = null
            console.log(`✅ API token cleared`)
            console.log(`💡 You'll need to login or set a token to send prompts`)
          } else if (command === 'status') {
            if (worker.sessionKey) {
              console.log(`✅ Authentication Status: LOGGED IN`)
              console.log(`🔑 Token: ${worker.sessionKey.substring(0, 8)}${'*'.repeat(Math.max(0, worker.sessionKey.length - 16))}${worker.sessionKey.substring(Math.max(8, worker.sessionKey.length - 8))}`)
              console.log(`💡 Ready to send AI prompts`)
            } else {
              console.log(`❌ Authentication Status: NOT LOGGED IN`)
              console.log(`💡 Login with: login <email> <password>`)
              console.log(`💡 Or set token with: settoken <your-api-token>`)
            }
          } else if (command === 'help' || command === '?') {
            console.log(`\n📖 Available Commands:`)
            console.log(`   register <email> <password>  - Create a new account`)
            console.log(`   login <email> <password>     - Login to your account`)
            console.log(`   logout                       - Logout from current session`)
            console.log(`   settoken <token>             - Set API token manually`)
            console.log(`   gettoken                     - Get current API token`)
            console.log(`   cleartoken                   - Clear current API token`)
            console.log(`   status                       - Show authentication status`)
            console.log(`   help                         - Show this help message`)
            console.log(`   exit                         - Exit the CLI`)
            console.log(`\n💡 After authentication, just type your AI prompt!`)
            console.log(`💡 Get API tokens from web UI: http://localhost:3001`)
          } else {
            // Regular AI prompt
            const result = await worker.sendRequest(input)
            if (result.response) {
              console.log(`✅ AI Response:`)
              console.log(`${result.response}`)
            }
          }
        } catch (error) {
          const errorRequestId = Math.random().toString(36).substr(2, 9)
          logger.error('CLIClient', errorRequestId, 'CLI command execution failed', {
            input: input,
            error: error.message,
            stack: error.stack
          })
          console.error('❌ Request failed:', error.message)
        } finally {
          isProcessing = false
        }
      } else if (input && isProcessing) {
        console.log('⏳ Still processing previous request, please wait...')
      }
    })
    
    rl.on('close', () => {
      console.log('👋 Exiting...')
      process.exit(0)
    })
  }
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.lifecycle('CLIClient', 'SHUTDOWN', { signal: 'SIGINT' })
    console.log('\n🛑 Shutting down CLI Client...')
    worker.stop()
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    logger.lifecycle('CLIClient', 'SHUTDOWN', { signal: 'SIGTERM' })
    console.log('\n🛑 Shutting down CLI Client...')
    worker.stop()
    process.exit(0)
  })
  
} catch (error) {
  logger.error('CLIClient', 'STARTUP', 'Failed to create Client Worker', {
    error: error.message,
    stack: error.stack
  })
  console.error('❌ Failed to create Client Worker:', error.message)
  process.exit(1)
} 