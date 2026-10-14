"use client";

import { useMemo, useState } from "react";
import { signOutShopkeeper } from "@/app/shop/actions";
import type { DashboardMetrics, PrintOrder } from "@/types/order";
import { APP_VERSION } from "@/lib/version";

function Icon({ name }: { name: "search" | "bell" | "file" | "print" | "check" | "chevron" | "clock" | "dots" | "arrow" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M8 14h8M8 18h6"/></>,
    print: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
  };
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function StatusPill({ status }: { status: PrintOrder["status"] }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}><span className="status-dot" />{status}</span>;
}

function OrderRow({ order, selected, onSelect }: { order: PrintOrder; selected: boolean; onSelect: () => void }) {
  return <button className={`order-row ${selected ? "order-row-selected" : ""}`} onClick={onSelect}>
    <span className={`avatar avatar-${order.accent}`}>{order.initials}</span>
    <span className="order-row-main"><span className="customer-name">{order.customer}</span><span className="order-row-meta">{order.id}<span className="meta-separator">·</span>{order.time}</span></span>
    <span className="row-chevron">›</span>
    <span className="sr-only">Select order {order.id}</span>
  </button>;
}

function DocumentPreview({ order, onLoad, loading }: { order: PrintOrder; onLoad: () => void; loading: boolean }) {
  return <div className="preview-wrap">
    {order.previewUrl ? <iframe className="private-pdf-frame" src={order.previewUrl} title={`Private PDF preview for ${order.fileName}`} /> : <div className="private-preview-empty"><span className="pdf-icon">PDF</span><strong>Private PDF preview</strong><small>Only assigned shop staff can open this paid order document.</small><button type="button" className="secondary-button" onClick={onLoad} disabled={loading}>{loading ? "Creating secure link…" : "Load private preview"}</button></div>}
    <div className="preview-caption"><span className="pdf-icon">PDF</span><span><strong>{order.fileName}</strong><small>A4 · Black &amp; white · {order.pages} selected pages</small></span><span className="preview-lock">Private preview</span></div>
  </div>;
}

