import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables once at startup
config({ path: resolve(process.cwd(), '.env') });

/**
 * Get an environment variable with optional default value
 * @param key - The environment variable key
 * @param defaultValue - Optional default value if the key is not found
 * @returns The environment variable value or default
 */
export function getAppEnv(key: string, defaultValue?: string): string | undefined {
    return process.env[key] ?? defaultValue;
}

/**
 * Get a required environment variable, throwing an error if not found
 * @param key - The environment variable key
 * @returns The environment variable value
 * @throws Error if the environment variable is not set
 */
export function getRequiredAppEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}

/**
 * Get a boolean environment variable
 * @param key - The environment variable key
 * @param defaultValue - Default value if not set
 * @returns Boolean value
 */
export function getBooleanAppEnv(key: string, defaultValue: boolean = false): boolean {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get a number environment variable
 * @param key - The environment variable key
 * @param defaultValue - Default value if not set or invalid
 * @returns Number value
 */
export function getNumberAppEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
