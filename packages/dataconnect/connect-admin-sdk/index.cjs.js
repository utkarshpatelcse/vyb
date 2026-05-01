const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'connect',
  service: 'vyb',
  location: 'asia-south1'
};
exports.connectorConfig = connectorConfig;

const getGameLevelRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetGameLevel', inputVars);
}
getGameLevelRef.operationName = 'GetGameLevel';
exports.getGameLevelRef = getGameLevelRef;

exports.getGameLevel = function getGameLevel(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getGameLevelRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const createGameLevelRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGameLevel', inputVars);
}
createGameLevelRef.operationName = 'CreateGameLevel';
exports.createGameLevelRef = createGameLevelRef;

exports.createGameLevel = function createGameLevel(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createGameLevelRef(dcInstance, inputVars));
}
;

const updateGameLevelRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateGameLevel', inputVars);
}
updateGameLevelRef.operationName = 'UpdateGameLevel';
exports.updateGameLevelRef = updateGameLevelRef;

exports.updateGameLevel = function updateGameLevel(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateGameLevelRef(dcInstance, inputVars));
}
;

const listConnectSessionsByTenantRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListConnectSessionsByTenant', inputVars);
}
listConnectSessionsByTenantRef.operationName = 'ListConnectSessionsByTenant';
exports.listConnectSessionsByTenantRef = listConnectSessionsByTenantRef;

exports.listConnectSessionsByTenant = function listConnectSessionsByTenant(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listConnectSessionsByTenantRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const listConnectScoresByTenantRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListConnectScoresByTenant', inputVars);
}
listConnectScoresByTenantRef.operationName = 'ListConnectScoresByTenant';
exports.listConnectScoresByTenantRef = listConnectScoresByTenantRef;

exports.listConnectScoresByTenant = function listConnectScoresByTenant(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listConnectScoresByTenantRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const getConnectSessionByKeyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetConnectSessionByKey', inputVars);
}
getConnectSessionByKeyRef.operationName = 'GetConnectSessionByKey';
exports.getConnectSessionByKeyRef = getConnectSessionByKeyRef;

exports.getConnectSessionByKey = function getConnectSessionByKey(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getConnectSessionByKeyRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const getConnectScoreByKeyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetConnectScoreByKey', inputVars);
}
getConnectScoreByKeyRef.operationName = 'GetConnectScoreByKey';
exports.getConnectScoreByKeyRef = getConnectScoreByKeyRef;

exports.getConnectScoreByKey = function getConnectScoreByKey(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getConnectScoreByKeyRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const createConnectSessionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateConnectSession', inputVars);
}
createConnectSessionRef.operationName = 'CreateConnectSession';
exports.createConnectSessionRef = createConnectSessionRef;

exports.createConnectSession = function createConnectSession(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createConnectSessionRef(dcInstance, inputVars));
}
;

const updateConnectSessionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateConnectSession', inputVars);
}
updateConnectSessionRef.operationName = 'UpdateConnectSession';
exports.updateConnectSessionRef = updateConnectSessionRef;

exports.updateConnectSession = function updateConnectSession(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateConnectSessionRef(dcInstance, inputVars));
}
;

const createConnectScoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateConnectScore', inputVars);
}
createConnectScoreRef.operationName = 'CreateConnectScore';
exports.createConnectScoreRef = createConnectScoreRef;

exports.createConnectScore = function createConnectScore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createConnectScoreRef(dcInstance, inputVars));
}
;

const updateConnectScoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateConnectScore', inputVars);
}
updateConnectScoreRef.operationName = 'UpdateConnectScore';
exports.updateConnectScoreRef = updateConnectScoreRef;

exports.updateConnectScore = function updateConnectScore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateConnectScoreRef(dcInstance, inputVars));
}
;
