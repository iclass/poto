// Simple markdown parser for console output
import { ColorUtils } from './ColorUtils';
import { ChatConfigManager } from './ChatConfig';

export class MarkdownParser {
    /**
     * Parse markdown text and apply console formatting
     * Currently supports:
     * - **bold** (double asterisks) -> bright/bold text
     */
    static parse(text: string): string {
        if (!text) return text;
        
        const config = ChatConfigManager.getConfig();
        if (!config.enableMarkdown) return text;
        
        // Parse **bold** text
        return text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
            return ColorUtils.bold(content);
        });
    }

    /**
     * Parse markdown text that should be colored with AI color first
     */
    static parseWithAiColor(text: string): string {
        if (!text) return text;
        
        const config = ChatConfigManager.getConfig();
        if (!config.enableMarkdown) return ColorUtils.ai(text);
        
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
     * This is more complex as we need to handle incomplete markdown tags
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
        
        // Check for incomplete markdown at the end
        const incompleteMatch = fullText.match(/\*\*[^*]*$/);
        const hasIncompleteMarkdown = !!incompleteMatch;
        
        if (hasIncompleteMarkdown) {
            // We have incomplete markdown, don't format yet
            // But we can format the part before the incomplete markdown
            const beforeIncomplete = fullText.substring(0, fullText.lastIndexOf('**'));
            const incompletePart = fullText.substring(fullText.lastIndexOf('**'));
            
            const formattedBefore = this.parse(beforeIncomplete);
            
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
        
        // Check for incomplete markdown at the end
        const incompleteMatch = fullText.match(/\*\*[^*]*$/);
        const hasIncompleteMarkdown = !!incompleteMatch;
        
        if (hasIncompleteMarkdown) {
            // We have incomplete markdown, store in buffer and don't output yet
            return {
                outputText: '',
                remainingBuffer: fullText,
                totalProcessed: alreadyDisplayed,
                hasIncompleteMarkdown: true
            };
        }
        
        // Complete markdown found, format the entire buffer + new text
        const completeText = this.parseWithAiColor(fullText);
        
        return {
            outputText: completeText,
            remainingBuffer: '',
            totalProcessed: alreadyDisplayed + fullText,
            hasIncompleteMarkdown: false
        };
    }

    /**
     * Check if text contains any markdown patterns
     */
    static hasMarkdown(text: string): boolean {
        return /\*\*.*?\*\*/.test(text);
    }

    /**
     * Get the length of text without markdown formatting
     */
    static getPlainTextLength(text: string): number {
        return text.replace(/\*\*(.*?)\*\*/g, '$1').length;
    }

    /**
     * Finalize any remaining incomplete markdown in the buffer
     */
    static finalizeBuffer(buffer: string): string {
        if (!buffer) return '';
        
        // If we have an incomplete ** at the end, just return as-is
        if (buffer.endsWith('**')) {
            return buffer;
        }
        
        // Otherwise, try to parse what we have
        return this.parse(buffer);
    }

    /**
     * Finalize any remaining incomplete markdown in the buffer with AI color
     */
    static finalizeBufferWithAiColor(buffer: string): string {
        if (!buffer) return '';
        
        // If we have an incomplete ** at the end, just return as-is with AI color
        if (buffer.endsWith('**')) {
            return ColorUtils.ai(buffer);
        }
        
        // Otherwise, try to parse what we have with AI color
        return this.parseWithAiColor(buffer);
    }
}
