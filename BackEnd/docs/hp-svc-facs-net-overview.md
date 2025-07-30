# hp-svc-facs-net – Detailed Overview for Assessment Preparation

## What You Already Know (Conventional Architecture)

From your microservice background, you're familiar with:

```
Client → Load Balancer → Service A → Database
                    ↘ Service B → Database
                    ↘ Service C → Database
```

**How services find each other:**
- DNS names (e.g., `user-service.company.com`)
- Service discovery (Consul, Eureka)
- Load balancers with fixed IP addresses
- API gateways routing requests

**How they communicate:**
- HTTP/REST APIs
- gRPC
- Message queues (RabbitMQ, Kafka)

---

## The P2P Challenge: No Central Authority

In the Holepunch world, there's **no DNS, no load balancer, no central registry**. Services must find each other using only cryptographic identities.

### Traditional vs P2P Service Discovery

**Traditional (what you know):**
```
Client: "Where is user-service?"
DNS: "It's at 192.168.1.100:8080"
Client: connects to 192.168.1.100:8080
```

**P2P (what you're learning):**
```
Client: "Where is user-service?"
DHT: "Node abc123def456 announced that topic 2 hours ago"
Client: connects directly to abc123def456's IP
```

The **DHT (Distributed Hash Table)** replaces DNS. Think of it as a **decentralized phone book** where services announce themselves.

---

## What hp-svc-facs-net Actually Does

This facility is your **networking Swiss Army knife** that handles all the P2P complexity so you can write code that feels almost like traditional microservices.

### The Four Main Problems It Solves

| Problem | Traditional Solution | P2P Solution (this facility) |
|---------|---------------------|------------------------------|
| **Service Discovery** | DNS/Service Registry | DHT + Topic Announcements |
| **Identity Management** | Certificates/JWT | Cryptographic Key Pairs |
| **Communication** | HTTP/gRPC | Encrypted RPC over DHT |
| **Security** | Firewalls/API Keys | Public Key Allowlists |

---

## Core Concepts Explained Simply

### 1. Topics vs Service Names

**Traditional:**
```js
// You call services by name
fetch('http://user-service/api/users/123')
```

**P2P:**
```js
// You call services by topic
await this.net_default.jTopicRequest('user-service', 'getUser', { id: 123 })
```

A **topic** is like a service name, but instead of resolving to an IP address, it resolves to a list of public keys of nodes that announced they handle that topic.

### 2. Public Keys vs IP Addresses

**Traditional:**
```
Service A lives at: 192.168.1.100:8080
Service B lives at: 192.168.1.101:8080
```

**P2P:**
```
Service A lives at: abc123def456789... (64-character hex public key)
Service B lives at: fed654cba987654... (64-character hex public key)
```

The public key is both the **identity** and the **address** of a service.

### 3. DHT Lookup vs DNS Lookup

**DNS Lookup (traditional):**
```js
// Browser does this automatically
const ip = await dns.resolve('user-service.company.com')
// Returns: '192.168.1.100'
```

**DHT Lookup (P2P):**
```js
// hp-svc-facs-net does this for you
const publicKeys = await this.net_default.lookupTopicKey('user-service')
// Returns: ['abc123def456...', 'fed654cba987...']
```

---

## Deep Dive: How Each Method Works

### 1. Service Announcement (Like Registering with Service Discovery)

**Traditional (Eureka/Consul):**
```js
// Service registers itself
serviceRegistry.register({
  name: 'user-service',
  host: '192.168.1.100',
  port: 8080,
  healthCheck: '/health'
})
```

**P2P (hp-svc-facs-net):**
```js
// Service announces itself to DHT
await this.net_default.startLookup()
await this.net_default.lookup.announceInterval('user-service')

// This tells the DHT: "I handle requests for 'user-service' topic"
// Other nodes can now find you by searching for 'user-service'
```

**What happens internally:**
- Your service's public key gets associated with the topic 'user-service'
- The DHT stores this mapping distributed across many nodes
- Other services can lookup 'user-service' and get your public key
- The announcement is refreshed periodically to stay active

### 2. Making RPC Calls (Like HTTP Requests)

**Traditional HTTP:**
```js
const response = await fetch('http://user-service/api/users/123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Alice' })
})
const user = await response.json()
```

**P2P RPC:**
```js
const user = await this.net_default.jTopicRequest(
  'user-service',        // topic (like service name)
  'createUser',          // method (like HTTP endpoint)
  { name: 'Alice' }      // data (like request body)
)
```

**What happens internally:**
1. Looks up 'user-service' topic in DHT → gets list of public keys
2. Picks one public key randomly (load balancing)
3. Establishes encrypted connection to that node
4. Sends JSON-RPC request with method 'createUser'
5. Returns the response

### 3. Handling Incoming Requests (Like Express Routes)

**Traditional Express:**
```js
app.post('/api/users', async (req, res) => {
  const user = await createUser(req.body)
  res.json(user)
})
```

**P2P RPC Handler:**
```js
class UserService extends Base {
  async createUser(data) {
    // This method gets called when someone sends RPC request
    const user = await this.createUserInDatabase(data)
    return user  // Automatically sent back as JSON
  }
  
  async _start(cb) {
    // Start RPC server to handle incoming requests
    await this.net_default.startRpcServer()
    
    // Announce that we handle 'user-service' topic
    this.net_default.startLookup()
    await this.net_default.lookup.announceInterval('user-service')
    
    cb()
  }
}
```

**What happens internally:**
- `startRpcServer()` creates a server bound to your public key
- Other nodes can connect to your public key and send RPC requests
- When they call method 'createUser', your `createUser()` function runs
- The return value is automatically sent back as JSON

---

## Practical Examples for Your Assessment

### Example 1: Simple User Service (Server Side)

```js
const Base = require('bfx-wrk-base')

class UserService extends Base {
  constructor(conf, ctx) {
    super(conf, ctx)
    this.init()
    
    // Load storage and networking facilities
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 'default', { storeDir: './data' }, 0],
      ['fac', 'hp-svc-facs-net', null, 'default', { allowLocal: true }, 10]
    ])
  }
  
  async _start(cb) {
    // Initialize database
    this.userDb = await this.store_default.getBee(
      { name: 'users' },
      { keyEncoding: 'utf-8', valueEncoding: 'json' }
    )
    
    // Start RPC server
    await this.net_default.startRpcServer()
    
    // Announce our service
    this.net_default.startLookup()
    await this.net_default.lookup.announceInterval('user-service')
    
    console.log('User service started!')
    console.log('Public key:', this.net_default.rpc.keyPair.publicKey.toString('hex'))
    
    cb()
  }
  
  // RPC Methods (like Express routes)
  async createUser(userData) {
    const userId = `user_${Date.now()}`
    await this.userDb.put(userId, userData)
    return { id: userId, ...userData }
  }
  
  async getUser(data) {
    const result = await this.userDb.get(data.id)
    return result ? result.value : null
  }
  
  async listUsers() {
    const users = []
    for await (const { key, value } of this.userDb.createReadStream()) {
      users.push({ id: key, ...value })
    }
    return users
  }
}

module.exports = UserService
```

### Example 2: Client Making Requests

```js
const Base = require('bfx-wrk-base')

class ClientService extends Base {
  constructor(conf, ctx) {
    super(conf, ctx)
    this.init()
    
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 'default', { storeDir: './client-data' }, 0],
      ['fac', 'hp-svc-facs-net', null, 'default', { allowLocal: true }, 10]
    ])
  }
  
  async _start(cb) {
    // Start networking (client doesn't need to announce)
    await this.net_default.startRpc()
    this.net_default.startLookup()
    
    // Example: Create a user
    await this.createUserExample()
    
    cb()
  }
  
  async createUserExample() {
    try {
      // This is like making an HTTP POST request
      const newUser = await this.net_default.jTopicRequest(
        'user-service',
        'createUser',
        { name: 'Alice', email: 'alice@example.com' }
      )
      
      console.log('Created user:', newUser)
      
      // This is like making an HTTP GET request
      const user = await this.net_default.jTopicRequest(
        'user-service',
        'getUser',
        { id: newUser.id }
      )
      
      console.log('Retrieved user:', user)
      
    } catch (error) {
      console.error('Error:', error.message)
    }
  }
}

module.exports = ClientService
```

---

## Configuration in Practice

### Server Configuration (`config/dev.net.json`)
```json
{
  "net": {
    "allowLocal": true,
    "timeout": 30000,
    "allow": null  // Allow all connections (for development)
  }
}
```

### Production Configuration (`config/prod.net.json`)
```json
{
  "net": {
    "allowLocal": false,
    "timeout": 15000,
    "allow": [
      "abc123def456...",  // Only allow specific public keys
      "fed654cba987..."
    ]
  }
}
```

---

## Key Differences from Traditional Architecture

| Aspect | Traditional | P2P (hp-svc-facs-net) |
|--------|-------------|------------------------|
| **Service Discovery** | DNS/Registry | DHT Topic Announcements |
| **Load Balancing** | Load Balancer | Random peer selection |
| **Security** | API Keys/JWT | Public Key Allowlists |
| **Addressing** | IP:Port | Public Key |
| **Routing** | HTTP paths | RPC method names |
| **Data Format** | JSON/XML | JSON (but over encrypted streams) |

---

## Common Patterns You'll Use

### Pattern 1: Simple Request-Response (like HTTP)
```js
// Client side
const result = await this.net_default.jTopicRequest('my-service', 'doSomething', data)

// Server side
async doSomething(data) {
  return processData(data)
}
```

### Pattern 2: Fire-and-Forget Events (like message queues)
```js
// Client side
await this.net_default.jTopicEvent('notification-service', 'userCreated', { userId: 123 })

// Server side
async userCreated(data) {
  console.log('User created:', data.userId)
  // No return value needed
}
```

### Pattern 3: Service-to-Service Communication
```js
// Service A calling Service B
class ServiceA extends Base {
  async processOrder(orderData) {
    // Call user service to validate user
    const user = await this.net_default.jTopicRequest('user-service', 'getUser', { id: orderData.userId })
    
    // Call payment service to process payment
    const payment = await this.net_default.jTopicRequest('payment-service', 'processPayment', {
      userId: orderData.userId,
      amount: orderData.amount
    })
    
    return { order: orderData, user, payment }
  }
}
```

---

## Mental Model for the Assessment

Think of `hp-svc-facs-net` as your **networking abstraction layer**:

1. **Replace HTTP calls** with `jTopicRequest()` 
2. **Replace service registration** with `announceInterval()`
3. **Replace Express routes** with class methods
4. **Replace DNS** with DHT topic lookups

The facility handles all the P2P complexity (DHT lookups, key management, encrypted connections) so you can focus on your business logic.

**For your assessment, you'll likely:**
- Use `jTopicRequest()` for 80% of communication needs
- Use `announceInterval()` to make your service discoverable  
- Define RPC methods as simple async functions
- Use `allowLocal: true` for development/testing

The beauty is that once you understand these patterns, building P2P services feels almost as simple as traditional microservices! 