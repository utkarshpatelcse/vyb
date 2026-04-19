import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "ROUTE_DISABLED",
        message: "This route has been disabled."
      }
    },
    { status: 410 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: {
        code: "ROUTE_DISABLED",
        message: "This route has been disabled."
      }
    },
    { status: 410 }
  );
}
