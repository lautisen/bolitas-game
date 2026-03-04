# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { upsertScore, getTopScores, getPlayerScore } from '@dataconnect/generated';


// Operation UpsertScore:  For variables, look at type UpsertScoreVars in ../index.d.ts
const { data } = await UpsertScore(dataConnect, upsertScoreVars);

// Operation GetTopScores: 
const { data } = await GetTopScores(dataConnect);

// Operation GetPlayerScore:  For variables, look at type GetPlayerScoreVars in ../index.d.ts
const { data } = await GetPlayerScore(dataConnect, getPlayerScoreVars);


```