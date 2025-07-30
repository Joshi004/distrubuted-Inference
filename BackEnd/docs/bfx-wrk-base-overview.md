# bfx-wrk-base – Detailed Overview for Assessment Preparation

## What You Already Know (Conventional Server/Client Architecture)

From your microservice background, you're familiar with this typical setup:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Service  │    │  Order Service  │    │Payment Service  │
│                 │    │                 │    │                 │
│ • Express.js    │    │ • Express.js    │    │ • Express.js    │
│ • MongoDB       │    │ • PostgreSQL    │    │ • Redis         │
│ • Config files  │    │ • Config files  │    │ • Config files  │
│ • Health checks │    │ • Health checks │    │ • Health checks │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                        ▲                        ▲
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   Client App    │    │   Client App    │
│                 │    │                 │    │                 │
│ • React/Vue     │    │ • Mobile App    │    │ • Admin Panel   │
│ • HTTP calls    │    │ • HTTP calls    │    │ • HTTP calls    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**How this traditional setup works:**
- **Servers** run on fixed IP addresses (like 192.168.1.100:3000)
- **Clients** know exactly where to find servers (via DNS)
- **Communication** happens over HTTP/REST
- **Data** is stored in centralized databases
- **Service discovery** uses DNS or service registries

---

## The P2P Challenge: No Fixed Servers, No Fixed Clients

In the Holepunch world, there's **no distinction between server and client**. Every node is both a server AND a client.

### Traditional vs P2P Architecture

**Traditional Server/Client (what you know):**
```
Client (React App)  ──HTTP──► Server (Express.js)  ──SQL──► Database
     │                            │                        │
     │                            │                        │
Fixed IP: Browser               Fixed IP: 192.168.1.100   Fixed IP: db.company.com
```

