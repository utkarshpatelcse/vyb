# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `connect`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetGameLevel*](#getgamelevel)
  - [*ListConnectSessionsByTenant*](#listconnectsessionsbytenant)
  - [*ListConnectScoresByTenant*](#listconnectscoresbytenant)
  - [*GetConnectSessionByKey*](#getconnectsessionbykey)
  - [*GetConnectScoreByKey*](#getconnectscorebykey)
- [**Mutations**](#mutations)
  - [*CreateGameLevel*](#creategamelevel)
  - [*UpdateGameLevel*](#updategamelevel)
  - [*CreateConnectSession*](#createconnectsession)
  - [*UpdateConnectSession*](#updateconnectsession)
  - [*CreateConnectScore*](#createconnectscore)
  - [*UpdateConnectScore*](#updateconnectscore)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `connect`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@vyb/dataconnect-connect-admin` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@vyb/dataconnect-connect-admin';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@vyb/dataconnect-connect-admin';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `connect` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetGameLevel
You can execute the `GetGameLevel` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
getGameLevel(vars: GetGameLevelVariables, options?: ExecuteQueryOptions): QueryPromise<GetGameLevelData, GetGameLevelVariables>;

interface GetGameLevelRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetGameLevelVariables): QueryRef<GetGameLevelData, GetGameLevelVariables>;
}
export const getGameLevelRef: GetGameLevelRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getGameLevel(dc: DataConnect, vars: GetGameLevelVariables, options?: ExecuteQueryOptions): QueryPromise<GetGameLevelData, GetGameLevelVariables>;

interface GetGameLevelRef {
  ...
  (dc: DataConnect, vars: GetGameLevelVariables): QueryRef<GetGameLevelData, GetGameLevelVariables>;
}
export const getGameLevelRef: GetGameLevelRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getGameLevelRef:
```typescript
const name = getGameLevelRef.operationName;
console.log(name);
```

### Variables
The `GetGameLevel` query requires an argument of type `GetGameLevelVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetGameLevelVariables {
  id: string;
}
```
### Return Type
Recall that executing the `GetGameLevel` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetGameLevelData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetGameLevelData {
  gamesLevel?: {
    id: string;
    payloadJson: string;
    totalLevels: number;
    launchDate?: string | null;
    checksum?: string | null;
    updatedAt: TimestampString;
  } & GameLevel_Key;
}
```
### Using `GetGameLevel`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getGameLevel, GetGameLevelVariables } from '@vyb/dataconnect-connect-admin';

// The `GetGameLevel` query requires an argument of type `GetGameLevelVariables`:
const getGameLevelVars: GetGameLevelVariables = {
  id: ..., 
};

// Call the `getGameLevel()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getGameLevel(getGameLevelVars);
// Variables can be defined inline as well.
const { data } = await getGameLevel({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getGameLevel(dataConnect, getGameLevelVars);

console.log(data.gamesLevel);

// Or, you can use the `Promise` API.
getGameLevel(getGameLevelVars).then((response) => {
  const data = response.data;
  console.log(data.gamesLevel);
});
```

### Using `GetGameLevel`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getGameLevelRef, GetGameLevelVariables } from '@vyb/dataconnect-connect-admin';

// The `GetGameLevel` query requires an argument of type `GetGameLevelVariables`:
const getGameLevelVars: GetGameLevelVariables = {
  id: ..., 
};

// Call the `getGameLevelRef()` function to get a reference to the query.
const ref = getGameLevelRef(getGameLevelVars);
// Variables can be defined inline as well.
const ref = getGameLevelRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getGameLevelRef(dataConnect, getGameLevelVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.gamesLevel);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.gamesLevel);
});
```

## ListConnectSessionsByTenant
You can execute the `ListConnectSessionsByTenant` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
listConnectSessionsByTenant(vars: ListConnectSessionsByTenantVariables, options?: ExecuteQueryOptions): QueryPromise<ListConnectSessionsByTenantData, ListConnectSessionsByTenantVariables>;

interface ListConnectSessionsByTenantRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListConnectSessionsByTenantVariables): QueryRef<ListConnectSessionsByTenantData, ListConnectSessionsByTenantVariables>;
}
export const listConnectSessionsByTenantRef: ListConnectSessionsByTenantRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listConnectSessionsByTenant(dc: DataConnect, vars: ListConnectSessionsByTenantVariables, options?: ExecuteQueryOptions): QueryPromise<ListConnectSessionsByTenantData, ListConnectSessionsByTenantVariables>;

interface ListConnectSessionsByTenantRef {
  ...
  (dc: DataConnect, vars: ListConnectSessionsByTenantVariables): QueryRef<ListConnectSessionsByTenantData, ListConnectSessionsByTenantVariables>;
}
export const listConnectSessionsByTenantRef: ListConnectSessionsByTenantRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listConnectSessionsByTenantRef:
```typescript
const name = listConnectSessionsByTenantRef.operationName;
console.log(name);
```

### Variables
The `ListConnectSessionsByTenant` query requires an argument of type `ListConnectSessionsByTenantVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListConnectSessionsByTenantVariables {
  tenantId: string;
  limit: number;
}
```
### Return Type
Recall that executing the `ListConnectSessionsByTenant` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListConnectSessionsByTenantData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListConnectSessionsByTenantData {
  connectSessions: ({
    id: string;
    sessionKey: string;
    sessionId: string;
    tenantId: string;
    userId: string;
    username: string;
    displayName: string;
    levelId: number;
    dailyIndex: number;
    dailyKey: string;
    startedAt: TimestampString;
    lastHintAt?: TimestampString | null;
    hintsUsed: number;
    completedAt?: TimestampString | null;
    elapsedCentiseconds?: number | null;
    adjustedCentiseconds?: number | null;
  } & ConnectSession_Key)[];
}
```
### Using `ListConnectSessionsByTenant`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listConnectSessionsByTenant, ListConnectSessionsByTenantVariables } from '@vyb/dataconnect-connect-admin';

// The `ListConnectSessionsByTenant` query requires an argument of type `ListConnectSessionsByTenantVariables`:
const listConnectSessionsByTenantVars: ListConnectSessionsByTenantVariables = {
  tenantId: ..., 
  limit: ..., 
};

// Call the `listConnectSessionsByTenant()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listConnectSessionsByTenant(listConnectSessionsByTenantVars);
// Variables can be defined inline as well.
const { data } = await listConnectSessionsByTenant({ tenantId: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listConnectSessionsByTenant(dataConnect, listConnectSessionsByTenantVars);

console.log(data.connectSessions);

// Or, you can use the `Promise` API.
listConnectSessionsByTenant(listConnectSessionsByTenantVars).then((response) => {
  const data = response.data;
  console.log(data.connectSessions);
});
```

### Using `ListConnectSessionsByTenant`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listConnectSessionsByTenantRef, ListConnectSessionsByTenantVariables } from '@vyb/dataconnect-connect-admin';

// The `ListConnectSessionsByTenant` query requires an argument of type `ListConnectSessionsByTenantVariables`:
const listConnectSessionsByTenantVars: ListConnectSessionsByTenantVariables = {
  tenantId: ..., 
  limit: ..., 
};

// Call the `listConnectSessionsByTenantRef()` function to get a reference to the query.
const ref = listConnectSessionsByTenantRef(listConnectSessionsByTenantVars);
// Variables can be defined inline as well.
const ref = listConnectSessionsByTenantRef({ tenantId: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listConnectSessionsByTenantRef(dataConnect, listConnectSessionsByTenantVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.connectSessions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.connectSessions);
});
```

## ListConnectScoresByTenant
You can execute the `ListConnectScoresByTenant` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
listConnectScoresByTenant(vars: ListConnectScoresByTenantVariables, options?: ExecuteQueryOptions): QueryPromise<ListConnectScoresByTenantData, ListConnectScoresByTenantVariables>;

interface ListConnectScoresByTenantRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListConnectScoresByTenantVariables): QueryRef<ListConnectScoresByTenantData, ListConnectScoresByTenantVariables>;
}
export const listConnectScoresByTenantRef: ListConnectScoresByTenantRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listConnectScoresByTenant(dc: DataConnect, vars: ListConnectScoresByTenantVariables, options?: ExecuteQueryOptions): QueryPromise<ListConnectScoresByTenantData, ListConnectScoresByTenantVariables>;

interface ListConnectScoresByTenantRef {
  ...
  (dc: DataConnect, vars: ListConnectScoresByTenantVariables): QueryRef<ListConnectScoresByTenantData, ListConnectScoresByTenantVariables>;
}
export const listConnectScoresByTenantRef: ListConnectScoresByTenantRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listConnectScoresByTenantRef:
```typescript
const name = listConnectScoresByTenantRef.operationName;
console.log(name);
```

### Variables
The `ListConnectScoresByTenant` query requires an argument of type `ListConnectScoresByTenantVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListConnectScoresByTenantVariables {
  tenantId: string;
  limit: number;
}
```
### Return Type
Recall that executing the `ListConnectScoresByTenant` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListConnectScoresByTenantData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListConnectScoresByTenantData {
  connectScores: ({
    id: string;
    scoreKey: string;
    sessionId: string;
    tenantId: string;
    userId: string;
    username: string;
    displayName: string;
    levelId: number;
    dailyIndex: number;
    dailyKey: string;
    startedAt: TimestampString;
    completedAt: TimestampString;
    elapsedCentiseconds: number;
    hintsUsed: number;
    adjustedCentiseconds: number;
  } & ConnectScore_Key)[];
}
```
### Using `ListConnectScoresByTenant`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listConnectScoresByTenant, ListConnectScoresByTenantVariables } from '@vyb/dataconnect-connect-admin';

// The `ListConnectScoresByTenant` query requires an argument of type `ListConnectScoresByTenantVariables`:
const listConnectScoresByTenantVars: ListConnectScoresByTenantVariables = {
  tenantId: ..., 
  limit: ..., 
};

// Call the `listConnectScoresByTenant()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listConnectScoresByTenant(listConnectScoresByTenantVars);
// Variables can be defined inline as well.
const { data } = await listConnectScoresByTenant({ tenantId: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listConnectScoresByTenant(dataConnect, listConnectScoresByTenantVars);

console.log(data.connectScores);

// Or, you can use the `Promise` API.
listConnectScoresByTenant(listConnectScoresByTenantVars).then((response) => {
  const data = response.data;
  console.log(data.connectScores);
});
```

### Using `ListConnectScoresByTenant`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listConnectScoresByTenantRef, ListConnectScoresByTenantVariables } from '@vyb/dataconnect-connect-admin';

// The `ListConnectScoresByTenant` query requires an argument of type `ListConnectScoresByTenantVariables`:
const listConnectScoresByTenantVars: ListConnectScoresByTenantVariables = {
  tenantId: ..., 
  limit: ..., 
};

// Call the `listConnectScoresByTenantRef()` function to get a reference to the query.
const ref = listConnectScoresByTenantRef(listConnectScoresByTenantVars);
// Variables can be defined inline as well.
const ref = listConnectScoresByTenantRef({ tenantId: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listConnectScoresByTenantRef(dataConnect, listConnectScoresByTenantVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.connectScores);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.connectScores);
});
```

## GetConnectSessionByKey
You can execute the `GetConnectSessionByKey` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
getConnectSessionByKey(vars: GetConnectSessionByKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectSessionByKeyData, GetConnectSessionByKeyVariables>;

interface GetConnectSessionByKeyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetConnectSessionByKeyVariables): QueryRef<GetConnectSessionByKeyData, GetConnectSessionByKeyVariables>;
}
export const getConnectSessionByKeyRef: GetConnectSessionByKeyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getConnectSessionByKey(dc: DataConnect, vars: GetConnectSessionByKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectSessionByKeyData, GetConnectSessionByKeyVariables>;

interface GetConnectSessionByKeyRef {
  ...
  (dc: DataConnect, vars: GetConnectSessionByKeyVariables): QueryRef<GetConnectSessionByKeyData, GetConnectSessionByKeyVariables>;
}
export const getConnectSessionByKeyRef: GetConnectSessionByKeyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getConnectSessionByKeyRef:
```typescript
const name = getConnectSessionByKeyRef.operationName;
console.log(name);
```

### Variables
The `GetConnectSessionByKey` query requires an argument of type `GetConnectSessionByKeyVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetConnectSessionByKeyVariables {
  sessionKey: string;
}
```
### Return Type
Recall that executing the `GetConnectSessionByKey` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetConnectSessionByKeyData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetConnectSessionByKeyData {
  connectSessions: ({
    id: string;
  } & ConnectSession_Key)[];
}
```
### Using `GetConnectSessionByKey`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getConnectSessionByKey, GetConnectSessionByKeyVariables } from '@vyb/dataconnect-connect-admin';

// The `GetConnectSessionByKey` query requires an argument of type `GetConnectSessionByKeyVariables`:
const getConnectSessionByKeyVars: GetConnectSessionByKeyVariables = {
  sessionKey: ..., 
};

// Call the `getConnectSessionByKey()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getConnectSessionByKey(getConnectSessionByKeyVars);
// Variables can be defined inline as well.
const { data } = await getConnectSessionByKey({ sessionKey: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getConnectSessionByKey(dataConnect, getConnectSessionByKeyVars);

console.log(data.connectSessions);

// Or, you can use the `Promise` API.
getConnectSessionByKey(getConnectSessionByKeyVars).then((response) => {
  const data = response.data;
  console.log(data.connectSessions);
});
```

### Using `GetConnectSessionByKey`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getConnectSessionByKeyRef, GetConnectSessionByKeyVariables } from '@vyb/dataconnect-connect-admin';

// The `GetConnectSessionByKey` query requires an argument of type `GetConnectSessionByKeyVariables`:
const getConnectSessionByKeyVars: GetConnectSessionByKeyVariables = {
  sessionKey: ..., 
};

// Call the `getConnectSessionByKeyRef()` function to get a reference to the query.
const ref = getConnectSessionByKeyRef(getConnectSessionByKeyVars);
// Variables can be defined inline as well.
const ref = getConnectSessionByKeyRef({ sessionKey: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getConnectSessionByKeyRef(dataConnect, getConnectSessionByKeyVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.connectSessions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.connectSessions);
});
```

## GetConnectScoreByKey
You can execute the `GetConnectScoreByKey` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
getConnectScoreByKey(vars: GetConnectScoreByKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectScoreByKeyData, GetConnectScoreByKeyVariables>;

interface GetConnectScoreByKeyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetConnectScoreByKeyVariables): QueryRef<GetConnectScoreByKeyData, GetConnectScoreByKeyVariables>;
}
export const getConnectScoreByKeyRef: GetConnectScoreByKeyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getConnectScoreByKey(dc: DataConnect, vars: GetConnectScoreByKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectScoreByKeyData, GetConnectScoreByKeyVariables>;

interface GetConnectScoreByKeyRef {
  ...
  (dc: DataConnect, vars: GetConnectScoreByKeyVariables): QueryRef<GetConnectScoreByKeyData, GetConnectScoreByKeyVariables>;
}
export const getConnectScoreByKeyRef: GetConnectScoreByKeyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getConnectScoreByKeyRef:
```typescript
const name = getConnectScoreByKeyRef.operationName;
console.log(name);
```

### Variables
The `GetConnectScoreByKey` query requires an argument of type `GetConnectScoreByKeyVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetConnectScoreByKeyVariables {
  scoreKey: string;
}
```
### Return Type
Recall that executing the `GetConnectScoreByKey` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetConnectScoreByKeyData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetConnectScoreByKeyData {
  connectScores: ({
    id: string;
    adjustedCentiseconds: number;
    elapsedCentiseconds: number;
    hintsUsed: number;
    completedAt: TimestampString;
  } & ConnectScore_Key)[];
}
```
### Using `GetConnectScoreByKey`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getConnectScoreByKey, GetConnectScoreByKeyVariables } from '@vyb/dataconnect-connect-admin';

// The `GetConnectScoreByKey` query requires an argument of type `GetConnectScoreByKeyVariables`:
const getConnectScoreByKeyVars: GetConnectScoreByKeyVariables = {
  scoreKey: ..., 
};

// Call the `getConnectScoreByKey()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getConnectScoreByKey(getConnectScoreByKeyVars);
// Variables can be defined inline as well.
const { data } = await getConnectScoreByKey({ scoreKey: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getConnectScoreByKey(dataConnect, getConnectScoreByKeyVars);

console.log(data.connectScores);

// Or, you can use the `Promise` API.
getConnectScoreByKey(getConnectScoreByKeyVars).then((response) => {
  const data = response.data;
  console.log(data.connectScores);
});
```

### Using `GetConnectScoreByKey`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getConnectScoreByKeyRef, GetConnectScoreByKeyVariables } from '@vyb/dataconnect-connect-admin';

// The `GetConnectScoreByKey` query requires an argument of type `GetConnectScoreByKeyVariables`:
const getConnectScoreByKeyVars: GetConnectScoreByKeyVariables = {
  scoreKey: ..., 
};

// Call the `getConnectScoreByKeyRef()` function to get a reference to the query.
const ref = getConnectScoreByKeyRef(getConnectScoreByKeyVars);
// Variables can be defined inline as well.
const ref = getConnectScoreByKeyRef({ scoreKey: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getConnectScoreByKeyRef(dataConnect, getConnectScoreByKeyVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.connectScores);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.connectScores);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `connect` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateGameLevel
You can execute the `CreateGameLevel` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
createGameLevel(vars: CreateGameLevelVariables): MutationPromise<CreateGameLevelData, CreateGameLevelVariables>;

interface CreateGameLevelRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGameLevelVariables): MutationRef<CreateGameLevelData, CreateGameLevelVariables>;
}
export const createGameLevelRef: CreateGameLevelRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createGameLevel(dc: DataConnect, vars: CreateGameLevelVariables): MutationPromise<CreateGameLevelData, CreateGameLevelVariables>;

interface CreateGameLevelRef {
  ...
  (dc: DataConnect, vars: CreateGameLevelVariables): MutationRef<CreateGameLevelData, CreateGameLevelVariables>;
}
export const createGameLevelRef: CreateGameLevelRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createGameLevelRef:
```typescript
const name = createGameLevelRef.operationName;
console.log(name);
```

### Variables
The `CreateGameLevel` mutation requires an argument of type `CreateGameLevelVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateGameLevelVariables {
  id: string;
  payloadJson: string;
  totalLevels: number;
  launchDate?: string | null;
  checksum?: string | null;
}
```
### Return Type
Recall that executing the `CreateGameLevel` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateGameLevelData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateGameLevelData {
  gamesLevel_insert: GameLevel_Key;
}
```
### Using `CreateGameLevel`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createGameLevel, CreateGameLevelVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateGameLevel` mutation requires an argument of type `CreateGameLevelVariables`:
const createGameLevelVars: CreateGameLevelVariables = {
  id: ..., 
  payloadJson: ..., 
  totalLevels: ..., 
  launchDate: ..., // optional
  checksum: ..., // optional
};

// Call the `createGameLevel()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createGameLevel(createGameLevelVars);
// Variables can be defined inline as well.
const { data } = await createGameLevel({ id: ..., payloadJson: ..., totalLevels: ..., launchDate: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createGameLevel(dataConnect, createGameLevelVars);

console.log(data.gamesLevel_insert);

// Or, you can use the `Promise` API.
createGameLevel(createGameLevelVars).then((response) => {
  const data = response.data;
  console.log(data.gamesLevel_insert);
});
```

### Using `CreateGameLevel`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createGameLevelRef, CreateGameLevelVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateGameLevel` mutation requires an argument of type `CreateGameLevelVariables`:
const createGameLevelVars: CreateGameLevelVariables = {
  id: ..., 
  payloadJson: ..., 
  totalLevels: ..., 
  launchDate: ..., // optional
  checksum: ..., // optional
};

// Call the `createGameLevelRef()` function to get a reference to the mutation.
const ref = createGameLevelRef(createGameLevelVars);
// Variables can be defined inline as well.
const ref = createGameLevelRef({ id: ..., payloadJson: ..., totalLevels: ..., launchDate: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createGameLevelRef(dataConnect, createGameLevelVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.gamesLevel_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.gamesLevel_insert);
});
```

## UpdateGameLevel
You can execute the `UpdateGameLevel` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
updateGameLevel(vars: UpdateGameLevelVariables): MutationPromise<UpdateGameLevelData, UpdateGameLevelVariables>;

interface UpdateGameLevelRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGameLevelVariables): MutationRef<UpdateGameLevelData, UpdateGameLevelVariables>;
}
export const updateGameLevelRef: UpdateGameLevelRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateGameLevel(dc: DataConnect, vars: UpdateGameLevelVariables): MutationPromise<UpdateGameLevelData, UpdateGameLevelVariables>;

interface UpdateGameLevelRef {
  ...
  (dc: DataConnect, vars: UpdateGameLevelVariables): MutationRef<UpdateGameLevelData, UpdateGameLevelVariables>;
}
export const updateGameLevelRef: UpdateGameLevelRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateGameLevelRef:
```typescript
const name = updateGameLevelRef.operationName;
console.log(name);
```

### Variables
The `UpdateGameLevel` mutation requires an argument of type `UpdateGameLevelVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateGameLevelVariables {
  id: string;
  payloadJson: string;
  totalLevels: number;
  launchDate?: string | null;
  checksum?: string | null;
}
```
### Return Type
Recall that executing the `UpdateGameLevel` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateGameLevelData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateGameLevelData {
  gamesLevel_update?: GameLevel_Key | null;
}
```
### Using `UpdateGameLevel`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateGameLevel, UpdateGameLevelVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateGameLevel` mutation requires an argument of type `UpdateGameLevelVariables`:
const updateGameLevelVars: UpdateGameLevelVariables = {
  id: ..., 
  payloadJson: ..., 
  totalLevels: ..., 
  launchDate: ..., // optional
  checksum: ..., // optional
};

// Call the `updateGameLevel()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateGameLevel(updateGameLevelVars);
// Variables can be defined inline as well.
const { data } = await updateGameLevel({ id: ..., payloadJson: ..., totalLevels: ..., launchDate: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateGameLevel(dataConnect, updateGameLevelVars);

console.log(data.gamesLevel_update);

// Or, you can use the `Promise` API.
updateGameLevel(updateGameLevelVars).then((response) => {
  const data = response.data;
  console.log(data.gamesLevel_update);
});
```

### Using `UpdateGameLevel`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateGameLevelRef, UpdateGameLevelVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateGameLevel` mutation requires an argument of type `UpdateGameLevelVariables`:
const updateGameLevelVars: UpdateGameLevelVariables = {
  id: ..., 
  payloadJson: ..., 
  totalLevels: ..., 
  launchDate: ..., // optional
  checksum: ..., // optional
};

// Call the `updateGameLevelRef()` function to get a reference to the mutation.
const ref = updateGameLevelRef(updateGameLevelVars);
// Variables can be defined inline as well.
const ref = updateGameLevelRef({ id: ..., payloadJson: ..., totalLevels: ..., launchDate: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateGameLevelRef(dataConnect, updateGameLevelVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.gamesLevel_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.gamesLevel_update);
});
```

## CreateConnectSession
You can execute the `CreateConnectSession` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
createConnectSession(vars: CreateConnectSessionVariables): MutationPromise<CreateConnectSessionData, CreateConnectSessionVariables>;

interface CreateConnectSessionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateConnectSessionVariables): MutationRef<CreateConnectSessionData, CreateConnectSessionVariables>;
}
export const createConnectSessionRef: CreateConnectSessionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createConnectSession(dc: DataConnect, vars: CreateConnectSessionVariables): MutationPromise<CreateConnectSessionData, CreateConnectSessionVariables>;

interface CreateConnectSessionRef {
  ...
  (dc: DataConnect, vars: CreateConnectSessionVariables): MutationRef<CreateConnectSessionData, CreateConnectSessionVariables>;
}
export const createConnectSessionRef: CreateConnectSessionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createConnectSessionRef:
```typescript
const name = createConnectSessionRef.operationName;
console.log(name);
```

### Variables
The `CreateConnectSession` mutation requires an argument of type `CreateConnectSessionVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateConnectSessionVariables {
  id: string;
  sessionKey: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  username: string;
  displayName: string;
  levelId: number;
  dailyIndex: number;
  dailyKey: string;
  startedAt: TimestampString;
  lastHintAt?: TimestampString | null;
  hintsUsed: number;
  completedAt?: TimestampString | null;
  elapsedCentiseconds?: number | null;
  adjustedCentiseconds?: number | null;
}
```
### Return Type
Recall that executing the `CreateConnectSession` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateConnectSessionData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateConnectSessionData {
  connectSession_insert: ConnectSession_Key;
}
```
### Using `CreateConnectSession`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createConnectSession, CreateConnectSessionVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateConnectSession` mutation requires an argument of type `CreateConnectSessionVariables`:
const createConnectSessionVars: CreateConnectSessionVariables = {
  id: ..., 
  sessionKey: ..., 
  sessionId: ..., 
  tenantId: ..., 
  userId: ..., 
  username: ..., 
  displayName: ..., 
  levelId: ..., 
  dailyIndex: ..., 
  dailyKey: ..., 
  startedAt: ..., 
  lastHintAt: ..., // optional
  hintsUsed: ..., 
  completedAt: ..., // optional
  elapsedCentiseconds: ..., // optional
  adjustedCentiseconds: ..., // optional
};

// Call the `createConnectSession()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createConnectSession(createConnectSessionVars);
// Variables can be defined inline as well.
const { data } = await createConnectSession({ id: ..., sessionKey: ..., sessionId: ..., tenantId: ..., userId: ..., username: ..., displayName: ..., levelId: ..., dailyIndex: ..., dailyKey: ..., startedAt: ..., lastHintAt: ..., hintsUsed: ..., completedAt: ..., elapsedCentiseconds: ..., adjustedCentiseconds: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createConnectSession(dataConnect, createConnectSessionVars);

console.log(data.connectSession_insert);

// Or, you can use the `Promise` API.
createConnectSession(createConnectSessionVars).then((response) => {
  const data = response.data;
  console.log(data.connectSession_insert);
});
```

### Using `CreateConnectSession`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createConnectSessionRef, CreateConnectSessionVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateConnectSession` mutation requires an argument of type `CreateConnectSessionVariables`:
const createConnectSessionVars: CreateConnectSessionVariables = {
  id: ..., 
  sessionKey: ..., 
  sessionId: ..., 
  tenantId: ..., 
  userId: ..., 
  username: ..., 
  displayName: ..., 
  levelId: ..., 
  dailyIndex: ..., 
  dailyKey: ..., 
  startedAt: ..., 
  lastHintAt: ..., // optional
  hintsUsed: ..., 
  completedAt: ..., // optional
  elapsedCentiseconds: ..., // optional
  adjustedCentiseconds: ..., // optional
};

// Call the `createConnectSessionRef()` function to get a reference to the mutation.
const ref = createConnectSessionRef(createConnectSessionVars);
// Variables can be defined inline as well.
const ref = createConnectSessionRef({ id: ..., sessionKey: ..., sessionId: ..., tenantId: ..., userId: ..., username: ..., displayName: ..., levelId: ..., dailyIndex: ..., dailyKey: ..., startedAt: ..., lastHintAt: ..., hintsUsed: ..., completedAt: ..., elapsedCentiseconds: ..., adjustedCentiseconds: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createConnectSessionRef(dataConnect, createConnectSessionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.connectSession_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.connectSession_insert);
});
```

## UpdateConnectSession
You can execute the `UpdateConnectSession` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
updateConnectSession(vars: UpdateConnectSessionVariables): MutationPromise<UpdateConnectSessionData, UpdateConnectSessionVariables>;

interface UpdateConnectSessionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateConnectSessionVariables): MutationRef<UpdateConnectSessionData, UpdateConnectSessionVariables>;
}
export const updateConnectSessionRef: UpdateConnectSessionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateConnectSession(dc: DataConnect, vars: UpdateConnectSessionVariables): MutationPromise<UpdateConnectSessionData, UpdateConnectSessionVariables>;

interface UpdateConnectSessionRef {
  ...
  (dc: DataConnect, vars: UpdateConnectSessionVariables): MutationRef<UpdateConnectSessionData, UpdateConnectSessionVariables>;
}
export const updateConnectSessionRef: UpdateConnectSessionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateConnectSessionRef:
```typescript
const name = updateConnectSessionRef.operationName;
console.log(name);
```

### Variables
The `UpdateConnectSession` mutation requires an argument of type `UpdateConnectSessionVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateConnectSessionVariables {
  id: string;
  sessionId: string;
  username: string;
  displayName: string;
  lastHintAt?: TimestampString | null;
  hintsUsed: number;
  completedAt?: TimestampString | null;
  elapsedCentiseconds?: number | null;
  adjustedCentiseconds?: number | null;
}
```
### Return Type
Recall that executing the `UpdateConnectSession` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateConnectSessionData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateConnectSessionData {
  connectSession_update?: ConnectSession_Key | null;
}
```
### Using `UpdateConnectSession`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateConnectSession, UpdateConnectSessionVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateConnectSession` mutation requires an argument of type `UpdateConnectSessionVariables`:
const updateConnectSessionVars: UpdateConnectSessionVariables = {
  id: ..., 
  sessionId: ..., 
  username: ..., 
  displayName: ..., 
  lastHintAt: ..., // optional
  hintsUsed: ..., 
  completedAt: ..., // optional
  elapsedCentiseconds: ..., // optional
  adjustedCentiseconds: ..., // optional
};

// Call the `updateConnectSession()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateConnectSession(updateConnectSessionVars);
// Variables can be defined inline as well.
const { data } = await updateConnectSession({ id: ..., sessionId: ..., username: ..., displayName: ..., lastHintAt: ..., hintsUsed: ..., completedAt: ..., elapsedCentiseconds: ..., adjustedCentiseconds: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateConnectSession(dataConnect, updateConnectSessionVars);

console.log(data.connectSession_update);

// Or, you can use the `Promise` API.
updateConnectSession(updateConnectSessionVars).then((response) => {
  const data = response.data;
  console.log(data.connectSession_update);
});
```

### Using `UpdateConnectSession`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateConnectSessionRef, UpdateConnectSessionVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateConnectSession` mutation requires an argument of type `UpdateConnectSessionVariables`:
const updateConnectSessionVars: UpdateConnectSessionVariables = {
  id: ..., 
  sessionId: ..., 
  username: ..., 
  displayName: ..., 
  lastHintAt: ..., // optional
  hintsUsed: ..., 
  completedAt: ..., // optional
  elapsedCentiseconds: ..., // optional
  adjustedCentiseconds: ..., // optional
};

// Call the `updateConnectSessionRef()` function to get a reference to the mutation.
const ref = updateConnectSessionRef(updateConnectSessionVars);
// Variables can be defined inline as well.
const ref = updateConnectSessionRef({ id: ..., sessionId: ..., username: ..., displayName: ..., lastHintAt: ..., hintsUsed: ..., completedAt: ..., elapsedCentiseconds: ..., adjustedCentiseconds: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateConnectSessionRef(dataConnect, updateConnectSessionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.connectSession_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.connectSession_update);
});
```

## CreateConnectScore
You can execute the `CreateConnectScore` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
createConnectScore(vars: CreateConnectScoreVariables): MutationPromise<CreateConnectScoreData, CreateConnectScoreVariables>;

interface CreateConnectScoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateConnectScoreVariables): MutationRef<CreateConnectScoreData, CreateConnectScoreVariables>;
}
export const createConnectScoreRef: CreateConnectScoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createConnectScore(dc: DataConnect, vars: CreateConnectScoreVariables): MutationPromise<CreateConnectScoreData, CreateConnectScoreVariables>;

interface CreateConnectScoreRef {
  ...
  (dc: DataConnect, vars: CreateConnectScoreVariables): MutationRef<CreateConnectScoreData, CreateConnectScoreVariables>;
}
export const createConnectScoreRef: CreateConnectScoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createConnectScoreRef:
```typescript
const name = createConnectScoreRef.operationName;
console.log(name);
```

### Variables
The `CreateConnectScore` mutation requires an argument of type `CreateConnectScoreVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateConnectScoreVariables {
  id: string;
  scoreKey: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  username: string;
  displayName: string;
  levelId: number;
  dailyIndex: number;
  dailyKey: string;
  startedAt: TimestampString;
  completedAt: TimestampString;
  elapsedCentiseconds: number;
  hintsUsed: number;
  adjustedCentiseconds: number;
}
```
### Return Type
Recall that executing the `CreateConnectScore` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateConnectScoreData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateConnectScoreData {
  connectScore_insert: ConnectScore_Key;
}
```
### Using `CreateConnectScore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createConnectScore, CreateConnectScoreVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateConnectScore` mutation requires an argument of type `CreateConnectScoreVariables`:
const createConnectScoreVars: CreateConnectScoreVariables = {
  id: ..., 
  scoreKey: ..., 
  sessionId: ..., 
  tenantId: ..., 
  userId: ..., 
  username: ..., 
  displayName: ..., 
  levelId: ..., 
  dailyIndex: ..., 
  dailyKey: ..., 
  startedAt: ..., 
  completedAt: ..., 
  elapsedCentiseconds: ..., 
  hintsUsed: ..., 
  adjustedCentiseconds: ..., 
};

// Call the `createConnectScore()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createConnectScore(createConnectScoreVars);
// Variables can be defined inline as well.
const { data } = await createConnectScore({ id: ..., scoreKey: ..., sessionId: ..., tenantId: ..., userId: ..., username: ..., displayName: ..., levelId: ..., dailyIndex: ..., dailyKey: ..., startedAt: ..., completedAt: ..., elapsedCentiseconds: ..., hintsUsed: ..., adjustedCentiseconds: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createConnectScore(dataConnect, createConnectScoreVars);

console.log(data.connectScore_insert);

// Or, you can use the `Promise` API.
createConnectScore(createConnectScoreVars).then((response) => {
  const data = response.data;
  console.log(data.connectScore_insert);
});
```

### Using `CreateConnectScore`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createConnectScoreRef, CreateConnectScoreVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateConnectScore` mutation requires an argument of type `CreateConnectScoreVariables`:
const createConnectScoreVars: CreateConnectScoreVariables = {
  id: ..., 
  scoreKey: ..., 
  sessionId: ..., 
  tenantId: ..., 
  userId: ..., 
  username: ..., 
  displayName: ..., 
  levelId: ..., 
  dailyIndex: ..., 
  dailyKey: ..., 
  startedAt: ..., 
  completedAt: ..., 
  elapsedCentiseconds: ..., 
  hintsUsed: ..., 
  adjustedCentiseconds: ..., 
};

// Call the `createConnectScoreRef()` function to get a reference to the mutation.
const ref = createConnectScoreRef(createConnectScoreVars);
// Variables can be defined inline as well.
const ref = createConnectScoreRef({ id: ..., scoreKey: ..., sessionId: ..., tenantId: ..., userId: ..., username: ..., displayName: ..., levelId: ..., dailyIndex: ..., dailyKey: ..., startedAt: ..., completedAt: ..., elapsedCentiseconds: ..., hintsUsed: ..., adjustedCentiseconds: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createConnectScoreRef(dataConnect, createConnectScoreVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.connectScore_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.connectScore_insert);
});
```

## UpdateConnectScore
You can execute the `UpdateConnectScore` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
updateConnectScore(vars: UpdateConnectScoreVariables): MutationPromise<UpdateConnectScoreData, UpdateConnectScoreVariables>;

interface UpdateConnectScoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateConnectScoreVariables): MutationRef<UpdateConnectScoreData, UpdateConnectScoreVariables>;
}
export const updateConnectScoreRef: UpdateConnectScoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateConnectScore(dc: DataConnect, vars: UpdateConnectScoreVariables): MutationPromise<UpdateConnectScoreData, UpdateConnectScoreVariables>;

interface UpdateConnectScoreRef {
  ...
  (dc: DataConnect, vars: UpdateConnectScoreVariables): MutationRef<UpdateConnectScoreData, UpdateConnectScoreVariables>;
}
export const updateConnectScoreRef: UpdateConnectScoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateConnectScoreRef:
```typescript
const name = updateConnectScoreRef.operationName;
console.log(name);
```

### Variables
The `UpdateConnectScore` mutation requires an argument of type `UpdateConnectScoreVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateConnectScoreVariables {
  id: string;
  sessionId: string;
  username: string;
  displayName: string;
  startedAt: TimestampString;
  completedAt: TimestampString;
  elapsedCentiseconds: number;
  hintsUsed: number;
  adjustedCentiseconds: number;
}
```
### Return Type
Recall that executing the `UpdateConnectScore` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateConnectScoreData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateConnectScoreData {
  connectScore_update?: ConnectScore_Key | null;
}
```
### Using `UpdateConnectScore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateConnectScore, UpdateConnectScoreVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateConnectScore` mutation requires an argument of type `UpdateConnectScoreVariables`:
const updateConnectScoreVars: UpdateConnectScoreVariables = {
  id: ..., 
  sessionId: ..., 
  username: ..., 
  displayName: ..., 
  startedAt: ..., 
  completedAt: ..., 
  elapsedCentiseconds: ..., 
  hintsUsed: ..., 
  adjustedCentiseconds: ..., 
};

// Call the `updateConnectScore()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateConnectScore(updateConnectScoreVars);
// Variables can be defined inline as well.
const { data } = await updateConnectScore({ id: ..., sessionId: ..., username: ..., displayName: ..., startedAt: ..., completedAt: ..., elapsedCentiseconds: ..., hintsUsed: ..., adjustedCentiseconds: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateConnectScore(dataConnect, updateConnectScoreVars);

console.log(data.connectScore_update);

// Or, you can use the `Promise` API.
updateConnectScore(updateConnectScoreVars).then((response) => {
  const data = response.data;
  console.log(data.connectScore_update);
});
```

### Using `UpdateConnectScore`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateConnectScoreRef, UpdateConnectScoreVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateConnectScore` mutation requires an argument of type `UpdateConnectScoreVariables`:
const updateConnectScoreVars: UpdateConnectScoreVariables = {
  id: ..., 
  sessionId: ..., 
  username: ..., 
  displayName: ..., 
  startedAt: ..., 
  completedAt: ..., 
  elapsedCentiseconds: ..., 
  hintsUsed: ..., 
  adjustedCentiseconds: ..., 
};

// Call the `updateConnectScoreRef()` function to get a reference to the mutation.
const ref = updateConnectScoreRef(updateConnectScoreVars);
// Variables can be defined inline as well.
const ref = updateConnectScoreRef({ id: ..., sessionId: ..., username: ..., displayName: ..., startedAt: ..., completedAt: ..., elapsedCentiseconds: ..., hintsUsed: ..., adjustedCentiseconds: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateConnectScoreRef(dataConnect, updateConnectScoreVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.connectScore_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.connectScore_update);
});
```

