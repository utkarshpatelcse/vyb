import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp as getSharedFirebaseAdminApp } from "@vyb/config";

export function getFirebaseAdminApp() {
  return getSharedFirebaseAdminApp("web-auth");
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminDatabase() {
  return getDatabase(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseAdminStorageBucket() {
  return getStorage(getFirebaseAdminApp()).bucket();
}
