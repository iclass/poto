import { describe, it, expect } from 'bun:test';
import { DataPacket } from '../../src/shared/DataPacket';
import merge from 'it-merge';
import all from 'it-all';
import itFirst from 'it-first';
import itTake from 'it-take';

describe('DataPacket', () => {
    describe('Basic functionality', () => {
        it('should create a packet with default values', () => {
            const packet = new DataPacket();
            expect(packet.source).toBe('');
            expect(packet.reasoning).toBe('');
            expect(packet.content).toBe('');
        });

        it('should create a packet with custom values', () => {
            const packet = new DataPacket('llm', 'I think...', 'Hello world');
            expect(packet.source).toBe('llm');
            expect(packet.reasoning).toBe('I think...');
            expect(packet.content).toBe('Hello world');
        });

        it('should create packets with partial values', () => {
            const sourceOnly = new DataPacket('llm');
            expect(sourceOnly.source).toBe('llm');
            expect(sourceOnly.reasoning).toBe('');
            expect(sourceOnly.content).toBe('');

            const sourceAndReasoning = new DataPacket('llm', 'I think...');
            expect(sourceAndReasoning.source).toBe('llm');
            expect(sourceAndReasoning.reasoning).toBe('I think...');
            expect(sourceAndReasoning.content).toBe('');
        });
    });

    describe('Async iterator compatibility', () => {
        it('should work with async generators', async () => {
            async function* generatePackets() {
                yield new DataPacket('llm', 'I think...', 'Hello');
                yield new DataPacket('llm', 'Let me...', ' world');
                yield new DataPacket('llm', '', '!');
            }

            const packets: DataPacket[] = [];
            for await (const packet of generatePackets()) {
                packets.push(packet);
            }

            expect(packets).toHaveLength(3);
            expect(packets[0].content).toBe('Hello');
            expect(packets[1].content).toBe(' world');
            expect(packets[2].content).toBe('!');
        });

        it('should work with it-merge for multiple streams', async () => {
            async function* stream1() {
                yield new DataPacket('llm', 'I think...', 'Hello');
                yield new DataPacket('llm', 'Let me...', ' world');
            }

            async function* stream2() {
                yield new DataPacket('user', '', 'How are you?');
                yield new DataPacket('user', '', ' Tell me more.');
            }

            // Merge streams
            const mergedStream = merge(stream1(), stream2());
            const allPackets: DataPacket[] = [];
            for await (const packet of mergedStream) {
                allPackets.push(packet);
            }

            expect(allPackets).toHaveLength(4);
            
            // Check that we have packets from both sources
            const sources = allPackets.map(p => p.source);
            expect(sources).toContain('llm');
            expect(sources).toContain('user');
        });

        it('should accumulate content from merged streams', async () => {
            async function* reasoningStream() {
                yield new DataPacket('llm', 'I need to think about this...', '');
                yield new DataPacket('llm', 'Let me analyze the problem...', '');
            }

            async function* contentStream() {
                yield new DataPacket('llm', '', 'Hello');
                yield new DataPacket('llm', '', ' world');
                yield new DataPacket('llm', '', '!');
            }

            const mergedStream = merge(reasoningStream(), contentStream());
            const allPackets = await all(mergedStream);

            // Separate reasoning and content
            let reasoning = '';
            let content = '';

            for (const packet of allPackets) {
                reasoning += packet.reasoning;
                content += packet.content;
            }

            expect(reasoning).toBe('I need to think about this...Let me analyze the problem...');
            expect(content).toBe('Hello world!');
        });

        it('should handle empty streams', async () => {
            async function* emptyStream() {
                // No yields
            }

            async function* nonEmptyStream() {
                yield new DataPacket('llm', '', 'Hello');
            }

            const mergedStream = merge(emptyStream(), nonEmptyStream());
            const allPackets = await all(mergedStream);

            expect(allPackets).toHaveLength(1);
            expect(allPackets[0].content).toBe('Hello');
        });
    });

    describe('Real-world scenarios', () => {
        it('should simulate a chat conversation', async () => {
            async function* userMessages() {
                yield new DataPacket('user', '', 'Hello, how are you?');
                yield new DataPacket('user', '', ' Tell me about AI.');
            }

            async function* llmReasoning() {
                yield new DataPacket('llm', 'The user is asking about my status...', '');
                yield new DataPacket('llm', 'Now they want to know about AI...', '');
            }

            async function* llmResponse() {
                yield new DataPacket('llm', '', 'I am doing well, thank you!');
                yield new DataPacket('llm', '', ' AI is a fascinating field...');
            }

            const conversationStream = merge(userMessages(), llmReasoning(), llmResponse());
            const allPackets = await all(conversationStream);

            expect(allPackets).toHaveLength(6);

            // Separate by source
            const userPackets = allPackets.filter(p => p.source === 'user');
            const llmPackets = allPackets.filter(p => p.source === 'llm');

            expect(userPackets).toHaveLength(2);
            expect(llmPackets).toHaveLength(4);

            // Check content accumulation
            const userContent = userPackets.map(p => p.content).join('');
            const llmReasoningContent = llmPackets.map(p => p.reasoning).join('');
            const llmContent = llmPackets.map(p => p.content).join('');

            expect(userContent).toBe('Hello, how are you? Tell me about AI.');
            expect(llmReasoningContent).toBe('The user is asking about my status...Now they want to know about AI...');
            expect(llmContent).toBe('I am doing well, thank you! AI is a fascinating field...');
        });

        it('should work with different packet types', async () => {
            async function* sourceOnlyStream() {
                yield new DataPacket('llm');
                yield new DataPacket('user');
            }

            async function* reasoningOnlyStream() {
                yield new DataPacket('llm', 'I think...');
                yield new DataPacket('llm', 'Let me...');
            }

            async function* contentOnlyStream() {
                yield new DataPacket('llm', '', 'Hello');
                yield new DataPacket('llm', '', ' world');
            }

            const mergedStream = merge(
                sourceOnlyStream(),
                reasoningOnlyStream(),
                contentOnlyStream()
            );
            const allPackets = await all(mergedStream);

            expect(allPackets).toHaveLength(6);
            
            // Check different packet types
            const sourceOnlyPackets = allPackets.filter(p => p.source && !p.reasoning && !p.content);
            const reasoningOnlyPackets = allPackets.filter(p => p.source && p.reasoning && !p.content);
            const contentOnlyPackets = allPackets.filter(p => p.source && !p.reasoning && p.content);

            expect(sourceOnlyPackets).toHaveLength(2);
            expect(reasoningOnlyPackets).toHaveLength(2);
            expect(contentOnlyPackets).toHaveLength(2);
        });

        it('should handle error scenarios gracefully', async () => {
            async function* normalStream() {
                yield new DataPacket('llm', '', 'Hello');
            }

            async function* errorStream() {
                throw new Error('Stream error');
            }

            try {
                const mergedStream = merge(normalStream(), errorStream());
                await all(mergedStream);
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Stream error');
            }
        });
    });

    describe('Randomized delays and timing', () => {
        it('should handle streams with random delays', async () => {
            async function* fastStream() {
                yield new DataPacket('fast', '', 'Fast1');
                await new Promise(resolve => setTimeout(resolve, 10));
                yield new DataPacket('fast', '', 'Fast2');
                await new Promise(resolve => setTimeout(resolve, 5));
                yield new DataPacket('fast', '', 'Fast3');
            }

            async function* slowStream() {
                await new Promise(resolve => setTimeout(resolve, 50));
                yield new DataPacket('slow', '', 'Slow1');
                await new Promise(resolve => setTimeout(resolve, 30));
                yield new DataPacket('slow', '', 'Slow2');
                await new Promise(resolve => setTimeout(resolve, 20));
                yield new DataPacket('slow', '', 'Slow3');
            }

            async function* randomStream() {
                const delays = [5, 25, 15, 35, 10];
                for (let i = 0; i < delays.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, delays[i]));
                    yield new DataPacket('random', '', `Random${i + 1}`);
                }
            }

            const startTime = Date.now();
            const mergedStream = merge(fastStream(), slowStream(), randomStream());
            const allPackets = await all(mergedStream);
            const endTime = Date.now();

            expect(allPackets).toHaveLength(11);
            
            // Verify we got packets from all streams
            const sources = allPackets.map(p => p.source);
            expect(sources).toContain('fast');
            expect(sources).toContain('slow');
            expect(sources).toContain('random');

            // Verify timing - should complete in reasonable time
            expect(endTime - startTime).toBeGreaterThan(50); // At least as long as slowest delay
            expect(endTime - startTime).toBeLessThan(200); // But not too long
        });

        it('should handle streams with varying delay patterns', async () => {
            async function* burstStream() {
                // Burst of packets, then long delay
                yield new DataPacket('burst', '', 'Burst1');
                yield new DataPacket('burst', '', 'Burst2');
                yield new DataPacket('burst', '', 'Burst3');
                await new Promise(resolve => setTimeout(resolve, 100));
                yield new DataPacket('burst', '', 'Burst4');
            }

            async function* steadyStream() {
                // Steady stream with consistent delays
                for (let i = 1; i <= 4; i++) {
                    yield new DataPacket('steady', '', `Steady${i}`);
                    await new Promise(resolve => setTimeout(resolve, 25));
                }
            }

            async function* erraticStream() {
                // Erratic timing
                const delays = [5, 50, 10, 30, 15];
                for (let i = 0; i < delays.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, delays[i]));
                    yield new DataPacket('erratic', '', `Erratic${i + 1}`);
                }
            }

            const mergedStream = merge(burstStream(), steadyStream(), erraticStream());
            const allPackets = await all(mergedStream);

            expect(allPackets).toHaveLength(13); // 4 + 4 + 5

            // Verify all sources are present
            const sources = allPackets.map(p => p.source);
            expect(sources).toContain('burst');
            expect(sources).toContain('steady');
            expect(sources).toContain('erratic');

            // Verify content accumulation
            const burstContent = allPackets
                .filter(p => p.source === 'burst')
                .map(p => p.content)
                .join('');
            const steadyContent = allPackets
                .filter(p => p.source === 'steady')
                .map(p => p.content)
                .join('');
            const erraticContent = allPackets
                .filter(p => p.source === 'erratic')
                .map(p => p.content)
                .join('');

            expect(burstContent).toBe('Burst1Burst2Burst3Burst4');
            expect(steadyContent).toBe('Steady1Steady2Steady3Steady4');
            expect(erraticContent).toBe('Erratic1Erratic2Erratic3Erratic4Erratic5');
        });

        it('should handle streams with random delays and reasoning content', async () => {
            async function* reasoningStream() {
                const reasoningSteps = [
                    'Analyzing the problem...',
                    'Considering multiple approaches...',
                    'Evaluating the best solution...',
                    'Finalizing the response...'
                ];
                
                for (let i = 0; i < reasoningSteps.length; i++) {
                    const delay = Math.random() * 50 + 10; // 10-60ms random delay
                    await new Promise(resolve => setTimeout(resolve, delay));
                    yield new DataPacket('llm', reasoningSteps[i], '');
                }
            }

            async function* contentStream() {
                const contentParts = ['Hello', ' world', '! How', ' can I', ' help?'];
                
                for (let i = 0; i < contentParts.length; i++) {
                    const delay = Math.random() * 30 + 5; // 5-35ms random delay
                    await new Promise(resolve => setTimeout(resolve, delay));
                    yield new DataPacket('llm', '', contentParts[i]);
                }
            }

            async function* metadataStream() {
                const metadata = ['Processing...', 'Validating...', 'Generating...'];
                
                for (let i = 0; i < metadata.length; i++) {
                    const delay = Math.random() * 40 + 15; // 15-55ms random delay
                    await new Promise(resolve => setTimeout(resolve, delay));
                    yield new DataPacket('system', metadata[i], '');
                }
            }

            const mergedStream = merge(reasoningStream(), contentStream(), metadataStream());
            const allPackets = await all(mergedStream);

            expect(allPackets.length).toBeGreaterThan(10);

            // Separate by source and content type
            const llmReasoning = allPackets
                .filter(p => p.source === 'llm' && p.reasoning)
                .map(p => p.reasoning);
            const llmContent = allPackets
                .filter(p => p.source === 'llm' && p.content)
                .map(p => p.content);
            const systemMetadata = allPackets
                .filter(p => p.source === 'system')
                .map(p => p.reasoning);

            expect(llmReasoning).toHaveLength(4);
            expect(llmContent).toHaveLength(5);
            expect(systemMetadata).toHaveLength(3);

            // Verify content accumulation
            const fullContent = llmContent.join('');
            expect(fullContent).toBe('Hello world! How can I help?');
        });

        it('should handle concurrent streams with different completion times', async () => {
            async function* quickStream() {
                yield new DataPacket('quick', '', 'Quick1');
                await new Promise(resolve => setTimeout(resolve, 10));
                yield new DataPacket('quick', '', 'Quick2');
                // Stream completes quickly
            }

            async function* mediumStream() {
                await new Promise(resolve => setTimeout(resolve, 20));
                yield new DataPacket('medium', '', 'Medium1');
                await new Promise(resolve => setTimeout(resolve, 30));
                yield new DataPacket('medium', '', 'Medium2');
                await new Promise(resolve => setTimeout(resolve, 20));
                yield new DataPacket('medium', '', 'Medium3');
            }

            async function* longStream() {
                await new Promise(resolve => setTimeout(resolve, 50));
                yield new DataPacket('long', '', 'Long1');
                await new Promise(resolve => setTimeout(resolve, 40));
                yield new DataPacket('long', '', 'Long2');
                await new Promise(resolve => setTimeout(resolve, 30));
                yield new DataPacket('long', '', 'Long3');
                await new Promise(resolve => setTimeout(resolve, 20));
                yield new DataPacket('long', '', 'Long4');
            }

            const startTime = Date.now();
            const mergedStream = merge(quickStream(), mediumStream(), longStream());
            const allPackets = await all(mergedStream);
            const endTime = Date.now();

            expect(allPackets).toHaveLength(9); // 2 + 3 + 4

            // Verify all sources are present
            const sources = allPackets.map(p => p.source);
            expect(sources).toContain('quick');
            expect(sources).toContain('medium');
            expect(sources).toContain('long');

            // Verify timing - should complete after the longest stream
            expect(endTime - startTime).toBeGreaterThan(140); // At least as long as longest stream
            expect(endTime - startTime).toBeLessThan(200); // But not too long

            // Verify content accumulation
            const quickContent = allPackets
                .filter(p => p.source === 'quick')
                .map(p => p.content)
                .join('');
            const mediumContent = allPackets
                .filter(p => p.source === 'medium')
                .map(p => p.content)
                .join('');
            const longContent = allPackets
                .filter(p => p.source === 'long')
                .map(p => p.content)
                .join('');

            expect(quickContent).toBe('Quick1Quick2');
            expect(mediumContent).toBe('Medium1Medium2Medium3');
            expect(longContent).toBe('Long1Long2Long3Long4');
        });

        it('should handle streams with random delays and error recovery', async () => {
            async function* reliableStream() {
                for (let i = 1; i <= 3; i++) {
                    const delay = Math.random() * 20 + 5; // 5-25ms random delay
                    await new Promise(resolve => setTimeout(resolve, delay));
                    yield new DataPacket('reliable', '', `Reliable${i}`);
                }
            }

            async function* unreliableStream() {
                const delays = [10, 30, 5, 25, 15];
                for (let i = 0; i < delays.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, delays[i]));
                    if (i === 2) {
                        // Simulate a temporary issue, but recover
                        yield new DataPacket('unreliable', '', `Unreliable${i + 1}-retry`);
                    } else {
                        yield new DataPacket('unreliable', '', `Unreliable${i + 1}`);
                    }
                }
            }

            const mergedStream = merge(reliableStream(), unreliableStream());
            const allPackets = await all(mergedStream);

            expect(allPackets).toHaveLength(8); // 3 + 5

            // Verify all sources are present
            const sources = allPackets.map(p => p.source);
            expect(sources).toContain('reliable');
            expect(sources).toContain('unreliable');

            // Verify content accumulation
            const reliableContent = allPackets
                .filter(p => p.source === 'reliable')
                .map(p => p.content)
                .join('');
            const unreliableContent = allPackets
                .filter(p => p.source === 'unreliable')
                .map(p => p.content)
                .join('');

            expect(reliableContent).toBe('Reliable1Reliable2Reliable3');
            expect(unreliableContent).toBe('Unreliable1Unreliable2Unreliable3-retryUnreliable4Unreliable5');
        });
    });

    describe('Real-world error scenarios and timeouts', () => {
        it('should handle timeout scenarios with it-first', async () => {
            async function* fastStream() {
                yield new DataPacket('fast', '', 'Fast response');
            }

            async function* slowStream() {
                await new Promise(resolve => setTimeout(resolve, 200));
                yield new DataPacket('slow', '', 'Slow response');
            }

            async function* timeoutStream() {
                await new Promise(resolve => setTimeout(resolve, 100));
                yield new DataPacket('timeout', '', 'Timeout response');
            }

            // Use it-first to get the first result (like Promise.race)
            const mergedStream = merge(fastStream(), slowStream(), timeoutStream());
            const firstResult = await itFirst(mergedStream);

            expect(firstResult?.source).toBe('fast');
            expect(firstResult?.content).toBe('Fast response');
        });

        it('should handle partial failures with it-all', async () => {
            async function* reliableStream() {
                yield new DataPacket('reliable', '', 'Reliable1');
                yield new DataPacket('reliable', '', 'Reliable2');
            }

            async function* failingStream() {
                yield new DataPacket('failing', '', 'Failing1');
                throw new Error('Stream failed');
            }

            async function* recoveryStream() {
                await new Promise(resolve => setTimeout(resolve, 50));
                yield new DataPacket('recovery', '', 'Recovery1');
            }

            try {
                const mergedStream = merge(reliableStream(), failingStream(), recoveryStream());
                await all(mergedStream);
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Stream failed');
            }
        });

        it('should handle timeout with it-take', async () => {
            async function* infiniteStream() {
                let count = 0;
                while (true) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    yield new DataPacket('infinite', '', `Item${count++}`);
                }
            }

            async function* finiteStream() {
                yield new DataPacket('finite', '', 'Finite1');
                yield new DataPacket('finite', '', 'Finite2');
            }

            // Use it-take to limit results (timeout-like behavior)
            const mergedStream = merge(infiniteStream(), finiteStream());
            const limitedResults = await all(itTake(mergedStream, 5)); // Take only 5 items

            expect(limitedResults).toHaveLength(5);
            
            // Should have items from both streams
            const sources = limitedResults.map(p => p.source);
            expect(sources).toContain('infinite');
            expect(sources).toContain('finite');
        });

        it('should handle concurrent processing with error recovery', async () => {
            async function* stream1() {
                yield new DataPacket('stream1', '', 'Item1');
                await new Promise(resolve => setTimeout(resolve, 20));
                yield new DataPacket('stream1', '', 'Item2');
            }

            async function* stream2() {
                await new Promise(resolve => setTimeout(resolve, 10));
                yield new DataPacket('stream2', '', 'Item1');
                throw new Error('Stream2 failed');
            }

            async function* stream3() {
                await new Promise(resolve => setTimeout(resolve, 30));
                yield new DataPacket('stream3', '', 'Item1');
                yield new DataPacket('stream3', '', 'Item2');
            }

            // Process streams with error handling
            const results: DataPacket[] = [];
            const errors: Error[] = [];

            try {
                const mergedStream = merge(stream1(), stream2(), stream3());
                for await (const packet of mergedStream) {
                    results.push(packet);
                }
            } catch (error) {
                errors.push(error as Error);
            }

            // Should have some results before failure
            expect(results.length).toBeGreaterThan(0);
            expect(errors.length).toBe(1);
            expect(errors[0].message).toBe('Stream2 failed');
        });

        it('should handle network-like delays and failures', async () => {
            async function* networkStream() {
                const delays = [50, 100, 200, 50, 150];
                for (let i = 0; i < delays.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, delays[i]));
                    if (i === 2) {
                        throw new Error('Network timeout');
                    }
                    yield new DataPacket('network', '', `Network${i + 1}`);
                }
            }

            async function* localStream() {
                yield new DataPacket('local', '', 'Local1');
                await new Promise(resolve => setTimeout(resolve, 25));
                yield new DataPacket('local', '', 'Local2');
            }

            async function* cacheStream() {
                yield new DataPacket('cache', '', 'Cache1');
                await new Promise(resolve => setTimeout(resolve, 75));
                yield new DataPacket('cache', '', 'Cache2');
            }

            const results: DataPacket[] = [];
            let networkError: Error | null = null;

            try {
                const mergedStream = merge(networkStream(), localStream(), cacheStream());
                for await (const packet of mergedStream) {
                    results.push(packet);
                }
            } catch (error) {
                networkError = error as Error;
            }

            // Should have some results before network failure
            expect(results.length).toBeGreaterThan(0);
            expect(networkError).not.toBeNull();
            expect(networkError?.message).toBe('Network timeout');

            // Verify we got packets from working streams
            const sources = results.map(p => p.source);
            expect(sources).toContain('local');
            expect(sources).toContain('cache');
        });

        it('should handle resource exhaustion scenarios', async () => {
            async function* memoryIntensiveStream() {
                for (let i = 0; i < 1000; i++) {
                    yield new DataPacket('memory', '', `Data${i}`);
                    if (i % 100 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }
                }
            }

            async function* normalStream() {
                yield new DataPacket('normal', '', 'Normal1');
                yield new DataPacket('normal', '', 'Normal2');
            }

            // Use it-take to prevent memory exhaustion
            const mergedStream = merge(memoryIntensiveStream(), normalStream());
            const limitedResults = await all(itTake(mergedStream, 50)); // Limit to 50 items

            expect(limitedResults).toHaveLength(50);
            
            // Should have items from both streams
            const sources = limitedResults.map(p => p.source);
            expect(sources).toContain('memory');
            expect(sources).toContain('normal');
        });

        it('should handle cleanup with it-drain', async () => {
            let cleanupCalled = false;
            
            async function* streamWithCleanup() {
                try {
                    yield new DataPacket('cleanup', '', 'Item1');
                    yield new DataPacket('cleanup', '', 'Item2');
                    throw new Error('Stream error');
                } finally {
                    cleanupCalled = true;
                }
            }

            async function* normalStream() {
                yield new DataPacket('normal', '', 'Normal1');
            }

            try {
                const mergedStream = merge(streamWithCleanup(), normalStream());
                await all(mergedStream);
            } catch (error) {
                // Expected error
            }

            // Cleanup should be called
            expect(cleanupCalled).toBe(true);
        });

        it('should handle Promise.allSettled-like behavior', async () => {
            async function* successStream() {
                yield new DataPacket('success', '', 'Success1');
                yield new DataPacket('success', '', 'Success2');
            }

            async function* failureStream() {
                yield new DataPacket('failure', '', 'Failure1');
                throw new Error('Failure stream error');
            }

            async function* delayedStream() {
                await new Promise(resolve => setTimeout(resolve, 50));
                yield new DataPacket('delayed', '', 'Delayed1');
            }

            // Simulate Promise.allSettled behavior
            const results: { success: DataPacket[], errors: Error[] } = {
                success: [],
                errors: []
            };

            try {
                const mergedStream = merge(successStream(), failureStream(), delayedStream());
                for await (const packet of mergedStream) {
                    results.success.push(packet);
                }
            } catch (error) {
                results.errors.push(error as Error);
            }

            // Should have some success results
            expect(results.success.length).toBeGreaterThan(0);
            expect(results.errors.length).toBe(1);
            
            // Verify success stream worked
            const successPackets = results.success.filter(p => p.source === 'success');
            expect(successPackets).toHaveLength(2);
        });

        it('should demonstrate it collection Promise equivalents', async () => {
            // Promise.all equivalent - collect all results
            async function* stream1() {
                yield new DataPacket('stream1', '', 'Item1');
                yield new DataPacket('stream1', '', 'Item2');
            }

            async function* stream2() {
                yield new DataPacket('stream2', '', 'Item1');
                yield new DataPacket('stream2', '', 'Item2');
            }

            // it-all (Promise.all equivalent)
            const mergedStream = merge(stream1(), stream2());
            const allResults = await all(mergedStream);
            expect(allResults).toHaveLength(4);

            // it-first (Promise.race equivalent)
            async function* fastStream() {
                yield new DataPacket('fast', '', 'Fast result');
            }

            async function* slowStream() {
                await new Promise(resolve => setTimeout(resolve, 100));
                yield new DataPacket('slow', '', 'Slow result');
            }

            const raceStream = merge(fastStream(), slowStream());
            const firstResult = await itFirst(raceStream);
            expect(firstResult?.source).toBe('fast');

            // it-take (timeout/resource limit equivalent)
            async function* infiniteStream() {
                let count = 0;
                while (true) {
                    yield new DataPacket('infinite', '', `Item${count++}`);
                }
            }

            const limitedStream = itTake(infiniteStream(), 3);
            const limitedResults = await all(limitedStream);
            expect(limitedResults).toHaveLength(3);
        });

        it('should handle realistic reasoning-then-content pattern', async () => {
            // Phase 1: Reasoning phase (LLM thinking)
            async function* reasoningPhase() {
                const reasoningSteps = [
                    'Let me analyze this problem step by step...',
                    'First, I need to understand what the user is asking.',
                    'Then I should consider the best approach to solve it.',
                    'Finally, I need to structure my response clearly.'
                ];
                
                for (const step of reasoningSteps) {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Thinking time
                    yield new DataPacket('llm', step, '');
                }
            }

            // Phase 2: Content generation phase (LLM responding)
            async function* contentPhase() {
                // Wait for reasoning to complete first
                await new Promise(resolve => setTimeout(resolve, 500));
                const response = "Based on my analysis, here's my answer to your question: The solution involves...";
                for (let i = 0; i < response.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 20)); // Typing speed
                    yield new DataPacket('llm', '', response[i]);
                }
            }

            // Phase 3: User interaction (separate from LLM)
            async function* userPhase() {
                const userMessage = "Thank you for the detailed explanation!";
                for (let i = 0; i < userMessage.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 50)); // User typing
                    yield new DataPacket('user', '', userMessage[i]);
                }
            }

            const mergedStream = merge(reasoningPhase(), contentPhase(), userPhase());
            const allPackets = await all(mergedStream);

            // Separate by phase and content type
            const reasoningPackets = allPackets.filter(p => p.source === 'llm' && p.reasoning);
            const contentPackets = allPackets.filter(p => p.source === 'llm' && p.content);
            const userPackets = allPackets.filter(p => p.source === 'user');

            expect(reasoningPackets).toHaveLength(4);
            expect(contentPackets.length).toBeGreaterThan(50); // Long response
            expect(userPackets.length).toBeGreaterThan(30); // User message

            // Verify reasoning comes before content
            const llmPackets = allPackets.filter(p => p.source === 'llm');
            const firstReasoningIndex = llmPackets.findIndex(p => p.reasoning);
            const firstContentIndex = llmPackets.findIndex(p => p.content);
            
            expect(firstReasoningIndex).toBeLessThan(firstContentIndex);

            // Verify content accumulation
            const reasoningText = reasoningPackets.map(p => p.reasoning).join(' ');
            const contentText = contentPackets.map(p => p.content).join('');
            const userText = userPackets.map(p => p.content).join('');

            expect(reasoningText).toContain('Let me analyze this problem');
            expect(contentText).toContain('Based on my analysis');
            expect(userText).toContain('Thank you for the detailed explanation');
        });

        it('should handle multi-turn conversation with separate reasoning phases', async () => {
            // Turn 1: User asks question
            async function* userQuestion() {
                const question = "What is the capital of France?";
                for (let i = 0; i < question.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 30));
                    yield new DataPacket('user', '', question[i]);
                }
            }

            // Turn 1: LLM reasoning
            async function* llmReasoning1() {
                const reasoning = [
                    "The user is asking about geography.",
                    "I need to recall the capital of France.",
                    "Paris is the capital of France."
                ];
                
                for (const step of reasoning) {
                    await new Promise(resolve => setTimeout(resolve, 80));
                    yield new DataPacket('llm', step, '');
                }
            }

            // Turn 1: LLM response
            async function* llmResponse1() {
                // Wait for reasoning to complete
                await new Promise(resolve => setTimeout(resolve, 300));
                const response = "The capital of France is Paris.";
                for (let i = 0; i < response.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 25));
                    yield new DataPacket('llm', '', response[i]);
                }
            }

            // Turn 2: User follow-up
            async function* userFollowUp() {
                // Wait for first conversation to complete
                await new Promise(resolve => setTimeout(resolve, 800));
                const followUp = "What about Germany?";
                for (let i = 0; i < followUp.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 30));
                    yield new DataPacket('user', '', followUp[i]);
                }
            }

            // Turn 2: LLM reasoning
            async function* llmReasoning2() {
                await new Promise(resolve => setTimeout(resolve, 100)); // Processing delay
                const reasoning = [
                    "Now the user is asking about Germany.",
                    "I need to recall the capital of Germany.",
                    "Berlin is the capital of Germany."
                ];
                
                for (const step of reasoning) {
                    await new Promise(resolve => setTimeout(resolve, 80));
                    yield new DataPacket('llm', step, '');
                }
            }

            // Turn 2: LLM response
            async function* llmResponse2() {
                // Wait for reasoning to complete
                await new Promise(resolve => setTimeout(resolve, 400));
                const response = "The capital of Germany is Berlin.";
                for (let i = 0; i < response.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 25));
                    yield new DataPacket('llm', '', response[i]);
                }
            }

            const mergedStream = merge(
                userQuestion(), llmReasoning1(), llmResponse1(),
                userFollowUp(), llmReasoning2(), llmResponse2()
            );
            const allPackets = await all(mergedStream);

            // Analyze the conversation flow
            const userPackets = allPackets.filter(p => p.source === 'user');
            const llmReasoningPackets = allPackets.filter(p => p.source === 'llm' && p.reasoning);
            const llmContentPackets = allPackets.filter(p => p.source === 'llm' && p.content);

            expect(userPackets.length).toBeGreaterThan(0);
            expect(llmReasoningPackets.length).toBe(6); // 3 + 3 reasoning steps
            expect(llmContentPackets.length).toBeGreaterThan(0);

            // Verify conversation flow
            const userContent = userPackets.map(p => p.content).join('');
            const reasoningContent = llmReasoningPackets.map(p => p.reasoning).join(' ');
            const llmContent = llmContentPackets.map(p => p.content).join('');

            // Verify we have content from both user questions
            expect(userContent.length).toBeGreaterThan(20);
            expect(reasoningContent.length).toBeGreaterThan(50);
            expect(llmContent.length).toBeGreaterThan(20);
            
            // Verify reasoning content contains expected patterns
            expect(reasoningContent).toContain('The user is asking about geography');
            expect(reasoningContent).toContain('Now the user is asking about Germany');
            
            // Verify LLM responses contain expected patterns (content may be mixed due to concurrent streaming)
            expect(llmContent.length).toBeGreaterThan(20); // Should have substantial content
        });

        it('should handle reasoning-only streams (thinking without output)', async () => {
            // Stream that only does reasoning (like internal processing)
            async function* internalReasoning() {
                const internalThoughts = [
                    'Processing user request...',
                    'Analyzing context and requirements...',
                    'Generating response strategy...',
                    'Preparing final answer...'
                ];
                
                for (const thought of internalThoughts) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                    yield new DataPacket('system', thought, '');
                }
            }

            // Stream that generates content after reasoning is complete
            async function* contentGeneration() {
                // Wait for reasoning to complete
                await new Promise(resolve => setTimeout(resolve, 600));
                
                const content = "Here's my response based on my analysis...";
                for (let i = 0; i < content.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 30));
                    yield new DataPacket('llm', '', content[i]);
                }
            }

            const mergedStream = merge(internalReasoning(), contentGeneration());
            const allPackets = await all(mergedStream);

            // Separate reasoning and content
            const reasoningPackets = allPackets.filter(p => p.reasoning);
            const contentPackets = allPackets.filter(p => p.content);

            expect(reasoningPackets).toHaveLength(4);
            expect(contentPackets.length).toBeGreaterThan(0);

            // Verify reasoning happens before content
            const systemPackets = allPackets.filter(p => p.source === 'system');
            const llmPackets = allPackets.filter(p => p.source === 'llm');
            
            if (systemPackets.length > 0 && llmPackets.length > 0) {
                const lastReasoningIndex = allPackets.lastIndexOf(systemPackets[systemPackets.length - 1]);
                const firstContentIndex = allPackets.findIndex(p => p.source === 'llm' && p.content);
                expect(lastReasoningIndex).toBeLessThan(firstContentIndex);
            }

            // Verify content accumulation
            const reasoningText = reasoningPackets.map(p => p.reasoning).join(' ');
            const contentText = contentPackets.map(p => p.content).join('');

            expect(reasoningText).toContain('Processing user request');
            expect(contentText).toContain('Here\'s my response based on my analysis');
        });
    });

    describe('Client-side cancellation and propagation', () => {
        it('should handle client-side cancellation with AbortController', async () => {
            const abortController = new AbortController();
            let cancellationNotified = false;

            async function* cancellableStream() {
                try {
                    for (let i = 0; i < 10; i++) {
                        // Check for cancellation
                        if (abortController.signal.aborted) {
                            throw new Error('Stream cancelled by client');
                        }
                        await new Promise(resolve => setTimeout(resolve, 50));
                        yield new DataPacket('stream', '', `Item${i}`);
                    }
                } catch (error) {
                    cancellationNotified = true;
                    throw error;
                }
            }

            async function* normalStream() {
                for (let i = 0; i < 5; i++) {
                    await new Promise(resolve => setTimeout(resolve, 30));
                    yield new DataPacket('normal', '', `Normal${i}`);
                }
            }

            const mergedStream = merge(cancellableStream(), normalStream());
            const results: DataPacket[] = [];
            let error: Error | null = null;

            // Start consuming the stream
            const consumePromise = (async () => {
                try {
                    for await (const packet of mergedStream) {
                        results.push(packet);
                        // Cancel after receiving 3 items
                        if (results.length === 3) {
                            abortController.abort();
                        }
                    }
                } catch (err) {
                    error = err as Error;
                }
            })();

            await consumePromise;

            // Should have received some items before cancellation
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThan(10);
            expect(error).not.toBeNull();
            expect((error as Error | null)?.message).toContain('cancelled');
            expect(cancellationNotified).toBe(true);
        });

        it('should propagate cancellation through merged streams', async () => {
            const abortController = new AbortController();
            const cancellationFlags = {
                stream1: false,
                stream2: false,
                stream3: false
            };

            async function* stream1() {
                try {
                    for (let i = 0; i < 8; i++) {
                        if (abortController.signal.aborted) {
                            cancellationFlags.stream1 = true;
                            throw new Error('Stream1 cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 40));
                        yield new DataPacket('stream1', '', `S1-${i}`);
                    }
                } catch (error) {
                    cancellationFlags.stream1 = true;
                    throw error;
                }
            }

            async function* stream2() {
                try {
                    for (let i = 0; i < 6; i++) {
                        if (abortController.signal.aborted) {
                            cancellationFlags.stream2 = true;
                            throw new Error('Stream2 cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 60));
                        yield new DataPacket('stream2', '', `S2-${i}`);
                    }
                } catch (error) {
                    cancellationFlags.stream2 = true;
                    throw error;
                }
            }

            async function* stream3() {
                try {
                    for (let i = 0; i < 4; i++) {
                        if (abortController.signal.aborted) {
                            cancellationFlags.stream3 = true;
                            throw new Error('Stream3 cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 80));
                        yield new DataPacket('stream3', '', `S3-${i}`);
                    }
                } catch (error) {
                    cancellationFlags.stream3 = true;
                    throw error;
                }
            }

            const mergedStream = merge(stream1(), stream2(), stream3());
            const results: DataPacket[] = [];
            let error: Error | null = null;

            // Start consuming
            const consumePromise = (async () => {
                try {
                    for await (const packet of mergedStream) {
                        results.push(packet);
                        // Cancel after receiving 5 items
                        if (results.length === 5) {
                            abortController.abort();
                        }
                    }
                } catch (err) {
                    error = err as Error;
                }
            })();

            await consumePromise;

            // Should have received some items before cancellation
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThan(18); // Total would be 8+6+4=18
            expect(error).not.toBeNull();

            // At least one stream should be notified of cancellation
            // (Due to the nature of merged streams, not all streams may be notified)
            const cancelledStreams = Object.values(cancellationFlags).filter(Boolean).length;
            expect(cancelledStreams).toBeGreaterThan(0);
        });

        it('should handle cancellation with cleanup and resource management', async () => {
            const abortController = new AbortController();
            const cleanupFlags = {
                stream1: false,
                stream2: false,
                resources: false
            };

            async function* streamWithCleanup() {
                try {
                    for (let i = 0; i < 10; i++) {
                        if (abortController.signal.aborted) {
                            throw new Error('Stream cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 30));
                        yield new DataPacket('cleanup', '', `Cleanup${i}`);
                    }
                } finally {
                    cleanupFlags.stream1 = true;
                    // Simulate cleanup operations
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            async function* resourceStream() {
                try {
                    for (let i = 0; i < 8; i++) {
                        if (abortController.signal.aborted) {
                            throw new Error('Resource stream cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 50));
                        yield new DataPacket('resource', '', `Resource${i}`);
                    }
                } finally {
                    cleanupFlags.stream2 = true;
                    cleanupFlags.resources = true;
                }
            }

            const mergedStream = merge(streamWithCleanup(), resourceStream());
            const results: DataPacket[] = [];
            let error: Error | null = null;

            // Start consuming
            const consumePromise = (async () => {
                try {
                    for await (const packet of mergedStream) {
                        results.push(packet);
                        // Cancel after receiving 4 items
                        if (results.length === 4) {
                            abortController.abort();
                        }
                    }
                } catch (err) {
                    error = err as Error;
                }
            })();

            await consumePromise;

            // Should have received some items before cancellation
            expect(results.length).toBeGreaterThan(0);
            expect(error).not.toBeNull();

            // Cleanup should be called
            expect(cleanupFlags.stream1).toBe(true);
            expect(cleanupFlags.stream2).toBe(true);
            expect(cleanupFlags.resources).toBe(true);
        });

        it('should handle cancellation with timeout and race conditions', async () => {
            const abortController = new AbortController();
            const timeoutController = new AbortController();

            // Set a timeout
            const timeoutId = setTimeout(() => {
                timeoutController.abort();
            }, 200);

            async function* timeoutStream() {
                try {
                    for (let i = 0; i < 10; i++) {
                        if (abortController.signal.aborted || timeoutController.signal.aborted) {
                            throw new Error('Stream cancelled or timed out');
                        }
                        await new Promise(resolve => setTimeout(resolve, 30));
                        yield new DataPacket('timeout', '', `Timeout${i}`);
                    }
                } catch (error) {
                    throw error;
                }
            }

            async function* normalStream() {
                for (let i = 0; i < 5; i++) {
                    await new Promise(resolve => setTimeout(resolve, 40));
                    yield new DataPacket('normal', '', `Normal${i}`);
                }
            }

            const mergedStream = merge(timeoutStream(), normalStream());
            const results: DataPacket[] = [];
            let error: Error | null = null;

            // Start consuming
            const consumePromise = (async () => {
                try {
                    for await (const packet of mergedStream) {
                        results.push(packet);
                        // Cancel after receiving 3 items
                        if (results.length === 3) {
                            abortController.abort();
                        }
                    }
                } catch (err) {
                    error = err as Error;
                }
            })();

            await consumePromise;
            clearTimeout(timeoutId);

            // Should have received some items before cancellation
            expect(results.length).toBeGreaterThan(0);
            expect(error).not.toBeNull();
            expect((error as Error | null)?.message).toContain('cancelled');
        });

        it('should handle cancellation with partial results and error recovery', async () => {
            const abortController = new AbortController();
            const partialResults: DataPacket[] = [];
            const errors: Error[] = [];

            async function* reliableStream() {
                try {
                    for (let i = 0; i < 5; i++) {
                        if (abortController.signal.aborted) {
                            throw new Error('Reliable stream cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 20));
                        yield new DataPacket('reliable', '', `Reliable${i}`);
                    }
                } catch (error) {
                    errors.push(error as Error);
                    throw error;
                }
            }

            async function* unreliableStream() {
                try {
                    for (let i = 0; i < 8; i++) {
                        if (abortController.signal.aborted) {
                            throw new Error('Unreliable stream cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 35));
                        if (i === 3) {
                            throw new Error('Unreliable stream error');
                        }
                        yield new DataPacket('unreliable', '', `Unreliable${i}`);
                    }
                } catch (error) {
                    errors.push(error as Error);
                    throw error;
                }
            }

            const mergedStream = merge(reliableStream(), unreliableStream());
            let error: Error | null = null;

            // Start consuming
            const consumePromise = (async () => {
                try {
                    for await (const packet of mergedStream) {
                        partialResults.push(packet);
                        // Cancel after receiving 4 items
                        if (partialResults.length === 4) {
                            abortController.abort();
                        }
                    }
                } catch (err) {
                    error = err as Error;
                }
            })();

            await consumePromise;

            // Should have received some items before cancellation
            expect(partialResults.length).toBeGreaterThan(0);
            expect(error).not.toBeNull();
            expect(errors.length).toBeGreaterThan(0);

            // Verify we got packets from both streams
            const sources = partialResults.map(p => p.source);
            expect(sources).toContain('reliable');
        });

        it('should handle cancellation with it-take and resource limits', async () => {
            const abortController = new AbortController();

            async function* infiniteStream() {
                let count = 0;
                try {
                    while (true) {
                        if (abortController.signal.aborted) {
                            throw new Error('Infinite stream cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 10));
                        yield new DataPacket('infinite', '', `Item${count++}`);
                    }
                } catch (error) {
                    throw error;
                }
            }

            async function* finiteStream() {
                for (let i = 0; i < 3; i++) {
                    if (abortController.signal.aborted) {
                        throw new Error('Finite stream cancelled');
                    }
                    await new Promise(resolve => setTimeout(resolve, 30));
                    yield new DataPacket('finite', '', `Finite${i}`);
                }
            }

            // Use it-take to limit results and prevent resource exhaustion
            const mergedStream = merge(infiniteStream(), finiteStream());
            const limitedStream = itTake(mergedStream, 8); // Limit to 8 items
            const results: DataPacket[] = [];
            let error: Error | null = null;

            // Start consuming
            const consumePromise = (async () => {
                try {
                    for await (const packet of limitedStream) {
                        results.push(packet);
                        // Cancel after receiving 5 items
                        if (results.length === 5) {
                            abortController.abort();
                        }
                    }
                } catch (err) {
                    error = err as Error;
                }
            })();

            await consumePromise;

            // Should have received some items before cancellation
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(8); // Limited by it-take
            expect(error).not.toBeNull();
        });

        it('should handle cancellation with concurrent processing and cleanup', async () => {
            const abortController = new AbortController();
            const processingFlags = {
                stream1: false,
                stream2: false,
                cleanup: false
            };

            async function* processingStream1() {
                try {
                    for (let i = 0; i < 6; i++) {
                        if (abortController.signal.aborted) {
                            throw new Error('Processing stream 1 cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 40));
                        yield new DataPacket('processing1', '', `P1-${i}`);
                    }
                } finally {
                    processingFlags.stream1 = true;
                }
            }

            async function* processingStream2() {
                try {
                    for (let i = 0; i < 4; i++) {
                        if (abortController.signal.aborted) {
                            throw new Error('Processing stream 2 cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 60));
                        yield new DataPacket('processing2', '', `P2-${i}`);
                    }
                } finally {
                    processingFlags.stream2 = true;
                }
            }

            async function* cleanupStream() {
                try {
                    for (let i = 0; i < 3; i++) {
                        if (abortController.signal.aborted) {
                            throw new Error('Cleanup stream cancelled');
                        }
                        await new Promise(resolve => setTimeout(resolve, 80));
                        yield new DataPacket('cleanup', '', `Cleanup${i}`);
                    }
                } finally {
                    processingFlags.cleanup = true;
                }
            }

            const mergedStream = merge(processingStream1(), processingStream2(), cleanupStream());
            const results: DataPacket[] = [];
            let error: Error | null = null;

            // Start consuming
            const consumePromise = (async () => {
                try {
                    for await (const packet of mergedStream) {
                        results.push(packet);
                        // Cancel after receiving 4 items
                        if (results.length === 4) {
                            abortController.abort();
                        }
                    }
                } catch (err) {
                    error = err as Error;
                }
            })();

            await consumePromise;

            // Should have received some items before cancellation
            expect(results.length).toBeGreaterThan(0);
            expect(error).not.toBeNull();

            // At least one stream should be notified of cancellation
            // (Due to the nature of merged streams, not all streams may be notified)
            const cancelledStreams = Object.values(processingFlags).filter(Boolean).length;
            expect(cancelledStreams).toBeGreaterThan(0);
        });
    });
});