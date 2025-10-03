# Enhanced ParentRpcBridge with Iframe Responders

## Overview

The enhanced `ParentRpcBridge` now includes a sophisticated iframe responder system that allows you to register iframe responder objects before falling back to global scope methods. This provides fine-grained control over how different iframes interact with the parent window.

## Key Features

- **Iframe Responder Objects**: Register complete objects that provide methods for specific iframes
- **Global Iframe Responder**: Register a responder object that applies to all iframes
- **Automatic Fallback**: Gracefully fall back to global scope methods if no iframe responder is found
- **Smart Iframe Identification**: Multiple strategies to identify iframe sources
- **Type Safety**: Full TypeScript support with proper typing
- **Debugging Support**: Built-in debugging and inspection capabilities

## Architecture

```
┌─────────────────┐    RPC Request    ┌─────────────────┐
│   Iframe A      │ ─────────────────► │   Parent        │
│   (slidev)      │                   │   Window        │
└─────────────────┘                   │                 │
                                      │ 1. Check iframe- │
┌─────────────────┐    RPC Request    │    specific      │
│   Iframe B      │ ─────────────────► │    responder    │
│   (chat)        │                   │                 │
└─────────────────┘                   │ 2. Check global │
                                      │    iframe        │
┌─────────────────┐    RPC Request    │    responder    │
│   Iframe C      │ ─────────────────► │                 │
│   (ai-assistant)│                   │ 3. Fall back to │
└─────────────────┘                   │    global scope │
                                      └─────────────────┘
```

## Quick Start

### 1. Basic Setup

```typescript
import { ParentRpcBridge, IframeResponder } from './ParentRpcBridge';
import { PotoConstants } from '../../shared/PotoConstants';

// Create the bridge
const bridge = new ParentRpcBridge(PotoConstants.routePrefix);

// Define a global responder object (applies to all iframes)
const globalResponder: IframeResponder = {
  async getUserPreferences() {
    return {
      theme: localStorage.getItem('theme') || 'light',
      language: localStorage.getItem('language') || 'zh-CN',
      userId: localStorage.getItem('userId') || 'anonymous'
    };
  },
  
  async showNotification(message: string, type: string = 'info') {
    console.log(`Notification: ${type.toUpperCase()}: ${message}`);
    return { success: true };
  }
};

// Register global responder
bridge.registerGlobalIframeResponder(globalResponder);

// Define a slidev-specific responder object
const slidevResponder: IframeResponder = {
  async getSlideInfo() {
    return { currentSlide: 1, totalSlides: 10, slideTitle: 'Introduction' };
  },
  
  async navigateToSlide(slideNumber: number) {
    return { success: true, currentSlide: slideNumber };
  }
};

// Register iframe-specific responder
bridge.registerIframeResponder('slidev-iframe', slidevResponder);
```

### 2. Responder Priority

The bridge processes requests in this order:

1. **Iframe-Specific Responders**: If the iframe can be identified and has a specific responder
2. **Global Iframe Responder**: If a global responder exists for the method
3. **Global Scope Methods**: Fall back to window object methods

### 3. Iframe Identification Strategies

The bridge uses multiple strategies to identify iframe sources:

1. **DOM Element Matching**: Finds iframe by comparing `contentWindow`
2. **Message Data**: Checks for `_iframeId` in the message data
3. **Origin-Based**: Uses the message origin as identifier

## API Reference

### Core Methods

#### `registerIframeResponder(iframeId, responder)`

Registers a responder object for a specific iframe.

```typescript
const slidevResponder: IframeResponder = {
  async getSlideInfo() {
    return { currentSlide: 1, totalSlides: 10 };
  },
  async navigateToSlide(slideNumber: number) {
    return { success: true, currentSlide: slideNumber };
  }
};

bridge.registerIframeResponder('slidev-iframe', slidevResponder);
```

#### `registerGlobalIframeResponder(responder)`

Registers a responder object that applies to all iframes.

```typescript
const globalResponder: IframeResponder = {
  async getUserPreferences() {
    return { theme: 'light', language: 'zh-CN' };
  },
  async showNotification(message: string) {
    console.log('Notification:', message);
    return { success: true };
  }
};

bridge.registerGlobalIframeResponder(globalResponder);
```

