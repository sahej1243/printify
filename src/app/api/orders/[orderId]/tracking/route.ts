import { NextResponse, type NextRequest } from "next/server";
import { decryptCollectionCode } from "@/lib/collection-code";
import { sha256 } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { orderId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  let body: { trackingToken?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid tracking request." }, { status: 400 }); }
  const trackingToken = body.trackingToken;
  if (typeof trackingToken !== "string" || trackingToken.length < 40 || trackingToken.length > 100) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("id,payment_status,fulfillment_status,created_at,collection_code_ciphertext")
    .eq("id", orderId)
    .eq("tracking_token_hash", sha256(trackingToken))
    .maybeSingle();
  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  let collectionCode: string | null = null;
  if (order.collection_code_ciphertext) {
    try { collectionCode = decryptCollectionCode(order.collection_code_ciphertext, trackingToken); } catch { /* Keep the status available if an old code cannot be decrypted. */ }
  }

  return NextResponse.json({
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    createdAt: order.created_at,
    collectionCode,
  }, { headers: { "Cache-Control": "no-store" } });
}
