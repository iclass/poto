# Dialogue Journal Eviction System Design

## Architecture Overview

The Dialogue Journal system now includes comprehensive **time-based eviction mechanisms** to prevent memory leaks and ensure optimal performance.

## System Components

### 1. **DialogueJournal Core Engine**

```
┌─────────────────────────────────────────────────────────────┐
│                    DialogueJournal                          │
├─────────────────────────────────────────────────────────────┤
│  • User-isolated conversation storage                      │
│  • Automatic timestamp tracking                            │
│  • Time-based eviction policies                            │
│  • Memory usage monitoring                                 │
│  • Automatic cleanup scheduler                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **User Isolation**: Each user has completely separate conversation storage
- **Timestamp Tracking**: All messages automatically get ISO timestamps
- **Activity Tracking**: Monitors user last activity for inactivity-based cleanup
- **Automatic Cleanup**: Runs every hour to remove old data
- **Memory Management**: Configurable limits and automatic trimming

### 2. **Eviction Policies**

#### **Time-Based Eviction**
```
Message Age Policy:
├── Default: 7 days (168 hours)
├── Configurable per cleanup operation
└── Messages older than threshold are removed

User Inactivity Policy:
├── Default: 30 days (720 hours)
├── Users inactive longer than threshold are removed
└── Entire conversation history deleted
```

#### **Size-Based Eviction**
```
Per-User Limits:
├── Max conversation length: 100 messages (default)
├── Automatic trimming when limit exceeded
└── Keeps most recent messages

System-Wide Limits:
├── Max conversations per user: 10 (default)
├── Memory usage monitoring
└── Automatic cleanup when limits exceeded
```

### 3. **Cleanup Mechanisms**

#### **Automatic Cleanup (Every Hour)**
```
┌─────────────────────────────────────────────────────────────┐
│                Automatic Cleanup Process                    │
├─────────────────────────────────────────────────────────────┤
│  1. Scan all user conversations                            │
│  2. Remove messages older than maxAgeHours                 │
│  3. Remove entire conversations for inactive users         │
│  4. Update user activity timestamps                        │
│  5. Log cleanup statistics                                 │
└─────────────────────────────────────────────────────────────┘
```

#### **Manual Cleanup Commands**
```
User Commands:
├── memstats          - Show memory usage statistics
├── cleanup <age> <inactive> [dry] - Manual cleanup with dry run
├── forcecleanup      - Force cleanup with default settings
└── convstats         - Show conversation statistics
```

### 4. **Memory Monitoring**

#### **Real-Time Statistics**
```
Memory Metrics:
├── Total Users: Number of active users
├── Total Messages: Total messages across all users
├── Memory Usage: Actual memory consumption in bytes
├── Average Messages/User: Load distribution
├── Inactive Users: Users not active in 24h
├── Oldest Message: Timestamp of oldest message
└── Newest Message: Timestamp of newest message
```

#### **Cleanup Reporting**
```
Cleanup Results:
├── Users Removed: Number of inactive users cleaned
├── Messages Removed: Number of old messages removed
├── Memory Freed: Bytes of memory reclaimed
└── Dry Run Support: Preview cleanup without execution
```

## Data Flow Architecture

### **Message Processing Flow**
```
1. User sends message
   ↓
2. Server adds timestamp automatically
   ↓
3. Message stored in user's conversation
   ↓
4. User activity timestamp updated
   ↓
5. Conversation trimmed if over limit
   ↓
6. LLM processes with full history context
   ↓
7. AI response added with timestamp
   ↓