function AnalyticsPanel({ metrics }: { metrics: DashboardMetrics }) {
  const chartMaximum = Math.max(...metrics.weeklyPages, 1);
  const chartPoints = metrics.weeklyPages.map((value, index) => `${index === 0 ? "M" : "L"}${(index * 280) / Math.max(metrics.weeklyPages.length - 1, 1)},${90 - (value / chartMaximum) * 76}`).join(" ");
  const chartArea = `${chartPoints} L280,100 L0,100 Z`;
  const chartLabels = [chartMaximum, Math.round(chartMaximum * 0.75), Math.round(chartMaximum * 0.5), Math.round(chartMaximum * 0.25), 0];
  return <aside className="analytics-panel">
    <div className="panel-title"><div><span className="eyebrow">YOUR SHOP</span><h2>Today at a glance</h2></div><button className="icon-button" aria-label="More analytics options"><Icon name="dots"/></button></div>
    <div className="saved-card"><div className="saved-card-top"><span className="metric-icon"><Icon name="clock"/></span><span className="live-label"><span /> TODAY</span></div><div className="saved-time">{metrics.timeSavedMinutes}<small>m</small></div><p>estimated time saved · 8 min per pickup</p><div className="saved-progress"><span style={{ width: `${Math.min(metrics.completedOrders * 4, 100)}%` }}/></div><small className="saved-note">Estimate based on completed pickups.</small></div>
    <div className="metric-grid"><div className="metric-card"><span className="metric-label">Pages printed</span><strong>{metrics.pagesPrinted.toLocaleString("en-IN")}</strong><span className="metric-change positive">Today</span></div><div className="metric-card"><span className="metric-label">Orders completed</span><strong>{metrics.completedOrders.toLocaleString("en-IN")}</strong><span className="metric-change positive">Today</span></div></div>
    <div className="earnings-card"><div><span className="metric-label">Shop earnings today</span><strong>₹{metrics.earnings.toLocaleString("en-IN")}</strong></div><span className="earnings-mark">₹</span></div>
    <div className="chart-card"><div className="chart-heading"><div><span className="metric-label">Print activity</span><strong>Past 7 days</strong></div><span className="chart-key"><i /> Pages</span></div><div className="chart"><div className="chart-y-labels">{chartLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div><div className="chart-plot"><div className="chart-grid"><i/><i/><i/><i/><i/></div><svg viewBox="0 0 280 100" preserveAspectRatio="none" role="img" aria-label="Pages printed during the past seven days"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#758557" stopOpacity=".22"/><stop offset="1" stopColor="#758557" stopOpacity="0"/></linearGradient></defs><path d={chartArea} fill="url(#chartFill)"/><path d={chartPoints} fill="none" stroke="#758557" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x-labels">{metrics.weeklyLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div></div></div></div>
    <div className="analytics-foot"><span className="foot-check"><Icon name="check"/></span><span><strong>Looking good</strong><small>You&apos;re on track for a great day.</small></span></div>
  </aside>;
}

type DashboardProps = {
  initialOrders: PrintOrder[];
  metrics: DashboardMetrics;
  shopName: string;
  shopOpen: boolean;
  accountName: string;
  todayLabel: string;
  demo?: boolean;
};

export default function Dashboard({ initialOrders, metrics, shopName, shopOpen, accountName, todayLabel, demo = false }: DashboardProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [isShopOpen, setIsShopOpen] = useState(shopOpen);
  const [selectedId, setSelectedId] = useState(initialOrders[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"Active" | "Completed">("Active");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [shopStatusLoading, setShopStatusLoading] = useState(false);
  const selectedOrder = orders.find((order) => order.id === selectedId) ?? orders[0];
  const visibleOrders = useMemo(() => orders.filter((order) => activeTab === "Completed" ? order.status === "Collected" : order.status !== "Collected").filter((order) => `${order.customer} ${order.fileName} ${order.id}`.toLowerCase().includes(query.toLowerCase())), [orders, activeTab, query]);

  async function updateStatus(status: PrintOrder["status"]) {
    if (demo) { setNotice("This is a read-only demo. Live order controls appear after shop setup."); return; }
    if (!selectedOrder || actionLoading) return;
    const apiStatus = status === "Printing" ? "printing" : status === "Ready" ? "ready" : null;
    if (!apiStatus) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/shop/orders/${selectedOrder.databaseId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: apiStatus }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the order.");
      setOrders((current) => current.map((order) => order.databaseId === selectedOrder.databaseId ? { ...order, status } : order));
      setNotice(`${selectedOrder.id} marked ${status.toLowerCase()}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the order.");
    } finally {
      setActionLoading(false);
    }
  }

  async function verifyCode() {
    if (demo) { setNotice("Collection-code verification is available in the live shop dashboard."); return; }
    if (actionLoading || !code.trim()) return;
    setActionLoading(true);
    try {
      const response = await fetch("/api/shop/collect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not verify that code.");
      const match = orders.find((order) => order.databaseId === result.id);
      if (match) setSelectedId(match.id);
      setOrders((current) => current.map((order) => order.databaseId === result.id ? { ...order, status: "Collected" } : order));
      setActiveTab("Completed");
      setNotice(`${result.customer || "Student"}'s order was collected.`);
      setCode("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not verify that code.");
    } finally {
      setActionLoading(false);
    }
  }

  async function loadPreview() {
    if (demo) { setNotice("Private PDF previews are available for verified live orders."); return; }
    if (!selectedOrder || previewLoading) return;
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/shop/orders/${selectedOrder.databaseId}/preview`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not open private preview.");
      setOrders((current) => current.map((order) => order.databaseId === selectedOrder.databaseId ? { ...order, previewUrl: result.url } : order));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open private preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function toggleShopOpen() {
    if (demo) { setNotice("Shop availability is managed in the live shop dashboard."); return; }
    if (shopStatusLoading) return;
    setShopStatusLoading(true);
    try {
      const response = await fetch("/api/shop/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isOpen: !isShopOpen }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update shop status.");
      setIsShopOpen(result.is_open);
      setNotice(result.is_open ? "Your shop is now open for orders." : "Your shop is now closed to new orders.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update shop status.");
    } finally {
      setShopStatusLoading(false);
    }
  }

  function openPrintDocument() {
    if (!selectedOrder?.previewUrl) {
      setNotice("Load the private PDF preview first, then use your browser's print command.");
      return;
    }
    window.open(selectedOrder.previewUrl, "_blank", "noopener,noreferrer");
  }

  return <main className="dashboard-shell">
    <header className="topbar"><a href="#dashboard" className="brand"><span className="brand-mark"><span /></span><span>printify<span className="brand-dot">.</span></span><span className="brand-divider"/><span className="brand-context">Shop dashboard</span></a><div className="topbar-right"><div className="shop-select"><span className="shop-status-dot"/><span><strong>{shopName}</strong><small>{demo ? "Preview · sample data" : isShopOpen ? "Open for orders" : "Currently closed"}</small></span></div>{!demo && <form action={signOutShopkeeper}><button className="account-menu" type="submit"><span className="account-avatar">{accountName.slice(0, 1).toUpperCase()}</span><span><strong>{accountName}</strong><small>Shopkeeper · Sign out</small></span></button></form>}</div></header>
    <section className="welcome-bar"><div><div className="breadcrumb">Workspace <span>/</span> Orders</div><h1>Welcome, {accountName}</h1></div><div className="welcome-actions"><span className="date-chip"><Icon name="clock"/> {todayLabel}</span><button className="secondary-button" type="button" onClick={toggleShopOpen} disabled={shopStatusLoading}><span className="live-dot"/> Shop is {isShopOpen ? "open" : "closed"} · {shopStatusLoading ? "Saving…" : "Change"}</button></div></section>
    <section className="summary-strip"><div className="summary-item"><span className="summary-icon amber"><Icon name="file"/></span><span><small>Needs printing</small><strong>{orders.filter((o) => o.status === "Paid").length}<em> orders</em></strong></span></div><div className="summary-divider"/><div className="summary-item"><span className="summary-icon green"><Icon name="print"/></span><span><small>In progress</small><strong>{orders.filter((o) => o.status === "Printing").length}<em> orders</em></strong></span></div><div className="summary-divider"/><div className="summary-item"><span className="summary-icon blue"><Icon name="check"/></span><span><small>Ready for pickup</small><strong>{orders.filter((o) => o.status === "Ready").length}<em> orders</em></strong></span></div><div className="summary-spacer"/><span className="refresh-note"><span/> Updated just now</span></section>
    <div className="workspace-grid">
      <section className="orders-panel"><div className="section-heading"><div><span className="eyebrow">ORDER QUEUE</span><h2>Print orders <span className="count-badge">{visibleOrders.length}</span></h2></div><button className="filter-button">Today <Icon name="chevron"/></button></div>
        <div className="order-controls"><div className="tabs"><button className={activeTab === "Active" ? "tab active" : "tab"} onClick={() => setActiveTab("Active")}>Active <span>{orders.filter((o) => o.status !== "Collected").length}</span></button><button className={activeTab === "Completed" ? "tab active" : "tab"} onClick={() => setActiveTab("Completed")}>Completed <span>{orders.filter((o) => o.status === "Collected").length}</span></button></div><label className="search-box"><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders" aria-label="Search orders"/><kbd>⌘ K</kbd></label></div>
        <div className="orders-list">{visibleOrders.map((order) => <OrderRow key={order.id} order={order} selected={selectedId === order.id} onSelect={() => { setSelectedId(order.id); setNotice(""); }}/>) }{visibleOrders.length === 0 && <div className="empty-orders">No orders here yet.</div>}</div>
        <div className="collection-box"><div className="collection-box-heading"><span className="collection-icon"><Icon name="check"/></span><div><strong>Quick collect</strong><small>Enter a student&apos;s collection code</small></div></div><div className="code-entry"><input value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && verifyCode()} placeholder={demo ? "Live codes unavailable in preview" : "e.g. 482 916"} aria-label="Collection code"/><button onClick={verifyCode} disabled={!demo && !code.trim()}>Verify <span>→</span></button></div><small className="code-note">{demo ? "Preview only · no codes can be verified." : "Codes can only be used once."}</small></div>
      </section>
      <section className="document-panel"><div className="document-heading"><div><span className="eyebrow">ORDER DETAILS</span><h2>{selectedOrder?.id ?? "Select an order"}</h2></div>{selectedOrder && <StatusPill status={selectedOrder.status}/>}<button className="icon-button detail-more" aria-label="More order options"><Icon name="dots"/></button></div>
        {selectedOrder ? <><div className="customer-card"><span className={`avatar avatar-${selectedOrder.accent}`}>{selectedOrder.initials}</span><div className="customer-details"><strong>{selectedOrder.customer}</strong><span>Ordered {selectedOrder.time} <span className="meta-separator">·</span> Customer</span></div><span className="order-total">₹{selectedOrder.amount}</span></div><div className="print-specs"><div><span className="spec-icon"><Icon name="file"/></span><span><small>Pages</small><strong>{selectedOrder.pages} <em>pages</em></strong></span></div><i/><div><span className="spec-icon copy-icon">×{selectedOrder.copies}</span><span><small>Copies</small><strong>{selectedOrder.copies} <em>{selectedOrder.copies === 1 ? "copy" : "copies"}</em></strong></span></div><i/><div><span className="spec-icon format-icon">A4</span><span><small>Format</small><strong>Black &amp; white</strong></span></div></div>
        <DocumentPreview order={selectedOrder} onLoad={loadPreview} loading={previewLoading}/><div className="document-actions">{demo ? <span className="pending-note">Preview only. Live orders, private PDFs, and print controls require shop setup.</span> : selectedOrder.status === "Pending" && <span className="pending-note">Payment has not been confirmed yet. Printing is unavailable.</span>}{!demo && selectedOrder.status === "Paid" && <><button className="primary-button" onClick={openPrintDocument} disabled={actionLoading}><Icon name="print"/> Open PDF to print</button><button className="secondary-button" onClick={() => updateStatus("Printing")} disabled={actionLoading}>Start printing</button></>}{!demo && selectedOrder.status === "Printing" && <button className="primary-button" onClick={() => updateStatus("Ready")} disabled={actionLoading}><Icon name="check"/> Mark ready for pickup</button>}{!demo && selectedOrder.status === "Ready" && <span className="pending-note">Enter the student&apos;s collection code to complete pickup.</span>}{!demo && selectedOrder.status === "Collected" && <span className="collected-label"><span className="status-dot"/> Collected successfully</span>}<span className="secure-note"><span className="secure-lock">⌑</span> {demo ? "Demo · no documents" : "Secure private preview"}</span></div></> : <div className="empty-preview">Choose an order to view its details.</div>}
      </section>
      <AnalyticsPanel metrics={metrics}/>
    </div>
    {notice && <div role="status" className="toast"><span className="toast-check"><Icon name="check"/></span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
    <footer className="dashboard-footer"><span>Printify <span>·</span> Making print pickup simpler. <span>v{APP_VERSION}</span></span><span>Need help? <a href="https://wa.me/919268729970" target="_blank" rel="noopener noreferrer">Contact support</a></span></footer>
  </main>;
}
