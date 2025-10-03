# Session Management Integration Guide

## Overview

The `ChatServerModule` now includes intelligent session management that automatically archives user dialogs when sessions end. Here's how to integrate it with different server types.

## 🔧 Session Detection Strategies

### 1. WebSocket Integration (Recommended)

```typescript
import { WebSocketServer } from 'ws';
import { ChatServerModule } from './ChatServerModule';

const chatModule = new ChatServerModule();
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws, req) => {
    // Extract user ID from request (JWT, session, etc.)
    const userId = extractUserIdFromRequest(req);
    const sessionId = generateSessionId();
    
    // Start user session
    chatModule.startUserSession(userId, sessionId);
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            // Update user activity
            chatModule.updateUserActivity(userId);
            
            // Process chat message
            for await (const response of chatModule.chatWithHistory(
                message.text, 
                message.jsonOutput, 
                message.reasoningEnabled
            )) {
                ws.send(JSON.stringify({ type: 'response', content: response }));
            }
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });
    
    // Detect disconnection
    ws.on('close', async (code, reason) => {
        console.log(`User ${userId} disconnected: ${code} ${reason}`);
        await chatModule.endUserSession(userId);
    });
    
    ws.on('error', async (error) => {
        console.log(`User ${userId} connection error:`, error);
        await chatModule.endUserSession(userId);
    });
});
```

### 2. HTTP Server Integration

```typescript
import express from 'express';
import { ChatServerModule } from './ChatServerModule';

const app = express();
const chatModule = new ChatServerModule();

// Middleware to track user sessions
app.use((req, res, next) => {
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
        chatModule.updateUserActivity(userId);
    }
    next();
});

// Chat endpoint
app.post('/chat', async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { message, jsonOutput, reasoningEnabled } = req.body;
    
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Start session if not exists
    if (!chatModule.getUserSessionInfo(userId)) {
        chatModule.startUserSession(userId, generateSessionId());
    }
    
    // Process chat
    const response = [];
    for await (const text of chatModule.chatWithHistory(message, jsonOutput, reasoningEnabled)) {
        response.push(text);
    }
    
    res.json({ response: response.join('') });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down, archiving all active sessions...');
    // Archive all active sessions
    for (const [userId] of chatModule.userSessions) {
        await chatModule.endUserSession(userId);
    }
    process.exit(0);
});
```

### 3. Server-Sent Events (SSE) Integration

```typescript
import express from 'express';
import { ChatServerModule } from './ChatServerModule';

const app = express();
const chatModule = new ChatServerModule();

app.get('/chat-stream/:userId', (req, res) => {
    const userId = req.params.userId;
    
    // Start user session
    chatModule.startUserSession(userId, generateSessionId());
    
    // Set up SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    
    // Handle client disconnect
    req.on('close', async () => {
        console.log(`SSE connection closed for user ${userId}`);
        await chatModule.endUserSession(userId);
    });
    
    // Send heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        res.write('data: {"type": "heartbeat"}\n\n');
    }, 30000);
    
    // Clean up on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
    });
});
```

## 🎯 Session Lifecycle

### 1. Session Start
```typescript
// When user connects
const sessionId = generateSessionId();
chatModule.startUserSession(userId, sessionId);
```

### 2. Activity Tracking
```typescript
// On every user interaction
chatModule.updateUserActivity(userId);
```

### 3. Session End Detection

#### Automatic (Recommended)
- **Inactivity timeout**: 5 minutes of no activity
- **Connection events**: WebSocket close, HTTP request end
- **Server shutdown**: Graceful cleanup

#### Manual
```typescript
// Explicitly end session
await chatModule.endUserSession(userId);
```

## 📊 Session Monitoring

### Get Session Statistics
```typescript
// Active session count
const activeCount = chatModule.getActiveSessionCount();

// User session info
const sessionInfo = chatModule.getUserSessionInfo(userId);
console.log(`User ${userId} last active: ${sessionInfo?.lastActivity}`);
```

### Session Events
```typescript
// Listen for session events
chatModule.on('sessionStarted', (userId, sessionId) => {
    console.log(`📱 User ${userId} started session ${sessionId}`);
});

chatModule.on('sessionEnded', (userId, archiveId) => {
    console.log(`📦 User ${userId} session ended, archived as ${archiveId}`);
});
```

## 🔄 Automatic Archival Process

### When Sessions End:
1. **Detect session end** (timeout, disconnect, error)
2. **Check for active conversation** in current dialog
3. **Archive conversation** if messages exist
4. **Clear current dialog** for next session
5. **Remove from active sessions**

### Archive Structure:
```
data/users/{userId}/dialogs/
├── current.yaml          # Active conversation (cleared after archival)
└── archived/
    ├── 2024-01-15-10-30-00.yaml  # Archived conversation
    └── 2024-01-15-14-45-00.yaml  # Another archived conversation
```

## ⚙️ Configuration

### Session Timeout Settings
```typescript
// In ChatServerModule constructor
private startSessionMonitoring(): void {
    const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const CHECK_INTERVAL = 30 * 1000; // 30 seconds
    
    // Monitor for inactive users
    setInterval(async () => {
        // Check and archive inactive sessions
    }, CHECK_INTERVAL);
}
```

### Environment Variables
```bash
# Session timeout (milliseconds)
SESSION_TIMEOUT=300000  # 5 minutes

# Check interval (milliseconds)  
SESSION_CHECK_INTERVAL=30000  # 30 seconds

# Auto-archive on disconnect
AUTO_ARCHIVE_ON_DISCONNECT=true
```

## 🚀 Production Deployment

### 1. Load Balancer Integration
```typescript
// Handle sticky sessions
app.use((req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
        // Route to same server instance
        req.sessionId = sessionId;
    }
    next();
});
```

### 2. Redis Session Store (Optional)
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Store session in Redis for multi-server support
async function storeSession(userId: string, sessionData: any) {
    await redis.setex(`session:${userId}`, 3600, JSON.stringify(sessionData));
}
```

### 3. Health Checks
```typescript
app.get('/health', (req, res) => {
    const activeSessions = chatModule.getActiveSessionCount();
    res.json({
        status: 'healthy',
        activeSessions,
        uptime: process.uptime()
    });
});
```

## 🔍 Debugging Session Management

### Enable Debug Logging
```typescript
// Set debug level
process.env.DEBUG = 'session:*';

// Or add custom logging
chatModule.on('sessionEvent', (event) => {
    console.log(`[SESSION] ${event.type}: ${event.userId}`);
});
```

### Monitor Session States
```typescript
// Get all active sessions
const sessions = Array.from(chatModule.userSessions.entries());
console.log('Active sessions:', sessions.map(([id, session]) => ({
    userId: id,
    lastActivity: session.lastActivity,
    isActive: session.isActive
})));
```

This session management system ensures that user dialogs are automatically archived when sessions end, providing a clean separation between conversation sessions and maintaining conversation history for future reference.
