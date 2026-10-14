import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInShopkeeper } from "@/app/shop/actions";

export const dynamic = "force-dynamic";

type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ShopLoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { data: assignment } = typeof userId === "string"
    ? await supabase.from("shop_staff").select("shop_id").eq("user_id", userId).limit(1).maybeSingle()
    : { data: null };
  if (assignment) redirect("/dashboard");

  const { error } = await searchParams;
  const message = error === "unassigned" || (typeof userId === "string" && !assignment)
    ? "This account doesn't have access to a shop yet. Ask Printify to invite you."
    : error === "invalid"
      ? "That email and password combination wasn't recognized."
      : null;

  return <main className="shop-login-page">
    <header className="shop-login-header"><div className="student-brand"><span className="student-brand-mark"><span /></span>printify<span className="student-brand-dot">.</span></div></header>
    <section className="shop-login-card">
      <span className="student-eyebrow">PRINTIFY FOR SHOPS</span>
      <h1>Welcome back.</h1>
      <p>Sign in to manage your print queue and student pickups.</p>
      <form action={signInShopkeeper} className="shop-login-form">
        <label htmlFor="shop-email">Work email</label>
        <input id="shop-email" name="email" type="email" autoComplete="username" placeholder="you@printshop.com" required maxLength={254} />
        <label htmlFor="shop-password">Password</label>
        <input id="shop-password" name="password" type="password" autoComplete="current-password" required maxLength={256} />
        {message && <p className="shop-login-error" role="alert">{message}</p>}
        <button type="submit">Sign in to your shop <span>→</span></button>
      </form>
      <div className="shop-login-note"><span>⌑</span><p>Shop access is invite-only. Your account can only see orders assigned to your shop.</p></div>
    </section>
    <footer className="shop-login-footer">Printify <span>·</span> Shopkeeper portal</footer>
  </main>;
}
