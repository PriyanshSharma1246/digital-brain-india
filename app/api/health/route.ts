import { NextResponse } from "next/server";
import { validateProductionEnvironment } from "@/lib/environment";

export const dynamic = "force-dynamic";

export async function GET() {
  const environment = validateProductionEnvironment();
  const status = environment.valid || process.env.NODE_ENV !== "production" ? 200 : 503;

  return NextResponse.json(
    {
      status: status === 200 ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      environment: { valid: environment.valid, missing: environment.missing },
    },
    { status }
  );
}
