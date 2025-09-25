import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

export function createSSEServer(mcpServer: Server) {
    const app = express();
    
    // Add CORS middleware
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
        
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        } else {
            next();
        }
    });
    
    // Add middleware to parse JSON bodies
    app.use(express.json());

    const transportMap = new Map<string, SSEServerTransport>();

    app.get("/sse", async (req, res) => {
        const transport = new SSEServerTransport("/messages", res);
        console.log(`[SSE] New SSE connection established with sessionId: ${transport.sessionId}`);
        transportMap.set(transport.sessionId, transport);
        console.log(`[SSE] Transport added to map. Total transports: ${transportMap.size}`);
        
        // 完整的连接清理函数
        const cleanup = () => {
            console.log(`[SSE] Connection cleanup for sessionId: ${transport.sessionId}`);
            transportMap.delete(transport.sessionId);
            console.log(`[SSE] Transport removed from map. Total transports: ${transportMap.size}`);
            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
            }
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }
        };

        // 监听所有可能的断连事件
        res.on('close', cleanup);
        res.on('error', (error) => {
            console.error(`[SSE] Connection error for sessionId: ${transport.sessionId}`, error);
            cleanup();
        });
        res.on('finish', cleanup);

        // 添加心跳机制 (每30秒发送一次心跳)
        const heartbeatInterval = setInterval(() => {
            try {
                res.write(': heartbeat\n\n');
            } catch (error) {
                console.error(`[SSE] Heartbeat failed for sessionId: ${transport.sessionId}`, error);
                cleanup();
            }
        }, 30000);

        // 添加连接超时保护 (10分钟)
        const connectionTimeout = setTimeout(() => {
            console.log(`[SSE] Connection timeout for sessionId: ${transport.sessionId}`);
            res.end();
        }, 600000);
        
        try {
            await mcpServer.connect(transport);
        } catch (error) {
            console.error(`[SSE] Error connecting to MCP server for sessionId: ${transport.sessionId}`, error);
            cleanup();
        }
    });

    app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId as string;
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
                await transport.handlePostMessage(req, res);
                console.log(`[SSE] Message handled successfully for sessionId: ${sessionId}`);
            } catch (error) {
                console.error(`[SSE] Error handling message for sessionId: ${sessionId}`, error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        } else {
            console.error(`[SSE] No transport found for sessionId: ${sessionId}`);
            res.status(404).json({ error: 'Session not found' });
        }
    });

    return app;
}
