const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'connect',
  service: 'vyb',
  location: 'asia-south1'
};
exports.connectorConfig = connectorConfig;

const getConnectLevelStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetConnectLevelStore', inputVars);
}
getConnectLevelStoreRef.operationName = 'GetConnectLevelStore';
exports.getConnectLevelStoreRef = getConnectLevelStoreRef;

exports.getConnectLevelStore = function getConnectLevelStore(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getConnectLevelStoreRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const createConnectLevelStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateConnectLevelStore', inputVars);
}
createConnectLevelStoreRef.operationName = 'CreateConnectLevelStore';
exports.createConnectLevelStoreRef = createConnectLevelStoreRef;

exports.createConnectLevelStore = function createConnectLevelStore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createConnectLevelStoreRef(dcInstance, inputVars));
}
;

const updateConnectLevelStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateConnectLevelStore', inputVars);
}
updateConnectLevelStoreRef.operationName = 'UpdateConnectLevelStore';
exports.updateConnectLevelStoreRef = updateConnectLevelStoreRef;

exports.updateConnectLevelStore = function updateConnectLevelStore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateConnectLevelStoreRef(dcInstance, inputVars));
}
;

const getScribbleWordStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetScribbleWordStore', inputVars);
}
getScribbleWordStoreRef.operationName = 'GetScribbleWordStore';
exports.getScribbleWordStoreRef = getScribbleWordStoreRef;

exports.getScribbleWordStore = function getScribbleWordStore(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getScribbleWordStoreRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const createScribbleWordStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateScribbleWordStore', inputVars);
}
createScribbleWordStoreRef.operationName = 'CreateScribbleWordStore';
exports.createScribbleWordStoreRef = createScribbleWordStoreRef;

exports.createScribbleWordStore = function createScribbleWordStore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createScribbleWordStoreRef(dcInstance, inputVars));
}
;

const updateScribbleWordStoreRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateScribbleWordStore', inputVars);
}
updateScribbleWordStoreRef.operationName = 'UpdateScribbleWordStore';
exports.updateScribbleWordStoreRef = updateScribbleWordStoreRef;

exports.updateScribbleWordStore = function updateScribbleWordStore(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateScribbleWordStoreRef(dcInstance, inputVars));
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
