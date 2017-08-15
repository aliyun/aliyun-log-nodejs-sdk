# Integration Test

1. Create a test project
2. Create two test stores under that project, one with index configured
  * The first one (without log index configured) will be used to test index CRUD
  * The second one (with log index configured) will be used to test log retrieval
3. Run

  ```
  ACCESS_KEY_ID=<key> ACCESS_KEY_SECRET=<secret> TEST_PROJECT=<project you have created> TEST_STORE=<test store without index> TEST_STORE2=<test store with index> make test
  ```
