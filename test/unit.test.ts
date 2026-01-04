import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;
const mockFetch = vi.fn();

const buildResponse = (body: string, headers: Record<string, string> = { 'content-type': 'text/plain' }) => {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    headers: {
      forEach: (callback: (value: string, key: string) => void) => {
        Object.entries(normalizedHeaders).forEach(([key, value]) => callback(value, key));
      }
    },
    text: vi.fn().mockResolvedValue(body)
  };
};

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

import { md5 } from '../src/crypto-utils';
import Client from '../src';
import IndexClient, { ClientConfig } from '../src/index';

const baseConfig = {
  accessKeyId: 'test-access-key',
  accessKeySecret: 'test-secret',
  region: 'cn-hangzhou'
};

describe('Client constructor', () => {
  it('sets endpoint from region and net', () => {
    const client = new Client({
      ...baseConfig,
      net: 'internal'
    });
    expect(client.endpoint).toBe('cn-hangzhou-internal.log.aliyuncs.com');
    expect(client.use_https).toBe(false);
  });

  it('parses https endpoint', () => {
    const client = new Client({
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      endpoint: 'https://cn-hangzhou.log.aliyuncs.com'
    });
    expect(client.endpoint).toBe('cn-hangzhou.log.aliyuncs.com');
    expect(client.use_https).toBe(true);
  });

  it('parses http endpoint', () => {
    const client = new Client({
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      endpoint: 'http://cn-hangzhou.log.aliyuncs.com'
    });
    expect(client.endpoint).toBe('cn-hangzhou.log.aliyuncs.com');
    expect(client.use_https).toBe(false);
  });

  it('uses endpoint as-is without scheme', () => {
    const client = new Client({
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      endpoint: 'cn-hangzhou.log.aliyuncs.com'
    });
    expect(client.endpoint).toBe('cn-hangzhou.log.aliyuncs.com');
    expect(client.use_https).toBe(false);
  });

  it('throws when credentials are missing', () => {
    expect(() => new Client({ region: 'cn-hangzhou' } as never)).toThrow(
      /Missing credentials/
    );
  });

  it('throws when credentialsProvider is not async', () => {
    expect(
      () =>
        new Client({
          credentialsProvider: {
            getCredentials: () => ({ accessKeyId: 'id', accessKeySecret: 'secret' })
          }
        })
    ).toThrow(/getCredentials async function/);
  });

  it('throws when credentialsProvider is invalid', () => {
    expect(
      () =>
        new Client({
          credentialsProvider: {
            getCredentials: 'invalid' as never
          }
        })
    ).toThrow(/getCredentials async function/);
  });
});

describe('Client credentials', () => {
  it('returns credentials from instance', async () => {
    const client = new Client(baseConfig);
    await expect(client._getCredentials()).resolves.toEqual({
      accessKeyId: baseConfig.accessKeyId,
      accessKeySecret: baseConfig.accessKeySecret,
      securityToken: undefined
    });
  });

  it('returns credentials from provider', async () => {
    const client = new Client({
      credentialsProvider: {
        getCredentials: async () => ({
          accessKeyId: 'id',
          accessKeySecret: 'secret',
          securityToken: 'token'
        })
      }
    });

    await expect(client._getCredentials()).resolves.toEqual({
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      securityToken: 'token'
    });
  });

  it('throws when provider returns invalid credentials', async () => {
    const client = new Client({
      credentialsProvider: {
        getCredentials: async () => ({
          accessKeyId: 'id'
        })
      }
    });

    await expect(client._getCredentials()).rejects.toThrow(/Missing credentials/);
  });
});

