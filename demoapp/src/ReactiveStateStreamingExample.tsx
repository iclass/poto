import React, { useEffect } from 'react';
import { makeState } from './ReactiveState';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveState - Live Examples & Demonstrations
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This file contains runnable examples demonstrating:
 * 1. Computed Values - Derived state that auto-updates
 * 2. Batching - Group updates for single render
 * 3. Debouncing - Smooth streaming without excessive renders
 * 4. Flushing - Force immediate updates
 * 
 * See ReactiveState.ts for detailed inline documentation and API reference.
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXAMPLE 0: Computed Values (Derived State)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Use getter functions to create derived state that automatically updates
 * when dependencies change. Eliminates manual synchronization bugs!
 */
export function ComputedValuesExample() {
    const $ = makeState({
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
        items: ['Apple', 'Banana', 'Cherry'],
        price: 10,
        quantity: 2,

        // Computed: Auto-updates when firstName or lastName changes
        get fullName() {
            return `${this.firstName} ${this.lastName}`;
        },

        // Computed: Derived from age
        get ageCategory() {
            if (this.age < 13) return 'Child';
            if (this.age < 20) return 'Teenager';
            if (this.age < 65) return 'Adult';
            return 'Senior';
        },

        // Computed: From other computed value
        get greeting() {
            return `Hello, ${this.fullName}! You are ${this.ageCategory.toLowerCase()}.`;
        },

        // Computed: From array
        get itemCount() {
            return this.items.length;
        },

        // Computed: Calculation
        get totalPrice() {
            return this.price * this.quantity;
        }
    });

    return (
        <div>
            <h3>Computed Values Example</h3>
            <div style={{ marginBottom: '20px' }}>
                <h4>Personal Info:</h4>
                <input
                    value={$.firstName}
                    onChange={(e) => $.firstName = e.target.value}
                    placeholder="First Name"
                />
                <input
                    value={$.lastName}
                    onChange={(e) => $.lastName = e.target.value}
                    placeholder="Last Name"
                />
                <input
                    type="number"
                    value={$.age}
                    onChange={(e) => $.age = Number(e.target.value)}
                    placeholder="Age"
                />
                
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0' }}>
                    <div><strong>Full Name:</strong> {$.fullName} (computed)</div>
                    <div><strong>Age Category:</strong> {$.ageCategory} (computed)</div>
                    <div><strong>Greeting:</strong> {$.greeting} (computed from computed!)</div>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h4>Shopping Cart:</h4>
                <div>
                    Price: $<input
                        type="number"
                        value={$.price}
                        onChange={(e) => $.price = Number(e.target.value)}
                        style={{ width: '60px' }}
                    />
                </div>
                <div>
                    Quantity: <input
                        type="number"
                        value={$.quantity}
                        onChange={(e) => $.quantity = Number(e.target.value)}
                        style={{ width: '60px' }}
                    />
                </div>
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0' }}>
                    <strong>Total: ${$.totalPrice}</strong> (computed)
                </div>
            </div>

            <div>
                <h4>Items List:</h4>
                <div>Items: {$.items.join(', ')}</div>
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0' }}>
                    <strong>Count: {$.itemCount}</strong> (computed)
                </div>
                <button onClick={() => $.items.push(`Item ${$.items.length + 1}`)}>
                    Add Item
                </button>
            </div>

            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e8f5e9' }}>
                ✅ <strong>Benefits:</strong> No manual updates needed! fullName, greeting, 
                totalPrice, and itemCount automatically stay in sync.
            </div>
        </div>
    );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXAMPLE 1: Basic Batching
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Use $batch() to group multiple state updates into a single render cycle.
 * Perfect for bulk updates where you don't want intermediate states to show.
 */
export function BasicBatchingExample() {
    const $ = makeState({
        count: 0,
        name: '',
        active: false,
        timestamp: Date.now()
    });

    const handleBulkUpdate = () => {
        // WITHOUT batching: 4 re-renders
        // $.count = 10;
        // $.name = 'John';
        // $.active = true;
        // $.timestamp = Date.now();

        // WITH batching: 1 re-render
        $.$batch(() => {
            $.count = 10;
            $.name = 'John';
            $.active = true;
            $.timestamp = Date.now();
        });
    };

    return (
        <div>
            <h3>Batching Example</h3>
            <div>Count: {$.count}</div>
            <div>Name: {$.name}</div>
            <div>Active: {$.active ? 'Yes' : 'No'}</div>
            <div>Timestamp: {$.timestamp}</div>
            <button onClick={handleBulkUpdate}>Update All (Batched)</button>
        </div>
    );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXAMPLE 2: Debounced Streaming Updates
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Use $setDebounce() to delay updates during rapid streaming changes.
 * UI only updates after changes stop coming in for the debounce period.
 */
export function DebouncedStreamingExample() {
    const $ = makeState({
        streamedText: '',
        chunkCount: 0,
        renderCount: 0
    });

    useEffect(() => {
        // Set 100ms debounce - UI updates only after 100ms of no changes
        $.$setDebounce(100);

        // Track render count (this will be much less than chunk count)
        $.renderCount = 0;
    }, []);

    const simulateStreaming = () => {
        $.streamedText = '';
        $.chunkCount = 0;
        $.renderCount = 0;

        // Simulate streaming data in 50ms intervals
        const chunks = ['Hello', ' from', ' the', ' streaming', ' world', '!'];
        let index = 0;

        const interval = setInterval(() => {
            if (index < chunks.length) {
                $.streamedText += chunks[index];
                $.chunkCount++;
                index++;
            } else {
                clearInterval(interval);
                // Force immediate render of final state
                $.$flush();
            }
        }, 50);

        // Track actual render count
        const originalRenderCount = $.renderCount;
        const renderInterval = setInterval(() => {
            if (index >= chunks.length) {
                clearInterval(renderInterval);
            }
        }, 10);
    };

    // Count renders by incrementing on each render
    useEffect(() => {
        $.renderCount++;
    });

    return (
        <div>
            <h3>Debounced Streaming Example</h3>
            <div>Text: {$.streamedText}</div>
            <div>Chunks Received: {$.chunkCount}</div>
            <div>UI Renders: {$.renderCount}</div>
            <div style={{ color: 'green', marginTop: '10px' }}>
                ✅ With debouncing: {$.chunkCount} chunks but only ~2-3 renders!
            </div>
            <button onClick={simulateStreaming}>Start Streaming</button>
        </div>
    );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXAMPLE 3: Real-World Chat Streaming
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Simulate an AI chat response that streams in token by token.
 * Without debouncing, each token would cause a re-render (expensive!).
 * With debouncing, the UI updates smoothly every 50-100ms.
 */
export function ChatStreamingExample() {
    const $ = makeState({
        message: '',
        isStreaming: false,
        tokenCount: 0
    });

    useEffect(() => {
        // Set 50ms debounce for smooth but not excessive updates
        $.$setDebounce(50);
    }, []);

    const simulateAIResponse = async () => {
        $.message = '';
        $.tokenCount = 0;
        $.isStreaming = true;

        // Simulate AI response tokens
        const response = "This is a simulated AI response that streams in word by word. " +
                        "With debouncing, the UI updates smoothly without re-rendering " +
                        "for every single token. This makes the experience much more " +
                        "efficient and prevents UI lag.";
        
        const tokens = response.split(' ');

        for (const token of tokens) {
            await new Promise(resolve => setTimeout(resolve, 100));
            $.message += token + ' ';
            $.tokenCount++;
        }

        $.isStreaming = false;
        // Ensure final state is rendered immediately
        $.$flush();
    };

    return (
        <div style={{ maxWidth: '600px' }}>
            <h3>Chat Streaming Example</h3>
            <div style={{
                padding: '15px',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                minHeight: '100px',
                marginBottom: '10px'
            }}>
                {$.message || 'No message yet...'}
                {$.isStreaming && <span className="cursor-blink">|</span>}
            </div>
            <div>Tokens: {$.tokenCount}</div>
            <button onClick={simulateAIResponse} disabled={$.isStreaming}>
                {$.isStreaming ? 'Streaming...' : 'Start AI Response'}
            </button>
        </div>
    );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXAMPLE 4: Combining Batch and Debounce
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * You can use both techniques together for maximum efficiency.
 * Batch processes incoming data, debounce controls UI update frequency.
 */
export function CombinedExample() {
    const $ = makeState({
        messages: [] as string[],
        unreadCount: 0,
        lastUpdate: 0
    });

    useEffect(() => {
        // UI updates at most every 200ms
        $.$setDebounce(200);
    }, []);

    const processIncomingMessages = (messages: string[]) => {
        // Batch all the updates together
        $.$batch(() => {
            messages.forEach(msg => {
                $.messages.push(msg);
                $.unreadCount++;
            });
            $.lastUpdate = Date.now();
        });
    };

    const simulateBurst = () => {
        // Simulate receiving 10 messages in rapid succession
        const messages = Array.from({ length: 10 }, (_, i) => 
            `Message ${i + 1}: ${new Date().toLocaleTimeString()}`
        );
        
        processIncomingMessages(messages);
    };

    return (
        <div>
            <h3>Combined Batch + Debounce Example</h3>
            <div>Messages: {$.messages.length}</div>
            <div>Unread: {$.unreadCount}</div>
            <div>Last Update: {new Date($.lastUpdate).toLocaleTimeString()}</div>
            <button onClick={simulateBurst}>Simulate Message Burst</button>
            <button onClick={() => { $.unreadCount = 0; }}>Mark All Read</button>
        </div>
    );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXAMPLE 5: Temporarily Disable Reactivity
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Use an extremely high debounce or batching to temporarily disable updates,
 * then manually flush when ready to show changes.
 */
export function TemporaryDisableExample() {
    const $ = makeState({
        items: [] as number[],
        status: 'idle' as 'idle' | 'loading' | 'ready'
    });

    const loadDataWithoutUpdates = () => {
        $.status = 'loading';
        
        // Disable updates temporarily with very high debounce
        $.$setDebounce(999999);

        // Process lots of data without UI updates
        $.$batch(() => {
            for (let i = 0; i < 1000; i++) {
                $.items.push(i);
            }
        });

        $.status = 'ready';

        // Re-enable updates and show final result
        $.$setDebounce(0);
        $.$flush();
    };

    return (
        <div>
            <h3>Temporarily Disable Reactivity</h3>
            <div>Status: {$.status}</div>
            <div>Items: {$.items.length}</div>
            <button onClick={loadDataWithoutUpdates}>
                Load 1000 Items (No Intermediate Updates)
            </button>
            <button onClick={() => { $.items = []; $.status = 'idle'; }}>
                Clear
            </button>
        </div>
    );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAIN DEMO COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default function ReactiveStateStreamingExamples() {
    return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>ReactiveState: Complete Feature Showcase</h1>
            <p>Interactive examples demonstrating computed values, batching, and debouncing.</p>
            
            <hr />
            <ComputedValuesExample />
            
            <hr />
            <BasicBatchingExample />
            
            <hr />
            <DebouncedStreamingExample />
            
            <hr />
            <ChatStreamingExample />
            
            <hr />
            <CombinedExample />
            
            <hr />
            <TemporaryDisableExample />

            <style>{`
                hr { margin: 30px 0; border: 1px solid #ddd; }
                button { 
                    padding: 8px 16px; 
                    margin: 5px; 
                    cursor: pointer;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                }
                button:hover { background: #0056b3; }
                button:disabled { 
                    background: #ccc; 
                    cursor: not-allowed; 
                }
                .cursor-blink {
                    animation: blink 1s infinite;
                }
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
            `}</style>
        </div>
    );
}

