'use strict';

const expect = require('expect.js');

const Client = require('../lib/client');

describe('client', function () {
  it('sign', function () {
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
});
