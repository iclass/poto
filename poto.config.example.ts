/**
 * Example Poto Configuration
 * 
 * Copy this file to your project root as 'poto.config.ts' and customize as needed.
 * This file allows you to override default PotoConstants without modifying the framework.
 */

import { PotoConfig } from './src/shared/PotoConfig';

const config: PotoConfig = {
	// Override API endpoint paths
	endpoints: {
		loginUrlPath: 'custom-login',
		registerAsTourist: 'custom-register',
		publish: 'custom-publish',
		subscribe: 'custom-subscribe',
	},

	// Override HTTP headers
	headers: {
		Authorization: 'X-Custom-Auth',
		appJson: 'application/vnd.api+json',
	},

	// Override error messages
	messages: {
		NoUserId: 'Custom: User authentication required.',
		NotJson: 'Custom: Invalid JSON format.',
		BadRoute: 'Custom: Route not found:',
	},

	// Override route prefix
	routePrefix: '/custom-api',
};

export default config;

