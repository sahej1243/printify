import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_VERSION } from "@/lib/version";
import StudentAccount from "@/components/student/student-account";

export const dynamic = "force-dynamic";

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

export default async function StudentAccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/student/login");

  const admin = createAdminClient();
  const { data } = await admin.from("orders")
    .select("id,customer_name,original_filename,page_count,selected_pages,copies,amount_paise,payment_status,fulfillment_status,created_at")
    .eq("student_user_id", user.id)
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false })
    .limit(100);

  const orders = (data || []) as OrderRow[];
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const updatesEnabled = user.user_metadata?.save_order_history !== false;

  return <main className="student-page student-account-page">
    <header className="student-header"><Link href="/" className="student-brand"><span className="student-brand-mark"><span /></span>printify<span className="student-brand-dot">.</span></Link><div className="student-account-header-actions"><span>{user.email}</span><Link className="student-shop-link" href="/">New order →</Link></div></header>
    <StudentAccount name={name} email={user.email ?? ""} updatesEnabled={updatesEnabled} orders={orders} />
    <footer className="student-footer"><span>© 2026 Printify · v{APP_VERSION}</span><span>Student account · private history</span><span>Need help? <a href="https://wa.me/919268729970" target="_blank" rel="noopener noreferrer">Get in touch</a></span></footer>
  </main>;
}
