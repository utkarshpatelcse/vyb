import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDataConnect } from "firebase-admin/data-connect";
import { loadRootEnv } from "./root-env.mjs";

function toNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizePrivateKey(value) {
  const normalized = toNonEmptyString(value);
  return normalized ? normalized.replace(/\\n/g, "\n") : null;
}

function readServiceAccountFromEnv() {
  loadRootEnv();

  const inlineJson =
    toNonEmptyString(process.env.FIREBASE_ADMIN_CREDENTIALS_JSON) ??
    toNonEmptyString(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  if (inlineJson) {
    try {
      return JSON.parse(inlineJson);
    } catch (error) {
      throw new Error(
        `Invalid Firebase admin credentials JSON in environment: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  const base64Json =
    toNonEmptyString(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64) ??
    toNonEmptyString(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);

  if (base64Json) {
    try {
      return JSON.parse(Buffer.from(base64Json, "base64").toString("utf8"));
    } catch (error) {
      throw new Error(
        `Invalid base64 Firebase admin credentials in environment: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  const projectId =
    toNonEmptyString(process.env.FIREBASE_PROJECT_ID) ??
    toNonEmptyString(process.env.GOOGLE_CLOUD_PROJECT) ??
    toNonEmptyString(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const clientEmail =
    toNonEmptyString(process.env.FIREBASE_ADMIN_CLIENT_EMAIL) ??
    toNonEmptyString(process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) ??
    toNonEmptyString(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey =
    normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY) ??
    normalizePrivateKey(process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) ??
    normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
      privateKeyId:
        toNonEmptyString(process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID) ??
        toNonEmptyString(process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY_ID) ??
        undefined,
      clientId:
        toNonEmptyString(process.env.FIREBASE_ADMIN_CLIENT_ID) ??
        toNonEmptyString(process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_ID) ??
        undefined
    };
  }

  return null;
}

function resolveFirebaseCredential() {
  const serviceAccount = readServiceAccountFromEnv();
  return serviceAccount ? cert(serviceAccount) : applicationDefault();
}

function buildFirebaseAdminOptions() {
  loadRootEnv();
  return {
    credential: resolveFirebaseCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL ?? process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
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
