const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'campus',
  serviceId: 'vyb',
  location: 'asia-south1'
};
exports.connectorConfig = connectorConfig;

function getTenantByDomain(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTenantByDomain', inputVars, inputOpts);
}
exports.getTenantByDomain = getTenantByDomain;

function getTenantBySlug(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTenantBySlug', inputVars, inputOpts);
}
exports.getTenantBySlug = getTenantBySlug;

function getMembershipContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMembershipContext', inputVars, inputOpts);
}
exports.getMembershipContext = getMembershipContext;

function listCommunitiesByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListCommunitiesByTenant', inputVars, inputOpts);
}
exports.listCommunitiesByTenant = listCommunitiesByTenant;

function getCommunityBySlug(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetCommunityBySlug', inputVars, inputOpts);
}
exports.getCommunityBySlug = getCommunityBySlug;

function listCommunitiesForMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListCommunitiesForMembership', inputVars, inputOpts);
}
exports.listCommunitiesForMembership = listCommunitiesForMembership;

function createTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateTenant', inputVars, inputOpts);
}
exports.createTenant = createTenant;

function createTenantDomain(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateTenantDomain', inputVars, inputOpts);
}
exports.createTenantDomain = createTenantDomain;

function createTenantMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateTenantMembership', inputVars, inputOpts);
}
exports.createTenantMembership = createTenantMembership;

function createCommunity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateCommunity', inputVars, inputOpts);
}
exports.createCommunity = createCommunity;

function createCommunityMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateCommunityMembership', inputVars, inputOpts);
}
exports.createCommunityMembership = createCommunityMembership;

