import { PotoClient } from './PotoClient';
import { parseTypedJson } from '../../shared/TypedJsonUtils';

// Example of how to use PotoClient to invoke generator methods

async function exampleGeneratorUsage() {
    // 1. Create PotoClient instance
    const client = new PotoClient('http://localhost:3000');
    
    // 2. Login (optional, depending on your server setup)
    try {
        await client.loginAsVisitor();
    } catch (error) {
        console.log('Login failed, continuing without auth:', error);
    }
    
    // 3. Get a proxy for your module
    // The modulePrefix should match the route returned by your PotoModule's getRoute() method
    const testGeneratorProxy = client.getProxy<{
        postSimpleGenerator_(count: number): ReadableStream<Uint8Array>;
        postFibonacciGenerator_(limit: number): ReadableStream<Uint8Array>;
        postAsyncGenerator_(items: string[]): ReadableStream<Uint8Array>;
        postRegularMethod_(message: string): Promise<string>;
    }>('testgenerator');
    
    // 4. Invoke generator methods
    
    // Example 1: Simple generator
    console.log('=== Simple Generator Example ===');
    const simpleStream = await testGeneratorProxy.postSimpleGenerator_(5);
    
    // Consume the stream using the client's helper methods
    for await (const chunk of client.consumeStream(simpleStream)) {
        console.log('Simple generator chunk:', chunk);
        // Output: { number: 1, message: "Item 1" }, { number: 2, message: "Item 2" }, etc.
    }
    
    // Example 2: Fibonacci generator
    console.log('=== Fibonacci Generator Example ===');
    const fibonacciStream = await testGeneratorProxy.postFibonacciGenerator_(8);
    
    for await (const chunk of client.consumeStream(fibonacciStream)) {
        console.log('Fibonacci chunk:', chunk);
        // Output: { index: 0, value: 0 }, { index: 1, value: 1 }, { index: 2, value: 1 }, etc.
    }
    
    // Example 3: Async generator with string processing
    console.log('=== Async Generator Example ===');
    const asyncStream = await testGeneratorProxy.postAsyncGenerator_(['hello', 'world', 'test']);
    
    for await (const chunk of client.consumeStream(asyncStream)) {
        console.log('Async generator chunk:', chunk);
        // Output: { item: "hello", processed: "HELLO", delay: 5 }, etc.
    }
    
    // Example 4: Regular non-generator method (for comparison)
    console.log('=== Regular Method Example ===');
    const result = await testGeneratorProxy.postRegularMethod_('Hello World');
    console.log('Regular method result:', result);
    // Output: "Regular method: Hello World"
}

// Example with error handling
async function exampleWithErrorHandling() {
    const client = new PotoClient('http://localhost:3000');
    await client.loginAsVisitor();
    
    const testGeneratorProxy = client.getProxy<{
        postErrorGenerator_(shouldError: boolean): ReadableStream<Uint8Array>;
    }>('testgenerator');
    
    try {
        const errorStream = await testGeneratorProxy.postErrorGenerator_(true);
        
        for await (const chunk of client.consumeStream(errorStream)) {
            console.log('Error generator chunk:', chunk);
            // Will yield { status: "started" } before throwing an error
        }
    } catch (error) {
        console.log('Expected error caught:', error);
    }
}

// Example with authentication
async function exampleWithAuth() {
    const client = new PotoClient('http://localhost:3000');
    
    // Login with credentials
    await client.login({ username: 'testuser', password: 'testpass' });
    
    const testGeneratorProxy = client.getProxy<{
        postSimpleGenerator_(count: number): ReadableStream<Uint8Array>;
    }>('testgenerator');
    
    // The client automatically includes the auth token in requests
    const stream = await testGeneratorProxy.postSimpleGenerator_(3);
    
    for await (const chunk of client.consumeStream(stream)) {
        console.log('Authenticated generator chunk:', chunk);
    }
}

// Example with custom stream processing
async function exampleCustomStreamProcessing() {
    const client = new PotoClient('http://localhost:3000');
    await client.loginAsVisitor();
    
    const testGeneratorProxy = client.getProxy<{
        postFibonacciGenerator_(limit: number): ReadableStream<Uint8Array>;
    }>('testgenerator');
    
    const stream = await testGeneratorProxy.postFibonacciGenerator_(10);
    
    // Use the raw stream processing if you need more control
    let sum = 0;
    for await (const chunk of client.consumeStream(stream)) {
        // Assume chunk is Uint8Array, decode and parse as JSON
        const text = new TextDecoder().decode(chunk);
        const data = parseTypedJson(text);
        sum += data.value;
        console.log(`Fibonacci ${data.index}: ${data.value}, Running sum: ${sum}`);
    }

    console.log(`Final sum of first 10 Fibonacci numbers: ${sum}`);
}

// Run examples
if (typeof window === 'undefined') {
    // Node.js environment
    exampleGeneratorUsage().catch(console.error);
    exampleWithErrorHandling().catch(console.error);
    exampleWithAuth().catch(console.error);
    exampleCustomStreamProcessing().catch(console.error);
}

export {
    exampleGeneratorUsage,
    exampleWithErrorHandling,
    exampleWithAuth,
    exampleCustomStreamProcessing
};
