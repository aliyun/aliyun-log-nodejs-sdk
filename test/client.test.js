'use strict';

const assert = require('assert');

const Client = require('../lib/client');

describe('client unit test', function () {
  it('constructor', function () {
    const client = new Client({
      accessKeyId: "bq2sjzesjmo86kq35behupbq",
      accessKeySecret: "4fdO2fTDDnZPU/L7CHNdemB2Nsk=",
      region: 'cn-hangzhou'
    });
    assert.strictEqual(client.endpoint, 'cn-hangzhou.log.aliyuncs.com');
  });

  it('_sign GET', function () {
    const client = new Client({
      accessKeyId: "bq2sjzesjmo86kq35behupbq",
      accessKeySecret: "4fdO2fTDDnZPU/L7CHNdemB2Nsk="
    });

    // _sign(verb, path, queries, headers) {
    const sign = client._sign('GET', '/logstores', {
      logstoreName: '',
      offset: '0',
      size: '1000'
    }, {
      date: 'Mon, 09 Nov 2015 06:11:16 GMT',
      'x-log-apiversion': '0.6.0',
      'x-log-signaturemethod': 'hmac-sha1'
    });
    assert.strictEqual(sign,
      'LOG bq2sjzesjmo86kq35behupbq:jEYOTCJs2e88o+y5F4/S5IsnBJQ=');
  });

  it('sign POST', function () {
    const client = new Client({
      accessKeyId: "bq2sjzesjmo86kq35behupbq",
      accessKeySecret: "4fdO2fTDDnZPU/L7CHNdemB2Nsk="
    });

    // sign(verb, path, queries, headers) {
    const sign = client._sign('POST', '/logstores/test-logstore', {}, {
      date: 'Mon, 09 Nov 2015 06:03:03 GMT',
      'x-log-apiversion': '0.6.0',
      'x-log-signaturemethod': 'hmac-sha1',
      'content-md5': '1DD45FA4A70A9300CC9FE7305AF2C494',
      'content-length': '52',
      'content-type': 'application/x-protobuf',
      'x-log-bodyrawsize': '50',
      'x-log-compresstype': 'lz4'
    });
    assert.strictEqual(sign,
      'LOG bq2sjzesjmo86kq35behupbq:XWLGYHGg2F2hcfxWxMLiNkGki6g=');
  });
});
