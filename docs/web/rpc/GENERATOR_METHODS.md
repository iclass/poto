# Generator Methods in PotoServer

The PotoServer now supports **async generator methods** for even simpler streaming code! This feature allows you to write streaming endpoints using natural async generator syntax without manually creating ReadableStreams.

## 🎯 **Overview**

Instead of manually creating ReadableStreams with controllers, you can now write streaming methods using async generators:

### **Before (Manual ReadableStream)**
```typescript
async postCounter_(count: number, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
    return new ReadableStream({
        start(controller) {
            let current = 1;
            const interval = setInterval(() => {
                if (current > count) {
                    controller.close();
                    clearInterval(interval);
                    return;
                }
                
                const chunk = JSON.stringify({ number: current, timestamp: new Date().toISOString() });
                controller.enqueue(new TextEncoder().encode(chunk + '\n'));
                current++;
            }, 100);
        }
    });
}
```

### **After (Generator Method)**
```typescript
async *postCounter_(count: number, user: PotoUser) {
    for (let i = 1; i <= count; i++) {
        yield { number: i, timestamp: new Date().toISOString() };
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
```

## 🚀 **How It Works**

The PotoServer automatically detects when a method returns an AsyncGenerator and converts it to a ReadableStream using SSE formatting:

1. **Method Detection**: Server checks if the result is an AsyncGenerator
2. **Automatic Conversion**: Uses `generatorToSseStream()` to convert generator to ReadableStream
3. **SSE Formatting**: Automatically wraps each yielded item in SSE format: `data: {...}\n\n`
4. **Stream Response**: Returns the stream with proper headers

## 📝 **Method Signature**

Generator methods should follow this pattern:

```typescript
async *methodName_(param1: type1, param2: type2, user: PotoUser) {
    // Use yield to send data
    yield { type: "data", content: "some data" };
    
    // Use await for async operations
    await someAsyncOperation();
    
    // Yield more data
    yield { type: "complete", message: "done" };
}
```

### **Key Points:**
- **Return Type**: No explicit return type needed (inferred as `AsyncGenerator`)
- **Method Naming**: Follow the `verbNoun_` pattern (e.g., `postCounter_`, `getData_`)
- **Parameters**: Include `user: PotoUser` as the last parameter
- **Yielding**: Use `yield` to send data to the client
- **Async Operations**: Use `await` for any async operations

## 🎨 **Examples**

### **1. Simple Counter**
```typescript
async *postCounter_(count: number, user: PotoUser) {
    for (let i = 1; i <= count; i++) {
        yield { number: i, timestamp: new Date().toISOString() };
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
```

### **2. Progress Tracking**
```typescript
async *postProgress_(steps: number, user: PotoUser) {
    for (let i = 0; i < steps; i++) {
        const progress = Math.round(((i + 1) / steps) * 100);
        
        yield {
            type: "progress",
            step: i + 1,
            total: steps,
            progress,
            message: `Processing step ${i + 1} of ${steps}`
        };
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    yield {
        type: "complete",
        message: "All steps completed successfully!"
    };
}
```

### **3. Error Handling**
```typescript
async *postWithError_(shouldError: boolean, user: PotoUser) {
    yield { type: "start", message: "Starting operation..." };
    
    if (shouldError) {
        throw new Error("Simulated error occurred");
    }
    
    yield { type: "success", message: "Operation completed successfully" };
}
```

### **4. Conditional Logic**
```typescript
async *postConditional_(condition: string, user: PotoUser) {
    yield { type: "start", condition };
    
    switch (condition) {
        case "fast":
            for (let i = 0; i < 3; i++) {
                yield { type: "data", value: i, speed: "fast" };
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            break;
            
        case "slow":
            for (let i = 0; i < 5; i++) {
                yield { type: "data", value: i, speed: "slow" };
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            break;
            
        default:
            yield { type: "error", message: "Unknown condition" };
            return;
    }
    
    yield { type: "complete", condition };
}
```

