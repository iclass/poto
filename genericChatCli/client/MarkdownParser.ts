// Enhanced markdown parser for console output using marked-terminal
import { ColorUtils } from './ColorUtils';
import { ChatConfigManager } from './ChatConfig';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';

export class MarkdownParser {
    private static markedInstance: any = null;
    
    /**
     * Initialize marked with marked-terminal renderer
     */
    private static initializeMarked(): void {
        if (this.markedInstance) return;
        
        try {
        
        const config = ChatConfigManager.getConfig();
        
        // Configure marked-terminal with custom styling
        const terminalOptions = {
            // Colors that match our existing ColorUtils
            code: chalk.yellow,
            blockquote: chalk.gray.italic,
            html: chalk.gray,
            heading: chalk.green.bold,
            firstHeading: chalk.magenta.underline.bold,
            hr: chalk.reset,
            listitem: chalk.reset,
            table: chalk.reset,
            paragraph: chalk.reset,
            strong: chalk.bold,
            em: chalk.italic,
            codespan: chalk.yellow,
            del: chalk.dim.gray.strikethrough,
            link: chalk.blue,
            href: chalk.blue.underline,
            
            // Terminal width and formatting
            width: 80,
            reflowText: true,
            showSectionPrefix: true,
            unescape: true,
            emoji: true,
            tab: 2
        };
        
        // Configure syntax highlighting
        const highlightOptions = {
            theme: 'github'
        };
        
        // Set up marked with marked-terminal
        marked.use(markedTerminal(terminalOptions, highlightOptions));
        this.markedInstance = marked;
        
        } catch (error) {
            console.warn('Failed to initialize marked-terminal, using fallback:', error);
            // Create a fallback marked instance
            this.markedInstance = {
                parse: (text: string) => this.simpleParse(text)
            };
        }
    }
    
    /**
     * Parse markdown text and apply console formatting using marked-terminal
     * Supports full markdown including headers, lists, code blocks, tables, etc.
     */
    static parse(text: string): string {
        if (!text) return text;
        
        const config = ChatConfigManager.getConfig();
        if (!config.enableMarkdown) return text;
        
        try {
            // First, preprocess the text to handle inline markdown in list items
            const preprocessedText = this.preprocessInlineMarkdown(text);
            
            // Use the already configured marked instance
            const result = this.markedInstance.parse(preprocessedText);
            return result;
        } catch (error) {
            // Fallback to simple parsing if marked fails
            console.warn('Markdown parsing failed, falling back to simple parsing:', error);
            return this.simpleParse(text);
        }
    }
    
