# PotoClient + PotoServer E2E Integration Tests

This directory contains comprehensive end-to-end integration tests that validate the complete interaction between PotoClient and PotoServer modules.

## Overview

The e2e tests verify that the PotoClient can successfully communicate with a running PotoServer instance, including:

- **Real HTTP Communication**: Tests actual network requests between client and server
- **Authentication Flow**: Validates user registration, login, and token management
- **Generator Method Invocation**: Tests streaming data from server to client
- **Error Handling**: Ensures graceful error handling across the client-server boundary
- **Concurrent Operations**: Validates multiple simultaneous requests
- **Stream Management**: Tests stream creation, consumption, and cancellation

## Test Structure

### TestGeneratorModule

The test uses a `TestGeneratorModule` that implements various generator methods:

- `postSimpleGenerator_`: Yields sequential numbers with messages
- `postFibonacciGenerator_`: Generates Fibonacci sequence
- `postErrorGenerator_`: Demonstrates error handling in generators
- `postEmptyGenerator_`: Yields no data (empty stream)
- `postAsyncGenerator_`: Processes string arrays asynchronously
- `postProgressGenerator_`: Shows progress tracking with percentages
- `postLargeDataGenerator_`: Generates large data chunks
- `postRegularMethod_`: Non-generator method for comparison

### Test Scenarios

1. **Basic Connectivity**: Client authentication and server connection
2. **Simple Generator**: Basic streaming with sequential data
3. **Mathematical Operations**: Complex calculations (Fibonacci sequence)
4. **Error Handling**: Generator errors and recovery
5. **Empty Streams**: Generators that yield no data
6. **Async Processing**: String processing with delays
7. **Regular Methods**: Non-streaming method calls
8. **Progress Tracking**: Step-by-step progress updates
9. **Large Data**: Handling substantial data volumes
10. **Concurrent Requests**: Multiple simultaneous operations
11. **Stream Cancellation**: Early stream termination
12. **Multi-User**: Multiple clients with different credentials
13. **Mixed Operations**: Combining generators and regular methods
14. **Reconnection**: Client reconnection after network issues

## Running the Tests

```bash
# Run the e2e tests
bun test src/web/rpc/PotoClientPotoServerE2E.test.ts

# Run with verbose output
bun test src/web/rpc/PotoClientPotoServerE2E.test.ts --verbose
```

## Test Environment

### Server Setup
- **Port**: 3001 (to avoid conflicts with other services)
- **JWT Secret**: "e2e-test-secret"
- **Static Directory**: `./public`
- **User Provider**: Mock implementation for visitor registration

### Client Setup
- **Base URL**: `http://localhost:3001`
- **Storage**: Mock implementation for Node.js environment
- **Authentication**: Visitor login for each test

## Key Testing Patterns

### 1. Server Initialization
```typescript
server = new PotoServer({
    port: testPort,
    staticDir: path.resolve(__dirname, "../../../public"),
    jwtSecret: "e2e-test-secret"
});

server.setUserProvider(mockUserProvider);
server.addModule(new TestGeneratorModule());
server.run();
```

### 2. Client Setup
```typescript
const mockStorage = {
    getItem: (key: string): string | null => null,
    setItem: (key: string, value: string): void => {},
    removeItem: (key: string): void => {}
};
client = new PotoClient(serverUrl, mockStorage);
await client.loginAsVisitor();
```

### 3. Generator Method Testing
```typescript
const testGeneratorProxy = client.getProxy<{
    postSimpleGenerator_(count: number): ReadableStream<Uint8Array>;
}>('testgenerator');

const stream = await testGeneratorProxy.postSimpleGenerator_(3);
const chunks: any[] = [];
for await (const chunk of client.consumeSseStream(stream)) {
    chunks.push(chunk);
}
```

### 4. Error Handling
```typescript
try {
    for await (const chunk of client.consumeSseStream(stream)) {
        chunks.push(chunk);
    }
} catch (error) {
    // Handle expected errors
    expect(error).toBeInstanceOf(Error);
}
```

## Validation Points

### Response Validation
- **HTTP Status**: All successful requests return 200
- **Content Type**: Generator methods return `text/event-stream`
- **Data Integrity**: Received chunks match expected format
- **User Context**: User ID is properly injected into responses

### Stream Validation
- **Chunk Count**: Correct number of data chunks received
- **Data Format**: JSON objects with expected properties
- **Timing**: Appropriate delays between chunks
- **Completion**: Streams properly close after all data

### Error Validation
- **Server Stability**: Server continues running after errors
- **Error Propagation**: Errors are properly communicated to client
- **Graceful Degradation**: Partial data is received before errors

## Performance Considerations

- **Test Duration**: Each test completes within reasonable time limits
- **Memory Usage**: Streams are properly cleaned up
- **Concurrency**: Multiple requests don't interfere with each other
- **Resource Cleanup**: Server and client resources are properly managed

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure port 3001 is available
2. **Storage Errors**: Mock storage is required for Node.js environment
3. **Authentication Failures**: Visitor registration may fail if server is misconfigured
4. **Stream Errors**: Generator errors may be thrown at server level

### Debug Information

The tests include detailed logging:
- Server startup messages
- HTTP request/response logs
- Authentication flow details
- Stream consumption progress

## Extending the Tests

### Adding New Generator Methods

1. Add method to `TestGeneratorModule`
2. Follow naming convention: `postMethodName_`
3. Include `user: PotoUser` parameter
4. Add corresponding test case

### Adding New Test Scenarios

1. Create new test function
2. Set up client authentication
3. Create proxy for target module
4. Invoke methods and validate responses
5. Clean up resources

## Integration with CI/CD

These tests can be integrated into continuous integration pipelines:

```yaml
# Example GitHub Actions step
- name: Run E2E Tests
  run: bun test src/web/rpc/PotoClientPotoServerE2E.test.ts
  env:
    NODE_ENV: test
```

## Related Documentation

- [PotoClient API Documentation](./PotoClient.ts)
- [PotoServer API Documentation](../../server/PotoServer.ts)
- [Generator Methods Guide](./GENERATOR_METHODS.md)
- [MessageClient Interface](../../shared/MessageClient.ts)
