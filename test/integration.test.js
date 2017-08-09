'use strict';

const assert = require('assert');
const Client = require('../lib/client');

const testProject = process.env.TEST_PROJECT;
const testStore = process.env.TEST_STORE;
const testStore2 = process.env.TEST_STORE2;
const accessKeyId = process.env.ACCESS_KEY_ID;
const accessKeySecret = process.env.ACCESS_KEY_SECRET;
const PROJECT_DELAY = 1500;

// Due to a bug in SLS we need to use a existing project to test log store CRUD
assert.strictEqual(typeof testProject, 'string',
  'set TEST_PROJECT envrinoment variable to an existing log project ' +
  'before running the integration test');
// Due to the delay we must use an existing store to test log index CRUD
assert.strictEqual(typeof testStore, 'string',
  'set TEST_STORE envrinoment variable to an existing log store ' +
  'before running the integration test');
// Due to the delay we must use an existing store with index to test log CRUD
assert.strictEqual(typeof testStore2, 'string',
  'set TEST_STORE2 envrinoment variable to an existing log store ' +
  'with an index before running the integration test');
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

const index = {
  "ttl": 7,
  "keys": {
    "functionName": {
      "caseSensitive": false,
      "token": [ "\n", "\t", ";", ",", "=", ":" ],
      "type": "text"
    }
  },
};

const index2 = {
  "ttl": 7,
  "keys": {
    "serviceName": {
      "caseSensitive": false,
      "token": [ "\n", "\t", ";", ",", "=", ":" ],
      "type": "text"
    }
  },
};

function sleep(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), timeout);
  });
}

describe('Integration test', async function () {
  describe('log project CRUD', async function () {
    const projectName = `test-project-${Date.now()}`;

    it('createProject should ok', async function () {
      var result = await client.createProject(projectName, {
        description: 'test'
      });
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body, '');
      await sleep(PROJECT_DELAY);  // delay of project creation
      var r = await client.getProject(projectName);
      assert.strictEqual(r.body.projectName, projectName);
      assert.strictEqual(r.body.description, 'test');
    });

    it('deleteProject should ok', async function () {
      var result = await client.deleteProject(projectName);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body, '');
      try {
        var r = await client.getProject(projectName);
      } catch (ex) {
        assert.strictEqual(ex.code, 'ProjectNotExist');
        return;
      }

      assert.fail('The log project should have been deleted');
    });
  });

  describe('log store CRUD', async function () {
    const logstoreName = `test-logs-${Date.now()}`;

    it('createLogstore should ok', async function () {
      var result = await client.createLogstore(testProject, logstoreName, {
        ttl: 10,
        shardCount: 2
      });
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body, '');
      var r = await client.getLogstore(testProject, logstoreName);
      assert.strictEqual(r.body.logstoreName, logstoreName);
      assert.strictEqual(r.body.ttl, 10);
    });

    it('listLogstore should ok', async function () {
      var result = await client.listLogstore(testProject);
      assert.strictEqual(result.statusCode, 200);
      var body = result.body;
      assert.strictEqual(typeof body.count, 'number');
      assert.strictEqual(typeof body.total, 'number');
      assert.strictEqual(Array.isArray(body.logstores), true);
      assert.strictEqual(body.logstores.length > 0, true);
    });

    it('updateLogstore should ok', async function () {
      var result = await client.updateLogstore(testProject, logstoreName, {
        ttl: 20,
        shardCount: 2
      });
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body, '');
      var r = await client.getLogstore(testProject, logstoreName);
      assert.strictEqual(r.body.logstoreName, logstoreName);
      assert.strictEqual(r.body.ttl, 20);
    });

    it('deleteLogstore should ok', async function () {
      var result = await client.deleteLogstore(testProject, logstoreName);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body, '');
      try {
        var r = await client.getLogstore(testProject, logstoreName);
      } catch (ex) {
        assert.strictEqual(ex.code, 'LogStoreNotExist');
        return;
      }

      assert.fail('The log store should have been deleted');
    });
  });

  describe('log index', async function() {
    it('createIndex should ok', async function() {
      var result = await client.createIndex(testProject, testStore, index);
      assert.strictEqual(result.statusCode, 200);
      var result = await client.getIndexConfig(testProject, testStore);
      assert.strictEqual(result.statusCode, 200);
      // The effective TTL is always the same as the one in the
      // log project config, setting it here does not affect the config
      assert.strictEqual(typeof result.body.ttl, "number");
      assert.deepStrictEqual(result.body.keys, index.keys);
    });

    it('updateIndex should ok', async function() {
      var result = await client.updateIndex(testProject, testStore, index2);
      assert.strictEqual(result.statusCode, 200);
      var result = await client.getIndexConfig(testProject, testStore);
      assert.strictEqual(result.statusCode, 200);
      assert.deepStrictEqual(result.body.keys, index2.keys);
    });

    it('deleteIndex should ok', async function() {
      var result = await client.deleteIndex(testProject, testStore);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body, '');
      try {
        var r = await client.getIndexConfig(testProject, testStore);
      } catch (ex) {
        assert.strictEqual(ex.code, 'IndexConfigNotExist');
        return;
      }

      assert.fail('The log index should have been deleted');
    });
  });

  describe('getLogs', async function () {
    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();

    it('getLogs should ok', async function () {
      var result = await client.getLogs(testProject, testStore2, from, to);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(Array.isArray(result.body), true);
    });
  });
});
