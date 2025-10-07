# SSE-Based Dialog Archiving Implementation

## Overview

This implementation provides **lightweight, automatic dialog archiving** using Server-Sent Events (SSE) disconnect detection. When a user disconnects from the SSE connection, their current dialog is automatically archived.

## 🎯 Architecture

### **SSE Connection Lifecycle:**

```
User Connects → SSE Established → Chat Activity → User Disconnects → Dialog Archived
     ↓              ↓                ↓              ↓                ↓
  onSseConnect  startUserSession  updateActivity  onSseDisconnect  endUserSession
```

### **Key Components:**

1. **PotoServer**: Handles SSE connections and disconnect events
2. **ChatServerModule**: Manages user sessions and dialog archiving
3. **FileSystemDialogueJournal**: Stores and archives conversations

## 🔧 Implementation Details

### **1. SSE Connection Detection**

**PotoServer.handleSubscribe():**
```typescript
// When user connects via SSE
this.subscriptions.set(userId, controller)
this.notifySseConnect(userId)  // → ChatServerModule.onSseConnect()

// When user disconnects
req.signal.addEventListener("abort", async () => {
    if (this.sseDisconnectHandler) {
        await this.sseDisconnectHandler(userId);  // → ChatServerModule.endUserSession()
    }
    this.subscriptions.delete(userId)
    controller.close();
});
```

### **2. Session Management**

**ChatServerModule Session Lifecycle:**
```typescript
// SSE Connect → Start Session
onSseConnect(userId: string): void {
    const conversationId = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startUserSession(userId, conversationId);
}

// Chat Activity → Update Activity
updateUserActivity(userId: string): void {
    const session = this.userSessions.get(userId);
    if (session) {
        session.lastActivity = new Date();
    }
}

// SSE Disconnect → Archive Dialog
async endUserSession(userId: string): Promise<void> {
    const session = this.userSessions.get(userId);
    if (session && session.isActive) {
        session.isActive = false;
        await this.archiveUserDialog(userId);  // Archive current dialog
        this.userSessions.delete(userId);
    }
}
```

### **3. Dialog Archiving Process**

**Automatic Archival:**
```typescript
private async archiveUserDialog(userId: string): Promise<void> {
    try {
        const user = { id: userId, name: 'User', email: 'user@example.com' };
        const conversation = await this.dialogueJournal.getConversation(user);
        
        if (conversation.length > 0) {
            const archiveId = await this.dialogueJournal.archiveConversation(user);
            console.log(`📦 Archived conversation ${archiveId} for user ${userId}`);
        }
    } catch (error) {
        console.error(`❌ Error archiving dialog for user ${userId}:`, error);
    }
}
```

## 🚀 Benefits of SSE Approach

### **1. Lightweight & Efficient**
- **No WebSocket overhead**: SSE is simpler and more efficient
- **Built-in reconnection**: Browser handles SSE reconnection automatically
- **HTTP-based**: Works through firewalls and proxies
- **One-way communication**: Perfect for server-to-client notifications

### **2. Automatic Detection**
- **Browser disconnect**: Automatic detection when user closes tab/browser
- **Network issues**: Detects connection drops and timeouts
- **Server restart**: Graceful handling of server restarts
- **No polling**: Event-driven, no background polling needed

### **3. Production Ready**
- **Scalable**: Works with load balancers and multiple servers
- **Reliable**: Built-in error handling and reconnection
- **Monitoring**: Easy to track connection status
- **Debugging**: Clear logs for connection events

## 📊 File Structure After Archiving

### **Before Disconnect:**
```
data/users/a1/dialogs/
├── current.yaml          # Active conversation
└── archived/             # Empty or previous archives
```

### **After Disconnect:**
```
data/users/a1/dialogs/
├── current.yaml          # Cleared for next session
└── archived/
    ├── 2024-01-15-10-30-00.yaml  # Archived conversation
    └── 2024-01-15-14-45-00.yaml  # Previous archive
```

## 🔄 Complete Flow Example

### **1. User Connects:**
```bash
# Client connects to SSE
curl -H "Authorization: Bearer token" http://localhost:3799/subscribe

# Server logs:
📱 User a1 started session sse-1704110400000-abc123def
```

### **2. User Chats:**
```bash
# User sends message
POST /ChatServerModule/chatWithHistory
{"message": "Hello!", "jsonOutput": false, "reasoningEnabled": false}

# Server logs:
📱 User a1 activity updated
📝 Message added to dialogue journal
```

### **3. User Disconnects:**
```bash
# User closes browser/tab or network drops
# Server automatically detects disconnect

# Server logs:
🔌 SSE disconnect detected for user: a1
📦 Archived conversation 2024-01-15-10-30-00 for user a1
✅ Dialog archived for user: a1
```

## ⚙️ Configuration

### **Session Timeout (Fallback)**
```typescript
// In ChatServerModule
private startSessionMonitoring(): void {
    const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const CHECK_INTERVAL = 30 * 1000; // 30 seconds
    
    // Fallback for missed disconnect events
    setInterval(async () => {
        // Check for inactive users and archive
    }, CHECK_INTERVAL);
}
```

### **Environment Variables**
```bash
# Session timeout (milliseconds)
SESSION_TIMEOUT=300000  # 5 minutes

# Check interval (milliseconds)
SESSION_CHECK_INTERVAL=30000  # 30 seconds

# Debug SSE events
DEBUG_SSE=true
```

## 🧪 Testing the Implementation

### **1. Test SSE Connection:**
```bash
# Connect to SSE endpoint
curl -H "Authorization: Bearer test-token" \
     -H "Accept: text/event-stream" \
     http://localhost:3799/subscribe
```

### **2. Test Chat Activity:**
```bash
# Send chat message
curl -X POST http://localhost:3799/ChatServerModule/chatWithHistory \
     -H "Authorization: Bearer test-token" \
     -H "Content-Type: application/json" \
     -d '{"message": "Test message", "jsonOutput": false, "reasoningEnabled": false}'
```

### **3. Test Disconnect Detection:**
```bash
# Close the SSE connection (Ctrl+C)
# Server should automatically archive the dialog
```

## 🔍 Monitoring & Debugging

### **Connection Status:**
```typescript
// Get active session count
const activeCount = chatModule.getActiveSessionCount();

// Get user session info
const sessionInfo = chatModule.getUserSessionInfo(userId);
console.log(`User ${userId} last active: ${sessionInfo?.lastActivity}`);
```

### **Debug Logs:**
```bash
# Enable debug logging
DEBUG=session:* bun run start-server

# Monitor SSE events
tail -f logs/server.log | grep "SSE\|session\|archive"
```

## 🚀 Production Deployment

### **1. Load Balancer Configuration:**
```nginx
# Nginx configuration for SSE
location /subscribe {
    proxy_pass http://backend;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
}
```

### **2. Health Checks:**
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

### **3. Graceful Shutdown:**
```typescript
process.on('SIGTERM', async () => {
    console.log('Shutting down, archiving all active sessions...');
    for (const [userId] of chatModule.userSessions) {
        await chatModule.endUserSession(userId);
    }
    process.exit(0);
});
```

## 🎯 Key Advantages

1. **✅ Lightweight**: No WebSocket complexity
2. **✅ Automatic**: No manual intervention needed
3. **✅ Reliable**: Built-in browser reconnection
4. **✅ Scalable**: Works with load balancers
5. **✅ Efficient**: Event-driven, no polling
6. **✅ Production-ready**: Comprehensive error handling

This SSE-based approach provides a **lightweight, reliable solution** for automatic dialog archiving that integrates seamlessly with the existing PotoClient SSE connection! 🎉
