import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let body: { fileName?: string; fileSize?: number; mimeType?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid upload request." }, { status: 400 }); }
  const fileName = body.fileName?.trim() ?? "";
  const fileSize = Number(body.fileSize);
  if (!fileName.toLowerCase().endsWith(".pdf") || (body.mimeType && body.mimeType !== "application/pdf")) return NextResponse.json({ error: "Only PDF documents can be printed." }, { status: 400 });
  if (!Number.isInteger(fileSize) || fileSize < 8 || fileSize > 25 * 1024 * 1024) return NextResponse.json({ error: "PDF files must be 25 MB or smaller." }, { status: 400 });

  const admin = createAdminClient();
  const { data: shop, error: shopError } = await admin.from("shops").select("id,is_active,is_open").eq("slug", "campus-print-house").maybeSingle();
  if (shopError || !shop) return NextResponse.json({ error: "The print shop is not configured yet." }, { status: 503 });
  if (!shop.is_active || !shop.is_open) return NextResponse.json({ error: "The print shop is currently closed to new orders." }, { status: 409 });

  const uploadIntentId = randomUUID();
  const storagePath = `incoming/${uploadIntentId}/${randomBytes(16).toString("hex")}.pdf`;
  const { data: upload, error: uploadError } = await admin.storage.from("order-pdfs").createSignedUploadUrl(storagePath, { upsert: false });
  if (uploadError || !upload) return NextResponse.json({ error: "Could not prepare a private PDF upload." }, { status: 503 });

  const { error: insertError } = await admin.from("upload_intents").insert({
    id: uploadIntentId,
    shop_id: shop.id,
    storage_path: storagePath,
    original_filename: fileName.slice(0, 180),
    expected_size_bytes: fileSize,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (insertError) {
    await admin.storage.from("order-pdfs").remove([storagePath]);
    return NextResponse.json({ error: "Could not prepare your upload. Please retry." }, { status: 503 });
  }

  return NextResponse.json({ uploadIntentId, path: storagePath, token: upload.token }, { headers: { "Cache-Control": "no-store" } });
}
