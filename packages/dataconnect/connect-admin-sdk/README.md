# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `connect`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetConnectLevelStore*](#getconnectlevelstore)
  - [*GetScribbleWordStore*](#getscribblewordstore)
  - [*ListConnectSessionsByTenant*](#listconnectsessionsbytenant)
  - [*ListConnectScoresByTenant*](#listconnectscoresbytenant)
  - [*GetConnectSessionByKey*](#getconnectsessionbykey)
  - [*GetConnectScoreByKey*](#getconnectscorebykey)
- [**Mutations**](#mutations)
  - [*CreateConnectLevelStore*](#createconnectlevelstore)
  - [*UpdateConnectLevelStore*](#updateconnectlevelstore)
  - [*CreateScribbleWordStore*](#createscribblewordstore)
  - [*UpdateScribbleWordStore*](#updatescribblewordstore)
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

## GetConnectLevelStore
You can execute the `GetConnectLevelStore` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
getConnectLevelStore(vars: GetConnectLevelStoreVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectLevelStoreData, GetConnectLevelStoreVariables>;

interface GetConnectLevelStoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetConnectLevelStoreVariables): QueryRef<GetConnectLevelStoreData, GetConnectLevelStoreVariables>;
}
export const getConnectLevelStoreRef: GetConnectLevelStoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getConnectLevelStore(dc: DataConnect, vars: GetConnectLevelStoreVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectLevelStoreData, GetConnectLevelStoreVariables>;

interface GetConnectLevelStoreRef {
  ...
  (dc: DataConnect, vars: GetConnectLevelStoreVariables): QueryRef<GetConnectLevelStoreData, GetConnectLevelStoreVariables>;
}
export const getConnectLevelStoreRef: GetConnectLevelStoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getConnectLevelStoreRef:
```typescript
const name = getConnectLevelStoreRef.operationName;
console.log(name);
```

### Variables
The `GetConnectLevelStore` query requires an argument of type `GetConnectLevelStoreVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetConnectLevelStoreVariables {
  id: string;
}
```
### Return Type
Recall that executing the `GetConnectLevelStore` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetConnectLevelStoreData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetConnectLevelStoreData {
  connectLevelStore?: {
    id: string;
    payloadJson: string;
    totalLevels: number;
    launchDate?: string | null;
    checksum?: string | null;
    updatedAt: TimestampString;
  } & ConnectLevelStore_Key;
}
```
### Using `GetConnectLevelStore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getConnectLevelStore, GetConnectLevelStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `GetConnectLevelStore` query requires an argument of type `GetConnectLevelStoreVariables`:
const getConnectLevelStoreVars: GetConnectLevelStoreVariables = {
  id: ..., 
};

// Call the `getConnectLevelStore()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getConnectLevelStore(getConnectLevelStoreVars);
// Variables can be defined inline as well.
const { data } = await getConnectLevelStore({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getConnectLevelStore(dataConnect, getConnectLevelStoreVars);

console.log(data.connectLevelStore);

// Or, you can use the `Promise` API.
getConnectLevelStore(getConnectLevelStoreVars).then((response) => {
  const data = response.data;
  console.log(data.connectLevelStore);
});
```

### Using `GetConnectLevelStore`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getConnectLevelStoreRef, GetConnectLevelStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `GetConnectLevelStore` query requires an argument of type `GetConnectLevelStoreVariables`:
const getConnectLevelStoreVars: GetConnectLevelStoreVariables = {
  id: ..., 
};

// Call the `getConnectLevelStoreRef()` function to get a reference to the query.
const ref = getConnectLevelStoreRef(getConnectLevelStoreVars);
// Variables can be defined inline as well.
const ref = getConnectLevelStoreRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getConnectLevelStoreRef(dataConnect, getConnectLevelStoreVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.connectLevelStore);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.connectLevelStore);
});
```

## GetScribbleWordStore
You can execute the `GetScribbleWordStore` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
getScribbleWordStore(vars: GetScribbleWordStoreVariables, options?: ExecuteQueryOptions): QueryPromise<GetScribbleWordStoreData, GetScribbleWordStoreVariables>;

interface GetScribbleWordStoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetScribbleWordStoreVariables): QueryRef<GetScribbleWordStoreData, GetScribbleWordStoreVariables>;
}
export const getScribbleWordStoreRef: GetScribbleWordStoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getScribbleWordStore(dc: DataConnect, vars: GetScribbleWordStoreVariables, options?: ExecuteQueryOptions): QueryPromise<GetScribbleWordStoreData, GetScribbleWordStoreVariables>;

interface GetScribbleWordStoreRef {
  ...
  (dc: DataConnect, vars: GetScribbleWordStoreVariables): QueryRef<GetScribbleWordStoreData, GetScribbleWordStoreVariables>;
}
export const getScribbleWordStoreRef: GetScribbleWordStoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getScribbleWordStoreRef:
```typescript
const name = getScribbleWordStoreRef.operationName;
console.log(name);
```

### Variables
The `GetScribbleWordStore` query requires an argument of type `GetScribbleWordStoreVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetScribbleWordStoreVariables {
  id: string;
}
```
### Return Type
Recall that executing the `GetScribbleWordStore` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetScribbleWordStoreData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetScribbleWordStoreData {
  scribbleWordStore?: {
    id: string;
    payloadJson: string;
    totalWords: number;
    checksum?: string | null;
    updatedAt: TimestampString;
  } & ScribbleWordStore_Key;
}
```
### Using `GetScribbleWordStore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getScribbleWordStore, GetScribbleWordStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `GetScribbleWordStore` query requires an argument of type `GetScribbleWordStoreVariables`:
const getScribbleWordStoreVars: GetScribbleWordStoreVariables = {
  id: ..., 
};

// Call the `getScribbleWordStore()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getScribbleWordStore(getScribbleWordStoreVars);
// Variables can be defined inline as well.
const { data } = await getScribbleWordStore({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getScribbleWordStore(dataConnect, getScribbleWordStoreVars);

console.log(data.scribbleWordStore);

// Or, you can use the `Promise` API.
getScribbleWordStore(getScribbleWordStoreVars).then((response) => {
  const data = response.data;
  console.log(data.scribbleWordStore);
});
```

### Using `GetScribbleWordStore`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getScribbleWordStoreRef, GetScribbleWordStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `GetScribbleWordStore` query requires an argument of type `GetScribbleWordStoreVariables`:
const getScribbleWordStoreVars: GetScribbleWordStoreVariables = {
  id: ..., 
};

// Call the `getScribbleWordStoreRef()` function to get a reference to the query.
const ref = getScribbleWordStoreRef(getScribbleWordStoreVars);
// Variables can be defined inline as well.
const ref = getScribbleWordStoreRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getScribbleWordStoreRef(dataConnect, getScribbleWordStoreVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.scribbleWordStore);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.scribbleWordStore);
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

## CreateConnectLevelStore
You can execute the `CreateConnectLevelStore` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
createConnectLevelStore(vars: CreateConnectLevelStoreVariables): MutationPromise<CreateConnectLevelStoreData, CreateConnectLevelStoreVariables>;

interface CreateConnectLevelStoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateConnectLevelStoreVariables): MutationRef<CreateConnectLevelStoreData, CreateConnectLevelStoreVariables>;
}
export const createConnectLevelStoreRef: CreateConnectLevelStoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createConnectLevelStore(dc: DataConnect, vars: CreateConnectLevelStoreVariables): MutationPromise<CreateConnectLevelStoreData, CreateConnectLevelStoreVariables>;

interface CreateConnectLevelStoreRef {
  ...
  (dc: DataConnect, vars: CreateConnectLevelStoreVariables): MutationRef<CreateConnectLevelStoreData, CreateConnectLevelStoreVariables>;
}
export const createConnectLevelStoreRef: CreateConnectLevelStoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createConnectLevelStoreRef:
```typescript
const name = createConnectLevelStoreRef.operationName;
console.log(name);
```

### Variables
The `CreateConnectLevelStore` mutation requires an argument of type `CreateConnectLevelStoreVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateConnectLevelStoreVariables {
  id: string;
  payloadJson: string;
  totalLevels: number;
  launchDate?: string | null;
  checksum?: string | null;
}
```
### Return Type
Recall that executing the `CreateConnectLevelStore` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateConnectLevelStoreData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateConnectLevelStoreData {
  connectLevelStore_insert: ConnectLevelStore_Key;
}
```
### Using `CreateConnectLevelStore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createConnectLevelStore, CreateConnectLevelStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateConnectLevelStore` mutation requires an argument of type `CreateConnectLevelStoreVariables`:
const createConnectLevelStoreVars: CreateConnectLevelStoreVariables = {
  id: ..., 
  payloadJson: ..., 
  totalLevels: ..., 
  launchDate: ..., // optional
  checksum: ..., // optional
};

// Call the `createConnectLevelStore()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createConnectLevelStore(createConnectLevelStoreVars);
// Variables can be defined inline as well.
const { data } = await createConnectLevelStore({ id: ..., payloadJson: ..., totalLevels: ..., launchDate: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createConnectLevelStore(dataConnect, createConnectLevelStoreVars);

console.log(data.connectLevelStore_insert);

// Or, you can use the `Promise` API.
createConnectLevelStore(createConnectLevelStoreVars).then((response) => {
  const data = response.data;
  console.log(data.connectLevelStore_insert);
});
```

### Using `CreateConnectLevelStore`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createConnectLevelStoreRef, CreateConnectLevelStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateConnectLevelStore` mutation requires an argument of type `CreateConnectLevelStoreVariables`:
const createConnectLevelStoreVars: CreateConnectLevelStoreVariables = {
  id: ..., 
  payloadJson: ..., 
  totalLevels: ..., 
  launchDate: ..., // optional
  checksum: ..., // optional
};

// Call the `createConnectLevelStoreRef()` function to get a reference to the mutation.
const ref = createConnectLevelStoreRef(createConnectLevelStoreVars);
// Variables can be defined inline as well.
const ref = createConnectLevelStoreRef({ id: ..., payloadJson: ..., totalLevels: ..., launchDate: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createConnectLevelStoreRef(dataConnect, createConnectLevelStoreVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.connectLevelStore_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.connectLevelStore_insert);
});
```

## UpdateConnectLevelStore
You can execute the `UpdateConnectLevelStore` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
updateConnectLevelStore(vars: UpdateConnectLevelStoreVariables): MutationPromise<UpdateConnectLevelStoreData, UpdateConnectLevelStoreVariables>;

interface UpdateConnectLevelStoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateConnectLevelStoreVariables): MutationRef<UpdateConnectLevelStoreData, UpdateConnectLevelStoreVariables>;
}
export const updateConnectLevelStoreRef: UpdateConnectLevelStoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateConnectLevelStore(dc: DataConnect, vars: UpdateConnectLevelStoreVariables): MutationPromise<UpdateConnectLevelStoreData, UpdateConnectLevelStoreVariables>;

interface UpdateConnectLevelStoreRef {
  ...
  (dc: DataConnect, vars: UpdateConnectLevelStoreVariables): MutationRef<UpdateConnectLevelStoreData, UpdateConnectLevelStoreVariables>;
}
export const updateConnectLevelStoreRef: UpdateConnectLevelStoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateConnectLevelStoreRef:
```typescript
const name = updateConnectLevelStoreRef.operationName;
console.log(name);
```

### Variables
The `UpdateConnectLevelStore` mutation requires an argument of type `UpdateConnectLevelStoreVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateConnectLevelStoreVariables {
  id: string;
  payloadJson: string;
  totalLevels: number;
  launchDate?: string | null;
  checksum?: string | null;
}
```
### Return Type
Recall that executing the `UpdateConnectLevelStore` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateConnectLevelStoreData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateConnectLevelStoreData {
  connectLevelStore_update?: ConnectLevelStore_Key | null;
}
```
### Using `UpdateConnectLevelStore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateConnectLevelStore, UpdateConnectLevelStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateConnectLevelStore` mutation requires an argument of type `UpdateConnectLevelStoreVariables`:
const updateConnectLevelStoreVars: UpdateConnectLevelStoreVariables = {
  id: ..., 
  payloadJson: ..., 
  totalLevels: ..., 
  launchDate: ..., // optional
  checksum: ..., // optional
};

// Call the `updateConnectLevelStore()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateConnectLevelStore(updateConnectLevelStoreVars);
// Variables can be defined inline as well.
const { data } = await updateConnectLevelStore({ id: ..., payloadJson: ..., totalLevels: ..., launchDate: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateConnectLevelStore(dataConnect, updateConnectLevelStoreVars);

console.log(data.connectLevelStore_update);

// Or, you can use the `Promise` API.
updateConnectLevelStore(updateConnectLevelStoreVars).then((response) => {
  const data = response.data;
  console.log(data.connectLevelStore_update);
});
```

### Using `UpdateConnectLevelStore`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateConnectLevelStoreRef, UpdateConnectLevelStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateConnectLevelStore` mutation requires an argument of type `UpdateConnectLevelStoreVariables`:
const updateConnectLevelStoreVars: UpdateConnectLevelStoreVariables = {
  id: ..., 
  payloadJson: ..., 
  totalLevels: ..., 
  launchDate: ..., // optional
  checksum: ..., // optional
};

// Call the `updateConnectLevelStoreRef()` function to get a reference to the mutation.
const ref = updateConnectLevelStoreRef(updateConnectLevelStoreVars);
// Variables can be defined inline as well.
const ref = updateConnectLevelStoreRef({ id: ..., payloadJson: ..., totalLevels: ..., launchDate: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateConnectLevelStoreRef(dataConnect, updateConnectLevelStoreVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.connectLevelStore_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.connectLevelStore_update);
});
```

## CreateScribbleWordStore
You can execute the `CreateScribbleWordStore` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
createScribbleWordStore(vars: CreateScribbleWordStoreVariables): MutationPromise<CreateScribbleWordStoreData, CreateScribbleWordStoreVariables>;

interface CreateScribbleWordStoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateScribbleWordStoreVariables): MutationRef<CreateScribbleWordStoreData, CreateScribbleWordStoreVariables>;
}
export const createScribbleWordStoreRef: CreateScribbleWordStoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createScribbleWordStore(dc: DataConnect, vars: CreateScribbleWordStoreVariables): MutationPromise<CreateScribbleWordStoreData, CreateScribbleWordStoreVariables>;

interface CreateScribbleWordStoreRef {
  ...
  (dc: DataConnect, vars: CreateScribbleWordStoreVariables): MutationRef<CreateScribbleWordStoreData, CreateScribbleWordStoreVariables>;
}
export const createScribbleWordStoreRef: CreateScribbleWordStoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createScribbleWordStoreRef:
```typescript
const name = createScribbleWordStoreRef.operationName;
console.log(name);
```

### Variables
The `CreateScribbleWordStore` mutation requires an argument of type `CreateScribbleWordStoreVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateScribbleWordStoreVariables {
  id: string;
  payloadJson: string;
  totalWords: number;
  checksum?: string | null;
}
```
### Return Type
Recall that executing the `CreateScribbleWordStore` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateScribbleWordStoreData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateScribbleWordStoreData {
  scribbleWordStore_insert: ScribbleWordStore_Key;
}
```
### Using `CreateScribbleWordStore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createScribbleWordStore, CreateScribbleWordStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateScribbleWordStore` mutation requires an argument of type `CreateScribbleWordStoreVariables`:
const createScribbleWordStoreVars: CreateScribbleWordStoreVariables = {
  id: ..., 
  payloadJson: ..., 
  totalWords: ..., 
  checksum: ..., // optional
};

// Call the `createScribbleWordStore()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createScribbleWordStore(createScribbleWordStoreVars);
// Variables can be defined inline as well.
const { data } = await createScribbleWordStore({ id: ..., payloadJson: ..., totalWords: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createScribbleWordStore(dataConnect, createScribbleWordStoreVars);

console.log(data.scribbleWordStore_insert);

// Or, you can use the `Promise` API.
createScribbleWordStore(createScribbleWordStoreVars).then((response) => {
  const data = response.data;
  console.log(data.scribbleWordStore_insert);
});
```

### Using `CreateScribbleWordStore`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createScribbleWordStoreRef, CreateScribbleWordStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `CreateScribbleWordStore` mutation requires an argument of type `CreateScribbleWordStoreVariables`:
const createScribbleWordStoreVars: CreateScribbleWordStoreVariables = {
  id: ..., 
  payloadJson: ..., 
  totalWords: ..., 
  checksum: ..., // optional
};

// Call the `createScribbleWordStoreRef()` function to get a reference to the mutation.
const ref = createScribbleWordStoreRef(createScribbleWordStoreVars);
// Variables can be defined inline as well.
const ref = createScribbleWordStoreRef({ id: ..., payloadJson: ..., totalWords: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createScribbleWordStoreRef(dataConnect, createScribbleWordStoreVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.scribbleWordStore_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.scribbleWordStore_insert);
});
```

## UpdateScribbleWordStore
You can execute the `UpdateScribbleWordStore` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [connect-admin-sdk/index.d.ts](./index.d.ts):
```typescript
updateScribbleWordStore(vars: UpdateScribbleWordStoreVariables): MutationPromise<UpdateScribbleWordStoreData, UpdateScribbleWordStoreVariables>;

interface UpdateScribbleWordStoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateScribbleWordStoreVariables): MutationRef<UpdateScribbleWordStoreData, UpdateScribbleWordStoreVariables>;
}
export const updateScribbleWordStoreRef: UpdateScribbleWordStoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateScribbleWordStore(dc: DataConnect, vars: UpdateScribbleWordStoreVariables): MutationPromise<UpdateScribbleWordStoreData, UpdateScribbleWordStoreVariables>;

interface UpdateScribbleWordStoreRef {
  ...
  (dc: DataConnect, vars: UpdateScribbleWordStoreVariables): MutationRef<UpdateScribbleWordStoreData, UpdateScribbleWordStoreVariables>;
}
export const updateScribbleWordStoreRef: UpdateScribbleWordStoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateScribbleWordStoreRef:
```typescript
const name = updateScribbleWordStoreRef.operationName;
console.log(name);
```

### Variables
The `UpdateScribbleWordStore` mutation requires an argument of type `UpdateScribbleWordStoreVariables`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateScribbleWordStoreVariables {
  id: string;
  payloadJson: string;
  totalWords: number;
  checksum?: string | null;
}
```
### Return Type
Recall that executing the `UpdateScribbleWordStore` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateScribbleWordStoreData`, which is defined in [connect-admin-sdk/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateScribbleWordStoreData {
  scribbleWordStore_update?: ScribbleWordStore_Key | null;
}
```
### Using `UpdateScribbleWordStore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateScribbleWordStore, UpdateScribbleWordStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateScribbleWordStore` mutation requires an argument of type `UpdateScribbleWordStoreVariables`:
const updateScribbleWordStoreVars: UpdateScribbleWordStoreVariables = {
  id: ..., 
  payloadJson: ..., 
  totalWords: ..., 
  checksum: ..., // optional
};

// Call the `updateScribbleWordStore()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateScribbleWordStore(updateScribbleWordStoreVars);
// Variables can be defined inline as well.
const { data } = await updateScribbleWordStore({ id: ..., payloadJson: ..., totalWords: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateScribbleWordStore(dataConnect, updateScribbleWordStoreVars);

console.log(data.scribbleWordStore_update);

// Or, you can use the `Promise` API.
updateScribbleWordStore(updateScribbleWordStoreVars).then((response) => {
  const data = response.data;
  console.log(data.scribbleWordStore_update);
});
```

### Using `UpdateScribbleWordStore`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateScribbleWordStoreRef, UpdateScribbleWordStoreVariables } from '@vyb/dataconnect-connect-admin';

// The `UpdateScribbleWordStore` mutation requires an argument of type `UpdateScribbleWordStoreVariables`:
const updateScribbleWordStoreVars: UpdateScribbleWordStoreVariables = {
  id: ..., 
  payloadJson: ..., 
  totalWords: ..., 
  checksum: ..., // optional
};

// Call the `updateScribbleWordStoreRef()` function to get a reference to the mutation.
const ref = updateScribbleWordStoreRef(updateScribbleWordStoreVars);
// Variables can be defined inline as well.
const ref = updateScribbleWordStoreRef({ id: ..., payloadJson: ..., totalWords: ..., checksum: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateScribbleWordStoreRef(dataConnect, updateScribbleWordStoreVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.scribbleWordStore_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.scribbleWordStore_update);
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

