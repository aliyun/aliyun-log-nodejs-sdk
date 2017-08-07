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
    result += `${key}:${headers[key].trim()}\n`;
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
    this.project = config.project;
    this.region = config.region;
    this.net = config.net;

    // ak
    this.accessKeyId = config.accessKeyId;
    this.accessKeySecret = config.accessKeySecret;

    // endpoint
    const project = this.project;
    const region = this.region;
    const type = this.net ? `-${this.net}` : '';
    this.endpoint = `http://${project}.${region}${type}.log.aliyuncs.com`;
  }

  async request(verb, path, queries, body, headers, options) {
    var url = `${this.endpoint}${path}`;
    if (queries) {
      url += `?${querystring.stringify(queries)}`
    }

    const mergedHeaders = Object.assign({
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
    const sign = this.sign(verb, path, queries, mergedHeaders);
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

    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: responseBody
    };
  }

  sign(verb, path, queries, headers) {
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

  // Instance methods
  listLogstore(conditions = {}, options) {
    const queries = {
      logstoreName: conditions.logstoreName,
      offset: conditions.offset,
      size: conditions.size
    };

    return this.request('GET', '/logstores', queries, null, {}, options);
  }

  createLogstore(logstoreName, data = {}, options) {
    const body = Buffer.from(JSON.stringify({
      logstoreName,
      ttl: data.ttl,
      shardCount: data.shardCount
    }));

    const headers = {
      'content-type': 'application/json'
    };

    return this.request('POST', '/logstores', {}, body, headers, options);
  }

  deleteLogstore(logstoreName, options) {
    const path = `/logstores/${logstoreName}`;

    return this.request('DELETE', path, {}, null, {}, options);
  }

  updateLogstore(logstoreName, data = {}, options) {
    const body = Buffer.from(JSON.stringify({
      logstoreName,
      ttl: data.ttl,
      shardCount: data.shardCount
    }));

    const headers = {
      'content-type': 'application/json'
    };

    const path = `/logstores/${logstoreName}`;

    return this.request('PUT', path, {}, body, headers, options);
  }

  getLogstore(logstoreName, options) {
    const path = `/logstores/${logstoreName}`;

    return this.request('GET', path, {}, null, {}, options);
  }
}

module.exports = Client;