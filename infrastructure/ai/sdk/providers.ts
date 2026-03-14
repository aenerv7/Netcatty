import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ProviderConfig } from '../types';

/**
 * Bridge API subset used for SDK fetch adapter.
 */
interface BridgeAPI {
  aiFetch(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<{
    ok: boolean;
    status: number;
    data: string;
    error?: string;
  }>;
  aiChatStream(
    requestId: string,
    url: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ ok: boolean; error?: string }>;
  onAiStreamData(requestId: string, cb: (data: string) => void): () => void;
  onAiStreamEnd(requestId: string, cb: () => void): () => void;
  onAiStreamError(requestId: string, cb: (error: string) => void): () => void;
}

function getBridge(): BridgeAPI | null {
  const w = window as unknown as { netcatty?: BridgeAPI };
  return w.netcatty ?? null;
}

/**
 * Detect whether a request is likely a streaming request.
 * AI SDK streaming requests use POST with `"stream": true` in the body.
 */
function isStreamingRequest(init?: RequestInit): boolean {
  if (!init?.body) return false;
  try {
    const bodyStr = typeof init.body === 'string' ? init.body : null;
    if (!bodyStr) return false;
    const parsed = JSON.parse(bodyStr);
    return parsed.stream === true;
  } catch {
    return false;
  }
}

/**
 * Extract headers as a plain Record<string, string> from various header formats.
 */
function extractHeaders(headers?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = value;
    }
  } else {
    Object.assign(result, headers);
  }
  return result;
}

/**
 * Create a fetch function compatible with the Vercel AI SDK that routes
 * requests through the Electron IPC bridge to avoid CORS.
 *
 * - Non-streaming requests: uses `window.netcatty.aiFetch()` and returns a `Response`.
 * - Streaming requests: uses `window.netcatty.aiChatStream()` and returns a
 *   `Response` with a `ReadableStream` body.
 * - Falls back to `globalThis.fetch` if the bridge is unavailable.
 */
export function createBridgeFetchForSDK(): typeof globalThis.fetch {
  return async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const bridge = getBridge();
    if (!bridge) {
      return globalThis.fetch(input, init);
    }

    // Resolve URL string
    let url: string;
    let resolvedInit = init;

    if (input instanceof Request) {
      url = input.url;
      // Merge Request properties with init overrides
      if (!resolvedInit) {
        resolvedInit = {
          method: input.method,
          headers: extractHeaders(input.headers),
          body: input.body ? await new Response(input.body).text() : undefined,
        };
      }
    } else {
      url = input instanceof URL ? input.toString() : input;
    }

    const method = resolvedInit?.method || 'GET';
    const headers = extractHeaders(resolvedInit?.headers);
    const body =
      resolvedInit?.body != null ? String(resolvedInit.body) : undefined;

    // Streaming path
    if (isStreamingRequest(resolvedInit)) {
      const requestId = `sdk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();

          const unsubData = bridge.onAiStreamData(requestId, (data: string) => {
            // Re-wrap as SSE so the SDK can parse it
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          });
          const unsubEnd = bridge.onAiStreamEnd(requestId, () => {
            controller.close();
            cleanup();
          });
          const unsubError = bridge.onAiStreamError(
            requestId,
            (error: string) => {
              controller.error(new Error(error));
              cleanup();
            },
          );

          const cleanup = () => {
            unsubData();
            unsubEnd();
            unsubError();
          };

          // Handle abort
          if (resolvedInit?.signal) {
            resolvedInit.signal.addEventListener(
              'abort',
              () => {
                // Send cancel signal
                bridge.aiChatStream(requestId, '', {}, '').catch(() => {});
                controller.error(new DOMException('Aborted', 'AbortError'));
                cleanup();
              },
              { once: true },
            );
          }

          // Start the stream
          const result = await bridge.aiChatStream(
            requestId,
            url,
            headers,
            body || '',
          );
          if (!result.ok) {
            controller.error(new Error(result.error || 'Stream request failed'));
            cleanup();
          }
        },
      });

      return new Response(stream, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/event-stream' },
      });
    }

    // Non-streaming path
    const result = await bridge.aiFetch(url, method, headers, body);

    return new Response(result.data, {
      status: result.status,
      statusText: result.ok ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json' },
    });
  };
}

/**
 * Create a Vercel AI SDK model instance from a ProviderConfig.
 */
export function createModelFromConfig(config: ProviderConfig) {
  const customFetch = createBridgeFetchForSDK();
  const modelId = config.defaultModel || '';

  switch (config.providerId) {
    case 'openai':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        fetch: customFetch,
      })(modelId);

    case 'anthropic':
      return createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        fetch: customFetch,
      })(modelId);

    case 'google':
      return createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        fetch: customFetch,
      })(modelId);

    case 'ollama':
      // Ollama uses OpenAI-compatible API
      return createOpenAI({
        apiKey: 'ollama',
        baseURL: config.baseURL || 'http://localhost:11434/v1',
        fetch: customFetch,
      })(modelId);

    case 'openrouter':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
        fetch: customFetch,
      })(modelId);

    case 'custom':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        fetch: customFetch,
      })(modelId);
  }
}
