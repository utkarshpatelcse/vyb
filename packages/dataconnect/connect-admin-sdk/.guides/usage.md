# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { getConnectLevelStore, createConnectLevelStore, updateConnectLevelStore, getScribbleWordStore, createScribbleWordStore, updateScribbleWordStore, listConnectSessionsByTenant, listConnectScoresByTenant, getConnectSessionByKey, getConnectScoreByKey } from '@vyb/dataconnect-connect-admin';


// Operation GetConnectLevelStore:  For variables, look at type GetConnectLevelStoreVars in ../index.d.ts
const { data } = await GetConnectLevelStore(dataConnect, getConnectLevelStoreVars);

// Operation CreateConnectLevelStore:  For variables, look at type CreateConnectLevelStoreVars in ../index.d.ts
const { data } = await CreateConnectLevelStore(dataConnect, createConnectLevelStoreVars);

// Operation UpdateConnectLevelStore:  For variables, look at type UpdateConnectLevelStoreVars in ../index.d.ts
const { data } = await UpdateConnectLevelStore(dataConnect, updateConnectLevelStoreVars);

// Operation GetScribbleWordStore:  For variables, look at type GetScribbleWordStoreVars in ../index.d.ts
const { data } = await GetScribbleWordStore(dataConnect, getScribbleWordStoreVars);

// Operation CreateScribbleWordStore:  For variables, look at type CreateScribbleWordStoreVars in ../index.d.ts
const { data } = await CreateScribbleWordStore(dataConnect, createScribbleWordStoreVars);

// Operation UpdateScribbleWordStore:  For variables, look at type UpdateScribbleWordStoreVars in ../index.d.ts
const { data } = await UpdateScribbleWordStore(dataConnect, updateScribbleWordStoreVars);

// Operation ListConnectSessionsByTenant:  For variables, look at type ListConnectSessionsByTenantVars in ../index.d.ts
const { data } = await ListConnectSessionsByTenant(dataConnect, listConnectSessionsByTenantVars);

// Operation ListConnectScoresByTenant:  For variables, look at type ListConnectScoresByTenantVars in ../index.d.ts
const { data } = await ListConnectScoresByTenant(dataConnect, listConnectScoresByTenantVars);

// Operation GetConnectSessionByKey:  For variables, look at type GetConnectSessionByKeyVars in ../index.d.ts
const { data } = await GetConnectSessionByKey(dataConnect, getConnectSessionByKeyVars);

// Operation GetConnectScoreByKey:  For variables, look at type GetConnectScoreByKeyVars in ../index.d.ts
const { data } = await GetConnectScoreByKey(dataConnect, getConnectScoreByKeyVars);


```