'use strict';

const assert = require('assert');

const Client = require('../lib/client');

const projectName = process.env.TEST_PROJECT;
const accessKeyId = process.env.ACCESS_KEY_ID;
const accessKeySecret = process.env.ACCESS_KEY_SECRET;

const logstoreName = `test-logs-${Date.now()}`;

console.log(projectName, accessKeyId, accessKeySecret);

assert.strictEqual(typeof projectName, 'string',
  'set TEST_PROJECT envrinoment variable before running the integration test');
assert.strictEqual(typeof accessKeyId, 'string',
  'set ACCESS_KEY_ID envrinoment variable before running the integration test');
assert.strictEqual(typeof accessKeySecret, 'string', 
  'set ACCESS_KEY_SECRET envrinoment variable before running ' +
  'the integration test');

// cn-hangzhou.log.aliyuncs.com
const client = new Client({
  accessKeyId,
  accessKeySecret,
  region: 'cn-shanghai'
});

describe('log store CRUD', function () {
  it('createLogstore should ok', async function () {
    var result = await client.createLogstore(projectName, logstoreName, {
      ttl: 10,
      shardCount: 2
    });
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.body, '');
    var r = await client.getLogstore(projectName, logstoreName);
    assert.strictEqual(r.body.logstoreName, logstoreName);
    assert.strictEqual(r.body.ttl, 10);
  });

  it('listLogstore should ok', async function () {
    var result = await client.listLogstore(projectName);
    assert.strictEqual(result.statusCode, 200);
    var body = result.body;
    assert.strictEqual(typeof body.count, 'number');
    assert.strictEqual(typeof body.total, 'number');
    assert.strictEqual(Array.isArray(body.logstores), true);
    assert.strictEqual(body.logstores.length > 0, true);
  });

  it('updateLogstore should ok', async function () {
    var result = await client.updateLogstore(projectName, logstoreName, {
      ttl: 20,
      shardCount: 2
    });
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.body, '');
    var r = await client.getLogstore(projectName, logstoreName);
    assert.strictEqual(r.body.logstoreName, logstoreName);
    assert.strictEqual(r.body.ttl, 20);
  });

  it('deleteLogstore should ok', async function () {
    var result = await client.deleteLogstore(projectName, logstoreName);
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.body, '');
    try {
      var r = await client.getLogstore(projectName, logstoreName);
    } catch (ex) {
      assert.strictEqual(ex.code, 'LogStoreNotExist');
      return;
    }

    assert.fail('The log store should have been deleted');
  });
});
