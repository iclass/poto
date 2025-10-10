// import { createPotoConstants, DEFAULT_VALUES } from './PotoConfig';

/**
 * Default configuration values - duplicated here to avoid server-side dependencies
 */
const DEFAULT_VALUES = {
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
		NotJson: 'Request body is not valid JSON.',
		BadRoute: 'Bad route.',
	},
	routePrefix: '/poto',
};

/**
 * Default constants (derived from shared DEFAULT_VALUES to avoid duplication)
 */
const defaultConstants = {
	loginUrlPath: DEFAULT_VALUES.endpoints.loginUrlPath,
	registerAsTourist: DEFAULT_VALUES.endpoints.registerAsTourist,
	publish: DEFAULT_VALUES.endpoints.publish,
	subscribe: DEFAULT_VALUES.endpoints.subscribe,
	Authorization: DEFAULT_VALUES.headers.Authorization,
	appJson: DEFAULT_VALUES.headers.appJson,
	msg: {
		NoUserId: DEFAULT_VALUES.messages.NoUserId,
		NotJson: DEFAULT_VALUES.messages.NotJson,
		BadRoute: DEFAULT_VALUES.messages.BadRoute,
	},
	routePrefix: DEFAULT_VALUES.routePrefix,
};

/**
 * PotoConstants - Framework constants with user override support
 * 
 * These constants can be overridden by creating a poto.config.ts file
 * in your project root. See poto.config.example.ts for reference.
 * 
 * For async configuration loading, use getPotoConstantsAsync() instead.
 */
export const PotoConstants = defaultConstants;

/**
 * Async version that loads user configuration
 * Use this when you need the latest user configuration
 * Browser version just returns the default constants
 */
export async function getPotoConstantsAsync() {
	return PotoConstants;
}



