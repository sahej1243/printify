import { createHash } from "node:crypto";
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

  let body: { code?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const code = body.code?.replace(/\s/g, "") ?? "";
  if (!/^\d{8}$/.test(code)) return NextResponse.json({ error: "Enter the eight-digit collection code." }, { status: 400 });

  const hash = createHash("sha256").update(code).digest("hex");
  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("id,customer_name,fulfillment_status,payment_status")
    .eq("shop_id", context.assignment.shop_id)
    .eq("collection_code_hash", hash)
    .maybeSingle();
  if (error || !order) return NextResponse.json({ error: "That collection code wasn't found for this shop." }, { status: 404 });
  if (order.payment_status !== "paid") return NextResponse.json({ error: "Payment has not been verified for this order." }, { status: 403 });
  if (order.fulfillment_status === "collected") return NextResponse.json({ error: "This order has already been collected." }, { status: 409 });
  if (order.fulfillment_status !== "ready") return NextResponse.json({ error: "This order is not ready for pickup yet." }, { status: 409 });

  const { data: updated, error: updateError } = await admin.from("orders")
    .update({ fulfillment_status: "collected", collected_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("shop_id", context.assignment.shop_id)
    .eq("payment_status", "paid")
    .eq("fulfillment_status", "ready")
    .is("collected_at", null)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) return NextResponse.json({ error: "This code was just used. Refresh the order queue." }, { status: 409 });
  return NextResponse.json({ id: order.id, customer: order.customer_name || "Student" }, { headers: { "Cache-Control": "no-store" } });
}