### **5. Data Processing**
```typescript
async *postDataProcess_(data: string[], user: PotoUser) {
    yield { type: "start", itemCount: data.length };
    
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const processed = item.toUpperCase();
        
        yield {
            type: "item",
            index: i,
            original: item,
            processed,
            progress: Math.round(((i + 1) / data.length) * 100)
        };
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    yield { type: "complete", processedCount: data.length };
}
```

## 🔄 **Client-Side Consumption**

Generator methods work exactly the same as regular streaming methods on the client side:

```typescript
class Client {
    async consumeGeneratorMethod() {
        const stream = await this.proxy.postCounter_(5) as ReadableStream<Uint8Array>;
        
        for await (const data of this.client.consumeSseStream(stream)) {
            console.log('Received:', data);
            // data will be: { number: 1, timestamp: "..." }, { number: 2, ... }, etc.
        }
    }
}
```

## 🛠️ **Error Handling**

### **Server-Side Errors**
Errors thrown in generators are handled gracefully:

```typescript
async *postWithError_(shouldError: boolean, user: PotoUser) {
    yield { type: "start", message: "Starting..." };
    
    if (shouldError) {
        throw new Error("Something went wrong");
    }
    
    yield { type: "success", message: "Done!" };
}
```

### **Client-Side Error Handling**
```typescript
try {
    for await (const data of this.client.consumeSseStream(stream)) {
        console.log(data);
    }
} catch (error) {
    console.error('Stream error:', error);
    // Handle the error appropriately
}
```

## 📊 **Performance Benefits**

### **Memory Efficiency**
- **Generators**: Process one item at a time, minimal memory usage
- **Manual Streams**: Can accumulate data if not careful

### **Code Clarity**
- **Generators**: Natural async/await syntax, easy to read
- **Manual Streams**: Complex controller management

### **Error Handling**
- **Generators**: Standard try/catch and throw
- **Manual Streams**: Manual controller.error() calls

## 🎯 **Best Practices**

### **1. Use Descriptive Yield Objects**
```typescript
// ✅ Good
yield { type: "progress", step: 1, total: 10, percentage: 10 };

// ❌ Avoid
yield "step 1";
```

### **2. Handle Errors Gracefully**
```typescript
async *processData_(data: any[], user: PotoUser) {
    try {
        for (const item of data) {
            yield { type: "processing", item };
            await processItem(item);
        }
        yield { type: "complete" };
    } catch (error) {
        yield { type: "error", message: error.message };
    }
}
```

### **3. Use Appropriate Delays**
```typescript
async *streamData_(items: any[], user: PotoUser) {
    for (const item of items) {
        yield item;
        // Add small delay to prevent overwhelming the client
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}
```

### **4. Provide Progress Updates**
```typescript
async *longRunningTask_(items: any[], user: PotoUser) {
    for (let i = 0; i < items.length; i++) {
        // Progress update every 10 items
        if (i % 10 === 0) {
            yield { type: "progress", processed: i, total: items.length };
        }
        
        yield { type: "item", data: await processItem(items[i]) };
    }
    
    yield { type: "complete", total: items.length };
}
```

## 🔗 **Migration Guide**

### **From Manual ReadableStream to Generator**

**Before:**
```typescript
async postCounter_(count: number, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
    return new ReadableStream({
        start(controller) {
            let current = 1;
            const interval = setInterval(() => {
                if (current > count) {
                    controller.close();
                    clearInterval(interval);
                    return;
                }
                
                const chunk = JSON.stringify({ number: current });
                controller.enqueue(new TextEncoder().encode(chunk + '\n'));
                current++;
            }, 100);
        }
    });
}
```

**After:**
```typescript
async *postCounter_(count: number, user: PotoUser) {
    for (let i = 1; i <= count; i++) {
        yield { number: i };
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
```

## ✅ **Summary**

Generator methods provide:

1. **Simpler Code**: No manual ReadableStream creation
2. **Better Readability**: Natural async/await syntax
3. **Easier Debugging**: Standard JavaScript patterns
4. **Automatic SSE Formatting**: No manual encoding needed
5. **Backward Compatibility**: Works with existing client code
6. **Error Handling**: Standard try/catch patterns

This feature makes streaming endpoints much easier to write and maintain while providing the same functionality as manual ReadableStream creation!
