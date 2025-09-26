# Perplexity MCP SSE Server

This is the Server-Sent Events (SSE) version of the Perplexity MCP server, converted from the original stdio version.

## Changes Made

### 1. Transport Layer
- **Before**: Used `StdioServerTransport` for stdio communication
- **After**: Uses official `SSEServerTransport` from MCP SDK for HTTP/SSE communication

### 2. Server Architecture
- **HTTP Server**: Now runs as an Express.js server on a configurable port (default: 3001)
- **SSE Endpoint**: `/sse` - for establishing Server-Sent Events connection
- **Message Endpoint**: `/message` - for sending JSON-RPC requests via HTTP POST
- **Health Check**: `/health` - for monitoring server status

### 3. Dependencies Added
- `express`: HTTP server framework
- `cors`: Cross-Origin Resource Sharing support
- `@types/express` and `@types/cors`: TypeScript type definitions

## Usage

### Starting the Server

```bash
# Build the project
npm run build

# Start with environment variables
PERPLEXITY_API_KEY=your_api_key PORT=3001 node dist/index.js
```

### API Endpoints

#### 1. SSE Connection
```
GET /sse
```
Establishes a Server-Sent Events connection. The server will send an `endpoint` event with the message URL including session ID.

#### 2. Send Messages
```
POST /message?sessionId=<session_id>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

#### 3. Health Check
```
GET /health
```
Returns server status and connection information.

### Client Implementation

1. **Connect to SSE**:
   ```javascript
   const eventSource = new EventSource('http://localhost:3001/sse');
   ```

2. **Listen for endpoint URL**:
   ```javascript
   eventSource.addEventListener('endpoint', function(event) {
     const messageUrl = decodeURI(event.data);
     // Use this URL for sending messages
   });
   ```

3. **Send messages**:
   ```javascript
   fetch(messageUrl, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(jsonRpcMessage)
   });
   ```

4. **Receive responses**:
   ```javascript
   eventSource.addEventListener('message', function(event) {
     const response = JSON.parse(event.data);
     // Handle JSON-RPC response
   });
   ```

### Test Client

Use the provided HTML test clients:

- `test-client-official.html` - Uses the official MCP SSE transport protocol
- `test-client.html` - Uses the previous custom implementation (deprecated)

Open either file in a web browser and test the SSE functionality.

### Available Tools

The server provides the same three Perplexity tools as the original:

1. **perplexity_ask** - General chat completion using sonar-pro model
2. **perplexity_research** - Deep research using sonar-deep-research model  
3. **perplexity_reason** - Reasoning tasks using sonar-reasoning-pro model

### Environment Variables

- `PERPLEXITY_API_KEY` (required) - Your Perplexity API key
- `PORT` (optional) - Server port, defaults to 3001

### Advantages of SSE Version

1. **HTTP-based**: Can be accessed from web browsers and standard HTTP clients
2. **Real-time**: Server-Sent Events provide real-time communication
3. **Scalable**: Can handle multiple concurrent clients
4. **Stateful**: Each client gets a unique session for proper message routing
5. **Standard**: Uses official MCP SDK SSE transport implementation
6. **CORS-enabled**: Supports cross-origin requests for web applications

## Migration from stdio

If you were using the stdio version, you'll need to:

1. Update your client to use HTTP/SSE instead of stdio
2. Handle the session-based communication model
3. Use the new endpoints for connecting and messaging
4. Update any deployment configurations to expose HTTP ports instead of stdio