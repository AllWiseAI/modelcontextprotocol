var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from 'express';
import cors from 'cors';
export function createSSEServer(mcpServer) {
    const app = express();
    const clients = new Map();
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Client-ID'],
    }));
    app.use(express.json());
    // SSE endpoint for clients to receive messages
    app.get('/events', (req, res) => {
        const clientId = req.query.clientId || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control, X-Client-ID',
        });
        clients.set(clientId, res);
        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
        // Keep connection alive with periodic heartbeat
        const heartbeat = setInterval(() => {
            if (clients.has(clientId)) {
                try {
                    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
                }
                catch (error) {
                    console.error(`Heartbeat failed for client ${clientId}:`, error);
                    clearInterval(heartbeat);
                    clients.delete(clientId);
                }
            }
            else {
                clearInterval(heartbeat);
            }
        }, 30000);
        // Handle client disconnect
        req.on('close', () => {
            clearInterval(heartbeat);
            clients.delete(clientId);
            console.error(`Client ${clientId} disconnected`);
        });
        req.on('error', (error) => {
            console.error(`Client ${clientId} error:`, error);
            clearInterval(heartbeat);
            clients.delete(clientId);
        });
    });
    // Endpoint for clients to send JSON-RPC requests
    app.post('/message', (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const message = req.body;
            console.error(`Received message:`, JSON.stringify(message, null, 2));
            // Handle JSON-RPC request
            if ('method' in message && 'id' in message) {
                const request = message;
                try {
                    let response;
                    if (request.method === 'tools/list') {
                        // Manually call the handler we registered in the main server
                        const handlers = mcpServer._requestHandlers;
                        const listHandler = handlers.get('tools/list');
                        if (listHandler) {
                            response = yield listHandler({
                                method: 'tools/list',
                                params: request.params || {}
                            });
                        }
                        else {
                            throw new Error('No handler registered for tools/list');
                        }
                    }
                    else if (request.method === 'tools/call') {
                        const handlers = mcpServer._requestHandlers;
                        const callHandler = handlers.get('tools/call');
                        if (callHandler) {
                            response = yield callHandler({
                                method: 'tools/call',
                                params: request.params
                            });
                        }
                        else {
                            throw new Error('No handler registered for tools/call');
                        }
                    }
                    else {
                        throw new Error(`Unknown method: ${request.method}`);
                    }
                    const jsonrpcResponse = {
                        jsonrpc: '2.0',
                        id: request.id,
                        result: response
                    };
                    // Send response to the specific client that made the request
                    const clientId = req.headers['x-client-id'];
                    const responseData = JSON.stringify(jsonrpcResponse);
                    if (clientId && clients.has(clientId)) {
                        try {
                            clients.get(clientId).write(`data: ${responseData}\n\n`);
                        }
                        catch (error) {
                            console.error(`Error sending to client ${clientId}:`, error);
                            clients.delete(clientId);
                        }
                    }
                    else {
                        // If specific client not found, send to all clients
                        clients.forEach((client, cId) => {
                            try {
                                client.write(`data: ${responseData}\n\n`);
                            }
                            catch (error) {
                                console.error(`Error sending to client ${cId}:`, error);
                                clients.delete(cId);
                            }
                        });
                    }
                }
                catch (error) {
                    console.error('Error processing request:', error);
                    // Send error response
                    const errorResponse = {
                        jsonrpc: '2.0',
                        id: request.id,
                        error: {
                            code: -32603,
                            message: error instanceof Error ? error.message : 'Internal error',
                            data: error instanceof Error ? error.stack : undefined
                        }
                    };
                    const responseData = JSON.stringify(errorResponse);
                    const clientId = req.headers['x-client-id'];
                    if (clientId && clients.has(clientId)) {
                        try {
                            clients.get(clientId).write(`data: ${responseData}\n\n`);
                        }
                        catch (sendError) {
                            console.error(`Error sending error to client ${clientId}:`, sendError);
                            clients.delete(clientId);
                        }
                    }
                    else {
                        // If specific client not found, send to all clients
                        clients.forEach((client, cId) => {
                            try {
                                client.write(`data: ${responseData}\n\n`);
                            }
                            catch (sendError) {
                                console.error(`Error sending error to client ${cId}:`, sendError);
                                clients.delete(cId);
                            }
                        });
                    }
                }
            }
            res.status(200).json({ status: 'received' });
        }
        catch (error) {
            console.error('Error processing message:', error);
            res.status(400).json({ error: 'Invalid message format' });
        }
    }));
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            connectedClients: clients.size,
            endpoints: {
                events: '/events',
                message: '/message',
                health: '/health'
            }
        });
    });
    // Root endpoint with basic info
    app.get('/', (req, res) => {
        res.json({
            name: 'Perplexity MCP SSE Server',
            version: '1.0.0',
            endpoints: {
                events: '/events - SSE endpoint for receiving responses',
                message: '/message - POST endpoint for sending JSON-RPC requests',
                health: '/health - Health check endpoint'
            },
            connectedClients: clients.size
        });
    });
    return app;
}
