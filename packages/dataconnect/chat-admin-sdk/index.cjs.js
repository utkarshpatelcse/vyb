const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'chat',
  serviceId: 'vyb',
  location: 'asia-south1'
};
exports.connectorConfig = connectorConfig;

function listChatIdentitiesByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListChatIdentitiesByTenant', inputVars, inputOpts);
}
exports.listChatIdentitiesByTenant = listChatIdentitiesByTenant;

function listChatConversationsByTenant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListChatConversationsByTenant', inputVars, inputOpts);
}
exports.listChatConversationsByTenant = listChatConversationsByTenant;

function listChatParticipantsByMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListChatParticipantsByMembership', inputVars, inputOpts);
}
exports.listChatParticipantsByMembership = listChatParticipantsByMembership;

function listChatParticipantsByConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListChatParticipantsByConversation', inputVars, inputOpts);
}
exports.listChatParticipantsByConversation = listChatParticipantsByConversation;

function listChatMessagesByConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListChatMessagesByConversation', inputVars, inputOpts);
}
exports.listChatMessagesByConversation = listChatMessagesByConversation;

function listChatMessageReactionsByConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListChatMessageReactionsByConversation', inputVars, inputOpts);
}
exports.listChatMessageReactionsByConversation = listChatMessageReactionsByConversation;

function listExpiredChatMessages(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListExpiredChatMessages', inputVars, inputOpts);
}
exports.listExpiredChatMessages = listExpiredChatMessages;

function createChatMessage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateChatMessage', inputVars, inputOpts);
}
exports.createChatMessage = createChatMessage;

function updateChatMessageLifecycle(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateChatMessageLifecycle', inputVars, inputOpts);
}
exports.updateChatMessageLifecycle = updateChatMessageLifecycle;

