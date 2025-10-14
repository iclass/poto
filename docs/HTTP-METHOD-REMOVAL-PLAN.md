# Remove HTTP Method Naming Convention

## Overview

Remove the coupling between method names and HTTP methods. All methods will default to POST regardless of their name. Add a new `@Get()` decorator for methods that explicitly need to use GET.

## Open Questions

1. **Client-Server Synchronization**: How should the client know which methods use GET?
   - Option A: Metadata endpoint (e.g., `GET /{modulePrefix}/__metadata`) that returns method HTTP types
   - Option B: Client always uses POST, `@Get()` only enables direct browser/curl access
   - Option C: Manual client configuration

2. **HTTP Caching**: POST requests are not cached by browsers. If we want caching benefits:
   - Need metadata endpoint so client knows to use GET for decorated methods
   - Consider adding `@Cache()` decorator for cache headers in the future

## Key Changes

### 1. Add @Get() Decorator (`src/server/serverDecorators.ts`)

- Add new `GET_METHOD_KEY` symbol
- Create `@Get()` decorator function (similar to `@roles`)
- Add `getAllMethodsAndHttpMethods()` helper function to extract GET metadata
- Export this new helper for use in `PotoServer.ts`

### 2. Update Server Handler (`src/server/PotoServer.ts`)

**In `createHttpHandler()` function (~line 584-626):**

- Remove HTTP verb extraction logic: `methodName.match(/^(get|post|put|delete)/i)`
- Simplify `urlToMethodMap` to map method names directly (lowercase) to their actual method names
- Default all methods to POST
- Import and use `getAllMethodsAndHttpMethods()` to check for `@Get()` decorated methods
- Update route matching logic to check decorator metadata instead of method name prefix

**In `extractArgs()` function (~line 924-957):**

- Keep the logic but note that GET methods will only be used when explicitly decorated
- POST will be the primary method for all other endpoints

### 3. Update Client Proxy (`src/web/rpc/PotoClient.ts`)

**In `getProxy()` method (~line 462-647):**

- Remove lines 467-487: the HTTP verb extraction and routing logic
- Simplify to always use POST as the default HTTP method
- Remove the special case for GET/DELETE with arguments (lines 476-482)
- Always send arguments in the request body (lines 546-558)
- Clean up the logic since all requests will use POST body by default

**Note**: If implementing metadata endpoint (Option A), add logic to:
- Fetch `/{modulePrefix}/__metadata` on proxy creation
- Cache the metadata
- Use appropriate HTTP method based on metadata

### 4. Update Tests

**Files to update:**

- `tests/unit/server/PotoServer.test.ts` - Update test expectations
- `tests/e2e/PotoGeneral.e2e.test.ts` - Verify end-to-end behavior
- Any test that explicitly tests GET requests with URL parameters

**Changes:**

- Methods no longer infer HTTP method from name
- All method calls use POST unless decorated with `@Get()`
- URL routing is now just `/{modulePrefix}/{methodName}` (all lowercase)

## Breaking Changes

1. **Client-Server Communication**: The URL structure changes from detecting HTTP verbs in method names to using POST for everything by default
2. **Method Routing**: `getUsers` no longer automatically uses GET. It uses POST unless decorated with `@Get()`
3. **Argument Passing**: All arguments go in the POST body by default (no more URL path segments for arguments)

## Migration Guide for Users

```typescript
// Before: Method name determined HTTP method
class MyModule extends PotoModule {
  async getUsers() { ... }  // Used HTTP GET
  async postUser(data) { ... }  // Used HTTP POST
}

// After: All methods use POST by default
class MyModule extends PotoModule {
  async getUsers() { ... }  // Now uses HTTP POST
  async postUser(data) { ... }  // Still uses HTTP POST
  
  // To explicitly use GET (if metadata endpoint is implemented):
  @Get()
  async getPublicData() { ... }  // Uses HTTP GET
}
```

## Implementation Notes

- Keep method names unchanged - `getUsers`, `postMessage`, etc. are just names now
- The `@Get()` decorator is opt-in for methods that benefit from GET (caching, bookmarking)
- Maintain backward compatibility for built-in endpoints (`/login`, `/subscribe`, etc.)
- Update inline comments that reference the old convention

## Decision Needed

Before implementation, decide on client-server synchronization strategy for `@Get()` decorator:

- **If no caching needed**: Client always uses POST (simpler, no metadata needed)
- **If caching wanted**: Implement metadata endpoint so client knows which methods use GET

## To-dos

- [ ] Decide on client-server synchronization strategy
- [ ] Add @Get() decorator and helper function to serverDecorators.ts
- [ ] Update createHttpHandler() in PotoServer.ts to remove HTTP verb extraction and use @Get() metadata
- [ ] Simplify getProxy() in PotoClient.ts to always use POST by default
- [ ] (Optional) Implement metadata endpoint if caching is needed
- [ ] Update unit and e2e tests to work with new POST-default behavior
- [ ] Run tests and verify that existing applications still work correctly

