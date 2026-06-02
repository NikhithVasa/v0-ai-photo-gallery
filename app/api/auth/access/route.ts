import { NextResponse } from "next/server";
import { getAuthAccess, unauthorizedResponse } from "@/lib/auth-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    return NextResponse.json({
      email: access.email,
      isAdmin: access.isAdmin,
      customerIds: access.isAdmin ? [] : access.customerIds,
    });
  } catch (error) {
    console.error("Error resolving auth access:", error);
    return NextResponse.json(
      { error: "Failed to resolve auth access" },
      { status: 500 },
    );
  }
}
