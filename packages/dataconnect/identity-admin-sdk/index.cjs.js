const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'identity',
  serviceId: 'vyb',
  location: 'asia-south1'
};
exports.connectorConfig = connectorConfig;

function getUserByFirebaseUid(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserByFirebaseUid', inputVars, inputOpts);
}
exports.getUserByFirebaseUid = getUserByFirebaseUid;

function createUser(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateUser', inputVars, inputOpts);
}
exports.createUser = createUser;

function updateUserProfile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateUserProfile', inputVars, inputOpts);
}
exports.updateUserProfile = updateUserProfile;

