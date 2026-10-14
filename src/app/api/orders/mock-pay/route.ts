import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpayCredentialsPresent } from "@/lib/razorpay";
import { createCollectionCode, encryptCollectionCode, hashCollectionCode } from "@/lib/collection-code";
import { sha256 } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Demo-only mock payment endpoint.
 * Automatically disabled the moment real Razorpay credentials are set.
 * Marks a pending order as paid so the shop dashboard can process it.
 */
export async function POST(request: NextRequest) {
  // Safety: instantly disabled once real Razorpay keys are configured.
  if (razorpayCredentialsPresent()) {
    return NextResponse.json(
      { error: "Mock payments are disabled. Use the real payment gateway." },
      { status: 403 }
    );
  }

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: { orderId?: string; trackingToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { orderId } = body;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId) || typeof body.trackingToken !== "string" || body.trackingToken.length < 40 || body.trackingToken.length > 100) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Only mark genuinely pending orders as paid — never double-pay.
  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("id, payment_status, amount_paise, tracking_token_hash")
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .maybeSingle();

  if (fetchError || !order || order.tracking_token_hash !== sha256(body.trackingToken)) {
    return NextResponse.json(
      { error: "Order not found or already processed." },
      { status: 404 }
    );
  }

  const collectionCode = createCollectionCode();
  const { data: updatedOrder, error: updateError } = await admin
    .from("orders")
    .update({
      payment_status: "paid",
      collection_code_hash: hashCollectionCode(collectionCode),
      collection_code_ciphertext: encryptCollectionCode(collectionCode, body.trackingToken),
      collection_code_issued_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .eq("tracking_token_hash", sha256(body.trackingToken))
    .select("id")
    .maybeSingle(); // double-check — prevent races

  if (updateError || !updatedOrder) {
    return NextResponse.json(
      { error: "Could not confirm payment. Please try again." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { success: true, orderId, amountPaise: order.amount_paise, collectionCode },
    { headers: { "Cache-Control": "no-store" } }
  );
}