#### `unregisterIframeResponder(iframeId)`

Unregisters a specific iframe responder.

```typescript
bridge.unregisterIframeResponder('slidev-iframe');
```

#### `unregisterGlobalIframeResponder()`

Unregisters the global iframe responder.

```typescript
bridge.unregisterGlobalIframeResponder();
```

#### `getIframeResponders()`

Returns all registered responders for debugging.

```typescript
const responders = bridge.getIframeResponders();
console.log('Global responder:', responders.global ? Object.keys(responders.global) : null);
console.log('Iframe-specific responders:', responders.iframeSpecific);
```

### Responder Object Interface

```typescript
interface IframeResponder {
  [method: string]: (...args: any[]) => Promise<any> | any;
}
```

Responder methods can be:
- **Synchronous**: Return values directly
- **Asynchronous**: Return promises
- **Error-throwing**: Throw errors for proper error handling

## Usage Examples

### 1. Slidev Iframe Integration

```typescript
// Define slidev-specific responder
const slidevResponder: IframeResponder = {
  async getSlideInfo() {
    return {
      currentSlide: 1,
      totalSlides: 10,
      slideTitle: 'Introduction',
      source: 'slidev-specific-responder'
    };
  },

  async navigateToSlide(slideNumber: number) {
    // Implement slide navigation logic
    return { success: true, currentSlide: slideNumber };
  },

  async getSlideContent(slideId: string) {
    // Fetch slide content from your data source
    return {
      id: slideId,
      content: 'Slide content here',
      metadata: { type: 'text', duration: 30 }
    };
  },

  async getCurrentSlideContent() {
    return {
      title: 'Current Slide',
      content: 'This is the current slide content',
      metadata: { slideNumber: 1, totalSlides: 10 }
    };
  }
};

// Register the responder
bridge.registerIframeResponder('slidev-iframe', slidevResponder);
```

### 2. Chat Iframe Integration

```typescript
// Define chat-specific responder
const chatResponder: IframeResponder = {
  async getChatHistory() {
    return {
      messages: [
        { id: 1, text: 'Hello', timestamp: Date.now() - 1000 },
        { id: 2, text: 'How can I help?', timestamp: Date.now() }
      ],
      source: 'chat-specific-responder'
    };
  },

  async sendMessage(message: string) {
    // Implement message sending logic
    return { success: true, messageId: Date.now() };
  },

  async getUnreadCount() {
    return { unreadCount: 5, lastMessageTime: Date.now() };
  }
};

// Register the responder
bridge.registerIframeResponder('chat-iframe', chatResponder);
```

### 3. AI Assistant Iframe Integration

```typescript
// Define AI assistant-specific responder
const aiAssistantResponder: IframeResponder = {
  async getAssistantState() {
    return {
      isActive: true,
      currentTask: 'idle',
      lastActivity: Date.now(),
      source: 'ai-assistant-specific-responder'
    };
  },

  async triggerAction(action: string, params: any) {
    // Implement AI assistant action logic
    return { success: true, action, result: 'Action completed' };
  },

  async processUserInput(input: string) {
    return {
      processed: true,
      response: `Processed: ${input}`,
      timestamp: Date.now()
    };
  }
};

// Register the responder
bridge.registerIframeResponder('ai-assistant-iframe', aiAssistantResponder);
```

### 4. Global Responder for Common Operations

```typescript
// Define global responder
const globalResponder: IframeResponder = {
  // Global notification handler
  async showNotification(message: string, type: string = 'info') {
    console.log(`[Global Responder] Notification: ${type.toUpperCase()}: ${message}`);
    
    // Integrate with your notification system
    if (type === 'error') {
      console.error(`[Global Error Notification] ${message}`);
    }
    
    return { success: true, message: 'Notification handled' };
  },

  // Global user preferences handler
  async getUserPreferences() {
    return {
      theme: localStorage.getItem('theme') || 'light',
      language: localStorage.getItem('language') || 'zh-CN',
      userId: localStorage.getItem('userId') || 'anonymous',
      source: 'global-responder'
    };
  },

  // Context-aware handler
  async getContextualInfo(context?: string) {
    const baseInfo = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent.substring(0, 50) + '...',
      viewport: { width: window.innerWidth, height: window.innerHeight }
    };

    switch (context) {
      case 'slidev':
        return { ...baseInfo, context: 'slidev', features: ['navigation', 'presentation'] };
      case 'chat':
        return { ...baseInfo, context: 'chat', features: ['messaging', 'history'] };
      case 'ai-assistant':
        return { ...baseInfo, context: 'ai-assistant', features: ['ai', 'automation'] };
      default:
        return { ...baseInfo, context: 'default', features: ['basic'] };
    }
  }
};

// Register global responder
bridge.registerGlobalIframeResponder(globalResponder);
```

