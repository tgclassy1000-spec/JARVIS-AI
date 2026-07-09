// @vitest-environment node

import { FetchWebHttpClient } from '../../src/main/web/providers/http-client';

describe('FetchWebHttpClient', () => {
  it('retries transient failures and returns JSON', async () => {
    let calls = 0;
    const fetcher: typeof fetch = () => {
      calls += 1;
      if (calls === 1) return Promise.resolve(new Response('nope', { status: 503 }));
      return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
    };
    const client = new FetchWebHttpClient({
      timeoutMs: 1000,
      maxAttempts: 2,
      fetcher,
      backoffMs: 0,
    });
    await expect(client.getJson(new URL('https://example.com/data'))).resolves.toEqual({
      ok: true,
    });
    expect(calls).toBe(2);
  });

  it('maps invalid JSON and provider rate limits to platform errors', async () => {
    const invalidJson = new FetchWebHttpClient({
      timeoutMs: 1000,
      maxAttempts: 1,
      fetcher: () => Promise.resolve(new Response('{bad', { status: 200 })),
      backoffMs: 0,
    });
    await expect(invalidJson.getJson(new URL('https://example.com/data'))).rejects.toMatchObject({
      code: 'PROVIDER_UNKNOWN',
    });

    const rateLimited = new FetchWebHttpClient({
      timeoutMs: 1000,
      maxAttempts: 1,
      fetcher: () => Promise.resolve(new Response('slow down', { status: 429 })),
      backoffMs: 0,
    });
    await expect(rateLimited.getText(new URL('https://example.com/data'))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });
});
