import assert from 'assert';
import { describe, it } from 'vitest';

import Client from '../src';

const runIntegration = process.env.RUN_INTEGRATION === '1';

if (!runIntegration) {
  describe.skip('Integration test', () => {
    it('set RUN_INTEGRATION=1 to enable', () => {});
  });
} else {
  const testProject = process.env.TEST_PROJECT;
  const testStore = process.env.TEST_STORE;
  const testStore2 = process.env.TEST_STORE2;
  const accessKeyId = process.env.ACCESS_KEY_ID;
  const accessKeySecret = process.env.ACCESS_KEY_SECRET;
  const region = process.env.REGION;
  const PROJECT_DELAY = 1500;

  assert.strictEqual(typeof testProject, 'string',
    'set TEST_PROJECT envrinoment variable to an existing log project ' +
    'before running the integration test');
  assert.strictEqual(typeof testStore, 'string',
    'set TEST_STORE envrinoment variable to an existing log store ' +
    'before running the integration test');
  assert.strictEqual(typeof testStore2, 'string',
    'set TEST_STORE2 envrinoment variable to an existing log store ' +
    'with an index before running the integration test');
  assert.strictEqual(typeof accessKeyId, 'string',
    'set ACCESS_KEY_ID envrinoment variable before running the integration test');
  assert.strictEqual(typeof accessKeySecret, 'string',
    'set ACCESS_KEY_SECRET envrinoment variable before running ' +
    'the integration test');

  const client = new Client({
    accessKeyId,
    accessKeySecret,
    region: region || 'cn-hangzhou'
  });

  const httpsClient = new Client({
    accessKeyId,
    accessKeySecret,
    region: region || 'cn-hangzhou',
    use_https: true
  });

  const index = {
    ttl: 7,
    keys: {
      functionName: {
        caseSensitive: false,
        token: ['\n', '\t', ';', ',', '=', ':'],
        type: 'text'
      }
    }
  };

  const index2 = {
    ttl: 7,
    keys: {
      serviceName: {
        caseSensitive: false,
        token: ['\n', '\t', ';', ',', '=', ':'],
        type: 'text'
      }
    }
  };

  function sleep(timeout: number) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), timeout);
    });
  }

  describe('Integration test', () => {
    describe('log project CRUD', () => {
      const projectName = `test-project-${Date.now()}`;

      it('createProject should ok', async () => {
        const res1 = await client.createProject(projectName, {
          description: 'test'
        });
        assert.strictEqual(res1, '');
        await sleep(PROJECT_DELAY);
        const res2 = await client.getProject(projectName);
        assert.strictEqual((res2 as { projectName: string }).projectName, projectName);
        assert.strictEqual((res2 as { description: string }).description, 'test');
      });

      it('deleteProject should ok', async () => {
        const res = await client.deleteProject(projectName);
        assert.strictEqual(res, '');
        try {
          await client.getProject(projectName);
        } catch (ex) {
          assert.strictEqual((ex as { code: string }).code, 'ProjectNotExist');
          return;
        }

        assert.fail('The log project should have been deleted');
      });
    });

    describe('log store CRUD', () => {
      const logstoreName = `test-logs-${Date.now()}`;

      it('createLogStore should ok', async () => {
        const res1 = await client.createLogStore(testProject as string, logstoreName, {
          ttl: 10,
          shardCount: 2
        });
        assert.strictEqual(res1, '');
        const res2 = await client.getLogStore(testProject as string, logstoreName);
        assert.strictEqual((res2 as { logstoreName: string }).logstoreName, logstoreName);
        assert.strictEqual((res2 as { ttl: number }).ttl, 10);
      });

      it('listLogStore should ok', async () => {
        const res = await client.listLogStore(testProject as string);
        const typed = res as { count: number; total: number; logstores: string[] };
        assert.strictEqual(typeof typed.count, 'number');
        assert.strictEqual(typeof typed.total, 'number');
        assert.strictEqual(Array.isArray(typed.logstores), true);
        assert.strictEqual(typed.logstores.length > 0, true);
      });

      it('updateLogStore should ok', async () => {
        const res1 = await client.updateLogStore(testProject as string, logstoreName, {
          ttl: 20,
          shardCount: 2
        });
        assert.strictEqual(res1, '');
        const res2 = await client.getLogStore(testProject as string, logstoreName);
        assert.strictEqual((res2 as { logstoreName: string }).logstoreName, logstoreName);
        assert.strictEqual((res2 as { ttl: number }).ttl, 20);
      });

      it('deleteLogStore should ok', async () => {
        const res = await client.deleteLogStore(testProject as string, logstoreName);
        assert.strictEqual(res, '');
        try {
          await client.getLogStore(testProject as string, logstoreName);
        } catch (ex) {
          assert.strictEqual((ex as { code: string }).code, 'LogStoreNotExist');
          return;
        }

        assert.fail('The log store should have been deleted');
      });
    });

    describe('log index', () => {
      it('createIndex should ok', async () => {
        await client.createIndex(testProject as string, testStore as string, index);
        const res2 = await client.getIndexConfig(testProject as string, testStore as string);
        assert.strictEqual(typeof (res2 as { ttl: number }).ttl, 'number');
        assert.deepStrictEqual((res2 as { keys: object }).keys, index.keys);
      });

      it('updateIndex should ok', async () => {
        await client.updateIndex(testProject as string, testStore as string, index2);
        const res2 = await client.getIndexConfig(testProject as string, testStore as string);
        assert.deepStrictEqual((res2 as { keys: object }).keys, index2.keys);
      });

      it('deleteIndex should ok', async () => {
        const res1 = await client.deleteIndex(testProject as string, testStore as string);
        assert.strictEqual(res1, '');
        try {
          await client.getIndexConfig(testProject as string, testStore as string);
        } catch (ex) {
          assert.strictEqual((ex as { code: string }).code, 'IndexConfigNotExist');
          return;
        }

        assert.fail('The log index should have been deleted');
      });
    });

    describe('getProjectLogs', () => {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const to = new Date();

      it('getProjectLogs should ok', async () => {
        const res = await client.getProjectLogs(testProject as string, {
          query: `select count(*) as count  from tengine-log where __time__ >'${Math.round(from.getTime() / 1000)}' and __time__ < '${Math.round(to.getTime() / 1000)}' limit 0,20`
        });
        assert.strictEqual(Array.isArray(res), true);
      });
    });

    describe('getLogs', () => {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const to = new Date();

      it('getLogs should ok', async () => {
        const res = await client.getLogs(testProject as string, testStore2 as string, from, to);
        assert.strictEqual(Array.isArray(res), true);
      });
    });

    describe('getHistograms', () => {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const to = new Date();

      it('getLogs should ok', async () => {
        const res = await client.getHistograms(testProject as string, testStore2 as string, from, to);
        assert.strictEqual(Array.isArray(res), true);
      });
    });

    describe('postLogStoreLogs', () => {
      const logGroup = {
        logs: [
          { content: { level: 'debug', message: `test1-${Date.now()}` }, timestamp: Math.floor(Date.now() / 1000) },
          { content: { level: 'info', message: `test2-${Date.now()}` }, timestamp: Math.floor(Date.now() / 1000) }
        ],
        tags: [{ tag1: 'testTag' }]
      };

      it('postLogStoreLogs should ok', async () => {
        const res = await client.postLogStoreLogs(testProject as string, testStore2 as string, logGroup);
        assert.strictEqual(res, '');
      });
    });

    describe('postLogStoreLogsWithTopicSource', () => {
      const logGroup = {
        logs: [
          { content: { level: 'debug', message: `test1-${Date.now()}` }, timestamp: Math.floor(Date.now() / 1000) },
          { content: { level: 'info', message: `test2-${Date.now()}` }, timestamp: Math.floor(Date.now() / 1000) }
        ],
        tags: [{ tag1: 'testTag' }],
        topic: 'testTopic',
        source: 'testSource'
      };

      it('postLogStoreLogsWithTopicSource should ok', async () => {
        const res = await client.postLogStoreLogs(testProject as string, testStore2 as string, logGroup);
        assert.strictEqual(res, '');
      });
    });

    describe('postLogStoreLogsWithTimeNs', () => {
      const logGroup = {
        logs: [
          {
            content: { level: 'debug', message: `test1-${Date.now()}` },
            timestamp: Math.floor(Date.now() / 1000),
            timestampNsPart: Math.floor(Date.now() * 1000 * 1000) % 1000000000
          },
          {
            content: { level: 'info', message: `test2-${Date.now()}` },
            timestamp: Math.floor(Date.now() / 1000),
            timestampNsPart: Math.floor(Date.now() * 1000 * 1000) % 1000000000
          }
        ],
        tags: [{ tag1: 'testTag' }],
        topic: 'ns',
        source: 'ns'
      };

      it('postLogStoreLogsWithTimeNs should ok', async () => {
        const res = await client.postLogStoreLogs(testProject as string, testStore2 as string, logGroup);
        assert.strictEqual(res, '');
      });
    });

    describe('HTTPS protocol support', () => {
      it('listLogStore via HTTPS should ok', async () => {
        const res = await httpsClient.listLogStore(testProject as string);
        const typed = res as { count: number; total: number; logstores: string[] };
        assert.strictEqual(typeof typed.count, 'number');
        assert.strictEqual(typeof typed.total, 'number');
        assert.strictEqual(Array.isArray(typed.logstores), true);
      });
    });

    describe('HTTPS protocol support with endpoint', () => {
      it('listLogStore via HTTPS with endpoint should ok', async () => {
        const clientWithEndpoint = new Client({
          accessKeyId,
          accessKeySecret,
          endpoint: 'https://cn-hangzhou.log.aliyuncs.com'
        });
        const res = await clientWithEndpoint.listLogStore(testProject as string);
        const typed = res as { count: number; total: number; logstores: string[] };
        assert.strictEqual(typeof typed.count, 'number');
        assert.strictEqual(typeof typed.total, 'number');
        assert.strictEqual(Array.isArray(typed.logstores), true);
      });
    });

    describe('HTTP protocol support with endpoint', () => {
      it('listLogStore via HTTP with endpoint should ok', async () => {
        const clientWithEndpoint = new Client({
          accessKeyId,
          accessKeySecret,
          endpoint: 'http://cn-hangzhou.log.aliyuncs.com'
        });
        const res = await clientWithEndpoint.listLogStore(testProject as string);
        const typed = res as { count: number; total: number; logstores: string[] };
        assert.strictEqual(typeof typed.count, 'number');
        assert.strictEqual(typeof typed.total, 'number');
        assert.strictEqual(Array.isArray(typed.logstores), true);
      });
    });
  });
}
