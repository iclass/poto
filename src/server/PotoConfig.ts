/**
 * Poto Configuration System
 * 
 * This module provides a configuration system that allows users to override
 * default PotoConstants through a poto.config.ts file in their project root.
 */

export interface PotoConfig {
	/** Override API endpoint paths */
	endpoints?: {
		loginUrlPath?: string;
		registerAsTourist?: string;
		publish?: string;
		subscribe?: string;
	};

	/** Override HTTP headers */
	headers?: {
		Authorization?: string;
		appJson?: string;
	};

	/** Override error messages */
	messages?: {
		NoUserId?: string;
		NotJson?: string;
		BadRoute?: string;
	};

	/** Override route prefix */
	routePrefix?: string;
}

/**
 * Default configuration values - single source of truth
 * These values are used by both PotoConstants and the configuration system
 */
export const DEFAULT_VALUES = {
	endpoints: {
		loginUrlPath: 'poto-login',
		registerAsTourist: 'poto-registerAsVisitor',
		publish: 'poto-sse-publish',
		subscribe: 'poto-sse-subscribe',
	},
	headers: {
		Authorization: 'Authorization',
		appJson: 'application/json',
	},
	messages: {
		NoUserId: 'Unauthorized. User id not found.',
		NotJson: 'argument not a valid JSON string',
		BadRoute: 'Not Found route:',
	},
	routePrefix: '/api-poto',
};

/**
 * Default configuration (single source of truth)
 */
const defaultConfig: PotoConfig = DEFAULT_VALUES;

import path from 'path';

/**
 * Loads user configuration from poto.config.ts if it exists
 */
async function loadUserConfig(): Promise<Partial<PotoConfig>> {
	try {
		const userConfigPath = path.resolve(process.cwd(), 'poto.config.ts');
		
		// Bun can directly import TypeScript files - no compilation needed
		const userConfig = await import(userConfigPath);
		const config = userConfig.default || userConfig;
		
		return config && typeof config === 'object' ? config : {};
		
	} catch (error) {
		// Bun's error messages are quite clear for module resolution
		if (error instanceof Error && error.message.includes('Cannot find module')) {
			return {}; // No config file - expected case
		}
		
		// Log unexpected errors but don't crash
		console.warn('Config loading issue:', error instanceof Error ? error.message : String(error));
		return {};
	}
}

/**
 * Merges user configuration with defaults
 */
function mergeConfig(userConfig: Partial<PotoConfig>): PotoConfig {
	return {
		endpoints: {
			...defaultConfig.endpoints,
			...userConfig.endpoints,
		},
		headers: {
			...defaultConfig.headers,
			...userConfig.headers,
		},
		messages: {
			...defaultConfig.messages,
			...userConfig.messages,
		},
		routePrefix: userConfig.routePrefix ?? defaultConfig.routePrefix,
	};
}

/**
 * Gets the merged configuration
 */
export async function getPotoConfig(): Promise<PotoConfig> {
	const userConfig = await loadUserConfig();
	return mergeConfig(userConfig);
}

/**
 * Creates a constants object from the configuration
 * This replaces the need to import PotoConstants directly
 */
export async function createPotoConstants(): Promise<{
	loginUrlPath: string;
	registerAsTourist: string;
	publish: string;
	subscribe: string;
	Authorization: string;
	appJson: string;
	msg: {
		NoUserId: string;
		NotJson: string;
		BadRoute: string;
	};
	routePrefix: string;
}> {
	const config = await getPotoConfig();
	
	return {
		loginUrlPath: config.endpoints!.loginUrlPath!,
		registerAsTourist: config.endpoints!.registerAsTourist!,
		publish: config.endpoints!.publish!,
		subscribe: config.endpoints!.subscribe!,
		Authorization: config.headers!.Authorization!,
		appJson: config.headers!.appJson!,
		msg: {
			NoUserId: config.messages!.NoUserId!,
			NotJson: config.messages!.NotJson!,
			BadRoute: config.messages!.BadRoute!,
		},
		routePrefix: config.routePrefix!,
	};
}

/**
 * Environment-aware configuration loader
 * Supports environment variables as overrides
 */
export async function getPotoConfigWithEnv(): Promise<PotoConfig> {
	const config = await getPotoConfig();
	
	// Override with environment variables if present
	return {
		endpoints: {
			...config.endpoints,
			loginUrlPath: process.env.POTO_LOGIN_PATH || config.endpoints!.loginUrlPath,
			registerAsTourist: process.env.POTO_REGISTER_PATH || config.endpoints!.registerAsTourist,
			publish: process.env.POTO_PUBLISH_PATH || config.endpoints!.publish,
			subscribe: process.env.POTO_SUBSCRIBE_PATH || config.endpoints!.subscribe,
		},
		headers: {
			...config.headers,
			Authorization: process.env.POTO_AUTH_HEADER || config.headers!.Authorization,
			appJson: process.env.POTO_APP_JSON || config.headers!.appJson,
		},
		messages: {
			...config.messages,
			NoUserId: process.env.POTO_MSG_NO_USER_ID || config.messages!.NoUserId,
			NotJson: process.env.POTO_MSG_NOT_JSON || config.messages!.NotJson,
			BadRoute: process.env.POTO_MSG_BAD_ROUTE || config.messages!.BadRoute,
		},
		routePrefix: process.env.POTO_ROUTE_PREFIX || config.routePrefix,
	};
}
