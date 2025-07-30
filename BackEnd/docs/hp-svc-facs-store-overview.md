# hp-svc-facs-store – Detailed Overview for Assessment Preparation

## What You Already Know (Quick Recap)

From your Day 1-3 preparation, you understand:

- **Hypercore** = append-only log (like a blockchain but simpler)
- **Hyperbee** = key-value store built on top of Hypercore
- **Hyperswarm** = peer discovery mechanism (finds other nodes in the network)

Think of it this way:
```
Hypercore:  [msg1] -> [msg2] -> [msg3] -> [msg4] -> ...
Hyperbee:   { "user:123": "Alice", "user:456": "Bob", ... }
Hyperswarm: "Hey, who has data for key XYZ?" -> "I do! Connect to me."
```

---

## The Missing Piece: Autobase (Multi-Writer Collaboration)

### What's the Problem Autobase Solves?

With a single Hypercore, only ONE writer can append data. But what if you want multiple peers to collaborate on the same dataset?

**Traditional Hypercore limitation:**
```
Peer A: [msg1] -> [msg2] -> [msg3]
Peer B: [msg1] -> [msg2] -> [msg4]  // CONFLICT! Who's right?
```

**Autobase solution:**
```
Peer A's feed: [msg1] -> [msg3] -> [msg5]
Peer B's feed: [msg2] -> [msg4] -> [msg6]
Merged view:   [msg1] -> [msg2] -> [msg3] -> [msg4] -> [msg5] -> [msg6]
```

### Real-World Analogy
Think of Autobase like **Google Docs for data**:
- Multiple people can edit the same document simultaneously
- Each person's changes are tracked separately
- The system automatically merges everyone's changes into a single, consistent view
- If there are conflicts, there are rules to resolve them

### CRDT = Conflict-free Replicated Data Type
This is just a fancy way of saying "data structure that can be safely merged even when multiple people modify it at the same time."

---

## What hp-svc-facs-store Actually Does

This facility is like a **Swiss Army knife for P2P storage**. It gives you easy access to all the storage tools without worrying about the low-level details.

### The Four Main Storage Types

| Storage Type | What It's For | Example Use Case |
|-------------|---------------|------------------|
| **Hypercore** (`getCore`) | Simple append-only logs | Event logs, chat messages, audit trails |
| **Hyperbee** (`getBee`) | Key-value storage | User profiles, configuration, indices |
| **Autobase** (`getBase`) | Collaborative datasets | Shared documents, voting systems, collaborative editing |
| **Hyperswarm** (`swarmBase`) | Network replication | Making your data available to other peers |

---

## Deep Dive: How Each Method Works

### 1. `getCore(opts)` - The Foundation

```js
const core = await this.store_default.getCore({ name: 'my-log' })
await core.append('Hello World')
await core.append('Second message')

// Reading back
for (let i = 0; i < core.length; i++) {
  const data = await core.get(i)
  console.log(`Message ${i}: ${data}`)
}
```

**What happens internally:**
- Creates a new Hypercore or opens existing one
- Stores data in `./data/corestore/` directory
- Each append gets a sequence number (0, 1, 2, ...)
- Data is cryptographically signed and immutable

### 2. `getBee(opts, beeOpts)` - Key-Value Storage

```js
const db = await this.store_default.getBee(
  { name: 'user-profiles' },
  { keyEncoding: 'utf-8', valueEncoding: 'json' }
)

// Store user data
await db.put('user:123', { name: 'Alice', age: 30 })
await db.put('user:456', { name: 'Bob', age: 25 })

// Retrieve user data
const alice = await db.get('user:123')
console.log(alice.value) // { name: 'Alice', age: 30 }

// List all users
for await (const { key, value } of db.createReadStream()) {
  console.log(`${key}: ${JSON.stringify(value)}`)
}
```

**What happens internally:**
- Creates a Hyperbee that uses a Hypercore underneath
- Organizes data as a B-tree for efficient key-based lookups
- Supports range queries, prefixes, and streaming
- Perfect for database-like operations

### 3. `getBase(baseOpts, bootstrapKey)` - Collaborative Storage

```js
// Create a new collaborative base
const base = await this.store_default.getBase({
  inputs: [core1, core2], // Multiple writers can contribute
  outputs: [outputCore]   // Merged result goes here
})

// Each peer can write to their own input core
await core1.append('Alice says: Hello')
await core2.append('Bob says: Hi there')

// The base automatically merges these into a single view
const linearView = base.createReadStream()
for await (const entry of linearView) {
  console.log(entry) // Shows merged, ordered timeline
}
```

