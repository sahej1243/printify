"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OrderRow = {
  id: string;
  customer_name: string | null;
  original_filename: string;
  page_count: number;
  selected_pages: number[];
  copies: number;
  amount_paise: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
};

function statusLabel(status: string) {
  if (status === "printing") return "Printing";
  if (status === "ready") return "Ready for pickup";
  if (status === "collected") return "Collected";
  if (status === "cancelled") return "Cancelled";
  return "Accepted · queued";
}

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

export default function StudentAccount({ name, email, updatesEnabled, orders }: { name: string; email: string; updatesEnabled: boolean; orders: OrderRow[] }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(name);
  const [saveHistory, setSaveHistory] = useState(updatesEnabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice(""); setError("");
    const { error: updateError } = await createClient().auth.updateUser({ data: { full_name: fullName.trim(), save_order_history: saveHistory } });
    if (updateError) setError("We couldn’t save your settings. Try again.");
    else setNotice("Your profile and settings are saved.");
    setBusy(false);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return <>
    <section className="student-account-welcome"><div><span className="student-eyebrow">YOUR PRINTIFY ACCOUNT</span><h1>Hi{fullName ? `, ${fullName.split(" ")[0]}` : " there"}.</h1><p>Your paid orders stay here when you come back.</p></div><button type="button" className="student-account-signout" onClick={signOut}>Sign out</button></section>
    <div className="student-account-layout">
      <section className="student-account-panel student-history-panel"><div className="student-account-panel-heading"><div><span className="student-eyebrow">YOUR ORDERS</span><h2>Print history</h2></div><span className="student-history-count">{orders.length} {orders.length === 1 ? "order" : "orders"}</span></div>
        {orders.length === 0 ? <div className="student-history-empty"><span>▤</span><b>No paid orders yet</b><p>Your new paid print orders will appear here.</p><Link href="/">Order prints <span>→</span></Link></div> : <div className="student-history-list">{orders.map((order) => <article className="student-history-item" key={order.id}>
          <div className="student-history-file-icon">▤</div><div className="student-history-main"><b title={order.original_filename}>{order.original_filename}</b><span>PF-{order.id.slice(0, 8).toUpperCase()} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(order.created_at))}</span><small>{order.selected_pages.length} pages · {order.copies} {order.copies === 1 ? "copy" : "copies"}</small></div><div className="student-history-state"><span className={`student-history-status status-${order.fulfillment_status}`}>{statusLabel(order.fulfillment_status)}</span><b>{money(order.amount_paise)}</b></div>
        </article>)}</div>}
        <p className="student-history-note">Showing your latest 100 paid orders. Files stay private to the print shop and are not downloadable from this account.</p>
      </section>

      <aside className="student-account-panel student-profile-panel"><span className="student-eyebrow">ACCOUNT ONLY</span><h2>Profile & settings</h2><p>These settings are private to your student account.</p><form className="student-account-form" onSubmit={saveSettings}><label htmlFor="student-profile-name">Your name</label><input id="student-profile-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={100}/><label htmlFor="student-profile-email">Email address</label><input id="student-profile-email" value={email} disabled readOnly/><label className="student-account-toggle"><input type="checkbox" checked={saveHistory} onChange={(event) => setSaveHistory(event.target.checked)}/><span><b>Save future orders to history</b><small>Turn this off to place orders without attaching them to this account.</small></span></label>{error && <p className="student-account-error" role="alert">{error}</p>}{notice && <p className="student-account-success" role="status">{notice}</p>}<button type="submit" disabled={busy}>{busy ? "Saving…" : "Save settings"}<span>→</span></button></form></aside>
    </div>
  </>;
}
