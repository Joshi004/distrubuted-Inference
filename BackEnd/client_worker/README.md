# Client Worker Bridge

This folder contains the client worker implementation with both a CLI interface and a web bridge server.

## Files

- `client-worker.js` - Core client worker module (refactored for reuse)
- `bridge.server.js` - Express.js web server that bridges HTTP requests to the P2P network
- `cli-client.js` - Command-line interface for interactive usage
- `README.md` - This documentation

## Usage

### Bridge Server (HTTP API)

Start the bridge server:
```bash
npm run start:bridge
```

The server will run on port 3000 (or PORT environment variable).

**Endpoint:** `POST /inference`

**Request body:**
```json
{
  "prompt": "Your question or prompt here"
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:3000/inference \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the capital of France?"}'
```

**Health check:** `GET /health`

### CLI Client

Start the interactive CLI:
```bash
npm run start:cli
```

Type your prompts and press Enter. Type `exit` to quit.

## Prerequisites

Make sure the following services are running:
1. `npm run start:processor` - AI processing service
2. `npm run start:gateway` - Gateway service
3. Then start either the bridge server or CLI client

## Dependencies

- Express.js 4.18.2 (for bridge server)
- All existing P2P infrastructure dependencies 