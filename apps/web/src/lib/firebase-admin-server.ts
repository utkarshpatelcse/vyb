import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseAdminApp() {
  const existing = getApps().find((app) => app.name === "web-auth");
  if (existing) {
    return existing;
  }

  return initializeApp(
    {
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    },
    "web-auth"
  );
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}
