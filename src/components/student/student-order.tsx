"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { parsePageRange } from "@/lib/page-range";
import { PLATFORM_FEE_PER_PAGE_PAISE, PRICE_PER_PAGE_PAISE, SHOP_PRICE_PER_PAGE_PAISE } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";
import { APP_VERSION } from "@/lib/version";
import OrderConfirmation, { type ConfirmedOrder } from "@/components/student/order-confirmation";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function FileIcon() {
  return <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M8 14h8M8 18h6"/></svg>;
}

function formatRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentOrder() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [rangeMode, setRangeMode] = useState<"all" | "custom">("all");
  const [rangeInput, setRangeInput] = useState("");
  const [copies, setCopies] = useState(1);
  const [fileError, setFileError] = useState("");
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Payment modal state
  const [pendingOrderId, setPendingOrderId] = useState("");
  const [pendingAmountPaise, setPendingAmountPaise] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [pendingCreatedAt, setPendingCreatedAt] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  useEffect(() => {
    let active = true;
    createClient().auth.getUser().then(({ data }) => {
      const savedName = data.user?.user_metadata?.full_name;
      if (active && typeof savedName === "string") setCustomerName((current) => current || savedName.slice(0, 100));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const parsedRange = useMemo(() => {
    if (!pageCount) return { selectedCount: 0, error: null } as const;
    return parsePageRange(rangeMode === "all" ? "all" : rangeInput, pageCount);
  }, [pageCount, rangeInput, rangeMode]);
  const totalSheets = parsedRange.selectedCount * copies;
  const amount = totalSheets * PRICE_PER_PAGE_PAISE;
  const shopAmount = totalSheets * SHOP_PRICE_PER_PAGE_PAISE;
  const platformFee = totalSheets * PLATFORM_FEE_PER_PAGE_PAISE;
  const orderReady = Boolean(file && pageCount && parsedRange.selectedCount && !fileError && !isReadingPdf);

  async function submitPrintRequest() {
    if (!file || !orderReady || submitting || !customerName.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const intentResponse = await fetch("/api/orders/upload-intent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type || "application/pdf" }),
      });
      const intent = await intentResponse.json();
      if (!intentResponse.ok) throw new Error(intent.error || "Could not prepare your upload.");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("order-pdfs").uploadToSignedUrl(intent.path, intent.token, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error("PDF upload failed. Please try again.");
      const orderResponse = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIntentId: intent.uploadIntentId, customerName: customerName.trim(), pageSelection: rangeMode === "all" ? "all" : rangeInput, copies }),
      });
      const result = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(result.error || "Could not submit your order.");
      // Show the mock payment modal
      setPendingOrderId(result.orderId);
      setPendingAmountPaise(result.amountPaise);
      setPendingCreatedAt(result.createdAt);
      setTrackingToken(result.trackingToken);
      setShowPayModal(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmMockPayment() {
    if (!pendingOrderId || paying) return;
    setPaying(true);
    setPayError("");
    try {
      const response = await fetch("/api/orders/mock-pay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: pendingOrderId, trackingToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment could not be confirmed.");
      setShowPayModal(false);
      setConfirmedOrder({
        id: pendingOrderId,
        trackingToken,
        collectionCode: result.collectionCode,
        createdAt: pendingCreatedAt || new Date().toISOString(),
        customerName: customerName.trim(),
        fileName: file?.name || "Your PDF",
        pages: parsedRange.selectedCount,
        copies,
        amountPaise: result.amountPaise,
      });
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  async function handleFile(candidate?: File) {
    setFileError("");
    setFile(null);
    setPageCount(0);
    setRangeInput("");
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".pdf") || (candidate.type && candidate.type !== "application/pdf")) {
      setFileError("Please choose a PDF document.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setFileError("This file is larger than 25 MB. Choose a smaller PDF.");
      return;
    }
    if (candidate.size < 8) {
      setFileError("This file does not look like a valid PDF.");
      return;
    }

    setIsReadingPdf(true);
    try {
      const bytes = new Uint8Array(await candidate.slice(0, 5).arrayBuffer());
      const signature = new TextDecoder().decode(bytes);
      if (!signature.startsWith("%PDF-")) throw new Error("This file does not contain a valid PDF header.");

      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const document = await pdfjs.getDocument({ data: new Uint8Array(await candidate.arrayBuffer()) }).promise;
      setFile(candidate);
      setPageCount(document.numPages);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not read this PDF.";
      setFileError(message.includes("Password") || message.includes("password") ? "Password-protected PDFs are not supported." : "We could not read this PDF. Please try another file.");
    } finally {
      setIsReadingPdf(false);
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  if (confirmedOrder) return <OrderConfirmation order={confirmedOrder} />;

  return <main className="student-page">
    <header className="student-header"><Link href="/" className="student-brand"><span className="student-brand-mark"><span /></span>printify<span className="student-brand-dot">.</span></Link><div className="student-header-actions"><Link className="student-account-nav" href="/student/account">My account</Link><a className="student-shop-link" href="https://wa.me/919268729970" target="_blank" rel="noopener noreferrer">Need help?</a></div></header>
    <section className="student-hero"><div className="student-hero-copy"><span className="student-eyebrow"><i /> CAMPUS PRINT HOUSE <span>·</span> OPEN TODAY</span><h1>Your prints,<br/><em>without the wait.</em></h1><p>Upload your document. We&apos;ll have it ready for pickup before you arrive.</p></div><div className="student-steps"><div className="student-step student-step-active"><span>01</span><b>Upload</b></div><i/><div className="student-step"><span>02</span><b>Pay</b></div><i/><div className="student-step"><span>03</span><b>Pick up</b></div></div></section>
    <div className="student-content"><section className="student-form-card"><div className="student-card-heading"><div><span className="student-eyebrow">YOUR ORDER</span><h2>Let&apos;s get printing</h2></div><span className="student-step-tag">STEP 1 OF 3</span></div>
      <div className="student-field"><label className="student-label">Pickup location <span>Required</span></label><button className="student-shop-option" type="button"><span className="student-shop-icon">⌂</span><span><b>Campus Print House</b><small>Student Centre · Open until 8:00 PM</small></span><span className="student-selected">Selected <i>✓</i></span></button></div>
      <div className="student-field"><label className="student-label" htmlFor="student-name">Your name <span>Required</span></label><input id="student-name" className="student-range-input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Name for pickup" maxLength={100} autoComplete="name" /></div>
      <div className="student-field"><label className="student-label" htmlFor="student-pdf">Your document <span>PDF · up to 25 MB</span></label><input ref={fileInput} id="student-pdf" className="student-file-input" type="file" accept=".pdf,application/pdf" onChange={onInputChange}/>{file ? <div className="student-file-ready"><span className="student-pdf-icon"><FileIcon/></span><span className="student-file-info"><b>{file.name}</b><small>{pageCount} pages <i>·</i> {formatBytes(file.size)}</small></span><button type="button" className="student-remove-file" aria-label="Remove document" onClick={() => { setFile(null); setPageCount(0); setRangeInput(""); setFileError(""); if (fileInput.current) fileInput.current.value = ""; }}>×</button></div> : <div className={`student-dropzone ${isDragging ? "student-dropzone-active" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} onClick={() => fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.current?.click(); } }}><span className="student-upload-icon"><FileIcon/></span><span><b>{isReadingPdf ? "Reading your PDF…" : "Drop your PDF here or browse"}</b><small>PDF only · Max file size 25 MB</small></span><span className="student-browse">Browse files</span></div>}{fileError && <p className="student-error" role="alert">{fileError}</p>}</div>
      <div className="student-field"><div className="student-label-row"><label className="student-label">Pages to print <span>{pageCount ? `${pageCount} pages in document` : "Choose your pages"}</span></label>{pageCount > 0 && <button className="student-all-link" type="button" onClick={() => { setRangeMode("all"); setRangeInput(""); }}>Select all</button>}</div><div className="student-range-options"><button type="button" onClick={() => setRangeMode("all")} className={`student-range-option ${rangeMode === "all" ? "selected" : ""}`}><span className="student-radio"/><span><b>All pages</b><small>{pageCount ? `${pageCount} pages` : "Print the whole document"}</small></span></button><button type="button" onClick={() => setRangeMode("custom")} className={`student-range-option ${rangeMode === "custom" ? "selected" : ""}`}><span className="student-radio"/><span><b>Choose pages</b><small>Pick a range</small></span></button></div>{rangeMode === "custom" && <div className="student-range-input-wrap"><input className="student-range-input" value={rangeInput} onChange={(event) => setRangeInput(event.target.value)} placeholder="e.g. 1-4, 7, 9-12" aria-label="Page range" inputMode="numeric"/><span>of {pageCount || "—"} pages</span></div>}{parsedRange.error && <p className="student-error" role="alert">{parsedRange.error}</p>}</div>
      <div className="student-field student-last-field"><label className="student-label">Number of copies <span>1–20 copies</span></label><div className="student-copy-controls"><span>Copies</span><div><button type="button" aria-label="Remove a copy" onClick={() => setCopies((value) => Math.max(1, value - 1))} disabled={copies <= 1}>−</button><output aria-live="polite">{copies}</output><button type="button" aria-label="Add a copy" onClick={() => setCopies((value) => Math.min(20, value + 1))} disabled={copies >= 20}>+</button></div></div></div>
    </section>
    <aside className="student-summary"><div className="student-summary-heading"><span className="student-eyebrow">ORDER SUMMARY</span><span className="student-price-tag">A4 · B&amp;W</span></div><h2>Your print details</h2><div className="student-summary-file"><span className="student-summary-file-icon"><FileIcon/></span><span>{file ? file.name : "Your PDF will appear here"}<small>{file ? `${pageCount} pages in document` : "Upload a PDF to get started"}</small></span></div><div className="student-summary-lines"><div><span>Selected pages</span><b>{parsedRange.selectedCount || "—"}</b></div><div><span>Copies</span><b>{copies}</b></div><div><span>Print type</span><b>A4 · Black &amp; white</b></div><div><span>Printing · ₹2 × {totalSheets || 0}</span><b>{formatRupees(shopAmount)}</b></div><div><span>Printify fee · ₹1 × {totalSheets || 0}</span><b>{formatRupees(platformFee)}</b></div><div className="student-summary-total"><span>Estimated total</span><b>{formatRupees(amount)}</b></div></div><p className="student-price-note">₹3 per page, per copy · ₹2 to the shop + ₹1 Printify fee.</p>
      <button className="student-continue" type="button" disabled={!orderReady || !customerName.trim() || submitting || Boolean(confirmedOrder)} onClick={submitPrintRequest}>{submitting ? "Uploading…" : "Request print"} <span>→</span></button>
      <div className="student-trust"><span>⌑</span><span>Your document stays private and is shared only with the shop printing your order.</span></div>
      {submitError && <div className="student-setup-note" role="alert"><b>Could not submit.</b><span>{submitError}</span></div>}
    </aside></div>
    <div className="student-mobile-checkout" aria-label="Order total and checkout"><div><span>Estimated total</span><b>{formatRupees(amount)}</b><small>{parsedRange.selectedCount || 0} pages · {copies} {copies === 1 ? "copy" : "copies"} · ₹3/page</small><small>₹2 shop + ₹1 Printify fee</small></div><button type="button" disabled={!orderReady || !customerName.trim() || submitting || Boolean(confirmedOrder)} onClick={submitPrintRequest}>{submitting ? "Uploading…" : "Request print"} <span>→</span></button>{submitError && <p className="student-mobile-checkout-notice" role="alert">{submitError}</p>}</div>
    <footer className="student-footer"><span>© 2026 Printify · v{APP_VERSION}</span><span>Made for a smoother campus day <i>✳</i></span><span>Need help? <a href="https://wa.me/919268729970" target="_blank" rel="noopener noreferrer">Get in touch</a></span></footer>

    {/* ── Mock payment modal ─────────────────────────────────────────── */}
    {showPayModal && (
      <div className="mock-pay-backdrop" role="dialog" aria-modal="true" aria-label="Complete payment">
        <div className="mock-pay-sheet">
          <div className="mock-pay-demo-badge">DEMO MODE · No real money charged</div>
          <div className="mock-pay-header">
            <div className="mock-pay-merchant">
              <span className="mock-pay-merchant-icon">⌑</span>
              <div>
                <b>Campus Print House</b>
                <small>Printify · Secure checkout</small>
              </div>
            </div>
            <div className="mock-pay-amount">{formatRupees(pendingAmountPaise)}</div>
            <p className="mock-pay-desc">
              {parsedRange.selectedCount} pages · {copies} {copies === 1 ? "copy" : "copies"} · A4 B&W
            </p>
          </div>

          <div className="mock-pay-methods">
            <div className="mock-pay-method mock-pay-method--active">
              <span className="mock-pay-method-icon">📱</span>
              <span>UPI</span>
              <span className="mock-pay-method-check">✓</span>
            </div>
            <div className="mock-pay-method">
              <span className="mock-pay-method-icon">💳</span>
              <span>Card</span>
            </div>
            <div className="mock-pay-method">
              <span className="mock-pay-method-icon">🏦</span>
              <span>Netbanking</span>
            </div>
          </div>

          <div className="mock-pay-upi-field">
            <label>UPI ID</label>
            <div className="mock-pay-upi-input">
              <span>student@upi</span>
              <span className="mock-pay-upi-verified">✓ Verified</span>
            </div>
          </div>

          {payError && <p className="mock-pay-error" role="alert">{payError}</p>}

          <button
            className="mock-pay-btn"
            onClick={confirmMockPayment}
            disabled={paying}
          >
            {paying ? "Processing…" : `Pay ${formatRupees(pendingAmountPaise)} (Demo)`}
          </button>
          <button
            className="mock-pay-cancel"
            onClick={() => setShowPayModal(false)}
            disabled={paying}
          >
            Cancel
          </button>
          <p className="mock-pay-notice">
            ⚠ This is a simulated payment for prototype demonstration only.
          </p>
        </div>
      </div>
    )}
  </main>;
}
