const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'social',
  serviceId: 'vyb',
  location: 'asia-south1'
};
exports.connectorConfig = connectorConfig;

function listFeedByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListFeedByTenant', inputVars, inputOpts);
}
exports.listFeedByTenant = listFeedByTenant;

function listCommentsByPost(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListCommentsByPost', inputVars, inputOpts);
}
exports.listCommentsByPost = listCommentsByPost;

function createPost(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreatePost', inputVars, inputOpts);
}
exports.createPost = createPost;

function softDeletePost(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SoftDeletePost', inputVars, inputOpts);
}
exports.softDeletePost = softDeletePost;

