import { DataPacket } from '../shared/DataPacket';
import merge from 'it-merge';
import all from 'it-all';

/**
 * Example demonstrating DataPacket with it-merge and it-all
 * Shows how to merge multiple async streams of StreamPackets
 */
export class StreamPacketExample {
    
    /**
     * Basic example: merge two simple streams
     */
    static async basicMergeExample(): Promise<void> {
        console.log('=== Basic Merge Example ===');
        
        // Create two async generators
        const values1 = async function* () {
            yield new DataPacket('stream1', '', 'Hello');
            yield new DataPacket('stream1', '', ' from');
            yield new DataPacket('stream1', '', ' stream1');
        };
        
        const values2 = async function* () {
            yield new DataPacket('stream2', '', ' world');
            yield new DataPacket('stream2', '', ' from');
            yield new DataPacket('stream2', '', ' stream2');
        };
        
        // Merge the streams
        const mergedStream = merge(values1(), values2());
        const allPackets = await all(mergedStream);
        
        console.log('All packets:', allPackets.length);
        allPackets.forEach((packet, index) => {
            console.log(`Packet ${index}:`, packet.toString());
        });
        
        // Accumulate content by source
        const stream1Content = allPackets
            .filter(p => p.source === 'stream1')
            .map(p => p.content)
            .join('');
        const stream2Content = allPackets
            .filter(p => p.source === 'stream2')
            .map(p => p.content)
            .join('');
            
        console.log('Stream1 content:', stream1Content);
        console.log('Stream2 content:', stream2Content);
    }
    
    /**
     * Chat simulation: merge user input, LLM reasoning, and LLM response
     */
    static async chatSimulationExample(): Promise<void> {
        console.log('\n=== Chat Simulation Example ===');
        
        // Simulate user typing
        async function* userTyping() {
            const message = "Hello, can you help me with a math problem?";
            for (let i = 0; i < message.length; i++) {
                yield new DataPacket('user', '', message[i]);
                await new Promise(resolve => setTimeout(resolve, 50)); // Simulate typing delay
            }
        }
        
        // Simulate LLM reasoning process
        async function* llmReasoning() {
            const reasoningSteps = [
                "The user is asking for help with a math problem.",
                "I should be helpful and ask for more details.",
                "I need to be encouraging and supportive."
            ];
            
            for (const step of reasoningSteps) {
                yield new DataPacket('llm', step, '');
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // Simulate LLM response
        async function* llmResponse() {
            const response = "I'd be happy to help you with a math problem! Could you please tell me what specific problem you're working on?";
            for (let i = 0; i < response.length; i++) {
                yield new DataPacket('llm', '', response[i]);
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }
        
        // Merge all streams
        const conversationStream = merge(userTyping(), llmReasoning(), llmResponse());
        const allPackets = await all(conversationStream);
        
        console.log(`Total packets: ${allPackets.length}`);
        
        // Separate by source and accumulate
        const userContent = allPackets
            .filter(p => p.source === 'user')
            .map(p => p.content)
            .join('');
        const llmReasoningContent = allPackets
            .filter(p => p.source === 'llm' && p.reasoning)
            .map(p => p.reasoning)
            .join(' ');
        const llmContent = allPackets
            .filter(p => p.source === 'llm' && p.content)
            .map(p => p.content)
            .join('');
            
        console.log('User message:', userContent);
        console.log('LLM reasoning:', llmReasoningContent);
        console.log('LLM response:', llmContent);
    }
    
    /**
     * Multi-source data processing example
     */
    static async multiSourceExample(): Promise<void> {
        console.log('\n=== Multi-Source Data Processing Example ===');
        
        // Different data sources
        async function* databaseStream() {
            yield new DataPacket('database', '', 'User data loaded');
            yield new DataPacket('database', '', ' - ID: 123');
        }
        
        async function* apiStream() {
            yield new DataPacket('api', '', 'External API called');
            yield new DataPacket('api', '', ' - Status: 200');
        }
        
        async function* cacheStream() {
            yield new DataPacket('cache', '', 'Cache hit');
            yield new DataPacket('cache', '', ' - Key: user_123');
        }
        
        async function* processingStream() {
            yield new DataPacket('processor', 'Processing user request...', '');
            yield new DataPacket('processor', 'Validating data...', '');
            yield new DataPacket('processor', 'Generating response...', '');
        }
        
        // Merge all data sources
        const dataStream = merge(
            databaseStream(),
            apiStream(),
            cacheStream(),
            processingStream()
        );
        
        const allPackets = await all(dataStream);
        
        console.log(`Total data packets: ${allPackets.length}`);
        
        // Group by source
        const sources = ['database', 'api', 'cache', 'processor'];
        for (const source of sources) {
            const sourcePackets = allPackets.filter(p => p.source === source);
            console.log(`\n${source.toUpperCase()} (${sourcePackets.length} packets):`);
            
            sourcePackets.forEach((packet, index) => {
                if (packet.reasoning) {
                    console.log(`  ${index + 1}. Reasoning: ${packet.reasoning}`);
                }
                if (packet.content) {
                    console.log(`  ${index + 1}. Content: ${packet.content}`);
                }
            });
        }
    }
    
    /**
     * Performance test with large streams
     */
    static async performanceTest(): Promise<void> {
        console.log('\n=== Performance Test ===');
        
        const startTime = Date.now();
        
        // Create multiple large streams
        async function* createLargeStream(source: string, count: number) {
            for (let i = 0; i < count; i++) {
                yield new DataPacket(
                    source,
                    `Reasoning ${i}`,
                    `Content ${i}`
                );
            }
        }
        
        const stream1 = createLargeStream('stream1', 1000);
        const stream2 = createLargeStream('stream2', 1000);
        const stream3 = createLargeStream('stream3', 1000);
        
        const mergedStream = merge(stream1, stream2, stream3);
        const allPackets = await all(mergedStream);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`Processed ${allPackets.length} packets in ${duration}ms`);
        console.log(`Average: ${(allPackets.length / duration * 1000).toFixed(2)} packets/second`);
        
        // Verify data integrity
        const totalLength = allPackets.reduce((sum, p) => sum + p.source.length + p.reasoning.length + p.content.length, 0);
        console.log(`Total content length: ${totalLength} characters`);
        
        // Check source distribution
        const sourceCounts = allPackets.reduce((counts, p) => {
            counts[p.source] = (counts[p.source] || 0) + 1;
            return counts;
        }, {} as Record<string, number>);
        
        console.log('Source distribution:', sourceCounts);
    }
    
    /**
     * Error handling example
     */
    static async errorHandlingExample(): Promise<void> {
        console.log('\n=== Error Handling Example ===');
        
        async function* normalStream() {
            yield new DataPacket('normal', '', 'This is normal');
            yield new DataPacket('normal', '', 'This is also normal');
        }
        
        async function* errorStream() {
            yield new DataPacket('example', '', '', 'This will cause an error');
            throw new Error('Simulated stream error');
        }
        
        try {
            const mergedStream = merge(normalStream(), errorStream());
            await all(mergedStream);
            console.log('This should not be reached');
        } catch (error) {
            console.log('Caught error:', (error as Error).message);
        }
    }
    
    /**
     * Run all examples
     */
    static async runAllExamples(): Promise<void> {
        try {
            await this.basicMergeExample();
            await this.chatSimulationExample();
            await this.multiSourceExample();
            await this.performanceTest();
            await this.errorHandlingExample();
        } catch (error) {
            console.error('Example failed:', error);
        }
    }
}

// Export for use in tests or other modules
export default StreamPacketExample;
