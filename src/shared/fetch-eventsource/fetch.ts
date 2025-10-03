import { EventSourceMessage, getBytes, getLines, getMessages } from './parse';

export const EventStreamContentType = 'text/event-stream';

const DefaultRetryInterval = 1000;
const LastEventId = 'last-event-id';

export interface FetchEventSourceInit extends RequestInit {
    headers?: Record<string, string>,
    onopen?: (response: Response) => Promise<void>,
    onmessage?: (ev: EventSourceMessage) => void;
    onclose?: () => void;
    onerror?: (err: any) => number | null | undefined | void,
    openWhenHidden?: boolean;
    fetch?: typeof fetch;
}

export function fetchEventSource(input: RequestInfo, {
    signal: inputSignal,
    headers: inputHeaders,
    onopen: inputOnOpen,
    onmessage,
    onclose,
    onerror,
    openWhenHidden,
    fetch: inputFetch,
    ...rest
}: FetchEventSourceInit) {
    return new Promise<void>((resolve, reject) => {
        const headers = { ...inputHeaders };
        if (!headers.accept) {
            headers.accept = EventStreamContentType;
        }

        let curRequestController: AbortController;

        // Check if document and window are available
        const isBrowserEnv = typeof document !== 'undefined' && typeof window !== 'undefined';

        function onVisibilityChange() {
            if (isBrowserEnv) {
                curRequestController.abort(); // close existing request on every visibility change
                if (!document.hidden) {
                    create(); // page is now visible again, recreate request.
                }
            }
        }

        if (!openWhenHidden && isBrowserEnv) {
            document.addEventListener('visibilitychange', onVisibilityChange);
        }

        let retryInterval = DefaultRetryInterval;
        let retryTimer = 0;

        function dispose() {
            if (isBrowserEnv) {
                document.removeEventListener('visibilitychange', onVisibilityChange);
                window.clearTimeout(retryTimer);
            }
            curRequestController.abort();
        }

        inputSignal?.addEventListener('abort', () => {
            dispose();
            resolve(); // don't waste time constructing/logging errors
        });

        const fetch = inputFetch ?? (isBrowserEnv ? window.fetch : globalThis.fetch);
        const onopen = inputOnOpen ?? defaultOnOpen;

        async function create() {
            curRequestController = new AbortController();
            try {
                const response = await fetch(input, {
                    ...rest,
                    headers,
                    signal: curRequestController.signal,
                });

                await onopen(response);

                await getBytes(response.body!, getLines(getMessages(id => {
                    if (id) {
                        headers[LastEventId] = id;
                    } else {
                        delete headers[LastEventId];
                    }
                }, retry => {
                    retryInterval = retry;
                }, onmessage)));

                onclose?.();
                dispose();
                resolve();
            } catch (err) {
                if (!curRequestController.signal.aborted) {
                    try {
                        const interval: any = onerror?.(err) ?? retryInterval;
                        if (isBrowserEnv) {
                            window.clearTimeout(retryTimer);
                            retryTimer = window.setTimeout(create, interval);
                        } else {
                            setTimeout(create, interval);
                        }
                    } catch (innerErr) {
                        dispose();
                        reject(innerErr);
                    }
                }
            }
        }

        create();
    });
}

function defaultOnOpen(response: Response) {
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith(EventStreamContentType)) {
        throw new Error(`Expected content-type to be ${EventStreamContentType}, Actual: ${contentType}`);
    }
}