describe('Client signing', () => {
  it('signs GET requests correctly', async () => {
    const client = new Client({
      accessKeyId: 'bq2sjzesjmo86kq35behupbq',
      accessKeySecret: '4fdO2fTDDnZPU/L7CHNdemB2Nsk='
    });

    const sign = client._sign(
      'GET',
      '/logstores',
      {
        logstoreName: '',
        offset: '0',
        size: '1000'
      },
      {
        date: 'Mon, 09 Nov 2015 06:11:16 GMT',
        'x-log-apiversion': '0.6.0',
        'x-log-signaturemethod': 'hmac-sha1'
      },
      await client._getCredentials()
    );
    expect(sign).toBe('LOG bq2sjzesjmo86kq35behupbq:jEYOTCJs2e88o+y5F4/S5IsnBJQ=');
  });

  it('signs POST requests correctly with STS token', async () => {
    const credentials = {
      accessKeyId: 'STS.NSNYgJ2KUoYaEuDrNazRLg2a6',
      accessKeySecret: '56Xqw2THF5vTHTNkGWR6uGRKXToKWMi2eLFjppPNV8RR',
      securityToken: 'CAISiwJ1q6Ft5B2yfSjIr5D7Et3+35R02JuKR1P1lk40dt1giPfK1Dz2IHhLdXNrAuEXs/w0mmBQ7v8TlqZdVplOWU3Da+B364xK7Q75jHw5B0zwv9I+k5SANTW5KXyShb3/AYjQSNfaZY3eCTTtnTNyxr3XbCirW0ffX7SClZ9gaKZ8PGD6F00kYu1bPQx/ssQXGGLMPPK2SH7Qj3HXEVBjt3gX6wo9y9zmnZHNukGH3QOqkbVM9t6rGPX+MZkwZqUYesyuwel7epDG1CNt8BVQ/M909vccpmad5YrMUgQJuEvWa7KNo8caKgJmI7M3AbBFp/WlyKMn5raOydSrkE8cePtSVynP+g0hR0dZ+YgagAEFdb+5rO1e+OZ3kcmPKF5Zh2Sni+vF1qzKA/SElND5koQQV6uvVCweKnfzCPMKjY0OXWmfgtcwOTyJ4ABGsTGnILzBNRD/+Gdqe7wclZrj0aDUkTdFf8k7SudZuO9KOPBe8mS3pJoMs1p67mWA/J4Wn0dottbprb5EQOBRxUC6bw=='
    };
    const client = new Client(credentials);

    const sign = client._sign(
      'POST',
      '/logstores/test-logstore',
      {},
      {
        date: 'Mon, 09 Nov 2015 06:03:03 GMT',
        'x-log-apiversion': '0.6.0',
        'x-log-signaturemethod': 'hmac-sha1',
        'content-md5': '1DD45FA4A70A9300CC9FE7305AF2C494',
        'content-length': '52',
        'content-type': 'application/x-protobuf',
        'x-log-bodyrawsize': '50',
        'x-log-compresstype': 'lz4',
        'x-acs-security-token': credentials.securityToken
      },
      await client._getCredentials()
    );
    expect(sign).toBe('LOG STS.NSNYgJ2KUoYaEuDrNazRLg2a6:G3R03b6PwVI+zUaLtqezsBDL/j8=');
  });

  it('signs with empty queries and no prefixed headers', async () => {
    const client = new Client(baseConfig);
    const sign = client._sign(
      'GET',
      '/logstores',
      {},
      {
        date: 'Mon, 09 Nov 2015 06:11:16 GMT',
        'content-type': 'application/json'
      },
      await client._getCredentials()
    );
    expect(sign.startsWith('LOG ')).toBe(true);
  });

  it('handles undefined query values', async () => {
    const client = new Client(baseConfig);
    const sign = client._sign(
      'GET',
      '/logstores',
      { foo: undefined, bar: '1' },
      {
        date: 'Mon, 09 Nov 2015 06:11:16 GMT',
        'x-log-apiversion': '0.6.0',
        'x-log-signaturemethod': 'hmac-sha1'
      },
      await client._getCredentials()
    );
    expect(sign.includes(baseConfig.accessKeyId)).toBe(true);
  });
});

