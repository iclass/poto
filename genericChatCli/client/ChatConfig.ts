// Configuration for chat client colors and settings
export interface ChatConfig {
    colors: {
        aiResponse: 'brightCyan' | 'brightGreen' | 'brightYellow' | 'brightMagenta' | 'brightBlue' | 'brightRed' | 'cyan' | 'green' | 'yellow' | 'magenta' | 'blue' | 'red';
        userMessage: 'brightBlue' | 'brightGreen' | 'brightYellow' | 'brightMagenta' | 'brightCyan' | 'brightRed' | 'blue' | 'green' | 'yellow' | 'magenta' | 'cyan' | 'red';
        reasoning: 'gray' | 'white' | 'brightMagenta' | 'brightCyan' | 'brightBlue' | 'magenta' | 'cyan' | 'blue';
        success: 'brightGreen' | 'green';
        error: 'brightRed' | 'red';
        warning: 'brightYellow' | 'yellow';
        info: 'brightMagenta' | 'brightCyan' | 'brightBlue' | 'magenta' | 'cyan' | 'blue';
        system: 'gray' | 'white';
    };
    enableColors: boolean;
    enableMarkdown: boolean;
    maxHistoryLength: number;
}

export const defaultConfig: ChatConfig = {
    colors: {
        aiResponse: 'brightCyan',
        userMessage: 'brightBlue',
        reasoning: 'gray',
        success: 'brightGreen',
        error: 'brightRed',
        warning: 'brightYellow',
        info: 'brightMagenta',
        system: 'gray'
    },
    enableColors: true,
    enableMarkdown: true,
    maxHistoryLength: 20 // Reduced to prevent prompt overflow
};

// Global configuration instance
let globalConfig: ChatConfig = { ...defaultConfig };

export class ChatConfigManager {
    static getConfig(): ChatConfig {
        return { ...globalConfig };
    }

    static updateConfig(newConfig: Partial<ChatConfig>): void {
        globalConfig = { ...globalConfig, ...newConfig };
    }

    static setAiResponseColor(color: ChatConfig['colors']['aiResponse']): void {
        globalConfig.colors.aiResponse = color;
    }

    static setUserMessageColor(color: ChatConfig['colors']['userMessage']): void {
        globalConfig.colors.userMessage = color;
    }

    static setReasoningColor(color: ChatConfig['colors']['reasoning']): void {
        globalConfig.colors.reasoning = color;
    }

    static enableColors(enabled: boolean): void {
        globalConfig.enableColors = enabled;
    }

    static setMaxHistoryLength(length: number): void {
        globalConfig.maxHistoryLength = length;
    }

    static enableMarkdown(enabled: boolean): void {
        globalConfig.enableMarkdown = enabled;
    }
}
