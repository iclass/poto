// Browser-only entry point for Poto Framework
// This excludes server-side code that uses Node.js/Bun built-ins

// Client exports (browser-safe)
export { PotoClient } from '../web/rpc/PotoClient.js';
export { PotoClientWithProxy } from '../web/rpc/PotoClientWithProxy.js';
export { newRpcClient } from '../web/rpc/RpcClient.js';
export { IframeRpcClient } from '../web/rpc/IframeRpcClient.js';
export { WebRpcBridge } from '../web/rpc/WebRpcBridge.js';

// Shared types and utilities (browser-safe)
export { DialogRoles } from '../shared/CommonTypes.js';
export { JsonSchemaFormat } from '../shared/JsonSchemaFormat.js';
export { TypedJSON } from '../shared/TypedJSON.js';
export { PotoConstants } from '../shared/PotoConstants.js';

// Message client and related utilities
export * from '../shared/MessageClient.js';

// LLM config (browser-safe)
export * from '../llms/LLMConfig.js';

// Type-only exports for TypeScript consumers
export type { DialogEntry, DialogRole, OpenAIContentBlock } from '../shared/CommonTypes';
export type { JSONSchema } from '../shared/JSONSchema';
export type { MessagingClient } from '../shared/MessageClient';

// Note: Server-side exports like PotoServer, PotoModule, etc. are intentionally excluded
// from this browser build to prevent Node.js/Bun built-in import errors
