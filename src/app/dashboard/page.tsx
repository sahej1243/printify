import DashboardLoader from "./dashboard-loader";

// The dashboard reads the signed-in shopkeeper's Supabase session per request.
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DashboardLoader />;
}
