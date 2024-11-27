'use strict';

const assert = require('assert');

const Client = require('../');

describe('Unit test', function () {
  it('client constructor should set endpoint correctly', function () {
    const client = new Client({
      accessKeyId: "bq2sjzesjmo86kq35behupbq",
      accessKeySecret: "4fdO2fTDDnZPU/L7CHNdemB2Nsk=",
      region: 'cn-hangzhou'
    });
    assert.strictEqual(client.endpoint, 'cn-hangzhou.log.aliyuncs.com');
  });

  it('client#_sign should sign GET requests correctly', function () {
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
    }, client._getCredentials());
    assert.strictEqual(sign,
      'LOG bq2sjzesjmo86kq35behupbq:jEYOTCJs2e88o+y5F4/S5IsnBJQ=');
  });

  it('client#_sign should sign POST requests correctly', function () {
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
    }, client._getCredentials());
    assert.strictEqual(sign,
      'LOG bq2sjzesjmo86kq35behupbq:XWLGYHGg2F2hcfxWxMLiNkGki6g=');
  });

  it('client#_sign should sign POST requests correctly with STS token', function () {
    const credentials = {
      accessKeyId: 'STS.NSNYgJ2KUoYaEuDrNazRLg2a6',
      accessKeySecret: '56Xqw2THF5vTHTNkGWR6uGRKXToKWMi2eLFjppPNV8RR',
      securityToken: 'CAISiwJ1q6Ft5B2yfSjIr5D7Et3+35R02JuKR1P1lk40dt1giPfK1Dz2IHhLdXNrAuEXs/w0mmBQ7v8TlqZdVplOWU3Da+B364xK7Q75jHw5B0zwv9I+k5SANTW5KXyShb3/AYjQSNfaZY3eCTTtnTNyxr3XbCirW0ffX7SClZ9gaKZ8PGD6F00kYu1bPQx/ssQXGGLMPPK2SH7Qj3HXEVBjt3gX6wo9y9zmnZHNukGH3QOqkbVM9t6rGPX+MZkwZqUYesyuwel7epDG1CNt8BVQ/M909vccpmad5YrMUgQJuEvWa7KNo8caKgJmI7M3AbBFp/WlyKMn5raOydSrkE8cePtSVynP+g0hR0dZ+YgagAEFdb+5rO1e+OZ3kcmPKF5Zh2Sni+vF1qzKA/SElND5koQQV6uvVCweKnfzCPMKjY0OXWmfgtcwOTyJ4ABGsTGnILzBNRD/+Gdqe7wclZrj0aDUkTdFf8k7SudZuO9KOPBe8mS3pJoMs1p67mWA/J4Wn0dottbprb5EQOBRxUC6bw=='
    };
    const client = new Client(credentials);

    // sign(verb, path, queries, headers) {
    const sign = client._sign('POST', '/logstores/test-logstore', {}, {
      date: 'Mon, 09 Nov 2015 06:03:03 GMT',
      'x-log-apiversion': '0.6.0',
      'x-log-signaturemethod': 'hmac-sha1',
      'content-md5': '1DD45FA4A70A9300CC9FE7305AF2C494',
      'content-length': '52',
      'content-type': 'application/x-protobuf',
      'x-log-bodyrawsize': '50',
      'x-log-compresstype': 'lz4',
      'x-acs-security-token': credentials.securityToken,
    }, client._getCredentials());
    assert.strictEqual(sign,
      'LOG STS.NSNYgJ2KUoYaEuDrNazRLg2a6:G3R03b6PwVI+zUaLtqezsBDL/j8=');
  });
});
