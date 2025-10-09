import { ColorUtils } from "./ColorUtils";
import { ChatConfigManager } from "./ChatConfig";
import { MarkdownParser } from "./MarkdownParser";
import { createMarkdownSplitter } from "../../src/shared/SimpleMarkdownTracker";
import type { ChatServerModule } from "../server/ChatServerModule";
import type { ModelInfo } from "../shared/types";
import * as readline from 'readline';

export interface ChatResponseProcessorDependencies {
    chatServerModuleProxy: ChatServerModule;
    rl: readline.Interface;
    isProcessingRequest: boolean;
    reasoningEnabled: boolean;
    streamingEnabled: boolean;
    messageBodyEnabled: boolean;
    jsonOutputMode: boolean;
    interruptRequested: boolean;
    recentlyInterrupted: boolean;
}

export interface ChatResponseProcessorCallbacks {
    setProcessingRequest: (processing: boolean) => void;
    setInterruptRequested: (requested: boolean) => void;
    setRecentlyInterrupted: (interrupted: boolean) => void;
    updatePrompt: () => void;
    requestTopicTitleGeneration: () => Promise<void>;
    makeRequest: <T>(requestFn: () => Promise<T>) => Promise<T>;
}

export class ChatResponseProcessor {
    private deps: ChatResponseProcessorDependencies;
    private callbacks: ChatResponseProcessorCallbacks;

    // Enhanced markdown splitter for progressive rendering
    private markdownSplitter = createMarkdownSplitter();
    private markdownBuffer = ""; // External buffer for the splitter

    constructor(deps: ChatResponseProcessorDependencies, callbacks: ChatResponseProcessorCallbacks) {
        this.deps = deps;
        this.callbacks = callbacks;
    }

    /**
     * Update dependencies (for when settings change)
     */
    updateDependencies(deps: Partial<ChatResponseProcessorDependencies>): void {
        this.deps = { ...this.deps, ...deps };
    }

