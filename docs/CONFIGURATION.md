# Poto Configuration System

The Poto framework supports user-configurable constants through a configuration system that allows you to override default values without modifying the framework code.

## Quick Start

1. Copy the example configuration file to your project root:
   ```bash
   cp poto.config.example.ts poto.config.ts
   ```

2. Customize the values in `poto.config.ts` as needed

3. The framework will automatically use your custom values

## Configuration Options

### Endpoints
Override API endpoint paths:

```typescript
endpoints: {
  loginUrlPath: 'custom-login',           // Default: 'poto-login'
  registerAsTourist: 'custom-register',   // Default: 'poto-registerAsVisitor'
  publish: 'custom-publish',              // Default: 'poto-sse-publish'
  subscribe: 'custom-subscribe',          // Default: 'poto-sse-subscribe'
}
```

### Headers
Override HTTP headers:

```typescript
headers: {
  Authorization: 'X-Custom-Auth',         // Default: 'Authorization'
  appJson: 'application/vnd.api+json',   // Default: 'application/json'
}
```

### Messages
Override error messages:

```typescript
messages: {
  NoUserId: 'Custom: User authentication required.',
  NotJson: 'Custom: Invalid JSON format.',
  BadRoute: 'Custom: Route not found:',
}
```

### Route Prefix
Override the API route prefix:

```typescript
routePrefix: '/custom-api'  // Default: '/api'
```

## Environment Variables

You can also override configuration using environment variables:

```bash
# Endpoint overrides
export POTO_LOGIN_PATH="custom-login"
export POTO_REGISTER_PATH="custom-register"
export POTO_PUBLISH_PATH="custom-publish"
export POTO_SUBSCRIBE_PATH="custom-subscribe"

# Header overrides
export POTO_AUTH_HEADER="X-Custom-Auth"
export POTO_APP_JSON="application/vnd.api+json"

# Message overrides
export POTO_MSG_NO_USER_ID="Custom: User authentication required."
export POTO_MSG_NOT_JSON="Custom: Invalid JSON format."
export POTO_MSG_BAD_ROUTE="Custom: Route not found:"

# Route prefix override
export POTO_ROUTE_PREFIX="/custom-api"
```

## Configuration Priority

The configuration system follows this priority order (highest to lowest):

1. **Environment Variables** - Override everything
2. **poto.config.ts** - User configuration file
3. **Default Values** - Framework defaults

## Advanced Usage

### Dynamic Configuration

You can create dynamic configurations based on environment:

```typescript
// poto.config.ts
const config: PotoConfig = {
  endpoints: {
    loginUrlPath: process.env.NODE_ENV === 'production' 
      ? 'prod-login' 
      : 'dev-login',
  },
  routePrefix: process.env.NODE_ENV === 'production' 
    ? '/api/v1' 
    : '/dev-api',
};
```

### Conditional Configuration

```typescript
// poto.config.ts
const isDevelopment = process.env.NODE_ENV === 'development';

const config: PotoConfig = {
  messages: {
    NoUserId: isDevelopment 
      ? 'Dev: User authentication required.' 
      : 'Authentication required.',
  },
};
```

## TypeScript Support

The configuration system provides full TypeScript support:

- **IntelliSense** - Auto-completion for all configuration options
- **Type Safety** - Compile-time validation of configuration values
- **Error Detection** - IDE will catch configuration errors

## Usage Patterns

### Synchronous Usage (Default)
For most cases, the synchronous constants work fine:

```typescript
import { PotoConstants } from 'poto';

// Uses default values immediately
const loginUrl = PotoConstants.loginUrlPath;
```

### Asynchronous Usage (User Config)
When you need to ensure user configuration is loaded:

```typescript
import { getPotoConstantsAsync } from 'poto';

// Loads user configuration from poto.config.ts
const constants = await getPotoConstantsAsync();
const loginUrl = constants.loginUrlPath;
```

### Migration from Direct Constants

The configuration system is backward compatible:

```typescript
// This still works exactly the same
import { PotoConstants } from 'poto';

// PotoConstants uses default values immediately
const loginUrl = PotoConstants.loginUrlPath;

// For user configuration, use the async version
const userConstants = await getPotoConstantsAsync();
const customLoginUrl = userConstants.loginUrlPath;
```

## Troubleshooting

### Configuration Not Loading

1. Ensure `poto.config.ts` is in your project root
2. Check that the file exports a default configuration object
3. Verify TypeScript compilation is working

### Hot Reloading

The configuration system supports hot reloading in development. Changes to `poto.config.ts` will be picked up automatically.

### Environment Variables Not Working

1. Ensure environment variables are set before starting your application
2. Check that variable names match the expected format (e.g., `POTO_LOGIN_PATH`)
3. Verify the application is reading from the correct environment

## Examples

See `poto.config.example.ts` for a complete example configuration file.

