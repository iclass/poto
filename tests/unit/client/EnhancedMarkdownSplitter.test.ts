import { describe, it, expect, beforeEach } from "bun:test";
import { createMarkdownSplitter } from "../../../src/shared/SimpleMarkdownTracker";
import { MarkdownParser } from "../../../genericChatCli/client/MarkdownParser";
import { ChatConfigManager } from "../../../genericChatCli/client/ChatConfig";

describe("Enhanced Markdown Splitter Integration", () => {
    beforeEach(() => {
        // Ensure markdown is enabled for tests
        ChatConfigManager.updateConfig({ enableMarkdown: true });
    });

    describe("Basic Splitter Functionality", () => {
        it("should handle simple text without splitting", () => {
            const splitter = createMarkdownSplitter();
            const { closed, remainder } = splitter.split("Hello world\n");

            expect(closed).toBe("Hello world");
            expect(remainder).toBe("\n");
        });

        it("should handle complete code blocks", () => {
            const splitter = createMarkdownSplitter();
            const { closed, remainder } = splitter.split("```\ncode\n```\n");

            expect(closed).toBe("```\ncode\n```");
            expect(remainder).toBe("\n");
        });

        it("should buffer incomplete code blocks", () => {
            const splitter = createMarkdownSplitter();
            const { closed, remainder } = splitter.split("```\ncode");

            expect(closed).toBe("");
            expect(remainder).toBe("```\ncode");
        });

        it("should complete buffered code blocks", () => {
            const splitter = createMarkdownSplitter();

            // First push incomplete
            let result = splitter.split("```\ncode");
            expect(result.closed).toBe("");
            expect(result.remainder).toBe("```\ncode");

            // Complete the code block
            result = splitter.split("\n```\n");
            expect(result.closed).toBe("```\ncode\n```");
            expect(result.remainder).toBe("\n");
        });
    });

    describe("Progressive Streaming Simulation", () => {
        it("should simulate realistic streaming with safe cuts", () => {
            const splitter = createMarkdownSplitter();
            const chunks = [
                "# Header\n\n",
                "This is **bold** text.\n\n",
                "## Subheader\n\n",
                "```typescript\n",
                "function hello() {\n",
                "    return 'world';\n",
                "}\n",
                "```\n\n",
                "More content here."
            ];

            let totalClosed = "";
            let buffer = ""; // External buffer for stateless splitter

            for (const chunk of chunks) {
                const { closed, remainder } = splitter.split(buffer, chunk);
                totalClosed += closed;
                buffer = remainder; // Update external buffer
            }

            // Should have processed most content
            expect(totalClosed).toContain("# Header");
            expect(totalClosed).toContain("This is **bold** text");
            expect(totalClosed).toContain("## Subheader");
            expect(totalClosed).toContain("```typescript");
            expect(totalClosed).toContain("function hello()");
            expect(totalClosed).toContain("```");

            // Should have some remainder in the external buffer
            expect(buffer).toContain("More content here");
        });

        it("should handle mixed content with proper state tracking", () => {
            const splitter = createMarkdownSplitter();

            // Simulate a complex document
            const content = `# My Document

This is **bold** and *italic* text.

## Code Example

\`\`\`javascript
function example() {
    console.log('Hello World');
    return true;
}
\`\`\`

## Lists

- Item 1
- Item 2
- Item 3

## Tables

| Feature | Status |
|---------|--------|
| Headers | ✅ |
| Code    | ✅ |

## Conclusion

This demonstrates **progressive rendering**.`;

            const { closed, remainder } = splitter.split(content);

            // Should process most content (the splitter may not process everything in one go)
            expect(closed).toContain("# My Document");
            expect(closed).toContain("This is **bold**");
            expect(closed).toContain("```javascript");
            expect(closed).toContain("function example()");
            expect(closed).toContain("```");
            expect(closed).toContain("- Item 1");
            expect(closed).toContain("| Feature | Status |");

            // The remainder should contain the conclusion
            expect(remainder).toContain("This demonstrates");
        });
    });

    describe("ChatClient Integration Simulation", () => {
        it("should simulate ChatClient streaming workflow", () => {
            const splitter = createMarkdownSplitter();
            let displayedContent = "";
            let contentBuffer = "";

            // Simulate streaming chunks
            const chunks = [
                "Here is a list:\n",
                "- A\n",
                "- B\n",
                "```\n",
                "code\n",
                "more\n",
                "```\n",
                "Final text\n"
            ];

            for (const chunk of chunks) {
                contentBuffer += chunk;

                // Simulate ChatClient processWithMarkdownSplitter
                const { closed, remainder } = splitter.split(contentBuffer);

                if (closed) {
                    // Simulate markdown parsing
                    const formattedText = MarkdownParser.parseWithAiColor(closed);
                    displayedContent += closed;
                    contentBuffer = remainder;
                }
            }

            // Finalize any remaining content
            const { closed: finalClosed } = splitter.split("");
            if (finalClosed) {
                displayedContent += finalClosed;
            }

            expect(displayedContent).toContain("Here is a list:");
            expect(displayedContent).toContain("- A");
            expect(displayedContent).toContain("- B");
            expect(displayedContent).toContain("```");
            expect(displayedContent).toContain("code");
            expect(displayedContent).toContain("more");
            expect(displayedContent).toContain("```");
            expect(displayedContent).toContain("Final text");
        });


    });

    describe("Edge Cases and Error Handling", () => {
        it("should handle empty input", () => {
            const splitter = createMarkdownSplitter();
            const { closed, remainder } = splitter.split("");

            expect(closed).toBe("");
            expect(remainder).toBe("");
        });

        it("should handle only whitespace", () => {
            const splitter = createMarkdownSplitter();
            const { closed, remainder } = splitter.split("   \n\t  \n  ");

            // The splitter should process whitespace
            expect(closed.length).toBeGreaterThan(0);
            expect(remainder.length).toBeLessThanOrEqual(closed.length);
        });

        it("should handle malformed code blocks", () => {
            const splitter = createMarkdownSplitter();

            // Push incomplete code block
            let result = splitter.split("```\ncode without closing");
            expect(result.closed).toBe("");
            expect(result.remainder).toBe("```\ncode without closing");

            // Try to complete with different fence
            result = splitter.split("\n~~~\n");
            expect(result.closed).toBe("");
            expect(result.remainder).toContain("```\ncode without closing");
        });

        it("should handle multiple consecutive code blocks", () => {
            const splitter = createMarkdownSplitter();

            const content = `\`\`\`javascript
const a = 1;
\`\`\`

\`\`\`python
def hello():
    return "world"
\`\`\`

\`\`\`typescript
interface User {
    name: string;
}
\`\`\``;

            const { closed, remainder } = splitter.split(content);

            expect(closed).toContain("```javascript");
            expect(closed).toContain("const a = 1");
            expect(closed).toContain("```");
            expect(closed).toContain("```python");
            expect(closed).toContain("def hello()");
            expect(closed).toContain("```");

            // The third code block might be in remainder
            if (remainder.includes("```typescript")) {
                expect(remainder).toContain("```typescript");
                expect(remainder).toContain("interface User");
            } else {
                expect(closed).toContain("```typescript");
                expect(closed).toContain("interface User");
            }

            expect(remainder.length).toBeLessThan(100);
        });

        it("should handle YAML front matter", () => {
            const splitter = createMarkdownSplitter();

            const content = `---
title: My Document
author: John Doe
---

# Content

This is the main content.`;

            const { closed, remainder } = splitter.split(content);

            expect(closed).toContain("---");
            expect(closed).toContain("title: My Document");
            expect(closed).toContain("author: John Doe");
            expect(closed).toContain("---");
            expect(closed).toContain("# Content");

            // The final content might be in remainder
            if (remainder.includes("This is the main content")) {
                expect(remainder).toContain("This is the main content");
            } else {
                expect(closed).toContain("This is the main content");
            }

            expect(remainder.length).toBeLessThan(50);
        });

        it("should handle incomplete YAML front matter", () => {
            const splitter = createMarkdownSplitter();

            const content = `---
title: My Document
author: John Doe`;

            const { closed, remainder } = splitter.split(content);

            expect(closed).toBe("");
            expect(remainder).toBe("---\ntitle: My Document\nauthor: John Doe");
        });
    });

    describe("Performance and Stress Testing", () => {
        it("should handle large documents efficiently", () => {
            const splitter = createMarkdownSplitter();

            // Create a large document
            let content = "# Large Document\n\n";
            for (let i = 0; i < 100; i++) {
                content += `## Section ${i}\n\n`;
                content += `This is section ${i} with **bold** and *italic* text.\n\n`;
                content += `\`\`\`javascript\n`;
                content += `function section${i}() {\n`;
                content += `    return "Section ${i}";\n`;
                content += `}\n`;
                content += `\`\`\`\n\n`;
            }

            const startTime = Date.now();
            const { closed, remainder } = splitter.split(content);
            const endTime = Date.now();

            // Should complete quickly (less than 100ms)
            expect(endTime - startTime).toBeLessThan(100);

            // Should process most content
            expect(closed.length).toBeGreaterThan(content.length * 0.9);
            expect(remainder.length).toBeLessThan(content.length * 0.1);
        });

        it("should handle rapid streaming chunks", () => {
            const splitter = createMarkdownSplitter();
            const text = "Hello world! This is a test of rapid streaming.";
            const chunks = text.split('');

            let totalClosed = "";
            let totalRemainder = "";

            for (const chunk of chunks) {
                const { closed, remainder } = splitter.split(chunk);
                totalClosed += closed;
                totalRemainder = remainder;
            }

            // Should accumulate most content
            expect(totalClosed + totalRemainder).toBe(text);
        });

        it("should handle mixed content types efficiently", () => {
            const splitter = createMarkdownSplitter();

            // Create mixed content
            const content = `# Mixed Content Test

This document contains **various** markdown elements.

## Code Examples

\`\`\`javascript
function example() {
    return "Hello World";
}
\`\`\`

## Lists

- Item 1
- Item 2
- Item 3

## Tables

| Feature | Status |
|---------|--------|
| Headers | ✅ |
| Code    | ✅ |
| Lists   | ✅ |

## Links

Visit [GitHub](https://github.com) for more info.

## Images

![Alt text](https://example.com/image.png)

## Blockquotes

> This is a blockquote with **bold** text.

## Horizontal Rules

---

## Emphasis

This is ***bold italic*** text.

## Inline Code

Use \`console.log()\` for debugging.

## Conclusion

This demonstrates **comprehensive** markdown support.`;

            const { closed, remainder } = splitter.split(content);

            // Should process all content types
            expect(closed).toContain("# Mixed Content Test");
            expect(closed).toContain("**various**");
            expect(closed).toContain("```javascript");
            expect(closed).toContain("function example()");
            expect(closed).toContain("```");
            expect(closed).toContain("- Item 1");
            expect(closed).toContain("| Feature | Status |");
            expect(closed).toContain("[GitHub](https://github.com)");
            expect(closed).toContain("![Alt text]");
            expect(closed).toContain("> This is a blockquote");
            expect(closed).toContain("---");
            expect(closed).toContain("***bold italic***");
            expect(closed).toContain("`console.log()`");

            // The final content might be in remainder
            if (remainder.includes("**comprehensive**")) {
                expect(remainder).toContain("**comprehensive**");
            } else {
                expect(closed).toContain("**comprehensive**");
            }

            expect(remainder.length).toBeLessThan(100);
        });
    });

    describe("State Management", () => {
        it("should maintain state across multiple pushes", () => {
            const splitter = createMarkdownSplitter();

            // Start a code block
            let result = splitter.split("```javascript\n");
            expect(result.closed).toBe("");
            expect(result.remainder).toBe("```javascript\n");

            // Add code content
            result = splitter.split("function test() {\n");
            expect(result.closed).toBe("");
            expect(result.remainder).toBe("```javascript\nfunction test() {\n");

            // Complete the code block
            result = splitter.split("}\n```\n");
            expect(result.closed).toBe("```javascript\nfunction test() {\n}\n```");
            expect(result.remainder).toBe("\n");
        });

        it("should handle nested structures", () => {
            const splitter = createMarkdownSplitter();

            const content = `# Header

## Subheader

\`\`\`javascript
function outer() {
    function inner() {
        return "nested";
    }
    return inner();
}
\`\`\`

### Sub-subheader

More content here.`;

            const { closed, remainder } = splitter.split(content);

            expect(closed).toContain("# Header");
            expect(closed).toContain("## Subheader");
            expect(closed).toContain("```javascript");
            expect(closed).toContain("function outer()");
            expect(closed).toContain("function inner()");
            expect(closed).toContain("```");
            expect(closed).toContain("### Sub-subheader");

            // The final content might be in remainder
            if (remainder.includes("More content here")) {
                expect(remainder).toContain("More content here");
            } else {
                expect(closed).toContain("More content here");
            }

            expect(remainder.length).toBeLessThan(100);
        });
    });

    it("should wait until a full closed markdown table before outputting", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming a markdown table line by line
        const tableLines = [
            "| Name   | Value |\n",
            "|--------|-------|\n",
            "| Alice  | 42    |\n",
            "| Bob    | 99    |\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of tableLines) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
            // After each line except the last, the splitter should not output the table yet
            // (it waits for a safe cut, i.e., after the table is fully closed)
        }

        // The splitter should not output the table until it's fully closed
        // Let's check that after each line, nothing is output yet
        expect(progressiveClosed[0]).toBe(""); // after header
        expect(progressiveClosed[1]).toBe(""); // after separator
        expect(progressiveClosed[2]).toBe(""); // after first row
        expect(progressiveClosed[3]).toBe(""); // after last row - still buffering

        // The remainder should contain the full table
        expect(remainder).toContain("| Name   | Value |");
        expect(remainder).toContain("|--------|-------|");
        expect(remainder).toContain("| Alice  | 42    |");
        expect(remainder).toContain("| Bob    | 99    |");

        // Now, if we add more content, the splitter should output the table plus the new content
        const moreContent = "\nSome text after the table.\n";
        const { closed: closed2, remainder: remainder2 } = splitter.split(moreContent);
        expect(closed2).toContain("| Name   | Value |");
        expect(closed2).toContain("|--------|-------|");
        expect(closed2).toContain("| Alice  | 42    |");
        expect(closed2).toContain("| Bob    | 99    |");
        expect(closed2).toContain("Some text after the table.");
        expect(remainder2).toBe("\n");
    });

    it("should wait until a full unordered list before outputting", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming an unordered list line by line
        const listLines = [
            "- First item\n",
            "- Second item\n",
            "- Third item\n",
            "\n",
            "- t1\n",
            "- t2\n",
            "- t3\n",
            "end of list\n",
            "- Parent item\n",
            "  - Nested item 1\n",
            "  - Nested item 2\n",
            "- Another parent\n",
            "  - More nested\n",
            "Final text\n",
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];
        let accumulatedBuffer = ""; // External buffer

        for (const line of listLines) {
            // Accumulate content in external buffer
            accumulatedBuffer += line;
            
            // Use the stateless splitter on the accumulated buffer
            const result = splitter.split(accumulatedBuffer);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
            accumulatedBuffer = remainder; // Update external buffer
            // After each line, the splitter should not output the list yet
            // (it waits for a safe cut, i.e., after the list is fully closed)
        }

        // The splitter should not output the list until it's fully closed
        // Let's check that after each line, nothing is output yet
        expect(progressiveClosed[0]).toBe(""); // after first item
        expect(progressiveClosed[1]).toBe(""); // after second item
        expect(progressiveClosed[2]).toBe(""); // after third item - still buffering

        // The remainder should contain the full list
        expect(progressiveClosed[3]).toContain("- First item");
        expect(progressiveClosed[3]).toContain("- Second item");
        expect(progressiveClosed[3]).toContain("- Third item");

        // Check that the second group of list items is buffered correctly
        expect(progressiveClosed[4]).toBe(""); // after t1 - still buffering
        expect(progressiveClosed[5]).toBe(""); // after t2 - still buffering
        expect(progressiveClosed[6]).toBe(""); // after t3 - still buffering

        // When we encounter non-list content, the second list should be output
        expect(progressiveClosed[7]).toContain("- t1");
        expect(progressiveClosed[7]).toContain("- t2");
        expect(progressiveClosed[7]).toContain("- t3");
        expect(progressiveClosed[7]).not.toContain("end of list"); // Non-list content should be in remainder

        // The "end of list" text should be output when it encounters the next list
        expect(progressiveClosed[8]).toContain("end of list");

        // Check that the third group with nested lists is buffered correctly
        expect(progressiveClosed[9]).toBe(""); // after "Parent item" - still buffering
        expect(progressiveClosed[10]).toBe(""); // after "Nested item 1" - still buffering
        expect(progressiveClosed[11]).toBe(""); // after "Nested item 2" - still buffering
        expect(progressiveClosed[12]).toBe(""); // after "Another parent" - still buffering
        // Note: progressiveClosed[13] contains the nested list when "Final text" is processed

        // When we encounter non-list content, the third list with nested items should be output
        expect(progressiveClosed[13]).toContain("- Parent item");
        expect(progressiveClosed[13]).toContain("  - Nested item 1");
        expect(progressiveClosed[13]).toContain("  - Nested item 2");
        expect(progressiveClosed[13]).toContain("- Another parent");
        expect(progressiveClosed[13]).toContain("  - More nested");
        expect(progressiveClosed[13]).not.toContain("Final text"); // Non-list content should be in remainder
        expect(remainder).toContain("Final text"); // Non-list content should be in remainder

    });

    it("should wait until a full ordered list before outputting", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming an ordered list line by line
        const listLines = [
            "1. First item\n",
            "2. Second item\n",
            "3. Third item\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of listLines) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
            // After each line, the splitter should not output the list yet
            // (it waits for a safe cut, i.e., after the list is fully closed)
        }

        // The splitter should not output the list until it's fully closed
        // Let's check that after each line, nothing is output yet
        expect(progressiveClosed[0]).toBe(""); // after first item
        expect(progressiveClosed[1]).toBe(""); // after second item
        expect(progressiveClosed[2]).toBe(""); // after third item - still buffering

        // The remainder should contain the full list
        expect(remainder).toContain("1. First item");
        expect(remainder).toContain("2. Second item");
        expect(remainder).toContain("3. Third item");

        // Now, if we add more content, the splitter should output the list plus the new content
        const moreContent = "\nSome text after the list.\n";
        const { closed: closed2, remainder: remainder2 } = splitter.split(moreContent);
        expect(closed2).toContain("1. First item");
        expect(closed2).toContain("2. Second item");
        expect(closed2).toContain("3. Third item");
        expect(closed2).not.toContain("Some text after the list."); // List should be separated from non-list content
        expect(remainder2).toContain("Some text after the list."); // Non-list content should be in remainder
    });

    it("should handle mixed list types correctly", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming mixed content with lists
        const contentLines = [
            "Here's a list:\n",
            "- Item 1\n",
            "- Item 2\n",
            "\n",
            "And an ordered list:\n",
            "1. First\n",
            "2. Second\n",
            "\n",
            "End of content.\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of contentLines) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // The splitter should buffer the lists and output them when appropriate
        // Line 1: "Here's a list:" is output immediately (not part of a list)
        expect(progressiveClosed[0]).toBe("Here's a list:");
        
        // Lines 2-4: The list items are buffered
        expect(progressiveClosed[1]).toBe(""); // after first list item
        expect(progressiveClosed[2]).toBe(""); // after second list item
        expect(progressiveClosed[3]).toBe(""); // after empty line after first list
        
        // Line 5: When we encounter "And an ordered list:", the first list should be output
        expect(progressiveClosed[4]).toContain("- Item 1");
        expect(progressiveClosed[4]).toContain("- Item 2");
        expect(progressiveClosed[4]).not.toContain("And an ordered list:"); // List should be separated from non-list content
        
        // Lines 6-8: The second list items are buffered
        expect(progressiveClosed[5]).toBe(""); // after first ordered list item
        expect(progressiveClosed[6]).toBe(""); // after second ordered list item
        expect(progressiveClosed[7]).toBe(""); // after empty line after second list
        
        // Line 9: After the final content, the second list should be output
        expect(progressiveClosed[8]).toContain("1. First");
        expect(progressiveClosed[8]).toContain("2. Second");
        expect(progressiveClosed[8]).not.toContain("End of content."); // List should be separated from non-list content
    });

    it("should wait until a full code block is complete before outputting as single unit", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming a code block line by line
        const codeBlockLines = [
            "```javascript\n",
            "function hello() {\n",
            "    console.log('Hello World');\n",
            "    return true;\n",
            "}\n",
            "```\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of codeBlockLines) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // The splitter should buffer the code block until it's complete
        // Lines 1-5: The code block should be buffered (no output)
        expect(progressiveClosed[0]).toBe(""); // after opening fence
        expect(progressiveClosed[1]).toBe(""); // after function declaration
        expect(progressiveClosed[2]).toBe(""); // after console.log
        expect(progressiveClosed[3]).toBe(""); // after return statement
        expect(progressiveClosed[4]).toBe(""); // after closing brace
        
        // Line 6: After the closing fence, the complete code block should be output
        expect(progressiveClosed[5]).toContain("```javascript");
        expect(progressiveClosed[5]).toContain("function hello() {");
        expect(progressiveClosed[5]).toContain("console.log('Hello World')");
        expect(progressiveClosed[5]).toContain("return true");
        expect(progressiveClosed[5]).toContain("```");

        // The remainder should contain just the final newline
        expect(remainder).toBe("\n");

        // Now, if we add more content, it should be output immediately
        const moreContent = "\nSome text after the code block.\n";
        const { closed: closed2, remainder: remainder2 } = splitter.split(moreContent);
        expect(closed2).toContain("Some text after the code block.");
        expect(remainder2).toBe("\n");
    });

    it("should wait until a full code block is complete when streaming character by character", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming a code block character by character
        const codeBlock = "```python\ndef hello():\n    print('Hello')\n    return True\n```\n";
        const characters = codeBlock.split('');

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const char of characters) {
            const result = splitter.split(char);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // The splitter should not output anything until the code block is complete
        // Check that most characters result in no output (except the final newline)
        const nonEmptyOutputs = progressiveClosed.filter(output => output.length > 0);
        
        // Should have at most one output (the complete code block at the end)
        expect(nonEmptyOutputs.length).toBeLessThanOrEqual(1);

        // The final output should contain the complete code block
        if (nonEmptyOutputs.length > 0) {
            expect(nonEmptyOutputs[0]).toContain("```python");
            expect(nonEmptyOutputs[0]).toContain("def hello():");
            expect(nonEmptyOutputs[0]).toContain("print('Hello')");
            expect(nonEmptyOutputs[0]).toContain("return True");
            expect(nonEmptyOutputs[0]).toContain("```");
        }

        // The remainder should contain just the final newline
        expect(remainder).toBe("\n");

        // Now, if we add more content, it should be buffered with the code block
        const moreContent = "Text after code block.";
        const { closed: closed2, remainder: remainder2 } = splitter.split(moreContent);
        expect(closed2).toBe(""); // No output yet
        expect(remainder2).toContain("Text after code block.");
    });

    it("should handle multiple code blocks with patience for each", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming multiple code blocks
        const contentLines = [
            "Here's the first code block:\n",
            "```typescript\n",
            "interface User {\n",
            "    name: string;\n",
            "    age: number;\n",
            "}\n",
            "```\n",
            "\n",
            "And here's the second:\n",
            "```javascript\n",
            "const user = {\n",
            "    name: 'John',\n",
            "    age: 30\n",
            "};\n",
            "```\n",
            "\n",
            "End of content.\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of contentLines) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // The splitter should buffer each code block until it's complete
        // Line 1: "Here's the first code block:" should be output immediately
        expect(progressiveClosed[0]).toBe("Here's the first code block:");
        
        // Lines 2-6: The first code block should be buffered
        expect(progressiveClosed[1]).toBe(""); // after opening fence
        expect(progressiveClosed[2]).toBe(""); // after interface declaration
        expect(progressiveClosed[3]).toBe(""); // after name property
        expect(progressiveClosed[4]).toBe(""); // after age property
        expect(progressiveClosed[5]).toBe(""); // after closing brace
        
        // Line 7: After the closing fence, the first code block should be output
        expect(progressiveClosed[6]).toContain("```typescript");
        expect(progressiveClosed[6]).toContain("interface User {");
        expect(progressiveClosed[6]).toContain("name: string;");
        expect(progressiveClosed[6]).toContain("age: number;");
        expect(progressiveClosed[6]).toContain("```");
        
        // Line 8: Empty line should be output immediately
        expect(progressiveClosed[7]).toBe("\n");
        
        // Line 9: "And here's the second:" should be output immediately
        expect(progressiveClosed[8]).toBe("\nAnd here's the second:");
        
        // Lines 10-14: The second code block should be buffered
        expect(progressiveClosed[9]).toBe(""); // after opening fence
        expect(progressiveClosed[10]).toBe(""); // after const declaration
        expect(progressiveClosed[11]).toBe(""); // after name property
        expect(progressiveClosed[12]).toBe(""); // after age property
        expect(progressiveClosed[13]).toBe(""); // after closing brace
        
        // Line 15: After the closing fence, the second code block should be output
        expect(progressiveClosed[14]).toContain("```javascript");
        expect(progressiveClosed[14]).toContain("const user = {");
        expect(progressiveClosed[14]).toContain("name: 'John'");
        expect(progressiveClosed[14]).toContain("age: 30");
        expect(progressiveClosed[14]).toContain("```");
        
        // Line 16: Empty line should be output immediately
        expect(progressiveClosed[15]).toBe("\n");
        
        // Line 17: Final content should be output immediately
        expect(progressiveClosed[16]).toBe("\nEnd of content.");
    });

    it("should handle code blocks with different fence types patiently", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming code blocks with different fence types
        const contentLines = [
            "Backtick fence:\n",
            "```\n",
            "code with backticks\n",
            "```\n",
            "\n",
            "Tilde fence:\n",
            "~~~\n",
            "code with tildes\n",
            "~~~\n",
            "\n",
            "End.\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of contentLines) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // The splitter should buffer each code block until it's complete
        // Line 1: "Backtick fence:" should be output immediately
        expect(progressiveClosed[0]).toBe("Backtick fence:");
        
        // Lines 2-3: The first code block should be buffered
        expect(progressiveClosed[1]).toBe(""); // after opening backtick fence
        expect(progressiveClosed[2]).toBe(""); // after code content
        
        // Line 4: After the closing backtick fence, the first code block should be output
        expect(progressiveClosed[3]).toContain("```");
        expect(progressiveClosed[3]).toContain("code with backticks");
        expect(progressiveClosed[3]).toContain("```");
        
        // Line 5: Empty line should be output immediately
        expect(progressiveClosed[4]).toBe("\n");
        
        // Line 6: "Tilde fence:" should be output immediately
        expect(progressiveClosed[5]).toBe("\nTilde fence:");
        
        // Lines 7-8: The second code block should be buffered
        expect(progressiveClosed[6]).toBe(""); // after opening tilde fence
        expect(progressiveClosed[7]).toBe(""); // after code content
        
        // Line 9: After the closing tilde fence, the second code block should be output
        expect(progressiveClosed[8]).toContain("~~~");
        expect(progressiveClosed[8]).toContain("code with tildes");
        expect(progressiveClosed[8]).toContain("~~~");
        
        // Line 10: Empty line should be output immediately
        expect(progressiveClosed[9]).toBe("\n");
        
        // Line 11: Final content should be output immediately
        expect(progressiveClosed[10]).toBe("\nEnd.");
    });

    it("should handle nested lists with patience for complete structure", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming a nested list
        const nestedListLines = [
            "Here's a nested list:\n",
            "- Item 1\n",
            "  - Sub-item 1a\n",
            "  - Sub-item 1b\n",
            "- Item 2\n",
            "  - Sub-item 2a\n",
            "  - Sub-item 2b\n",
            "\n",
            "Text after the list.\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of nestedListLines) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // The splitter should output the intro text immediately, then buffer the nested list
        // Line 1: Intro text should be output immediately
        expect(progressiveClosed[0]).toBe("Here's a nested list:");
        
        // Lines 2-7: The nested list should be buffered (no output)
        expect(progressiveClosed[1]).toBe(""); // after "Item 1"
        expect(progressiveClosed[2]).toBe(""); // after "Sub-item 1a"
        expect(progressiveClosed[3]).toBe(""); // after "Sub-item 1b"
        expect(progressiveClosed[4]).toBe(""); // after "Item 2"
        expect(progressiveClosed[5]).toBe(""); // after "Sub-item 2a"
        expect(progressiveClosed[6]).toBe(""); // after "Sub-item 2b"
        
        // Line 8: After the empty line, the nested list should still be buffered
        expect(progressiveClosed[7]).toBe("");
        
        // Line 9: When we encounter non-list content, the complete nested list should be output
        expect(progressiveClosed[8]).toContain("- Item 1");
        expect(progressiveClosed[8]).toContain("  - Sub-item 1a");
        expect(progressiveClosed[8]).toContain("  - Sub-item 1b");
        expect(progressiveClosed[8]).toContain("- Item 2");
        expect(progressiveClosed[8]).toContain("  - Sub-item 2a");
        expect(progressiveClosed[8]).toContain("  - Sub-item 2b");
        expect(progressiveClosed[8]).not.toContain("Text after the list."); // List should be separated from non-list content
    });

    it("should handle nested lists with different indentation levels", () => {
        const splitter = createMarkdownSplitter();

        // Simulate streaming a deeply nested list
        const deeplyNestedList = [
            "Complex nested structure:\n",
            "- Level 1\n",
            "  - Level 2a\n",
            "    - Level 3a\n",
            "    - Level 3b\n",
            "  - Level 2b\n",
            "- Level 1b\n",
            "\n",
            "End of content.\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of deeplyNestedList) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // The splitter should output the intro text immediately, then buffer the nested structure
        // Line 1: Intro text should be output immediately
        expect(progressiveClosed[0]).toBe("Complex nested structure:");
        
        // Lines 2-7: The nested structure should be buffered (no output)
        for (let i = 1; i < 7; i++) {
            expect(progressiveClosed[i]).toBe("");
        }
        
        // Line 8: After the empty line, the nested structure should still be buffered
        expect(progressiveClosed[7]).toBe("");
        
        // Line 9: When we encounter non-list content, the complete nested structure should be output
        expect(progressiveClosed[8]).toContain("- Level 1");
        expect(progressiveClosed[8]).toContain("  - Level 2a");
        expect(progressiveClosed[8]).toContain("    - Level 3a");
        expect(progressiveClosed[8]).toContain("    - Level 3b");
        expect(progressiveClosed[8]).toContain("  - Level 2b");
        expect(progressiveClosed[8]).toContain("- Level 1b");
        expect(progressiveClosed[8]).not.toContain("End of content."); // List should be separated from non-list content
    });

    it("should format nested list items without extra line breaks", () => {
        const splitter = createMarkdownSplitter();

        // Test the exact formatting of nested list items
        const nestedListContent = [
            "Here's a nested list:\n",
            "- Item 1\n",
            "  - Sub-item 1a\n",
            "  - Sub-item 1b\n",
            "- Item 2\n",
            "  - Sub-item 2a\n",
            "  - Sub-item 2b\n",
            "\n",
            "Text after the list.\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of nestedListContent) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // Get the final output that contains the complete nested list
        const finalOutput = progressiveClosed[8];
        
        // Check that there are no extra line breaks between sub-items
        // The output should not contain patterns like "Sub-item 1a\n\n  - Sub-item 1b"
        expect(finalOutput).not.toMatch(/Sub-item 1a\n\n\s*- Sub-item 1b/);
        expect(finalOutput).not.toMatch(/Sub-item 2a\n\n\s*- Sub-item 2b/);
        
        // Check that sub-items are properly formatted with single line breaks
        expect(finalOutput).toMatch(/Sub-item 1a\n\s*- Sub-item 1b/);
        expect(finalOutput).toMatch(/Sub-item 2a\n\s*- Sub-item 2b/);
        
        // Verify the exact structure - sub-items should be consecutive without extra spacing
        const lines = finalOutput.split('\n');
        const subItem1aIndex = lines.findIndex(line => line.includes('Sub-item 1a'));
        const subItem1bIndex = lines.findIndex(line => line.includes('Sub-item 1b'));
        const subItem2aIndex = lines.findIndex(line => line.includes('Sub-item 2a'));
        const subItem2bIndex = lines.findIndex(line => line.includes('Sub-item 2b'));
        
        // Sub-items should be consecutive (no empty lines between them)
        expect(subItem1bIndex - subItem1aIndex).toBe(1);
        expect(subItem2bIndex - subItem2aIndex).toBe(1);
        
        // Verify proper indentation (2 spaces for sub-items)
        expect(lines[subItem1aIndex]).toMatch(/^\s{2}- Sub-item 1a$/);
        expect(lines[subItem1bIndex]).toMatch(/^\s{2}- Sub-item 1b$/);
        expect(lines[subItem2aIndex]).toMatch(/^\s{2}- Sub-item 2a$/);
        expect(lines[subItem2bIndex]).toMatch(/^\s{2}- Sub-item 2b$/);
    });

    it("should handle deeply nested lists without extra line breaks", () => {
        const splitter = createMarkdownSplitter();

        // Test deeply nested structure with multiple levels
        const deeplyNestedContent = [
            "Complex nested structure:\n",
            "- Level 1\n",
            "  - Level 2a\n",
            "    - Level 3a\n",
            "    - Level 3b\n",
            "  - Level 2b\n",
            "- Level 1b\n",
            "\n",
            "End of content.\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of deeplyNestedContent) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // Get the final output that contains the complete nested structure
        const finalOutput = progressiveClosed[8];
        
        // Check that there are no extra line breaks between nested items
        expect(finalOutput).not.toMatch(/Level 3a\n\n\s*- Level 3b/);
        expect(finalOutput).not.toMatch(/Level 2a\n\n\s*- Level 2b/);
        
        // Verify proper indentation at each level
        const lines = finalOutput.split('\n');
        const level1Index = lines.findIndex(line => line.includes('Level 1') && !line.includes('Level 1b'));
        const level2aIndex = lines.findIndex(line => line.includes('Level 2a'));
        const level3aIndex = lines.findIndex(line => line.includes('Level 3a'));
        const level3bIndex = lines.findIndex(line => line.includes('Level 3b'));
        const level2bIndex = lines.findIndex(line => line.includes('Level 2b'));
        const level1bIndex = lines.findIndex(line => line.includes('Level 1b'));
        
        // Check indentation levels
        expect(lines[level1Index]).toMatch(/^- Level 1$/);           // 0 spaces
        expect(lines[level2aIndex]).toMatch(/^\s{2}- Level 2a$/);    // 2 spaces
        expect(lines[level3aIndex]).toMatch(/^\s{4}- Level 3a$/);    // 4 spaces
        expect(lines[level3bIndex]).toMatch(/^\s{4}- Level 3b$/);    // 4 spaces
        expect(lines[level2bIndex]).toMatch(/^\s{2}- Level 2b$/);    // 2 spaces
        expect(lines[level1bIndex]).toMatch(/^- Level 1b$/);         // 0 spaces
        
        // Check that nested items are consecutive (no extra line breaks)
        expect(level3bIndex - level3aIndex).toBe(1);
        expect(level2bIndex - level3bIndex).toBe(1);
    });

    it("should output complete list immediately when encountering non-list content", () => {
        const splitter = createMarkdownSplitter();

        // Test the specific case mentioned: list should be output after Item 3, not wait for entire input
        const content = [
            "- Item 1\n",
            "- Item 2\n",
            "  - Sub-item 2a\n",
            "  - Sub-item 2b\n",
            "+ Item 3\n",
            "\n",
            "### **2. Ordered Lists (Numbered)**\n",
            "Use numbers followed by periods (`.`) and a space.\n",
            "1. First item\n",
            "2. Second item\n"
        ];

        let closed = "";
        let remainder = "";
        let progressiveClosed: string[] = [];

        for (const line of content) {
            const result = splitter.split(line);
            progressiveClosed.push(result.closed);
            closed = result.closed;
            remainder = result.remainder;
        }

        // The splitter should output the complete list (including Item 3) when it encounters the header
        // Line 6: After the empty line, the list should still be buffered
        expect(progressiveClosed[5]).toBe("");
        
        // Line 7: When we encounter the header, the complete list should be output
        expect(progressiveClosed[6]).toContain("- Item 1");
        expect(progressiveClosed[6]).toContain("- Item 2");
        expect(progressiveClosed[6]).toContain("  - Sub-item 2a");
        expect(progressiveClosed[6]).toContain("  - Sub-item 2b");
        expect(progressiveClosed[6]).toContain("+ Item 3");
        
        // The header should NOT be included in the list output
        expect(progressiveClosed[6]).not.toContain("### **2. Ordered Lists (Numbered)**");
        
        // The list should be output when we encounter the header, and the header should be in the remainder
        expect(progressiveClosed[6]).toContain("- Item 1"); // The list should be output when we encounter the header
        expect(progressiveClosed[6]).not.toContain("### **2. Ordered Lists (Numbered)**"); // Header should not be included
    });
});