    /**
     * Processes AI response with enhanced interrupt handling
     */
    async processAiResponse(message: string): Promise<void> {
        try {
            // Reset interrupt state and set processing state
            this.callbacks.setInterruptRequested(false);
            this.callbacks.setRecentlyInterrupted(false); // Reset for new request
            this.callbacks.setProcessingRequest(true);
            this.callbacks.updatePrompt();

            // Reset markdown splitter for new request
            this.resetMarkdownSplitter();

            // Conditionally modify message based on messageBodyEnabled setting
            const processedMessage = this.deps.messageBodyEnabled ? message : `[Message metadata only - body disabled] Original length: ${message.length} characters`;

            let aiResponse = '';

            if (this.deps.streamingEnabled) {
                // Use new consolidated streaming method
                const responseGenerator = await this.deps.chatServerModuleProxy.chatStreaming(
                    processedMessage,
                    {
                        reasoningEnabled: this.deps.reasoningEnabled,
                        jsonOutput: this.deps.jsonOutputMode
                    }
                );

                for await (const packet of responseGenerator) {
                    // Only check for interrupt request (not isProcessingRequest since we manage it here)
                    // algorithm: We need to use the splitter to extract the leading self-contained markdown FrackNation, 
                    // and then writing out with proper coloring and reset the buffer to the remaining of the remainder
                    //  from the splitter for each iteration of receiving new data packet

                    if (this.deps.interruptRequested) {
                        console.log(ColorUtils.info('\n🔄 Response interrupted.'));
                        break;
                    }

                    // Handle different packet types
                    if (packet.reasoning && this.deps.reasoningEnabled) {
                        // Display reasoning in a different color/style
                        process.stdout.write(ColorUtils.reasoning(packet.reasoning));
                    }

                    if (packet.content) {
                        // aiResponse += packet.content;

                        // Use the stateless splitter with external buffer
                        const config = ChatConfigManager.getConfig();
                        if (config.enableMarkdown) {
                            // Accumulate content in external buffer
                            this.markdownBuffer += packet.content;
                            
                            // Use the stateless splitter on the accumulated buffer
                            const { closed, remainder } = this.markdownSplitter.split(this.markdownBuffer);
                            if (closed) {
                                const formattedText = MarkdownParser.parseWithAiColor(closed);
                                process.stdout.write(formattedText);
                            }
                            this.markdownBuffer = remainder; // Update external buffer

                        } else {
                            process.stdout.write(ColorUtils.ai(packet.content));
                        }
                    }

                    if (packet.error) {
                        console.log(ColorUtils.error('\n❌ Error: ' + packet.error));
                        break;
                    }
                }

                // Output any remaining content in the buffer
                if (this.markdownBuffer) {
                    const formattedText = MarkdownParser.parseWithAiColor(this.markdownBuffer);
                    process.stdout.write(formattedText);
                }
            } else {
                // Use new consolidated non-streaming method
                const response = await this.callbacks.makeRequest(async () => {
                    const packet = await this.deps.chatServerModuleProxy.chat(
                        processedMessage,
                        {
                            reasoningEnabled: this.deps.reasoningEnabled,
                            jsonOutput: this.deps.jsonOutputMode
                        }
                    );
                    return packet.content;
                });

                if (response) {
                    aiResponse = response;
                    
                    // Apply markdown formatting for non-streaming mode
                    const config = ChatConfigManager.getConfig();
                    if (config.enableMarkdown) {
                        const formattedText = MarkdownParser.parseWithAiColor(aiResponse);
                        console.log(formattedText);
                    } else {
                        console.log(ColorUtils.ai(aiResponse));
                    }
                }
            }

            // Note: AI response is automatically added to server-side DialogueJournal
            if (!this.deps.interruptRequested && aiResponse.trim()) {
                console.log(''); // New line after AI response

                // Request topic title generation only if no title exists yet
                await this.callbacks.requestTopicTitleGeneration();
            }

        } catch (error) {
            if (error instanceof Error && (
                error.message === 'Request was cancelled' ||
                error.name === 'AbortError' ||
                error.message === 'The operation was aborted.'
            )) {
                console.log(ColorUtils.info('🔄 Request cancelled by user.'));
            } else {
                console.error(ColorUtils.error('❌ Error getting AI response:'), error);
                console.log(ColorUtils.aiPrompt() + ColorUtils.error('Sorry, I encountered an error. Please try again.'));
            }
        } finally {
            // Reset processing state
            this.callbacks.setProcessingRequest(false);
            this.callbacks.updatePrompt();

            console.log(''); // Empty line for readability
            this.deps.rl.prompt();
        }
    }

    /**
     * Test non-streaming cancellation
     * should this go into a test suite?
     */
    async testNonStreamingCancellation(): Promise<void> {
        try {
            console.log(ColorUtils.info('🧪 Testing non-streaming cancellation...'));
            console.log(ColorUtils.info('📝 This will make a non-streaming LLM request that takes time to complete.'));
            console.log(ColorUtils.info('⏰ You can interrupt with Ctrl+C to test cancellation.'));
            console.log('');

            // Set processing state
            this.callbacks.setProcessingRequest(true);
            this.callbacks.updatePrompt();

            // Make a non-streaming request that will take time
            const response = await this.deps.chatServerModuleProxy.chatOnce(
                "You are a creative storyteller. Write engaging, detailed stories.",
                "Write a very long and detailed story with many characters and plot twists. Make it at least 2000 words long.",
            );

            // Process the response
            if (response) {
                console.log(ColorUtils.aiPrompt() + ColorUtils.ai('🤖 AI Response:'));
                console.log(MarkdownParser.parseWithAiColor(response));

                // Note: Conversation history is now managed server-side via DialogueJournal
            } else {
                console.log(ColorUtils.info('ℹ️  Request was cancelled.'));
            }

        } catch (error) {
            if (error instanceof Error && (
                error.message === 'Request was cancelled' ||
                error.name === 'AbortError' ||
                error.message === 'The operation was aborted.'
            )) {
                console.log(ColorUtils.info('🔄 Non-streaming request cancelled by user.'));
            } else {
                console.error(ColorUtils.error('❌ Error in non-streaming test:'), error);
            }
        } finally {
            // Reset processing state
            this.callbacks.setProcessingRequest(false);
            this.callbacks.updatePrompt();

            console.log(''); // Empty line for readability
            this.deps.rl.prompt();
        }
    }

