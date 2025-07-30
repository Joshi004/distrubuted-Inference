# Auth Worker

A P2P authentication service that provides user registration and login functionality over Hyperswarm RPC.

## Features

- **User Registration**: Register users with email and password
- **User Login**: Authenticate users and return access keys
- **In-memory Storage**: Simple in-memory user storage (no persistence)
- **P2P Communication**: Communicates over Hyperswarm RPC on the `auth` topic

## Usage

### Starting the Auth Worker

```bash
npm run start:auth
```

The worker will:
- Start the RPC server
- Register `register` and `login` methods
- Announce itself on the `auth` topic in the DHT
- Listen for incoming authentication requests

### RPC Methods

#### `register`
Registers a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Response (Success):**
```json
{
  "success": true,
  "status": 201,
  "message": "User registered successfully",
  "email": "user@example.com"
}
```

#### `login`
Authenticates a user and returns an access key.

**Request:**
```json
{
  "email": "user@example.com", 
  "password": "userpassword"
}
```

**Response (Success):**
```json
{
  "success": true,
  "status": 200,
  "email": "user@example.com",
  "key": "abc123def"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "status": 401,
  "message": "Invalid credentials"
}
```

## Testing

To test the auth worker, you can use other workers in the system to make RPC calls:

```javascript
// From another worker with net facility
const result = await this.net_default.jTopicRequest(
  'auth',
  'register',
  { email: 'test@example.com', password: 'testpass' }
)

const loginResult = await this.net_default.jTopicRequest(
  'auth', 
  'login',
  { email: 'test@example.com', password: 'testpass' }
)
```

## Implementation Notes

- **No Input Validation**: As per requirements, no validation is performed on email/password
- **No Persistence**: User data is stored only in memory and lost on restart
- **No Encryption**: Passwords are stored in plain text
- **Duplicate Users**: Multiple users with same email/password are allowed
- **Random Keys**: Login keys are generated using `Math.random()`

This is a minimal implementation for development/testing purposes. 