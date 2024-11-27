# Integration Test

1. Create a test project
2. Create two test stores under that project, one with index configured
  * The first one (without log index configured) will be used to test index CRUD
  * The second one (with log index configured) will be used to test log retrieval
3. Run

  ```
  ACCESS_KEY_ID=<key> ACCESS_KEY_SECRET=<secret> TEST_PROJECT=<project you have created> TEST_STORE=<test store without index> TEST_STORE2=<test store with index> make test
  ```

## Init Client

### Use long live accessKey
```javaScript
const client = new Client({
  accessKeyId: "your_access_key_id",
  accessKeySecret: "your_access_key_secret",
  region: 'cn-hangzhou'
});
```

or use endpoint

```javaScript
const client = new Client({
  accessKeyId: "your_access_key_id",
  accessKeySecret: "your_access_key_secret",
  endpoint: 'cn-hangzhou.log.aliyuncs.com'
});
```

### Use Credentials Provider
The CredentialsProvider offers a more convenient and secure way to obtain credentials from external sources. You can retrieve these credentials from your server or other Alibaba Cloud services, and rotate them on a regular basis.

```javaScript
const yourCredentialsProvider = new YourCredentialsProvider();
const client = new Client({
  credentialsProvider: yourCredentialsProvider,
  region: 'cn-hangzhou'
});
```

The credentialsProvider must be an object with getCredentials function, for example:
```javaScript
class YourCredentialsProvider {
  constructor() {
    this.credentials = {
      accessKeyId: "your_access_key_id",
      accessKeySecret: "your_access_key_secret",
      securityToken: "your_security_token"
    };
  }
  // The method getCredentials is called by client to get credentials for signing and authentication.
  // Caching and refreshing logic is required in your implementation for performance.
  getCredentials() {
    return this.credentials;
  }
}
```

