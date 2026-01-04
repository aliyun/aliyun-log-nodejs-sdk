import assert from 'assert';
import path from 'path';
import querystring, { ParsedUrlQueryInput } from 'querystring';

import debugFactory from 'debug';
import * as protobuf from 'protobufjs';
import { md5, sha1 } from './crypto-utils';

export interface Credentials {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken?: string;
}

export interface CredentialsProvider {
  getCredentials: () => Promise<Credentials>;
}

export interface ClientConfig extends Partial<Credentials> {
  region?: string;
  net?: string;
  credentialsProvider?: CredentialsProvider;
  userAgent?: string;
  use_https?: boolean;
  endpoint?: string;
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
}

export interface LogContent {
  [key: string]: string;
}

export interface LogInput {
  timestamp: number;
  content: LogContent;
  timestampNsPart?: number;
}

export interface LogGroupInput {
  logs: LogInput[];
  tags?: Array<Record<string, string>>;
  topic?: string;
  source?: string;
}

const debug = debugFactory('log:client');

const PROTO_CONTENT = `package sls;

message Log {
    required uint32 Time = 1;// UNIX Time Format
    message Content {
        required string Key = 1;
        required string Value = 2;
    }  
    repeated Content Contents = 2;
    optional fixed32 TimeNs = 4;
}

message LogTag {
    required string Key = 1;
    required string Value = 2;
}

message LogGroup {
    repeated Log Logs= 1;
    optional string Reserved = 2; // reserved fields
    optional string Topic = 3;
    optional string Source = 4;
    repeated LogTag LogTags = 6;
}

message LogGroupList {
    repeated LogGroup logGroupList = 1;
}
`;

const protoPath = path.join(__dirname, './sls.proto');
let root: protobuf.Root;
try {
  root = protobuf.loadSync(protoPath);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
  root = protobuf.parse(PROTO_CONTENT).root;
}
const LogProto = root.lookupType('sls.Log');
const LogContentProto = root.lookupType('sls.Log.Content');
const LogTagProto = root.lookupType('sls.LogTag');
const LogGroupProto = root.lookupType('sls.LogGroup');

function getCanonicalizedHeaders(headers: Record<string, unknown>): string {
  const keys = Object.keys(headers);
  const prefixKeys: string[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (key.startsWith('x-log-') || key.startsWith('x-acs-')) {
      prefixKeys.push(key);
    }
  }

  prefixKeys.sort();

  let result = '';
  for (let i = 0; i < prefixKeys.length; i += 1) {
    const key = prefixKeys[i];
    result += `${key}:${String(headers[key]).trim()}\n`;
  }

  return result;
}

function format(value: unknown): string {
  if (typeof value === 'undefined') {
    return '';
  }
  return String(value);
}

function getCanonicalizedResource(resourcePath: string, queries: Record<string, unknown> = {}): string {
  let resource = `${resourcePath}`;
  const keys = Object.keys(queries);
  const pairs = new Array(keys.length);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    pairs[i] = `${key}=${format(queries[key])}`;
  }

  pairs.sort();
  const query = pairs.join('&');
  if (query) {
    resource += `?${query}`;
  }

  return resource;
}

class Client {
  region?: string;
  net?: string;
  endpoint: string;
  use_https: boolean;
  userAgent: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  securityToken?: string;
  credentialsProvider?: CredentialsProvider;

  constructor(config: ClientConfig) {
    this.region = config.region;
    this.net = config.net;

    this.accessKeyId = config.accessKeyId;
    this.accessKeySecret = config.accessKeySecret;
    this.securityToken = config.securityToken;
    this.credentialsProvider = config.credentialsProvider;
    this.userAgent = config.userAgent ?? 'aliyun-log-nodejs-sdk';

    if (this.credentialsProvider) {
      if (!Client.isAsyncFunction(this.credentialsProvider.getCredentials)) {
        throw new Error('config.credentialsProvider must be an object with getCredentials async function');
      }
    } else {
      this.validateCredentials({
        accessKeyId: this.accessKeyId,
        accessKeySecret: this.accessKeySecret,
        securityToken: this.securityToken
      });
    }

    this.use_https = config.use_https ?? false;
    if (config.endpoint) {
      if (config.endpoint.startsWith('https://')) {
        this.endpoint = config.endpoint.slice(8);
        this.use_https = true;
      } else if (config.endpoint.startsWith('http://')) {
        this.endpoint = config.endpoint.slice(7);
        this.use_https = false;
      } else {
        this.endpoint = config.endpoint;
      }
    } else {
      const region = this.region;
      const type = this.net ? `-${this.net}` : '';
      this.endpoint = `${region}${type}.log.aliyuncs.com`;
    }
  }

