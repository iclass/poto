# LLM Streaming Integration Tests

This directory contains comprehensive integration tests for the LLM streaming functionality.

## Test Files

### `llm.integration.test.ts`
Contains both regular LLM tests and streaming tests. Includes:
- Basic streaming functionality
- Text-only streaming
- JSON response format streaming
- Error handling
- Debug mode testing

### `llm.streaming.test.ts`
Dedicated streaming tests with more detailed coverage:
- Chunk structure validation
- Role assignment testing
- Token limit handling
- Concurrent stream testing
- Performance testing
- Error scenarios

## Running the Tests

### Prerequisites
1. Set up your environment variables:
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   export OPENAI_MODEL="gpt-4o-mini"  # Optional, defaults to gpt-4o-mini
   export OPENAI_ENDPOINT="https://api.openai.com/v1/chat/completions"  # Optional
   ```

2. Make sure you have Bun installed and configured.

### Run All Integration Tests
```bash
bun test src/server/llm.integration.test.ts
```

### Run Only Streaming Tests
```bash
bun test src/server/llm.streaming.test.ts
```

### Run with Verbose Output
```bash
bun test --verbose src/server/llm.streaming.test.ts
```

## Test Coverage

### Core Functionality
- ✅ `requestCompletionStream_()` - Full chunk streaming
- ✅ `requestCompletionStreamText_()` - Text-only streaming
- ✅ `StreamingChunk` class methods
- ✅ SSE format parsing
- ✅ JSON response format handling

### Error Handling
- ✅ Invalid API keys
- ✅ Network errors
- ✅ Malformed responses
- ✅ Empty responses

### Edge Cases
- ✅ Token limits
- ✅ Role assignment in first chunk
- ✅ Concurrent streams
- ✅ Performance timing
- ✅ Debug mode

### Integration Scenarios
- ✅ Real OpenAI API calls
- ✅ Complete streaming workflows
- ✅ Resource cleanup
- ✅ Memory management

## Test Structure

Each test follows this pattern:
1. **Setup**: Create LLM instance and configure messages
2. **Execute**: Call streaming method and read stream
3. **Validate**: Check chunk structure, content, and metadata
4. **Cleanup**: Release reader and verify completion

## Example Test Output

```
✓ should stream chunks with proper structure (1.2s)
✓ should handle role assignment in first chunk (0.8s)
✓ should handle max tokens limit (0.5s)
✓ should stream only text content (0.9s)
✓ should handle empty content chunks gracefully (0.6s)
✓ should throw error with invalid API key (0.1s)
✓ should handle network errors gracefully (0.1s)
✓ should handle multiple concurrent streams (2.1s)
✓ should complete within reasonable time (0.7s)
```

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY is not set"**
   - Make sure your environment variable is properly set
   - Check that you're running the test from the correct directory

2. **Network timeouts**
   - Increase timeout values if needed
   - Check your internet connection
   - Verify OpenAI API endpoint is accessible

3. **Rate limiting**
   - Tests use `gpt-4o-mini` by default to minimize costs
   - Consider using a test API key for development

4. **Memory issues**
   - Tests properly release resources
   - If you see memory leaks, check that `reader.releaseLock()` is called

### Debug Mode

Enable debug logging by setting the debug parameter to `true`:
```typescript
const stream = await llm.requestCompletionStream_(1000, true);
```

This will log:
- Request body sent to OpenAI
- SSE parsing details
- Non-JSON data in stream
- Error details

## Cost Considerations

- Tests use `gpt-4o-mini` by default (cheaper model)
- Each test makes minimal API calls
- Total cost for full test suite: ~$0.01-0.05
- Consider using test API keys for development

## Contributing

When adding new streaming features:
1. Add corresponding tests to both test files
2. Test both success and failure scenarios
3. Include performance tests for new functionality
4. Update this README with new test descriptions
