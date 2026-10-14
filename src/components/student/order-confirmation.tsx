"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

type FulfillmentStatus = "queued" | "printing" | "ready" | "collected" | "cancelled";

export type ConfirmedOrder = {
  id: string;
  trackingToken: string;
  collectionCode: string;
  createdAt: string;
  customerName: string;
  fileName: string;
  pages: number;
  copies: number;
  amountPaise: number;
};

type TrackingState = {
  paymentStatus: string;
  fulfillmentStatus: FulfillmentStatus;
  createdAt: string;
  collectionCode: string | null;
};

function displayCode(code: string) {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

function displayTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function statusText(status: FulfillmentStatus) {
  if (status === "printing") return "The shop is printing your order";
  if (status === "ready") return "Ready for pickup";
  if (status === "collected") return "Collected";
  if (status === "cancelled") return "Cancelled — contact the shop";
  return "Accepted · waiting for the shop to start";
}

export default function OrderConfirmation({ order }: { order: ConfirmedOrder }) {
  const [tracking, setTracking] = useState<TrackingState>({
    paymentStatus: "paid",
    fulfillmentStatus: "queued",
    createdAt: order.createdAt,
    collectionCode: order.collectionCode,
  });
  const [trackingError, setTrackingError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      try {
        const response = await fetch(`/api/orders/${order.id}/tracking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingToken: order.trackingToken }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Tracking unavailable");
        const result = await response.json() as TrackingState;
        if (!stopped) {
          setTracking(result);
          setTrackingError(false);
        }
      } catch {
        if (!stopped) setTrackingError(true);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 10_000);
      }
    }

    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [order.id, order.trackingToken]);

  const status = tracking.fulfillmentStatus;
  const isPrinting = status === "printing";
  const isReady = status === "ready" || status === "collected";
  const isCollected = status === "collected";
  const isCancelled = status === "cancelled";

  return <main className="student-page student-confirmation-page">
    <header className="student-header">
      <Link href="/" className="student-brand"><span className="student-brand-mark"><span /></span>printify<span className="student-brand-dot">.</span></Link>
      <div className="student-header-actions"><Link className="student-account-nav" href="/student/account">My account</Link><a className="student-shop-link" href="https://wa.me/919268729970" target="_blank" rel="noopener noreferrer">Need help?</a></div>
    </header>

    <section className="student-confirmation-hero">
      <div className="student-confirmation-check" aria-hidden="true">✓</div>
      <span className="student-eyebrow">ORDER ACCEPTED · PF-{order.id.slice(0, 8).toUpperCase()}</span>
      <h1>Your prints are<br/><em>in the queue.</em></h1>
      <p>Campus Print House has received your order. Keep this page open for live status updates.</p>
      <div className="student-demo-payment-note">Demo payment confirmed · No real money was charged.</div>
    </section>

    <div className="student-steps student-confirmation-steps" aria-label="Order progress">
      <div className="student-step student-step-active student-step-complete"><span>✓</span><b>Upload</b></div><i className="is-complete"/>
      <div className="student-step student-step-active student-step-complete"><span>✓</span><b>Pay</b></div><i className="is-complete"/>
      <div className={`student-step ${isReady ? "student-step-active" : ""}`}><span>{isReady ? "✓" : "03"}</span><b>Pick up</b></div>
    </div>

    <div className="student-confirmation-grid">
      <section className="student-confirmation-card student-live-timeline" aria-labelledby="tracking-title">
        <div className="student-confirmation-card-heading">
          <div><span className="student-eyebrow">LIVE ORDER STATUS</span><h2 id="tracking-title">Your pickup timeline</h2></div>
          <span className="student-live-pill"><i/>Live</span>
        </div>
        <div className={`student-current-status ${isCancelled ? "is-cancelled" : ""}`}><small>Current status</small><strong>{statusText(status)}</strong><span>{trackingError ? "Reconnecting to shop updates…" : "This timeline refreshes automatically."}</span></div>
        <ol className="student-timeline">
          <li className="is-complete"><span className="student-timeline-marker">✓</span><div><b>Order received</b><small>Order placed at {displayTime(tracking.createdAt)} · {order.customerName}</small></div></li>
          <li className={isPrinting ? "is-current" : isReady ? "is-complete" : ""}><span className="student-timeline-marker">{isPrinting || isReady ? "✓" : "02"}</span><div><b>Printing</b><small>{isPrinting ? "The shop has started printing your pages." : isReady ? "Printing is complete." : "Waiting for the shop to start printing."}</small></div></li>
          <li className={`${status === "ready" ? "is-current" : isCollected ? "is-complete" : ""}`}><span className="student-timeline-marker">{isReady ? "✓" : "03"}</span><div><b>Ready for pickup</b><small>{isReady ? "Your prints are ready at Campus Print House." : "We’ll update this when the shop marks your order ready."}</small></div></li>
          <li className={isCollected ? "is-complete" : ""}><span className="student-timeline-marker">{isCollected ? "✓" : "04"}</span><div><b>Picked up</b><small>{isCollected ? "Pickup has been confirmed by the shop." : "Show your collection code when you arrive."}</small></div></li>
        </ol>
        <p className="student-eta-note">The shop hasn’t provided a precise ready time yet. The status above changes when they update your order.</p>
      </section>

      <aside className="student-confirmation-card student-confirmation-summary">
        <span className="student-eyebrow">YOUR ORDER</span>
        <h2>Pickup details</h2>
        <div className="student-confirmation-shop"><span>⌂</span><div><b>Campus Print House</b><small>Student Centre · Open until 8:00 PM</small></div></div>
        <div className="student-collection-code"><small>{isCollected ? "COLLECTED" : "YOUR COLLECTION CODE"}</small><strong>{tracking.collectionCode ? displayCode(tracking.collectionCode) : displayCode(order.collectionCode)}</strong><span>{isCollected ? "This code has been used." : "Show this code to the shopkeeper when your prints are ready."}</span></div>
        <dl className="student-confirmation-details">
          <div><dt>Document</dt><dd title={order.fileName}>{order.fileName}</dd></div>
          <div><dt>Pages · copies</dt><dd>{order.pages} · {order.copies}</dd></div>
          <div><dt>Total</dt><dd>{formatRupees(order.amountPaise)}</dd></div>
          <div><dt>Order placed</dt><dd>{displayTime(tracking.createdAt)}</dd></div>
          <div><dt>Payment</dt><dd>{tracking.paymentStatus === "paid" ? "Confirmed · demo" : tracking.paymentStatus}</dd></div>
        </dl>
        <button type="button" className="student-new-order" onClick={() => window.location.assign("/")}>Place another order <span>→</span></button>
      </aside>
    </div>

    <footer className="student-footer"><span>© 2026 Printify · v{APP_VERSION}</span><span>Made for a smoother campus day <i>✳</i></span><span>Need help? <a href="https://wa.me/919268729970" target="_blank" rel="noopener noreferrer">Get in touch</a></span></footer>
  </main>;
}
