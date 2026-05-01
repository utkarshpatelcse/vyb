import { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'connect',
  service: 'vyb',
  location: 'asia-south1'
};
export const getGameLevelRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetGameLevel', inputVars);
}
getGameLevelRef.operationName = 'GetGameLevel';

export function getGameLevel(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getGameLevelRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const createGameLevelRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGameLevel', inputVars);
}
createGameLevelRef.operationName = 'CreateGameLevel';

export function createGameLevel(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createGameLevelRef(dcInstance, inputVars));
}

export const updateGameLevelRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateGameLevel', inputVars);
}
updateGameLevelRef.operationName = 'UpdateGameLevel';

export function updateGameLevel(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateGameLevelRef(dcInstance, inputVars));
}

export const listConnectSessionsByTenantRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListConnectSessionsByTenant', inputVars);
}
listConnectSessionsByTenantRef.operationName = 'ListConnectSessionsByTenant';

export function listConnectSessionsByTenant(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listConnectSessionsByTenantRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const listConnectScoresByTenantRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListConnectScoresByTenant', inputVars);
}
listConnectScoresByTenantRef.operationName = 'ListConnectScoresByTenant';

export function listConnectScoresByTenant(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listConnectScoresByTenantRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const getConnectSessionByKeyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetConnectSessionByKey', inputVars);
}
getConnectSessionByKeyRef.operationName = 'GetConnectSessionByKey';

export function getConnectSessionByKey(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getConnectSessionByKeyRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const getConnectScoreByKeyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetConnectScoreByKey', inputVars);
}
getConnectScoreByKeyRef.operationName = 'GetConnectScoreByKey';

export function getConnectScoreByKey(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getConnectScoreByKeyRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const createConnectSessionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateConnectSession', inputVars);
}
createConnectSessionRef.operationName = 'CreateConnectSession';

export function createConnectSession(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createConnectSessionRef(dcInstance, inputVars));
}

export const updateConnectSessionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateConnectSession', inputVars);
}
updateConnectSessionRef.operationName = 'UpdateConnectSession';

export function updateConnectSession(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateConnectSessionRef(dcInstance, inputVars));
}

export const createConnectScoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateConnectScore', inputVars);
}
createConnectScoreRef.operationName = 'CreateConnectScore';

export function createConnectScore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createConnectScoreRef(dcInstance, inputVars));
}

export const updateConnectScoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateConnectScore', inputVars);
}
updateConnectScoreRef.operationName = 'UpdateConnectScore';

export function updateConnectScore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateConnectScoreRef(dcInstance, inputVars));
}

