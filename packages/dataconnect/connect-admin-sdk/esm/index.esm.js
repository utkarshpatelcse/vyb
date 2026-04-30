import { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'connect',
  service: 'vyb',
  location: 'asia-south1'
};
export const getConnectLevelStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetConnectLevelStore', inputVars);
}
getConnectLevelStoreRef.operationName = 'GetConnectLevelStore';

export function getConnectLevelStore(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getConnectLevelStoreRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const createConnectLevelStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateConnectLevelStore', inputVars);
}
createConnectLevelStoreRef.operationName = 'CreateConnectLevelStore';

export function createConnectLevelStore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createConnectLevelStoreRef(dcInstance, inputVars));
}

export const updateConnectLevelStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateConnectLevelStore', inputVars);
}
updateConnectLevelStoreRef.operationName = 'UpdateConnectLevelStore';

export function updateConnectLevelStore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateConnectLevelStoreRef(dcInstance, inputVars));
}

export const getScribbleWordStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetScribbleWordStore', inputVars);
}
getScribbleWordStoreRef.operationName = 'GetScribbleWordStore';

export function getScribbleWordStore(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getScribbleWordStoreRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const createScribbleWordStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateScribbleWordStore', inputVars);
}
createScribbleWordStoreRef.operationName = 'CreateScribbleWordStore';

export function createScribbleWordStore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createScribbleWordStoreRef(dcInstance, inputVars));
}

export const updateScribbleWordStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateScribbleWordStore', inputVars);
}
updateScribbleWordStoreRef.operationName = 'UpdateScribbleWordStore';

export function updateScribbleWordStore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateScribbleWordStoreRef(dcInstance, inputVars));
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

