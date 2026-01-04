"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const path_1 = __importDefault(require("path"));
const querystring_1 = __importDefault(require("querystring"));
const debug_1 = __importDefault(require("debug"));
const protobuf = __importStar(require("protobufjs"));
const crypto_utils_1 = require("./crypto-utils");
const debug = (0, debug_1.default)('log:client');
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
const protoPath = path_1.default.join(__dirname, './sls.proto');
let root;
try {
    root = protobuf.loadSync(protoPath);
}
catch (error) {
    if (error.code !== 'ENOENT') {
        throw error;
    }
    root = protobuf.parse(PROTO_CONTENT).root;
}
const LogProto = root.lookupType('sls.Log');
const LogContentProto = root.lookupType('sls.Log.Content');
const LogTagProto = root.lookupType('sls.LogTag');
const LogGroupProto = root.lookupType('sls.LogGroup');
function getCanonicalizedHeaders(headers) {
    const keys = Object.keys(headers);
    const prefixKeys = [];
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
function format(value) {
    if (typeof value === 'undefined') {
        return '';
    }
    return String(value);
}
function getCanonicalizedResource(resourcePath, queries = {}) {
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
    constructor(config) {
        var _a, _b;
        this.region = config.region;
        this.net = config.net;
        this.accessKeyId = config.accessKeyId;
        this.accessKeySecret = config.accessKeySecret;
        this.securityToken = config.securityToken;
        this.credentialsProvider = config.credentialsProvider;
        this.userAgent = (_a = config.userAgent) !== null && _a !== void 0 ? _a : 'aliyun-log-nodejs-sdk';
        if (this.credentialsProvider) {
            if (!Client.isAsyncFunction(this.credentialsProvider.getCredentials)) {
                throw new Error('config.credentialsProvider must be an object with getCredentials async function');
            }
        }
        else {
            this.validateCredentials({
                accessKeyId: this.accessKeyId,
                accessKeySecret: this.accessKeySecret,
                securityToken: this.securityToken
            });
        }
        this.use_https = (_b = config.use_https) !== null && _b !== void 0 ? _b : false;
        if (config.endpoint) {
            if (config.endpoint.startsWith('https://')) {
                this.endpoint = config.endpoint.slice(8);
                this.use_https = true;
            }
            else if (config.endpoint.startsWith('http://')) {
                this.endpoint = config.endpoint.slice(7);
                this.use_https = false;
            }
            else {
                this.endpoint = config.endpoint;
            }
        }
        else {
            const region = this.region;
            const type = this.net ? `-${this.net}` : '';
            this.endpoint = `${region}${type}.log.aliyuncs.com`;
        }
    }
    validateCredentials(credentials) {
        if (!credentials || !credentials.accessKeyId || !credentials.accessKeySecret) {
            throw new Error('Missing credentials or missing accessKeyId/accessKeySecret in credentials.');
        }
        return credentials;
    }
    static isAsyncFunction(fn) {
        return typeof fn === 'function' && fn.constructor.name === 'AsyncFunction';
    }
    async _getCredentials() {
        if (!this.credentialsProvider) {
            return this.validateCredentials({
                accessKeyId: this.accessKeyId,
                accessKeySecret: this.accessKeySecret,
                securityToken: this.securityToken
            });
        }
        return this.validateCredentials(await this.credentialsProvider.getCredentials());
    }
    async _request(verb, projectName, resourcePath, queries, body, headers, options) {
        var _a;
        const prefix = projectName ? `${projectName}.` : '';
        const requestQueries = queries !== null && queries !== void 0 ? queries : {};
        const suffix = Object.keys(requestQueries).length
            ? `?${querystring_1.default.stringify(requestQueries)}`
            : '';
        const scheme = this.use_https ? 'https' : 'http';
        const url = `${scheme}://${prefix}${this.endpoint}${resourcePath}${suffix}`;
        const mergedHeaders = {
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
            (0, assert_1.default)(Buffer.isBuffer(body), 'body must be buffer');
            mergedHeaders['content-md5'] = (0, crypto_utils_1.md5)(body, 'hex').toUpperCase();
            mergedHeaders['content-length'] = body.length;
        }
        const sign = this._sign(verb, resourcePath, requestQueries, mergedHeaders, credentials);
        mergedHeaders.authorization = sign;
        const fetchHeaders = {};
        Object.entries(mergedHeaders).forEach(([key, value]) => {
            fetchHeaders[key] = String(value);
        });
        const { timeout, signal, ...fetchInit } = options !== null && options !== void 0 ? options : {};
        let timeoutId;
        let abortController;
        if (typeof timeout === 'number') {
            abortController = new AbortController();
            timeoutId = setTimeout(() => {
                abortController === null || abortController === void 0 ? void 0 : abortController.abort();
            }, timeout);
        }
        if (signal && abortController) {
            signal.addEventListener('abort', () => {
                abortController === null || abortController === void 0 ? void 0 : abortController.abort();
            }, { once: true });
        }
        const requestInit = {
            ...fetchInit,
            method: verb,
            headers: fetchHeaders,
            body: body !== null && body !== void 0 ? body : undefined,
            signal: (_a = abortController === null || abortController === void 0 ? void 0 : abortController.signal) !== null && _a !== void 0 ? _a : signal
        };
        const response = await fetch(url, requestInit);
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key.toLowerCase()] = value;
        });
        let responseBody = await response.text();
        const contentType = responseHeaders['content-type'] || '';
        if (contentType.startsWith('application/json')) {
            responseBody = JSON.parse(responseBody);
        }
        if (typeof responseBody === 'object' &&
            responseBody !== null &&
            'errorCode' in responseBody &&
            'errorMessage' in responseBody) {
            const typedBody = responseBody;
            const err = new Error(typedBody.errorMessage);
            err.code = typedBody.errorCode;
            err.requestid = responseHeaders['x-log-requestid'];
            err.name = `${typedBody.errorCode}Error`;
            throw err;
        }
        if (typeof responseBody === 'object' &&
            responseBody !== null &&
            'Error' in responseBody) {
            const typedBody = responseBody;
            const err = new Error(typedBody.Error.Message);
            err.code = typedBody.Error.Code;
            err.requestid = typedBody.Error.RequestId;
            err.name = `${typedBody.Error.Code}Error`;
            throw err;
        }
        return responseBody;
    }
    _sign(verb, resourcePath, queries, headers, credentials) {
        const contentMD5 = headers['content-md5'] || '';
        const contentType = headers['content-type'] || '';
        const date = headers.date;
        const canonicalizedHeaders = getCanonicalizedHeaders(headers);
        const canonicalizedResource = getCanonicalizedResource(resourcePath, queries);
        const signString = `${verb}\n${contentMD5}\n${contentType}\n${date}\n${canonicalizedHeaders}${canonicalizedResource}`;
        debug('signString: %s', signString);
        const signature = (0, crypto_utils_1.sha1)(signString, credentials.accessKeySecret, 'base64');
        return `LOG ${credentials.accessKeyId}:${signature}`;
    }
    getProject(projectName, options) {
        return this._request('GET', projectName, '/', {}, null, {}, options);
    }
    getProjectLogs(projectName, data = {}, options) {
        return this._request('GET', projectName, '/logs', data, null, {}, options);
    }
    createProject(projectName, data, options) {
        const body = Buffer.from(JSON.stringify({
            projectName,
            description: data.description
        }));
        const headers = {
            'x-log-bodyrawsize': body.byteLength
        };
        return this._request('POST', undefined, '/', {}, body, headers, options);
    }
    deleteProject(projectName, options) {
        const body = Buffer.from(JSON.stringify({
            projectName
        }));
        const headers = {};
        return this._request('DELETE', projectName, '/', {}, body, headers, options);
    }
    listLogStore(projectName, data = {}, options) {
        const queries = {
            logstoreName: data.logstoreName,
            offset: data.offset,
            size: data.size
        };
        return this._request('GET', projectName, '/logstores', queries, null, {}, options);
    }
    createLogStore(projectName, logstoreName, data = {}, options) {
        const body = Buffer.from(JSON.stringify({
            logstoreName,
            ttl: data.ttl,
            shardCount: data.shardCount
        }));
        return this._request('POST', projectName, '/logstores', {}, body, {}, options);
    }
    deleteLogStore(projectName, logstoreName, options) {
        const resourcePath = `/logstores/${logstoreName}`;
        return this._request('DELETE', projectName, resourcePath, {}, null, {}, options);
    }
    updateLogStore(projectName, logstoreName, data = {}, options) {
        const body = Buffer.from(JSON.stringify({
            logstoreName,
            ttl: data.ttl,
            shardCount: data.shardCount
        }));
        const resourcePath = `/logstores/${logstoreName}`;
        return this._request('PUT', projectName, resourcePath, {}, body, {}, options);
    }
    getLogStore(projectName, logstoreName, options) {
        const resourcePath = `/logstores/${logstoreName}`;
        return this._request('GET', projectName, resourcePath, {}, null, {}, options);
    }
    getIndexConfig(projectName, logstoreName, options) {
        const resourcePath = `/logstores/${logstoreName}/index`;
        return this._request('GET', projectName, resourcePath, {}, null, {}, options);
    }
    createIndex(projectName, logstoreName, index, options) {
        const body = Buffer.from(JSON.stringify(index));
        const headers = {
            'x-log-bodyrawsize': body.byteLength
        };
        const resourcePath = `/logstores/${logstoreName}/index`;
        return this._request('POST', projectName, resourcePath, {}, body, headers, options);
    }
    updateIndex(projectName, logstoreName, index, options) {
        const body = Buffer.from(JSON.stringify(index));
        const headers = {
            'x-log-bodyrawsize': body.byteLength
        };
        const resourcePath = `/logstores/${logstoreName}/index`;
        return this._request('PUT', projectName, resourcePath, {}, body, headers, options);
    }
    deleteIndex(projectName, logstoreName, options) {
        const resourcePath = `/logstores/${logstoreName}/index`;
        return this._request('DELETE', projectName, resourcePath, {}, null, {}, options);
    }
    getLogs(projectName, logstoreName, from, to, data = {}, options) {
        const query = {
            ...data,
            type: 'log',
            from: Math.floor(from.getTime() / 1000),
            to: Math.floor(to.getTime() / 1000)
        };
        const resourcePath = `/logstores/${logstoreName}`;
        return this._request('GET', projectName, resourcePath, query, null, {}, options);
    }
    getHistograms(projectName, logstoreName, from, to, data = {}, options) {
        const query = {
            ...data,
            type: 'histogram',
            from: Math.floor(from.getTime() / 1000),
            to: Math.floor(to.getTime() / 1000)
        };
        const resourcePath = `/logstores/${logstoreName}`;
        return this._request('GET', projectName, resourcePath, query, null, {}, options);
    }
    postLogStoreLogs(projectName, logstoreName, data, options) {
        const resourcePath = `/logstores/${logstoreName}/shards/lb`;
        if (!Array.isArray(data.logs)) {
            throw new Error('data.logs must be array!');
        }
        const payload = {
            Logs: data.logs.map((log) => {
                const logPayload = {
                    Time: log.timestamp,
                    Contents: Object.entries(log.content).map(([Key, Value]) => {
                        const logContentPayload = { Key, Value };
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
            payload.LogTags = data.tags.reduce((tags, tag) => {
                Object.entries(tag).forEach(([Key, Value]) => {
                    const tagPayload = { Key, Value };
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
exports.default = Client;
