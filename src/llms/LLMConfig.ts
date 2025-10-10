import { getAppEnv } from '../server/AppEnv';

export interface LLMConfigOptions {
  name: string;
  model: string;
  apiKey: string;
  endPoint: string;
}

export class LLMConfig {
  private static configs: Map<string, LLMConfigOptions> = new Map();
  private static defaultConfigName: string | null = null;
  private static isInitialized: boolean = false;

  /**
   * Explicitly load configurations from environment variables
   * This method must be called before using any other LLMConfig methods
   */
  static loadConfigs(): void {
    if (LLMConfig.isInitialized) {
      return; // Already loaded
    }
    
    LLMConfig.scanAndLoadConfigs();
    LLMConfig.isInitialized = true;
  }

  /**
   * Check if configurations have been loaded
   */
  static isLoaded(): boolean {
    return LLMConfig.isInitialized;
  }

  /**
   * Ensure configurations are loaded, throw error if not
   */
  private static ensureInitialized(): void {
    if (!LLMConfig.isInitialized) {
      throw new Error('LLMConfig not initialized. Call LLMConfig.loadConfigs() first.');
    }
  }

  /**
   * Scan for llm<n> configuration groups and load them
   */
  private static scanAndLoadConfigs(): void {
    const maxConfigs = 20; // Scan up to llm20
    
    for (let i = 1; i <= maxConfigs; i++) {
      const configName = `llm${i}`;
      const name = getAppEnv(`${configName}.name`);
      const model = getAppEnv(`${configName}.model`);
      const apiKey = getAppEnv(`${configName}.api_key`);
      const endPoint = getAppEnv(`${configName}.endpoint`);

      // Only add config if it has at least a model specified
      if (model) {
        const config: LLMConfigOptions = {
          name: name || configName,
          model: model,
          apiKey: apiKey || '',
          endPoint: endPoint || '',
        };

        LLMConfig.configs.set(configName, config);

        // Set llm1 as default if it exists and is valid, otherwise use first valid config
        if (configName === 'llm1' && LLMConfig.isValidConfig(config)) {
          LLMConfig.defaultConfigName = configName;
        } else if (!LLMConfig.defaultConfigName && LLMConfig.isValidConfig(config)) {
          LLMConfig.defaultConfigName = configName;
        }
      }
    }

    // Ensure llm1 is configured (skip in CI environment)
    if (!LLMConfig.defaultConfigName && !process.env.CI) {
      throw new Error('llm1 configuration is required. Please configure llm1.name, llm1.model, llm1.api_key, and llm1.endpoint in your .env file');
    }
  }

  /**
   * Get a specific LLM configuration by name
   */
  static getConfig(configName: string): LLMConfigOptions | undefined {
    LLMConfig.ensureInitialized();
    return LLMConfig.configs.get(configName);
  }

  /**
   * Get all available configurations
   */
  static getAllConfigs(): Map<string, LLMConfigOptions> {
    LLMConfig.ensureInitialized();
    return new Map(LLMConfig.configs);
  }

  /**
   * Get list of available configuration names
   */
  static getAvailableConfigs(): string[] {
    LLMConfig.ensureInitialized();
    return Array.from(LLMConfig.configs.keys());
  }

  /**
   * Add a custom configuration
   */
  static addConfig(name: string, config: LLMConfigOptions): void {
    LLMConfig.ensureInitialized();
    LLMConfig.configs.set(name, config);
  }

  /**
   * Remove a configuration
   */
  static removeConfig(name: string): boolean {
    LLMConfig.ensureInitialized();
    return LLMConfig.configs.delete(name);
  }

  /**
   * Get the default configuration (llm1)
   */
  static getDefaultConfig(): LLMConfigOptions {
    LLMConfig.ensureInitialized();
    if (LLMConfig.defaultConfigName) {
      return LLMConfig.configs.get(LLMConfig.defaultConfigName)!;
    }
    
    // In CI environment, return a mock configuration to avoid errors
    if (process.env.CI) {
      return {
        name: 'mock-llm',
        model: 'mock-model',
        apiKey: 'mock-key',
        endPoint: 'mock-endpoint'
      };
    }
    
    throw new Error('llm1 configuration is required but not found');
  }

  /**
   * Get the name of the default configuration (llm1)
   */
  static getDefaultConfigName(): string {
    LLMConfig.ensureInitialized();
    if (!LLMConfig.defaultConfigName) {
      // In CI environment, return a mock configuration name
      if (process.env.CI) {
        return 'mock-llm';
      }
      throw new Error('llm1 configuration is required but not found');
    }
    return LLMConfig.defaultConfigName;
  }

  /**
   * Check if a configuration is valid (has required fields)
   */
  static isValidConfig(config: LLMConfigOptions): boolean {
    return !!(config.model && config.apiKey && config.endPoint);
  }

  /**
   * Get configurations that are currently valid (have API keys set)
   */
  static getValidConfigs(): Map<string, LLMConfigOptions> {
    LLMConfig.ensureInitialized();
    const validConfigs = new Map<string, LLMConfigOptions>();
    for (const [name, config] of LLMConfig.configs) {
      if (LLMConfig.isValidConfig(config)) {
        validConfigs.set(name, config);
      }
    }
    return validConfigs;
  }
} 