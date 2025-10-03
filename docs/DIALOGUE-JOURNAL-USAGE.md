# Dialogue Journal Usage Guide

## Overview

The Poto dialogue journal system provides persistent, high-performance conversation storage with support for multiple backends. By default, it uses the **filesystem backend** for production-ready persistent storage.

## Quick Start

### Default Configuration (Filesystem)

The system automatically uses the filesystem journal with these defaults:

```typescript
// Default filesystem configuration
{
  root: "./data/dialogues",
  maxConversationLength: 1000,
  maxConversationsPerUser: 50,
  archiveThreshold: 100,
  retentionDays: 365,
  lockTimeoutMs: 5000,
  serverId: "server-001"
}
```

### Using YAML Configuration

Create a `poto.config.yaml` file in your project root:

```yaml
dialogueJournal:
  backend: "filesystem"
  filesystem:
    root: "./data"  # Users will be stored under data/users/.../dialogs/...
    maxConversationLength: 1000
    maxConversationsPerUser: 50
    archiveThreshold: 100
    retentionDays: 365
    lockTimeoutMs: 5000
    serverId: "server-001"
```

### Using Environment Variables

```bash
# Set backend (default: filesystem)
DIALOGUE_JOURNAL_BACKEND=filesystem

# Filesystem configuration
DIALOGUE_JOURNAL_ROOT=./data
DIALOGUE_JOURNAL_MAX_CONVERSATION_LENGTH=1000
DIALOGUE_JOURNAL_MAX_CONVERSATIONS_PER_USER=50
DIALOGUE_JOURNAL_ARCHIVE_THRESHOLD=100
DIALOGUE_JOURNAL_RETENTION_DAYS=365
DIALOGUE_JOURNAL_LOCK_TIMEOUT_MS=5000
DIALOGUE_JOURNAL_SERVER_ID=server-001
```

## File System Structure

The filesystem journal creates the following directory structure:

```
data/
├── users/
│   ├── user-12345/
│   │   ├── dialogs/
│   │   │   ├── current.yaml      # Active conversation
│   │   │   └── archived/         # Archived conversations
│   │   │       ├── 2024-01-15.yaml
│   │   │       └── 2024-01-14.yaml
│   │   ├── metadata.yaml         # User metadata
│   │   └── [other user data]/    # Future: settings, preferences, etc.
│   └── user-67890/
│       ├── dialogs/
│       │   ├── current.yaml
│       │   └── archived/
│       └── [other user data]/
├── system/
│   ├── stats.yaml               # System statistics
│   └── cleanup.log              # Cleanup operations log
└── config/
    └── journal-config.yaml
```

## Conversation Format

Each conversation is stored as a YAML file with multiple documents:

```yaml
role: user
content: |
  Hello! I need help with TypeScript async/await patterns.
timestamp: "2024-01-15T10:30:00.000Z"
metadata:
  model: "gpt-4"
  tokens: 18
  processingTime: 1200
---
role: assistant
content: |
  I'd be happy to help you with async/await patterns in TypeScript!
  
  Here are the key concepts:
  
  1. **Async Functions**: Functions declared with `async` return a Promise
  2. **Await Keyword**: Used inside async functions to wait for Promise resolution
  3. **Error Handling**: Use try/catch blocks for error handling
  
  ```typescript
  async function fetchData() {
    try {
      const response = await fetch('/api/data');
      return await response.json();
    } catch (error) {
      console.error('Error:', error);
    }
  }
  ```
timestamp: "2024-01-15T10:30:02.500Z"
metadata:
  model: "gpt-4"
  tokens: 95
  processingTime: 1800
```

## Key Features

### 1. High Performance
- **Raw file append operations** for maximum speed
- **Batch message processing** (5x faster for multiple messages)
- **Single file reads** for entire conversations
- **Minimal serialization overhead**

### 2. Multi-Server Safety
- **OS file locking** for concurrent access
- **Append-only operations** prevent corruption
- **Atomic file operations** ensure data integrity
- **Conflict resolution** for simultaneous writes

### 3. Human-Readable Format
- **YAML literal text blocks** preserve formatting
- **Code examples** maintain proper indentation
- **Markdown formatting** preserved
- **Easy manual inspection** and debugging

### 4. Archival System
- **Automatic archiving** when conversation length exceeds threshold
- **Manual archival** support
- **Archive restoration** capability
- **Metadata tracking** for archived conversations

## API Usage

### Basic Operations

