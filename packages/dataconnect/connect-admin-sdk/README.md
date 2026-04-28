# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `connect`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetConnectLevelStore*](#getconnectlevelstore)
- [**Mutations**](#mutations)
  - [*CreateConnectLevelStore*](#createconnectlevelstore)
  - [*UpdateConnectLevelStore*](#updateconnectlevelstore)

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
