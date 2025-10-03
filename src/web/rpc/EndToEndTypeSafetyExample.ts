import { PotoClient } from './PotoClient';

/**
 * Example demonstrating end-to-end type safety for generator methods
 * 
 * This example shows how generator methods now return AsyncGenerator directly
 * instead of ReadableStream, providing better type safety and easier usage.
 */

async function demonstrateEndToEndTypeSafety() {
    // 1. Create PotoClient instance
    const mockStorage = {
        getItem: (key: string): string | null => null,
        setItem: (key: string, value: string): void => {},
        removeItem: (key: string): void => {}
    };
    const client = new PotoClient('http://localhost:3000', mockStorage);
    
    // 2. Login (optional, depending on your server setup)
    try {
        await client.loginAsVisitor();
    } catch (error) {
        console.log('Login failed, continuing without auth:', error);
    }
    
    // 3. Get a proxy with proper type annotations
    // Note: Generator methods now return AsyncGenerator instead of ReadableStream
    // The server automatically detects generator methods and includes metadata in the response
    const testGeneratorProxy = client.getProxy<{
        // Generator method - returns AsyncGenerator directly
        postSimpleGenerator_(count: number): AsyncGenerator<{ 
            number: number; 
            message: string; 
            userId: string | undefined 
        }>;
        
        // Regular method - returns Promise as before
        postRegularMethod_(message: string): Promise<string>;
    }>('testgenerator');
    
    // 4. Use generator method with direct AsyncGenerator access
    console.log('=== End-to-End Type Safety Example ===');
    
    // The proxy now returns AsyncGenerator directly - no need for consumeSseStream!
    const gen = await testGeneratorProxy.postSimpleGenerator_(3);
    
    // TypeScript knows this is an AsyncGenerator with the correct yield type
    console.log('Generator type:', typeof gen[Symbol.asyncIterator]);
    console.log('Generator has next method:', typeof gen.next);
    
    // Use it directly with for await...of - much cleaner!
    for await (const item of gen) {
        // TypeScript provides full type safety here
        console.log(`Item ${item.number}: ${item.message} (user: ${item.userId})`);
        // item.number is typed as number
        // item.message is typed as string
        // item.userId is typed as string | undefined
    }
    
    // 5. Regular methods still work as before
    const result = await testGeneratorProxy.postRegularMethod_("type safety demo");
    console.log('Regular method result:', result);
}

/**
 * Example showing the difference between old and new approach
 */
async function compareOldVsNewApproach() {
    const mockStorage = {
        getItem: (key: string): string | null => null,
        setItem: (key: string, value: string): void => {},
        removeItem: (key: string): void => {}
    };
    const client = new PotoClient('http://localhost:3000', mockStorage);
    await client.loginAsVisitor();
    
    console.log('\n=== Old vs New Approach Comparison ===');
    
    // OLD APPROACH (before this feature):
    // const stream = await proxy.postSimpleGenerator_(3) as ReadableStream<Uint8Array>;
    // for await (const item of client.consumeSseStream(stream)) {
    //     console.log(item); // item is typed as 'any'
    // }
    
    // NEW APPROACH (with end-to-end type safety):
    const proxy = client.getProxy<{
        postSimpleGenerator_(count: number): AsyncGenerator<{ 
            number: number; 
            message: string; 
            userId: string | undefined 
        }>;
    }>('testgenerator');
    
    const gen = await proxy.postSimpleGenerator_(2);
    
    // Now we get full type safety:
    for await (const item of gen) {
        // TypeScript knows the exact type of 'item'
        const message = `Item ${item.number}: ${item.message}`; // All properties are typed!
        console.log(message);
        
        // We can safely access properties without type assertions
        if (item.userId) {
            console.log(`  User ID: ${item.userId}`);
        }
    }
}

/**
 * Example showing error handling with type safety
 */
async function demonstrateErrorHandling() {
    const mockStorage = {
        getItem: (key: string): string | null => null,
        setItem: (key: string, value: string): void => {},
        removeItem: (key: string): void => {}
    };
    const client = new PotoClient('http://localhost:3000', mockStorage);
    await client.loginAsVisitor();
    
    console.log('\n=== Error Handling with Type Safety ===');
    
    const proxy = client.getProxy<{
        postErrorGenerator_(shouldError: boolean): AsyncGenerator<{ 
            status: string; 
            userId: string | undefined; 
            data?: string 
        }>;
    }>('testgenerator');
    
    try {
        const gen = await proxy.postErrorGenerator_(true);
        
        for await (const item of gen) {
            // TypeScript provides type safety even for error cases
            console.log(`Status: ${item.status}, Data: ${item.data || 'none'}`);
        }
    } catch (error) {
        console.log('Error caught:', error);
    }
}

// Run examples if this file is executed directly
if (typeof window === 'undefined') {
    // Node.js environment
    demonstrateEndToEndTypeSafety()
        .then(() => compareOldVsNewApproach())
        .then(() => demonstrateErrorHandling())
        .catch(console.error);
}

export {
    demonstrateEndToEndTypeSafety,
    compareOldVsNewApproach,
    demonstrateErrorHandling
};
