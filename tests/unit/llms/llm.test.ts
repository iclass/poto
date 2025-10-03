import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from 'bun:test';
import { LLM, LLMError, parseDialog } from '../../../src/llms/llm';
import { DialogEntry } from '../../../src/shared/CommonTypes';

const DUMMY_MODEL = 'gpt-test';
const DUMMY_KEY = 'test-key';
const DUMMY_URL = 'https://dummy.llm/api';

function createLLM() {
	return new LLM(DUMMY_MODEL, DUMMY_KEY, DUMMY_URL);
}

describe('LLM class', () => {
	let llm: LLM;
	let originalFetch: typeof fetch;
	const mockFetch = jest.fn();

	beforeAll(() => {
		originalFetch = globalThis.fetch;
		// @ts-expect-error: mock fetch for tests
		globalThis.fetch = mockFetch;
	});

	afterAll(() => {
		globalThis.fetch = originalFetch;
	});

	beforeEach(() => {
		llm = createLLM();
		mockFetch.mockReset();
	});

	it('should initialize with correct properties', () => {
		expect(llm.model).toBe(DUMMY_MODEL);
		expect(llm.apiKey).toBe(DUMMY_KEY);
		expect(llm.apiUrl).toBe(DUMMY_URL);
		expect(Array.isArray(llm.messages)).toBe(true);
	});

	it('system, assistant, user should add messages', () => {
		llm.system('sys');
		llm.assistant('asst');
		llm.user('usr');
		expect(llm.messages).toEqual([
			{ role: 'system', content: 'sys' },
			{ role: 'assistant', content: 'asst' },
			{ role: 'user', content: 'usr' },
		]);
	});

	it('user should stringify objects', () => {
		llm.user({ foo: 'bar' });
		expect(llm.messages[0].content).toContain('foo');
	});

	it('reset and clearMsgs should empty messages', () => {
		llm.user('hi');
		llm.reset();
		expect(llm.messages.length).toBe(0);
		llm.user('hi');
		llm.clearMsgs();
		expect(llm.messages.length).toBe(0);
	});

	it('build returns messages array', () => {
		llm.user('hi');
		expect(llm.build()).toBe(llm.messages);
	});

	it('getPromptTokens returns stringified length', () => {
		llm.user('hi');
		const len = JSON.stringify(llm.messages).length;
		expect(llm.getPromptTokens()).toBe(len);
	});

	it('parseScript adds parsed dialog entries', () => {
		const script = `\'user'\nHello\n\'assistant'\nHi!`;
		llm.parseScript(script);
		expect(llm.messages.length).toBe(2);
		expect(llm.messages[0].role).toBe('user');
		expect(llm.messages[1].role).toBe('assistant');
	});

	it('parseAs adds dialog with specified role', () => {
		llm.parseAs('Hello', 'system');
		expect(llm.messages[0].role).toBe('system');
	});

	it('loadDialogs appends dialogs', () => {
		const dialogs: DialogEntry[] = [
			{ role: 'user', content: 'A' },
			{ role: 'assistant', content: 'B' },
		];
		llm.loadDialogs(dialogs);
		expect(llm.messages.length).toBe(2);
	});

	it('requestCompletion_ throws LLMError on non-ok response', async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 429,
			statusText: 'Too Many Requests',
			text: async () => 'rate limit',
		});
		await expect(llm.requestCompletion_()).rejects.toThrow(LLMError);
	});

	it('requestCompletion_ returns CompletionResponse on ok', async () => {
		// Minimal mock for CompletionResponse
		const dummyJson = { choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }], usage: {}, id: 'id', object: 'obj', created: 0, model: 'm', system_fingerprint: '' };
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => dummyJson,
		});
		const res = await llm.requestCompletion_();
		expect(res.choices[0].message.content).toBe('hi');
	});

	it('parseDialog parses multi-role script', () => {
		const script = `\'user'\nHello\n\'assistant'\nHi!`;
		const entries = parseDialog(script);
		expect(entries.length).toBe(2);
		expect(entries[0].role).toBe('user');
		expect(entries[1].role).toBe('assistant');
	});

	it('LLMError sets status and message', () => {
		const err = new LLMError(400, 'bad');
		expect(err.status).toBe(400);
		expect(err.message).toBe('bad');
		expect(err.name).toBe('FetchError');
	});
}); 