## Advanced Usage

### 1. Type-Safe Responders

```typescript
// Define type-safe interfaces
interface SlidevResponder extends IframeResponder {
  getSlideInfo(): Promise<{ currentSlide: number; totalSlides: number; slideTitle: string }>;
  navigateToSlide(slideNumber: number): Promise<{ success: boolean; currentSlide: number }>;
  getSlideContent(slideId: string): Promise<{ id: string; content: string; metadata: any }>;
}

interface ChatResponder extends IframeResponder {
  getChatHistory(): Promise<{ messages: Array<{ id: number; text: string; timestamp: number }> }>;
  sendMessage(message: string): Promise<{ success: boolean; messageId: number }>;
  getUnreadCount(): Promise<{ unreadCount: number; lastMessageTime: number }>;
}

// Create type-safe responders
const slidevResponder: SlidevResponder = {
  async getSlideInfo() {
    return { currentSlide: 1, totalSlides: 10, slideTitle: 'Introduction' };
  },
  async navigateToSlide(slideNumber: number) {
    return { success: true, currentSlide: slideNumber };
  },
  async getSlideContent(slideId: string) {
    return { id: slideId, content: 'Content', metadata: {} };
  }
};

const chatResponder: ChatResponder = {
  async getChatHistory() {
    return { messages: [] };
  },
  async sendMessage(message: string) {
    return { success: true, messageId: Date.now() };
  },
  async getUnreadCount() {
    return { unreadCount: 0, lastMessageTime: Date.now() };
  }
};

// Register type-safe responders
bridge.registerIframeResponder('slidev-iframe', slidevResponder);
bridge.registerIframeResponder('chat-iframe', chatResponder);
```

### 2. Dynamic Responders

```typescript
// Create a dynamic responder that can be updated
let slidevResponder: IframeResponder = {
  async getSlideInfo() {
    return { currentSlide: 1, totalSlides: 10 };
  }
};

// Register the initial responder
bridge.registerIframeResponder('slidev-iframe', slidevResponder);

// Function to update the responder dynamically
function updateSlidevResponder(newMethods: Partial<IframeResponder>) {
  slidevResponder = { ...slidevResponder, ...newMethods };
  bridge.registerIframeResponder('slidev-iframe', slidevResponder);
  console.log('[Dynamic] Updated slidev responder with new methods:', Object.keys(newMethods));
}

// Example: Add a new method to the responder
updateSlidevResponder({
  async getSlideMetadata(slideId: string) {
    return { id: slideId, title: 'Dynamic Slide', created: Date.now() };
  }
});
```

### 3. Conditional Responders

```typescript
// Create a conditional responder that behaves differently based on iframe
const conditionalResponder: IframeResponder = {
  async getData(context?: string) {
    switch (context) {
      case 'slidev':
        return { type: 'slide', data: 'slide-specific-data' };
      case 'chat':
        return { type: 'message', data: 'chat-specific-data' };
      case 'ai-assistant':
        return { type: 'ai', data: 'ai-specific-data' };
      default:
        return { type: 'generic', data: 'default-data' };
    }
  },

  async performAction(action: string, iframeType?: string) {
    const actions = {
      slidev: ['next', 'prev', 'goto'],
      chat: ['send', 'receive', 'clear'],
      'ai-assistant': ['process', 'analyze', 'respond']
    };

    const allowedActions = actions[iframeType as keyof typeof actions] || [];
    
    if (allowedActions.includes(action)) {
      return { success: true, action, iframeType };
    } else {
      return { success: false, error: `Action ${action} not allowed for ${iframeType}` };
    }
  }
};

// Register as global responder
bridge.registerGlobalIframeResponder(conditionalResponder);
```

### 4. Error Handling

