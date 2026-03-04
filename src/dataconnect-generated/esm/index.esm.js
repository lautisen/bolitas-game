import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'bolitas',
  location: 'us-east4'
};

export const upsertScoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertScore', inputVars);
}
upsertScoreRef.operationName = 'UpsertScore';

export function upsertScore(dcOrVars, vars) {
  return executeMutation(upsertScoreRef(dcOrVars, vars));
}

export const getTopScoresRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTopScores');
}
getTopScoresRef.operationName = 'GetTopScores';

export function getTopScores(dc) {
  return executeQuery(getTopScoresRef(dc));
}

export const getPlayerScoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPlayerScore', inputVars);
}
getPlayerScoreRef.operationName = 'GetPlayerScore';

export function getPlayerScore(dcOrVars, vars) {
  return executeQuery(getPlayerScoreRef(dcOrVars, vars));
}

