import type { MembershipSummary } from "@vyb/contracts";

export type MarketViewerIdentity = {
  userId: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: MembershipSummary["role"];
};
