# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { getConnectLevelStore, createConnectLevelStore, updateConnectLevelStore } from '@vyb/dataconnect-connect-admin';


// Operation GetConnectLevelStore:  For variables, look at type GetConnectLevelStoreVars in ../index.d.ts
const { data } = await GetConnectLevelStore(dataConnect, getConnectLevelStoreVars);

// Operation CreateConnectLevelStore:  For variables, look at type CreateConnectLevelStoreVars in ../index.d.ts
const { data } = await CreateConnectLevelStore(dataConnect, createConnectLevelStoreVars);

// Operation UpdateConnectLevelStore:  For variables, look at type UpdateConnectLevelStoreVars in ../index.d.ts
const { data } = await UpdateConnectLevelStore(dataConnect, updateConnectLevelStoreVars);


```