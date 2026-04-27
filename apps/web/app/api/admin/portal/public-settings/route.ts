import { NextResponse } from "next/server";
import { getPublicMaintenanceState } from "../../../../../src/lib/super-admin-store";

export async function GET() {
  return NextResponse.json({
    maintenance: await getPublicMaintenanceState()
  });
}
