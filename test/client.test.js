'use strict';

const expect = require('expect.js');

const Client = require('../lib/client');

// cn-hangzhou.log.aliyuncs.com
const client = new Client({
  accessKeyId: process.env.ACCESS_KEY_ID,
  accessKeySecret: process.env.ACCESS_KEY_SECRET,
  region: 'cn-shanghai',
  project: 'my-fc-log'
});
const logstoreName = `test-logs-${Date.now()}`;

describe('client', function () {
  it('constructor', function () {
    const client = new Client({
      accessKeyId: "bq2sjzesjmo86kq35behupbq",
      accessKeySecret: "4fdO2fTDDnZPU/L7CHNdemB2Nsk=",
      region: 'cn-hangzhou',
      project: 'my-fc-log'
    });
    expect(client.endpoint).to.be('http://my-fc-log.cn-hangzhou.log.aliyuncs.com');
  });

  it('sign GET', function () {
    const client = new Client({
      accessKeyId: "bq2sjzesjmo86kq35behupbq",
      accessKeySecret: "4fdO2fTDDnZPU/L7CHNdemB2Nsk="
    });

    // sign(verb, path, queries, headers) {
    const sign = client.sign('GET', '/logstores', {
      logstoreName: '',
      offset: '0',
      size: '1000'
    }, {
      date: 'Mon, 09 Nov 2015 06:11:16 GMT',
      'x-log-apiversion': '0.6.0',
      'x-log-signaturemethod': 'hmac-sha1'
    });
    expect(sign).to.be('LOG bq2sjzesjmo86kq35behupbq:jEYOTCJs2e88o+y5F4/S5IsnBJQ=');
  });

  it('sign POST', function () {
    const client = new Client({
      accessKeyId: "bq2sjzesjmo86kq35behupbq",
      accessKeySecret: "4fdO2fTDDnZPU/L7CHNdemB2Nsk="
    });

    // sign(verb, path, queries, headers) {
    const sign = client.sign('POST', '/logstores/test-logstore', {}, {
      date: 'Mon, 09 Nov 2015 06:03:03 GMT',
      'x-log-apiversion': '0.6.0',
      'x-log-signaturemethod': 'hmac-sha1',
      'content-md5': '1DD45FA4A70A9300CC9FE7305AF2C494',
      'content-length': '52',
      'content-type': 'application/x-protobuf',
      'x-log-bodyrawsize': '50',
      'x-log-compresstype': 'lz4'
    });
    expect(sign).to.be('LOG bq2sjzesjmo86kq35behupbq:XWLGYHGg2F2hcfxWxMLiNkGki6g=');
  });

  it('listLogstore should ok', async function () {
    var result = await client.listLogstore();
    expect(result.statusCode).to.be(200);
    var body = result.body;
    expect(body).to.have.property('count');
    expect(body).to.have.property('logstores');
    expect(body.logstores.length).to.above(0);
    expect(body).to.have.property('total');
  });

  it('createLogstore should ok', async function () {
    var result = await client.createLogstore(logstoreName, {
      ttl: 10,
      shardCount: 2
    });
    expect(result.statusCode).to.be(200);
    expect(result.body).to.be('');
    var r = await client.getLogstore(logstoreName);
    expect(r.body.logstoreName).to.be(logstoreName);
    expect(r.body.ttl).to.be(10);
  });

  it('updateLogstore should ok', async function () {
    var result = await client.updateLogstore(logstoreName, {
      ttl: 20,
      shardCount: 2
    });
    expect(result.statusCode).to.be(200);
    expect(result.body).to.be('');
    var r = await client.getLogstore(logstoreName);
    expect(r.body.logstoreName).to.be(logstoreName);
    expect(r.body.ttl).to.be(20);
  });

  it('deleteLogstore should ok', async function () {
    var result = await client.deleteLogstore(logstoreName);
    expect(result.statusCode).to.be(200);
    expect(result.body).to.be('');
    try {
      var r = await client.getLogstore(logstoreName);
    } catch (ex) {
      expect(ex.code).to.be('LogStoreNotExist');
      return;
    }

    expect(new Error('should not ok'));
  });
});
