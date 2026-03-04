const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'bolitas',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

const upsertScoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertScore', inputVars);
}
upsertScoreRef.operationName = 'UpsertScore';
exports.upsertScoreRef = upsertScoreRef;

exports.upsertScore = function upsertScore(dcOrVars, vars) {
  return executeMutation(upsertScoreRef(dcOrVars, vars));
};

const getTopScoresRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTopScores');
}
getTopScoresRef.operationName = 'GetTopScores';
exports.getTopScoresRef = getTopScoresRef;

exports.getTopScores = function getTopScores(dc) {
  return executeQuery(getTopScoresRef(dc));
};

const getPlayerScoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPlayerScore', inputVars);
}
getPlayerScoreRef.operationName = 'GetPlayerScore';
exports.getPlayerScoreRef = getPlayerScoreRef;

exports.getPlayerScore = function getPlayerScore(dcOrVars, vars) {
  return executeQuery(getPlayerScoreRef(dcOrVars, vars));
};