8. Automatic cleanup runs periodically
```

### **Cleanup Decision Tree**
```
For each user conversation:
├── Is user inactive > maxInactiveHours?
│   ├── YES → Remove entire conversation
│   └── NO → Check individual messages
│       ├── Message age > maxAgeHours?
│       │   ├── YES → Remove message
│       │   └── NO → Keep message
│       └── Conversation length > maxLength?
│           ├── YES → Trim to maxLength
│           └── NO → Keep as-is
```

## Configuration Options

### **DialogueJournal Constructor**
```typescript
new DialogueJournal(
    maxConversationLength: 100,     // Max messages per conversation
    maxConversationsPerUser: 10,    // Max conversations per user
    maxConversationAgeHours: 168,   // 7 days default
    maxInactiveUserHours: 720       // 30 days default
)
```

### **Cleanup Options**
```typescript
cleanup({
    maxAgeHours?: number,           // Override default age limit
    maxInactiveHours?: number,      // Override default inactivity limit
    dryRun?: boolean                // Preview without execution
})
```

## Performance Characteristics

### **Memory Usage Patterns**
```
Without Eviction:
├── Linear growth with user count
├── Linear growth with conversation length
├── No automatic cleanup
└── Memory leaks over time

With Eviction:
├── Bounded memory usage
├── Automatic cleanup every hour
├── Configurable retention policies
└── Memory usage monitoring
```

### **Cleanup Performance**
```
Cleanup Frequency:
├── Automatic: Every hour
├── Manual: On-demand
├── Force: Emergency cleanup
└── Dry Run: Preview mode

Cleanup Scope:
├── Per-user message filtering
├── Inactive user removal
├── Memory usage calculation
└── Statistics reporting
```

## User Experience

### **Transparent Operation**
- Users don't notice cleanup happening
- Conversations persist across sessions
- Recent messages always available
- No data loss for active users

### **Admin Controls**
- Memory usage monitoring
- Manual cleanup triggers
- Dry run capabilities
- Detailed statistics reporting

### **Command Interface**
```
> memstats
🧠 Memory Statistics:
  Total Users: 15
  Total Messages: 1,247
  Memory Usage: 2.3 MB
  Average Messages/User: 83.13
  Inactive Users: 3
  Oldest Message: 12/1/2024, 9:30:00 AM
  Newest Message: 12/8/2024, 2:15:00 PM

> cleanup 24 72 dry
🧹 Performing cleanup (DRY RUN)...
  Max message age: 24 hours
  Max inactive time: 72 hours
✅ Cleanup completed:
  Users removed: 2
  Messages removed: 156
  Memory freed: 1.2 MB
💡 This was a dry run. Use without "dry" to perform actual cleanup.
```

## Security & Isolation

### **User Data Protection**
- Each user's data completely isolated
- No cross-user data access
- User authentication required for all operations
- Automatic cleanup respects user boundaries

### **Data Retention Policies**
- Configurable retention periods
- Automatic data expiration
- Secure data deletion
- No data leakage between users

## Production Considerations

### **Scalability**
- Memory usage bounded by configuration
- Automatic cleanup prevents memory leaks
- Horizontal scaling support
- Performance monitoring built-in

### **Monitoring**
- Real-time memory statistics
- Cleanup operation logging
- Performance metrics
- Alert thresholds (configurable)

### **Backup & Recovery**
- Export conversations before cleanup
- Configurable retention policies
- Emergency cleanup options
- Data recovery capabilities

## Implementation Benefits

### **Memory Management**
✅ **Bounded Memory Usage**: Configurable limits prevent unbounded growth
✅ **Automatic Cleanup**: Hourly cleanup removes old data automatically
✅ **User Isolation**: Each user's data completely separate
✅ **Activity Tracking**: Inactive users automatically cleaned up

### **Performance**
✅ **Constant Network Traffic**: Only current message sent (not full history)
✅ **Efficient Storage**: Time-based eviction prevents memory bloat
✅ **Fast Cleanup**: Optimized algorithms for large-scale cleanup
✅ **Memory Monitoring**: Real-time statistics and monitoring

### **User Experience**
✅ **Transparent Operation**: Users don't notice cleanup happening
✅ **Persistent Conversations**: Data persists across sessions
✅ **Admin Controls**: Manual cleanup and monitoring capabilities
✅ **No Data Loss**: Active users never lose recent conversations

This comprehensive eviction system ensures the Dialogue Journal remains performant and memory-efficient while providing users with persistent, reliable conversation storage.
