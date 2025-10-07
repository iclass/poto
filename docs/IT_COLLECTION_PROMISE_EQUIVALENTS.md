# IT Collection: Promise Equivalents for Async Iterators

## Overview

The `it` collection by achingbrain provides async iterator utilities that are equivalent to Promise methods but work with async iterables instead of promises. This is particularly useful for streaming data and handling async iterators.

## Promise vs IT Collection Equivalents

### 1. **Promise.all() → it-all**

**Promise.all()**: Waits for all promises to resolve, returns array of results
```javascript
const results = await Promise.all([
    fetch('/api/data1'),
    fetch('/api/data2'),
    fetch('/api/data3')
]);
```

**it-all**: Collects all values from async iterables
```javascript
import all from 'it-all';

const results = await all(mergedStream);
```

### 2. **Promise.race() → it-first**

**Promise.race()**: Returns first promise to resolve/reject
```javascript
const firstResult = await Promise.race([
    fetch('/api/slow'),
    fetch('/api/fast')
]);
```

**it-first**: Returns first value from async iterator
```javascript
import itFirst from 'it-first';

const firstResult = await itFirst(mergedStream);
```

### 3. **Promise.any() → it-first (with error handling)**

**Promise.any()**: Returns first promise to resolve (ignores rejections)
```javascript
const firstSuccess = await Promise.any([
    fetch('/api/primary'),
    fetch('/api/fallback')
]);
```

**it-first**: Can be used with error handling for similar behavior
```javascript
import itFirst from 'it-first';

try {
    const firstSuccess = await itFirst(mergedStream);
} catch (error) {
    // Handle case where all streams fail
}
```

### 4. **Promise.allSettled() → Custom implementation**

**Promise.allSettled()**: Waits for all promises, returns results and errors
```javascript
const results = await Promise.allSettled([
    fetch('/api/data1'),
    fetch('/api/data2')
]);
```

**Custom implementation with it-all**:
```javascript
import all from 'it-all';

const results = await all(mergedStream);
// Handle errors separately in the stream processing
```

## Additional IT Collection Utilities

### **it-take** (Timeout/Resource Limitation)
```javascript
import itTake from 'it-take';

// Limit to 10 items (timeout-like behavior)
const limitedResults = await all(itTake(mergedStream, 10));
```

### **it-drain** (Cleanup)
```javascript
import drain from 'it-drain';

// Empty the iterator (cleanup)
await drain(mergedStream);
```

### **it-merge** (Concurrency)
```javascript
import merge from 'it-merge';

// Merge multiple streams (like Promise.all but for streams)
const mergedStream = merge(stream1(), stream2(), stream3());
```

### **it-batch** (Batching)
```javascript
import batch from 'it-batch';

// Process items in batches
const batchedStream = batch(mergedStream, 5);
```

### **it-parallel-batch** (Concurrency Control)
```javascript
import parallelBatch from 'it-parallel-batch';

// Process with concurrency control
const processedStream = parallelBatch(mergedStream, 3);
```

## Real-World Examples

### 1. **Streaming with Timeout (Promise.race equivalent)**
```javascript
import { itFirst, itTake } from 'it-first';
import merge from 'it-merge';

// Race between data stream and timeout
const dataStream = fetchDataStream();
const timeoutStream = createTimeoutStream(5000);

const result = await itFirst(merge(dataStream, timeoutStream));
```

### 2. **Collecting All Results (Promise.all equivalent)**
```javascript
import all from 'it-all';
import merge from 'it-merge';

// Collect all results from multiple streams
const stream1 = createStream1();
const stream2 = createStream2();
const stream3 = createStream3();

const allResults = await all(merge(stream1, stream2, stream3));
```

### 3. **Resource Limitation (Timeout equivalent)**
```javascript
import { itTake, all } from 'it-take';
import merge from 'it-merge';

// Limit results to prevent resource exhaustion
const limitedResults = await all(itTake(mergedStream, 100));
```

### 4. **Error Handling (Promise.allSettled equivalent)**
```javascript
import all from 'it-all';
import merge from 'it-merge';

const results = [];
const errors = [];

try {
    const allResults = await all(merge(stream1(), stream2()));
    results.push(...allResults);
} catch (error) {
    errors.push(error);
}

// Handle both results and errors
```

## Key Differences

### **Promise Methods**
- Work with **promises** (single values)
- **One-time** execution
- **Static** methods
- **Built-in** to JavaScript

### **IT Collection Methods**
- Work with **async iterables** (streams)
- **Continuous** processing
- **Functional** approach
- **External** library

## When to Use Each

### **Use Promise Methods When:**
- Working with single async operations
- Need one-time results
- Working with existing Promise-based APIs
- Simple async/await patterns

### **Use IT Collection When:**
- Working with streaming data
- Need continuous processing
- Handling async iterators
- Building reactive systems
- Working with `DataPacket` streams

## Installation

```bash
# Core utilities
npm install it-all it-first it-take it-merge

# Additional utilities
npm install it-drain it-batch it-parallel-batch it-filter it-map
```

## Summary

The `it` collection provides powerful async iterator utilities that are equivalent to Promise methods but designed for streaming and continuous data processing. While Promise methods work with single values, IT collection methods work with streams of data, making them perfect for real-time applications and streaming scenarios.
