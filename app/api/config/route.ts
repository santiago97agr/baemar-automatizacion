import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { getEnabledIntegrations } from "@/lib/integrations/registry";

export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  try {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    const integrations = getEnabledIntegrations().map((i) => ({
      type: i.type,
      enabled: true,
    }));

    return NextResponse.json({ categories, integrations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
