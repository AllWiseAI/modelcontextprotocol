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
export class SSEServerTransport {
    constructor(port = 3001) {
        this.clients = new Map();
        this.messageHandlers = [];
        this.port = port;
        this.app = express();
        this.setupRoutes();
    }
    setupRoutes() {
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
        }));
        this.app.use(express.json());
        // SSE endpoint for receiving responses
        this.app.get('/events', (req, res) => {
            const clientId = req.query.clientId || `client_${Date.now()}`;
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control',
            });
            this.clients.set(clientId, res);
            // Send initial connection message
            res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
            // Handle client disconnect
            req.on('close', () => {
                this.clients.delete(clientId);
            });
        });
        // Endpoint for receiving JSON-RPC messages from clients
        this.app.post('/message', (req, res) => {
            try {
                const message = req.body;
                // Notify all registered message handlers
                this.messageHandlers.forEach(handler => {
                    try {
                        handler(message);
                    }
                    catch (error) {
                        console.error('Error in message handler:', error);
                    }
                });
                res.status(200).json({ status: 'received' });
            }
            catch (error) {
                console.error('Error processing message:', error);
                res.status(400).json({ error: 'Invalid message format' });
            }
        });
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                try {
                    this.server = this.app.listen(this.port, () => {
                        console.error(`SSE server running on port ${this.port}`);
                        resolve();
                    });
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                if (this.server) {
                    this.server.close(() => {
                        resolve();
                    });
                }
                else {
                    resolve();
                }
            });
        });
    }
    send(message) {
        return new Promise((resolve) => {
            const messageData = JSON.stringify(message);
            // Send message to all connected clients
            this.clients.forEach((client, clientId) => {
                try {
                    client.write(`data: ${messageData}\n\n`);
                }
                catch (error) {
                    console.error(`Error sending message to client ${clientId}:`, error);
                    this.clients.delete(clientId);
                }
            });
            resolve();
        });
    }
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    onClose(handler) {
        // Handle server close events if needed
        process.on('SIGINT', handler);
        process.on('SIGTERM', handler);
    }
    onError(handler) {
        // Handle server errors
        if (this.server) {
            this.server.on('error', handler);
        }
    }
}
