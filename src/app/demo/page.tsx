import Dashboard from "@/components/dashboard/dashboard";
import { mockAnalytics, mockOrders } from "@/data/mock-orders";
import type { DashboardMetrics, PrintOrder } from "@/types/order";

export const metadata = { title: "Printify shop preview" };

export default function DemoDashboardPage() {
  const initialOrders: PrintOrder[] = mockOrders.map((order) => ({ ...order, databaseId: order.id }));
  const metrics: DashboardMetrics = {
    pagesPrinted: mockAnalytics.pagesPrinted,
    completedOrders: mockAnalytics.completedOrders,
    earnings: mockAnalytics.earnings,
    timeSavedMinutes: mockAnalytics.timeSavedMinutes,
    weeklyPages: mockAnalytics.weeklyPages,
    weeklyLabels: ["M", "T", "W", "T", "F", "S", "S"],
  };

  return <Dashboard
    initialOrders={initialOrders}
    metrics={metrics}
    shopName="Campus Print House"
    shopOpen
    accountName="Bhoomika 💌"
    todayLabel={new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
    demo
  />;
}