    /**
     * Process content using the enhanced markdown splitter for progressive rendering
     * Implements progressive extraction: extract self-contained markdown fragments and return remainder
     */
    private processWithMarkdownSplitter(contentBuffer: string): {
        outputText: string;
        processed: boolean;
        remainder: string;
    } {
        const config = ChatConfigManager.getConfig();
        if (!config.enableMarkdown) {
            return {
                outputText: ColorUtils.ai(contentBuffer),
                processed: true,
                remainder: ''
            };
        }

        // Use the markdown splitter to find safe cut points
        const { closed, remainder } = this.markdownSplitter.split(contentBuffer);

        if (closed) {
            // We have complete, safe content to render
            const formattedText = MarkdownParser.parseWithAiColor(closed);
            return {
                outputText: formattedText,
                processed: true,
                remainder: remainder
            };
        } else {
            // Content is still being buffered (incomplete markdown)
            return {
                outputText: '',
                processed: false,
                remainder: remainder
            };
        }
    }

    /**
     * Reset the markdown splitter for a new conversation
     */
    private resetMarkdownSplitter(): void {
        this.markdownSplitter = createMarkdownSplitter();
        this.markdownBuffer = ""; // Reset external buffer
    }

    /**
     * Show markdown test demonstration
     */
    showMarkdownTest(): void {
        console.log(ColorUtils.info('\n🎨 Enhanced Markdown Parser Test\n'));

        const testMarkdown = `# 🎨 Enhanced Markdown Demo

This chat client now supports **full markdown formatting** with beautiful terminal output!

## ✨ Key Features

- **Bold text** and *italic text*
- \`Inline code\` and code blocks
- Lists and tables
- Links and blockquotes

## 📝 Code Example

\`\`\`typescript
// Enhanced markdown parsing
const parser = new MarkdownParser();
const formatted = parser.parse(markdownText);
\`\`\`

## 📊 Table Example

| Feature | Status | Notes |
|---------|--------|-------|
| Headers | ✅ | Full support |
| Lists | ✅ | Ordered & unordered |
| Code | ✅ | Syntax highlighting |
| Tables | ✅ | Beautiful formatting |

> **Note**: This enhancement uses [marked-terminal](https://github.com/mikaelbr/marked-terminal) for professional markdown rendering in the terminal.

Visit our [documentation](https://github.com/your-repo) for more information.`;

        console.log('📝 Original Markdown:');
        console.log('─'.repeat(50));
        console.log(testMarkdown);

        console.log('\n🎨 Enhanced Terminal Output:');
        console.log('─'.repeat(50));
        console.log(MarkdownParser.parse(testMarkdown));

        console.log('\n🌈 With AI Color:');
        console.log('─'.repeat(50));
        console.log(MarkdownParser.parseWithAiColor(testMarkdown));

        console.log('\n✨ Features demonstrated:');
        console.log('• Headers with proper hierarchy and colors');
        console.log('• Bold and italic text formatting');
        console.log('• Code blocks with syntax highlighting');
        console.log('• Beautiful table formatting with borders');
        console.log('• Blockquotes with proper indentation');
        console.log('• Link formatting with URLs');
        console.log('• List formatting with bullets');

        console.log('\n🚀 The chat client now provides a much richer terminal experience!');
        console.log('💡 Try asking the AI to generate content with markdown formatting!');
    }
}