```typescript
const errorHandlingResponder: IframeResponder = {
  async performRiskyOperation(operation: string) {
    try {
      // Simulate a risky operation
      if (operation === 'throw-error') {
        throw new Error('Simulated error for testing');
      }
      
      return { success: true, operation, result: 'Operation completed successfully' };
    } catch (error) {
      console.error(`[Responder] Error in risky operation:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async processData(data: any) {
    // Step 1: Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }
    
    // Step 2: Transform data
    const transformed = { ...data, processedAt: Date.now() };
    
    // Step 3: Store data
    localStorage.setItem('processedData', JSON.stringify(transformed));
    
    return { success: true, data: transformed };
  }
};
```

## Debugging and Monitoring

### 1. View All Registered Responders

```typescript
const responders = bridge.getIframeResponders();
console.log('=== Registered Iframe Responders ===');
console.log('Global responder:', responders.global ? Object.keys(responders.global) : null);
console.log('Iframe-specific responders:', Object.fromEntries(
  Object.entries(responders.iframeSpecific).map(([id, responder]) => [id, Object.keys(responder)])
));
```

### 2. Enable Debug Logging

The bridge automatically logs responder registrations and usage:

```
[ParentRpcBridge] Registered iframe responder for: slidev-iframe ["getSlideInfo", "navigateToSlide"]
[ParentRpcBridge] Registered global iframe responder: ["getUserPreferences", "showNotification"]
[ParentRpcBridge] Using iframe-specific responder: slidev-iframe.getSlideInfo
[ParentRpcBridge] Using global iframe responder: getUserPreferences
[ParentRpcBridge] Using global scope method: getWindowSize
```

### 3. Responder Performance Monitoring

```typescript
const monitoredResponder: IframeResponder = {
  async monitoredMethod(...args) {
    const startTime = performance.now();
    
    try {
      const result = await someAsyncOperation(...args);
      const duration = performance.now() - startTime;
      console.log(`[Performance] monitoredMethod took ${duration}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`[Performance] monitoredMethod failed after ${duration}ms:`, error);
      throw error;
    }
  }
};
```

## Best Practices

### 1. Responder Organization

- Group related methods in a single responder object
- Use descriptive method names
- Keep responders focused on specific functionality
- Use consistent naming conventions

### 2. Error Handling

- Always handle errors gracefully within responder methods
- Return meaningful error messages
- Log errors for debugging
- Provide fallback behavior when possible

### 3. Performance

- Keep responder methods lightweight
- Use async/await for I/O operations
- Cache expensive operations
- Monitor responder performance

### 4. Security

- Validate all input parameters
- Sanitize data before processing
- Implement proper access controls
- Log security-relevant events

### 5. Maintenance

- Clean up responders when no longer needed
- Use consistent patterns across responders
- Document complex responder logic
- Test responders thoroughly

## Migration from Basic ParentRpcBridge

If you're upgrading from the basic ParentRpcBridge:

1. **No Breaking Changes**: All existing functionality remains the same
2. **Gradual Migration**: Add iframe responders incrementally
3. **Backward Compatibility**: Global scope methods still work as before
4. **Enhanced Functionality**: New iframe-specific capabilities available

## Troubleshooting

### Common Issues

1. **Responder Not Found**: Check if the iframe ID matches exactly
2. **Method Not Executing**: Verify the responder is registered correctly
3. **Iframe Not Identified**: Check iframe identification strategies
4. **Performance Issues**: Monitor responder execution time

### Debug Steps

1. Check registered responders: `bridge.getIframeResponders()`
2. Verify iframe identification: Check console logs
3. Test responder registration: Use simple test responders
4. Monitor message flow: Check browser dev tools

## Integration with Existing Code

The enhanced ParentRpcBridge is designed to work seamlessly with existing code:

```typescript
// Existing code continues to work
const bridge = new ParentRpcBridge(PotoConstants.routePrefix);
const serverProxy = bridge.getServerProxy<AiSliderServer>('AiSliderServer');

// New iframe responder functionality
const customResponder: IframeResponder = {
  async customMethod() {
    return { custom: 'data' };
  }
};
bridge.registerIframeResponder('my-iframe', customResponder);
```

This enhancement provides powerful iframe-specific control while maintaining full backward compatibility with existing ParentRpcBridge usage. 