**What happens internally:**
- Takes multiple Hypercore feeds as input
- Applies conflict resolution rules to merge them
- Creates a single, consistent view of all data
- Perfect for collaborative applications

### 4. `swarmBase(base)` - Network Replication

```js
const base = await this.store_default.getBase(...)
const swarm = await this.store_default.swarmBase(base)

// Now other peers can discover and replicate this base
// They just need to know the base's discovery key
```

**What happens internally:**
- Announces the base's discovery key to the DHT
- Other peers can find and connect to replicate data
- Handles all the networking complexity for you

---

## Practical Examples for Your Assessment

### Example 1: Simple User Profile Service

```js
class UserProfileService extends Base {
  async _start(cb) {
    // Get a key-value store for user profiles
    this.profileDb = await this.store_default.getBee(
      { name: 'user-profiles' },
      { keyEncoding: 'utf-8', valueEncoding: 'json' }
    )
    
    cb()
  }
  
  async createUser(userData) {
    const userId = `user:${Date.now()}`
    await this.profileDb.put(userId, userData)
    return { userId, ...userData }
  }
  
  async getUser(userId) {
    const result = await this.profileDb.get(userId)
    return result ? result.value : null
  }
  
  async listUsers() {
    const users = []
    for await (const { key, value } of this.profileDb.createReadStream()) {
      users.push({ id: key, ...value })
    }
    return users
  }
}
```

### Example 2: Collaborative Document System

```js
class DocumentService extends Base {
  async _start(cb) {
    // Create individual cores for each collaborator
    this.aliceCore = await this.store_default.getCore({ name: 'alice-edits' })
    this.bobCore = await this.store_default.getCore({ name: 'bob-edits' })
    
    // Create an autobase that merges their edits
    this.documentBase = await this.store_default.getBase({
      inputs: [this.aliceCore, this.bobCore],
      outputs: [await this.store_default.getCore({ name: 'merged-doc' })]
    })
    
    // Make it available to other peers
    this.swarm = await this.store_default.swarmBase(this.documentBase)
    
    cb()
  }
  
  async addEdit(author, edit) {
    const core = author === 'alice' ? this.aliceCore : this.bobCore
    await core.append(JSON.stringify({
      timestamp: Date.now(),
      author,
      edit
    }))
  }
  
  async getDocument() {
    const edits = []
    for await (const entry of this.documentBase.createReadStream()) {
      edits.push(JSON.parse(entry))
    }
    return edits.sort((a, b) => a.timestamp - b.timestamp)
  }
}
```

---

## Configuration in Practice

In your `config/dev.store.json`:
```json
{
  "store": {
    "storeDir": "./data/my-service",
    "storePrimaryKey": null  // Let it generate automatically
  }
}
```

Then in your worker:
```js
this.setInitFacs([
  ['fac', 'hp-svc-facs-store', null, 'default', { 
    storeDir: './data/my-service' 
  }, 0]  // Priority 0 = starts first
])
```

---

## Common Patterns You'll Use

### Pattern 1: Simple CRUD Service
```js
// Use getBee for key-value operations
const db = await this.store_default.getBee(...)
await db.put(key, value)    // Create/Update
const result = await db.get(key)  // Read
await db.del(key)           // Delete
```

### Pattern 2: Event Sourcing
```js
// Use getCore for append-only event logs
const eventLog = await this.store_default.getCore(...)
await eventLog.append(JSON.stringify({ type: 'USER_CREATED', data: {...} }))
await eventLog.append(JSON.stringify({ type: 'USER_UPDATED', data: {...} }))
```

### Pattern 3: Collaborative System
```js
// Use getBase when multiple peers need to write
const base = await this.store_default.getBase(...)
const swarm = await this.store_default.swarmBase(base)
// Now multiple peers can collaborate on the same dataset
```

---

## Mental Model for the Assessment

Think of `hp-svc-facs-store` as your **data layer abstraction**:

1. **For simple storage needs** → use `getBee` (like Redis/MongoDB)
2. **For event logs/audit trails** → use `getCore` (like Kafka/EventStore)
3. **For collaborative features** → use `getBase` + `swarmBase` (like Google Docs backend)

The facility handles all the complex P2P networking, persistence, and replication. You just call the methods and focus on your business logic.

Your assessment will likely use **getBee** for 80% of storage needs, with maybe one **getCore** for event logging. **Autobase** is more advanced and might not be required unless you're building something collaborative. 