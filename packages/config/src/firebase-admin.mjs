import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDataConnect } from "firebase-admin/data-connect";
import { loadRootEnv } from "./root-env.mjs";

function buildFirebaseAdminOptions() {
  loadRootEnv();
  return {
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  };
}

export function getFirebaseAdminApp(name = "[DEFAULT]") {
  loadRootEnv();

  const existing = getApps().find((app) => app.name === name);
  if (existing) {
    return existing;
  }

  const options = buildFirebaseAdminOptions();
  return name === "[DEFAULT]" ? initializeApp(options) : initializeApp(options, name);
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

function buildDataConnectAppName(connectorConfig) {
  const connector = connectorConfig.connector ?? "default";
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "vyb";
  // Keep a distinct app per connector so admin Data Connect calls never share a cached connector instance.
  return `dc-${projectId}-${connectorConfig.serviceId}-${connectorConfig.location}-${connector}`;
}

export function getFirebaseDataConnect(connectorConfig) {
  return getDataConnect(connectorConfig, getFirebaseAdminApp(buildDataConnectAppName(connectorConfig)));
}
