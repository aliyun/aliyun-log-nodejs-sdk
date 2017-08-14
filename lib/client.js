'use strict';

const querystring = require('querystring');
const assert = require('assert');

const httpx = require('httpx');
const kitx = require('kitx');
const debug = require('debug')('log:client');

function getCanonicalizedHeaders(headers) {
  const keys = Object.keys(headers);
  const prefixKeys = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key.startsWith('x-log-') || key.startsWith('x-acs-')) {
      prefixKeys.push(key);
    }
  }

  prefixKeys.sort();

  var result = '';
  for (let i = 0; i < prefixKeys.length; i++) {
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

function getCanonicalizedResource(path, queries) {
  var resource = `${path}`;
  const keys = Object.keys(queries);
  const pairs = new Array(keys.length);
  for (var i = 0; i < keys.length; i++) {
    const key = keys[i];
    pairs[i] = `${key}=${format(queries[key])}`;
  }

  pairs.sort();
  const querystring = pairs.join('&');
  if (querystring) {
    resource += `?${querystring}`;
  }

  return resource;
}

class Client {
  constructor(config) {
    this.region = config.region;
    this.net = config.net;

    // ak
    this.accessKeyId = config.accessKeyId;
    this.accessKeySecret = config.accessKeySecret;

    // endpoint
    const region = this.region;
    const type = this.net ? `-${this.net}` : '';
    this.endpoint = `${region}${type}.log.aliyuncs.com`;
  }

  async _request(verb, projectName, path, queries, body, headers, options) {
    var prefix = projectName ? `${projectName}.` : '';
    var suffix = queries ? `?${querystring.stringify(queries)}` : '';
    var url = `http://${prefix}${this.endpoint}${path}${suffix}`;

    const mergedHeaders = Object.assign({
      'content-type': 'application/json',
      'date': new Date().toGMTString(),
      'x-log-apiversion': '0.6.0',
      'x-log-signaturemethod': 'hmac-sha1'
    }, headers);

    if (body) {
      assert(Buffer.isBuffer(body), 'body must be buffer');
      mergedHeaders['content-md5'] = kitx.md5(body, 'hex').toUpperCase();
      mergedHeaders['content-length'] = body.length;
    }

    // verb, path, queries, headers
    const sign = this._sign(verb, path, queries, mergedHeaders);
    mergedHeaders['authorization'] = sign;

    const response = await httpx.request(url, Object.assign({
      method: verb,
      data: body,
      headers: mergedHeaders
    }, options));

    var responseBody = await httpx.read(response, 'utf8');
    const contentType = response.headers['content-type'] || '';

    if (contentType.startsWith('application/json')) {
      responseBody = JSON.parse(responseBody);
    }

    if (responseBody.errorCode && responseBody.errorMessage) {
      var err = new Error(responseBody.errorMessage);
      err.code = responseBody.errorCode;
      err.requestid = response.headers['x-log-requestid'];
      err.name = `${err.code}Error`;
      throw err;
    }

    if (responseBody.Error) {
      var err = new Error(responseBody.Error.Message);
      err.code = responseBody.Error.Code;
      err.requestid = responseBody.Error.RequestId;
      err.name = `${err.code}Error`;
      throw err;
    }

    return responseBody;
  }

  _sign(verb, path, queries, headers) {
    const contentMD5 = headers['content-md5'] || '';
    const contentType = headers['content-type'] || '';
    const date = headers['date'];
    const canonicalizedHeaders = getCanonicalizedHeaders(headers);
    const canonicalizedResource = getCanonicalizedResource(path, queries);
    const signString = `${verb}\n${contentMD5}\n${contentType}\n` +
      `${date}\n${canonicalizedHeaders}${canonicalizedResource}`;
    debug('signString: %s', signString);
    const signature = kitx.sha1(signString, this.accessKeySecret, 'base64');

    return `LOG ${this.accessKeyId}:${signature}`;
  }

  getProject(projectName, options) {
    return this._request('GET', projectName, '/', {}, null, {}, options);
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

    const headers = {
      // 'x-log-bodyrawsize': body.byteLength
    };

    return this._request('DELETE', projectName, '/', {}, body, headers, options);
  }

  // Instance methods
  listLogstore(projectName, data = {}, options) {
    const queries = {
      logstoreName: data.logstoreName,
      offset: data.offset,
      size: data.size
    };

    return this._request('GET', projectName, '/logstores', queries, null, {}, options);
  }

  createLogstore(projectName, logstoreName, data = {}, options) {
    const body = Buffer.from(JSON.stringify({
      logstoreName,
      ttl: data.ttl,
      shardCount: data.shardCount
    }));

    return this._request('POST', projectName, '/logstores', {}, body, {}, options);
  }

  deleteLogstore(projectName, logstoreName, options) {
    const path = `/logstores/${logstoreName}`;

    return this._request('DELETE', projectName, path, {}, null, {}, options);
  }

  updateLogstore(projectName, logstoreName, data = {}, options) {
    const body = Buffer.from(JSON.stringify({
      logstoreName,
      ttl: data.ttl,
      shardCount: data.shardCount
    }));

    const path = `/logstores/${logstoreName}`;

    return this._request('PUT', projectName, path, {}, body, {}, options);
  }

  getLogstore(projectName, logstoreName, options) {
    const path = `/logstores/${logstoreName}`;

    return this._request('GET', projectName, path, {}, null, {}, options);
  }

  getIndexConfig(projectName, logstoreName, options) {
    const path = `/logstores/${logstoreName}/index`;

    return this._request('GET', projectName, path, {}, null, {}, options);
  }

  createIndex(projectName, logstoreName, index, options) {
    const body = Buffer.from(JSON.stringify(index));

    const headers = {
      'x-log-bodyrawsize': body.byteLength
    };
    const path = `/logstores/${logstoreName}/index`;

    return this._request('POST', projectName, path, {}, body, headers, options);
  }

  updateIndex(projectName, logstoreName, index, options) {
    const body = Buffer.from(JSON.stringify(index));

    const headers = {
      'x-log-bodyrawsize': body.byteLength
    };
    const path = `/logstores/${logstoreName}/index`;

    return this._request('PUT', projectName, path, {}, body, headers, options);
  }

  deleteIndex(projectName, logstoreName, options) {
    const path = `/logstores/${logstoreName}/index`;

    return this._request('DELETE', projectName, path, {}, null, {}, options);
  }

  getLogs(projectName, logstoreName, from, to, data = {}, options) {
    const query = Object.assign({}, data, {
      type: 'log',
      from: from.getTime(),
      to: to.getTime()
    });
    const path = `/logstores/${logstoreName}`;
    return this._request('GET', projectName, path, query, null, {}, options);
  }
}

module.exports = Client;
