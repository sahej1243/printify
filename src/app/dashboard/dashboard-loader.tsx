import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard/dashboard";
import { getShopkeeperContext } from "@/lib/shopkeeper";
import type { DashboardMetrics, OrderStatus, PrintOrder } from "@/types/order";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  customer_name: string | null;
  original_filename: string;
  selected_pages: number[];
  copies: number;
  amount_paise: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
};

function indiaDayStart(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (kind: string) => parts.find((part) => part.type === kind)?.value;
  return new Date(`${value("year")}-${value("month")}-${value("day")}T00:00:00+05:30`);
}

function orderStatus(row: OrderRow): OrderStatus | null {
  if (row.payment_status === "pending") return "Pending";
  if (row.payment_status !== "paid") return null;
  if (row.fulfillment_status === "queued") return "Paid";
  if (row.fulfillment_status === "printing") return "Printing";
  if (row.fulfillment_status === "ready") return "Ready";
  if (row.fulfillment_status === "collected") return "Collected";
  return null;
}

function customerInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ST";
}

function relativeTime(date: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function DashboardLoader() {
  const context = await getShopkeeperContext();
  if (!context) redirect("/shop/login");
  if (!context.assignment) redirect("/shop/login?error=unassigned");

  const { supabase, assignment } = context;
  const [{ data: shop, error: shopError }, { data: rows, error: ordersError }] = await Promise.all([
    supabase.from("shops").select("id,name,is_open").eq("id", assignment.shop_id).maybeSingle(),
    supabase.from("orders")
      .select("id,customer_name,original_filename,selected_pages,copies,amount_paise,payment_status,fulfillment_status,created_at")
      .eq("shop_id", assignment.shop_id)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (shopError || ordersError || !shop) {
    return <main className="dashboard-setup-page"><section><span className="student-eyebrow">SHOP DASHBOARD SETUP</span><h1>One setup step remains.</h1><p>We couldn&apos;t load this shop&apos;s data. Apply the SQL migrations in <code>supabase/migrations</code> in filename order, then refresh. If you already did, check that this account is assigned in <code>shop_staff</code>.</p><a href="/shop/login">Return to sign in</a></section></main>;
  }

  const now = new Date();
  const nowMs = now.getTime();
  const todayStart = indiaDayStart(now);
  const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000);
  const validRows = (rows ?? []) as unknown as OrderRow[];
  const metrics: DashboardMetrics = {
    pagesPrinted: validRows.filter((row) => row.created_at >= todayStart.toISOString() && ["printing", "ready", "collected"].includes(row.fulfillment_status)).reduce((sum, row) => sum + row.selected_pages.length * row.copies, 0),
    completedOrders: validRows.filter((row) => row.created_at >= todayStart.toISOString() && row.fulfillment_status === "collected").length,
    earnings: Math.round(validRows.filter((row) => row.created_at >= todayStart.toISOString() && row.payment_status === "paid").reduce((sum, row) => sum + Number(row.amount_paise) - row.selected_pages.length * row.copies * 100, 0) / 100),
    timeSavedMinutes: validRows.filter((row) => row.created_at >= todayStart.toISOString() && row.fulfillment_status === "collected").length * 8,
    weeklyPages: Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart.getTime() + index * 86_400_000);
      const nextDay = new Date(day.getTime() + 86_400_000);
      return validRows.filter((row) => row.created_at >= day.toISOString() && row.created_at < nextDay.toISOString() && ["printing", "ready", "collected"].includes(row.fulfillment_status)).reduce((sum, row) => sum + row.selected_pages.length * row.copies, 0);
    }),
    weeklyLabels: Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "narrow" }).format(new Date(weekStart.getTime() + index * 86_400_000))),
  };

  const initialOrders: PrintOrder[] = validRows.flatMap((row) => {
    const status = orderStatus(row);
    if (!status) return [];
    const customer = row.customer_name || "Student";
    const pageCode = row.id.replaceAll("-", "").slice(0, 8).toUpperCase();
    return [{
      databaseId: row.id,
      id: `PF-${pageCode}`,
      customer,
      initials: customerInitials(customer),
      time: relativeTime(row.created_at, nowMs),
      fileName: row.original_filename,
      pages: row.selected_pages.length,
      copies: row.copies,
      amount: Number(row.amount_paise) / 100,
      status,
      accent: ["sage", "blue", "peach", "lavender"][parseInt(pageCode.slice(0, 2), 16) % 4],
    }];
  });

  const claims = (await supabase.auth.getClaims()).data?.claims;
  const emailName = typeof claims?.email === "string" ? claims.email.split("@")[0] : "Shopkeeper";
  const userMetadata = claims?.user_metadata;
  const metadataName = userMetadata && typeof userMetadata === "object" && "full_name" in userMetadata && typeof userMetadata.full_name === "string" ? userMetadata.full_name : null;
  const accountName = metadataName || emailName.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return <Dashboard
    initialOrders={initialOrders}
    metrics={metrics}
    shopName={shop.name}
    shopOpen={shop.is_open}
    accountName={accountName}
    todayLabel={new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)}
  />;
}
