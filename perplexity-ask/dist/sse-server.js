var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
export function createSSEServer(mcpServer) {
    const app = express();
    // Add CORS middleware
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        }
        else {
            next();
        }
    });
    // Add middleware to parse JSON bodies
    app.use(express.json());
    const transportMap = new Map();
    app.get("/sse", (req, res) => __awaiter(this, void 0, void 0, function* () {
        const transport = new SSEServerTransport("/messages", res);
        console.log(`[SSE] New SSE connection established with sessionId: ${transport.sessionId}`);
        transportMap.set(transport.sessionId, transport);
        console.log(`[SSE] Transport added to map. Total transports: ${transportMap.size}`);
        // Clean up when connection closes
        res.on('close', () => {
            console.log(`[SSE] Connection closed for sessionId: ${transport.sessionId}`);
            transportMap.delete(transport.sessionId);
            console.log(`[SSE] Transport removed from map. Total transports: ${transportMap.size}`);
        });
        yield mcpServer.connect(transport);
    }));
    app.post("/messages", (req, res) => __awaiter(this, void 0, void 0, function* () {
        const sessionId = req.query.sessionId;
        console.log(`[SSE] POST /messages received with sessionId: ${sessionId}`);
        console.log(`[SSE] Available sessionIds: ${Array.from(transportMap.keys()).join(', ')}`);
        if (!sessionId) {
            console.error('[SSE] Message received without sessionId');
            res.status(400).json({ error: 'sessionId is required' });
            return;
        }
        const transport = transportMap.get(sessionId);
        if (transport) {
            console.log(`[SSE] Transport found for sessionId: ${sessionId}, handling message`);
            try {
                yield transport.handlePostMessage(req, res);
                console.log(`[SSE] Message handled successfully for sessionId: ${sessionId}`);
            }
            catch (error) {
                console.error(`[SSE] Error handling message for sessionId: ${sessionId}`, error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        }
        else {
            console.error(`[SSE] No transport found for sessionId: ${sessionId}`);
            res.status(404).json({ error: 'Session not found' });
        }
    }));
    return app;
}
