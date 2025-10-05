import { SimpleStreamPacket } from '../shared/SimpleStreamPacket';
import merge from 'it-merge';
import all from 'it-all';

/**
 * Simple examples demonstrating SimpleStreamPacket with it-merge and it-all
 */
export class SimpleStreamPacketExample {
    
    /**
     * Basic example: merge two simple streams
     */
    static async basicMergeExample(): Promise<void> {
        console.log('=== Basic Merge Example ===');
        
        // Create two async generators
        const values1 = async function* () {
            yield new SimpleStreamPacket('stream1', '', 'Hello');
            yield new SimpleStreamPacket('stream1', '', ' from');
            yield new SimpleStreamPacket('stream1', '', ' stream1');
        };
        
        const values2 = async function* () {
            yield new SimpleStreamPacket('stream2', '', ' world');
            yield new SimpleStreamPacket('stream2', '', ' from');
            yield new SimpleStreamPacket('stream2', '', ' stream2');
        };
        
        // Merge the streams
        const mergedStream = merge(values1(), values2());
        const allPackets = await all(mergedStream);
        
        console.log('All packets:', allPackets.length);
        allPackets.forEach((packet, index) => {
            console.log(`Packet ${index}: source="${packet.source}", content="${packet.content}"`);
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
            const message = "Hello, can you help me?";
            for (let i = 0; i < message.length; i++) {
                yield new SimpleStreamPacket('user', '', message[i]);
            }
        }
        
        // Simulate LLM reasoning process
        async function* llmReasoning() {
            const reasoningSteps = [
                "The user is asking for help.",
                "I should be helpful and supportive."
            ];
            
            for (const step of reasoningSteps) {
                yield new SimpleStreamPacket('llm', step, '');
            }
        }
        
        // Simulate LLM response
        async function* llmResponse() {
            const response = "I'd be happy to help!";
            for (let i = 0; i < response.length; i++) {
                yield new SimpleStreamPacket('llm', '', response[i]);
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
            yield new SimpleStreamPacket('database', '', 'User data loaded');
            yield new SimpleStreamPacket('database', '', ' - ID: 123');
        }
        
        async function* apiStream() {
            yield new SimpleStreamPacket('api', '', 'External API called');
            yield new SimpleStreamPacket('api', '', ' - Status: 200');
        }
        
        async function* processingStream() {
            yield new SimpleStreamPacket('processor', 'Processing user request...', '');
            yield new SimpleStreamPacket('processor', 'Validating data...', '');
        }
        
        // Merge all data sources
        const dataStream = merge(
            databaseStream(),
            apiStream(),
            processingStream()
        );
        
        const allPackets = await all(dataStream);
        
        console.log(`Total data packets: ${allPackets.length}`);
        
        // Group by source
        const sources = ['database', 'api', 'processor'];
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
     * Randomized delays example
     */
    static async randomizedDelaysExample(): Promise<void> {
        console.log('\n=== Randomized Delays Example ===');
        
        // Stream with random delays
        async function* randomDelayStream() {
            const delays = [10, 50, 20, 30, 15, 40, 25, 35];
            for (let i = 0; i < delays.length; i++) {
                await new Promise(resolve => setTimeout(resolve, delays[i]));
                yield new SimpleStreamPacket('random', '', `Random${i + 1}`);
            }
        }
        
        // Stream with burst pattern
        async function* burstStream() {
            // Initial burst
            yield new SimpleStreamPacket('burst', '', 'Burst1');
            yield new SimpleStreamPacket('burst', '', 'Burst2');
            yield new SimpleStreamPacket('burst', '', 'Burst3');
            
            // Long delay
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Final burst
            yield new SimpleStreamPacket('burst', '', 'Burst4');
            yield new SimpleStreamPacket('burst', '', 'Burst5');
        }
        
        // Stream with steady pattern
        async function* steadyStream() {
            for (let i = 1; i <= 5; i++) {
                await new Promise(resolve => setTimeout(resolve, 25));
                yield new SimpleStreamPacket('steady', '', `Steady${i}`);
            }
        }
        
        const startTime = Date.now();
        const mergedStream = merge(randomDelayStream(), burstStream(), steadyStream());
        const allPackets = await all(mergedStream);
        const endTime = Date.now();
        
        console.log(`Total packets: ${allPackets.length}`);
        console.log(`Total time: ${endTime - startTime}ms`);
        
        // Analyze timing patterns
        const sources = allPackets.map(p => p.source);
        const sourceCounts = sources.reduce((counts, source) => {
            counts[source] = (counts[source] || 0) + 1;
            return counts;
        }, {} as Record<string, number>);
        
        console.log('Source distribution:', sourceCounts);
        
        // Show content accumulation
        const randomContent = allPackets
            .filter(p => p.source === 'random')
            .map(p => p.content)
            .join('');
        const burstContent = allPackets
            .filter(p => p.source === 'burst')
            .map(p => p.content)
            .join('');
        const steadyContent = allPackets
            .filter(p => p.source === 'steady')
            .map(p => p.content)
            .join('');
            
        console.log('Random content:', randomContent);
        console.log('Burst content:', burstContent);
        console.log('Steady content:', steadyContent);
    }
    
    /**
     * Real-time chat simulation with random delays
     */
    static async realTimeChatExample(): Promise<void> {
        console.log('\n=== Real-Time Chat Simulation ===');
        
        // Simulate user typing with realistic delays
        async function* userTyping() {
            const message = "Hello! Can you help me with a coding problem?";
            for (let i = 0; i < message.length; i++) {
                // Simulate realistic typing speed (50-150ms per character)
                const delay = Math.random() * 100 + 50;
                await new Promise(resolve => setTimeout(resolve, delay));
                yield new SimpleStreamPacket('user', '', message[i]);
            }
        }
        
        // Simulate LLM reasoning with random processing time
        async function* llmReasoning() {
            const reasoningSteps = [
                "The user is asking for help with coding.",
                "I should analyze what kind of problem they have.",
                "I need to provide a helpful response.",
                "Let me structure my answer clearly."
            ];
            
            for (const step of reasoningSteps) {
                // Random processing time (100-300ms per step)
                const delay = Math.random() * 200 + 100;
                await new Promise(resolve => setTimeout(resolve, delay));
                yield new SimpleStreamPacket('llm', step, '');
            }
        }
        
        // Simulate LLM response with realistic streaming
        async function* llmResponse() {
            const response = "I'd be happy to help you with your coding problem! Could you tell me what programming language you're using and what specific issue you're facing?";
            for (let i = 0; i < response.length; i++) {
                // Simulate realistic response streaming (20-80ms per character)
                const delay = Math.random() * 60 + 20;
                await new Promise(resolve => setTimeout(resolve, delay));
                yield new SimpleStreamPacket('llm', '', response[i]);
            }
        }
        
        const startTime = Date.now();
        const conversationStream = merge(userTyping(), llmReasoning(), llmResponse());
        const allPackets = await all(conversationStream);
        const endTime = Date.now();
        
        console.log(`Total packets: ${allPackets.length}`);
        console.log(`Total conversation time: ${endTime - startTime}ms`);
        
        // Separate and accumulate content
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
        
        // Show timing analysis
        const userPackets = allPackets.filter(p => p.source === 'user');
        const llmPackets = allPackets.filter(p => p.source === 'llm');
        console.log(`User typing: ${userPackets.length} characters`);
        console.log(`LLM processing: ${llmPackets.filter(p => p.reasoning).length} reasoning steps`);
        console.log(`LLM response: ${llmPackets.filter(p => p.content).length} characters`);
    }
    
    /**
     * Run all examples
     */
    static async runAllExamples(): Promise<void> {
        try {
            await this.basicMergeExample();
            await this.chatSimulationExample();
            await this.multiSourceExample();
            await this.randomizedDelaysExample();
            await this.realTimeChatExample();
        } catch (error) {
            console.error('Example failed:', error);
        }
    }
}

// Export for use in tests or other modules
export default SimpleStreamPacketExample;
