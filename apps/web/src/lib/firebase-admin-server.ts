import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp as getSharedFirebaseAdminApp } from "@vyb/config";

export function getFirebaseAdminApp() {
  return getSharedFirebaseAdminApp("web-auth");
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminStorageBucket() {
  return getStorage(getFirebaseAdminApp()).bucket();
}
