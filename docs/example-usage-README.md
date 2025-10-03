# Using Poto Framework as a Remote Dependency

This directory contains examples of how to use Poto Framework as a remote dependency in your projects.

## Quick Start

### Method 1: Using Bun's Remote Dependencies

1. **Create a new project**:
   ```bash
   mkdir my-poto-app
   cd my-poto-app
   ```

2. **Add Poto as a dependency**:
   ```bash
   # Add latest version
   bun add poto@https://github.com/iclass/poto/releases/download/latest/poto.tar.gz
   
   # Or add specific version
   bun add poto@https://github.com/iclass/poto/releases/download/v2025.10.01-abc123/poto.tar.gz
   ```

3. **Create your server** (`src/server.ts`):
   ```typescript
   import { PotoServer, PotoModule } from 'poto';
   
   class MyModule extends PotoModule {
       async getHello_(): Promise<string> {
           return "Hello from Poto!";
       }
   }
   
   const server = new PotoServer({
       port: 3000,
       jwtSecret: 'your-secret'
   });
   
   server.addModule(new MyModule());
   server.run();
   ```

4. **Run your app**:
   ```bash
   bun run src/server.ts
   ```

### Method 2: Using package.json

1. **Create package.json**:
   ```json
   {
     "name": "my-poto-app",
     "version": "1.0.0",
     "type": "module",
     "dependencies": {
       "poto": "https://github.com/iclass/poto/releases/download/latest/poto.tar.gz"
     }
   }
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Use in your code**:
   ```typescript
   import { PotoServer, PotoClient, PotoModule } from 'poto';
   ```

## Version Management

### Using Latest Version
```json
{
     "dependencies": {
       "poto": "https://github.com/iclass/poto/releases/download/latest/poto.tar.gz"
     }
}
```

### Using Specific Version
```json
{
     "dependencies": {
       "poto": "https://github.com/iclass/poto/releases/download/v2025.10.01-abc123/poto.tar.gz"
     }
}
```

### Using Bun CLI
```bash
# Latest version
bun add poto@https://github.com/iclass/poto/releases/download/latest/poto.tar.gz

# Specific version
bun add poto@https://github.com/iclass/poto/releases/download/v2025.10.01-abc123/poto.tar.gz
```

## Clean Import Syntax

Poto Framework provides a clean, single-import syntax:

```typescript
// Simple imports
import { PotoServer, PotoClient, PotoModule } from 'poto';

// Advanced imports with LLM support
import { PotoServer, PotoClient, PotoModule, LLMPotoModule, LLM, LLMConfig } from 'poto';

// All available exports
import { 
    PotoServer, 
    PotoClient, 
    PotoModule, 
    LLMPotoModule,
    LLM,
    LLMConfig,
    PotoUser,
    UserProvider,
    UserSessionProvider,
    UserSessionData,
    LLMSessionData,
    PotoRequestContext,
    DialogEntry,
    DialogRole,
    JSONSchema
} from 'poto';
```

## Benefits of Remote Dependencies

1. **Easy Updates**: Just change the URL to get a new version
2. **Version Control**: Pin to specific releases for stability
3. **No Local Cloning**: Don't need to clone the entire repository
4. **Smaller Downloads**: Only download the framework files you need
5. **Clean Dependencies**: Clear separation between your code and framework

## Troubleshooting

### If the download fails:
1. Check that the release exists: https://github.com/iclass/poto/releases
2. Verify the URL format is correct
3. Ensure you have internet connectivity

### If imports don't work:
1. Make sure you're using the correct import paths
2. Check that the framework was installed correctly
3. Verify your TypeScript configuration

### For TypeScript support:
Make sure your `tsconfig.json` includes:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true
  }
}
```
