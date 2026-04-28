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