**P2P Worker (what you're learning):**
```
Worker A (User Service)  ──P2P──► Worker B (Order Service)  ──P2P──► Worker C (Payment)
     │                                │                                │
     │                                │                                │
Crypto ID: abc123...              Crypto ID: def456...            Crypto ID: ghi789...
Local Storage                     Local Storage                   Local Storage
```

**Key differences:**
- **No fixed IPs** - each worker has a cryptographic identity
- **No central database** - each worker has its own local storage
- **No HTTP** - communication happens over encrypted P2P channels
- **No DNS** - services find each other via DHT (distributed hash table)

---

## Step-by-Step: How Traditional vs P2P Works

### Example 1: Simple User Registration

Let's see how a user registration flow works in both architectures:

#### Traditional Server/Client Flow

**1. Client Side (React App):**
```js
// Frontend code
async function registerUser(userData) {
  const response = await fetch('http://user-service.company.com/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  })
  
  return await response.json()
}

// Usage
const newUser = await registerUser({ name: 'Alice', email: 'alice@example.com' })
```

**2. Server Side (Express.js):**
```js
// Backend code
const express = require('express')
const mongoose = require('mongoose')
const app = express()

// Connect to centralized database
mongoose.connect('mongodb://db.company.com:27017/users')

app.post('/api/users', async (req, res) => {
  // Save to centralized database
  const user = new User(req.body)
  await user.save()
  
  res.json(user)
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
```

**What happens:**
1. Client knows server address: `http://user-service.company.com`
2. Client makes HTTP POST request
3. Server receives request, saves to MongoDB
4. Server sends response back to client

#### P2P Worker Flow

**1. Client Worker (Registration Client):**
```js
// Client worker code
const Base = require('bfx-wrk-base')

class RegistrationClient extends Base {
  constructor(conf, ctx) {
    super(conf, ctx)
    this.init()
    
    // Load networking facility to communicate with other workers
    this.setInitFacs([
      ['fac', 'hp-svc-facs-net', null, 'default', { allowLocal: true }]
    ])
  }
  
  async _start(cb) {
    // Start networking (like connecting to the internet)
    await this.net_default.startRpc()
    this.net_default.startLookup()
    
    // Register a user
    await this.registerUser({ name: 'Alice', email: 'alice@example.com' })
    
    cb()
  }
  
  async registerUser(userData) {
    // Find user-service workers via DHT (like DNS lookup)
    const newUser = await this.net_default.jTopicRequest(
      'user-service',    // Topic (like domain name)
      'createUser',      // Method (like HTTP endpoint)
      userData           // Data (like request body)
    )
    
    console.log('User created:', newUser)
    return newUser
  }
}

module.exports = RegistrationClient
```

**2. Server Worker (User Service):**
```js
// Server worker code
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
    // Initialize local database (like MongoDB connection)
    this.userDb = await this.store_default.getBee(
      { name: 'users' },
      { keyEncoding: 'utf-8', valueEncoding: 'json' }
    )
    
    // Start RPC server (like app.listen())
    await this.net_default.startRpcServer()
    
    // Announce service to DHT (like registering with DNS)
    this.net_default.startLookup()
    await this.net_default.lookup.announceInterval('user-service')
    
    console.log('User service started!')
    cb()
  }
  
  // RPC method (like Express route)
  async createUser(userData) {
    // Save to local database (like MongoDB save)
    const user = { id: Date.now(), ...userData }
    await this.userDb.put(`user_${user.id}`, user)
    
    return user
  }
}

module.exports = UserService
```

**What happens:**
1. Client worker looks up 'user-service' topic in DHT
2. DHT returns list of worker public keys that handle 'user-service'
3. Client worker connects directly to one of those workers
4. Server worker receives RPC request, saves to local storage
5. Server worker sends response back to client worker

---

## Example 2: Multi-Service Communication

Let's see how services communicate with each other:

#### Traditional Server/Client Flow

**Order Service calling User Service:**
```js
// Order service code
app.post('/api/orders', async (req, res) => {
  // Call user service via HTTP
  const userResponse = await fetch(`http://user-service.company.com/api/users/${req.body.userId}`)
  const user = await userResponse.json()
  
  if (!user) {
    return res.status(400).json({ error: 'User not found' })
  }
  
  // Call payment service via HTTP
  const paymentResponse = await fetch('http://payment-service.company.com/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: req.body.userId,
      amount: req.body.amount
    })
  })
  const payment = await paymentResponse.json()
  
  // Save order to database
  const order = { id: Date.now(), userId: req.body.userId, amount: req.body.amount, paymentId: payment.id }
  await Order.create(order)
  
  res.json(order)
})
```

**What happens:**
1. Order service receives HTTP request
2. Makes HTTP call to user-service.company.com
3. Makes HTTP call to payment-service.company.com
4. Saves to centralized database
5. Returns response

#### P2P Worker Flow

**Order Worker calling User Worker:**
```js
// Order worker code
class OrderService extends Base {
  constructor(conf, ctx) {
    super(conf, ctx)
    this.init()
    
    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', null, 'default', { storeDir: './orders' }, 0],
      ['fac', 'hp-svc-facs-net', null, 'default', { allowLocal: true }, 10]
    ])
  }
  
  async _start(cb) {
    this.orderDb = await this.store_default.getBee({ name: 'orders' })
    await this.net_default.startRpcServer()
    
    // Announce that we handle order-related requests
    this.net_default.startLookup()
    await this.net_default.lookup.announceInterval('order-service')
    
    cb()
  }
  
  // RPC method (like Express route)
  async createOrder(orderData) {
    // Call user service via P2P (like HTTP call)
    const user = await this.net_default.jTopicRequest(
      'user-service',
      'getUser',
      { id: orderData.userId }
    )
    
    if (!user) {
      throw new Error('User not found')
    }
    
    // Call payment service via P2P (like HTTP call)
    const payment = await this.net_default.jTopicRequest(
      'payment-service',
      'processPayment',
      {
        userId: orderData.userId,
        amount: orderData.amount
      }
    )
    
    // Save to local database
    const order = {
      id: Date.now(),
      userId: orderData.userId,
      amount: orderData.amount,
      paymentId: payment.id
    }
    await this.orderDb.put(`order_${order.id}`, order)
    
    return order
  }
}
```

**What happens:**
1. Order worker receives RPC request
2. Makes P2P call to find and contact user-service workers
3. Makes P2P call to find and contact payment-service workers
4. Saves to local database
5. Returns response

---

## Example 3: Configuration and Environment Management

#### Traditional Server Configuration

**Development Environment:**
```js
// config/development.json
{
  "port": 3000,
  "database": {
    "url": "mongodb://localhost:27017/myapp_dev"
  },
  "services": {
    "userService": "http://localhost:3001",
    "paymentService": "http://localhost:3002"
  }
}

// config/production.json
{
  "port": 80,
  "database": {
    "url": "mongodb://prod-db.company.com:27017/myapp"
  },
  "services": {
    "userService": "https://user-service.company.com",
    "paymentService": "https://payment-service.company.com"
  }
}

// Usage in code
const config = require(`./config/${process.env.NODE_ENV}.json`)
mongoose.connect(config.database.url)
```

#### P2P Worker Configuration

**Development Environment:**
```js
// config/dev.json (main config)
{
  "orderService": {
    "maxOrders": 1000,
    "enableNotifications": true
  }
}

