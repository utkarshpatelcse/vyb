import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { ConnectorConfig, DataConnect } from "firebase-admin/data-connect";

export function loadRootEnv(): NodeJS.ProcessEnv;
export function getFirebaseAdminApp(name?: string): App;
export function getFirebaseAdminAuth(): Auth;
export function getFirebaseDataConnect(connectorConfig: ConnectorConfig): DataConnect;
export const defaultSuperAdminEmails: string[];
export function getSuperAdminEmails(): string[];
export function isSuperAdminEmail(email: string | null | undefined): boolean;

export interface MembershipContext {
  user: {
    id: string;
    primaryEmail: string;
    displayName?: string | null;
    status: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
  membership: {
    id: string;
    role: string;
    verificationStatus: string;
  } | null;
  communities: Array<{
    id: string;
    role: string;
    community: {
      id: string;
      name: string;
      slug: string;
      type: string;
      visibility: string;
      tenantId: string;
    };
  }>;
}

export function ensureMembershipContext(input: {
  firebaseUid: string;
  primaryEmail: string;
  displayName: string;
  role?: string;
}): Promise<MembershipContext>;
