import { NextResponse } from "next/server";
import { getAuthAccess, unauthorizedResponse } from "@/lib/auth-access";
import { apiErrorResponse } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    return NextResponse.json(
      {
        email: access.email,
        isAdmin: access.isAdmin,
        customerIds: access.isAdmin ? [] : access.customerIds,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Error resolving auth access:", error);
    return apiErrorResponse(error, {
      operation: "Could not resolve account access",
      stage: "checking your login session and customer permissions",
    });
  }
}
