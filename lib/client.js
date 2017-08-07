'use strict';

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

function getCanonicalizedResource(path, queries) {
  var resource = `${path}`;
  const keys = Object.keys(queries);
  const pairs = new Array(keys.length);
  for (var i = 0; i < keys.length; i++) {
    const key = keys[i];
    pairs[i] = `${key}=${queries[key]}`;
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
    this.endpoint = `${project}.${region}${type}.log.aliyuncs.com`;
  }

  request(path, queries, body, headers, options) {

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

}

module.exports = Client;
