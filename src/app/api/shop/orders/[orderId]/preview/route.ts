import { NextResponse, type NextRequest } from "next/server";
import { getShopkeeperContext } from "@/lib/shopkeeper";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getShopkeeperContext();
  if (!context?.assignment) return NextResponse.json({ error: "Sign in with an assigned shop account." }, { status: 401 });
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("document_path,payment_status")
    .eq("id", orderId)
    .eq("shop_id", context.assignment.shop_id)
    .maybeSingle();
  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status !== "paid") return NextResponse.json({ error: "Only paid orders can be previewed." }, { status: 403 });

  const { data: signed, error: signedError } = await admin.storage.from("order-pdfs").createSignedUrl(order.document_path, 120);
  if (signedError || !signed) return NextResponse.json({ error: "Could not create a private preview link." }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}
