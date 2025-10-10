#!/usr/bin/env node

import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

console.log('🔨 Building browser-specific package...');

// Function to fix import paths in copied files
function fixImportPaths(filePath) {
  if (!existsSync(filePath)) return;
  
  let content = readFileSync(filePath, 'utf8');
  
  // Fix relative imports that go outside the browser directory
  content = content.replace(/from (['"])\.\.\/\.\.\/shared\//g, "from $1../../shared/");
  content = content.replace(/from (['"])\.\.\/\.\.\/web\//g, "from $1../../web/");
  content = content.replace(/from (['"])\.\.\/\.\.\/llms\//g, "from $1../../llms/");
  
  // Fix imports that reference the parent directory
  content = content.replace(/from (['"])\.\.\/shared\//g, "from $1../shared/");
  content = content.replace(/from (['"])\.\.\/web\//g, "from $1../web/");
  content = content.replace(/from (['"])\.\.\/llms\//g, "from $1../llms/");
  
  // Add .js extensions to relative imports (but be more careful with the regex)
  content = content.replace(/from ['"]\.\.\/\.\.\/([^'"]+)['"]/g, (match, path) => {
    if (path.endsWith('.js') || path.endsWith('.d.ts')) {
      return match; // Don't modify if already has extension
    }
    return `from '../../${path}.js'`;
  });
  
  content = content.replace(/from ['"]\.\.\/([^'"]+)['"]/g, (match, path) => {
    if (path.endsWith('.js') || path.endsWith('.d.ts')) {
      return match; // Don't modify if already has extension
    }
    return `from '../${path}.js'`;
  });
  
  content = content.replace(/from ['"]\.\/([^'"]+)['"]/g, (match, path) => {
    if (path.endsWith('.js') || path.endsWith('.d.ts')) {
      return match; // Don't modify if already has extension
    }
    return `from './${path}.js'`;
  });
  
  writeFileSync(filePath, content);
}

// First, build the TypeScript files
console.log('📦 Compiling TypeScript...');
execSync('bun run tsc:browser', { stdio: 'inherit' });

// Copy necessary files to make browser build self-contained
const browserDist = './dist/browser';
const serverDist = './dist';

// Files that need to be copied from server dist to browser dist
const filesToCopy = [
  'web/rpc/PotoClient.js',
  'web/rpc/PotoClient.d.ts',
  'web/rpc/PotoClientWithProxy.js',
  'web/rpc/PotoClientWithProxy.d.ts',
  'web/rpc/RpcClient.js',
  'web/rpc/RpcClient.d.ts',
  'web/rpc/IframeRpcClient.js',
  'web/rpc/IframeRpcClient.d.ts',
  'web/rpc/WebRpcBridge.js',
  'web/rpc/WebRpcBridge.d.ts',
  'shared/CommonTypes.js',
  'shared/CommonTypes.d.ts',
  'shared/JsonSchemaFormat.js',
  'shared/JsonSchemaFormat.d.ts',
  'shared/TypedJSON.js',
  'shared/TypedJSON.d.ts',
  'shared/PotoConstants.js',
  'shared/PotoConstants.d.ts',
  'shared/MessageClient.js',
  'shared/MessageClient.d.ts',
  'shared/JSONSchema.js',
  'shared/JSONSchema.d.ts',
  'shared/TypedJsonUtils.js',
  'shared/TypedJsonUtils.d.ts',
  'shared/fetch-eventsource/fetch.js',
  'shared/fetch-eventsource/fetch.d.ts',
  'shared/fetch-eventsource/parse.js',
  'shared/fetch-eventsource/parse.d.ts',
  'shared/fetch-eventsource/index.js',
  'shared/fetch-eventsource/index.d.ts',
  'llms/LLMConfig.js',
  'llms/LLMConfig.d.ts'
];

console.log('📋 Copying files to browser build...');
for (const file of filesToCopy) {
  const srcPath = join(serverDist, file);
  const destPath = join(browserDist, file);
  
  if (existsSync(srcPath)) {
    // Ensure destination directory exists
    mkdirSync(dirname(destPath), { recursive: true });
    
    // Copy the file
    copyFileSync(srcPath, destPath);
    
    // Fix import paths in the copied file
    fixImportPaths(destPath);
    
    console.log(`  ✅ Copied and fixed ${file}`);
  } else {
    console.log(`  ⚠️  File not found: ${file}`);
  }
}

// Update the browser index.js to use relative paths within the browser directory
console.log('🔧 Updating browser index.js...');
const browserIndexPath = join(browserDist, 'index.js');
let browserIndexContent = `// Browser-only entry point for Poto Framework
// This excludes server-side code that uses Node.js/Bun built-ins

// Client exports (browser-safe)
export { PotoClient } from './web/rpc/PotoClient.js';
export { PotoClientWithProxy } from './web/rpc/PotoClientWithProxy.js';
export { newRpcClient } from './web/rpc/RpcClient.js';
export { IframeRpcClient } from './web/rpc/IframeRpcClient.js';
export { WebRpcBridge } from './web/rpc/WebRpcBridge.js';

// Shared types and utilities (browser-safe)
export { DialogRoles } from './shared/CommonTypes.js';
export { JsonSchemaFormat } from './shared/JsonSchemaFormat.js';
export { TypedJSON } from './shared/TypedJSON.js';
export { PotoConstants } from './shared/PotoConstants.js';

// Message client and related utilities
export * from './shared/MessageClient.js';

// LLM config (browser-safe)
export * from './llms/LLMConfig.js';

// Note: Server-side exports like PotoServer, PotoModule, etc. are intentionally excluded
// from this browser build to prevent Node.js/Bun built-in import errors
`;

writeFileSync(browserIndexPath, browserIndexContent);

// Also update the .d.ts file
const browserIndexDtsPath = join(browserDist, 'index.d.ts');
let browserIndexDtsContent = `// Browser-only entry point for Poto Framework
// This excludes server-side code that uses Node.js/Bun built-ins

// Client exports (browser-safe)
export { PotoClient } from './web/rpc/PotoClient.js';
export { PotoClientWithProxy } from './web/rpc/PotoClientWithProxy.js';
export { newRpcClient } from './web/rpc/RpcClient.js';
export { IframeRpcClient } from './web/rpc/IframeRpcClient.js';
export { WebRpcBridge } from './web/rpc/WebRpcBridge.js';

// Shared types and utilities (browser-safe)
export { DialogRoles } from './shared/CommonTypes.js';
export { JsonSchemaFormat } from './shared/JsonSchemaFormat.js';
export { TypedJSON } from './shared/TypedJSON.js';
export { PotoConstants } from './shared/PotoConstants.js';

// Message client and related utilities
export * from './shared/MessageClient.js';

// LLM config (browser-safe)
export * from './llms/LLMConfig.js';

// Type-only exports for TypeScript consumers
export type { DialogEntry, DialogRole, OpenAIContentBlock } from './shared/CommonTypes.js';
export type { JSONSchema } from './shared/JSONSchema.js';
export type { MessagingClient } from './shared/MessageClient.js';

// Note: Server-side exports like PotoServer, PotoModule, etc. are intentionally excluded
// from this browser build to prevent Node.js/Bun built-in import errors
`;

writeFileSync(browserIndexDtsPath, browserIndexDtsContent);

console.log('✅ Browser build completed successfully!');