    /**
     * Preprocess text to handle inline markdown in list items
     */
    private static preprocessInlineMarkdown(text: string): string {
        // Handle bold and italic in list items
        // Process bold first, then italic to avoid conflicts
        return text
            .replace(/\*\*(.*?)\*\*/g, (match, content) => {
                return chalk.red(content);
            })
            .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, (match, content) => {
                return chalk.blue(content);
            });
    }
    
    /**
     * Simple fallback parser for basic markdown
     */
    private static simpleParse(text: string): string {
        return text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
            return ColorUtils.bold(content);
        });
    }

    /**
     * Parse markdown text that should be colored with AI color first
     * Uses enhanced markdown parsing with AI color overlay
     */
    static parseWithAiColor(text: string): string {
        if (!text) return text;
        
        const config = ChatConfigManager.getConfig();
        if (!config.enableMarkdown) return ColorUtils.ai(text);
        
        this.initializeMarked();
        
        try {
            // First, preprocess the text to handle inline markdown in list items
            const preprocessedText = this.preprocessInlineMarkdown(text);
            
            // Parse with marked-terminal first
            const parsed = this.markedInstance.parse(preprocessedText);
            
            // Return the parsed result directly - marked-terminal handles the formatting
            return parsed;
        } catch (error) {
            // Fallback to simple parsing with AI color
            console.warn('Markdown parsing failed, falling back to simple parsing:', error);
            return this.simpleParseWithAiColor(text);
        }
    }
    
    /**
     * Simple fallback parser for basic markdown with AI color
     */
    private static simpleParseWithAiColor(text: string): string {
        const config = ChatConfigManager.getConfig();
        
        // Split text into parts: regular text and **bold** text
        const parts = text.split(/(\*\*.*?\*\*)/);
        
        return parts.map(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
                // This is bold text, remove ** and apply bold + AI color
                const content = part.slice(2, -2);
                const aiColorCode = ColorUtils.colors[config.colors.aiResponse];
                const boldColorCode = ColorUtils.colors.bright;
                const resetCode = ColorUtils.colors.reset;
                return `${aiColorCode}${boldColorCode}${content}${resetCode}`;
            } else {
                // This is regular text, just apply AI color
                return ColorUtils.ai(part);
            }
        }).join('');
    }

    /**
     * Parse text for streaming output (handles partial markdown)
     * Enhanced to work with full markdown syntax
     */
    static parseStreaming(text: string, previousBuffer: string = ''): { 
        formattedText: string; 
        remainingBuffer: string;
        hasIncompleteMarkdown: boolean;
    } {
        const config = ChatConfigManager.getConfig();
        if (!config.enableMarkdown) {
            return { formattedText: text, remainingBuffer: previousBuffer, hasIncompleteMarkdown: false };
        }
        
        if (!text && !previousBuffer) {
            return { formattedText: '', remainingBuffer: '', hasIncompleteMarkdown: false };
        }

        // Combine previous buffer with new text
        const fullText = previousBuffer + text;
        
        // Check for incomplete markdown patterns
        // Look for incomplete code blocks, bold text, etc.
        const incompletePatterns = [
            /\*\*[^*]*$/,           // Incomplete bold
            /\*[^*]*$/,             // Incomplete italic
            /```[^`]*$/,            // Incomplete code block
            /`[^`]*$/,              // Incomplete inline code
            /^#{1,6}\s*$/,          // Incomplete header
            /^\s*[-*+]\s*$/,        // Incomplete list item
            /^\s*\d+\.\s*$/         // Incomplete numbered list
        ];
        
        const hasIncompleteMarkdown = incompletePatterns.some(pattern => pattern.test(fullText));
        
        if (hasIncompleteMarkdown) {
            // We have incomplete markdown, don't format yet
            // Find the last complete markdown boundary
            let lastCompleteIndex = fullText.length;
            
            // Look for the last complete markdown element
            for (let i = fullText.length - 1; i >= 0; i--) {
                const char = fullText[i];
                if (char === '\n' || char === ' ') {
                    lastCompleteIndex = i;
                    break;
                }
            }
            
            const beforeIncomplete = fullText.substring(0, lastCompleteIndex);
            const incompletePart = fullText.substring(lastCompleteIndex);
            
            const formattedBefore = beforeIncomplete ? this.parse(beforeIncomplete) : '';
            
            return {
                formattedText: formattedBefore + incompletePart,
                remainingBuffer: incompletePart,
                hasIncompleteMarkdown: true
            };
        }
        
        // Complete markdown, format it
        const formattedText = this.parse(fullText);
        
        return {
            formattedText,
            remainingBuffer: '',
            hasIncompleteMarkdown: false
        };
    }

    /**
     * Parse text for streaming output with AI color (handles partial markdown)
     * Enhanced to work with full markdown syntax and better streaming handling
     * Returns only the new text that should be output to console
     */
    static parseStreamingWithAiColor(newText: string, previousBuffer: string = '', alreadyDisplayed: string = ''): { 
        outputText: string; 
        remainingBuffer: string;
        totalProcessed: string;
        hasIncompleteMarkdown: boolean;
    } {
        const config = ChatConfigManager.getConfig();
        if (!config.enableMarkdown) {
            return { 
                outputText: ColorUtils.ai(newText), 
                remainingBuffer: '', 
                totalProcessed: alreadyDisplayed + newText,
                hasIncompleteMarkdown: false 
            };
        }
        
        if (!newText && !previousBuffer) {
            return { outputText: '', remainingBuffer: '', totalProcessed: alreadyDisplayed, hasIncompleteMarkdown: false };
        }

        // Combine previous buffer with new text
        const fullText = previousBuffer + newText;
        
        // Enhanced incomplete markdown detection - only detect truly incomplete patterns
        const incompletePatterns = [
            /\*\*[^*]*$/,           // Incomplete bold (no closing **)
            /\*[^*]*$/,             // Incomplete italic (no closing *)
            /```[^`]*$/,            // Incomplete code block (no closing ```)
            /`[^`]*$/,              // Incomplete inline code (no closing `)
            /^#{1,6}\s*$/,          // Incomplete header (just # with no content)
            /^\s*[-*+]\s*$/,        // Incomplete list item (just bullet with no content)
            /^\s*\d+\.\s*$/,        // Incomplete numbered list (just number with no content)
            /\|\s*$/,               // Incomplete table row (just | with no content)
            /^\s*>\s*$/,            // Incomplete blockquote (just > with no content)
            /^---+$/,               // Incomplete horizontal rule (just ---)
            /^\s*\|.*\|.*$/,        // Incomplete table (table without proper structure)
        ];
        
        const hasIncompleteMarkdown = incompletePatterns.some(pattern => pattern.test(fullText));
        
        if (hasIncompleteMarkdown) {
            // We have incomplete markdown, store in buffer and don't output yet
            return {
                outputText: '',
                remainingBuffer: fullText,
                totalProcessed: alreadyDisplayed,
                hasIncompleteMarkdown: true
            };
        }
        
        // Check if we have complete markdown patterns that can be parsed
        const hasCompleteMarkdown = this.hasMarkdown(fullText);
        
        if (hasCompleteMarkdown) {
            // We have complete markdown, format it
            const completeText = this.parseWithAiColor(fullText);
            return {
                outputText: completeText,
                remainingBuffer: '',
                totalProcessed: alreadyDisplayed + fullText,
                hasIncompleteMarkdown: false
            };
        } else {
            // No markdown patterns, just output with AI color
            return {
                outputText: ColorUtils.ai(newText),
                remainingBuffer: '',
                totalProcessed: alreadyDisplayed + newText,
                hasIncompleteMarkdown: false
            };
        }
    }

    /**
     * Check if text contains any markdown patterns
     * Enhanced to detect various markdown syntax
     */
    static hasMarkdown(text: string): boolean {
        const markdownPatterns = [
            /\*\*.*?\*\*/,           // Bold
            /\*.*?\*/,               // Italic
            /`.*?`/,                 // Inline code
            /```[\s\S]*?```/,        // Code blocks
            /^#{1,6}\s+.*$/m,        // Headers
            /^\s*[-*+]\s+.*$/m,     // Unordered lists
            /^\s*\d+\.\s+.*$/m,      // Ordered lists
            /\[.*?\]\(.*?\)/,        // Links
            /!\[.*?\]\(.*?\)/,       // Images
            /^>\s+.*$/m,             // Blockquotes
            /^---+$/m,               // Horizontal rules
            /^\|.*\|.*$/m            // Tables
        ];
        
        return markdownPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Get the length of text without markdown formatting
     * Enhanced to handle various markdown patterns
     */
    static getPlainTextLength(text: string): number {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1')           // Bold
            .replace(/\*(.*?)\*/g, '$1')               // Italic
            .replace(/`(.*?)`/g, '$1')                 // Inline code
            .replace(/```[\s\S]*?```/g, '')            // Code blocks
            .replace(/^#{1,6}\s+/gm, '')               // Headers
            .replace(/^\s*[-*+]\s+/gm, '')             // Unordered lists
            .replace(/^\s*\d+\.\s+/gm, '')             // Ordered lists
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')        // Links
            .replace(/!\[.*?\]\(.*?\)/g, '')           // Images
            .replace(/^>\s+/gm, '')                    // Blockquotes
            .replace(/^---+$/gm, '')                   // Horizontal rules
            .replace(/^\|.*\|.*$/gm, '')               // Tables
            .length;
    }

    /**
     * Finalize any remaining incomplete markdown in the buffer
     * Enhanced to handle various incomplete markdown patterns
     */
    static finalizeBuffer(buffer: string): string {
        if (!buffer) return '';
        
        // Check for incomplete markdown patterns
        const incompletePatterns = [
            /\*\*[^*]*$/,           // Incomplete bold
            /\*[^*]*$/,             // Incomplete italic
            /```[^`]*$/,            // Incomplete code block
            /`[^`]*$/,              // Incomplete inline code
            /^#{1,6}\s*$/,          // Incomplete header
            /^\s*[-*+]\s*$/,        // Incomplete list item
            /^\s*\d+\.\s*$/         // Incomplete numbered list
        ];
        
        const hasIncompleteMarkdown = incompletePatterns.some(pattern => pattern.test(buffer));
        
        if (hasIncompleteMarkdown) {
            // Return as-is if we have incomplete markdown
            return buffer;
        }
        
        // Otherwise, try to parse what we have
        return this.parse(buffer);
    }

    /**
     * Finalize any remaining incomplete markdown in the buffer with AI color
     * Enhanced to handle various incomplete markdown patterns
     */
    static finalizeBufferWithAiColor(buffer: string): string {
        if (!buffer) return '';
        
        // Check for incomplete markdown patterns
        const incompletePatterns = [
            /\*\*[^*]*$/,           // Incomplete bold
            /\*[^*]*$/,             // Incomplete italic
            /```[^`]*$/,            // Incomplete code block
            /`[^`]*$/,              // Incomplete inline code
            /^#{1,6}\s*$/,          // Incomplete header
            /^\s*[-*+]\s*$/,        // Incomplete list item
            /^\s*\d+\.\s*$/         // Incomplete numbered list
        ];
        
        const hasIncompleteMarkdown = incompletePatterns.some(pattern => pattern.test(buffer));
        
        if (hasIncompleteMarkdown) {
            // Return as-is with AI color if we have incomplete markdown
            return ColorUtils.ai(buffer);
        }
        
        // Otherwise, try to parse what we have with AI color
        return this.parseWithAiColor(buffer);
    }
}