```typescript
import { ChatServerModule } from './ChatServerModule';

const chatModule = new ChatServerModule();

// Add a message
await chatModule.dialogueJournal.addMessage(user, {
  role: 'user',
  content: 'Hello!',
  timestamp: new Date().toISOString()
});

// Get conversation
const conversation = await chatModule.dialogueJournal.getConversation(user);

// Clear conversation
await chatModule.dialogueJournal.clearConversation(user);
```

### Advanced Operations

```typescript
// Archive conversation
const archiveId = await chatModule.dialogueJournal.archiveConversation(user);

// Get archived conversations
const archives = await chatModule.dialogueJournal.getArchivedConversations(user);

// Restore archived conversation
await chatModule.dialogueJournal.restoreConversation(user, archiveId);

// Export conversation
const jsonExport = await chatModule.dialogueJournal.exportConversation(user, 'json');
const csvExport = await chatModule.dialogueJournal.exportConversation(user, 'csv');

// Get statistics
const stats = await chatModule.dialogueJournal.getStats();
```

### Cleanup Operations

```typescript
// Manual cleanup
const result = await chatModule.dialogueJournal.cleanup({
  maxAgeHours: 168,      // 7 days
  maxInactiveHours: 720, // 30 days
  dryRun: false
});

console.log(`Removed ${result.usersRemoved} users, ${result.messagesRemoved} messages`);
```

## Configuration Options

### Filesystem Backend

| Option | Default | Description |
|--------|---------|-------------|
| `root` | `./data/dialogues` | Root directory for dialogue storage |
| `maxConversationLength` | `1000` | Maximum messages per conversation |
| `maxConversationsPerUser` | `50` | Maximum conversations per user |
| `archiveThreshold` | `100` | Auto-archive when conversation exceeds this length |
| `retentionDays` | `365` | How long to keep archived conversations |
| `lockTimeoutMs` | `5000` | File lock timeout in milliseconds |
| `serverId` | `server-001` | Unique server identifier |

### Memory Backend (Development)

| Option | Default | Description |
|--------|---------|-------------|
| `maxConversationLength` | `100` | Maximum messages per conversation |
| `maxConversationsPerUser` | `10` | Maximum conversations per user |
| `maxConversationAgeHours` | `168` | Maximum age of messages (7 days) |
| `maxInactiveUserHours` | `720` | Maximum inactive user time (30 days) |

## Production Deployment

### Directory Permissions

```bash
# Create data directory
mkdir -p /var/lib/poto
chown -R poto:poto /var/lib/poto
chmod -R 755 /var/lib/poto
```

### Environment Variables

```bash
# Production configuration
DIALOGUE_JOURNAL_BACKEND=filesystem
DIALOGUE_JOURNAL_ROOT=/var/lib/poto
DIALOGUE_JOURNAL_MAX_CONVERSATION_LENGTH=1000
DIALOGUE_JOURNAL_MAX_CONVERSATIONS_PER_USER=50
DIALOGUE_JOURNAL_ARCHIVE_THRESHOLD=100
DIALOGUE_JOURNAL_RETENTION_DAYS=365
DIALOGUE_JOURNAL_SERVER_ID=prod-server-001
```

### Monitoring

```typescript
// Get system statistics
const stats = await chatModule.getDialogueJournalStats();
console.log(`Total users: ${stats.totalUsers}`);
console.log(`Total messages: ${stats.totalMessages}`);
console.log(`Storage usage: ${stats.memoryUsage} bytes`);
```

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure the dialogue journal directory is writable
2. **Disk Space**: Monitor storage usage and implement cleanup
3. **File Locks**: Check for stale file locks in multi-server deployments
4. **YAML Parsing**: Verify YAML format is valid for conversation files

### Debugging

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Check conversation file directly
const fs = require('fs');
const content = fs.readFileSync('./data/dialogues/users/user-123/current.yaml', 'utf-8');
console.log(content);
```

## Migration

### From Memory to Filesystem

```typescript
// Export from memory journal
const memoryJournal = new VolatileMemoryDialogueJournal(config);
const conversation = await memoryJournal.getConversation(user);
const exportData = await memoryJournal.exportConversation(user, 'json');

// Import to filesystem journal
const fsJournal = new FileSystemDialogueJournal(config);
await fsJournal.importConversation(user, exportData, 'json');
```

This dialogue journal system provides a robust, scalable foundation for conversation storage with excellent performance and human-readable format!
