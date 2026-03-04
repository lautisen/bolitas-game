# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetTopScores*](#gettopscores)
  - [*GetPlayerScore*](#getplayerscore)
- [**Mutations**](#mutations)
  - [*UpsertScore*](#upsertscore)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

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

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetTopScores
You can execute the `GetTopScores` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getTopScores(): QueryPromise<GetTopScoresData, undefined>;

interface GetTopScoresRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetTopScoresData, undefined>;
}
export const getTopScoresRef: GetTopScoresRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getTopScores(dc: DataConnect): QueryPromise<GetTopScoresData, undefined>;

interface GetTopScoresRef {
  ...
  (dc: DataConnect): QueryRef<GetTopScoresData, undefined>;
}
export const getTopScoresRef: GetTopScoresRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getTopScoresRef:
```typescript
const name = getTopScoresRef.operationName;
console.log(name);
```

### Variables
The `GetTopScores` query has no variables.
### Return Type
Recall that executing the `GetTopScores` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetTopScoresData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetTopScoresData {
  leaderboardEntries: ({
    id: string;
    score: number;
  } & LeaderboardEntry_Key)[];
}
```
### Using `GetTopScores`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getTopScores } from '@dataconnect/generated';


// Call the `getTopScores()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getTopScores();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getTopScores(dataConnect);

console.log(data.leaderboardEntries);

// Or, you can use the `Promise` API.
getTopScores().then((response) => {
  const data = response.data;
  console.log(data.leaderboardEntries);
});
```

### Using `GetTopScores`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getTopScoresRef } from '@dataconnect/generated';


// Call the `getTopScoresRef()` function to get a reference to the query.
const ref = getTopScoresRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getTopScoresRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.leaderboardEntries);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.leaderboardEntries);
});
```

## GetPlayerScore
You can execute the `GetPlayerScore` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getPlayerScore(vars: GetPlayerScoreVariables): QueryPromise<GetPlayerScoreData, GetPlayerScoreVariables>;

interface GetPlayerScoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPlayerScoreVariables): QueryRef<GetPlayerScoreData, GetPlayerScoreVariables>;
}
export const getPlayerScoreRef: GetPlayerScoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getPlayerScore(dc: DataConnect, vars: GetPlayerScoreVariables): QueryPromise<GetPlayerScoreData, GetPlayerScoreVariables>;

interface GetPlayerScoreRef {
  ...
  (dc: DataConnect, vars: GetPlayerScoreVariables): QueryRef<GetPlayerScoreData, GetPlayerScoreVariables>;
}
export const getPlayerScoreRef: GetPlayerScoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getPlayerScoreRef:
```typescript
const name = getPlayerScoreRef.operationName;
console.log(name);
```

### Variables
The `GetPlayerScore` query requires an argument of type `GetPlayerScoreVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetPlayerScoreVariables {
  id: string;
}
```
### Return Type
Recall that executing the `GetPlayerScore` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetPlayerScoreData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetPlayerScoreData {
  leaderboardEntry?: {
    score: number;
  };
}
```
### Using `GetPlayerScore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getPlayerScore, GetPlayerScoreVariables } from '@dataconnect/generated';

// The `GetPlayerScore` query requires an argument of type `GetPlayerScoreVariables`:
const getPlayerScoreVars: GetPlayerScoreVariables = {
  id: ..., 
};

// Call the `getPlayerScore()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getPlayerScore(getPlayerScoreVars);
// Variables can be defined inline as well.
const { data } = await getPlayerScore({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getPlayerScore(dataConnect, getPlayerScoreVars);

console.log(data.leaderboardEntry);

// Or, you can use the `Promise` API.
getPlayerScore(getPlayerScoreVars).then((response) => {
  const data = response.data;
  console.log(data.leaderboardEntry);
});
```

### Using `GetPlayerScore`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getPlayerScoreRef, GetPlayerScoreVariables } from '@dataconnect/generated';

// The `GetPlayerScore` query requires an argument of type `GetPlayerScoreVariables`:
const getPlayerScoreVars: GetPlayerScoreVariables = {
  id: ..., 
};

// Call the `getPlayerScoreRef()` function to get a reference to the query.
const ref = getPlayerScoreRef(getPlayerScoreVars);
// Variables can be defined inline as well.
const ref = getPlayerScoreRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getPlayerScoreRef(dataConnect, getPlayerScoreVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.leaderboardEntry);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.leaderboardEntry);
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

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## UpsertScore
You can execute the `UpsertScore` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertScore(vars: UpsertScoreVariables): MutationPromise<UpsertScoreData, UpsertScoreVariables>;

interface UpsertScoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertScoreVariables): MutationRef<UpsertScoreData, UpsertScoreVariables>;
}
export const upsertScoreRef: UpsertScoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertScore(dc: DataConnect, vars: UpsertScoreVariables): MutationPromise<UpsertScoreData, UpsertScoreVariables>;

interface UpsertScoreRef {
  ...
  (dc: DataConnect, vars: UpsertScoreVariables): MutationRef<UpsertScoreData, UpsertScoreVariables>;
}
export const upsertScoreRef: UpsertScoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertScoreRef:
```typescript
const name = upsertScoreRef.operationName;
console.log(name);
```

### Variables
The `UpsertScore` mutation requires an argument of type `UpsertScoreVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertScoreVariables {
  id: string;
  score: number;
}
```
### Return Type
Recall that executing the `UpsertScore` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertScoreData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertScoreData {
  leaderboardEntry_upsert: LeaderboardEntry_Key;
}
```
### Using `UpsertScore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertScore, UpsertScoreVariables } from '@dataconnect/generated';

// The `UpsertScore` mutation requires an argument of type `UpsertScoreVariables`:
const upsertScoreVars: UpsertScoreVariables = {
  id: ..., 
  score: ..., 
};

// Call the `upsertScore()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertScore(upsertScoreVars);
// Variables can be defined inline as well.
const { data } = await upsertScore({ id: ..., score: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertScore(dataConnect, upsertScoreVars);

console.log(data.leaderboardEntry_upsert);

// Or, you can use the `Promise` API.
upsertScore(upsertScoreVars).then((response) => {
  const data = response.data;
  console.log(data.leaderboardEntry_upsert);
});
```

### Using `UpsertScore`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertScoreRef, UpsertScoreVariables } from '@dataconnect/generated';

// The `UpsertScore` mutation requires an argument of type `UpsertScoreVariables`:
const upsertScoreVars: UpsertScoreVariables = {
  id: ..., 
  score: ..., 
};

// Call the `upsertScoreRef()` function to get a reference to the mutation.
const ref = upsertScoreRef(upsertScoreVars);
// Variables can be defined inline as well.
const ref = upsertScoreRef({ id: ..., score: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertScoreRef(dataConnect, upsertScoreVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.leaderboardEntry_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.leaderboardEntry_upsert);
});
```