describe('Client request handling', () => {
  it('exports index entrypoint', () => {
    const config: ClientConfig = { ...baseConfig } as ClientConfig;
    const client = new IndexClient(config);
    expect(client).toBeInstanceOf(Client);
  });

  it('adds md5, content-length, and security token headers', async () => {
    const client = new Client(baseConfig);
    vi.spyOn(client, '_sign').mockReturnValue('SIGN');
    vi.spyOn(client, '_getCredentials').mockResolvedValue({
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      securityToken: 'token'
    });

    mockFetch.mockResolvedValue(buildResponse('ok', { 'content-type': 'text/plain' }));

    const body = Buffer.from('payload');
    await client._request('POST', 'proj', '/path', {}, body, {}, { timeout: 10 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const headers = options.headers as Record<string, string | number>;
    expect(headers.authorization).toBe('SIGN');
    expect(headers['x-acs-security-token']).toBe('token');
    expect(headers['content-md5']).toBe(md5(body, 'hex').toUpperCase());
    expect(headers['content-length']).toBe(String(body.length));
  });

  it('handles undefined queries and returns string response', async () => {
    const client = new Client(baseConfig);
    vi.spyOn(client, '_sign').mockReturnValue('SIGN');
    mockFetch.mockResolvedValue(buildResponse('plain', { 'content-type': 'text/plain' }));

    await expect(
      client._request('GET', 'proj', '/path', undefined as never, null, {}, undefined)
    ).resolves.toBe('plain');
  });

  it('handles responses without a content-type header', async () => {
    const client = new Client(baseConfig);
    vi.spyOn(client, '_sign').mockReturnValue('SIGN');
    mockFetch.mockResolvedValue(buildResponse('no-type', {}));

    await expect(
      client._request('GET', 'proj', '/path', {}, null, {}, undefined)
    ).resolves.toBe('no-type');
  });

  it('builds https request without project prefix and with query string', async () => {
    const client = new Client({ ...baseConfig, use_https: true });
    vi.spyOn(client, '_sign').mockReturnValue('SIGN');
    mockFetch.mockResolvedValue(buildResponse('ok'));

    await client._request('GET', undefined, '/path', { a: 1 }, null, {}, undefined);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('https://');
    expect(url).toContain('/path?a=1');
  });

  it('parses JSON response bodies', async () => {
    const client = new Client(baseConfig);
    vi.spyOn(client, '_sign').mockReturnValue('SIGN');
    mockFetch.mockResolvedValue(
      buildResponse(JSON.stringify({ ok: true }), { 'content-type': 'application/json' })
    );

    await expect(
      client._request('GET', 'proj', '/path', {}, null, {}, undefined)
    ).resolves.toEqual({ ok: true });
  });

  it('throws on legacy error response', async () => {
    const client = new Client(baseConfig);
    vi.spyOn(client, '_sign').mockReturnValue('SIGN');
    mockFetch.mockResolvedValue(
      buildResponse(
        JSON.stringify({
          errorCode: 'Missing',
          errorMessage: 'not found'
        }),
        {
          'content-type': 'application/json',
          'x-log-requestid': 'req-1'
        }
      )
    );

    await expect(
      client._request('GET', 'proj', '/path', {}, null, {}, undefined)
    ).rejects.toMatchObject({
      name: 'MissingError',
      code: 'Missing',
      requestid: 'req-1'
    });
  });

  it('throws on nested Error response', async () => {
    const client = new Client(baseConfig);
    vi.spyOn(client, '_sign').mockReturnValue('SIGN');
    mockFetch.mockResolvedValue(
      buildResponse(
        JSON.stringify({
          Error: {
            Message: 'bad',
            Code: 'Bad',
            RequestId: 'req-2'
          }
        }),
        { 'content-type': 'application/json' }
      )
    );

    await expect(
      client._request('GET', 'proj', '/path', {}, null, {}, undefined)
    ).rejects.toMatchObject({
      name: 'BadError',
      code: 'Bad',
      requestid: 'req-2'
    });
  });

  it('supports timeout and abort signal options', async () => {
    const client = new Client(baseConfig);
    vi.spyOn(client, '_sign').mockReturnValue('SIGN');
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      mockFetch.mockImplementation((_, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('aborted'));
            },
            { once: true }
          );
        });
      });

      const requestPromise = client._request('GET', 'proj', '/path', {}, null, {}, {
        timeout: 10,
        signal: controller.signal
      });

      requestPromise.catch(() => undefined);
      await vi.advanceTimersByTimeAsync(20);
      controller.abort();
      await expect(requestPromise).rejects.toThrow(/aborted/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Client API methods', () => {
  it('invokes all public API helpers', async () => {
    const client = new Client(baseConfig);
    const requestSpy = vi.spyOn(client, '_request').mockResolvedValue('ok');

    await client.getProject('proj');
    await client.getProjectLogs('proj', { foo: 'bar' });
    await client.createProject('proj', { description: 'desc' });
    await client.deleteProject('proj');
    await client.listLogStore('proj', { logstoreName: 'ls', offset: 1, size: 10 });
    await client.createLogStore('proj', 'ls', { ttl: 10, shardCount: 2 });
    await client.deleteLogStore('proj', 'ls');
    await client.updateLogStore('proj', 'ls', { ttl: 20, shardCount: 3 });
    await client.getLogStore('proj', 'ls');
    await client.getIndexConfig('proj', 'ls');
    await client.createIndex('proj', 'ls', { ttl: 7 });
    await client.updateIndex('proj', 'ls', { ttl: 8 });
    await client.deleteIndex('proj', 'ls');
    await client.getLogs('proj', 'ls', new Date(0), new Date(1000), { query: '*' });
    await client.getHistograms('proj', 'ls', new Date(0), new Date(1000), { query: '*' });

    expect(requestSpy).toHaveBeenCalled();
  });
});

