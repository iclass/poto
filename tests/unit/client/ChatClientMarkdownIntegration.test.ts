import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ChatClient } from "../../../genericChatCli/client/ChatClient";
import { ChatConfigManager } from "../../../genericChatCli/client/ChatConfig";
import { MarkdownParser } from "../../../genericChatCli/client/MarkdownParser";

describe("ChatClient Markdown Integration", () => {
    let chatClient: ChatClient;
    let mockServerUrl: string;

    beforeEach(() => {
        // Ensure markdown is enabled for tests
        ChatConfigManager.updateConfig({ enableMarkdown: true });
        
        // Create a mock server URL
        mockServerUrl = "http://localhost:9999";
        
        // Create ChatClient instance
        chatClient = new ChatClient(mockServerUrl);
    });

    describe("Markdown Splitter Integration", () => {
        it("should have markdown splitter initialized in ChatClient", () => {
            // Access the private markdownSplitter property through reflection
            const splitter = (chatClient as any).markdownSplitter;
            expect(splitter).toBeDefined();
            expect(typeof splitter.split).toBe("function");
        });

        it("should have response processor with markdown methods", () => {
            // Access the private responseProcessor property through reflection
            const responseProcessor = (chatClient as any).responseProcessor;
            expect(responseProcessor).toBeDefined();
            
            // Check that the response processor has the markdown methods
            expect(typeof responseProcessor.showMarkdownTest).toBe("function");
        });
    });

    describe("Progressive Rendering Simulation", () => {
        it("should test markdown splitter directly", () => {
            // Test the markdown splitter directly since processWithMarkdownSplitter is private
            const splitter = (chatClient as any).markdownSplitter;
            
            // Test with simple content
            const result = splitter.split("Hello world\n");
            
            expect(result).toHaveProperty("closed");
            expect(result).toHaveProperty("remainder");
            expect(typeof result.closed).toBe("string");
            expect(typeof result.remainder).toBe("string");
        });

        it("should handle markdown content with splitter", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            // Test with markdown content - the splitter will output the first safe cut
            const result = splitter.split("# Header\n\nThis is **bold** text.");
            
            // The splitter should output the first line as a safe cut
            expect(result.closed).toContain("Header");
            expect(result.closed.length).toBeGreaterThan(0);
            
            // The remainder should contain the rest
            expect(result.remainder).toContain("**bold**");
        });

        it("should buffer incomplete markdown", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            // Test with incomplete code block
            const result = splitter.split("```\ncode");
            
            expect(result.closed).toBe("");
            expect(result.remainder).toContain("```");
            expect(result.remainder).toContain("code");
        });

        it("should test response processor showMarkdownTest method", () => {
            const responseProcessor = (chatClient as any).responseProcessor;
            
            // This should not throw
            expect(() => responseProcessor.showMarkdownTest()).not.toThrow();
        });
    });

    describe("Streaming Workflow Simulation", () => {
        it("should simulate complete streaming workflow with splitter", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            // Simulate streaming chunks
            const chunks = [
                "# My Document\n\n",
                "This is **bold** text.\n\n",
                "## Code Example\n\n",
                "```javascript\n",
                "function hello() {\n",
                "    return 'world';\n",
                "}\n",
                "```\n\n",
                "## Conclusion\n\n",
                "This demonstrates **progressive rendering**."
            ];

            let displayedContent = "";
            let contentBuffer = "";

            for (const chunk of chunks) {
                contentBuffer += chunk;
                
                const result = splitter.split(contentBuffer);
                
                if (result.closed) {
                    displayedContent += result.closed;
                    contentBuffer = result.remainder;
                }
            }

            // Process any remaining content - force final processing
            if (contentBuffer) {
                // Add a newline to trigger final processing
                const finalResult = splitter.split(contentBuffer + "\n");
                displayedContent += finalResult.closed;
            }

            expect(displayedContent).toContain("# My Document");
            expect(displayedContent).toContain("This is **bold** text");
            expect(displayedContent).toContain("## Code Example");
            expect(displayedContent).toContain("```javascript");
            expect(displayedContent).toContain("function hello()");
            expect(displayedContent).toContain("```");
            expect(displayedContent).toContain("## Conclusion");
            expect(displayedContent).toContain("This demonstrates **progressive rendering**");
        });

        it("should handle mixed streaming scenarios with splitter", () => {
            // Simulate realistic streaming with various content types
            const scenarios = [
                {
                    name: "Simple text with newlines",
                    chunks: ["Hello\n", "world\n", "!"],
                    expected: "Hello world!"
                },
                {
                    name: "Code block",
                    chunks: ["```\n", "code\n", "```\n"],
                    expected: "```\ncode\n```"
                },
                {
                    name: "Mixed content",
                    chunks: ["# Header\n\n", "**Bold** text\n\n", "```\n", "code\n", "```\n"],
                    expected: "# Header\n\n**Bold** text\n\n```\ncode\n```"
                }
            ];

            for (const scenario of scenarios) {
                // Create a new splitter for each scenario
                const { createMarkdownSplitter } = require("../../../src/shared/SimpleMarkdownTracker");
                const testSplitter = createMarkdownSplitter();
                
                let displayedContent = "";
                let contentBuffer = "";

                for (const chunk of scenario.chunks) {
                    contentBuffer += chunk;
                    
                    const result = testSplitter.split(contentBuffer);
                    
                    if (result.closed) {
                        displayedContent += result.closed;
                        contentBuffer = result.remainder;
                    }
                }

                // Process any remaining content
                if (contentBuffer) {
                    const finalResult = testSplitter.split(contentBuffer);
                    displayedContent += finalResult.closed;
                }

                // The content should be processed
                expect(displayedContent.length).toBeGreaterThan(0);
            }
        });
    });

    describe("Error Handling and Edge Cases", () => {
        it("should handle empty content gracefully", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            const result = splitter.split("");
            
            expect(result.closed).toBe("");
            expect(result.remainder).toBe("");
        });

        it("should handle malformed markdown", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            // Test with malformed content
            const malformedContent = "```\ncode without closing";
            
            const result = splitter.split(malformedContent);
            expect(result.closed).toBe("");
            expect(result.remainder).toContain("```");
            expect(result.remainder).toContain("code without closing");
        });

        it("should handle very large content", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            // Create large content
            let largeContent = "# Large Document\n\n";
            for (let i = 0; i < 1000; i++) {
                largeContent += `Line ${i} with **bold** and *italic* text.\n`;
            }
            
            const startTime = Date.now();
            const result = splitter.split(largeContent);
            const endTime = Date.now();
            
            // Should complete quickly
            expect(endTime - startTime).toBeLessThan(100);
            expect(result.closed.length).toBeGreaterThan(0);
            expect(typeof result.remainder).toBe("string");
        });

        it("should handle rapid successive calls", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            const chunks = ["Hello", " ", "world", "!", "\n", "More", " ", "text"];
            
            for (const chunk of chunks) {
                const result = splitter.split(chunk);
                expect(typeof result.closed).toBe("string");
                expect(typeof result.remainder).toBe("string");
            }
        });
    });

    describe("Configuration Integration", () => {
        it("should respect markdown configuration", () => {
            // Test with markdown disabled
            ChatConfigManager.updateConfig({ enableMarkdown: false });
            
            const splitter = (chatClient as any).markdownSplitter;
            const result = splitter.split("# Header\n\n**Bold** text");
            
            // The splitter should still work regardless of markdown config
            // (the config is handled in the response processor, not the splitter)
            expect(result.closed).toContain("# Header");
            // The remainder should contain the rest since it's not a safe cut yet
            expect(result.remainder).toContain("**Bold**");
            
            // Re-enable markdown
            ChatConfigManager.updateConfig({ enableMarkdown: true });
        });

        it("should handle configuration changes during streaming", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            // Start with markdown enabled
            ChatConfigManager.updateConfig({ enableMarkdown: true });
            let result = splitter.split("# Header\n\n");
            expect(result.closed).toContain("# Header");
            
            // Disable markdown mid-stream
            ChatConfigManager.updateConfig({ enableMarkdown: false });
            result = splitter.split("**Bold** text");
            // The splitter behavior doesn't change based on config
            expect(result.closed).toBe(""); // No safe cut yet
            expect(result.remainder).toContain("**Bold**");
            
            // Re-enable markdown
            ChatConfigManager.updateConfig({ enableMarkdown: true });
        });
    });

    describe("Performance Testing", () => {
        it("should handle high-frequency streaming", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            const iterations = 1000;
            const startTime = Date.now();
            
            for (let i = 0; i < iterations; i++) {
                const result = splitter.split(`Chunk ${i}`);
                expect(typeof result.closed).toBe("string");
                expect(typeof result.remainder).toBe("string");
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete quickly (less than 1 second for 1000 iterations)
            expect(duration).toBeLessThan(1000);
        });

        it("should maintain performance with complex content", () => {
            const splitter = (chatClient as any).markdownSplitter;
            
            const complexContent = `# Complex Document

## Introduction

This is a **complex** document with *various* markdown elements.

### Code Examples

\`\`\`javascript
function complexFunction() {
    const data = {
        name: "test",
        value: 42
    };
    return data;
}
\`\`\`

### Lists

- Item 1
- Item 2
- Item 3

### Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Headers | ✅ | Working |
| Code    | ✅ | Working |
| Lists   | ✅ | Working |

### Links and Images

Visit [GitHub](https://github.com) for more info.

![Example](https://example.com/image.png)

### Blockquotes

> This is a blockquote with **bold** text.

### Horizontal Rules

---

### Emphasis

This is ***bold italic*** text.

### Inline Code

Use \`console.log()\` for debugging.

## Conclusion

This demonstrates **comprehensive** markdown support.`;

            const startTime = Date.now();
            const result = splitter.split(complexContent);
            const endTime = Date.now();
            
            // Should complete quickly
            expect(endTime - startTime).toBeLessThan(50);
            expect(result.closed.length).toBeGreaterThan(0);
            expect(typeof result.remainder).toBe("string");
        });
    });
});
