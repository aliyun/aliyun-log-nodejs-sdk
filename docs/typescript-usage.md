# TypeScript Usage

This package ships `dist/index.d.ts` and a CommonJS entrypoint (`index.js`). It works in TypeScript projects out of the box when `esModuleInterop` is enabled.

## Install

```bash
pnpm add @alicloud/log
```

## Basic Usage (recommended with esModuleInterop)

```ts
import Client from '@alicloud/log';

const client = new Client({
  accessKeyId: process.env.ACCESS_KEY_ID as string,
  accessKeySecret: process.env.ACCESS_KEY_SECRET as string,
  region: 'cn-hangzhou'
});

const project = await client.getProject('my-project');
```

## Without esModuleInterop

```ts
import Client = require('@alicloud/log');

const client = new Client({
  accessKeyId: process.env.ACCESS_KEY_ID as string,
  accessKeySecret: process.env.ACCESS_KEY_SECRET as string,
  region: 'cn-hangzhou'
});
```

## Using credentialsProvider

```ts
import Client from '@alicloud/log';

const client = new Client({
  credentialsProvider: {
    async getCredentials() {
      return {
        accessKeyId: process.env.ACCESS_KEY_ID as string,
        accessKeySecret: process.env.ACCESS_KEY_SECRET as string,
        securityToken: process.env.SECURITY_TOKEN
      };
    }
  }
});

const stores = await client.listLogStore('my-project');
```