// config/dev.store.json (storage config)
{
  "store": {
    "storeDir": "./data/dev/orders",
    "storePrimaryKey": null
  }
}

// config/dev.net.json (networking config)
{
  "net": {
    "allowLocal": true,
    "timeout": 30000
  }
}
```

**Production Environment:**
```js
// config/prod.json
{
  "orderService": {
    "maxOrders": 10000,
    "enableNotifications": false
  }
}

// config/prod.store.json
{
  "store": {
    "storeDir": "/var/data/orders",
    "storePrimaryKey": "abc123def456..."
  }
}

// config/prod.net.json
{
  "net": {
    "allowLocal": false,
    "timeout": 15000,
    "allow": ["trusted-key-1", "trusted-key-2"]
  }
}
```

**Usage in worker code:**
```js
async _start(cb) {
  // All configs are automatically merged into this.conf
  console.log('Max orders:', this.conf.orderService.maxOrders)
  console.log('Store dir:', this.conf.store.storeDir)
  console.log('Network timeout:', this.conf.net.timeout)
  
  cb()
}
```

---

## Example 4: Error Handling and Resilience

#### Traditional Server Error Handling

```js
// Express.js error handling
app.post('/api/orders', async (req, res) => {
  try {
    // Call external service
    const userResponse = await fetch('http://user-service.company.com/api/users/123')
    
    if (!userResponse.ok) {
      return res.status(400).json({ error: 'User service unavailable' })
    }
    
    const user = await userResponse.json()
    
    // Process order...
    res.json(order)
    
  } catch (error) {
    console.error('Order creation failed:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

#### P2P Worker Error Handling

```js
// P2P worker error handling
class OrderService extends Base {
  async createOrder(orderData) {
    try {
      // Call other worker
      const user = await this.net_default.jTopicRequest(
        'user-service',
        'getUser',
        { id: orderData.userId },
        { timeout: 5000 }  // 5 second timeout
      )
      
      // Process order...
      return order
      
    } catch (error) {
      if (error.message.includes('ERR_TOPIC_LOOKUP_EMPTY')) {
        throw new Error('User service not available')
      }
      
      if (error.message.includes('timeout')) {
        throw new Error('User service timed out')
      }
      
      throw error
    }
  }
}
```

---

## Example 5: Development vs Production Deployment

#### Traditional Server Deployment

**Development:**
```bash
# Start each service manually
cd user-service && npm start    # Runs on localhost:3001
cd order-service && npm start   # Runs on localhost:3002
cd payment-service && npm start # Runs on localhost:3003
```

**Production:**
```yaml
# docker-compose.yml
version: '3'
services:
  user-service:
    image: user-service:latest
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=production
      - DB_URL=mongodb://prod-db:27017/users
      
  order-service:
    image: order-service:latest
    ports:
      - "3002:3000"
    environment:
      - NODE_ENV=production
      - USER_SERVICE_URL=http://user-service:3000
```

#### P2P Worker Deployment

**Development:**
```bash
# Start each worker (they find each other automatically)
cd user-service && node index.js --env=dev
cd order-service && node index.js --env=dev
cd payment-service && node index.js --env=dev
```

**Production:**
```bash
# Workers can run on different machines, different networks
# They find each other via DHT automatically
machine1$ cd user-service && node index.js --env=prod
machine2$ cd order-service && node index.js --env=prod
machine3$ cd payment-service && node index.js --env=prod
```

---

## Mental Model Summary

Think of the progression like this:

| Traditional | P2P Worker |
|-------------|------------|
| **Express app** | **Worker class** |
| **HTTP routes** | **RPC methods** |
| **Middleware** | **Facilities** |
| **Database connection** | **Storage facility** |
| **HTTP client** | **Network facility** |
| **DNS lookup** | **DHT lookup** |
| **Fixed IP:Port** | **Cryptographic identity** |
| **Manual config loading** | **Automatic config merging** |
| **Manual startup/shutdown** | **Lifecycle hooks** |

The `bfx-wrk-base` essentially gives you all the infrastructure that Express.js + your typical microservice setup provides, but designed for a P2P world where there are no fixed servers, no DNS, and no centralized databases.

**For your assessment, you'll likely:**
- Create a worker that feels like an Express service
- Use facilities instead of middleware
- Make P2P calls instead of HTTP calls
- Store data locally instead of in a shared database
- Let the DHT handle service discovery instead of DNS

The beauty is that once you understand this mapping, building P2P services feels very similar to building traditional microservices! 