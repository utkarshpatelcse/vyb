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
