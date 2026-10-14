import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { sha256 } from "@/lib/security";

export const runtime = "nodejs";

function parsePages(input: unknown, pageCount: number): number[] | null {
  if (input === "all") return Array.from({ length: pageCount }, (_, index) => index + 1);
  if (typeof input !== "string" || !input.trim()) return null;
  const pages = new Set<number>();
  for (const section of input.split(",")) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(section.trim());
    if (!match) return null;
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < start || end > pageCount) return null;
    for (let page = start; page <= end; page += 1) {
      if (pages.has(page)) return null;
      pages.add(page);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  let body: { uploadIntentId?: string; customerName?: string; pageSelection?: string; copies?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid order request." }, { status: 400 }); }
  const name = body.customerName?.trim() ?? "";
  if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Enter your name (2–100 characters)." }, { status: 400 });
  if (!body.uploadIntentId || !/^[0-9a-f-]{36}$/i.test(body.uploadIntentId)) return NextResponse.json({ error: "Upload your PDF again before submitting." }, { status: 400 });
  const copies = Number(body.copies);
  if (!Number.isInteger(copies) || copies < 1 || copies > 20) return NextResponse.json({ error: "Copies must be between 1 and 20." }, { status: 400 });

  const admin = createAdminClient();
  const { data: intent, error: intentError } = await admin.from("upload_intents").select("id,shop_id,storage_path,original_filename,expected_size_bytes,expires_at,consumed_at").eq("id", body.uploadIntentId).maybeSingle();
  if (intentError || !intent || intent.consumed_at || new Date(intent.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Your upload expired. Please upload the PDF again." }, { status: 410 });

  const { data: file, error: downloadError } = await admin.storage.from("order-pdfs").download(intent.storage_path);
  if (downloadError || !file || file.size !== intent.expected_size_bytes || file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "The PDF upload is incomplete. Please upload it again." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "The uploaded file is not a valid PDF." }, { status: 400 });

  let pageCount: number;
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
    pageCount = pdf.numPages;
    pdf.cleanup();
  } catch (error) {
    // Keep parser details in server logs for diagnosis; never expose them to students.
    console.error("[orders] PDF validation failed", error);
    return NextResponse.json({ error: "We could not read this PDF. Password-protected or damaged files are not supported." }, { status: 400 });
  }
  if (pageCount < 1 || pageCount > 10000) return NextResponse.json({ error: "This PDF must have between 1 and 10,000 pages." }, { status: 400 });
  const selectedPages = parsePages(body.pageSelection, pageCount);
  if (!selectedPages?.length) return NextResponse.json({ error: "Choose a valid page selection for this PDF." }, { status: 400 });

  const { data: shop, error: shopError } = await admin.from("shops").select("id,is_active,is_open,price_per_page_paise").eq("id", intent.shop_id).maybeSingle();
  if (shopError || !shop || !shop.is_active || !shop.is_open) return NextResponse.json({ error: "The print shop is currently unavailable." }, { status: 409 });

  // Consume the temporary upload exactly once before creating its order.
  const { data: consumed, error: consumeError } = await admin.from("upload_intents").update({ consumed_at: new Date().toISOString() }).eq("id", intent.id).is("consumed_at", null).gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
  if (consumeError || !consumed) return NextResponse.json({ error: "This upload has already been submitted or expired. Please upload again." }, { status: 409 });

  const trackingToken = randomBytes(32).toString("base64url");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: order, error: orderError } = await admin.from("orders").insert({
    idempotency_key: randomUUID(), shop_id: shop.id, customer_name: name,
    original_filename: intent.original_filename, document_path: intent.storage_path,
    file_size_bytes: intent.expected_size_bytes, page_count: pageCount,
    selected_pages: selectedPages, copies, unit_price_paise: shop.price_per_page_paise,
    payment_status: "pending", fulfillment_status: "queued", tracking_token_hash: sha256(trackingToken),
    student_user_id: user && user.user_metadata?.save_order_history !== false ? user.id : null,
  }).select("id,amount_paise,created_at").single();
  if (orderError || !order) return NextResponse.json({ error: "Your order could not be saved. Please try again with a fresh upload." }, { status: 503 });

  return NextResponse.json({ orderId: order.id, amountPaise: order.amount_paise, createdAt: order.created_at, trackingToken, status: "payment_pending" }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
