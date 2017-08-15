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
      const res1 = await client.createProject(projectName, {
        description: 'test'
      });
      assert.strictEqual(res1, '');
      await sleep(PROJECT_DELAY);  // delay of project creation
      const res2 = await client.getProject(projectName);
      assert.strictEqual(res2.projectName, projectName);
      assert.strictEqual(res2.description, 'test');
    });

    it('deleteProject should ok', async function () {
      const res = await client.deleteProject(projectName);
      assert.strictEqual(res, '');
      try {
        await client.getProject(projectName);
      } catch (ex) {
        const res2 = assert.strictEqual(ex.code, 'ProjectNotExist');
        return;
      }

      assert.fail('The log project should have been deleted');
    });
  });

  describe('log store CRUD', async function () {
    const logstoreName = `test-logs-${Date.now()}`;

    it('createLogstore should ok', async function () {
      const res1 = await client.createLogstore(testProject, logstoreName, {
        ttl: 10,
        shardCount: 2
      });
      assert.strictEqual(res1, '');
      const res2 = await client.getLogstore(testProject, logstoreName);
      assert.strictEqual(res2.logstoreName, logstoreName);
      assert.strictEqual(res2.ttl, 10);
    });

    it('listLogstore should ok', async function () {
      const res = await client.listLogstore(testProject);
      assert.strictEqual(typeof res.count, 'number');
      assert.strictEqual(typeof res.total, 'number');
      assert.strictEqual(Array.isArray(res.logstores), true);
      assert.strictEqual(res.logstores.length > 0, true);
    });

    it('updateLogstore should ok', async function () {
      const res1 = await client.updateLogstore(testProject, logstoreName, {
        ttl: 20,
        shardCount: 2
      });
      assert.strictEqual(res1, '');
      const res2 = await client.getLogstore(testProject, logstoreName);
      assert.strictEqual(res2.logstoreName, logstoreName);
      assert.strictEqual(res2.ttl, 20);
    });

    it('deleteLogstore should ok', async function () {
      const res = await client.deleteLogstore(testProject, logstoreName);
      assert.strictEqual(res, '');
      try {
        const res2 = await client.getLogstore(testProject, logstoreName);
      } catch (ex) {
        assert.strictEqual(ex.code, 'LogStoreNotExist');
        return;
      }

      assert.fail('The log store should have been deleted');
    });
  });

  describe('log index', async function() {
    it('createIndex should ok', async function() {
      const res1 = await client.createIndex(testProject, testStore, index);
      const res2 = await client.getIndexConfig(testProject, testStore);
      // The effective TTL is always the same as the one in the
      // log project config, setting it here does not affect the config
      assert.strictEqual(typeof res2.ttl, "number");
      assert.deepStrictEqual(res2.keys, index.keys);
    });

    it('updateIndex should ok', async function() {
      const res1 = await client.updateIndex(testProject, testStore, index2);
      const res2 = await client.getIndexConfig(testProject, testStore);
      assert.deepStrictEqual(res2.keys, index2.keys);
    });

    it('deleteIndex should ok', async function() {
      const res1 = await client.deleteIndex(testProject, testStore);
      assert.strictEqual(res1, '');
      try {
        const res2 = await client.getIndexConfig(testProject, testStore);
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
      const res = await client.getLogs(testProject, testStore2, from, to);
      assert.strictEqual(Array.isArray(res), true);
    });
  });
});
