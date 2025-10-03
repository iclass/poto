# Disabled Tests

This document lists tests that have been disabled because they depend on sensitive environment variables that are not available in CI/CD pipelines.

## Disabled Test Files

### `tests/integration/llms/llm.integration.test.ts.disabled`

**Reason for Disabling**: This test file requires the `OPENAI_API_KEY` environment variable from `.env` file, which contains sensitive API credentials that should not be available in GitHub CI/CD pipelines.

**Dependencies**:
- `OPENAI_API_KEY` - OpenAI API key (sensitive)
- `OPENAI_MODEL` - OpenAI model name (optional, defaults to 'chatgpt-4o-latest')
- `OPENAI_ENDPOINT` - OpenAI endpoint URL (optional, defaults to 'https://api.openai.com/v1/chat/completions')

**Test Coverage**: 
- OpenAI API integration tests
- Streaming completion tests
- JSON response format tests
- Error handling tests

**Alternative**: These tests can be run locally when the `.env` file is available with valid API credentials.

## Safe Test Files

The following test files use only hardcoded test secrets and are safe for CI/CD:

- `tests/unit/server/GeneratorModuleExample.test.ts` - Uses `"testSecret"`
- `tests/unit/server/PotoServer.test.ts` - Uses `"my secret"` and `"testSecret"`
- `tests/e2e/web/rpc/PotoClientPotoServerE2E.test.ts` - Uses `"e2e-test-secret"`
- All other unit and integration tests

## Running Tests Locally

To run the disabled integration tests locally:

1. Create a `.env` file in the project root
2. Add your OpenAI API key: `OPENAI_API_KEY=your_api_key_here`
3. Rename the disabled test file: `mv tests/integration/llms/llm.integration.test.ts.disabled tests/integration/llms/llm.integration.test.ts`
4. Run the tests: `bun test`
5. Disable the test again: `mv tests/integration/llms/llm.integration.test.ts tests/integration/llms/llm.integration.test.ts.disabled`
