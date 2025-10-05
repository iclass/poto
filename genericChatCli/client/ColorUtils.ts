// Color utilities for console output using ANSI escape codes
import { ChatConfigManager } from './ChatConfig';

export class ColorUtils {
    // ANSI color codes
    static colors = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        gray: '\x1b[90m',
        brightRed: '\x1b[91m',
        brightGreen: '\x1b[92m',
        brightYellow: '\x1b[93m',
        brightBlue: '\x1b[94m',
        brightMagenta: '\x1b[95m',
        brightCyan: '\x1b[96m',
        brightWhite: '\x1b[97m'
    };

    // Background colors
    private static backgrounds = {
        black: '\x1b[40m',
        red: '\x1b[41m',
        green: '\x1b[42m',
        yellow: '\x1b[43m',
        blue: '\x1b[44m',
        magenta: '\x1b[45m',
        cyan: '\x1b[46m',
        white: '\x1b[47m'
    };

    /**
     * Check if colors are supported in the current terminal
     */
    static isColorSupported(): boolean {
        const config = ChatConfigManager.getConfig();
        return config.enableColors && process.stdout.isTTY && !process.env.NO_COLOR;
    }

    /**
     * Apply color to text
     */
    static color(text: string, colorName: keyof typeof ColorUtils.colors): string {
        if (!ColorUtils.isColorSupported()) {
            return text;
        }
        return `${ColorUtils.colors[colorName]}${text}${ColorUtils.colors.reset}`;
    }

    /**
     * Apply background color to text
     */
    static bgColor(text: string, bgColorName: keyof typeof ColorUtils.backgrounds): string {
        if (!ColorUtils.isColorSupported()) {
            return text;
        }
        return `${ColorUtils.backgrounds[bgColorName]}${text}${ColorUtils.colors.reset}`;
    }

    /**
     * Apply both foreground and background colors
     */
    static colorWithBg(text: string, colorName: keyof typeof ColorUtils.colors, bgColorName: keyof typeof ColorUtils.backgrounds): string {
        if (!ColorUtils.isColorSupported()) {
            return text;
        }
        return `${ColorUtils.colors[colorName]}${ColorUtils.backgrounds[bgColorName]}${text}${ColorUtils.colors.reset}`;
    }

    /**
     * Make text bold
     */
    static bold(text: string): string {
        if (!ColorUtils.isColorSupported()) {
            return text;
        }
        return `${ColorUtils.colors.bright}${text}${ColorUtils.colors.reset}`;
    }

    /**
     * Make text dim
     */
    static dim(text: string): string {
        if (!ColorUtils.isColorSupported()) {
            return text;
        }
        return `${ColorUtils.colors.dim}${text}${ColorUtils.colors.reset}`;
    }

    // Convenience methods for common use cases
    static user(text: string): string {
        const config = ChatConfigManager.getConfig();
        return ColorUtils.color(text, config.colors.userMessage);
    }

    static ai(text: string): string {
        const config = ChatConfigManager.getConfig();
        return ColorUtils.color(text, config.colors.aiResponse);
    }

    static reasoning(text: string): string {
        const config = ChatConfigManager.getConfig();
        return ColorUtils.color(text, config.colors.reasoning);
    }

    static success(text: string): string {
        const config = ChatConfigManager.getConfig();
        return ColorUtils.color(text, config.colors.success);
    }

    static error(text: string): string {
        const config = ChatConfigManager.getConfig();
        return ColorUtils.color(text, config.colors.error);
    }

    static warning(text: string): string {
        const config = ChatConfigManager.getConfig();
        return ColorUtils.color(text, config.colors.warning);
    }

    static info(text: string): string {
        const config = ChatConfigManager.getConfig();
        return ColorUtils.color(text, config.colors.info);
    }

    static system(text: string): string {
        const config = ChatConfigManager.getConfig();
        return ColorUtils.color(text, config.colors.system);
    }

    /**
     * Create a colored prompt for the AI response
     */
    static aiPrompt(): string {
        return ColorUtils.color('🤖 AI: ', 'brightCyan');
    }

    /**
     * Create a colored prompt for the user
     */
    static userPrompt(): string {
        return ColorUtils.color('👤 You: ', 'brightBlue');
    }
}