describe('Client log posting', () => {
  it('throws when logs are not an array', () => {
    const client = new Client(baseConfig);
    expect(() => client.postLogStoreLogs('proj', 'store', { logs: 'bad' as never })).toThrow(
      /data.logs must be array/
    );
  });

  it('builds protobuf payload and calls request', async () => {
    const client = new Client(baseConfig);
    const requestSpy = vi.spyOn(client, '_request').mockResolvedValue('ok');

    await client.postLogStoreLogs(
      'proj',
      'store',
      {
        logs: [
          {
            timestamp: 1,
            content: { level: 'info', message: 'ok' },
            timestampNsPart: 100
          }
        ],
        tags: [{ tag1: 'value' }],
        topic: 'topic',
        source: 'source'
      },
      { timeout: 10 }
    );

    const [, , , , body, headers] = requestSpy.mock.calls[0];
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(headers['content-type']).toBe('application/x-protobuf');
    expect(headers['x-log-bodyrawsize']).toBeGreaterThan(0);
  });

  it('skips non-string topic and source values', async () => {
    const client = new Client(baseConfig);
    const requestSpy = vi.spyOn(client, '_request').mockResolvedValue('ok');

    await client.postLogStoreLogs('proj', 'store', {
      logs: [
        {
          timestamp: 1,
          content: { level: 'info' }
        }
      ],
      topic: 123 as never,
      source: true as never
    });

    expect(requestSpy).toHaveBeenCalled();
  });

  it('throws when log content is invalid', () => {
    const client = new Client(baseConfig);
    expect(() =>
      client.postLogStoreLogs('proj', 'store', {
        logs: [
          {
            timestamp: 1,
            content: { level: 1 as never }
          }
        ]
      })
    ).toThrow();
  });

  it('throws when log payload is invalid', () => {
    const client = new Client(baseConfig);
    expect(() =>
      client.postLogStoreLogs('proj', 'store', {
        logs: [
          {
            content: { level: 'info' }
          } as never
        ]
      })
    ).toThrow();
  });

  it('throws when tag payload is invalid', () => {
    const client = new Client(baseConfig);
    expect(() =>
      client.postLogStoreLogs('proj', 'store', {
        logs: [
          {
            timestamp: 1,
            content: { level: 'info' }
          }
        ],
        tags: [{ tag1: 1 as never }]
      })
    ).toThrow();
  });
});
