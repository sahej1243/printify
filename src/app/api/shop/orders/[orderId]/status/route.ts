import { NextResponse, type NextRequest } from "next/server";
import { getShopkeeperContext } from "@/lib/shopkeeper";
import { createAdminClient } from "@/lib/supabase/admin";

type FulfillmentAction = "printing" | "ready";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getShopkeeperContext();
  if (!context?.assignment) return NextResponse.json({ error: "Sign in with an assigned shop account." }, { status: 401 });

  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  let body: { status?: FulfillmentAction };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (body.status !== "printing" && body.status !== "ready") return NextResponse.json({ error: "Unsupported order status." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("payment_status,fulfillment_status")
    .eq("id", orderId)
    .eq("shop_id", context.assignment.shop_id)
    .maybeSingle();
  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const expected = body.status === "printing" ? "queued" : "printing";
  if (order.payment_status !== "paid") return NextResponse.json({ error: "Only verified paid orders can be printed." }, { status: 403 });
  if (order.fulfillment_status !== expected) return NextResponse.json({ error: "This order has already changed. Refresh the queue and try again." }, { status: 409 });

  const { data: updated, error: updateError } = await admin.from("orders")
    .update({ fulfillment_status: body.status })
    .eq("id", orderId)
    .eq("shop_id", context.assignment.shop_id)
    .eq("payment_status", "paid")
    .eq("fulfillment_status", expected)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) return NextResponse.json({ error: "Could not update this order. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ status: body.status }, { headers: { "Cache-Control": "no-store" } });
}
