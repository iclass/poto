import { describe, it, expect, beforeEach } from "bun:test";
import { 
    createSimpleMdState, 
    feedChunkSimple, 
    snapshotSimpleMarkdown, 
    SimpleMdState 
} from "../../../src/shared/SimpleMarkdownTracker";

describe("SimpleMarkdownTracker", () => {
    let state: SimpleMdState;

    beforeEach(() => {
        state = createSimpleMdState();
    });

    describe("Basic Text Handling", () => {
        it("should handle simple text", () => {
            feedChunkSimple(state, "Hello world!");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("Hello world!\n");
        });

        it("should handle multiple chunks", () => {
            feedChunkSimple(state, "Hello ");
            feedChunkSimple(state, "world!");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("Hello world!\n");
        });

        it("should handle empty input", () => {
            feedChunkSimple(state, "");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("\n");
        });
    });

    describe("Headers", () => {
        it("should handle single header", () => {
            feedChunkSimple(state, "# Header 1");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("# Header 1\n");
        });

        it("should handle multiple headers", () => {
            feedChunkSimple(state, "# Header 1\n## Header 2\n### Header 3");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("# Header 1\n## Header 2\n### Header 3\n");
        });
    });

    describe("Bold and Italic", () => {
        it("should handle bold text", () => {
            feedChunkSimple(state, "This is **bold** text.");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("This is **bold** text.\n");
        });

        it("should handle italic text", () => {
            feedChunkSimple(state, "This is *italic* text.");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("This is *italic* text.\n");
        });

        it("should handle mixed bold and italic", () => {
            feedChunkSimple(state, "This is **bold** and *italic* text.");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("This is **bold** and *italic* text.\n");
        });
    });

    describe("Fenced Code Blocks", () => {
        it("should handle complete fenced code block", () => {
            feedChunkSimple(state, "```typescript\nconst hello = 'world';\nconsole.log(hello);\n```");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("```typescript\nconst hello = 'world';\nconsole.log(hello);\n```\n");
        });

        it("should close incomplete fenced code block", () => {
            feedChunkSimple(state, "```typescript\nconst hello = 'world';\nconsole.log(hello);");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("```typescript\nconst hello = 'world';\nconsole.log(hello);\n```\n");
        });

        it("should handle mixed fence types", () => {
            feedChunkSimple(state, "```typescript\ncode\n```\n\n~~~javascript\nmore code\n~~~");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("```typescript\ncode\n```\n\n~~~javascript\nmore code\n~~~\n");
        });

        it("should close incomplete mixed fence types", () => {
            feedChunkSimple(state, "```typescript\ncode\n```\n\n~~~javascript\nmore code");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("```typescript\ncode\n```\n\n~~~javascript\nmore code\n~~~\n");
        });
    });

    describe("Lists", () => {
        it("should handle unordered lists", () => {
            feedChunkSimple(state, "- Item 1\n- Item 2\n- Item 3");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("- Item 1\n- Item 2\n- Item 3\n");
        });

        it("should handle numbered lists", () => {
            feedChunkSimple(state, "1. First item\n2. Second item\n3. Third item");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("1. First item\n2. Second item\n3. Third item\n");
        });
    });

    describe("Tables", () => {
        it("should handle complete tables", () => {
            feedChunkSimple(state, "| Feature | Status |\n|---------|-------|\n| Headers | ✅ |\n| Lists   | ✅ |");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("| Feature | Status |\n|---------|-------|\n| Headers | ✅ |\n| Lists   | ✅ |\n");
        });

        it("should add separator for incomplete table header", () => {
            feedChunkSimple(state, "| Feature | Status |");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("| Feature | Status |\n| --- | --- |\n");
        });
    });

    describe("Links and Images", () => {
        it("should handle complete links", () => {
            feedChunkSimple(state, "Visit [GitHub](https://github.com) for more info.");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("Visit [GitHub](https://github.com) for more info.\n");
        });

        it("should close incomplete links", () => {
            feedChunkSimple(state, "Visit [GitHub](https://github.com for more info");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("Visit [GitHub](#)\n");
        });

        it("should handle complete images", () => {
            feedChunkSimple(state, "![Alt text](https://example.com/image.png)");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("![Alt text](https://example.com/image.png)\n");
        });

        it("should close incomplete images", () => {
            feedChunkSimple(state, "![Alt text](https://example.com/image.png");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("![Alt text](#)\n");
        });
    });

    describe("YAML Front Matter", () => {
        it("should handle complete YAML front matter", () => {
            feedChunkSimple(state, "---\ntitle: My Document\nauthor: John Doe\n---\n\n# Content");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("---\ntitle: My Document\nauthor: John Doe\n---\n\n# Content\n");
        });

        it("should close incomplete YAML front matter", () => {
            feedChunkSimple(state, "---\ntitle: My Document\nauthor: John Doe");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("---\ntitle: My Document\nauthor: John Doe\n---\n");
        });
    });

    describe("Complex Mixed Content", () => {
        it("should handle complex mixed content", () => {
            const content = "# My Document\n\nThis is **bold** and *italic* text.\n\n```typescript\nconst hello = 'world';\n```\n\n- Item 1\n- Item 2\n\n| Feature | Status |\n|---------|-------|\n| Headers | ✅ |";
            feedChunkSimple(state, content);
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("# My Document\n\nThis is **bold** and *italic* text.\n\n```typescript\nconst hello = 'world';\n```\n\n- Item 1\n- Item 2\n\n| Feature | Status |\n|---------|-------|\n| Headers | ✅ |\n");
        });
    });

    describe("Streaming Simulation", () => {
        it("should handle word-by-word streaming", () => {
            const text = "Hello world! This is a test.";
            const words = text.split(' ');
            
            for (const word of words) {
                feedChunkSimple(state, word + ' ');
            }
            
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("Hello world! This is a test. \n");
        });

        it("should handle character-by-character streaming", () => {
            const text = "**Bold text** and *italic text*";
            const chars = text.split('');
            
            for (const char of chars) {
                feedChunkSimple(state, char);
            }
            
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("**Bold text** and *italic text*\n");
        });

        it("should handle line-by-line streaming", () => {
            const lines = [
                "# Header",
                "",
                "This is a paragraph.",
                "",
                "## Subheader",
                "",
                "Another paragraph."
            ];
            
            for (const line of lines) {
                feedChunkSimple(state, line + '\n');
            }
            
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("# Header\n\nThis is a paragraph.\n\n## Subheader\n\nAnother paragraph.\n");
        });

        it("should handle code block streaming", () => {
            const codeBlock = "```typescript\nconst hello = 'world';\nconsole.log(hello);\n```";
            const chunks = codeBlock.split('');
            
            for (const chunk of chunks) {
                feedChunkSimple(state, chunk);
            }
            
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("```typescript\nconst hello = 'world';\nconsole.log(hello);\n```\n");
        });
    });

    describe("State Management", () => {
        it("should track fence state correctly", () => {
            expect(state.inFence).toBe(false);
            expect(state.fenceChar).toBe(null);
            
            feedChunkSimple(state, "```typescript\n");
            expect(state.inFence).toBe(true);
            expect(state.fenceChar).toBe("`");
            expect(state.fenceLen).toBe(3);
            
            feedChunkSimple(state, "```\n");
            expect(state.inFence).toBe(false);
            expect(state.fenceChar).toBe(null);
        });

        it("should track YAML front matter state", () => {
            expect(state.inYamlFrontmatter).toBe(false);
            
            feedChunkSimple(state, "---\n");
            expect(state.inYamlFrontmatter).toBe(true);
            
            feedChunkSimple(state, "---\n");
            expect(state.inYamlFrontmatter).toBe(false);
        });

        it("should track last non-empty line", () => {
            expect(state.lastNonEmptyLine).toBe(null);
            
            feedChunkSimple(state, "Line 1\n");
            expect(state.lastNonEmptyLine).toBe("Line 1");
            
            feedChunkSimple(state, "\n\nLine 2\n");
            expect(state.lastNonEmptyLine).toBe("Line 2");
        });
    });

    describe("Edge Cases", () => {
        it("should handle only whitespace", () => {
            feedChunkSimple(state, "   \n\t  \n  ");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("   \n\t  \n  \n");
        });

        it("should handle multiple newlines", () => {
            feedChunkSimple(state, "Line 1\n\n\nLine 2");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("Line 1\n\n\nLine 2\n");
        });

        it("should handle mixed emphasis", () => {
            feedChunkSimple(state, "This is ***bold italic*** text.");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("This is ***bold italic*** text.\n");
        });

        it("should handle nested lists", () => {
            feedChunkSimple(state, "- Item 1\n  - Subitem 1\n  - Subitem 2\n- Item 2");
            const result = snapshotSimpleMarkdown(state);
            expect(result).toBe("- Item 1\n  - Subitem 1\n  - Subitem 2\n- Item 2\n");
        });
    });
});
