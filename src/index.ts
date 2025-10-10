// Main entry point for Poto Framework
// This allows clean imports like: import { PotoServer, PotoClient, PotoModule } from 'poto'

// Server exports
export { PotoServer } from './server/PotoServer.js';
export { PotoModule } from './server/PotoModule.js';
export { LLMPotoModule } from './llms/LLMPotoModule.js';

// Client exports
export { PotoClient } from './web/rpc/PotoClient.js';

// LLM exports
export { LLM } from './llms/llm.js';
// Shared types and utilities - only export runtime values
export { DialogRoles} from './shared/CommonTypes.js';
export { PotoUser } from './server/UserProvider.js';

// Session management - export classes only (interfaces are compile-time only)
export { InMemorySessionProvider, RedisSessionProvider } from './server/UserSessionProvider.js';

// Request context
export { PotoRequestContext } from './server/PotoRequestContext.js';

// Common utilities - only export runtime values
export { JsonSchemaFormat } from './shared/JsonSchemaFormat.js';
export { TypedJSON } from './shared/TypedJSON.js';

export { PotoConstants } from './shared/PotoConstants.js';
export { BunCookieSessionProvider } from './server/BunCookieSessionProvider.js';

// Type-only exports for TypeScript consumers
export type { UserSessionProvider, UserSessionData } from './server/UserSessionProvider';
export type { UserProvider } from './server/UserProvider';
export type { DialogEntry, DialogRole, OpenAIContentBlock } from './shared/CommonTypes';
export type { JSONSchema } from './shared/JSONSchema';
export type { LLMSessionData } from './llms/LLMPotoModule';
export type { MessagingClient } from './shared/MessageClient';

export { roles } from './server/serverDecorators.js';

export *  from './shared/MessageClient.js';
export *  from './web/rpc/PotoClientWithProxy.js';
export *  from './llms/LLMConfig.js';
export *  from './web/rpc/RpcClient.js';