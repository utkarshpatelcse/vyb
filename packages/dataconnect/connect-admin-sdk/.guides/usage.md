# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { getGameLevel, createGameLevel, updateGameLevel, listConnectSessionsByTenant, listConnectScoresByTenant, getConnectSessionByKey, getConnectScoreByKey, createConnectSession, updateConnectSession, createConnectScore } from '@vyb/dataconnect-connect-admin';


// Operation GetGameLevel:  For variables, look at type GetGameLevelVars in ../index.d.ts
const { data } = await GetGameLevel(dataConnect, getGameLevelVars);

// Operation CreateGameLevel:  For variables, look at type CreateGameLevelVars in ../index.d.ts
const { data } = await CreateGameLevel(dataConnect, createGameLevelVars);

// Operation UpdateGameLevel:  For variables, look at type UpdateGameLevelVars in ../index.d.ts
const { data } = await UpdateGameLevel(dataConnect, updateGameLevelVars);

// Operation ListConnectSessionsByTenant:  For variables, look at type ListConnectSessionsByTenantVars in ../index.d.ts
const { data } = await ListConnectSessionsByTenant(dataConnect, listConnectSessionsByTenantVars);

// Operation ListConnectScoresByTenant:  For variables, look at type ListConnectScoresByTenantVars in ../index.d.ts
const { data } = await ListConnectScoresByTenant(dataConnect, listConnectScoresByTenantVars);

// Operation GetConnectSessionByKey:  For variables, look at type GetConnectSessionByKeyVars in ../index.d.ts
const { data } = await GetConnectSessionByKey(dataConnect, getConnectSessionByKeyVars);

// Operation GetConnectScoreByKey:  For variables, look at type GetConnectScoreByKeyVars in ../index.d.ts
const { data } = await GetConnectScoreByKey(dataConnect, getConnectScoreByKeyVars);

// Operation CreateConnectSession:  For variables, look at type CreateConnectSessionVars in ../index.d.ts
const { data } = await CreateConnectSession(dataConnect, createConnectSessionVars);

// Operation UpdateConnectSession:  For variables, look at type UpdateConnectSessionVars in ../index.d.ts
const { data } = await UpdateConnectSession(dataConnect, updateConnectSessionVars);

// Operation CreateConnectScore:  For variables, look at type CreateConnectScoreVars in ../index.d.ts
const { data } = await CreateConnectScore(dataConnect, createConnectScoreVars);


```