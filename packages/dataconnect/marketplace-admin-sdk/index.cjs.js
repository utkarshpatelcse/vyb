const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'marketplace',
  serviceId: 'vyb',
  location: 'asia-south1'
};
exports.connectorConfig = connectorConfig;

function listMarketListingsByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMarketListingsByTenant', inputVars, inputOpts);
}
exports.listMarketListingsByTenant = listMarketListingsByTenant;

function getMarketListingById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMarketListingById', inputVars, inputOpts);
}
exports.getMarketListingById = getMarketListingById;

function listMarketListingMediaByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMarketListingMediaByTenant', inputVars, inputOpts);
}
exports.listMarketListingMediaByTenant = listMarketListingMediaByTenant;

function listMarketRequestsByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMarketRequestsByTenant', inputVars, inputOpts);
}
exports.listMarketRequestsByTenant = listMarketRequestsByTenant;

function getMarketRequestById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMarketRequestById', inputVars, inputOpts);
}
exports.getMarketRequestById = getMarketRequestById;

function listMarketRequestMediaByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMarketRequestMediaByTenant', inputVars, inputOpts);
}
exports.listMarketRequestMediaByTenant = listMarketRequestMediaByTenant;

function listActiveMarketListingSavesByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListActiveMarketListingSavesByTenant', inputVars, inputOpts);
}
exports.listActiveMarketListingSavesByTenant = listActiveMarketListingSavesByTenant;

function listActiveMarketListingSavesByUserAndListing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListActiveMarketListingSavesByUserAndListing', inputVars, inputOpts);
}
exports.listActiveMarketListingSavesByUserAndListing = listActiveMarketListingSavesByUserAndListing;

function listActiveMarketListingContactsByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListActiveMarketListingContactsByTenant', inputVars, inputOpts);
}
exports.listActiveMarketListingContactsByTenant = listActiveMarketListingContactsByTenant;

function listActiveMarketRequestContactsByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListActiveMarketRequestContactsByTenant', inputVars, inputOpts);
}
exports.listActiveMarketRequestContactsByTenant = listActiveMarketRequestContactsByTenant;

function createMarketListing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateMarketListing', inputVars, inputOpts);
}
exports.createMarketListing = createMarketListing;

function createMarketListingMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateMarketListingMedia', inputVars, inputOpts);
}
exports.createMarketListingMedia = createMarketListingMedia;

function createMarketRequest(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateMarketRequest', inputVars, inputOpts);
}
exports.createMarketRequest = createMarketRequest;

function createMarketRequestMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateMarketRequestMedia', inputVars, inputOpts);
}
exports.createMarketRequestMedia = createMarketRequestMedia;

function updateMarketListingDetails(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateMarketListingDetails', inputVars, inputOpts);
}
exports.updateMarketListingDetails = updateMarketListingDetails;

function updateMarketRequestDetails(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateMarketRequestDetails', inputVars, inputOpts);
}
exports.updateMarketRequestDetails = updateMarketRequestDetails;

function markMarketListingSold(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkMarketListingSold', inputVars, inputOpts);
}
exports.markMarketListingSold = markMarketListingSold;

function softDeleteMarketListing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SoftDeleteMarketListing', inputVars, inputOpts);
}
exports.softDeleteMarketListing = softDeleteMarketListing;

function softDeleteMarketRequest(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SoftDeleteMarketRequest', inputVars, inputOpts);
}
exports.softDeleteMarketRequest = softDeleteMarketRequest;

function softDeleteMarketListingMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SoftDeleteMarketListingMedia', inputVars, inputOpts);
}
exports.softDeleteMarketListingMedia = softDeleteMarketListingMedia;

function softDeleteMarketRequestMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SoftDeleteMarketRequestMedia', inputVars, inputOpts);
}
exports.softDeleteMarketRequestMedia = softDeleteMarketRequestMedia;

function createMarketListingSave(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateMarketListingSave', inputVars, inputOpts);
}
exports.createMarketListingSave = createMarketListingSave;

function softDeleteMarketListingSave(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SoftDeleteMarketListingSave', inputVars, inputOpts);
}
exports.softDeleteMarketListingSave = softDeleteMarketListingSave;

function createMarketListingContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateMarketListingContact', inputVars, inputOpts);
}
exports.createMarketListingContact = createMarketListingContact;

function createMarketRequestContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateMarketRequestContact', inputVars, inputOpts);
}
exports.createMarketRequestContact = createMarketRequestContact;

