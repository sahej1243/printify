import { NextResponse, type NextRequest } from "next/server";
import { getShopkeeperContext } from "@/lib/shopkeeper";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getShopkeeperContext();
  if (!context?.assignment) return NextResponse.json({ error: "Sign in with an assigned shop account." }, { status: 401 });

  let body: { isOpen?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (typeof body.isOpen !== "boolean") return NextResponse.json({ error: "Invalid shop status." }, { status: 400 });

  const { data, error } = await createAdminClient().from("shops")
    .update({ is_open: body.isOpen })
    .eq("id", context.assignment.shop_id)
    .select("is_open")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Could not update this shop." }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