  private validateCredentials(credentials: Partial<Credentials> | undefined): Credentials {
    if (!credentials || !credentials.accessKeyId || !credentials.accessKeySecret) {
      throw new Error('Missing credentials or missing accessKeyId/accessKeySecret in credentials.');
    }
    return credentials as Credentials;
  }

  private static isAsyncFunction(fn: unknown): fn is (...args: unknown[]) => Promise<unknown> {
    return typeof fn === 'function' && fn.constructor.name === 'AsyncFunction';
  }

  async _getCredentials(): Promise<Credentials> {
    if (!this.credentialsProvider) {
      return this.validateCredentials({
        accessKeyId: this.accessKeyId,
        accessKeySecret: this.accessKeySecret,
        securityToken: this.securityToken
      });
    }
    return this.validateCredentials(await this.credentialsProvider.getCredentials());
  }

  async _request(
    verb: string,
    projectName: string | undefined,
    resourcePath: string,
    queries: Record<string, unknown> | undefined,
    body: Buffer | null,
    headers: Record<string, string | number>,
    options?: RequestOptions
  ): Promise<unknown> {
    const prefix = projectName ? `${projectName}.` : '';
    const requestQueries = queries ?? {};
    const suffix = Object.keys(requestQueries).length
      ? `?${querystring.stringify(requestQueries as ParsedUrlQueryInput)}`
      : '';
    const scheme = this.use_https ? 'https' : 'http';
    const url = `${scheme}://${prefix}${this.endpoint}${resourcePath}${suffix}`;

    const mergedHeaders: Record<string, string | number> = {
      'content-type': 'application/json',
      date: new Date().toUTCString(),
      'x-log-apiversion': '0.6.0',
      'x-log-signaturemethod': 'hmac-sha1',
      'user-agent': this.userAgent,
      ...headers
    };

    const credentials = await this._getCredentials();
    if (credentials.securityToken) {
      mergedHeaders['x-acs-security-token'] = credentials.securityToken;
    }

    if (body) {
    assert(Buffer.isBuffer(body), 'body must be buffer');
    mergedHeaders['content-md5'] = md5(body, 'hex').toUpperCase();
    mergedHeaders['content-length'] = body.length;
  }

    const sign = this._sign(verb, resourcePath, requestQueries, mergedHeaders, credentials);
    mergedHeaders.authorization = sign;

    const fetchHeaders: Record<string, string> = {};
    Object.entries(mergedHeaders).forEach(([key, value]) => {
      fetchHeaders[key] = String(value);
    });

    const { timeout, signal, ...fetchInit } = options ?? {};
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let abortController: AbortController | undefined;

    if (typeof timeout === 'number') {
      abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController?.abort();
      }, timeout);
    }

    if (signal && abortController) {
      signal.addEventListener(
        'abort',
        () => {
          abortController?.abort();
        },
        { once: true }
      );
    }

    const requestInit = {
      ...fetchInit,
      method: verb,
      headers: fetchHeaders,
      body: body ?? undefined,
      signal: abortController?.signal ?? signal
    } as RequestInit;

    const response = await fetch(url, requestInit);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    let responseBody: unknown = await response.text();
    const contentType = responseHeaders['content-type'] || '';

    if (contentType.startsWith('application/json')) {
      responseBody = JSON.parse(responseBody as string);
    }

    if (
      typeof responseBody === 'object' &&
      responseBody !== null &&
      'errorCode' in responseBody &&
      'errorMessage' in responseBody
    ) {
      const typedBody = responseBody as { errorCode: string; errorMessage: string };
      const err = new Error(typedBody.errorMessage);
      (err as Error & { code?: string }).code = typedBody.errorCode;
      (err as Error & { requestid?: string }).requestid = responseHeaders['x-log-requestid'];
      err.name = `${typedBody.errorCode}Error`;
      throw err;
    }

    if (
      typeof responseBody === 'object' &&
      responseBody !== null &&
      'Error' in responseBody
    ) {
      const typedBody = responseBody as {
        Error: { Message: string; Code: string; RequestId: string };
      };
      const err = new Error(typedBody.Error.Message);
      (err as Error & { code?: string }).code = typedBody.Error.Code;
      (err as Error & { requestid?: string }).requestid = typedBody.Error.RequestId;
      err.name = `${typedBody.Error.Code}Error`;
      throw err;
    }

    return responseBody;
  }

  _sign(
    verb: string,
    resourcePath: string,
    queries: Record<string, unknown>,
    headers: Record<string, string | number>,
    credentials: Credentials
  ): string {
    const contentMD5 = headers['content-md5'] || '';
    const contentType = headers['content-type'] || '';
    const date = headers.date as string;
    const canonicalizedHeaders = getCanonicalizedHeaders(headers);
    const canonicalizedResource = getCanonicalizedResource(resourcePath, queries);
    const signString = `${verb}\n${contentMD5}\n${contentType}\n${date}\n${canonicalizedHeaders}${canonicalizedResource}`;
    debug('signString: %s', signString);
    const signature = sha1(signString, credentials.accessKeySecret, 'base64');

    return `LOG ${credentials.accessKeyId}:${signature}`;
  }

  getProject(projectName: string, options?: RequestOptions): Promise<unknown> {
    return this._request('GET', projectName, '/', {}, null, {}, options);
  }

  getProjectLogs(projectName: string, data: Record<string, unknown> = {}, options?: RequestOptions): Promise<unknown> {
    return this._request('GET', projectName, '/logs', data, null, {}, options);
  }

  createProject(projectName: string, data: { description?: string }, options?: RequestOptions): Promise<unknown> {
    const body = Buffer.from(
      JSON.stringify({
        projectName,
        description: data.description
      })
    );

    const headers = {
      'x-log-bodyrawsize': body.byteLength
    };

    return this._request('POST', undefined, '/', {}, body, headers, options);
  }

  deleteProject(projectName: string, options?: RequestOptions): Promise<unknown> {
    const body = Buffer.from(
      JSON.stringify({
        projectName
      })
    );

    const headers = {};

    return this._request('DELETE', projectName, '/', {}, body, headers, options);
  }

  listLogStore(projectName: string, data: Record<string, unknown> = {}, options?: RequestOptions): Promise<unknown> {
    const queries = {
      logstoreName: data.logstoreName,
      offset: data.offset,
      size: data.size
    };

    return this._request('GET', projectName, '/logstores', queries, null, {}, options);
  }

  createLogStore(
    projectName: string,
    logstoreName: string,
    data: { ttl?: number; shardCount?: number } = {},
    options?: RequestOptions
  ): Promise<unknown> {
    const body = Buffer.from(
      JSON.stringify({
        logstoreName,
        ttl: data.ttl,
        shardCount: data.shardCount
      })
    );

    return this._request('POST', projectName, '/logstores', {}, body, {}, options);
  }

  deleteLogStore(projectName: string, logstoreName: string, options?: RequestOptions): Promise<unknown> {
    const resourcePath = `/logstores/${logstoreName}`;

    return this._request('DELETE', projectName, resourcePath, {}, null, {}, options);
  }

  updateLogStore(
    projectName: string,
    logstoreName: string,
    data: { ttl?: number; shardCount?: number } = {},
    options?: RequestOptions
  ): Promise<unknown> {
    const body = Buffer.from(
      JSON.stringify({
        logstoreName,
        ttl: data.ttl,
        shardCount: data.shardCount
      })
    );

    const resourcePath = `/logstores/${logstoreName}`;

    return this._request('PUT', projectName, resourcePath, {}, body, {}, options);
  }

  getLogStore(projectName: string, logstoreName: string, options?: RequestOptions): Promise<unknown> {
    const resourcePath = `/logstores/${logstoreName}`;

    return this._request('GET', projectName, resourcePath, {}, null, {}, options);
  }

  getIndexConfig(projectName: string, logstoreName: string, options?: RequestOptions): Promise<unknown> {
    const resourcePath = `/logstores/${logstoreName}/index`;

    return this._request('GET', projectName, resourcePath, {}, null, {}, options);
  }

  createIndex(
    projectName: string,
    logstoreName: string,
    index: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<unknown> {
    const body = Buffer.from(JSON.stringify(index));

    const headers = {
      'x-log-bodyrawsize': body.byteLength
    };
    const resourcePath = `/logstores/${logstoreName}/index`;

    return this._request('POST', projectName, resourcePath, {}, body, headers, options);
  }

  updateIndex(
    projectName: string,
    logstoreName: string,
    index: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<unknown> {
    const body = Buffer.from(JSON.stringify(index));

    const headers = {
      'x-log-bodyrawsize': body.byteLength
    };
    const resourcePath = `/logstores/${logstoreName}/index`;

    return this._request('PUT', projectName, resourcePath, {}, body, headers, options);
  }

  deleteIndex(projectName: string, logstoreName: string, options?: RequestOptions): Promise<unknown> {
    const resourcePath = `/logstores/${logstoreName}/index`;

    return this._request('DELETE', projectName, resourcePath, {}, null, {}, options);
  }

  getLogs(
    projectName: string,
    logstoreName: string,
    from: Date,
    to: Date,
    data: Record<string, unknown> = {},
    options?: RequestOptions
  ): Promise<unknown> {
    const query = {
      ...data,
      type: 'log',
      from: Math.floor(from.getTime() / 1000),
      to: Math.floor(to.getTime() / 1000)
    };
    const resourcePath = `/logstores/${logstoreName}`;
    return this._request('GET', projectName, resourcePath, query, null, {}, options);
  }

  getHistograms(
    projectName: string,
    logstoreName: string,
    from: Date,
    to: Date,
    data: Record<string, unknown> = {},
    options?: RequestOptions
  ): Promise<unknown> {
    const query = {
      ...data,
      type: 'histogram',
      from: Math.floor(from.getTime() / 1000),
      to: Math.floor(to.getTime() / 1000)
    };
    const resourcePath = `/logstores/${logstoreName}`;
    return this._request('GET', projectName, resourcePath, query, null, {}, options);
  }

  postLogStoreLogs(
    projectName: string,
    logstoreName: string,
    data: LogGroupInput,
    options?: RequestOptions
  ): Promise<unknown> {
    const resourcePath = `/logstores/${logstoreName}/shards/lb`;
    if (!Array.isArray(data.logs)) {
      throw new Error('data.logs must be array!');
    }
    const payload: {
      Logs: Array<{ Time: number; Contents: Array<{ Key: string; Value: string }>; TimeNs?: number }>;
      LogTags?: Array<{ Key: string; Value: string }>;
      Topic?: string;
      Source?: string;
    } = {
      Logs: data.logs.map((log) => {
        const logPayload: { Time: number; Contents: Array<{ Key: string; Value: string }>; TimeNs?: number } = {
          Time: log.timestamp,
          Contents: Object.entries(log.content).map(([Key, Value]) => {
            const logContentPayload = { Key, Value } as { Key: string; Value: string };
            const err = LogContentProto.verify(logContentPayload);
            if (err) {
              throw new Error(err);
            }
            return logContentPayload;
          })
        };
        if (log.timestampNsPart !== undefined) {
          logPayload.TimeNs = log.timestampNsPart;
        }
        const err = LogProto.verify(logPayload);
        if (err) {
          throw new Error(err);
        }
        return logPayload;
      })
    };

    if (Array.isArray(data.tags)) {
      payload.LogTags = data.tags.reduce<Array<{ Key: string; Value: string }>>((tags, tag) => {
        Object.entries(tag).forEach(([Key, Value]) => {
          const tagPayload = { Key, Value } as { Key: string; Value: string };
          const err = LogTagProto.verify(tagPayload);
          if (err) {
            throw new Error(err);
          }
          tags.push(tagPayload);
        });
        return tags;
      }, []);
    }
    if (data.topic && typeof data.topic === 'string') {
      payload.Topic = data.topic;
    }
    if (data.source && typeof data.source === 'string') {
      payload.Source = data.source;
    }

    const err = LogGroupProto.verify(payload);
    /* c8 ignore start */
    if (err) {
      throw new Error(err);
    }
    /* c8 ignore end */

    const message = LogGroupProto.create(payload);
    const body = LogGroupProto.encode(message).finish();
    const rawLength = body.byteLength;
    const headers = {
      'x-log-bodyrawsize': rawLength,
      'content-type': 'application/x-protobuf'
    };
    return this._request('POST', projectName, resourcePath, {}, Buffer.from(body), headers, options);
  }
}

export default Client;
